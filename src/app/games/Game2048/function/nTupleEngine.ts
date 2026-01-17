/**
 * N-Tuple Network Engine for 2048 AI
 * 
 * 基于查找表的棋盘评估方法，使用预训练权重对棋盘状态进行评估。
 * 
 * 核心概念：
 * - 将棋盘划分为多个重叠的元组（tuple），每个元组包含若干个固定位置的方块
 * - 对于每个元组，将其方块值组合成一个索引，查找对应的权重值
 * - 将所有元组的权重值相加，得到棋盘的总评估分数
 * - 利用棋盘的8重对称性（4旋转×2镜像）来增强评估的鲁棒性
 */

// ============================================
// 类型定义
// ============================================

/**
 * 元组模式定义
 * 每个元组是一组棋盘位置索引的数组（位置索引 = row * 4 + col，范围0-15）
 */
export type TuplePattern = number[];

/**
 * N-Tuple Network配置
 */
export interface NTupleConfig {
  /** 元组模式列表 */
  patterns: TuplePattern[];
}

/**
 * 位置变换函数类型
 * 输入: 位置索引 (0-15, row*4+col)
 * 输出: 变换后的位置索引
 */
export type PositionTransform = (pos: number) => number;

// ============================================
// 常量定义
// ============================================

/** 棋盘大小 */
const BOARD_SIZE = 4;

/** 最大方块值的指数（2^15 = 32768） */
const MAX_TILE_EXPONENT = 16;

/** 每个位置的索引基数（0-15共16种可能值） */
const INDEX_BASE = MAX_TILE_EXPONENT;

// ============================================
// 工具函数
// ============================================

/**
 * 将方块值转换为索引
 * - 空格 (0) → 索引 0
 * - 2 → 索引 1
 * - 4 → 索引 2
 * - 8 → 索引 3
 * - ...
 * - 32768 → 索引 15
 * 
 * @param tile 方块值（0, 2, 4, 8, ..., 32768）
 * @returns 索引值（0-15）
 */
export function tileToIndex(tile: number): number {
  if (tile === 0) return 0;
  return Math.log2(tile);
}

/**
 * 将元组中的方块值转换为查找表索引
 * 使用多项式哈希：index = t0 * 16^(n-1) + t1 * 16^(n-2) + ... + t(n-1)
 * 
 * @param tiles 元组中各位置的方块值数组
 * @returns 查找表索引
 */
export function tupleToIndex(tiles: number[]): number {
  let index = 0;
  for (let i = 0; i < tiles.length; i++) {
    index = index * INDEX_BASE + tileToIndex(tiles[i]);
  }
  return index;
}

/**
 * 计算给定元组大小的查找表大小
 * LUT大小 = 16^n（n为元组大小）
 * 
 * @param tupleSize 元组大小
 * @returns 查找表大小
 */
export function calculateLutSize(tupleSize: number): number {
  return Math.pow(INDEX_BASE, tupleSize);
}

/**
 * 从棋盘中提取指定位置的方块值
 * 
 * @param board 4x4棋盘矩阵
 * @param positions 位置索引数组（每个索引 = row * 4 + col）
 * @returns 对应位置的方块值数组
 */
export function extractTupleValues(board: number[][], positions: number[]): number[] {
  return positions.map(pos => {
    const row = Math.floor(pos / BOARD_SIZE);
    const col = pos % BOARD_SIZE;
    return board[row][col];
  });
}

// ============================================
// 对称变换函数
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
 * - identity: 原始
 * - rotate90: 顺时针旋转90度
 * - rotate180: 旋转180度
 * - rotate270: 顺时针旋转270度
 * - mirrorH: 水平镜像
 * - mirrorH_rotate90: 水平镜像后旋转90度
 * - mirrorH_rotate180: 水平镜像后旋转180度
 * - mirrorH_rotate270: 水平镜像后旋转270度
 */
export const SYMMETRY_TRANSFORMS: PositionTransform[] = [
  identity,
  rotate90,
  rotate180,
  rotate270,
  mirrorH,
  mirrorH_rotate90,
  mirrorH_rotate180,
  mirrorH_rotate270,
];

// 导出单独的变换函数供测试使用
export { rotate90, rotate180, rotate270, mirrorH };

/**
 * 预计算所有对称变换后的元组模式
 * 
 * @param pattern 原始元组模式
 * @returns 8种对称变换后的元组模式数组
 */
export function precomputeSymmetricPatterns(pattern: TuplePattern): TuplePattern[] {
  return SYMMETRY_TRANSFORMS.map(transform => 
    pattern.map(pos => transform(pos))
  );
}

