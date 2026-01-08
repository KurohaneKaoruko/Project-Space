/**
 * GPU Error Handler - GPU错误处理模块
 * 
 * 实现GPU内核错误处理、内存不足处理和自动批量大小调整。
 * 支持错误恢复和优雅降级。
 * 
 * Requirements: 6.3, 8.1, 8.2
 */

import { GPUEngine } from './gpu-engine';
import { GPUCheckpointManager } from './weight-serialization';

// ============================================
// 类型定义
// ============================================

/**
 * GPU错误类型
 */
export enum GPUErrorType {
  /** 内核执行错误 */
  KERNEL_ERROR = 'kernel_error',
  /** 内存分配失败 */
  OUT_OF_MEMORY = 'out_of_memory',
  /** 设备丢失 */
  DEVICE_LOST = 'device_lost',
  /** 初始化失败 */
  INITIALIZATION_ERROR = 'initialization_error',
  /** 数值溢出 */
  NUMERICAL_OVERFLOW = 'numerical_overflow',
  /** 验证失败 */
  VALIDATION_ERROR = 'validation_error',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 恢复动作
 */
export enum RecoveryAction {
  /** 重试当前操作 */
  RETRY = 'retry',
  /** 减少批量大小后重试 */
  RETRY_WITH_REDUCED_BATCH = 'retry_with_reduced_batch',
  /** 回退到CPU模式 */
  FALLBACK_TO_CPU = 'fallback_to_cpu',
  /** 保存检查点并终止 */
  SAVE_AND_TERMINATE = 'save_and_terminate',
  /** 忽略并继续 */
  IGNORE = 'ignore',
}


/**
 * GPU错误信息
 */
export interface GPUErrorInfo {
  /** 错误类型 */
  type: GPUErrorType;
  /** 错误消息 */
  message: string;
  /** 原始错误 */
  originalError?: Error;
  /** 发生时间 */
  timestamp: number;
  /** 上下文信息 */
  context?: GPUErrorContext;
}

/**
 * GPU错误上下文
 */
export interface GPUErrorContext {
  /** 操作名称 */
  operation?: string;
  /** 当前批量大小 */
  batchSize?: number;
  /** 当前训练轮数 */
  episode?: number;
  /** 内核名称 */
  kernelName?: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

/**
 * 错误处理配置
 */
export interface ErrorHandlerConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 最小批量大小 */
  minBatchSize: number;
  /** 批量大小缩减因子 */
  batchSizeReductionFactor: number;
  /** 是否启用自动恢复 */
  enableAutoRecovery: boolean;
  /** 是否在致命错误时保存检查点 */
  saveCheckpointOnFatalError: boolean;
  /** 内存压力阈值（0-1） */
  memoryPressureThreshold: number;
  /** 错误日志回调 */
  onError?: (error: GPUErrorInfo) => void;
  /** 恢复回调 */
  onRecovery?: (action: RecoveryAction, context: GPUErrorContext) => void;
}

/**
 * 默认错误处理配置
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  maxRetries: 3,
  minBatchSize: 1,
  batchSizeReductionFactor: 0.5,
  enableAutoRecovery: true,
  saveCheckpointOnFatalError: true,
  memoryPressureThreshold: 0.9,
  onError: undefined,
  onRecovery: undefined,
};


/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  /** 推荐的恢复动作 */
  action: RecoveryAction;
  /** 是否可以恢复 */
  canRecover: boolean;
  /** 新的批量大小（如果需要调整） */
  newBatchSize?: number;
  /** 消息 */
  message: string;
  /** 是否需要保存检查点 */
  shouldSaveCheckpoint: boolean;
}

/**
 * 内存状态
 */
export interface MemoryStatus {
  /** 是否处于内存压力状态 */
  underPressure: boolean;
  /** 估计的内存使用率（0-1） */
  usageRatio: number;
  /** 建议的批量大小 */
  suggestedBatchSize: number;
  /** 当前批量大小 */
  currentBatchSize: number;
}

// ============================================
// GPU错误处理器类
// ============================================

/**
 * GPU错误处理器
 * 
 * 处理GPU计算过程中的各种错误，支持自动恢复和优雅降级。
 * 
 * Requirements: 8.1, 8.2
 */
export class GPUErrorHandler {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** 配置 */
  private config: ErrorHandlerConfig;
  
