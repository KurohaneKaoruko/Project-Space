/**
 * GPU Move Kernels - GPU移动计算内核
 * 
 * 实现2048游戏的四个方向移动内核（上、下、左、右）。
 * 使用预计算查找表加速移动计算。
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { GPU, IKernelRunShortcut } from 'gpu.js';
import { GPUEngine } from './gpu-engine';
import { BatchBoardState, createBatchBoardState } from './board-utils';

/**
 * 移动结果
 */
export interface MoveResult {
  /** 移动后的棋盘状态 */
  afterstates: Float32Array;
  /** 移动获得的分数 */
  rewards: Float32Array;
  /** 移动是否有效 */
  valid: Uint8Array;
}

/**
 * 行移动查找表
 * 预计算所有65536种可能的行状态的移动结果
 */
export interface RowMoveLUT {
  /** 移动后的行值 */
  rows: Float32Array;
  /** 移动获得的分数 */
  scores: Float32Array;
}

/**
 * 计算单行向左移动的结果
 * @param row 原始行（16位，4个4位方块）
 * @returns [移动后的行, 得分]
 */
function computeRowLeft(row: number): [number, number] {
  // 提取4个方块值
  const tiles = [
    (row >> 12) & 0xF,
    (row >> 8) & 0xF,
    (row >> 4) & 0xF,
    row & 0xF,
  ];

  let score = 0;
  
  // 移除空格，将非空方块向左压缩
  const nonEmpty = tiles.filter(t => t !== 0);
  
  // 合并相邻相同的方块
  const merged: number[] = [];
  let i = 0;
  while (i < nonEmpty.length) {
    if (i + 1 < nonEmpty.length && nonEmpty[i] === nonEmpty[i + 1]) {
      // 合并：值+1（指数增加），得分为合并后的值
      const newValue = nonEmpty[i] + 1;
      merged.push(newValue);
      score += 1 << newValue; // 2^newValue
      i += 2;
    } else {
      merged.push(nonEmpty[i]);
      i++;
    }
  }
  
  // 填充空格到4个位置
  while (merged.length < 4) {
    merged.push(0);
  }
  
  // 组合成16位行
  const newRow = (merged[0] << 12) | (merged[1] << 8) | (merged[2] << 4) | merged[3];
  
  return [newRow, score];
}

/**
 * 反转行（用于计算向右移动）
 * @param row 原始行
 * @returns 反转后的行
 */
function reverseRow(row: number): number {
  return (
    ((row & 0xF) << 12) |
    (((row >> 4) & 0xF) << 8) |
    (((row >> 8) & 0xF) << 4) |
    ((row >> 12) & 0xF)
  );
}

/**
 * 生成向左移动的查找表
 * @returns 向左移动查找表
 */
export function generateLeftLUT(): RowMoveLUT {
  const rows = new Float32Array(65536);
  const scores = new Float32Array(65536);
  
  for (let row = 0; row < 65536; row++) {
    const [newRow, score] = computeRowLeft(row);
    rows[row] = newRow;
    scores[row] = score;
  }
  
  return { rows, scores };
}

/**
 * 生成向右移动的查找表
 * @returns 向右移动查找表
 */
export function generateRightLUT(): RowMoveLUT {
  const rows = new Float32Array(65536);
  const scores = new Float32Array(65536);
  
  for (let row = 0; row < 65536; row++) {
    // 向右移动 = 反转 -> 向左 -> 反转
    const reversed = reverseRow(row);
    const [leftResult, score] = computeRowLeft(reversed);
    rows[row] = reverseRow(leftResult);
    scores[row] = score;
  }
  
  return { rows, scores };
}

/**
 * 将4个方块值组合成行索引
 * @param t0 第一个方块值
 * @param t1 第二个方块值
 * @param t2 第三个方块值
 * @param t3 第四个方块值
 * @returns 16位行索引
 */
function tilesToRowIndex(t0: number, t1: number, t2: number, t3: number): number {
  return (t0 << 12) | (t1 << 8) | (t2 << 4) | t3;
}

/**
 * 从行值提取4个方块值
 * @param row 16位行值
 * @returns [t0, t1, t2, t3]
 */
