/**
 * Batch Game Simulator - 批量游戏模拟器
 * 
 * 在GPU上并行模拟多局2048游戏。
 * 支持批量移动执行、随机方块添加、游戏结束检测和重置。
 * 
 * Requirements: 2.1, 2.2, 2.5, 2.6
 */

import { GPUEngine } from './gpu-engine';
import { GPUMoveKernels, MoveResult } from './move-kernels';
import {
  BatchGameState,
  BatchBoardState,
  createBatchGameState,
  getEmptyPositionsInBatch,
  resetGameInBatch,
} from './board-utils';

/**
 * 批量游戏模拟器
 * 
 * 管理多局游戏的并行模拟，包括：
 * - 批量游戏初始化
 * - 批量移动执行
 * - 批量随机方块添加
 * - 批量游戏结束检测
 * - 已完成游戏的重置
 */
export class BatchGameSimulator {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** GPU移动内核 */
  private moveKernels: GPUMoveKernels;
  
  /** 批量大小 */
  private batchSize: number;
  
  /** 是否已初始化 */
  private initialized: boolean = false;
  
  /**
   * 构造函数
   * 
   * @param engine GPU引擎实例
   * @param batchSize 批量大小（并行游戏数），默认使用引擎配置
   */
  constructor(engine: GPUEngine, batchSize?: number) {
    this.engine = engine;
    this.batchSize = batchSize ?? engine.getBatchSize();
    this.moveKernels = new GPUMoveKernels(engine);
  }
  
  /**
   * 初始化模拟器
   * 
   * 初始化GPU移动内核。
   */
  initialize(): void {
    if (this.initialized) return;
    
    this.moveKernels.initialize();
    this.initialized = true;
  }
  
  /**
   * 初始化一批新游戏
   * 
   * 创建batchSize个新游戏，每个游戏有2个随机初始方块。
   * 
   * @returns 初始化的批量游戏状态
   */
  initBatch(): BatchGameState {
    if (!this.initialized) {
      this.initialize();
    }
    
    const state = createBatchGameState(this.batchSize);
    
    // 为每个游戏添加2个初始方块
    for (let i = 0; i < this.batchSize; i++) {
      this.addRandomTileToGame(state, i);
      this.addRandomTileToGame(state, i);
    }
    
    return state;
  }
  
  /**
   * 批量执行移动，返回afterstates
   * 
   * 对批量中的所有游戏执行相同方向的移动。
   * 
   * @param states 批量游戏状态
   * @param direction 移动方向（0=上, 1=右, 2=下, 3=左）
   * @returns 移动结果（afterstates、rewards、valid）
   */
  batchMove(states: BatchGameState, direction: number): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    // 创建BatchBoardState用于移动内核
    const boardState: BatchBoardState = {
      data: states.boards,
      batchSize: states.batchSize,
    };
    
