/**
 * GPU Weight Serialization and Checkpoint Management
 * 
 * 实现GPU和CPU之间的权重传输，以及训练检查点的保存和恢复。
 * 
 * Requirements: 5.1, 5.2, 8.3
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { GPUNTupleNetwork } from './gpu-network';
import { NTupleNetwork, WeightsConfig } from '../network';
import { Pattern } from '../patterns';
import { TrainingStats, TrainingConfig } from '../trainer';

// ============================================
// 类型定义
// ============================================

/**
 * GPU权重传输结果
 */
export interface WeightTransferResult {
  /** 是否成功 */
  success: boolean;
  /** 传输的权重数量 */
  weightCount: number;
  /** 传输耗时（毫秒） */
  transferTime: number;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * GPU训练检查点数据
 * 扩展现有检查点格式以支持GPU状态
 */
export interface GPUCheckpointData {
  /** 检查点版本 */
  version: number;
  
  /** 检查点类型标识 */
  type: 'gpu';
  
  /** 训练配置 */
  config: GPUTrainingCheckpointConfig;
  
  /** 当前轮数 */
  episode: number;
  
  /** 当前学习率 */
  currentLearningRate: number;
  
  /** 训练统计 */
  stats: TrainingStats;
  
  /** 里程碑计数 */
  milestoneCount: { tile2048: number; tile4096: number; tile8192: number };
  
  /** 最近得分记录 */
  recentScores: number[];
  
  /** 权重数据（从GPU导出） */
  weights: WeightsConfig;
  
  /** GPU特定状态 */
  gpuState: GPUStateSnapshot;
  
  /** 保存时间戳 */
  timestamp: number;
}

/**
 * GPU训练配置（检查点用）
 */
export interface GPUTrainingCheckpointConfig extends TrainingConfig {
  /** GPU配置 */
  gpu: {
    enabled: boolean;
    batchSize: number;
    deviceIndex?: number;
  };
  /** 梯度累积步数 */
  gradientAccumulationSteps: number;
  /** 验证间隔 */
  validationInterval: number;
}

/**
 * GPU状态快照
 */
export interface GPUStateSnapshot {
  /** 批量大小 */
  batchSize: number;
  
  /** 梯度累积计数 */
  gradientAccumulationCount: number;
  
  /** 累积的梯度数据（可选，用于精确恢复） */
  accumulatedGradients?: number[];
  
  /** 权重统计信息 */
  weightStats: {
    min: number;
    max: number;
    mean: number;
    nonZeroCount: number;
  };
}

// ============================================
// 权重传输管理器
// ============================================

/**
 * GPU-CPU权重传输管理器
 * 
 * 负责在GPU和CPU之间高效传输权重数据。
 * 支持同步和异步传输模式。
 * 
 * Requirements: 5.1, 5.2
 */
export class WeightTransferManager {
  /** GPU网络 */
  private gpuNetwork: GPUNTupleNetwork;
  
  /** 元组模式 */
  private patterns: Pattern[];
  
  /**
   * 构造函数
   * 
   * @param gpuNetwork GPU N-Tuple网络
   */
  constructor(gpuNetwork: GPUNTupleNetwork) {
    this.gpuNetwork = gpuNetwork;
    this.patterns = gpuNetwork.getPatterns();
  }
  
  /**
   * 从GPU导出权重到CPU
   * 
   * 将GPU内存中的权重数据传输到CPU内存。
   * 使用Float64Array以保持最高精度。
   * 
   * @returns 权重传输结果和权重数据
   * 
   * Requirements: 5.1
   */
  exportToCPU(): { result: WeightTransferResult; weights: Float64Array[] } {
    const startTime = Date.now();
    
    try {
      const weights = this.gpuNetwork.exportWeightsToCPU();
      const weightCount = weights.reduce((sum, w) => sum + w.length, 0);
      
      return {
        result: {
          success: true,
          weightCount,
          transferTime: Date.now() - startTime,
        },
        weights,
      };
    } catch (error) {
      return {
        result: {
          success: false,
          weightCount: 0,
          transferTime: Date.now() - startTime,
          error: (error as Error).message,
        },
        weights: [],
      };
    }
  }
  
