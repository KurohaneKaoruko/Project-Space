/**
 * GPU Performance Monitor - GPU性能监控模块
 * 
 * 实现GPU内存使用监控、内核执行时间记录、加速比计算和性能报告。
 * 支持性能降级警告和诊断信息输出。
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { GPUEngine } from './gpu-engine';
import { GPUDeviceInfo } from './types';

// ============================================
// 类型定义
// ============================================

/**
 * 内核执行时间记录
 */
export interface KernelTimingRecord {
  /** 内核名称 */
  name: string;
  /** 执行次数 */
  executionCount: number;
  /** 总执行时间（毫秒） */
  totalTime: number;
  /** 最小执行时间（毫秒） */
  minTime: number;
  /** 最大执行时间（毫秒） */
  maxTime: number;
  /** 平均执行时间（毫秒） */
  avgTime: number;
  /** 最近执行时间（毫秒） */
  lastTime: number;
}

/**
 * GPU内存使用信息
 */
export interface GPUMemoryInfo {
  /** 估计已使用内存（字节） */
  usedMemory: number;
  /** 估计可用内存（字节） */
  availableMemory: number;
  /** 内存使用率（0-1） */
  usageRatio: number;
  /** 是否处于内存压力状态 */
  underPressure: boolean;
  /** 内存使用详情 */
  breakdown: MemoryBreakdown;
}


/**
 * 内存使用详情
 */
export interface MemoryBreakdown {
  /** 权重缓冲区内存（字节） */
  weightsMemory: number;
  /** 梯度缓冲区内存（字节） */
  gradientsMemory: number;
  /** 棋盘状态内存（字节） */
  boardStateMemory: number;
  /** 其他内存（字节） */
  otherMemory: number;
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
  /** 每秒处理的游戏数 */
  episodesPerSecond: number;
  /** 每秒处理的移动数 */
  movesPerSecond: number;
  /** GPU利用率估计（0-1） */
  gpuUtilization: number;
  /** 相比CPU的加速比 */
  speedupRatio: number;
  /** 总训练时间（秒） */
  totalTrainingTime: number;
  /** GPU计算时间占比（0-1） */
  gpuComputeRatio: number;
  /** 数据传输时间占比（0-1） */
  dataTransferRatio: number;
}

/**
 * 性能警告
 */
export interface PerformanceWarning {
  /** 警告类型 */
  type: PerformanceWarningType;
  /** 警告消息 */
  message: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 时间戳 */
  timestamp: number;
  /** 相关数据 */
  data?: Record<string, unknown>;
}

/**
 * 性能警告类型
 */
export enum PerformanceWarningType {
  /** 内存压力 */
  MEMORY_PRESSURE = 'memory_pressure',
  /** 性能下降 */
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  /** GPU利用率低 */
  LOW_GPU_UTILIZATION = 'low_gpu_utilization',
  /** 内核执行慢 */
  SLOW_KERNEL_EXECUTION = 'slow_kernel_execution',
  /** 数据传输瓶颈 */
  DATA_TRANSFER_BOTTLENECK = 'data_transfer_bottleneck',
}


/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  /** 是否启用性能监控 */
  enabled: boolean;
  /** 内存压力阈值（0-1） */
  memoryPressureThreshold: number;
  /** 性能下降阈值（相对于基准的比例） */
  performanceDegradationThreshold: number;
  /** GPU利用率警告阈值（0-1） */
  lowUtilizationThreshold: number;
  /** 内核执行时间警告阈值（毫秒） */
  slowKernelThreshold: number;
  /** CPU基准速度（每秒游戏数） */
  cpuBaselineEpisodesPerSecond: number;
  /** 是否输出详细日志 */
  verbose: boolean;
  /** 警告回调 */
  onWarning?: (warning: PerformanceWarning) => void;
}

/**
 * 默认性能监控配置
 */
export const DEFAULT_PERFORMANCE_MONITOR_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  memoryPressureThreshold: 0.85,
  performanceDegradationThreshold: 0.7,
  lowUtilizationThreshold: 0.3,
  slowKernelThreshold: 100,
  cpuBaselineEpisodesPerSecond: 50,
  verbose: false,
  onWarning: undefined,
};

/**
 * 性能报告
 */