function rowToTiles(row: number): [number, number, number, number] {
  return [
    (row >> 12) & 0xF,
    (row >> 8) & 0xF,
    (row >> 4) & 0xF,
    row & 0xF,
  ];
}

/**
 * GPU移动内核管理器
 * 
 * 管理GPU移动计算内核的创建和执行。
 * 使用预计算查找表加速移动计算。
 */
export class GPUMoveKernels {
  private engine: GPUEngine;
  private gpu: GPU;
  
  /** 预计算的查找表 */
  private leftLUT: RowMoveLUT;
  private rightLUT: RowMoveLUT;
  
  /** GPU内核 */
  private moveLeftKernel: IKernelRunShortcut | null = null;
  private moveRightKernel: IKernelRunShortcut | null = null;
  private moveUpKernel: IKernelRunShortcut | null = null;
  private moveDownKernel: IKernelRunShortcut | null = null;
  
  /** 批量大小 */
  private batchSize: number;
  
  /** 是否已初始化 */
  private initialized: boolean = false;
  
  constructor(engine: GPUEngine) {
    this.engine = engine;
    this.gpu = engine.getGPU();
    this.batchSize = engine.getBatchSize();
    
    // 生成预计算查找表
    this.leftLUT = generateLeftLUT();
    this.rightLUT = generateRightLUT();
  }
  
  /**
   * 初始化GPU内核
   */
  initialize(): void {
    if (this.initialized) return;
    
    this.createMoveKernels();
    this.initialized = true;
  }
  
