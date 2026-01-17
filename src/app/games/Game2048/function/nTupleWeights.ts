/**
 * N-Tuple Network Weight Management
 * 
 * 管理N-Tuple Network的权重配置，包括：
 * - 权重配置格式定义
 * - 默认元组模式
 * - 权重加载和验证
 * - 权重序列化和反序列化
 * - 从文件路径异步加载训练权重
 */

import { TuplePattern, NTupleNetwork, WeightLoadError, calculateLutSize } from './nTupleEngine';

// ============================================
// 类型定义
// ============================================

/**
 * 权重配置文件格式
 */
export interface WeightsConfig {
  /** 版本号 */
  version: number;
  
  /** 元组模式定义 */
  patterns: TuplePattern[];
  
  /** 权重数据 (每个元组一个数组) */
  weights: number[][];
  
  /** 元数据 */
  metadata?: {
    trainedGames?: number;
    avgScore?: number;
    maxTile?: number;
  };
}

/**
 * 权重加载选项
 */
export interface WeightLoadOptions {
  /** 是否验证权重维度 */
  validateDimensions?: boolean;
  /** 是否允许部分加载（缺失的权重使用零值） */
  allowPartial?: boolean;
}

/**
 * 权重加载状态
 */
export type WeightsLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

// ============================================
// 默认元组模式
// ============================================

/**
 * 标准4-tuple水平线模式
 */
const HORIZONTAL_4TUPLE: TuplePattern[] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
];

/**
 * 标准4-tuple垂直线模式
 */
const VERTICAL_4TUPLE: TuplePattern[] = [
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
];

/**
 * 标准6-tuple 2x3矩形模式
 */
const RECTANGLE_6TUPLE: TuplePattern[] = [
  [0, 1, 2, 4, 5, 6],
  [1, 2, 3, 5, 6, 7],
  [4, 5, 6, 8, 9, 10],
  [5, 6, 7, 9, 10, 11],
  [8, 9, 10, 12, 13, 14],
  [9, 10, 11, 13, 14, 15],
];

/**
 * 标准6-tuple角落L形模式
 */
const CORNER_6TUPLE: TuplePattern[] = [
  [0, 1, 4, 5, 8, 9],
  [2, 3, 6, 7, 10, 11],
  [4, 5, 8, 9, 12, 13],
  [6, 7, 10, 11, 14, 15],
];

/**
 * 默认元组模式配置
 * 使用4-tuple行列模式，大幅减少权重文件大小（从512MB降至约2MB）
 * 包含4条水平线和4条垂直线，覆盖棋盘所有行列
 */
export const DEFAULT_PATTERNS: TuplePattern[] = [
  ...HORIZONTAL_4TUPLE,
  ...VERTICAL_4TUPLE,
];

/**
 * 简化的4-tuple模式（仅水平和垂直线）
 */
export const SIMPLE_4TUPLE_PATTERNS: TuplePattern[] = [
  ...HORIZONTAL_4TUPLE,
  ...VERTICAL_4TUPLE,
];

/**
 * 完整的6-tuple模式
 */
export const FULL_6TUPLE_PATTERNS: TuplePattern[] = [
  ...RECTANGLE_6TUPLE,
  ...CORNER_6TUPLE,
];

// ============================================
// 权重管理类
// ============================================

/**
 * 权重管理器
 */
export class WeightManager {
  /**
   * 验证权重配置的有效性
   */
  static validateConfig(config: WeightsConfig): void {
    if (typeof config.version !== 'number' || config.version < 1) {
      throw new WeightLoadError('Invalid config version');
    }
    
    if (!Array.isArray(config.patterns) || config.patterns.length === 0) {
      throw new WeightLoadError('Patterns array is empty or invalid');
    }
    
    if (!Array.isArray(config.weights)) {
      throw new WeightLoadError('Weights array is invalid');
    }
    
    if (config.patterns.length !== config.weights.length) {
      throw new WeightLoadError(
        `Pattern count (${config.patterns.length}) does not match weight count (${config.weights.length})`
      );
    }
    
    for (let i = 0; i < config.patterns.length; i++) {
      const pattern = config.patterns[i];
      const weights = config.weights[i];
      const expectedSize = calculateLutSize(pattern.length);
      
      if (weights.length !== expectedSize) {
        throw new WeightLoadError(
          `Weight dimension mismatch for tuple ${i}`,
          {
            expectedSize,
            actualSize: weights.length,
            tupleIndex: i,
          }
        );
      }
    }
  }

  /**
   * 从JSON字符串加载权重配置
   */
  static loadFromJson(jsonString: string, options: WeightLoadOptions = {}): WeightsConfig {
    const { validateDimensions = true } = options;
    
    let config: WeightsConfig;
    
    try {
      config = JSON.parse(jsonString) as WeightsConfig;
    } catch (error) {
      throw new WeightLoadError(`Failed to parse JSON: ${(error as Error).message}`);
    }
    
    if (validateDimensions) {
      WeightManager.validateConfig(config);
    }
    
    return config;
  }
  