export interface PerformanceReport {
  /** 设备信息 */
  deviceInfo: GPUDeviceInfo | null;
  /** 内存信息 */
  memoryInfo: GPUMemoryInfo;
  /** 性能统计 */
  stats: PerformanceStats;
  /** 内核执行时间 */
  kernelTimings: KernelTimingRecord[];
  /** 活跃警告 */
  activeWarnings: PerformanceWarning[];
  /** 报告生成时间 */
  timestamp: number;
}


// ============================================
// GPU性能监控器类
// ============================================

/**
 * GPU性能监控器
 * 
 * 监控GPU内存使用、内核执行时间和整体性能。
 * 提供性能报告和降级警告。
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */
export class GPUPerformanceMonitor {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** 配置 */
  private config: PerformanceMonitorConfig;
  
  /** 内核执行时间记录 */
  private kernelTimings: Map<string, KernelTimingRecord> = new Map();
  
  /** 性能警告历史 */
  private warnings: PerformanceWarning[] = [];
  
  /** 最大警告历史记录数 */
  private maxWarningHistory: number = 100;
  
  /** 训练开始时间 */
  private trainingStartTime: number = 0;
  
  /** 总处理游戏数 */
  private totalEpisodes: number = 0;
  
  /** 总处理移动数 */
  private totalMoves: number = 0;
  
  /** GPU计算总时间（毫秒） */
  private totalGpuComputeTime: number = 0;
  
  /** 数据传输总时间（毫秒） */
  private totalDataTransferTime: number = 0;
  
  /** 内存使用估计 */
  private memoryEstimate: MemoryBreakdown = {
    weightsMemory: 0,
    gradientsMemory: 0,
    boardStateMemory: 0,
    otherMemory: 0,
  };
  
  /** 上次性能采样时间 */
  private lastSampleTime: number = 0;
  
  /** 上次采样时的游戏数 */
  private lastSampleEpisodes: number = 0;
  
  /** 最近的每秒游戏数 */
  private recentEpisodesPerSecond: number = 0;
  
  /** 性能历史（用于检测降级） */
  private performanceHistory: number[] = [];
  
  /** 最大性能历史记录数 */
  private maxPerformanceHistory: number = 20;


  /**
   * 构造函数
   * 
   * @param engine GPU引擎
   * @param config 性能监控配置
   */
  constructor(
    engine: GPUEngine,
    config: Partial<PerformanceMonitorConfig> = {}
  ) {
    this.engine = engine;
    this.config = { ...DEFAULT_PERFORMANCE_MONITOR_CONFIG, ...config };
  }
  
  /**
   * 开始监控
   * 
   * 初始化监控状态，记录开始时间。
   */
  startMonitoring(): void {
    this.trainingStartTime = Date.now();
    this.lastSampleTime = this.trainingStartTime;
    this.totalEpisodes = 0;
    this.totalMoves = 0;
    this.totalGpuComputeTime = 0;
    this.totalDataTransferTime = 0;
    this.kernelTimings.clear();
    this.warnings = [];
    this.performanceHistory = [];
    
    if (this.config.verbose) {
      console.log('[PerformanceMonitor] Monitoring started');
    }
  }
  
  /**
   * 停止监控
   * 
   * 输出最终性能报告。
   */
  stopMonitoring(): PerformanceReport {
    const report = this.generateReport();
    
    if (this.config.verbose) {
      console.log('[PerformanceMonitor] Monitoring stopped');
      this.printReport(report);
    }
    
    return report;
  }


  /**
   * 记录内核执行时间
   * 
   * @param kernelName 内核名称
   * @param executionTime 执行时间（毫秒）
   * 
   * Requirements: 6.4
   */
  recordKernelExecution(kernelName: string, executionTime: number): void {
    if (!this.config.enabled) return;
    
    let record = this.kernelTimings.get(kernelName);
    
    if (!record) {
      record = {
        name: kernelName,
        executionCount: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        lastTime: 0,
      };
      this.kernelTimings.set(kernelName, record);
    }
    
    record.executionCount++;
    record.totalTime += executionTime;
    record.minTime = Math.min(record.minTime, executionTime);
    record.maxTime = Math.max(record.maxTime, executionTime);
    record.avgTime = record.totalTime / record.executionCount;
    record.lastTime = executionTime;
    
    this.totalGpuComputeTime += executionTime;
    
    // 检查慢内核警告
    if (executionTime > this.config.slowKernelThreshold) {
      this.emitWarning({
        type: PerformanceWarningType.SLOW_KERNEL_EXECUTION,
        message: `Kernel '${kernelName}' execution time (${executionTime.toFixed(2)}ms) exceeds threshold`,
        severity: executionTime > this.config.slowKernelThreshold * 2 ? 'high' : 'medium',
        timestamp: Date.now(),
        data: { kernelName, executionTime, threshold: this.config.slowKernelThreshold },
      });
    }
  }
  