  /**
   * 创建移动内核
   */
  private createMoveKernels(): void {
    const batchSize = this.batchSize;
    
    // 向左移动内核
    // 输入: boards[batchSize * 16], leftRows[65536], leftScores[65536]
    // 输出: [batchSize, 17] - 16个方块值 + 1个分数
    this.moveLeftKernel = this.gpu.createKernel(function(
      boards: number[],
      leftRows: number[],
      leftScores: number[]
    ) {
      const batchIdx = this.thread.y;
      const outputIdx = this.thread.x;
      const boardOffset = batchIdx * 16;
      
      if (outputIdx < 16) {
        // 输出方块值
        const row = Math.floor(outputIdx / 4);
        const col = outputIdx % 4;
        
        // 获取当前行的4个方块
        const t0 = boards[boardOffset + row * 4 + 0];
        const t1 = boards[boardOffset + row * 4 + 1];
        const t2 = boards[boardOffset + row * 4 + 2];
        const t3 = boards[boardOffset + row * 4 + 3];
        
        // 计算行索引
        const rowIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
        
        // 查找移动后的行
        const newRow = leftRows[rowIndex];
        
        // 提取对应位置的方块值
        if (col === 0) return Math.floor(newRow / 4096) % 16;
        if (col === 1) return Math.floor(newRow / 256) % 16;
        if (col === 2) return Math.floor(newRow / 16) % 16;
        return Math.floor(newRow) % 16;
      } else {
        // 输出分数（索引16）
        let totalScore = 0;
        for (let r = 0; r < 4; r++) {
          const t0 = boards[boardOffset + r * 4 + 0];
          const t1 = boards[boardOffset + r * 4 + 1];
          const t2 = boards[boardOffset + r * 4 + 2];
          const t3 = boards[boardOffset + r * 4 + 3];
          const rowIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
          totalScore += leftScores[rowIndex];
        }
        return totalScore;
      }
    }, {
      output: [17, batchSize],
      constants: { batchSize },
    });
    
    // 向右移动内核
    this.moveRightKernel = this.gpu.createKernel(function(
      boards: number[],
      rightRows: number[],
      rightScores: number[]
    ) {
      const batchIdx = this.thread.y;
      const outputIdx = this.thread.x;
      const boardOffset = batchIdx * 16;
      
      if (outputIdx < 16) {
        const row = Math.floor(outputIdx / 4);
        const col = outputIdx % 4;
        
        const t0 = boards[boardOffset + row * 4 + 0];
        const t1 = boards[boardOffset + row * 4 + 1];
        const t2 = boards[boardOffset + row * 4 + 2];
        const t3 = boards[boardOffset + row * 4 + 3];
        
        const rowIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
        const newRow = rightRows[rowIndex];
        
        if (col === 0) return Math.floor(newRow / 4096) % 16;
        if (col === 1) return Math.floor(newRow / 256) % 16;
        if (col === 2) return Math.floor(newRow / 16) % 16;
        return Math.floor(newRow) % 16;
      } else {
        let totalScore = 0;
        for (let r = 0; r < 4; r++) {
          const t0 = boards[boardOffset + r * 4 + 0];
          const t1 = boards[boardOffset + r * 4 + 1];
          const t2 = boards[boardOffset + r * 4 + 2];
          const t3 = boards[boardOffset + r * 4 + 3];
          const rowIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
          totalScore += rightScores[rowIndex];
        }
        return totalScore;
      }
    }, {
      output: [17, batchSize],
      constants: { batchSize },
    });
    
    // 向上移动内核（转置后向左移动）
    this.moveUpKernel = this.gpu.createKernel(function(
      boards: number[],
      leftRows: number[],
      leftScores: number[]
    ) {
      const batchIdx = this.thread.y;
      const outputIdx = this.thread.x;
      const boardOffset = batchIdx * 16;
      
      if (outputIdx < 16) {
        const row = Math.floor(outputIdx / 4);
        const col = outputIdx % 4;
        
        // 对于向上移动，我们处理列而不是行
        // 获取当前列的4个方块（转置）
        const t0 = boards[boardOffset + 0 * 4 + col];
        const t1 = boards[boardOffset + 1 * 4 + col];
        const t2 = boards[boardOffset + 2 * 4 + col];
        const t3 = boards[boardOffset + 3 * 4 + col];
        
        const colIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
        const newCol = leftRows[colIndex];
        
        // 提取对应行位置的方块值
        if (row === 0) return Math.floor(newCol / 4096) % 16;
        if (row === 1) return Math.floor(newCol / 256) % 16;
        if (row === 2) return Math.floor(newCol / 16) % 16;
        return Math.floor(newCol) % 16;
      } else {
        let totalScore = 0;
        for (let c = 0; c < 4; c++) {
          const t0 = boards[boardOffset + 0 * 4 + c];
          const t1 = boards[boardOffset + 1 * 4 + c];
          const t2 = boards[boardOffset + 2 * 4 + c];
          const t3 = boards[boardOffset + 3 * 4 + c];
          const colIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
          totalScore += leftScores[colIndex];
        }
        return totalScore;
      }
    }, {
      output: [17, batchSize],
      constants: { batchSize },
    });
    
    // 向下移动内核（转置后向右移动）
    this.moveDownKernel = this.gpu.createKernel(function(
      boards: number[],
      rightRows: number[],
      rightScores: number[]
    ) {
      const batchIdx = this.thread.y;
      const outputIdx = this.thread.x;
      const boardOffset = batchIdx * 16;
      
      if (outputIdx < 16) {
        const row = Math.floor(outputIdx / 4);
        const col = outputIdx % 4;
        
        // 获取当前列的4个方块
        const t0 = boards[boardOffset + 0 * 4 + col];
        const t1 = boards[boardOffset + 1 * 4 + col];
        const t2 = boards[boardOffset + 2 * 4 + col];
        const t3 = boards[boardOffset + 3 * 4 + col];
        
        const colIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
        const newCol = rightRows[colIndex];
        
        if (row === 0) return Math.floor(newCol / 4096) % 16;
        if (row === 1) return Math.floor(newCol / 256) % 16;
        if (row === 2) return Math.floor(newCol / 16) % 16;
        return Math.floor(newCol) % 16;
      } else {
        let totalScore = 0;
        for (let c = 0; c < 4; c++) {
          const t0 = boards[boardOffset + 0 * 4 + c];
          const t1 = boards[boardOffset + 1 * 4 + c];
          const t2 = boards[boardOffset + 2 * 4 + c];
          const t3 = boards[boardOffset + 3 * 4 + c];
          const colIndex = Math.floor(t0) * 4096 + Math.floor(t1) * 256 + Math.floor(t2) * 16 + Math.floor(t3);
          totalScore += rightScores[colIndex];
        }
        return totalScore;
      }
    }, {
      output: [17, batchSize],
      constants: { batchSize },
    });
  }

  
  /**
   * 执行批量向左移动
   * 
   * @param boards 批量棋盘状态
   * @returns 移动结果
   */
  batchMoveLeft(boards: BatchBoardState): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    const result = this.moveLeftKernel!(
      Array.from(boards.data),
      Array.from(this.leftLUT.rows),
      Array.from(this.leftLUT.scores)
    ) as number[][];
    