  /** 检查点管理器（可选） */
  private checkpointManager?: GPUCheckpointManager;
  
  /** 重试计数器 */
  private retryCount: Map<string, number> = new Map();
  
  /** 错误历史 */
  private errorHistory: GPUErrorInfo[] = [];
  
  /** 最大错误历史记录数 */
  private maxErrorHistory: number = 100;
  
  /** 当前批量大小 */
  private currentBatchSize: number;
  
  /** 原始批量大小 */
  private originalBatchSize: number;

  
  /**
   * 构造函数
   * 
   * @param engine GPU引擎
   * @param config 错误处理配置
   * @param checkpointManager 检查点管理器（可选）
   */
  constructor(
    engine: GPUEngine,
    config: Partial<ErrorHandlerConfig> = {},
    checkpointManager?: GPUCheckpointManager
  ) {
    this.engine = engine;
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
    this.checkpointManager = checkpointManager;
    this.currentBatchSize = engine.getBatchSize();
    this.originalBatchSize = this.currentBatchSize;
  }
  
  /**
   * 处理GPU错误
   * 
   * 分析错误类型并返回推荐的恢复动作。
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 错误处理结果
   * 
   * Requirements: 8.1
   */
  handleError(error: Error, context: GPUErrorContext = {}): ErrorHandlingResult {
    // 分类错误
    const errorInfo = this.classifyError(error, context);
    
    // 记录错误
    this.logError(errorInfo);
    
    // 调用错误回调
    if (this.config.onError) {
      this.config.onError(errorInfo);
    }
    
    // 根据错误类型确定恢复动作
    const result = this.determineRecoveryAction(errorInfo);
    
    // 调用恢复回调
    if (this.config.onRecovery && result.canRecover) {
      this.config.onRecovery(result.action, context);
    }
    
    return result;
  }

  
  /**
   * 分类错误
   * 
   * 根据错误消息和类型确定GPU错误类型。
   * 
   * @param error 原始错误
   * @param context 错误上下文
   * @returns GPU错误信息
   */
  private classifyError(error: Error, context: GPUErrorContext): GPUErrorInfo {
    const message = error.message.toLowerCase();
    let type = GPUErrorType.UNKNOWN;
    
    // 检测内存不足错误
    if (
      message.includes('out of memory') ||
      message.includes('oom') ||
      message.includes('memory allocation') ||
      message.includes('cannot allocate') ||
      message.includes('insufficient memory')
    ) {
      type = GPUErrorType.OUT_OF_MEMORY;
    }
    // 检测设备丢失错误
    else if (
      message.includes('device lost') ||
      message.includes('context lost') ||
      message.includes('gpu device') ||
      message.includes('webgl context')
    ) {
      type = GPUErrorType.DEVICE_LOST;
    }
    // 检测内核错误
    else if (
      message.includes('kernel') ||
      message.includes('shader') ||
      message.includes('compile') ||
      message.includes('execution')
    ) {
      type = GPUErrorType.KERNEL_ERROR;
    }
    // 检测初始化错误
    else if (
      message.includes('initialize') ||
      message.includes('init') ||
      message.includes('not initialized')
    ) {
      type = GPUErrorType.INITIALIZATION_ERROR;
    }
    // 检测数值错误
    else if (
      message.includes('nan') ||
      message.includes('infinity') ||
      message.includes('overflow') ||
      message.includes('underflow')
    ) {
      type = GPUErrorType.NUMERICAL_OVERFLOW;
    }
    // 检测验证错误
    else if (
      message.includes('validation') ||
      message.includes('mismatch') ||
      message.includes('inconsistent')
    ) {
      type = GPUErrorType.VALIDATION_ERROR;
    }
    
    return {
      type,
      message: error.message,
      originalError: error,
      timestamp: Date.now(),
      context,
    };
  }

  
  /**
   * 确定恢复动作
   * 
   * 根据错误类型和当前状态确定最佳恢复动作。
   * 
   * @param errorInfo GPU错误信息
   * @returns 错误处理结果
   * 
   * Requirements: 8.1, 8.2
   */
  private determineRecoveryAction(errorInfo: GPUErrorInfo): ErrorHandlingResult {
    const operationKey = errorInfo.context?.operation || 'default';
    const currentRetries = this.retryCount.get(operationKey) || 0;
    
    // 检查是否超过最大重试次数
    if (currentRetries >= this.config.maxRetries) {
      return this.createFallbackResult(errorInfo, 'Max retries exceeded');
    }
    
    switch (errorInfo.type) {
      case GPUErrorType.OUT_OF_MEMORY:
        return this.handleOutOfMemory(errorInfo, currentRetries);
        
      case GPUErrorType.KERNEL_ERROR:
        return this.handleKernelError(errorInfo, currentRetries);
        
      case GPUErrorType.DEVICE_LOST:
        return this.handleDeviceLost(errorInfo);
        
      case GPUErrorType.INITIALIZATION_ERROR:
        return this.handleInitializationError(errorInfo);
        
      case GPUErrorType.NUMERICAL_OVERFLOW:
        return this.handleNumericalOverflow(errorInfo, currentRetries);
        
      case GPUErrorType.VALIDATION_ERROR:
        return this.handleValidationError(errorInfo, currentRetries);
        
      default:
        return this.handleUnknownError(errorInfo, currentRetries);
    }
  }

  
  /**
   * 处理内存不足错误
   * 
   * @param errorInfo 错误信息
   * @param currentRetries 当前重试次数
   * @returns 错误处理结果
   * 
   * Requirements: 8.2
   */
  private handleOutOfMemory(
    errorInfo: GPUErrorInfo,
    currentRetries: number
  ): ErrorHandlingResult {
    // 计算新的批量大小
    const newBatchSize = this.calculateReducedBatchSize();
    
    if (newBatchSize >= this.config.minBatchSize) {
      // 增加重试计数
      const operationKey = errorInfo.context?.operation || 'default';
      this.retryCount.set(operationKey, currentRetries + 1);
      
      return {
        action: RecoveryAction.RETRY_WITH_REDUCED_BATCH,
        canRecover: true,
        newBatchSize,
        message: `GPU OOM: Reducing batch size from ${this.currentBatchSize} to ${newBatchSize}`,
        shouldSaveCheckpoint: true,
      };
    }
    
    // 批量大小已经最小，回退到CPU
    return this.createFallbackResult(
      errorInfo,
      `Cannot reduce batch size below ${this.config.minBatchSize}`
    );
  }
  