  /**
   * 记录数据传输时间
   * 
   * @param transferTime 传输时间（毫秒）
   */
  recordDataTransfer(transferTime: number): void {
    if (!this.config.enabled) return;
    this.totalDataTransferTime += transferTime;
  }


  /**
   * 记录完成的游戏
   * 
   * @param episodes 完成的游戏数
   * @param moves 总移动数
   * 
   * Requirements: 6.2
   */
  recordEpisodes(episodes: number, moves: number = 0): void {
    if (!this.config.enabled) return;
    
    this.totalEpisodes += episodes;
    this.totalMoves += moves;
    
    // 更新性能采样
    const now = Date.now();
    const timeSinceLastSample = now - this.lastSampleTime;
    
    // 每秒采样一次
    if (timeSinceLastSample >= 1000) {
      const episodesSinceLastSample = this.totalEpisodes - this.lastSampleEpisodes;
      this.recentEpisodesPerSecond = episodesSinceLastSample / (timeSinceLastSample / 1000);
      
      // 记录性能历史
      this.performanceHistory.push(this.recentEpisodesPerSecond);
      if (this.performanceHistory.length > this.maxPerformanceHistory) {
        this.performanceHistory.shift();
      }
      
      // 检查性能降级
      this.checkPerformanceDegradation();
      
      this.lastSampleTime = now;
      this.lastSampleEpisodes = this.totalEpisodes;
    }
  }
  
  /**
   * 更新内存使用估计
   * 
   * @param breakdown 内存使用详情
   * 
   * Requirements: 6.1
   */
  updateMemoryEstimate(breakdown: Partial<MemoryBreakdown>): void {
    if (!this.config.enabled) return;
    
    this.memoryEstimate = {
      ...this.memoryEstimate,
      ...breakdown,
    };
    
    // 检查内存压力
    const memoryInfo = this.getMemoryInfo();
    if (memoryInfo.underPressure) {
      this.emitWarning({
        type: PerformanceWarningType.MEMORY_PRESSURE,
        message: `GPU memory usage (${(memoryInfo.usageRatio * 100).toFixed(1)}%) exceeds threshold`,
        severity: memoryInfo.usageRatio > 0.95 ? 'high' : 'medium',
        timestamp: Date.now(),
        data: { usageRatio: memoryInfo.usageRatio, usedMemory: memoryInfo.usedMemory },
      });
    }
  }


  /**
   * 获取GPU内存使用信息
   * 
   * @returns GPU内存信息
   * 
   * Requirements: 6.1
   */
  getMemoryInfo(): GPUMemoryInfo {
    const deviceInfo = this.engine.getDeviceInfo();
    
    // 计算总使用内存
    const usedMemory = 
      this.memoryEstimate.weightsMemory +
      this.memoryEstimate.gradientsMemory +
      this.memoryEstimate.boardStateMemory +
      this.memoryEstimate.otherMemory;
    
    // 获取可用内存（如果设备信息不可用，使用保守估计）
    const availableMemory = deviceInfo?.availableMemory || 512 * 1024 * 1024; // 512MB default
    
    const usageRatio = usedMemory / availableMemory;
    const underPressure = usageRatio > this.config.memoryPressureThreshold;
    
    return {
      usedMemory,
      availableMemory,
      usageRatio,
      underPressure,
      breakdown: { ...this.memoryEstimate },
    };
  }
  