    return this.moveKernels.batchMove(boardState, direction);
  }
  
  /**
   * 批量执行移动（每个游戏可以有不同的方向）
   * 
   * @param states 批量游戏状态
   * @param directions 每个游戏的移动方向数组
   * @returns 移动结果
   */
  batchMoveWithDirections(states: BatchGameState, directions: Uint8Array): MoveResult {
    if (!this.initialized) {
      this.initialize();
    }
    
    const boardState: BatchBoardState = {
      data: states.boards,
      batchSize: states.batchSize,
    };
    
    return this.moveKernels.batchMoveWithDirections(boardState, directions);
  }
  
  /**
   * 应用移动结果到游戏状态
   * 
   * 将移动结果（afterstates和rewards）应用到游戏状态，
   * 更新棋盘、分数和步数。
   * 
   * @param states 批量游戏状态
   * @param result 移动结果
   */
  applyMoveResult(states: BatchGameState, result: MoveResult): void {
    for (let i = 0; i < states.batchSize; i++) {
      if (result.valid[i]) {
        // 更新棋盘
        for (let j = 0; j < 16; j++) {
          states.boards[i * 16 + j] = result.afterstates[i * 16 + j];
        }
        // 更新分数
        states.scores[i] += result.rewards[i];
        // 更新步数
        states.moves[i]++;
      }
    }
  }
  
  /**
   * 批量添加随机方块
   * 
   * 为每个有效移动的游戏添加一个随机方块。
   * 90%概率添加2（值=1），10%概率添加4（值=2）。
   * 
   * @param states 批量游戏状态
   * @param validMoves 可选，指定哪些游戏需要添加方块（默认所有未结束的游戏）
   */
  batchAddRandomTile(states: BatchGameState, validMoves?: Uint8Array): void {
    for (let i = 0; i < states.batchSize; i++) {
      // 跳过已结束的游戏
      if (states.gameOver[i]) continue;
      
      // 如果提供了validMoves，只为有效移动的游戏添加方块
      if (validMoves && !validMoves[i]) continue;
      
      this.addRandomTileToGame(states, i);
    }
  }
  
  /**
   * 为单个游戏添加随机方块
   * 
   * @param states 批量游戏状态
   * @param gameIndex 游戏索引
   */
  private addRandomTileToGame(states: BatchGameState, gameIndex: number): void {
    const boardState: BatchBoardState = {
      data: states.boards,
      batchSize: states.batchSize,
    };
    
    const emptyPositions = getEmptyPositionsInBatch(boardState, gameIndex);
    
    if (emptyPositions.length === 0) return;
    
    // 随机选择一个空位置
    const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    
    // 90%概率是2（值=1），10%概率是4（值=2）
    const value = Math.random() < 0.9 ? 1 : 2;
    
    // 设置方块
    states.boards[gameIndex * 16 + pos] = value;
  }
  
  /**
   * 批量检查游戏是否结束
   * 
   * 检查每个游戏是否还有有效移动。
   * 游戏结束条件：没有空格且没有可合并的相邻方块。
   * 
   * @param states 批量游戏状态
   * @returns 每个游戏是否结束的标记数组
   */
  batchCheckGameOver(states: BatchGameState): Uint8Array {
    const result = new Uint8Array(states.batchSize);
    
    for (let i = 0; i < states.batchSize; i++) {
      result[i] = this.isGameOver(states, i) ? 1 : 0;
      states.gameOver[i] = result[i];
    }
    
    return result;
  }
  
  /**
   * 检查单个游戏是否结束
   * 
   * @param states 批量游戏状态
   * @param gameIndex 游戏索引
   * @returns 如果游戏结束返回true
   */
  private isGameOver(states: BatchGameState, gameIndex: number): boolean {
    const offset = gameIndex * 16;
    
    // 检查是否有空格
    for (let i = 0; i < 16; i++) {
      if (states.boards[offset + i] === 0) {
        return false;
      }
    }
    
    // 检查是否有可合并的相邻方块
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const pos = r * 4 + c;
        const tile = states.boards[offset + pos];
        
        // 检查右边
        if (c < 3 && states.boards[offset + pos + 1] === tile) {
          return false;
        }
        
        // 检查下边
        if (r < 3 && states.boards[offset + pos + 4] === tile) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * 重置已完成的游戏
   * 
   * 找出所有已结束的游戏，重置它们并添加初始方块。
   * 
   * @param states 批量游戏状态
   * @returns 被重置的游戏索引数组
   */
  resetCompletedGames(states: BatchGameState): number[] {
    const resetIndices: number[] = [];
    
    for (let i = 0; i < states.batchSize; i++) {
      if (states.gameOver[i]) {
        // 重置游戏
        resetGameInBatch(states, i);
        
        // 添加2个初始方块
        this.addRandomTileToGame(states, i);
        this.addRandomTileToGame(states, i);
        
        resetIndices.push(i);
      }
    }
    
    return resetIndices;
  }
  
  /**
   * 执行完整的一步游戏
   * 
   * 包括：移动 -> 添加随机方块 -> 检查游戏结束
   * 
   * @param states 批量游戏状态
   * @param direction 移动方向
   * @returns 移动结果
   */
  step(states: BatchGameState, direction: number): MoveResult {
    // 执行移动
    const result = this.batchMove(states, direction);
    
    // 应用移动结果
    this.applyMoveResult(states, result);
    
    // 为有效移动的游戏添加随机方块
    this.batchAddRandomTile(states, result.valid);
    
    // 检查游戏结束
    this.batchCheckGameOver(states);
    
    return result;
  }
  
  /**
   * 执行完整的一步游戏（每个游戏不同方向）
   * 
   * @param states 批量游戏状态
   * @param directions 每个游戏的移动方向
   * @returns 移动结果
   */
  stepWithDirections(states: BatchGameState, directions: Uint8Array): MoveResult {
    // 执行移动
    const result = this.batchMoveWithDirections(states, directions);
    
    // 应用移动结果
    this.applyMoveResult(states, result);
    
    // 为有效移动的游戏添加随机方块
    this.batchAddRandomTile(states, result.valid);
    
    // 检查游戏结束
    this.batchCheckGameOver(states);
    
    return result;
  }

  
  /**
   * 获取批量中活跃（未结束）的游戏数量
   * 
   * @param states 批量游戏状态
   * @returns 活跃游戏数量
   */
  getActiveGameCount(states: BatchGameState): number {
    let count = 0;
    for (let i = 0; i < states.batchSize; i++) {
      if (!states.gameOver[i]) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 获取批量中已完成的游戏数量
   * 
   * @param states 批量游戏状态
   * @returns 已完成游戏数量
   */
  getCompletedGameCount(states: BatchGameState): number {
    let count = 0;
    for (let i = 0; i < states.batchSize; i++) {
      if (states.gameOver[i]) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 获取批量统计信息
   * 
   * @param states 批量游戏状态
   * @returns 统计信息
   */
  getBatchStats(states: BatchGameState): {
    activeGames: number;
    completedGames: number;
    totalScore: number;
    avgScore: number;
    totalMoves: number;
    avgMoves: number;
    maxScore: number;
    maxMoves: number;
  } {
    let activeGames = 0;
    let completedGames = 0;
    let totalScore = 0;
    let totalMoves = 0;
    let maxScore = 0;
    let maxMoves = 0;
    
    for (let i = 0; i < states.batchSize; i++) {
      if (states.gameOver[i]) {
        completedGames++;
      } else {
        activeGames++;
      }
      
      totalScore += states.scores[i];
      totalMoves += states.moves[i];
      
      if (states.scores[i] > maxScore) {
        maxScore = states.scores[i];
      }
      if (states.moves[i] > maxMoves) {
        maxMoves = states.moves[i];
      }
    }
    
    return {
      activeGames,
      completedGames,
      totalScore,
      avgScore: totalScore / states.batchSize,
      totalMoves,
      avgMoves: totalMoves / states.batchSize,
      maxScore,
      maxMoves,
    };
  }
  
  /**
   * 获取指定游戏的最大方块值
   * 
   * @param states 批量游戏状态
   * @param gameIndex 游戏索引
   * @returns 最大方块的实际值（2, 4, 8, ..., 32768）
   */
  getMaxTile(states: BatchGameState, gameIndex: number): number {
    const offset = gameIndex * 16;
    let maxExp = 0;
    
    for (let i = 0; i < 16; i++) {
      const exp = states.boards[offset + i];
      if (exp > maxExp) {
        maxExp = exp;
      }
    }
    
    return maxExp === 0 ? 0 : 1 << maxExp;
  }
  
  /**
   * 获取批量中所有游戏的最大方块值
   * 
   * @param states 批量游戏状态
   * @returns 每个游戏的最大方块值数组
   */
  getAllMaxTiles(states: BatchGameState): number[] {
    const maxTiles: number[] = [];
    
    for (let i = 0; i < states.batchSize; i++) {
      maxTiles.push(this.getMaxTile(states, i));
    }
    
    return maxTiles;
  }
  
  /**
   * 检查指定游戏是否有有效移动
   * 
   * @param states 批量游戏状态
   * @param gameIndex 游戏索引
   * @param direction 移动方向
   * @returns 如果移动有效返回true
   */
  hasValidMove(states: BatchGameState, gameIndex: number, direction: number): boolean {
    // 创建单个游戏的临时状态
    const tempBoard = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      tempBoard[i] = states.boards[gameIndex * 16 + i];
    }
    
    const tempState: BatchBoardState = {
      data: tempBoard,
      batchSize: 1,
    };
    
    // 临时更新内核批量大小
    const originalBatchSize = this.batchSize;
    this.moveKernels.updateBatchSize(1);
    
    const result = this.moveKernels.batchMove(tempState, direction);
    
    // 恢复原始批量大小
    this.moveKernels.updateBatchSize(originalBatchSize);
    
    return result.valid[0] === 1;
  }
  
  /**
   * 获取指定游戏的所有有效移动方向
   * 
   * @param states 批量游戏状态
   * @param gameIndex 游戏索引
   * @returns 有效移动方向数组（0=上, 1=右, 2=下, 3=左）
   */
  getValidMoves(states: BatchGameState, gameIndex: number): number[] {
    const validMoves: number[] = [];
    
    for (let dir = 0; dir < 4; dir++) {
      if (this.hasValidMove(states, gameIndex, dir)) {
        validMoves.push(dir);
      }
    }
    
    return validMoves;
  }
  
  /**
   * 获取批量大小
   */
  getBatchSize(): number {
    return this.batchSize;
  }
  
  /**
   * 更新批量大小
   * 
   * @param newBatchSize 新的批量大小
   */
  updateBatchSize(newBatchSize: number): void {
    if (newBatchSize < 1) {
      throw new Error('Batch size must be at least 1');
    }
    
    this.batchSize = newBatchSize;
    this.moveKernels.updateBatchSize(newBatchSize);
  }
  
  /**
   * 获取GPU移动内核（用于高级操作）
   */
  getMoveKernels(): GPUMoveKernels {
    return this.moveKernels;
  }
  
  /**
   * 释放资源
   */
  dispose(): void {
    this.moveKernels.dispose();
    this.initialized = false;
  }
}

/**
 * 创建并初始化批量游戏模拟器的便捷函数
 * 
 * @param engine GPU引擎
 * @param batchSize 批量大小
 * @returns 初始化后的批量游戏模拟器
 */
export function createBatchSimulator(
  engine: GPUEngine,
  batchSize?: number
): BatchGameSimulator {
  const simulator = new BatchGameSimulator(engine, batchSize);
  simulator.initialize();
  return simulator;
}