// ============================================
// N-Tuple Network 类
// ============================================

/**
 * N-Tuple Network类
 * 实现基于查找表的棋盘评估
 */
export class NTupleNetwork {
  /** 元组模式配置 */
  private patterns: TuplePattern[];
  
  /** 预计算的对称变换后的模式（每个原始模式对应8个变换后的模式） */
  private symmetricPatterns: TuplePattern[][];
  
  /** 权重查找表（每个元组一个Float32Array） */
  private weights: Float32Array[];
  
  /** 每个元组的LUT大小 */
  private lutSizes: number[];
  
  /**
   * 构造函数
   * @param config 网络配置
   */
  constructor(config: NTupleConfig) {
    this.patterns = config.patterns;
    this.lutSizes = config.patterns.map(p => calculateLutSize(p.length));
    
    // 初始化权重为零
    this.weights = this.lutSizes.map(size => new Float32Array(size));
    
    // 预计算对称变换后的模式
    this.symmetricPatterns = this.patterns.map(pattern => 
      precomputeSymmetricPatterns(pattern)
    );
  }
  
  /**
   * 评估棋盘状态
   * 计算所有元组在所有对称变换下的评估值之和
   * 
   * @param board 4x4棋盘矩阵
   * @returns 评估分数
   */
  evaluate(board: number[][]): number {
    let totalScore = 0;
    
    // 遍历每个元组模式
    for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
      const symmetricPatternsForTuple = this.symmetricPatterns[patternIdx];
      const weightsForTuple = this.weights[patternIdx];
      
      // 遍历8种对称变换
      for (const transformedPattern of symmetricPatternsForTuple) {
        // 提取元组值并计算索引
        const tupleValues = extractTupleValues(board, transformedPattern);
        const index = tupleToIndex(tupleValues);
        
        // 累加权重值
        totalScore += weightsForTuple[index];
      }
    }
    
    return totalScore;
  }
  
  /**
   * 加载权重
   * @param weightsData 权重数据（每个元组一个数组）
   * @throws WeightLoadError 如果权重维度不匹配
   */
  loadWeights(weightsData: number[][]): void {
    if (weightsData.length !== this.patterns.length) {
      throw new WeightLoadError(
        `Weight array count mismatch: expected ${this.patterns.length}, got ${weightsData.length}`
      );
    }
    
    for (let i = 0; i < weightsData.length; i++) {
      const expectedSize = this.lutSizes[i];
      const actualSize = weightsData[i].length;
      
      if (actualSize !== expectedSize) {
        throw new WeightLoadError(
          `Weight dimension mismatch for tuple ${i}`,
          { expectedSize, actualSize, tupleIndex: i }
        );
      }
      
      this.weights[i] = new Float32Array(weightsData[i]);
    }
  }
  
  /**
   * 导出权重
   * @returns 权重数据（每个元组一个数组）
   */
  exportWeights(): number[][] {
    return this.weights.map(w => Array.from(w));
  }
  
  /**
   * 获取元组模式
   */
  getPatterns(): TuplePattern[] {
    return this.patterns;
  }
  
  /**
   * 获取LUT大小
   */
  getLutSizes(): number[] {
    return this.lutSizes;
  }
  
  /**
   * 更新权重（用于TD Learning）
   * 
   * 遍历所有元组模式和8种对称变换，更新对应索引的权重值。
   * 每个元组的每个对称变换都会独立更新其对应的权重索引。
   * 
   * @param board 棋盘状态（afterstate）
   * @param delta TD误差乘以学习率（α × δ）
   */
  updateWeights(board: number[][], delta: number): void {
    // 遍历每个元组模式
    for (let patternIdx = 0; patternIdx < this.patterns.length; patternIdx++) {
      const symmetricPatternsForTuple = this.symmetricPatterns[patternIdx];
      const weightsForTuple = this.weights[patternIdx];
      
      // 遍历8种对称变换
      for (const transformedPattern of symmetricPatternsForTuple) {
        // 提取元组值并计算索引
        const tupleValues = extractTupleValues(board, transformedPattern);
        const index = tupleToIndex(tupleValues);
        
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
}

// ============================================
// 错误类
// ============================================

/**
 * 权重加载错误
 */
export class WeightLoadError extends Error {
  constructor(
    message: string,
    public details?: {
      expectedSize?: number;
      actualSize?: number;
      tupleIndex?: number;
    }
  ) {
    super(message);
    this.name = 'WeightLoadError';
  }
}