  /**
   * 获取性能统计
   * 
   * @returns 性能统计信息
   * 
   * Requirements: 6.2, 6.4
   */
  getPerformanceStats(): PerformanceStats {
    const now = Date.now();
    const totalTrainingTime = (now - this.trainingStartTime) / 1000;
    
    const episodesPerSecond = totalTrainingTime > 0 
      ? this.totalEpisodes / totalTrainingTime 
      : 0;
    
    const movesPerSecond = totalTrainingTime > 0 
      ? this.totalMoves / totalTrainingTime 
      : 0;
    
    // 计算加速比
    const speedupRatio = this.calculateSpeedupRatio(episodesPerSecond);
    
    // 计算GPU利用率估计
    const gpuUtilization = this.estimateGpuUtilization();
    
    // 计算时间占比
    const totalTime = this.totalGpuComputeTime + this.totalDataTransferTime;
    const gpuComputeRatio = totalTime > 0 ? this.totalGpuComputeTime / totalTime : 0;
    const dataTransferRatio = totalTime > 0 ? this.totalDataTransferTime / totalTime : 0;
    
    return {
      episodesPerSecond,
      movesPerSecond,
      gpuUtilization,
      speedupRatio,
      totalTrainingTime,
      gpuComputeRatio,
      dataTransferRatio,
    };
  }


  /**
   * 计算加速比
   * 
   * @param currentEpisodesPerSecond 当前每秒游戏数
   * @returns 相比CPU的加速比
   * 
   * Requirements: 6.2
   */
  private calculateSpeedupRatio(currentEpisodesPerSecond: number): number {
    if (this.config.cpuBaselineEpisodesPerSecond <= 0) {
      return 1;
    }
    return currentEpisodesPerSecond / this.config.cpuBaselineEpisodesPerSecond;
  }
  
  /**
   * 估计GPU利用率
   * 
   * 基于内核执行时间和总时间估算GPU利用率。
   * 
   * @returns GPU利用率（0-1）
   */
  private estimateGpuUtilization(): number {
    const now = Date.now();
    const totalTime = now - this.trainingStartTime;
    
    if (totalTime <= 0) return 0;
    
    // GPU利用率 = GPU计算时间 / 总时间
    const utilization = this.totalGpuComputeTime / totalTime;
    
    // 限制在0-1范围内
    return Math.min(1, Math.max(0, utilization));
  }
  
  /**
   * 检查性能降级
   * 
   * 比较最近性能与历史性能，检测是否有显著下降。
   * 
   * Requirements: 6.5
   */
  private checkPerformanceDegradation(): void {
    if (this.performanceHistory.length < 5) return;
    
    // 计算历史平均性能
    const historicalAvg = this.performanceHistory
      .slice(0, -3)
      .reduce((a, b) => a + b, 0) / (this.performanceHistory.length - 3);
    
    // 计算最近平均性能
    const recentAvg = this.performanceHistory
      .slice(-3)
      .reduce((a, b) => a + b, 0) / 3;
    
    // 检查是否有显著下降
    if (historicalAvg > 0 && recentAvg / historicalAvg < this.config.performanceDegradationThreshold) {
      this.emitWarning({
        type: PerformanceWarningType.PERFORMANCE_DEGRADATION,
        message: `Performance degraded: ${recentAvg.toFixed(1)} ep/s (was ${historicalAvg.toFixed(1)} ep/s)`,
        severity: recentAvg / historicalAvg < 0.5 ? 'high' : 'medium',
        timestamp: Date.now(),
        data: { recentAvg, historicalAvg, ratio: recentAvg / historicalAvg },
      });
    }
    
    // 检查GPU利用率
    const utilization = this.estimateGpuUtilization();
    if (utilization < this.config.lowUtilizationThreshold && this.totalEpisodes > 100) {
      this.emitWarning({
        type: PerformanceWarningType.LOW_GPU_UTILIZATION,
        message: `Low GPU utilization: ${(utilization * 100).toFixed(1)}%`,
        severity: utilization < 0.1 ? 'high' : 'low',
        timestamp: Date.now(),
        data: { utilization },
      });
    }
  }


