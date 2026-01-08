/**
 * GPU N-Tuple Network - GPU加速的N-Tuple网络
 * 
 * 实现N-Tuple Network的GPU加速版本，支持：
 * - 权重从CPU加载到GPU
 * - 对称变换索引预计算
 * - 批量状态评估
 * - 梯度累积和权重更新
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { GPU, IKernelRunShortcut } from 'gpu.js';
import { GPUEngine } from './gpu-engine';
import { Pattern, calculateLutSize } from '../patterns';
import { NTupleNetwork } from '../network';

// ============================================
// 常量定义
// ============================================

/** 棋盘大小 */
const BOARD_SIZE = 4;

/** 对称变换数量 */
const NUM_SYMMETRIES = 8;

// ============================================
// 对称变换预计算
// ============================================

/**
 * 将(row, col)坐标转换为位置索引
 */
function coordToPos(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * 将位置索引转换为(row, col)坐标
 */
function posToCoord(pos: number): { row: number; col: number } {
  return {
    row: Math.floor(pos / BOARD_SIZE),
    col: pos % BOARD_SIZE,
  };
}

/**
 * 8种对称变换函数
 * 返回变换后的位置索引
 */
const SYMMETRY_TRANSFORMS: ((pos: number) => number)[] = [
  // 0: 恒等变换
  (pos) => pos,
  
  // 1: 顺时针旋转90度 (row, col) → (col, 3-row)
  (pos) => {
    const { row, col } = posToCoord(pos);
    return coordToPos(col, BOARD_SIZE - 1 - row);
  },
  
  // 2: 旋转180度 (row, col) → (3-row, 3-col)
  (pos) => {
    const { row, col } = posToCoord(pos);
    return coordToPos(BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col);
  },
  
  // 3: 顺时针旋转270度 (row, col) → (3-col, row)
  (pos) => {
    const { row, col } = posToCoord(pos);
    return coordToPos(BOARD_SIZE - 1 - col, row);
  },
  
  // 4: 水平镜像 (row, col) → (row, 3-col)
  (pos) => {
    const { row, col } = posToCoord(pos);
    return coordToPos(row, BOARD_SIZE - 1 - col);
  },
  
  // 5: 水平镜像后旋转90度
  (pos) => {
    const { row, col } = posToCoord(pos);
    const mirroredCol = BOARD_SIZE - 1 - col;
    return coordToPos(mirroredCol, BOARD_SIZE - 1 - row);
  },
  
  // 6: 水平镜像后旋转180度
  (pos) => {
    const { row, col } = posToCoord(pos);
    const mirroredCol = BOARD_SIZE - 1 - col;
    return coordToPos(BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - mirroredCol);
  },
  
  // 7: 水平镜像后旋转270度
  (pos) => {
    const { row, col } = posToCoord(pos);
    const mirroredCol = BOARD_SIZE - 1 - col;
    return coordToPos(BOARD_SIZE - 1 - mirroredCol, row);
  },
];

/**
 * 预计算对称变换后的元组模式
 * 
 * @param patterns 原始元组模式数组
 * @returns 扁平化的对称变换索引数组
 *          格式: [pattern0_sym0_pos0, pattern0_sym0_pos1, ..., pattern0_sym1_pos0, ...]
 */
export function precomputeSymmetryIndices(patterns: Pattern[]): Int32Array {
  const totalSize = patterns.reduce((sum, p) => sum + p.length * NUM_SYMMETRIES, 0);
  const indices = new Int32Array(totalSize);
  
  let offset = 0;
  for (const pattern of patterns) {
    for (let sym = 0; sym < NUM_SYMMETRIES; sym++) {
      const transform = SYMMETRY_TRANSFORMS[sym];
      for (const pos of pattern) {
        indices[offset++] = transform(pos);
      }
    }
  }
  
  return indices;
}

/**
 * 获取对称变换索引的偏移量信息
 * 
 * @param patterns 元组模式数组
 * @returns 每个模式的偏移量数组
 */
export function getSymmetryOffsets(patterns: Pattern[]): Int32Array {
  const offsets = new Int32Array(patterns.length + 1);
  let offset = 0;
  
  for (let i = 0; i < patterns.length; i++) {
    offsets[i] = offset;
    offset += patterns[i].length * NUM_SYMMETRIES;
  }
  offsets[patterns.length] = offset;
  
  return offsets;
}

// ============================================
// GPU权重缓冲区
// ============================================

/**
 * GPU权重存储接口
 */
export interface GPUWeightBuffers {
  /** 权重数据（所有模式的权重连续存储） */
  weights: Float32Array;
  /** 每个模式的权重偏移量 */
  offsets: Int32Array;
  /** 每个模式的LUT大小 */
  lutSizes: Int32Array;
  /** 预计算的对称变换索引 */
  symmetryIndices: Int32Array;
  /** 对称变换索引的偏移量 */
  symmetryOffsets: Int32Array;
  /** 元组模式大小数组 */
  patternSizes: Int32Array;
}

/**
 * GPU梯度缓冲区接口
 */
export interface GPUGradientBuffers {
  /** 梯度数据（与权重结构相同） */
  gradients: Float32Array;
  /** 梯度累积计数 */
  accumulationCount: number;
}

// ============================================
// GPU N-Tuple Network 类
// ============================================

/**
 * GPU加速的N-Tuple Network
 * 
 * 将N-Tuple Network的评估和更新操作移到GPU上执行，
 * 支持批量状态评估以提高训练吞吐量。
 */
export class GPUNTupleNetwork {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** GPU.js实例 */
  private gpu: GPU;
  
  /** 元组模式 */
  private patterns: Pattern[];
  
  /** LUT大小数组 */
  private lutSizes: number[];
  
  /** GPU权重缓冲区 */
  private weightBuffers: GPUWeightBuffers | null = null;
  
  /** GPU梯度缓冲区 */
  private gradientBuffers: GPUGradientBuffers | null = null;
  
  /** 批量评估内核 */
  private evaluateKernel: IKernelRunShortcut | null = null;
  
  /** 梯度累积内核 */
  private accumulateGradientsKernel: IKernelRunShortcut | null = null;
  
  /** 权重更新内核 */
  private updateWeightsKernel: IKernelRunShortcut | null = null;
  
  /** 批量大小 */
  private batchSize: number;
  
  /** 是否已初始化 */
  private initialized: boolean = false;
  
  /** CPU参考网络（用于验证） */
  private cpuNetwork: NTupleNetwork | null = null;
  
  /**
   * 构造函数
   * 
   * @param engine GPU引擎
   * @param patterns 元组模式数组
   */
  constructor(engine: GPUEngine, patterns: Pattern[]) {
    this.engine = engine;
    this.gpu = engine.getGPU();
    this.patterns = patterns;
    this.lutSizes = patterns.map(p => calculateLutSize(p.length));
    this.batchSize = engine.getBatchSize();
  }
  
  /**
   * 初始化GPU网络
   * 
   * 创建权重缓冲区和评估内核
   */
  initialize(): void {
    if (this.initialized) return;
    
    // 初始化权重缓冲区
    this.initializeWeightBuffers();
    
    // 初始化梯度缓冲区
    this.initializeGradientBuffers();
    
    // 创建评估内核
    this.createEvaluateKernel();
    
    // 创建梯度累积内核
    this.createAccumulateGradientsKernel();
    
    // 创建权重更新内核
    this.createUpdateWeightsKernel();
    
    this.initialized = true;
  }
  
  /**
   * 初始化权重缓冲区
   */
  private initializeWeightBuffers(): void {
    // 计算总权重大小
    const totalWeightSize = this.lutSizes.reduce((sum, size) => sum + size, 0);
    
    // 计算偏移量
    const offsets = new Int32Array(this.patterns.length + 1);
    let offset = 0;
    for (let i = 0; i < this.patterns.length; i++) {
      offsets[i] = offset;
      offset += this.lutSizes[i];
    }
    offsets[this.patterns.length] = offset;
    
    // 预计算对称变换索引
    const symmetryIndices = precomputeSymmetryIndices(this.patterns);
    const symmetryOffsets = getSymmetryOffsets(this.patterns);
    
    // 模式大小数组
    const patternSizes = new Int32Array(this.patterns.map(p => p.length));
    
    this.weightBuffers = {
      weights: new Float32Array(totalWeightSize),
      offsets: offsets,
      lutSizes: new Int32Array(this.lutSizes),
      symmetryIndices,
      symmetryOffsets,
      patternSizes,
    };
  }

  /**
   * 初始化梯度缓冲区
   * 
   * 创建与权重缓冲区相同大小的梯度缓冲区，用于累积TD误差梯度。
   * Requirements: 4.1, 4.4
   */
  private initializeGradientBuffers(): void {
    if (!this.weightBuffers) {
      throw new Error('Weight buffers must be initialized before gradient buffers');
    }
    
    const totalSize = this.weightBuffers.weights.length;
    
    this.gradientBuffers = {
      gradients: new Float32Array(totalSize),
      accumulationCount: 0,
    };
  }

  /**
   * 将权重从CPU加载到GPU
   * 
   * @param weights CPU权重数组（Float64Array[]）
   */
  loadWeightsToGPU(weights: Float64Array[]): void {
    if (!this.initialized) {
      this.initialize();
    }
    
    if (weights.length !== this.patterns.length) {
      throw new Error(
        `Weight array count mismatch: expected ${this.patterns.length}, got ${weights.length}`
      );
    }
    
    // 验证每个权重数组的大小
    for (let i = 0; i < weights.length; i++) {
      if (weights[i].length !== this.lutSizes[i]) {
        throw new Error(
          `Weight size mismatch for pattern ${i}: expected ${this.lutSizes[i]}, got ${weights[i].length}`
        );
      }
    }
    
    // 将Float64Array转换为Float32Array并复制到GPU缓冲区
    const buffers = this.weightBuffers!;
    for (let i = 0; i < weights.length; i++) {
      const offset = buffers.offsets[i];
      for (let j = 0; j < weights[i].length; j++) {
        buffers.weights[offset + j] = weights[i][j];
      }
    }
    
    // 同时创建CPU参考网络
    this.cpuNetwork = new NTupleNetwork(this.patterns);
    this.cpuNetwork.loadWeights({
      version: 1,
      patterns: this.patterns,
      weights: weights.map(w => Array.from(w)),
    });
  }
  
  /**
   * 从NTupleNetwork加载权重
   * 
   * @param network CPU N-Tuple网络
   */
  loadFromNetwork(network: NTupleNetwork): void {
    const weights = network.getWeights();
    this.loadWeightsToGPU(weights);
    this.cpuNetwork = network;
  }
  
  /**
   * 创建批量评估内核
   */
  private createEvaluateKernel(): void {
    const numPatterns = this.patterns.length;
    const maxPatternSize = Math.max(...this.patterns.map(p => p.length));
    
    // 创建评估内核
    // 输入: boards[batchSize * 16], weights[], symmetryIndices[], offsets[], lutSizes[], patternSizes[], symmetryOffsets[]
    // 输出: [batchSize] - 每个棋盘的评估分数
    this.evaluateKernel = this.gpu.createKernel(function(
      boards: number[],
      weights: number[],
      symmetryIndices: number[],
      offsets: number[],
      lutSizes: number[],
      patternSizes: number[],
      symmetryOffsets: number[]
    ) {
      const batchIdx = this.thread.x;
      const boardOffset = batchIdx * 16;
      let totalScore = 0;
      
      // 遍历每个元组模式
      const numPatternsConst = this.constants.numPatterns as number;
      for (let p = 0; p < numPatternsConst; p++) {
        const patternSize = patternSizes[p];
        const weightOffset = offsets[p];
        const symOffset = symmetryOffsets[p];
        
        // 遍历8种对称变换
        for (let s = 0; s < 8; s++) {
          // 计算元组索引
          let index = 0;
          const symPatternOffset = symOffset + s * patternSize;
          
          for (let i = 0; i < patternSize; i++) {
            const pos = symmetryIndices[symPatternOffset + i];
            const tileValue = boards[boardOffset + pos];
            index = index * 16 + Math.floor(tileValue);
          }
          
          // 累加权重值
          totalScore += weights[weightOffset + index];
        }
      }
      
      return totalScore;
    }, {
      output: [this.batchSize],
      constants: {
        numPatterns,
        maxPatternSize,
      },
    });
  }
  
  /**
   * 创建梯度累积内核
   * 
   * 该内核计算每个棋盘状态对应的元组索引，并将TD误差累积到梯度缓冲区。
   * 由于GPU.js不支持原子操作，我们在CPU端进行梯度累积。
   * 
   * Requirements: 4.1, 4.4
   */
  private createAccumulateGradientsKernel(): void {
    // GPU.js不支持原子操作，所以梯度累积在CPU端进行
    // 这里我们创建一个内核来计算每个棋盘状态的元组索引
    // 然后在CPU端累积梯度
    
    const numPatterns = this.patterns.length;
    const maxPatternSize = Math.max(...this.patterns.map(p => p.length));
    
    // 创建索引计算内核
    // 输出: [batchSize, numPatterns * 8] - 每个棋盘的每个模式每个对称变换的索引
    this.accumulateGradientsKernel = this.gpu.createKernel(function(
      boards: number[],
      symmetryIndices: number[],
      patternSizes: number[],
      symmetryOffsets: number[]
    ) {
      const batchIdx = this.thread.y;
      const indexIdx = this.thread.x; // patternIdx * 8 + symmetryIdx
      const boardOffset = batchIdx * 16;
      
      const numPatternsConst = this.constants.numPatterns as number;
      const patternIdx = Math.floor(indexIdx / 8);
      const symmetryIdx = indexIdx % 8;
      
      if (patternIdx >= numPatternsConst) {
        return -1; // 无效索引
      }
      
      const patternSize = patternSizes[patternIdx];
      const symOffset = symmetryOffsets[patternIdx];
      const symPatternOffset = symOffset + symmetryIdx * patternSize;
      
      // 计算元组索引
      let index = 0;
      for (let i = 0; i < patternSize; i++) {
        const pos = symmetryIndices[symPatternOffset + i];
        const tileValue = boards[boardOffset + pos];
        index = index * 16 + Math.floor(tileValue);
      }
      
      return index;
    }, {
      output: [numPatterns * NUM_SYMMETRIES, this.batchSize],
      constants: {
        numPatterns,
        maxPatternSize,
      },
    });
  }
  
  /**
   * 创建权重更新内核
   * 
   * 该内核将累积的梯度应用到权重上。
   * 
   * Requirements: 4.2, 4.3
   */
  private createUpdateWeightsKernel(): void {
    const totalWeightSize = this.lutSizes.reduce((sum, size) => sum + size, 0);
    
    // 创建权重更新内核
    // weights[i] += gradients[i] * learningRate
    this.updateWeightsKernel = this.gpu.createKernel(function(
      weights: number[],
      gradients: number[],
      learningRate: number
    ) {
      const idx = this.thread.x;
      return weights[idx] + gradients[idx] * learningRate;
    }, {
      output: [totalWeightSize],
    });
  }
  
  /**
   * 批量评估棋盘状态
   * 
   * @param boards 批量棋盘数据 [batchSize * 16]
   * @param count 实际要评估的棋盘数量（可选，默认为batchSize）
   * @returns 评估分数数组 [count]
   */
  batchEvaluate(boards: Float32Array, count?: number): Float32Array {
    if (!this.initialized) {
      this.initialize();
    }
    
    const actualCount = count ?? this.batchSize;
    
    if (actualCount > this.batchSize) {
      throw new Error(
        `Batch count ${actualCount} exceeds configured batch size ${this.batchSize}`
      );
    }
    
    const buffers = this.weightBuffers!;
    
    // 执行GPU内核
    const result = this.evaluateKernel!(
      Array.from(boards),
      Array.from(buffers.weights),
      Array.from(buffers.symmetryIndices),
      Array.from(buffers.offsets),
      Array.from(buffers.lutSizes),
      Array.from(buffers.patternSizes),
      Array.from(buffers.symmetryOffsets)
    ) as number[];
    
    // 转换结果
    const scores = new Float32Array(actualCount);
    for (let i = 0; i < actualCount; i++) {
      scores[i] = result[i];
    }
    
    return scores;
  }
  
  /**
   * 评估单个棋盘状态
   * 
   * @param board 棋盘数据 [16]
   * @returns 评估分数
   */
  evaluate(board: Float32Array): number {
    // 对于单个棋盘，使用CPU评估更高效
    if (this.cpuNetwork) {
      // 将Float32Array转换为BigInt位棋盘
      let bigIntBoard = 0n;
      for (let i = 0; i < 16; i++) {
        const tile = Math.floor(board[i]);
        bigIntBoard |= BigInt(tile) << BigInt(i * 4);
      }
      return this.cpuNetwork.evaluate(bigIntBoard);
    }
    
    // 如果没有CPU网络，使用GPU批量评估
    const batchBoards = new Float32Array(this.batchSize * 16);
    batchBoards.set(board);
    const scores = this.batchEvaluate(batchBoards, 1);
    return scores[0];
  }

  /**
   * 批量计算TD误差并累积梯度
   * 
   * 对于每个棋盘状态，计算其对应的元组索引，并将TD误差累积到梯度缓冲区。
   * 梯度累积公式: gradient[index] += tdError
   * 
   * @param boards 批量棋盘数据 [batchSize * 16]
   * @param tdErrors TD误差数组 [batchSize]
   * @param count 实际要处理的棋盘数量（可选，默认为batchSize）
   * 
   * Requirements: 4.1, 4.4
   */
  batchAccumulateGradients(
    boards: Float32Array,
    tdErrors: Float32Array,
    count?: number
  ): void {
    if (!this.initialized) {
      this.initialize();
    }
    
    const actualCount = count ?? this.batchSize;
    
    if (actualCount > this.batchSize) {
      throw new Error(
        `Batch count ${actualCount} exceeds configured batch size ${this.batchSize}`
      );
    }
    
    const buffers = this.weightBuffers!;
    const gradientBuffers = this.gradientBuffers!;
    const numPatterns = this.patterns.length;
    
    // 使用GPU内核计算所有元组索引
    const indices = this.accumulateGradientsKernel!(
      Array.from(boards),
      Array.from(buffers.symmetryIndices),
      Array.from(buffers.patternSizes),
      Array.from(buffers.symmetryOffsets)
    ) as number[][];
    
    // 在CPU端累积梯度（GPU.js不支持原子操作）
    for (let batchIdx = 0; batchIdx < actualCount; batchIdx++) {
      const tdError = tdErrors[batchIdx];
      
      for (let patternIdx = 0; patternIdx < numPatterns; patternIdx++) {
        const weightOffset = buffers.offsets[patternIdx];
        
        for (let symIdx = 0; symIdx < NUM_SYMMETRIES; symIdx++) {
          const indexIdx = patternIdx * NUM_SYMMETRIES + symIdx;
          const tupleIndex = indices[batchIdx][indexIdx];
          
          if (tupleIndex >= 0) {
            gradientBuffers.gradients[weightOffset + tupleIndex] += tdError;
          }
        }
      }
    }
    
    gradientBuffers.accumulationCount += actualCount;
  }
  
  /**
   * 为单个棋盘状态累积梯度
   * 
   * @param board 棋盘数据 [16]
   * @param tdError TD误差
   * 
   * Requirements: 4.1, 4.4
   */
  accumulateGradient(board: Float32Array, tdError: number): void {
    if (!this.initialized) {
      this.initialize();
    }
    
    const buffers = this.weightBuffers!;
    const gradientBuffers = this.gradientBuffers!;
    
    // 对于单个棋盘，直接在CPU端计算索引并累积梯度
    for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
      const patternSize = buffers.patternSizes[patternIdx];
      const weightOffset = buffers.offsets[patternIdx];
      const symOffset = buffers.symmetryOffsets[patternIdx];
      
      for (let symIdx = 0; symIdx < NUM_SYMMETRIES; symIdx++) {
        const symPatternOffset = symOffset + symIdx * patternSize;
        
        // 计算元组索引
        let index = 0;
        for (let i = 0; i < patternSize; i++) {
          const pos = buffers.symmetryIndices[symPatternOffset + i];
          const tileValue = Math.floor(board[pos]);
          index = index * 16 + tileValue;
        }
        
        // 累积梯度
        gradientBuffers.gradients[weightOffset + index] += tdError;
      }
    }
    
    gradientBuffers.accumulationCount++;
  }
  
  /**
   * 应用累积的梯度更新权重
   * 
   * 使用GPU内核将累积的梯度应用到权重上。
   * 更新公式: weights[i] += gradients[i] * learningRate
   * 
   * @param learningRate 学习率
   * 
   * Requirements: 4.2, 4.3
   */
  applyGradients(learningRate: number): void {
    if (!this.initialized) {
      throw new Error('GPU network not initialized');
    }
    
    const buffers = this.weightBuffers!;
    const gradientBuffers = this.gradientBuffers!;
    
    if (gradientBuffers.accumulationCount === 0) {
      return; // 没有累积的梯度
    }
    
    // 使用GPU内核更新权重
    const updatedWeights = this.updateWeightsKernel!(
      Array.from(buffers.weights),
      Array.from(gradientBuffers.gradients),
      learningRate
    ) as number[];
    
    // 将更新后的权重复制回缓冲区
    for (let i = 0; i < updatedWeights.length; i++) {
      buffers.weights[i] = updatedWeights[i];
    }
    
    // 同步更新CPU参考网络
    if (this.cpuNetwork) {
      const cpuWeights = this.cpuNetwork.getWeights();
      for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
        const offset = buffers.offsets[patternIdx];
        const size = this.lutSizes[patternIdx];
        for (let j = 0; j < size; j++) {
          cpuWeights[patternIdx][j] = buffers.weights[offset + j];
        }
      }
    }
    
    // 清空梯度缓冲区
    this.clearGradients();
  }
  
  /**
   * 批量更新权重（直接更新，不使用梯度累积）
   * 
   * 对于每个棋盘状态，直接计算并应用权重更新。
   * 这是一个便捷方法，等价于 accumulateGradients + applyGradients。
   * 
   * @param boards 批量棋盘数据 [batchSize * 16]
   * @param tdErrors TD误差数组 [batchSize]
   * @param learningRate 学习率
   * @param count 实际要处理的棋盘数量（可选，默认为batchSize）
   * 
   * Requirements: 4.2, 4.3
   */
  batchUpdateWeights(
    boards: Float32Array,
    tdErrors: Float32Array,
    learningRate: number,
    count?: number
  ): void {
    // 累积梯度
    this.batchAccumulateGradients(boards, tdErrors, count);
    
    // 应用梯度
    this.applyGradients(learningRate);
  }
  
  /**
   * 更新单个棋盘状态的权重
   * 
   * 直接更新权重，不使用梯度累积。
   * 等价于 CPU 版本的 network.updateWeights(board, learningRate * tdError)
   * 
   * @param board 棋盘数据 [16]
   * @param tdError TD误差
   * @param learningRate 学习率
   * 
   * Requirements: 4.2
   */
  updateWeights(board: Float32Array, tdError: number, learningRate: number): void {
    // 累积梯度
    this.accumulateGradient(board, tdError);
    
    // 应用梯度
    this.applyGradients(learningRate);
  }
  
  /**
   * 应用学习率衰减
   * 
   * 计算衰减后的学习率。
   * 衰减公式: newLR = currentLR * decayRate
   * 
   * @param currentLearningRate 当前学习率
   * @param decayRate 衰减率（0 < decayRate < 1）
   * @returns 衰减后的学习率
   * 
   * Requirements: 4.3
   */
  static applyLearningRateDecay(
    currentLearningRate: number,
    decayRate: number
  ): number {
    if (decayRate <= 0 || decayRate >= 1) {
      throw new Error(`Invalid decay rate: ${decayRate}. Must be between 0 and 1.`);
    }
    return currentLearningRate * decayRate;
  }
  
  /**
   * 计算带衰减的学习率
   * 
   * 根据当前训练轮数计算学习率。
   * 
   * @param initialLearningRate 初始学习率
   * @param decayRate 衰减率
   * @param decayInterval 衰减间隔（每多少轮衰减一次）
   * @param currentEpisode 当前训练轮数
   * @returns 当前学习率
   * 
   * Requirements: 4.3
   */
  static calculateLearningRate(
    initialLearningRate: number,
    decayRate: number,
    decayInterval: number,
    currentEpisode: number
  ): number {
    if (decayInterval <= 0) {
      return initialLearningRate;
    }
    
    const decaySteps = Math.floor(currentEpisode / decayInterval);
    return initialLearningRate * Math.pow(decayRate, decaySteps);
  }
  
  /**
   * 清空梯度缓冲区
   * 
   * 将所有梯度值重置为0，并重置累积计数。
   */
  clearGradients(): void {
    if (!this.gradientBuffers) return;
    
    this.gradientBuffers.gradients.fill(0);
    this.gradientBuffers.accumulationCount = 0;
  }
  
  /**
   * 获取梯度累积计数
   * 
   * @returns 当前累积的梯度数量
   */
  getGradientAccumulationCount(): number {
    return this.gradientBuffers?.accumulationCount ?? 0;
  }
  
  /**
   * 获取梯度缓冲区（用于调试）
   * 
   * @returns 梯度缓冲区
   */
  getGradientBuffers(): GPUGradientBuffers | null {
    return this.gradientBuffers;
  }

  /**
   * 从GPU导出权重到CPU
   * 
   * @returns CPU权重数组（Float64Array[]）
   */
  exportWeightsToCPU(): Float64Array[] {
    if (!this.initialized || !this.weightBuffers) {
      throw new Error('GPU network not initialized');
    }
    
    const buffers = this.weightBuffers;
    const weights: Float64Array[] = [];
    
    for (let i = 0; i < this.patterns.length; i++) {
      const offset = buffers.offsets[i];
      const size = this.lutSizes[i];
      const patternWeights = new Float64Array(size);
      
      for (let j = 0; j < size; j++) {
        patternWeights[j] = buffers.weights[offset + j];
      }
      
      weights.push(patternWeights);
    }
    
    return weights;
  }
  
  /**
   * 获取权重统计信息
   * 
   * @returns 权重统计（最小值、最大值、平均值）
   */
  getWeightStats(): { min: number; max: number; mean: number; nonZeroCount: number } {
    if (!this.initialized || !this.weightBuffers) {
      return { min: 0, max: 0, mean: 0, nonZeroCount: 0 };
    }
    
    const weights = this.weightBuffers.weights;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let nonZeroCount = 0;
    
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      if (w < min) min = w;
      if (w > max) max = w;
      sum += w;
      if (w !== 0) nonZeroCount++;
    }
    
    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
      mean: weights.length > 0 ? sum / weights.length : 0,
      nonZeroCount,
    };
  }
  
  /**
   * 获取CPU参考网络
   * 
   * @returns CPU N-Tuple网络（用于验证）
   */
  getCPUNetwork(): NTupleNetwork | null {
    return this.cpuNetwork;
  }
  
  /**
   * 获取元组模式
   */
  getPatterns(): Pattern[] {
    return this.patterns;
  }
  
  /**
   * 获取LUT大小数组
   */
  getLutSizes(): number[] {
    return this.lutSizes;
  }
  
  /**
   * 获取权重缓冲区（用于调试）
   */
  getWeightBuffers(): GPUWeightBuffers | null {
    return this.weightBuffers;
  }
  
  /**
   * 更新批量大小
   * 需要重新创建评估内核
   * 
   * @param newBatchSize 新的批量大小
   */
  updateBatchSize(newBatchSize: number): void {
    if (newBatchSize === this.batchSize) return;
    
    this.batchSize = newBatchSize;
    
    // 销毁旧内核
    if (this.evaluateKernel) {
      this.evaluateKernel.destroy();
      this.evaluateKernel = null;
    }
    if (this.accumulateGradientsKernel) {
      this.accumulateGradientsKernel.destroy();
      this.accumulateGradientsKernel = null;
    }
    
    // 重新创建内核
    if (this.initialized) {
      this.createEvaluateKernel();
      this.createAccumulateGradientsKernel();
    }
  }
  
  /**
   * 获取当前批量大小
   */
  getBatchSize(): number {
    return this.batchSize;
  }
  
  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 释放资源
   */
  dispose(): void {
    if (this.evaluateKernel) {
      this.evaluateKernel.destroy();
      this.evaluateKernel = null;
    }
    if (this.accumulateGradientsKernel) {
      this.accumulateGradientsKernel.destroy();
      this.accumulateGradientsKernel = null;
    }
    if (this.updateWeightsKernel) {
      this.updateWeightsKernel.destroy();
      this.updateWeightsKernel = null;
    }
    
    this.weightBuffers = null;
    this.gradientBuffers = null;
    this.cpuNetwork = null;
    this.initialized = false;
  }
}