  /**
   * 从CPU导入权重到GPU
   * 
   * 将CPU内存中的权重数据传输到GPU内存。
   * 
   * @param weights CPU权重数组
   * @returns 权重传输结果
   * 
   * Requirements: 5.2
   */
  importToGPU(weights: Float64Array[]): WeightTransferResult {
    const startTime = Date.now();
    
    try {
      this.gpuNetwork.loadWeightsToGPU(weights);
      const weightCount = weights.reduce((sum, w) => sum + w.length, 0);
      
      return {
        success: true,
        weightCount,
        transferTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        weightCount: 0,
        transferTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 从NTupleNetwork导入权重到GPU
   * 
   * @param cpuNetwork CPU N-Tuple网络
   * @returns 权重传输结果
   * 
   * Requirements: 5.2
   */
  importFromNetwork(cpuNetwork: NTupleNetwork): WeightTransferResult {
    const startTime = Date.now();
    
    try {
      this.gpuNetwork.loadFromNetwork(cpuNetwork);
      const weights = cpuNetwork.getWeights();
      const weightCount = weights.reduce((sum, w) => sum + w.length, 0);
      
      return {
        success: true,
        weightCount,
        transferTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        weightCount: 0,
        transferTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 导出权重为WeightsConfig格式
   * 
   * 将GPU权重导出为与CPU训练器兼容的格式。
   * 
   * @param metadata 可选的训练元数据
   * @returns WeightsConfig对象
   * 
   * Requirements: 5.1
   */
  exportToWeightsConfig(metadata?: WeightsConfig['metadata']): WeightsConfig {
    const weights = this.gpuNetwork.exportWeightsToCPU();
    
    return {
      version: 1,
      patterns: this.patterns,
      weights: weights.map(w => Array.from(w)),
      metadata,
    };
  }
  
  /**
   * 从WeightsConfig导入权重
   * 
   * @param config 权重配置
   * @returns 权重传输结果
   * 
   * Requirements: 5.2
   */
  importFromWeightsConfig(config: WeightsConfig): WeightTransferResult {
    const startTime = Date.now();
    
    try {
      // 验证模式匹配
      if (config.patterns.length !== this.patterns.length) {
        throw new Error(
          `Pattern count mismatch: expected ${this.patterns.length}, got ${config.patterns.length}`
        );
      }
      
      // 转换为Float64Array
      const weights = config.weights.map(w => new Float64Array(w));
      
      return this.importToGPU(weights);
    } catch (error) {
      return {
        success: false,
        weightCount: 0,
        transferTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 验证权重往返一致性
   * 
   * 导出权重后再导入，验证数据是否完全一致。
   * 用于测试和调试。
   * 
   * @returns 验证结果
   * 
   * Requirements: 5.1, 5.2
   */
  verifyRoundTrip(): { success: boolean; maxDiff: number; error?: string } {
    try {
      // 导出当前权重
      const originalWeights = this.gpuNetwork.exportWeightsToCPU();
      
      // 创建副本
      const weightsCopy = originalWeights.map(w => new Float64Array(w));
      
      // 重新导入
      this.gpuNetwork.loadWeightsToGPU(weightsCopy);
      
      // 再次导出
      const roundTripWeights = this.gpuNetwork.exportWeightsToCPU();
      
      // 比较差异
      let maxDiff = 0;
      for (let i = 0; i < originalWeights.length; i++) {
        for (let j = 0; j < originalWeights[i].length; j++) {
          const diff = Math.abs(originalWeights[i][j] - roundTripWeights[i][j]);
          if (diff > maxDiff) {
            maxDiff = diff;
          }
        }
      }
      
      // 恢复原始权重
      this.gpuNetwork.loadWeightsToGPU(originalWeights);
      
      return {
        success: maxDiff === 0,
        maxDiff,
      };
    } catch (error) {
      return {
        success: false,
        maxDiff: Infinity,
        error: (error as Error).message,
      };
    }
  }
}

// ============================================
// GPU检查点管理器
// ============================================

/**
 * GPU训练检查点管理器
 * 
 * 负责保存和恢复GPU训练状态，支持断点续训。
 * 
 * Requirements: 5.1, 5.2, 8.3
 */
export class GPUCheckpointManager {
  /** 权重传输管理器 */
  private transferManager: WeightTransferManager;
  
  /** GPU网络 */
  private gpuNetwork: GPUNTupleNetwork;
  
  /** 检查点文件路径 */
  private checkpointPath: string;
  
  /**
   * 构造函数
   * 
   * @param gpuNetwork GPU N-Tuple网络
   * @param checkpointPath 检查点文件路径
   */
  constructor(gpuNetwork: GPUNTupleNetwork, checkpointPath: string) {
    this.gpuNetwork = gpuNetwork;
    this.transferManager = new WeightTransferManager(gpuNetwork);
    this.checkpointPath = checkpointPath;
  }
  
  /**
   * 保存GPU训练检查点
   * 
   * 将当前训练状态保存到文件，包括：
   * - 训练配置
   * - 当前轮数和学习率
   * - 训练统计
   * - GPU权重数据
   * - GPU状态快照
   * 
   * @param state 训练状态
   * @returns 是否保存成功
   * 
   * Requirements: 5.1, 8.3
   */
  saveCheckpoint(state: {
    config: GPUTrainingCheckpointConfig;
    episode: number;
    currentLearningRate: number;
    stats: TrainingStats;
    milestoneCount: { tile2048: number; tile4096: number; tile8192: number };
    recentScores: number[];
  }): boolean {
    try {
      // 导出权重
      const weightsConfig = this.transferManager.exportToWeightsConfig({
        trainedGames: state.episode,
        avgScore: Math.round(state.stats.avgScore),
        maxTile: state.stats.maxTile,
        rate2048: state.stats.rate2048,
        rate4096: state.stats.rate4096,
        rate8192: state.stats.rate8192,
        trainingTime: Math.round(state.stats.elapsedTime),
      });
      
      // 获取GPU状态快照
      const gpuState = this.createGPUStateSnapshot();
      
      // 创建检查点数据
      const checkpoint: GPUCheckpointData = {
        version: 1,
        type: 'gpu',
        config: state.config,
        episode: state.episode,
        currentLearningRate: state.currentLearningRate,
        stats: { ...state.stats },
        milestoneCount: { ...state.milestoneCount },
        recentScores: [...state.recentScores],
        weights: weightsConfig,
        gpuState,
        timestamp: Date.now(),
      };
      
      // 同步写入确保数据完整性
      fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint));
      
      return true;
    } catch (error) {
      console.error(`Failed to save GPU checkpoint: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 加载GPU训练检查点
   * 
   * 从文件恢复训练状态，包括GPU权重。
   * 
   * @returns 检查点数据，如果加载失败返回null
   * 
   * Requirements: 5.2, 8.3
   */
  loadCheckpoint(): GPUCheckpointData | null {
    if (!fs.existsSync(this.checkpointPath)) {
      return null;
    }
    
    try {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      const checkpoint: GPUCheckpointData = JSON.parse(data);
      
      // 验证版本和类型
      if (checkpoint.version !== 1) {
        console.warn(`Checkpoint version mismatch: expected 1, got ${checkpoint.version}`);
        return null;
      }
      
      if (checkpoint.type !== 'gpu') {
        console.warn(`Checkpoint type mismatch: expected 'gpu', got ${checkpoint.type}`);
        return null;
      }
      
      // 恢复GPU权重
      const result = this.transferManager.importFromWeightsConfig(checkpoint.weights);
      if (!result.success) {
        console.error(`Failed to restore GPU weights: ${result.error}`);
        return null;
      }
      
      // 恢复梯度累积状态（如果有）
      if (checkpoint.gpuState.accumulatedGradients) {
        this.restoreGradients(checkpoint.gpuState.accumulatedGradients);
      }
      
      console.log(`GPU checkpoint loaded from: ${this.checkpointPath}`);
      console.log(`Resuming from episode ${checkpoint.episode + 1}`);
      console.log(`Weight transfer time: ${result.transferTime}ms`);
      
      return checkpoint;
    } catch (error) {
      console.error(`Failed to load GPU checkpoint: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * 检查检查点是否存在
   * 
   * @returns 是否存在检查点文件
   */
  hasCheckpoint(): boolean {
    return fs.existsSync(this.checkpointPath);
  }
  
  /**
   * 删除检查点文件
   * 
   * 训练完成后调用以清理检查点文件。
   * 
   * @returns 是否删除成功
   */
  deleteCheckpoint(): boolean {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        fs.unlinkSync(this.checkpointPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete checkpoint: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 创建GPU状态快照
   * 
   * @returns GPU状态快照
   */
  private createGPUStateSnapshot(): GPUStateSnapshot {
    const weightStats = this.gpuNetwork.getWeightStats();
    const gradientBuffers = this.gpuNetwork.getGradientBuffers();
    
    const snapshot: GPUStateSnapshot = {
      batchSize: this.gpuNetwork.getBatchSize(),
      gradientAccumulationCount: this.gpuNetwork.getGradientAccumulationCount(),
      weightStats,
    };
    
    // 可选：保存累积的梯度（用于精确恢复）
    // 注意：这会增加检查点文件大小
    if (gradientBuffers && gradientBuffers.accumulationCount > 0) {
      snapshot.accumulatedGradients = Array.from(gradientBuffers.gradients);
    }
    
    return snapshot;
  }
  
  /**
   * 恢复梯度累积状态
   * 
   * @param gradients 累积的梯度数据
   */
  private restoreGradients(gradients: number[]): void {
    const gradientBuffers = this.gpuNetwork.getGradientBuffers();
    if (gradientBuffers) {
      for (let i = 0; i < gradients.length && i < gradientBuffers.gradients.length; i++) {
        gradientBuffers.gradients[i] = gradients[i];
      }
    }
  }
  
  /**
   * 获取权重传输管理器
   * 
   * @returns 权重传输管理器
   */
  getTransferManager(): WeightTransferManager {
    return this.transferManager;
  }
  
  /**
   * 更新检查点路径
   * 
   * @param newPath 新的检查点路径
   */
  setCheckpointPath(newPath: string): void {
    this.checkpointPath = newPath;
  }
  
  /**
   * 获取检查点路径
   * 
   * @returns 检查点路径
   */
  getCheckpointPath(): string {
    return this.checkpointPath;
  }
  
  /**
   * 紧急保存检查点
   * 
   * 在发生致命错误时快速保存当前状态。
   * 使用简化的保存流程，优先保证数据安全。
   * 
   * @param state 训练状态
   * @param errorMessage 错误信息
   * @returns 是否保存成功
   * 
   * Requirements: 8.3
   */
  saveEmergencyCheckpoint(
    state: {
      config: GPUTrainingCheckpointConfig;
      episode: number;
      currentLearningRate: number;
      stats: TrainingStats;
      milestoneCount: { tile2048: number; tile4096: number; tile8192: number };
      recentScores: number[];
    },
    errorMessage?: string
  ): boolean {
    try {
      // 使用带时间戳的紧急检查点文件名
      const emergencyPath = this.checkpointPath.replace(
        /\.json$/,
        `.emergency.${Date.now()}.json`
      );
      
      console.log(`Saving emergency checkpoint to: ${emergencyPath}`);
      
      // 导出权重
      const weightsConfig = this.transferManager.exportToWeightsConfig({
        trainedGames: state.episode,
        avgScore: Math.round(state.stats.avgScore),
        maxTile: state.stats.maxTile,
        rate2048: state.stats.rate2048,
        rate4096: state.stats.rate4096,
        rate8192: state.stats.rate8192,
        trainingTime: Math.round(state.stats.elapsedTime),
      });
      
      // 获取GPU状态快照
      const gpuState = this.createGPUStateSnapshot();
      
      // 创建检查点数据（包含错误信息）
      const checkpoint: GPUCheckpointData & { emergencyInfo?: { error: string; savedAt: string } } = {
        version: 1,
        type: 'gpu',
        config: state.config,
        episode: state.episode,
        currentLearningRate: state.currentLearningRate,
        stats: { ...state.stats },
        milestoneCount: { ...state.milestoneCount },
        recentScores: [...state.recentScores],
        weights: weightsConfig,
        gpuState,
        timestamp: Date.now(),
      };
      
      if (errorMessage) {
        checkpoint.emergencyInfo = {
          error: errorMessage,
          savedAt: new Date().toISOString(),
        };
      }
      
      // 同步写入确保数据完整性
      fs.writeFileSync(emergencyPath, JSON.stringify(checkpoint));
      
      console.log(`Emergency checkpoint saved successfully.`);
      return true;
    } catch (error) {
      console.error(`Failed to save emergency checkpoint: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 验证检查点数据完整性
   * 
   * 检查检查点文件是否有效且数据完整。
   * 
   * @param checkpointPath 可选的检查点路径，默认使用配置的路径
   * @returns 验证结果
   */
  validateCheckpoint(checkpointPath?: string): {
    valid: boolean;
    error?: string;
    info?: {
      episode: number;
      timestamp: number;
      weightCount: number;
      batchSize: number;
    };
  } {
    const path = checkpointPath || this.checkpointPath;
    
    if (!fs.existsSync(path)) {
      return { valid: false, error: 'Checkpoint file not found' };
    }
    
    try {
      const data = fs.readFileSync(path, 'utf-8');
      const checkpoint: GPUCheckpointData = JSON.parse(data);
      
      // 验证必要字段
      if (checkpoint.version !== 1) {
        return { valid: false, error: `Invalid version: ${checkpoint.version}` };
      }
      
      if (checkpoint.type !== 'gpu') {
        return { valid: false, error: `Invalid type: ${checkpoint.type}` };
      }
      
      if (!checkpoint.weights || !checkpoint.weights.weights) {
        return { valid: false, error: 'Missing weights data' };
      }
      
      if (!checkpoint.gpuState) {
        return { valid: false, error: 'Missing GPU state' };
      }
      
      // 计算权重数量
      const weightCount = checkpoint.weights.weights.reduce(
        (sum, w) => sum + w.length,
        0
      );
      
      return {
        valid: true,
        info: {
          episode: checkpoint.episode,
          timestamp: checkpoint.timestamp,
          weightCount,
          batchSize: checkpoint.gpuState.batchSize,
        },
      };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }
  
  /**
   * 计算检查点数据的校验和
   * 
   * 用于验证检查点数据在传输或存储过程中是否被损坏。
   * 
   * @param checkpoint 检查点数据
   * @returns 校验和字符串
   */
  static computeChecksum(checkpoint: GPUCheckpointData): string {
    const hash = crypto.createHash('sha256');
    
    // 只对关键数据计算校验和
    const keyData = {
      version: checkpoint.version,
      type: checkpoint.type,
      episode: checkpoint.episode,
      weightsLength: checkpoint.weights.weights.length,
      weightsSample: checkpoint.weights.weights.map(w => w.slice(0, 10)),
    };
    
    hash.update(JSON.stringify(keyData));
    return hash.digest('hex').substring(0, 16);
  }
  
  /**
   * 获取最近的紧急检查点
   * 
   * 查找与当前检查点路径相关的紧急检查点文件。
   * 
   * @returns 紧急检查点路径数组，按时间戳降序排列
   */
  findEmergencyCheckpoints(): string[] {
    const dir = require('path').dirname(this.checkpointPath);
    const baseName = require('path').basename(this.checkpointPath, '.json');
    
    try {
      const files = fs.readdirSync(dir);
      const emergencyFiles = files
        .filter(f => f.startsWith(baseName) && f.includes('.emergency.'))
        .map(f => require('path').join(dir, f))
        .sort((a, b) => {
          // 从文件名中提取时间戳并降序排列
          const tsA = parseInt(a.match(/\.emergency\.(\d+)\.json$/)?.[1] || '0');
          const tsB = parseInt(b.match(/\.emergency\.(\d+)\.json$/)?.[1] || '0');
          return tsB - tsA;
        });
      
      return emergencyFiles;
    } catch {
      return [];
    }
  }
  
  /**
   * 清理旧的紧急检查点
   * 
   * 删除超过指定数量的旧紧急检查点文件。
   * 
   * @param keepCount 保留的紧急检查点数量，默认为3
   * @returns 删除的文件数量
   */
  cleanupEmergencyCheckpoints(keepCount: number = 3): number {
    const emergencyFiles = this.findEmergencyCheckpoints();
    let deletedCount = 0;
    
    // 保留最新的keepCount个文件
    for (let i = keepCount; i < emergencyFiles.length; i++) {
      try {
        fs.unlinkSync(emergencyFiles[i]);
        deletedCount++;
      } catch {
        // 忽略删除失败
      }
    }
    
    return deletedCount;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建权重传输管理器
 * 
 * @param gpuNetwork GPU N-Tuple网络
 * @returns 权重传输管理器
 */
export function createWeightTransferManager(
  gpuNetwork: GPUNTupleNetwork
): WeightTransferManager {
  return new WeightTransferManager(gpuNetwork);
}

/**
 * 创建GPU检查点管理器
 * 
 * @param gpuNetwork GPU N-Tuple网络
 * @param checkpointPath 检查点文件路径
 * @returns GPU检查点管理器
 */
export function createGPUCheckpointManager(
  gpuNetwork: GPUNTupleNetwork,
  checkpointPath: string
): GPUCheckpointManager {
  return new GPUCheckpointManager(gpuNetwork, checkpointPath);
}

// ============================================
// 权重文件I/O工具函数
// ============================================

/**
 * 保存GPU权重到文件
 * 
 * 将GPU网络的权重导出并保存到JSON文件。
 * 
 * @param gpuNetwork GPU N-Tuple网络
 * @param outputPath 输出文件路径
 * @param metadata 可选的训练元数据
 * @returns 是否保存成功
 * 
 * Requirements: 5.1
 */
export function saveGPUWeightsToFile(
  gpuNetwork: GPUNTupleNetwork,
  outputPath: string,
  metadata?: WeightsConfig['metadata']
): boolean {
  try {
    const transferManager = new WeightTransferManager(gpuNetwork);
    const weightsConfig = transferManager.exportToWeightsConfig(metadata);
    
    // 使用流式写入处理大型权重文件
    const stream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
    
    stream.write('{\n');
    stream.write(`  "version": ${weightsConfig.version},\n`);
    stream.write(`  "patterns": ${JSON.stringify(weightsConfig.patterns)},\n`);
    
    if (weightsConfig.metadata) {
      stream.write(`  "metadata": ${JSON.stringify(weightsConfig.metadata)},\n`);
    }
    
    stream.write('  "weights": [\n');
    for (let i = 0; i < weightsConfig.weights.length; i++) {
      stream.write(`    ${JSON.stringify(weightsConfig.weights[i])}`);
      if (i < weightsConfig.weights.length - 1) {
        stream.write(',');
      }
      stream.write('\n');
    }
    stream.write('  ]\n');
    stream.write('}\n');
    
    stream.end();
    
    return true;
  } catch (error) {
    console.error(`Failed to save GPU weights: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 从文件加载权重到GPU
 * 
 * 从JSON文件加载权重并传输到GPU网络。
 * 
 * @param gpuNetwork GPU N-Tuple网络
 * @param inputPath 输入文件路径
 * @returns 权重传输结果
 * 
 * Requirements: 5.2
 */
export function loadGPUWeightsFromFile(
  gpuNetwork: GPUNTupleNetwork,
  inputPath: string
): WeightTransferResult {
  const startTime = Date.now();
  
  try {
    if (!fs.existsSync(inputPath)) {
      return {
        success: false,
        weightCount: 0,
        transferTime: Date.now() - startTime,
        error: `File not found: ${inputPath}`,
      };
    }
    
    const data = fs.readFileSync(inputPath, 'utf-8');
    const config: WeightsConfig = JSON.parse(data);
    
    const transferManager = new WeightTransferManager(gpuNetwork);
    return transferManager.importFromWeightsConfig(config);
  } catch (error) {
    return {
      success: false,
      weightCount: 0,
      transferTime: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}