  /**
   * 发出性能警告
   * 
   * @param warning 警告信息
   * 
   * Requirements: 6.5
   */
  private emitWarning(warning: PerformanceWarning): void {
    // 添加到历史记录
    this.warnings.push(warning);
    
    // 限制历史记录大小
    if (this.warnings.length > this.maxWarningHistory) {
      this.warnings.shift();
    }
    
    // 调用回调
    if (this.config.onWarning) {
      this.config.onWarning(warning);
    }
    
    // 输出日志
    if (this.config.verbose) {
      const severityIcon = warning.severity === 'high' ? '🔴' : 
                          warning.severity === 'medium' ? '🟡' : '🟢';
      console.warn(`[PerformanceMonitor] ${severityIcon} ${warning.message}`);
    }
  }
  
  /**
   * 获取内核执行时间记录
   * 
   * @returns 所有内核的执行时间记录
   * 
   * Requirements: 6.4
   */
  getKernelTimings(): KernelTimingRecord[] {
    return Array.from(this.kernelTimings.values());
  }
  
  /**
   * 获取特定内核的执行时间记录
   * 
   * @param kernelName 内核名称
   * @returns 内核执行时间记录，如果不存在返回null
   */
  getKernelTiming(kernelName: string): KernelTimingRecord | null {
    return this.kernelTimings.get(kernelName) || null;
  }
  
  /**
   * 获取活跃警告
   * 
   * 返回最近5分钟内的警告。
   * 
   * @returns 活跃警告列表
   */
  getActiveWarnings(): PerformanceWarning[] {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.warnings.filter(w => w.timestamp > fiveMinutesAgo);
  }
  
  /**
   * 获取所有警告历史
   * 
   * @param limit 限制返回数量
   * @returns 警告历史
   */
  getWarningHistory(limit?: number): PerformanceWarning[] {
    if (limit) {
      return this.warnings.slice(-limit);
    }
    return [...this.warnings];
  }


  /**
   * 生成性能报告
   * 
   * @returns 完整的性能报告
   * 
   * Requirements: 6.4
   */
  generateReport(): PerformanceReport {
    return {
      deviceInfo: this.engine.getDeviceInfo(),
      memoryInfo: this.getMemoryInfo(),
      stats: this.getPerformanceStats(),
      kernelTimings: this.getKernelTimings(),
      activeWarnings: this.getActiveWarnings(),
      timestamp: Date.now(),
    };
  }
  