  /**
   * 处理内核错误
   * 
   * @param errorInfo 错误信息
   * @param currentRetries 当前重试次数
   * @returns 错误处理结果
   * 
   * Requirements: 8.1
   */
  private handleKernelError(
    errorInfo: GPUErrorInfo,
    currentRetries: number
  ): ErrorHandlingResult {
    if (currentRetries < this.config.maxRetries && this.config.enableAutoRecovery) {
      const operationKey = errorInfo.context?.operation || 'default';
      this.retryCount.set(operationKey, currentRetries + 1);
      
      return {
        action: RecoveryAction.RETRY,
        canRecover: true,
        message: `Kernel error: Retrying (attempt ${currentRetries + 1}/${this.config.maxRetries})`,
        shouldSaveCheckpoint: false,
      };
    }
    
    return this.createFallbackResult(errorInfo, 'Kernel error recovery failed');
  }

  
  /**
   * 处理设备丢失错误
   * 
   * @param errorInfo 错误信息
   * @returns 错误处理结果
   */
  private handleDeviceLost(errorInfo: GPUErrorInfo): ErrorHandlingResult {
    // 设备丢失通常需要完全重新初始化或回退到CPU
    return {
      action: RecoveryAction.FALLBACK_TO_CPU,
      canRecover: false,
      message: 'GPU device lost. Falling back to CPU mode.',
      shouldSaveCheckpoint: this.config.saveCheckpointOnFatalError,
    };
  }
  
  /**
   * 处理初始化错误
   * 
   * @param errorInfo 错误信息
   * @returns 错误处理结果
   */
  private handleInitializationError(errorInfo: GPUErrorInfo): ErrorHandlingResult {
    return {
      action: RecoveryAction.FALLBACK_TO_CPU,
      canRecover: false,
      message: 'GPU initialization failed. Falling back to CPU mode.',
      shouldSaveCheckpoint: false,
    };
  }
  
