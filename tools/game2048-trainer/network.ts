/**
 * 2048 N-Tuple Network Training - Network Implementation
 * 
 * 训练专用的N-Tuple Network实现，使用Float64Array存储权重以提高精度。
 * 支持从位棋盘直接提取特征，避免矩阵转换开销。
 * 
 * 与Web应用的NTupleNetwork兼容，可以导出/导入相同格式的权重文件。
 */

import { Board, getTile } from './game';
import { Pattern, calculateLutSize } from './patterns';

// ============================================
// 类型定义
// ============================================

/**
 * 权重配置文件格式（与Web应用兼容）
 */
export interface WeightsConfig {
  /** 版本号 */
  version: number;
  
  /** 元组模式定义 */
  patterns: Pattern[];
  
  /** 权重数据 (每个元组一个数组) */
  weights: number[][];
  
  /** 元数据 */
  metadata?: {
    trainedGames?: number;
    avgScore?: number;
    maxTile?: number;
    rate2048?: number;
    rate4096?: number;
    rate8192?: number;
    trainingTime?: number;
  };
}

// ============================================
// 常量定义
// ============================================

/** 棋盘大小 */
const BOARD_SIZE = 4;

// ============================================
// 对称变换函数
// ============================================

/**
 * 位置变换函数类型
 */
type PositionTransform = (pos: number) => number;

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
 * 恒等变换（原始位置）
 */
function identity(pos: number): number {
  return pos;
}

/**
 * 顺时针旋转90度
 * (row, col) → (col, 3-row)
 */
function rotate90(pos: number): number {
  const { row, col } = posToCoord(pos);
  return coordToPos(col, BOARD_SIZE - 1 - row);
}

/**
 * 旋转180度
 * (row, col) → (3-row, 3-col)
 */
function rotate180(pos: number): number {
  const { row, col } = posToCoord(pos);
  return coordToPos(BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col);
}

/**
 * 顺时针旋转270度（逆时针90度）
 * (row, col) → (3-col, row)
 */
function rotate270(pos: number): number {
  const { row, col } = posToCoord(pos);
  return coordToPos(BOARD_SIZE - 1 - col, row);
}

/**
 * 水平镜像
 * (row, col) → (row, 3-col)
 */
function mirrorH(pos: number): number {
  const { row, col } = posToCoord(pos);
  return coordToPos(row, BOARD_SIZE - 1 - col);
}

/**
 * 水平镜像后旋转90度
 */
function mirrorH_rotate90(pos: number): number {
  return rotate90(mirrorH(pos));
}

/**
 * 水平镜像后旋转180度
 */
function mirrorH_rotate180(pos: number): number {
  return rotate180(mirrorH(pos));
}

/**
 * 水平镜像后旋转270度
 */
function mirrorH_rotate270(pos: number): number {
  return rotate270(mirrorH(pos));
}

/**
 * 8种对称变换函数数组
 */
const SYMMETRY_TRANSFORMS: PositionTransform[] = [
  identity,
  rotate90,
  rotate180,
  rotate270,
  mirrorH,
  mirrorH_rotate90,
  mirrorH_rotate180,
  mirrorH_rotate270,
];

/**
 * 预计算所有对称变换后的元组模式
 * 
 * @param pattern 原始元组模式
 * @returns 8种对称变换后的元组模式数组
 */
function precomputeSymmetricPatterns(pattern: Pattern): Pattern[] {
  return SYMMETRY_TRANSFORMS.map(transform => 
    pattern.map(pos => transform(pos))
  );
}

// ============================================
// 位棋盘特征提取
// ============================================

/**
 * 从位棋盘提取元组值并计算索引
 * 直接从位棋盘提取，避免矩阵转换开销
 * 
 * @param board 位棋盘
 * @param pattern 元组模式（位置索引数组）
 * @returns 查找表索引
 */
export function extractTupleIndex(board: Board, pattern: Pattern): number {
  let index = 0;
  for (const pos of pattern) {
    const tileExp = getTile(board, pos);
    index = index * 16 + tileExp;
  }
  return index;
}

// ============================================
// N-Tuple Network 类（训练版本）
// ============================================

/**
 * 训练用N-Tuple Network
 * 
 * 与Web应用版本的主要区别：
 * 1. 使用Float64Array存储权重（更高精度）
 * 2. 直接从位棋盘提取特征（更高性能）
 * 3. 提供导出为Web应用兼容格式的方法
 */
export class NTupleNetwork {
  /** 元组模式配置 */
  private patterns: Pattern[];
  
  /** 预计算的对称变换后的模式（每个原始模式对应8个变换后的模式） */
  private symmetricPatterns: Pattern[][];
  
  /** 权重查找表（每个元组一个Float64Array，训练时使用更高精度） */
  private weights: Float64Array[];
  