  /**
   * 打印性能报告
   * 
   * @param report 性能报告（可选，不提供则生成新报告）
   * 
   * Requirements: 6.4
   */
  printReport(report?: PerformanceReport): void {
    const r = report || this.generateReport();
    
    console.log('');
    console.log('='.repeat(60));
    console.log('GPU Performance Report');
    console.log('='.repeat(60));
    
    // 设备信息
    if (r.deviceInfo) {
      console.log(`Device: ${r.deviceInfo.name}`);
      console.log(`Mode: ${r.deviceInfo.isGPU ? 'GPU' : 'CPU'}`);
      console.log(`Backend: ${r.deviceInfo.backend}`);
    }
    
    console.log('');
    console.log('Performance Statistics:');
    console.log(`  Episodes/sec: ${r.stats.episodesPerSecond.toFixed(1)}`);
    console.log(`  Moves/sec: ${r.stats.movesPerSecond.toFixed(0)}`);
    console.log(`  Speedup ratio: ${r.stats.speedupRatio.toFixed(2)}x`);
    console.log(`  GPU utilization: ${(r.stats.gpuUtilization * 100).toFixed(1)}%`);
    console.log(`  Training time: ${this.formatTime(r.stats.totalTrainingTime)}`);
    
    console.log('');
    console.log('Memory Usage:');
    console.log(`  Used: ${this.formatBytes(r.memoryInfo.usedMemory)}`);
    console.log(`  Available: ${this.formatBytes(r.memoryInfo.availableMemory)}`);
    console.log(`  Usage: ${(r.memoryInfo.usageRatio * 100).toFixed(1)}%`);
    if (r.memoryInfo.underPressure) {
      console.log(`  ⚠️  Memory pressure detected!`);
    }
    
    // 内核执行时间
    if (r.kernelTimings.length > 0) {
      console.log('');
      console.log('Kernel Execution Times:');
      for (const timing of r.kernelTimings.sort((a, b) => b.totalTime - a.totalTime)) {
        console.log(`  ${timing.name}:`);
        console.log(`    Calls: ${timing.executionCount}, Avg: ${timing.avgTime.toFixed(2)}ms, Total: ${timing.totalTime.toFixed(0)}ms`);
      }
    }
    
    // 活跃警告
    if (r.activeWarnings.length > 0) {
      console.log('');
      console.log('Active Warnings:');
      for (const warning of r.activeWarnings) {
        const icon = warning.severity === 'high' ? '🔴' : 
                    warning.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${warning.message}`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('');
  }


  /**
   * 打印简短的进度报告（包含GPU信息）
   * 
   * @param episode 当前轮数
   * @param totalEpisodes 总轮数
   * @param additionalInfo 额外信息
   * 
   * Requirements: 6.4
   */
  printProgressReport(
    episode: number,
    totalEpisodes: number,
    additionalInfo?: {
      score?: number;
      rate2048?: number;
      learningRate?: number;
    }
  ): void {
    const stats = this.getPerformanceStats();
    const memoryInfo = this.getMemoryInfo();
    
    const progress = (episode / totalEpisodes * 100).toFixed(1);
    const eta = stats.episodesPerSecond > 0 
      ? (totalEpisodes - episode) / stats.episodesPerSecond 
      : 0;
    
    // 构建进度条
    const barWidth = 20;
    const filled = Math.round(episode / totalEpisodes * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    
    // 构建状态行
    let line = `[${bar}] ${progress.padStart(5)}% | `;
    line += `Ep: ${episode.toString().padStart(6)}/${totalEpisodes} | `;
    
    if (additionalInfo?.score !== undefined) {
      line += `Score: ${additionalInfo.score.toFixed(0).padStart(6)} | `;
    }
    
    if (additionalInfo?.rate2048 !== undefined) {
      line += `2048: ${(additionalInfo.rate2048 * 100).toFixed(1).padStart(5)}% | `;
    }
    
    line += `Speed: ${stats.episodesPerSecond.toFixed(0).padStart(4)} ep/s | `;
    line += `ETA: ${this.formatTime(eta).padStart(8)}`;
    
    process.stdout.write('\r' + line);
    
    // 每1000轮输出详细GPU信息
    if (episode % 1000 === 0 || episode === totalEpisodes) {
      console.log('');
      let detailLine = `  GPU: ${(stats.gpuUtilization * 100).toFixed(0)}% util | `;
      detailLine += `Mem: ${(memoryInfo.usageRatio * 100).toFixed(0)}% | `;
      detailLine += `Speedup: ~${stats.speedupRatio.toFixed(1)}x`;
      
      if (additionalInfo?.learningRate !== undefined) {
        detailLine += ` | LR: ${additionalInfo.learningRate.toExponential(2)}`;
      }
      
      // 显示警告数量
      const activeWarnings = this.getActiveWarnings();
      if (activeWarnings.length > 0) {
        const highCount = activeWarnings.filter(w => w.severity === 'high').length;
        if (highCount > 0) {
          detailLine += ` | ⚠️ ${highCount} warnings`;
        }
      }
      
      console.log(detailLine);
    }
  }


  /**
   * 格式化时间
   * 
   * @param seconds 秒数
   * @returns 格式化的时间字符串
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
  }
  
  /**
   * 格式化字节数
   * 
   * @param bytes 字节数
   * @returns 格式化的字节字符串
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
  
  /**
   * 重置监控状态
   */
  reset(): void {
    this.trainingStartTime = Date.now();
    this.lastSampleTime = this.trainingStartTime;
    this.totalEpisodes = 0;
    this.totalMoves = 0;
    this.totalGpuComputeTime = 0;
    this.totalDataTransferTime = 0;
    this.lastSampleEpisodes = 0;
    this.recentEpisodesPerSecond = 0;
    this.kernelTimings.clear();
    this.warnings = [];
    this.performanceHistory = [];
    this.memoryEstimate = {
      weightsMemory: 0,
      gradientsMemory: 0,
      boardStateMemory: 0,
      otherMemory: 0,
    };
  }
  
  /**
   * 更新配置
   * 
   * @param config 新配置
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取配置
   */
  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }
  
  /**
   * 设置CPU基准速度
   * 
   * @param episodesPerSecond CPU每秒游戏数
   */
  setCpuBaseline(episodesPerSecond: number): void {
    this.config.cpuBaselineEpisodesPerSecond = episodesPerSecond;
  }
  
  /**
   * 获取最近的每秒游戏数
   */
  getRecentEpisodesPerSecond(): number {
    return this.recentEpisodesPerSecond;
  }
  
  /**
   * 获取总处理游戏数
   */
  getTotalEpisodes(): number {
    return this.totalEpisodes;
  }
  
  /**
   * 获取总处理移动数
   */
  getTotalMoves(): number {
    return this.totalMoves;
  }
}


// ============================================
// 内核执行计时器
// ============================================

/**
 * 内核执行计时器
 * 
 * 用于测量内核执行时间的辅助类。
 */
export class KernelTimer {
  /** 性能监控器 */
  private monitor: GPUPerformanceMonitor;
  
  /** 内核名称 */
  private kernelName: string;
  
  /** 开始时间 */
  private startTime: number = 0;
  
  /**
   * 构造函数
   * 
   * @param monitor 性能监控器
   * @param kernelName 内核名称
   */
  constructor(monitor: GPUPerformanceMonitor, kernelName: string) {
    this.monitor = monitor;
    this.kernelName = kernelName;
  }
  
  /**
   * 开始计时
   */
  start(): void {
    this.startTime = performance.now();
  }
  
  /**
   * 停止计时并记录
   * 
   * @returns 执行时间（毫秒）
   */
  stop(): number {
    const executionTime = performance.now() - this.startTime;
    this.monitor.recordKernelExecution(this.kernelName, executionTime);
    return executionTime;
  }
}

/**
 * 数据传输计时器
 * 
 * 用于测量数据传输时间的辅助类。
 */
export class DataTransferTimer {
  /** 性能监控器 */
  private monitor: GPUPerformanceMonitor;
  
  /** 开始时间 */
  private startTime: number = 0;
  
  /**
   * 构造函数
   * 
   * @param monitor 性能监控器
   */
  constructor(monitor: GPUPerformanceMonitor) {
    this.monitor = monitor;
  }
  
  /**
   * 开始计时
   */
  start(): void {
    this.startTime = performance.now();
  }
  
  /**
   * 停止计时并记录
   * 
   * @returns 传输时间（毫秒）
   */
  stop(): number {
    const transferTime = performance.now() - this.startTime;
    this.monitor.recordDataTransfer(transferTime);
    return transferTime;
  }
}


// ============================================
// 工厂函数
// ============================================

/**
 * 创建GPU性能监控器
 * 
 * @param engine GPU引擎
 * @param config 配置
 * @returns GPU性能监控器
 */
export function createGPUPerformanceMonitor(
  engine: GPUEngine,
  config?: Partial<PerformanceMonitorConfig>
): GPUPerformanceMonitor {
  return new GPUPerformanceMonitor(engine, config);
}

/**
 * 创建内核计时器
 * 
 * @param monitor 性能监控器
 * @param kernelName 内核名称
 * @returns 内核计时器
 */
export function createKernelTimer(
  monitor: GPUPerformanceMonitor,
  kernelName: string
): KernelTimer {
  return new KernelTimer(monitor, kernelName);
}

/**
 * 创建数据传输计时器
 * 
 * @param monitor 性能监控器
 * @returns 数据传输计时器
 */
export function createDataTransferTimer(
  monitor: GPUPerformanceMonitor
): DataTransferTimer {
  return new DataTransferTimer(monitor);
}

/**
 * 使用计时器包装函数执行
 * 
 * @param monitor 性能监控器
 * @param kernelName 内核名称
 * @param fn 要执行的函数
 * @returns 函数执行结果
 */
export function withKernelTiming<T>(
  monitor: GPUPerformanceMonitor,
  kernelName: string,
  fn: () => T
): T {
  const timer = new KernelTimer(monitor, kernelName);
  timer.start();
  try {
    return fn();
  } finally {
    timer.stop();
  }
}

/**
 * 使用计时器包装异步函数执行
 * 
 * @param monitor 性能监控器
 * @param kernelName 内核名称
 * @param fn 要执行的异步函数
 * @returns 函数执行结果
 */
export async function withKernelTimingAsync<T>(
  monitor: GPUPerformanceMonitor,
  kernelName: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new KernelTimer(monitor, kernelName);
  timer.start();
  try {
    return await fn();
  } finally {
    timer.stop();
  }
}