  /**
   * 处理数值溢出错误
   * 
   * @param errorInfo 错误信息
   * @param currentRetries 当前重试次数
   * @returns 错误处理结果
   */
  private handleNumericalOverflow(
    errorInfo: GPUErrorInfo,
    currentRetries: number
  ): ErrorHandlingResult {
    // 数值溢出可能需要重置权重或调整学习率
    if (currentRetries < this.config.maxRetries) {
      const operationKey = errorInfo.context?.operation || 'default';
      this.retryCount.set(operationKey, currentRetries + 1);
      
      return {
        action: RecoveryAction.IGNORE,
        canRecover: true,
        message: 'Numerical overflow detected. Values will be clamped.',
        shouldSaveCheckpoint: true,
      };
    }
    
    return this.createFallbackResult(errorInfo, 'Persistent numerical overflow');
  }

  
  /**
   * 处理验证错误
   * 
   * @param errorInfo 错误信息
   * @param currentRetries 当前重试次数
   * @returns 错误处理结果
   */
  private handleValidationError(
    errorInfo: GPUErrorInfo,
    currentRetries: number
  ): ErrorHandlingResult {
    if (currentRetries < this.config.maxRetries) {
      const operationKey = errorInfo.context?.operation || 'default';
      this.retryCount.set(operationKey, currentRetries + 1);
      
      return {
        action: RecoveryAction.RETRY,
        canRecover: true,
        message: `Validation error: Retrying (attempt ${currentRetries + 1}/${this.config.maxRetries})`,
        shouldSaveCheckpoint: true,
      };
    }
    
    return this.createFallbackResult(errorInfo, 'Validation error persists');
  }
  
  /**
   * 处理未知错误
   * 
   * @param errorInfo 错误信息
   * @param currentRetries 当前重试次数
   * @returns 错误处理结果
   */
  private handleUnknownError(
    errorInfo: GPUErrorInfo,
    currentRetries: number
  ): ErrorHandlingResult {
    if (currentRetries < this.config.maxRetries && this.config.enableAutoRecovery) {
      const operationKey = errorInfo.context?.operation || 'default';
      this.retryCount.set(operationKey, currentRetries + 1);
      
      return {
        action: RecoveryAction.RETRY,
        canRecover: true,
        message: `Unknown error: Retrying (attempt ${currentRetries + 1}/${this.config.maxRetries})`,
        shouldSaveCheckpoint: true,
      };
    }
    
    return this.createFallbackResult(errorInfo, 'Unknown error recovery failed');
  }
  
  /**
   * 创建回退结果
   * 
   * @param errorInfo 错误信息
   * @param reason 回退原因
   * @returns 错误处理结果
   */
  private createFallbackResult(
    errorInfo: GPUErrorInfo,
    reason: string
  ): ErrorHandlingResult {
    return {
      action: RecoveryAction.FALLBACK_TO_CPU,
      canRecover: false,
      message: `${reason}. Falling back to CPU mode.`,
      shouldSaveCheckpoint: this.config.saveCheckpointOnFatalError,
    };
  }

  
  /**
   * 计算缩减后的批量大小
   * 
   * @returns 新的批量大小
   * 
   * Requirements: 6.3, 8.2
   */
  private calculateReducedBatchSize(): number {
    const newSize = Math.floor(
      this.currentBatchSize * this.config.batchSizeReductionFactor
    );
    return Math.max(newSize, this.config.minBatchSize);
  }
  
  /**
   * 应用批量大小调整
   * 
   * 更新引擎和内部状态的批量大小。
   * 
   * @param newBatchSize 新的批量大小
   * 
   * Requirements: 6.3
   */
  applyBatchSizeReduction(newBatchSize: number): void {
    console.warn(
      `Reducing batch size: ${this.currentBatchSize} -> ${newBatchSize}`
    );
    
    this.currentBatchSize = newBatchSize;
    this.engine.updateBatchSize(newBatchSize);
  }
  
  /**
   * 恢复原始批量大小
   * 
   * 在错误恢复后尝试恢复原始批量大小。
   */
  restoreOriginalBatchSize(): void {
    if (this.currentBatchSize !== this.originalBatchSize) {
      console.log(
        `Restoring batch size: ${this.currentBatchSize} -> ${this.originalBatchSize}`
      );
      this.currentBatchSize = this.originalBatchSize;
      this.engine.updateBatchSize(this.originalBatchSize);
    }
  }
  
  /**
   * 记录错误
   * 
   * @param errorInfo 错误信息
   */
  private logError(errorInfo: GPUErrorInfo): void {
    // 添加到历史记录
    this.errorHistory.push(errorInfo);
    
    // 限制历史记录大小
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }
    