    return this.parseKernelResult(result, boards);
  }
  
  /**
   * 执行批量向右移动
   * 
   * @param boards 批量棋盘状态
   * @returns 移动结果
   */
  batchMoveRight(boards: BatchBoardState): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    const result = this.moveRightKernel!(
      Array.from(boards.data),
      Array.from(this.rightLUT.rows),
      Array.from(this.rightLUT.scores)
    ) as number[][];
    
    return this.parseKernelResult(result, boards);
  }
  
  /**
   * 执行批量向上移动
   * 
   * @param boards 批量棋盘状态
   * @returns 移动结果
   */
  batchMoveUp(boards: BatchBoardState): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    const result = this.moveUpKernel!(
      Array.from(boards.data),
      Array.from(this.leftLUT.rows),
      Array.from(this.leftLUT.scores)
    ) as number[][];
    
    return this.parseKernelResult(result, boards);
  }
  
  /**
   * 执行批量向下移动
   * 
   * @param boards 批量棋盘状态
   * @returns 移动结果
   */
  batchMoveDown(boards: BatchBoardState): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    const result = this.moveDownKernel!(
      Array.from(boards.data),
      Array.from(this.rightLUT.rows),
      Array.from(this.rightLUT.scores)
    ) as number[][];
    
    return this.parseKernelResult(result, boards);
  }
  
  /**
   * 执行批量移动（指定方向）
   * 
   * @param boards 批量棋盘状态
   * @param direction 移动方向（0=上, 1=右, 2=下, 3=左）
   * @returns 移动结果
   */
  batchMove(boards: BatchBoardState, direction: number): MoveResult {
    switch (direction) {
      case 0: return this.batchMoveUp(boards);
      case 1: return this.batchMoveRight(boards);
      case 2: return this.batchMoveDown(boards);
      case 3: return this.batchMoveLeft(boards);
      default: throw new Error(`Invalid direction: ${direction}`);
    }
  }
  
  /**
   * 执行批量移动（每个游戏可以有不同的方向）
   * 
   * @param boards 批量棋盘状态
   * @param directions 每个游戏的移动方向数组
   * @returns 移动结果
   */
  batchMoveWithDirections(boards: BatchBoardState, directions: Uint8Array): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    // 对于不同方向的移动，我们需要分别处理每个方向
    // 然后根据directions数组选择正确的结果
    const leftResult = this.batchMoveLeft(boards);
    const rightResult = this.batchMoveRight(boards);
    const upResult = this.batchMoveUp(boards);
    const downResult = this.batchMoveDown(boards);
    
    const afterstates = new Float32Array(boards.batchSize * 16);
    const rewards = new Float32Array(boards.batchSize);
    const valid = new Uint8Array(boards.batchSize);
    
    for (let i = 0; i < boards.batchSize; i++) {
      const dir = directions[i];
      let result: MoveResult;
      
      switch (dir) {
        case 0: result = upResult; break;
        case 1: result = rightResult; break;
        case 2: result = downResult; break;
        case 3: result = leftResult; break;
        default: result = leftResult; break;
      }
      
      // 复制对应游戏的结果
      for (let j = 0; j < 16; j++) {
        afterstates[i * 16 + j] = result.afterstates[i * 16 + j];
      }
      rewards[i] = result.rewards[i];
      valid[i] = result.valid[i];
    }
    
    return { afterstates, rewards, valid };
  }
  
  /**
   * 解析内核输出结果
   * 
   * @param result 内核输出 [batchSize][17]
   * @param originalBoards 原始棋盘状态（用于检测移动是否有效）
   * @returns 移动结果
   */
  private parseKernelResult(result: number[][], originalBoards: BatchBoardState): MoveResult {
    const batchSize = this.batchSize;
    const afterstates = new Float32Array(batchSize * 16);
    const rewards = new Float32Array(batchSize);
    const valid = new Uint8Array(batchSize);
    
    for (let i = 0; i < batchSize; i++) {
      // 提取16个方块值
      let changed = false;
      for (let j = 0; j < 16; j++) {
        afterstates[i * 16 + j] = result[i][j];
        if (result[i][j] !== originalBoards.data[i * 16 + j]) {
          changed = true;
        }
      }
      
      // 提取分数
      rewards[i] = result[i][16];
      
      // 检测移动是否有效（棋盘是否发生变化）
      valid[i] = changed ? 1 : 0;
    }
    
    return { afterstates, rewards, valid };
  }
  
  /**
   * 获取查找表（用于调试或CPU验证）
   */
  getLUTs(): { left: RowMoveLUT; right: RowMoveLUT } {
    return {
      left: this.leftLUT,
      right: this.rightLUT,
    };
  }
  
  /**
   * 更新批量大小
   * 需要重新创建内核
   * 
   * @param newBatchSize 新的批量大小
   */
  updateBatchSize(newBatchSize: number): void {
    if (newBatchSize === this.batchSize) return;
    
    this.batchSize = newBatchSize;
    this.initialized = false;
    
    // 销毁旧内核
    this.disposeKernels();
    
    // 重新初始化
    this.initialize();
  }
  
  /**
   * 销毁内核
   */
  private disposeKernels(): void {
    if (this.moveLeftKernel) {
      this.moveLeftKernel.destroy();
      this.moveLeftKernel = null;
    }
    if (this.moveRightKernel) {
      this.moveRightKernel.destroy();
      this.moveRightKernel = null;
    }
    if (this.moveUpKernel) {
      this.moveUpKernel.destroy();
      this.moveUpKernel = null;
    }
    if (this.moveDownKernel) {
      this.moveDownKernel.destroy();
      this.moveDownKernel = null;
    }
  }
  
  /**
   * 释放资源
   */
  dispose(): void {
    this.disposeKernels();
    this.initialized = false;
  }
}