// ============================================
// CPU参考评估（用于验证）
// ============================================

/**
 * CPU参考评估器
 * 
 * 使用与GPU相同的算法在CPU上执行评估，
 * 用于验证GPU计算的正确性。
 */
export class CPUEvaluationReference {
  private patterns: Pattern[];
  private lutSizes: number[];
  private symmetryIndices: Int32Array;
  private symmetryOffsets: Int32Array;
  private patternSizes: Int32Array;
  
  constructor(patterns: Pattern[]) {
    this.patterns = patterns;
    this.lutSizes = patterns.map(p => calculateLutSize(p.length));
    this.symmetryIndices = precomputeSymmetryIndices(patterns);
    this.symmetryOffsets = getSymmetryOffsets(patterns);
    this.patternSizes = new Int32Array(patterns.map(p => p.length));
  }
  
  /**
   * 评估单个棋盘状态
   * 
   * @param board 棋盘数据 [16]
   * @param weights 权重数据（扁平化）
   * @param offsets 权重偏移量
   * @returns 评估分数
   */
  evaluate(board: Float32Array, weights: Float32Array, offsets: Int32Array): number {
    let totalScore = 0;
    
    for (let p = 0; p < this.patterns.length; p++) {
      const patternSize = this.patternSizes[p];
      const weightOffset = offsets[p];
      const symOffset = this.symmetryOffsets[p];
      
      for (let s = 0; s < NUM_SYMMETRIES; s++) {
        let index = 0;
        const symPatternOffset = symOffset + s * patternSize;
        
        for (let i = 0; i < patternSize; i++) {
          const pos = this.symmetryIndices[symPatternOffset + i];
          const tileValue = Math.floor(board[pos]);
          index = index * 16 + tileValue;
        }
        
        totalScore += weights[weightOffset + index];
      }
    }
    
    return totalScore;
  }
  