  /**
   * 将权重配置序列化为JSON字符串
   */
  static toJson(config: WeightsConfig, pretty: boolean = false): string {
    return pretty 
      ? JSON.stringify(config, null, 2)
      : JSON.stringify(config);
  }
  
  /**
   * 从NTupleNetwork实例导出权重配置
   */
  static exportFromNetwork(
    network: NTupleNetwork,
    metadata?: WeightsConfig['metadata']
  ): WeightsConfig {
    return {
      version: 1,
      patterns: network.getPatterns(),
      weights: network.exportWeights(),
      metadata,
    };
  }
  
  /**
   * 将权重配置加载到NTupleNetwork实例
   */
  static loadToNetwork(network: NTupleNetwork, config: WeightsConfig): void {
    const networkPatterns = network.getPatterns();
    
    if (networkPatterns.length !== config.patterns.length) {
      throw new WeightLoadError(
        `Pattern count mismatch: network has ${networkPatterns.length}, config has ${config.patterns.length}`
      );
    }
    
    for (let i = 0; i < networkPatterns.length; i++) {
      if (networkPatterns[i].length !== config.patterns[i].length) {
        throw new WeightLoadError(
          `Pattern size mismatch at index ${i}: network has ${networkPatterns[i].length}, config has ${config.patterns[i].length}`
        );
      }
    }
    
    network.loadWeights(config.weights);
  }
  
  /**
   * 创建空的权重配置（所有权重为零）
   */
  static createEmptyConfig(patterns: TuplePattern[]): WeightsConfig {
    const weights = patterns.map(pattern => {
      const size = calculateLutSize(pattern.length);
      return new Array(size).fill(0);
    });
    
    return {
      version: 1,
      patterns,
      weights,
    };
  }

  /**
   * 检查权重配置是否为有效的训练权重
   */
  static isValidTrainedWeights(config: unknown): config is WeightsConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }
    
    const c = config as Record<string, unknown>;
    
    if (typeof c.version !== 'number' || c.version < 1) {
      return false;
    }
    
    if (!Array.isArray(c.patterns) || c.patterns.length === 0) {
      return false;
    }
    
    if (!Array.isArray(c.weights)) {
      return false;
    }
    
    for (const w of c.weights) {
      if (!Array.isArray(w) || w.length === 0) {
        return false;
      }
      if (typeof w[0] !== 'number') {
        return false;
      }
    }
    
    return true;
  }
}

// ============================================
// 启发式权重生成
// ============================================

/**
 * 计算启发式权重
 */
function calculateHeuristicWeight(index: number, tupleSize: number): number {
  const exponents: number[] = [];
  let remaining = index;
  
  for (let i = 0; i < tupleSize; i++) {
    exponents.unshift(remaining % 16);
    remaining = Math.floor(remaining / 16);
  }
  
  let score = 0;
  
  // 奖励大数值方块
  for (const exp of exponents) {
    if (exp > 0) {
      score += Math.pow(2, exp) * 0.1;
    }
  }
  
  // 奖励单调递增/递减序列
  let monotonic = 0;
  for (let i = 1; i < exponents.length; i++) {
    if (exponents[i] >= exponents[i - 1]) {
      monotonic++;
    }
  }
  if (monotonic === exponents.length - 1) {
    score += 100;
  }
  
  monotonic = 0;
  for (let i = 1; i < exponents.length; i++) {
    if (exponents[i] <= exponents[i - 1]) {
      monotonic++;
    }
  }
  if (monotonic === exponents.length - 1) {
    score += 100;
  }
  
  // 惩罚相邻方块差异过大
  for (let i = 1; i < exponents.length; i++) {
    const diff = Math.abs(exponents[i] - exponents[i - 1]);
    if (diff > 2 && exponents[i] > 0 && exponents[i - 1] > 0) {
      score -= diff * 10;
    }
  }
  
  // 奖励空格
  const emptyCount = exponents.filter(e => e === 0).length;
  score += emptyCount * 50;
  
  return score;
}

/**
 * 创建默认的启发式权重配置
 */
export function createDefaultWeights(): WeightsConfig {
  const patterns = SIMPLE_4TUPLE_PATTERNS;
  
  const weights = patterns.map(pattern => {
    const size = calculateLutSize(pattern.length);
    const weightArray = new Array(size).fill(0);
    
    for (let idx = 0; idx < size; idx++) {
      weightArray[idx] = calculateHeuristicWeight(idx, pattern.length);
    }
    
    return weightArray;
  });
  
  return {
    version: 1,
    patterns,
    weights,
    metadata: {
      trainedGames: 0,
      avgScore: 0,
      maxTile: 0,
    },
  };
}

// ============================================
// 异步权重加载
// ============================================