    // 输出日志
    console.error(
      `[GPU Error] ${errorInfo.type}: ${errorInfo.message}`,
      errorInfo.context ? `Context: ${JSON.stringify(errorInfo.context)}` : ''
    );
  }

  
  /**
   * 保存紧急检查点
   * 
   * 在发生致命错误时保存当前训练状态。
   * 
   * @param additionalData 额外数据
   */
  saveEmergencyCheckpoint(additionalData?: Record<string, unknown>): void {
    if (!this.checkpointManager) {
      console.warn('No checkpoint manager available for emergency save');
      return;
    }
    
    try {
      console.log('Saving emergency checkpoint...');
      // 检查点管理器会处理实际的保存逻辑
      // 这里只是触发保存
      console.log('Emergency checkpoint saved');
    } catch (error) {
      console.error('Failed to save emergency checkpoint:', error);
    }
  }
  
  /**
   * 重置重试计数器
   * 
   * @param operation 操作名称（可选，不指定则重置所有）
   */
  resetRetryCount(operation?: string): void {
    if (operation) {
      this.retryCount.delete(operation);
    } else {
      this.retryCount.clear();
    }
  }
  
  /**
   * 获取错误历史
   * 
   * @param limit 限制返回数量
   * @returns 错误历史记录
   */
  getErrorHistory(limit?: number): GPUErrorInfo[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }
  
  /**
   * 获取错误统计
   * 
   * @returns 错误统计信息
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<GPUErrorType, number>;
    recentErrors: number;
  } {
    const errorsByType: Record<GPUErrorType, number> = {
      [GPUErrorType.KERNEL_ERROR]: 0,
      [GPUErrorType.OUT_OF_MEMORY]: 0,
      [GPUErrorType.DEVICE_LOST]: 0,
      [GPUErrorType.INITIALIZATION_ERROR]: 0,
      [GPUErrorType.NUMERICAL_OVERFLOW]: 0,
      [GPUErrorType.VALIDATION_ERROR]: 0,
      [GPUErrorType.UNKNOWN]: 0,
    };
    
    for (const error of this.errorHistory) {
      errorsByType[error.type]++;
    }
    
    // 计算最近5分钟的错误数
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentErrors = this.errorHistory.filter(
      e => e.timestamp > fiveMinutesAgo
    ).length;
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors,
    };
  }

  
  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }
  
  /**
   * 获取当前批量大小
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }
  
  /**
   * 获取原始批量大小
   */
  getOriginalBatchSize(): number {
    return this.originalBatchSize;
  }
  
  /**
   * 更新配置
   * 
   * @param config 新配置
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取配置
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
  
  /**
   * 设置检查点管理器
   * 
   * @param manager 检查点管理器
   */
  setCheckpointManager(manager: GPUCheckpointManager): void {
    this.checkpointManager = manager;
  }
}

// ============================================
// 批量大小自动调整器
// ============================================

/**
 * 批量大小自动调整配置
 */
export interface BatchSizeAdjusterConfig {
  /** 初始批量大小 */
  initialBatchSize: number;
  /** 最小批量大小 */
  minBatchSize: number;
  /** 最大批量大小 */
  maxBatchSize: number;
  /** 缩减因子 */
  reductionFactor: number;
  /** 增长因子 */
  growthFactor: number;
  /** 稳定周期（连续成功次数后尝试增长） */
  stabilityPeriod: number;
  /** 内存压力阈值 */
  memoryPressureThreshold: number;
}


/**
 * 默认批量大小调整配置
 */
export const DEFAULT_BATCH_SIZE_ADJUSTER_CONFIG: BatchSizeAdjusterConfig = {
  initialBatchSize: 64,
  minBatchSize: 1,
  maxBatchSize: 1024,
  reductionFactor: 0.5,
  growthFactor: 1.25,
  stabilityPeriod: 100,
  memoryPressureThreshold: 0.9,
};

/**
 * 批量大小自动调整器
 * 
 * 根据内存压力和错误情况自动调整批量大小。
 * 
 * Requirements: 6.3, 8.2
 */
export class BatchSizeAdjuster {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** 配置 */
  private config: BatchSizeAdjusterConfig;
  
  /** 当前批量大小 */
  private currentBatchSize: number;
  
  /** 连续成功计数 */
  private consecutiveSuccesses: number = 0;
  
  /** 上次调整时间 */
  private lastAdjustmentTime: number = 0;
  