  /**
   * 批量评估棋盘状态
   * 
   * @param boards 批量棋盘数据 [batchSize * 16]
   * @param weights 权重数据
   * @param offsets 权重偏移量
   * @param batchSize 批量大小
   * @returns 评估分数数组
   */
  batchEvaluate(
    boards: Float32Array,
    weights: Float32Array,
    offsets: Int32Array,
    batchSize: number
  ): Float32Array {
    const scores = new Float32Array(batchSize);
    
    for (let i = 0; i < batchSize; i++) {
      const board = new Float32Array(16);
      for (let j = 0; j < 16; j++) {
        board[j] = boards[i * 16 + j];
      }
      scores[i] = this.evaluate(board, weights, offsets);
    }
    
    return scores;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建GPU N-Tuple网络
 * 
 * @param engine GPU引擎
 * @param patterns 元组模式数组
 * @returns 初始化后的GPU N-Tuple网络
 */
export function createGPUNTupleNetwork(
  engine: GPUEngine,
  patterns: Pattern[]
): GPUNTupleNetwork {
  const network = new GPUNTupleNetwork(engine, patterns);
  network.initialize();
  return network;
}

/**
 * 从CPU网络创建GPU网络
 * 
 * @param engine GPU引擎
 * @param cpuNetwork CPU N-Tuple网络
 * @returns 初始化后的GPU N-Tuple网络（包含权重）
 */
export function createGPUNetworkFromCPU(
  engine: GPUEngine,
  cpuNetwork: NTupleNetwork
): GPUNTupleNetwork {
  const network = new GPUNTupleNetwork(engine, cpuNetwork.getPatterns());
  network.initialize();
  network.loadFromNetwork(cpuNetwork);
  return network;
}