  /** 每个元组的LUT大小 */
  private lutSizes: number[];
  
  /**
   * 构造函数
   * @param patterns 元组模式数组
   */
  constructor(patterns: Pattern[]) {
    this.patterns = patterns;
    this.lutSizes = patterns.map(p => calculateLutSize(p.length));
    
    // 初始化权重为零（使用Float64Array提高精度）
    this.weights = this.lutSizes.map(size => new Float64Array(size));
    
    // 预计算对称变换后的模式
    this.symmetricPatterns = this.patterns.map(pattern => 
      precomputeSymmetricPatterns(pattern)
    );
  }
  
  /**
   * 评估位棋盘状态
   * 计算所有元组在所有对称变换下的评估值之和
   * 
   * @param board 位棋盘
   * @returns 评估分数
   */
  evaluate(board: Board): number {
    let totalScore = 0;
    
    // 遍历每个元组模式
    for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
      const symmetricPatternsForTuple = this.symmetricPatterns[patternIdx];
      const weightsForTuple = this.weights[patternIdx];
      
      // 遍历8种对称变换
      for (const transformedPattern of symmetricPatternsForTuple) {
        // 从位棋盘直接提取索引
        const index = extractTupleIndex(board, transformedPattern);
        
        // 累加权重值
        totalScore += weightsForTuple[index];
      }
    }
    
    return totalScore;
  }
  
  /**
   * 更新权重（用于TD Learning）
   * 
   * 遍历所有元组模式和8种对称变换，更新对应索引的权重值。
   * 每个元组的每个对称变换都会独立更新其对应的权重索引。
   * 
   * @param board 位棋盘状态（afterstate）
   * @param delta TD误差乘以学习率（α × δ）
   */
  updateWeights(board: Board, delta: number): void {
    // 遍历每个元组模式
    for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
      const symmetricPatternsForTuple = this.symmetricPatterns[patternIdx];
      const weightsForTuple = this.weights[patternIdx];
      
      // 遍历8种对称变换
      for (const transformedPattern of symmetricPatternsForTuple) {
        // 从位棋盘直接提取索引
        const index = extractTupleIndex(board, transformedPattern);
        
        // 更新权重
        weightsForTuple[index] += delta;
      }
    }
  }
  
  /**
   * 使用乐观初始值初始化权重
   * 
   * 将所有权重填充为指定的初始值。乐观初始化可以鼓励探索，
   * 因为未访问的状态会有较高的初始估值。
   * 
   * @param value 初始值
   */
  initOptimistic(value: number): void {
    for (const weights of this.weights) {
      weights.fill(value);
    }
  }
  
  /**
   * 导出权重为JSON格式（与Web应用兼容）
   * 
   * @param metadata 可选的训练元数据
   * @returns WeightsConfig对象
   */
  exportWeights(metadata?: WeightsConfig['metadata']): WeightsConfig {
    return {
      version: 1,
      patterns: this.patterns,
      weights: this.weights.map(w => Array.from(w)),
      metadata,
    };
  }
  
  /**
   * 从JSON格式加载权重
   * 
   * @param config 权重配置
   * @throws Error 如果模式不匹配
   */
  loadWeights(config: WeightsConfig): void {
    // 验证模式数量匹配
    if (config.patterns.length !== this.patterns.length) {
      throw new Error(
        `Pattern count mismatch: expected ${this.patterns.length}, got ${config.patterns.length}`
      );
    }
    
    // 验证每个模式的大小匹配
    for (let i = 0; i < this.patterns.length; i++) {
      if (config.patterns[i].length !== this.patterns[i].length) {
        throw new Error(
          `Pattern size mismatch at index ${i}: expected ${this.patterns[i].length}, got ${config.patterns[i].length}`
        );
      }
    }
    
    // 验证权重维度
    if (config.weights.length !== this.patterns.length) {
      throw new Error(
        `Weight array count mismatch: expected ${this.patterns.length}, got ${config.weights.length}`
      );
    }
    
    // 加载权重
    for (let i = 0; i < config.weights.length; i++) {
      const expectedSize = this.lutSizes[i];
      const actualSize = config.weights[i].length;
      
      if (actualSize !== expectedSize) {
        throw new Error(
          `Weight dimension mismatch for tuple ${i}: expected ${expectedSize}, got ${actualSize}`
        );
      }
      
      this.weights[i] = new Float64Array(config.weights[i]);
    }
  }
  
  /**
   * 获取元组模式
   */
  getPatterns(): Pattern[] {
    return this.patterns;
  }
  
  /**
   * 获取LUT大小
   */
  getLutSizes(): number[] {
    return this.lutSizes;
  }
  
  /**
   * 获取权重数组（用于调试）
   */
  getWeights(): Float64Array[] {
    return this.weights;
  }
}