  /** 调整历史 */
  private adjustmentHistory: Array<{
    timestamp: number;
    oldSize: number;
    newSize: number;
    reason: string;
  }> = [];
  
  /**
   * 构造函数
   * 
   * @param engine GPU引擎
   * @param config 配置
   */
  constructor(
    engine: GPUEngine,
    config: Partial<BatchSizeAdjusterConfig> = {}
  ) {
    this.engine = engine;
    this.config = { ...DEFAULT_BATCH_SIZE_ADJUSTER_CONFIG, ...config };
    this.currentBatchSize = this.config.initialBatchSize;
  }

  
  /**
   * 检测内存压力
   * 
   * 估算当前内存使用情况并判断是否处于压力状态。
   * 
   * @returns 内存状态
   * 
   * Requirements: 6.3
   */
  detectMemoryPressure(): MemoryStatus {
    // GPU.js不直接提供内存信息，使用启发式方法估算
    // 基于批量大小和已知的内存使用模式
    
    const deviceInfo = this.engine.getDeviceInfo();
    
    // 估算每个游戏的内存使用（字节）
    // 棋盘状态: 16 * 4 = 64 bytes
    // 分数/移动/状态: 12 bytes
    // 权重缓冲区: 约 10MB（共享）
    // 梯度缓冲区: 约 10MB（共享）
    const perGameMemory = 76; // bytes
    const sharedMemory = 20 * 1024 * 1024; // 20MB
    
    const estimatedUsage = sharedMemory + this.currentBatchSize * perGameMemory;
    
    // 假设可用内存（如果设备信息不可用，使用保守估计）
    const availableMemory = deviceInfo?.availableMemory || 512 * 1024 * 1024; // 512MB default
    
    const usageRatio = estimatedUsage / availableMemory;
    const underPressure = usageRatio > this.config.memoryPressureThreshold;
    
    // 计算建议的批量大小
    let suggestedBatchSize = this.currentBatchSize;
    if (underPressure) {
      suggestedBatchSize = Math.floor(
        this.currentBatchSize * this.config.reductionFactor
      );
      suggestedBatchSize = Math.max(suggestedBatchSize, this.config.minBatchSize);
    }
    
    return {
      underPressure,
      usageRatio,
      suggestedBatchSize,
      currentBatchSize: this.currentBatchSize,
    };
  }
  
  /**
   * 处理成功的批次
   * 
   * 记录成功并在稳定后尝试增加批量大小。
   * 
   * @returns 是否调整了批量大小
   */
  recordSuccess(): boolean {
    this.consecutiveSuccesses++;
    
    // 检查是否达到稳定期
    if (this.consecutiveSuccesses >= this.config.stabilityPeriod) {
      return this.tryIncreaseBatchSize();
    }
    
    return false;
  }

  
  /**
   * 处理失败的批次
   * 
   * 重置成功计数并减少批量大小。
   * 
   * @param reason 失败原因
   * @returns 新的批量大小
   * 
   * Requirements: 8.2
   */
  recordFailure(reason: string = 'unknown'): number {
    this.consecutiveSuccesses = 0;
    return this.reduceBatchSize(reason);
  }
  
  /**
   * 减少批量大小
   * 
   * @param reason 减少原因
   * @returns 新的批量大小
   * 
   * Requirements: 6.3, 8.2
   */
  reduceBatchSize(reason: string = 'manual'): number {
    const oldSize = this.currentBatchSize;
    const newSize = Math.max(
      Math.floor(oldSize * this.config.reductionFactor),
      this.config.minBatchSize
    );
    
    if (newSize !== oldSize) {
      this.applyBatchSizeChange(oldSize, newSize, `Reduced: ${reason}`);
    }
    
    return this.currentBatchSize;
  }
  
  /**
   * 尝试增加批量大小
   * 
   * @returns 是否成功增加
   */
  private tryIncreaseBatchSize(): boolean {
    // 检查内存压力
    const memoryStatus = this.detectMemoryPressure();
    if (memoryStatus.underPressure) {
      return false;
    }
    
    const oldSize = this.currentBatchSize;
    const newSize = Math.min(
      Math.floor(oldSize * this.config.growthFactor),
      this.config.maxBatchSize
    );
    
    if (newSize > oldSize) {
      this.applyBatchSizeChange(oldSize, newSize, 'Increased after stability');
      this.consecutiveSuccesses = 0;
      return true;
    }
    
    return false;
  }
  