/**
 * CPU参考实现 - 用于验证GPU计算正确性
 * 
 * 使用与GPU相同的查找表，但在CPU上执行
 */
export class CPUMoveReference {
  private leftLUT: RowMoveLUT;
  private rightLUT: RowMoveLUT;
  
  constructor() {
    this.leftLUT = generateLeftLUT();
    this.rightLUT = generateRightLUT();
  }
  
  /**
   * 执行单个棋盘的向左移动
   * 
   * @param board 棋盘数据（16个元素的Float32Array）
   * @returns [移动后的棋盘, 分数, 是否有效]
   */
  moveLeft(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let row = 0; row < 4; row++) {
      const t0 = Math.floor(board[row * 4 + 0]);
      const t1 = Math.floor(board[row * 4 + 1]);
      const t2 = Math.floor(board[row * 4 + 2]);
      const t3 = Math.floor(board[row * 4 + 3]);
      
      const rowIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newRow = this.leftLUT.rows[rowIndex];
      const score = this.leftLUT.scores[rowIndex];
      
      result[row * 4 + 0] = Math.floor(newRow / 4096) % 16;
      result[row * 4 + 1] = Math.floor(newRow / 256) % 16;
      result[row * 4 + 2] = Math.floor(newRow / 16) % 16;
      result[row * 4 + 3] = Math.floor(newRow) % 16;
      
      totalScore += score;
      
      if (newRow !== rowIndex) {
        changed = true;
      }
    }
    