/** 权重缓存 */
let weightsCache: WeightsConfig | null = null;

/** 加载状态 */
let loadingState: WeightsLoadingState = 'idle';

/** 加载Promise（用于避免重复加载） */
let loadingPromise: Promise<WeightsConfig> | null = null;

/** 权重文件路径 */
const WEIGHTS_FILE_PATH = '/2048data/weights.json';

/**
 * 异步加载权重文件
 * 
 * 从 /data/weights.json 加载训练权重，失败时使用默认启发式权重
 */
export async function loadWeightsAsync(): Promise<WeightsConfig> {
  // 如果已缓存，直接返回
  if (weightsCache) {
    return weightsCache;
  }
  
  // 如果正在加载，返回现有Promise
  if (loadingPromise) {
    return loadingPromise;
  }
  
  loadingState = 'loading';
  
  loadingPromise = (async () => {
    try {
      const response = await fetch(WEIGHTS_FILE_PATH);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const config = await response.json() as WeightsConfig;
      
      // 验证权重
      if (WeightManager.isValidTrainedWeights(config)) {
        WeightManager.validateConfig(config);
        weightsCache = config;
        loadingState = 'loaded';
        console.log('Loaded trained N-Tuple weights from', WEIGHTS_FILE_PATH);
        return config;
      }
      
      throw new Error('Invalid weights format');
    } catch (error) {
      console.warn('Failed to load trained weights:', error);
      console.log('Using heuristic N-Tuple weights');
      
      // 使用默认启发式权重
      weightsCache = createDefaultWeights();
      loadingState = 'loaded';
      return weightsCache;
    } finally {
      loadingPromise = null;
    }
  })();
  
  return loadingPromise;
}

/**
 * 同步获取权重（如果已加载）
 * 
 * @returns 权重配置，如果未加载则返回null
 */
export function getWeightsSync(): WeightsConfig | null {
  return weightsCache;
}

/**
 * 获取权重加载状态
 */
export function getWeightsLoadingState(): WeightsLoadingState {
  return loadingState;
}

/**
 * 获取默认权重（同步，用于兼容旧代码）
 * 
 * 如果已加载训练权重则返回训练权重，否则返回启发式权重
 */
export function getDefaultWeights(): WeightsConfig {
  if (weightsCache) {
    return weightsCache;
  }
  return createDefaultWeights();
}

/**
 * 清除权重缓存（主要用于测试）
 */
export function clearDefaultWeightsCache(): void {
  weightsCache = null;
  loadingState = 'idle';
  loadingPromise = null;
}

/**
 * 设置自定义训练权重
 */
export function setDefaultTrainedWeights(config: WeightsConfig): void {
  WeightManager.validateConfig(config);
  weightsCache = config;
  loadingState = 'loaded';
  console.log('Set custom trained weights as default');
}

// ============================================
// Network 创建函数
// ============================================

/**
 * 异步创建并初始化NTupleNetwork实例
 * 
 * 推荐使用此方法，会异步加载训练权重
 */
export async function createNTupleNetworkAsync(): Promise<NTupleNetwork> {
  const config = await loadWeightsAsync();
  const network = new NTupleNetwork({ patterns: config.patterns });
  network.loadWeights(config.weights);
  return network;
}

/**
 * 同步创建NTupleNetwork实例（使用已缓存或默认权重）
 */
export function createDefaultNTupleNetwork(): NTupleNetwork {
  const config = getDefaultWeights();
  const network = new NTupleNetwork({ patterns: config.patterns });
  network.loadWeights(config.weights);
  return network;
}

/**
 * 从JSON字符串加载权重创建Network
 */
export function loadNetworkWithFallback(jsonString?: string): NTupleNetwork {
  if (jsonString) {
    try {
      const config = WeightManager.loadFromJson(jsonString);
      const network = new NTupleNetwork({ patterns: config.patterns });
      network.loadWeights(config.weights);
      console.log('Loaded custom N-Tuple weights from string');
      return network;
    } catch (error) {
      console.warn('Failed to load custom weights, using defaults:', error);
    }
  }
  
  return createDefaultNTupleNetwork();
}

/**
 * 从权重配置创建NTupleNetwork实例
 */
export function createNetworkFromConfig(config: WeightsConfig): NTupleNetwork {
  WeightManager.validateConfig(config);
  const network = new NTupleNetwork({ patterns: config.patterns });
  network.loadWeights(config.weights);
  return network;
}

/**
 * 从JSON字符串加载训练权重
 */
export function loadTrainedWeightsFromString(jsonString: string): WeightsConfig | null {
  try {
    const config = WeightManager.loadFromJson(jsonString);
    return config;
  } catch (error) {
    console.warn('Failed to load trained weights from string:', error);
    return null;
  }
}

// 重新导出WeightLoadError
export { WeightLoadError } from './nTupleEngine';