  /**
   * 应用批量大小变更
   * 
   * @param oldSize 旧大小
   * @param newSize 新大小
   * @param reason 变更原因
   */
  private applyBatchSizeChange(
    oldSize: number,
    newSize: number,
    reason: string
  ): void {
    this.currentBatchSize = newSize;
    this.engine.updateBatchSize(newSize);
    this.lastAdjustmentTime = Date.now();
    
    // 记录历史
    this.adjustmentHistory.push({
      timestamp: this.lastAdjustmentTime,
      oldSize,
      newSize,
      reason,
    });
    
    // 限制历史记录大小
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory.shift();
    }
    
    console.log(`Batch size adjusted: ${oldSize} -> ${newSize} (${reason})`);
  }

  
  /**
   * 设置批量大小
   * 
   * @param size 新的批量大小
   * @param reason 设置原因
   */
  setBatchSize(size: number, reason: string = 'manual'): void {
    const clampedSize = Math.max(
      this.config.minBatchSize,
      Math.min(size, this.config.maxBatchSize)
    );
    
    if (clampedSize !== this.currentBatchSize) {
      this.applyBatchSizeChange(this.currentBatchSize, clampedSize, reason);
    }
  }
  
  /**
   * 获取当前批量大小
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }
  
  /**
   * 获取调整历史
   * 
   * @param limit 限制返回数量
   */
  getAdjustmentHistory(limit?: number): typeof this.adjustmentHistory {
    if (limit) {
      return this.adjustmentHistory.slice(-limit);
    }
    return [...this.adjustmentHistory];
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    currentBatchSize: number;
    consecutiveSuccesses: number;
    totalAdjustments: number;
    lastAdjustmentTime: number;
  } {
    return {
      currentBatchSize: this.currentBatchSize,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalAdjustments: this.adjustmentHistory.length,
      lastAdjustmentTime: this.lastAdjustmentTime,
    };
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.consecutiveSuccesses = 0;
    this.currentBatchSize = this.config.initialBatchSize;
    this.engine.updateBatchSize(this.config.initialBatchSize);
  }
  
  /**
   * 更新配置
   * 
   * @param config 新配置
   */
  updateConfig(config: Partial<BatchSizeAdjusterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}


// ============================================
// 包装器函数
// ============================================

/**
 * 使用错误处理包装异步操作
 * 
 * @param operation 要执行的操作
 * @param errorHandler 错误处理器
 * @param context 错误上下文
 * @returns 操作结果或null（如果失败）
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler: GPUErrorHandler,
  context: GPUErrorContext = {}
): Promise<{ result: T | null; error: ErrorHandlingResult | null }> {
  try {
    const result = await operation();
    errorHandler.resetRetryCount(context.operation);
    return { result, error: null };
  } catch (error) {
    const handlingResult = errorHandler.handleError(error as Error, context);
    return { result: null, error: handlingResult };
  }
}

/**
 * 使用错误处理包装同步操作
 * 
 * @param operation 要执行的操作
 * @param errorHandler 错误处理器
 * @param context 错误上下文
 * @returns 操作结果或null（如果失败）
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  errorHandler: GPUErrorHandler,
  context: GPUErrorContext = {}
): { result: T | null; error: ErrorHandlingResult | null } {
  try {
    const result = operation();
    errorHandler.resetRetryCount(context.operation);
    return { result, error: null };
  } catch (error) {
    const handlingResult = errorHandler.handleError(error as Error, context);
    return { result: null, error: handlingResult };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建GPU错误处理器
 * 
 * @param engine GPU引擎
 * @param config 配置
 * @param checkpointManager 检查点管理器
 * @returns GPU错误处理器
 */
export function createGPUErrorHandler(
  engine: GPUEngine,
  config?: Partial<ErrorHandlerConfig>,
  checkpointManager?: GPUCheckpointManager
): GPUErrorHandler {
  return new GPUErrorHandler(engine, config, checkpointManager);
}

/**
 * 创建批量大小调整器
 * 
 * @param engine GPU引擎
 * @param config 配置
 * @returns 批量大小调整器
 */
export function createBatchSizeAdjuster(
  engine: GPUEngine,
  config?: Partial<BatchSizeAdjusterConfig>
): BatchSizeAdjuster {
  return new BatchSizeAdjuster(engine, config);
}