    return [result, totalScore, changed];
  }
  
  /**
   * 执行单个棋盘的向右移动
   */
  moveRight(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let row = 0; row < 4; row++) {
      const t0 = Math.floor(board[row * 4 + 0]);
      const t1 = Math.floor(board[row * 4 + 1]);
      const t2 = Math.floor(board[row * 4 + 2]);
      const t3 = Math.floor(board[row * 4 + 3]);
      
      const rowIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newRow = this.rightLUT.rows[rowIndex];
      const score = this.rightLUT.scores[rowIndex];
      
      result[row * 4 + 0] = Math.floor(newRow / 4096) % 16;
      result[row * 4 + 1] = Math.floor(newRow / 256) % 16;
      result[row * 4 + 2] = Math.floor(newRow / 16) % 16;
      result[row * 4 + 3] = Math.floor(newRow) % 16;
      
      totalScore += score;
      
      if (newRow !== rowIndex) {
        changed = true;
      }
    }
    
    return [result, totalScore, changed];
  }
  
  /**
   * 执行单个棋盘的向上移动
   */
  moveUp(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let col = 0; col < 4; col++) {
      const t0 = Math.floor(board[0 * 4 + col]);
      const t1 = Math.floor(board[1 * 4 + col]);
      const t2 = Math.floor(board[2 * 4 + col]);
      const t3 = Math.floor(board[3 * 4 + col]);
      
      const colIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newCol = this.leftLUT.rows[colIndex];
      const score = this.leftLUT.scores[colIndex];
      
      result[0 * 4 + col] = Math.floor(newCol / 4096) % 16;
      result[1 * 4 + col] = Math.floor(newCol / 256) % 16;
      result[2 * 4 + col] = Math.floor(newCol / 16) % 16;
      result[3 * 4 + col] = Math.floor(newCol) % 16;
      
      totalScore += score;
      
      if (newCol !== colIndex) {
        changed = true;
      }
    }
    
    return [result, totalScore, changed];
  }
  
  /**
   * 执行单个棋盘的向下移动
   */
  moveDown(board: Float32Array): [Float32Array, number, boolean] {
    const result = new Float32Array(16);
    let totalScore = 0;
    let changed = false;
    
    for (let col = 0; col < 4; col++) {
      const t0 = Math.floor(board[0 * 4 + col]);
      const t1 = Math.floor(board[1 * 4 + col]);
      const t2 = Math.floor(board[2 * 4 + col]);
      const t3 = Math.floor(board[3 * 4 + col]);
      
      const colIndex = t0 * 4096 + t1 * 256 + t2 * 16 + t3;
      const newCol = this.rightLUT.rows[colIndex];
      const score = this.rightLUT.scores[colIndex];
      
      result[0 * 4 + col] = Math.floor(newCol / 4096) % 16;
      result[1 * 4 + col] = Math.floor(newCol / 256) % 16;
      result[2 * 4 + col] = Math.floor(newCol / 16) % 16;
      result[3 * 4 + col] = Math.floor(newCol) % 16;
      
      totalScore += score;
      
      if (newCol !== colIndex) {
        changed = true;
      }
    }
    
    return [result, totalScore, changed];
  }
  
  /**
   * 执行单个棋盘的移动（指定方向）
   * 
   * @param board 棋盘数据
   * @param direction 移动方向（0=上, 1=右, 2=下, 3=左）
   * @returns [移动后的棋盘, 分数, 是否有效]
   */
  move(board: Float32Array, direction: number): [Float32Array, number, boolean] {
    switch (direction) {
      case 0: return this.moveUp(board);
      case 1: return this.moveRight(board);
      case 2: return this.moveDown(board);
      case 3: return this.moveLeft(board);
      default: throw new Error(`Invalid direction: ${direction}`);
    }
  }
  
  /**
   * 批量执行移动（CPU版本，用于验证）
   * 
   * @param boards 批量棋盘状态
   * @param direction 移动方向
   * @returns 移动结果
   */
  batchMove(boards: BatchBoardState, direction: number): MoveResult {
    const afterstates = new Float32Array(boards.batchSize * 16);
    const rewards = new Float32Array(boards.batchSize);
    const valid = new Uint8Array(boards.batchSize);
    
    for (let i = 0; i < boards.batchSize; i++) {
      const board = new Float32Array(16);
      for (let j = 0; j < 16; j++) {
        board[j] = boards.data[i * 16 + j];
      }
      
      const [result, score, changed] = this.move(board, direction);
      
      for (let j = 0; j < 16; j++) {
        afterstates[i * 16 + j] = result[j];
      }
      rewards[i] = score;
      valid[i] = changed ? 1 : 0;
    }
    
    return { afterstates, rewards, valid };
  }
}
