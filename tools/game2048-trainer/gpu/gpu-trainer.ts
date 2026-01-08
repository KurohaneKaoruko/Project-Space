/**
 * GPU Trainer - GPU加速的TD Learning训练器
 * 
 * 实现批量TD Learning训练循环，支持：
 * - 批量游戏并行模拟
 * - 批量状态评估和最佳移动选择
 * - 批量权重更新
 * - 周期性GPU vs CPU验证
 * - 检查点保存和恢复
 * - GPU性能监控和报告
 * 
 * Requirements: 2.2, 3.4, 4.1, 6.1, 6.2, 6.4, 6.5, 8.4, 8.5
 */

import { GPUEngine } from './gpu-engine';
import { BatchGameSimulator } from './batch-simulator';
import { GPUNTupleNetwork } from './gpu-network';
import { BatchGameState } from './board-utils';
import {
  GPUCheckpointManager,
  GPUTrainingCheckpointConfig,
  saveGPUWeightsToFile,
} from './weight-serialization';
import {
  GPUPerformanceMonitor,
  createGPUPerformanceMonitor,
} from './performance-monitor';
import { Pattern } from '../patterns';
import { NTupleNetwork } from '../network';
import { TrainingStats, TrainingConfig, DEFAULT_TRAINING_CONFIG } from '../trainer';
import { Game, Direction } from '../game';

// ============================================
// 类型定义
// ============================================

/**
 * GPU训练配置
 */
export interface GPUTrainingConfig extends TrainingConfig {
  /** GPU配置 */
  gpu: {
    enabled: boolean;
    batchSize: number;
    deviceIndex?: number;
    debug?: boolean;
  };
  /** 梯度累积步数（每多少步应用一次梯度） */
  gradientAccumulationSteps: number;
  /** 验证间隔（每N局验证一次GPU计算正确性） */
  validationInterval: number;
  /** 验证失败时是否回退到CPU */
  fallbackOnValidationFailure: boolean;
}

/**
 * GPU训练统计
 */
export interface GPUTrainingStats extends TrainingStats {
  /** GPU利用率（估计值） */
  gpuUtilization: number;
  /** GPU内存使用（字节） */
  gpuMemoryUsed: number;
  /** 相比CPU的加速比 */
  speedupRatio: number;
  /** 批量完成的游戏数 */
  batchCompletedGames: number;
  /** 验证通过次数 */
  validationPassed: number;
  /** 验证失败次数 */
  validationFailed: number;
}

/**
 * 批量训练结果
 */
interface BatchTrainingResult {
  /** 完成的游戏数 */
  completedGames: number;
  /** 总得分 */
  totalScore: number;
  /** 最大方块值 */
  maxTile: number;
  /** 总移动次数 */
  totalMoves: number;
  /** 达到2048的游戏数 */
  reached2048: number;
  /** 达到4096的游戏数 */
  reached4096: number;
  /** 达到8192的游戏数 */
  reached8192: number;
}

/**
 * 验证结果
 */
interface ValidationResult {
  /** 是否通过验证 */
  passed: boolean;
  /** 最大评估误差 */
  maxEvalError: number;
  /** 平均评估误差 */
  avgEvalError: number;
  /** 移动一致性（相同移动选择的比例） */
  moveConsistency: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 默认GPU训练配置
 */
export const DEFAULT_GPU_TRAINING_CONFIG: GPUTrainingConfig = {
  ...DEFAULT_TRAINING_CONFIG,
  gpu: {
    enabled: true,
    batchSize: 64,
    deviceIndex: undefined,
    debug: false,
  },
  gradientAccumulationSteps: 1,
  validationInterval: 10000,
  fallbackOnValidationFailure: true,
  checkpointPath: 'gpu-checkpoint.json',
  outputPath: 'gpu-weights.json',
};

// ============================================
// GPU训练器类
// ============================================

/**
 * GPU加速的TD Learning训练器
 * 
 * 使用GPU并行处理多局游戏，显著提升训练速度。
 * 
 * Requirements: 2.2, 3.4, 4.1, 6.1, 6.2, 6.4, 6.5
 */
export class GPUTrainer {
  /** GPU引擎 */
  private engine: GPUEngine;
  
  /** 批量游戏模拟器 */
  private simulator: BatchGameSimulator;
  
  /** GPU N-Tuple网络 */
  private network: GPUNTupleNetwork;
  
  /** 训练配置 */
  private config: GPUTrainingConfig;
  
  /** 训练统计 */
  private stats: GPUTrainingStats;
  
  /** 检查点管理器 */
  private checkpointManager: GPUCheckpointManager;
  
  /** 性能监控器 */
  private performanceMonitor: GPUPerformanceMonitor;
  
  /** 最近N局的得分记录 */
  private recentScores: number[];
  
  /** 里程碑计数 */
  private milestoneCount: { tile2048: number; tile4096: number; tile8192: number };
  
  /** 训练开始时间 */
  private startTime: number;
  
  /** 当前学习率 */
  private currentLearningRate: number;
  
  /** 起始轮数 */
  private startEpisode: number;
  
  /** 批量游戏状态 */
  private batchState: BatchGameState | null = null;
  
  /** 上一步的afterstate评估值 */
  private prevValues: Float32Array | null = null;
  
  /** 上一步的afterstate棋盘 */
  private prevAfterstates: Float32Array | null = null;
  
  /** 梯度累积计数 */
  private gradientAccumulationCount: number = 0;
  
  /** CPU参考网络（用于验证） */
  private cpuReferenceNetwork: NTupleNetwork | null = null;
  
  /** 是否已初始化 */
  private initialized: boolean = false;
  
  /**
   * 构造函数
   * 
   * @param engine GPU引擎
   * @param simulator 批量游戏模拟器
   * @param network GPU N-Tuple网络
   * @param config 训练配置
   */
  constructor(
    engine: GPUEngine,
    simulator: BatchGameSimulator,
    network: GPUNTupleNetwork,
    config: Partial<GPUTrainingConfig> = {}
  ) {
    this.engine = engine;
    this.simulator = simulator;
    this.network = network;
    this.config = { ...DEFAULT_GPU_TRAINING_CONFIG, ...config };
    this.currentLearningRate = this.config.learningRate;
    this.startEpisode = 1;
    this.startTime = 0;
    
    // 初始化统计
    this.stats = this.createInitialStats();
    
    this.recentScores = [];
    this.milestoneCount = { tile2048: 0, tile4096: 0, tile8192: 0 };
    
    // 创建性能监控器
    this.performanceMonitor = createGPUPerformanceMonitor(engine, {
      enabled: true,
      verbose: config.gpu?.debug || false,
      cpuBaselineEpisodesPerSecond: 50,
      onWarning: (warning) => {
        if (warning.severity === 'high') {
          console.warn(`\n[GPU Warning] ${warning.message}`);
        }
      },
    });
    
    // 创建检查点管理器
    this.checkpointManager = new GPUCheckpointManager(
      network,
      this.config.checkpointPath
    );
    
    // 获取CPU参考网络
    this.cpuReferenceNetwork = network.getCPUNetwork();
  }
  
  /**
   * 创建初始统计对象
   */
  private createInitialStats(): GPUTrainingStats {
    return {
      episode: 0,
      totalScore: 0,
      avgScore: 0,
      recentAvgScore: 0,
      maxTile: 0,
      rate2048: 0,
      rate4096: 0,
      rate8192: 0,
      episodesPerSecond: 0,
      elapsedTime: 0,
      estimatedRemaining: 0,
      gpuUtilization: 0,
      gpuMemoryUsed: 0,
      speedupRatio: 0,
      batchCompletedGames: 0,
      validationPassed: 0,
      validationFailed: 0,
    };
  }
  
  /**
   * 初始化训练器
   */
  initialize(): void {
    if (this.initialized) return;
    
    const batchSize = this.config.gpu.batchSize;
    
    // 初始化批量游戏状态
    this.batchState = this.simulator.initBatch();
    
    // 初始化上一步状态缓冲区
    this.prevValues = new Float32Array(batchSize);
    this.prevAfterstates = new Float32Array(batchSize * 16);
    
    // 初始化为-Infinity表示没有上一步
    this.prevValues.fill(-Infinity);
    
    this.initialized = true;
  }

  
  /**
   * 开始GPU训练
   * 
   * 执行指定轮数的训练，使用批量并行处理。
   * 
   * @param resume 是否尝试从检查点恢复
   * 
   * Requirements: 6.1, 6.2, 6.4, 6.5
   */
  async train(resume: boolean = false): Promise<void> {
    // 初始化
    if (!this.initialized) {
      this.initialize();
    }
    
    // 尝试从检查点恢复
    if (resume) {
      this.loadCheckpoint();
    }
    
    this.printTrainingHeader();
    
    // 开始性能监控
    this.performanceMonitor.startMonitoring();
    
    // 初始化内存估计
    this.updateMemoryEstimate();
    
    this.startTime = Date.now();
    let lastProgressTime = this.startTime;
    let lastCheckpointEpisode = this.startEpisode - 1;
    let completedEpisodes = this.startEpisode - 1;
    
    // 注册中断信号处理
    const handleInterrupt = () => {
      console.log('\n\nInterrupted! Saving checkpoint...');
      this.saveCheckpoint();
      // 输出最终性能报告
      this.performanceMonitor.stopMonitoring();
      console.log(`Checkpoint saved. Resume with --resume flag.`);
      process.exit(0);
    };
    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);
    
    // 主训练循环
    while (completedEpisodes < this.config.episodes) {
      // 训练一个批次（带性能计时）
      const batchStartTime = performance.now();
      const result = this.trainBatch();
      const batchTime = performance.now() - batchStartTime;
      
      // 记录内核执行时间
      this.performanceMonitor.recordKernelExecution('trainBatch', batchTime);
      
      // 更新统计
      completedEpisodes += result.completedGames;
      this.updateStats(completedEpisodes, result);
      
      // 记录完成的游戏到性能监控器
      this.performanceMonitor.recordEpisodes(result.completedGames, result.totalMoves);
      
      // 学习率衰减
      if (this.config.enableDecay) {
        const decaySteps = Math.floor(completedEpisodes / this.config.decayInterval);
        this.currentLearningRate = this.config.learningRate * 
          Math.pow(this.config.decayRate, decaySteps);
      }
      
      // 进度报告
      const now = Date.now();
      const timeSinceLastProgress = now - lastProgressTime;
      
      if (completedEpisodes % this.config.reportInterval === 0 || 
          timeSinceLastProgress >= 5000) {
        this.reportProgress();
        lastProgressTime = now;
      }
      
      // 周期性验证
      if (this.config.validationInterval > 0 &&
          completedEpisodes % this.config.validationInterval === 0) {
        const validationResult = this.validateComputation();
        if (!validationResult.passed) {
          console.log(`\nValidation failed at episode ${completedEpisodes}`);
          console.log(`  Max eval error: ${validationResult.maxEvalError.toFixed(6)}`);
          console.log(`  Move consistency: ${(validationResult.moveConsistency * 100).toFixed(1)}%`);
          
          this.stats.validationFailed++;
          
          if (this.config.fallbackOnValidationFailure) {
            console.log('Falling back to CPU mode...');
            // 保存检查点后退出
            this.saveCheckpoint();
            throw new Error('GPU validation failed, falling back to CPU');
          }
        } else {
          this.stats.validationPassed++;
        }
      }
      
      // 保存检查点
      if (this.config.checkpointInterval > 0 &&
          completedEpisodes - lastCheckpointEpisode >= this.config.checkpointInterval) {
        this.saveCheckpoint();
        lastCheckpointEpisode = completedEpisodes;
      }
    }
    
    // 移除中断处理
    process.removeListener('SIGINT', handleInterrupt);
    process.removeListener('SIGTERM', handleInterrupt);
    
    // 停止性能监控并输出报告
    const performanceReport = this.performanceMonitor.stopMonitoring();
    
    // 训练完成
    this.printTrainingComplete(performanceReport);
    
    // 保存权重
    this.saveWeights();
    
    // 删除检查点
    this.checkpointManager.deleteCheckpoint();
  }
  
  /**
   * 训练一个批次
   * 
   * 对批量中的所有游戏执行一步训练：
   * 1. 选择最佳移动
   * 2. 执行移动获取afterstate
   * 3. 计算TD误差并更新权重
   * 4. 添加随机方块
   * 5. 检查游戏结束并重置
   * 
   * @returns 批量训练结果
   * 
   * Requirements: 2.2, 3.4, 4.1
   */
  private trainBatch(): BatchTrainingResult {
    if (!this.batchState || !this.prevValues || !this.prevAfterstates) {
      throw new Error('Trainer not initialized');
    }
    
    const batchSize = this.config.gpu.batchSize;
    const result: BatchTrainingResult = {
      completedGames: 0,
      totalScore: 0,
      maxTile: 0,
      totalMoves: 0,
      reached2048: 0,
      reached4096: 0,
      reached8192: 0,
    };
    
    // 1. 选择最佳移动（批量）
    const directions = this.selectBestMoves(this.batchState);
    
    // 2. 执行移动获取afterstate
    const moveResult = this.simulator.batchMoveWithDirections(this.batchState, directions);
    
    // 3. 评估当前afterstate
    const currentValues = this.network.batchEvaluate(moveResult.afterstates, batchSize);
    
    // 4. 计算TD误差并累积梯度
    const tdErrors = new Float32Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
      if (this.batchState.gameOver[i]) continue;
      
      if (moveResult.valid[i]) {
        // 如果有上一步，计算TD误差
        if (this.prevValues[i] !== -Infinity) {
          // TD误差 = reward + V(current) - V(prev)
          tdErrors[i] = moveResult.rewards[i] + currentValues[i] - this.prevValues[i];
        }
        
        // 保存当前afterstate用于下一步
        this.prevValues[i] = currentValues[i];
        for (let j = 0; j < 16; j++) {
          this.prevAfterstates[i * 16 + j] = moveResult.afterstates[i * 16 + j];
        }
      }
    }
    
    // 5. 累积梯度
    this.network.batchAccumulateGradients(this.prevAfterstates, tdErrors, batchSize);
    this.gradientAccumulationCount++;
    
    // 6. 应用梯度（根据累积步数）
    if (this.gradientAccumulationCount >= this.config.gradientAccumulationSteps) {
      this.network.applyGradients(this.currentLearningRate);
      this.gradientAccumulationCount = 0;
    }
    
    // 7. 应用移动结果并添加随机方块
    this.simulator.applyMoveResult(this.batchState, moveResult);
    this.simulator.batchAddRandomTile(this.batchState, moveResult.valid);
    
    // 8. 检查游戏结束
    this.simulator.batchCheckGameOver(this.batchState);
    
    // 9. 处理已完成的游戏
    for (let i = 0; i < batchSize; i++) {
      if (this.batchState.gameOver[i]) {
        // 游戏结束时的最终TD更新
        if (this.prevValues[i] !== -Infinity) {
          const finalTdError = 0 - this.prevValues[i];
          this.network.accumulateGradient(
            this.prevAfterstates.subarray(i * 16, (i + 1) * 16),
            finalTdError
          );
        }
        
        // 收集统计
        const score = this.batchState.scores[i];
        const maxTile = this.simulator.getMaxTile(this.batchState, i);
        
        result.completedGames++;
        result.totalScore += score;
        result.totalMoves += this.batchState.moves[i];
        
        if (maxTile > result.maxTile) {
          result.maxTile = maxTile;
        }
        
        if (maxTile >= 2048) result.reached2048++;
        if (maxTile >= 4096) result.reached4096++;
        if (maxTile >= 8192) result.reached8192++;
        
        // 重置游戏状态
        this.prevValues[i] = -Infinity;
      }
    }
    
    // 10. 重置已完成的游戏
    this.simulator.resetCompletedGames(this.batchState);
    
    return result;
  }
  
  /**
   * 选择最佳移动（批量）
   * 
   * 对批量中的每个游戏，评估所有有效移动的afterstate，
   * 选择评估值最高的方向。
   * 
   * @param states 批量游戏状态
   * @returns 每个游戏的最佳移动方向
   * 
   * Requirements: 3.4
   */
  private selectBestMoves(states: BatchGameState): Uint8Array {
    const batchSize = states.batchSize;
    const directions = new Uint8Array(batchSize);
    
    // 为每个游戏选择最佳移动
    for (let i = 0; i < batchSize; i++) {
      if (states.gameOver[i]) {
        directions[i] = 0;
        continue;
      }
      
      let bestDir = 0;
      let bestValue = -Infinity;
      
      // 尝试所有4个方向
      for (let dir = 0; dir < 4; dir++) {
        // 创建单个游戏的临时状态
        const tempBoard = new Float32Array(16);
        for (let j = 0; j < 16; j++) {
          tempBoard[j] = states.boards[i * 16 + j];
        }
        
        // 检查移动是否有效并获取afterstate
        const afterstate = this.tryMove(tempBoard, dir);
        if (afterstate !== null) {
          // 评估afterstate
          const value = afterstate.reward + this.network.evaluate(afterstate.board);
          
          if (value > bestValue) {
            bestValue = value;
            bestDir = dir;
          }
        }
      }
      
      directions[i] = bestDir;
    }
    
    return directions;
  }
  
  /**
   * 尝试执行移动并返回afterstate
   * 
   * @param board 棋盘状态
   * @param direction 移动方向
   * @returns afterstate和奖励，如果移动无效返回null
   */
  private tryMove(board: Float32Array, direction: number): { board: Float32Array; reward: number } | null {
    // 使用CPU实现来计算单个移动
    // 这比创建批量更高效
    const result = this.cpuMove(board, direction);
    
    if (!result.valid) {
      return null;
    }
    
    return {
      board: result.afterstate,
      reward: result.reward,
    };
  }
  
  /**
   * CPU移动实现（用于单个棋盘）
   */
  private cpuMove(board: Float32Array, direction: number): {
    afterstate: Float32Array;
    reward: number;
    valid: boolean;
  } {
    const afterstate = new Float32Array(16);
    let reward = 0;
    let moved = false;
    
    // 根据方向执行移动
    switch (direction) {
      case 0: // 上
        for (let col = 0; col < 4; col++) {
          const result = this.moveLineUp(board, col);
          for (let row = 0; row < 4; row++) {
            afterstate[row * 4 + col] = result.line[row];
          }
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 1: // 右
        for (let row = 0; row < 4; row++) {
          const line = [
            board[row * 4 + 3],
            board[row * 4 + 2],
            board[row * 4 + 1],
            board[row * 4 + 0],
          ];
          const result = this.moveLine(line);
          afterstate[row * 4 + 3] = result.line[0];
          afterstate[row * 4 + 2] = result.line[1];
          afterstate[row * 4 + 1] = result.line[2];
          afterstate[row * 4 + 0] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 2: // 下
        for (let col = 0; col < 4; col++) {
          const result = this.moveLineDown(board, col);
          for (let row = 0; row < 4; row++) {
            afterstate[row * 4 + col] = result.line[row];
          }
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 3: // 左
        for (let row = 0; row < 4; row++) {
          const line = [
            board[row * 4 + 0],
            board[row * 4 + 1],
            board[row * 4 + 2],
            board[row * 4 + 3],
          ];
          const result = this.moveLine(line);
          afterstate[row * 4 + 0] = result.line[0];
          afterstate[row * 4 + 1] = result.line[1];
          afterstate[row * 4 + 2] = result.line[2];
          afterstate[row * 4 + 3] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
    }
    
    return { afterstate, reward, valid: moved };
  }
  
  /**
   * 移动一行（向左）
   */
  private moveLine(line: number[]): { line: number[]; score: number; moved: boolean } {
    const result = [0, 0, 0, 0];
    let score = 0;
    let moved = false;
    let writePos = 0;
    let lastMerged = false;
    
    for (let i = 0; i < 4; i++) {
      if (line[i] === 0) continue;
      
      if (writePos > 0 && result[writePos - 1] === line[i] && !lastMerged) {
        // 合并
        result[writePos - 1] = line[i] + 1;
        score += 1 << (line[i] + 1);
        lastMerged = true;
        moved = true;
      } else {
        // 移动
        if (writePos !== i) moved = true;
        result[writePos] = line[i];
        writePos++;
        lastMerged = false;
      }
    }
    
    return { line: result, score, moved };
  }
  
  /**
   * 向上移动一列
   */
  private moveLineUp(board: Float32Array, col: number): { line: number[]; score: number; moved: boolean } {
    const line = [
      board[0 * 4 + col],
      board[1 * 4 + col],
      board[2 * 4 + col],
      board[3 * 4 + col],
    ];
    return this.moveLine(line);
  }
  
  /**
   * 向下移动一列
   */
  private moveLineDown(board: Float32Array, col: number): { line: number[]; score: number; moved: boolean } {
    const line = [
      board[3 * 4 + col],
      board[2 * 4 + col],
      board[1 * 4 + col],
      board[0 * 4 + col],
    ];
    const result = this.moveLine(line);
    result.line = [result.line[3], result.line[2], result.line[1], result.line[0]];
    return result;
  }

  
  /**
   * 验证GPU计算正确性
   * 
   * 比较GPU和CPU的评估结果和移动选择，确保GPU计算正确。
   * 
   * @returns 验证结果
   * 
   * Requirements: 8.4, 8.5
   */
  private validateComputation(): ValidationResult {
    if (!this.cpuReferenceNetwork) {
      return {
        passed: true,
        maxEvalError: 0,
        avgEvalError: 0,
        moveConsistency: 1,
        error: 'No CPU reference network available',
      };
    }
    
    const numSamples = 10;
    let maxEvalError = 0;
    let totalEvalError = 0;
    let consistentMoves = 0;
    
    try {
      for (let i = 0; i < numSamples; i++) {
        // 创建随机棋盘状态
        const board = this.createRandomBoard();
        
        // GPU评估
        const gpuValue = this.network.evaluate(board);
        
        // CPU评估
        const cpuBoard = this.float32ToBigInt(board);
        const cpuValue = this.cpuReferenceNetwork.evaluate(cpuBoard);
        
        // 计算误差
        const error = Math.abs(gpuValue - cpuValue);
        if (error > maxEvalError) {
          maxEvalError = error;
        }
        totalEvalError += error;
        
        // 比较移动选择
        const gpuMove = this.selectBestMoveForBoard(board);
        const cpuMove = this.selectBestMoveCPU(cpuBoard);
        
        if (gpuMove === cpuMove) {
          consistentMoves++;
        }
      }
      
      const avgEvalError = totalEvalError / numSamples;
      const moveConsistency = consistentMoves / numSamples;
      
      // 验证阈值
      const evalThreshold = 1e-2; // 允许的最大评估误差
      const consistencyThreshold = 0.8; // 允许的最小移动一致性
      
      const passed = maxEvalError < evalThreshold && moveConsistency >= consistencyThreshold;
      
      return {
        passed,
        maxEvalError,
        avgEvalError,
        moveConsistency,
      };
    } catch (error) {
      return {
        passed: false,
        maxEvalError: Infinity,
        avgEvalError: Infinity,
        moveConsistency: 0,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 创建随机棋盘状态（用于验证）
   */
  private createRandomBoard(): Float32Array {
    const board = new Float32Array(16);
    const numTiles = 4 + Math.floor(Math.random() * 8); // 4-11个方块
    
    const positions = Array.from({ length: 16 }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    for (let i = 0; i < numTiles; i++) {
      // 生成1-11的方块值（2-2048）
      board[positions[i]] = 1 + Math.floor(Math.random() * 11);
    }
    
    return board;
  }
  
  /**
   * 将Float32Array棋盘转换为BigInt
   */
  private float32ToBigInt(board: Float32Array): bigint {
    let result = 0n;
    for (let i = 0; i < 16; i++) {
      const tile = Math.floor(board[i]);
      result |= BigInt(tile) << BigInt(i * 4);
    }
    return result;
  }
  
  /**
   * 为单个棋盘选择最佳移动（GPU）
   */
  private selectBestMoveForBoard(board: Float32Array): number {
    let bestDir = 0;
    let bestValue = -Infinity;
    
    for (let dir = 0; dir < 4; dir++) {
      const result = this.cpuMove(board, dir);
      if (result.valid) {
        const value = result.reward + this.network.evaluate(result.afterstate);
        if (value > bestValue) {
          bestValue = value;
          bestDir = dir;
        }
      }
    }
    
    return bestDir;
  }
  
  /**
   * 为单个棋盘选择最佳移动（CPU）
   */
  private selectBestMoveCPU(board: bigint): number {
    if (!this.cpuReferenceNetwork) return 0;
    
    const game = new Game();
    game.board = board;
    
    let bestDir = 0;
    let bestValue = -Infinity;
    
    for (let dir = 0; dir < 4; dir++) {
      const result = game.getAfterstate(dir as Direction);
      if (result !== null) {
        const value = result.score + this.cpuReferenceNetwork.evaluate(result.board);
        if (value > bestValue) {
          bestValue = value;
          bestDir = dir;
        }
      }
    }
    
    return bestDir;
  }
  
  /**
   * 从检查点加载训练状态
   */
  private loadCheckpoint(): boolean {
    const checkpoint = this.checkpointManager.loadCheckpoint();
    
    if (!checkpoint) {
      return false;
    }
    
    // 恢复状态
    this.startEpisode = checkpoint.episode + 1;
    this.currentLearningRate = checkpoint.currentLearningRate;
    this.stats = checkpoint.stats as GPUTrainingStats;
    this.milestoneCount = checkpoint.milestoneCount;
    this.recentScores = checkpoint.recentScores;
    
    // 确保GPU特定统计字段存在
    if (this.stats.gpuUtilization === undefined) {
      this.stats.gpuUtilization = 0;
      this.stats.gpuMemoryUsed = 0;
      this.stats.speedupRatio = 0;
      this.stats.batchCompletedGames = 0;
      this.stats.validationPassed = 0;
      this.stats.validationFailed = 0;
    }
    
    return true;
  }
  
  /**
   * 保存检查点
   */
  private saveCheckpoint(): void {
    const checkpointConfig: GPUTrainingCheckpointConfig = {
      ...this.config,
      gpu: {
        enabled: this.config.gpu.enabled,
        batchSize: this.config.gpu.batchSize,
        deviceIndex: this.config.gpu.deviceIndex,
      },
    };
    
    this.checkpointManager.saveCheckpoint({
      config: checkpointConfig,
      episode: this.stats.episode,
      currentLearningRate: this.currentLearningRate,
      stats: this.stats,
      milestoneCount: this.milestoneCount,
      recentScores: this.recentScores,
    });
  }
  
  /**
   * 更新训练统计
   * 
   * Requirements: 6.1, 6.2
   */
  private updateStats(episode: number, result: BatchTrainingResult): void {
    this.stats.episode = episode;
    this.stats.totalScore += result.totalScore;
    this.stats.avgScore = this.stats.totalScore / episode;
    
    // 更新最大方块记录
    if (result.maxTile > this.stats.maxTile) {
      this.stats.maxTile = result.maxTile;
    }
    
    // 更新里程碑统计
    this.milestoneCount.tile2048 += result.reached2048;
    this.milestoneCount.tile4096 += result.reached4096;
    this.milestoneCount.tile8192 += result.reached8192;
    
    // 更新达成率
    this.stats.rate2048 = this.milestoneCount.tile2048 / episode;
    this.stats.rate4096 = this.milestoneCount.tile4096 / episode;
    this.stats.rate8192 = this.milestoneCount.tile8192 / episode;
    
    // 更新最近得分
    for (let i = 0; i < result.completedGames; i++) {
      const avgScore = result.totalScore / result.completedGames;
      this.recentScores.push(avgScore);
      if (this.recentScores.length > 1000) {
        this.recentScores.shift();
      }
    }
    
    // 计算最近平均得分
    if (this.recentScores.length > 0) {
      const recentSum = this.recentScores.reduce((a, b) => a + b, 0);
      this.stats.recentAvgScore = recentSum / this.recentScores.length;
    }
    
    // 更新时间统计
    const now = Date.now();
    this.stats.elapsedTime = (now - this.startTime) / 1000;
    this.stats.episodesPerSecond = episode / this.stats.elapsedTime;
    
    // 预计剩余时间
    const remainingEpisodes = this.config.episodes - episode;
    this.stats.estimatedRemaining = remainingEpisodes / this.stats.episodesPerSecond;
    
    // GPU特定统计
    this.stats.batchCompletedGames += result.completedGames;
    
    // 从性能监控器获取实际的GPU统计
    const perfStats = this.performanceMonitor.getPerformanceStats();
    const memoryInfo = this.performanceMonitor.getMemoryInfo();
    
    this.stats.gpuUtilization = perfStats.gpuUtilization;
    this.stats.gpuMemoryUsed = memoryInfo.usedMemory;
    this.stats.speedupRatio = perfStats.speedupRatio;
  }
  
  /**
   * 更新内存使用估计
   * 
   * Requirements: 6.1
   */
  private updateMemoryEstimate(): void {
    const batchSize = this.config.gpu.batchSize;
    
    // 估算各部分内存使用
    // 棋盘状态: batchSize * 16 * 4 bytes (Float32)
    const boardStateMemory = batchSize * 16 * 4;
    
    // 分数/移动/状态: batchSize * 12 bytes
    const gameStateMemory = batchSize * 12;
    
    // 权重缓冲区: 约 10MB（取决于元组模式）
    const weightsMemory = 10 * 1024 * 1024;
    
    // 梯度缓冲区: 约 10MB
    const gradientsMemory = 10 * 1024 * 1024;
    
    this.performanceMonitor.updateMemoryEstimate({
      weightsMemory,
      gradientsMemory,
      boardStateMemory: boardStateMemory + gameStateMemory,
      otherMemory: 1024 * 1024, // 1MB for other buffers
    });
  }
  
  /**
   * 输出训练头部信息
   */
  private printTrainingHeader(): void {
    const deviceInfo = this.engine.getDeviceInfo();
    
    console.log('='.repeat(60));
    console.log('GPU N-Tuple Network Training');
    console.log('='.repeat(60));
    console.log(`Device: ${deviceInfo?.name || 'Unknown'}`);
    console.log(`Mode: ${deviceInfo?.isGPU ? 'GPU' : 'CPU'}`);
    console.log(`Batch Size: ${this.config.gpu.batchSize}`);
    console.log(`Episodes: ${this.config.episodes}`);
    console.log(`Learning Rate: ${this.config.learningRate}`);
    console.log(`Decay: ${this.config.enableDecay ? `enabled (rate=${this.config.decayRate}, interval=${this.config.decayInterval})` : 'disabled'}`);
    console.log(`Gradient Accumulation: ${this.config.gradientAccumulationSteps} steps`);
    console.log(`Validation Interval: ${this.config.validationInterval} episodes`);
    console.log(`Output: ${this.config.outputPath}`);
    console.log(`Checkpoint: ${this.config.checkpointPath}`);
    if (this.startEpisode > 1) {
      console.log(`Resuming from episode: ${this.startEpisode}`);
    }
    console.log('='.repeat(60));
    console.log('');
  }
  
  /**
   * 输出进度报告
   * 
   * 包含GPU性能信息和降级警告。
   * 
   * Requirements: 6.4, 6.5
   */
  private reportProgress(): void {
    const { stats } = this;
    const progress = (stats.episode / this.config.episodes * 100).toFixed(1);
    
    const formatTime = (seconds: number): string => {
      if (seconds < 60) return `${seconds.toFixed(0)}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
      return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
    };
    
    const barWidth = 20;
    const filled = Math.round(stats.episode / this.config.episodes * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    
    const line = `[${bar}] ${progress.padStart(5)}% | ` +
      `Ep: ${stats.episode.toString().padStart(6)}/${this.config.episodes} | ` +
      `Score: ${stats.recentAvgScore.toFixed(0).padStart(6)} | ` +
      `2048: ${(stats.rate2048 * 100).toFixed(1).padStart(5)}% | ` +
      `Speed: ${stats.episodesPerSecond.toFixed(0).padStart(4)} ep/s | ` +
      `ETA: ${formatTime(stats.estimatedRemaining).padStart(8)}`;
    
    process.stdout.write('\r' + line);
    
    if (stats.episode % 1000 === 0 || stats.episode === this.config.episodes) {
      console.log('');
      
      // 获取GPU性能信息
      const memoryInfo = this.performanceMonitor.getMemoryInfo();
      const activeWarnings = this.performanceMonitor.getActiveWarnings();
      
      // 输出详细GPU信息
      let detailLine = `  Max: ${stats.maxTile} | 4096: ${(stats.rate4096 * 100).toFixed(1)}% | 8192: ${(stats.rate8192 * 100).toFixed(1)}% | `;
      detailLine += `LR: ${this.currentLearningRate.toExponential(2)} | `;
      detailLine += `GPU: ${(stats.gpuUtilization * 100).toFixed(0)}% | `;
      detailLine += `Mem: ${(memoryInfo.usageRatio * 100).toFixed(0)}% | `;
      detailLine += `Speedup: ~${stats.speedupRatio.toFixed(1)}x`;
      
      console.log(detailLine);
      
      // 输出性能警告
      const highWarnings = activeWarnings.filter(w => w.severity === 'high');
      if (highWarnings.length > 0) {
        console.log(`  ⚠️  Performance warnings (${highWarnings.length}):`);
        for (const warning of highWarnings.slice(0, 3)) {
          console.log(`      - ${warning.message}`);
        }
      }
    }
  }
  
  /**
   * 输出训练完成信息
   * 
   * @param performanceReport 性能报告（可选）
   * 
   * Requirements: 6.4
   */
  private printTrainingComplete(performanceReport?: import('./performance-monitor').PerformanceReport): void {
    console.log('');
    console.log('='.repeat(60));
    console.log('GPU Training Complete!');
    console.log('='.repeat(60));
    this.reportProgress();
    console.log(`Validation: ${this.stats.validationPassed} passed, ${this.stats.validationFailed} failed`);
    
    // 输出性能报告
    if (performanceReport) {
      console.log('');
      console.log('Performance Summary:');
      console.log(`  Episodes/sec: ${performanceReport.stats.episodesPerSecond.toFixed(1)}`);
      console.log(`  Speedup ratio: ${performanceReport.stats.speedupRatio.toFixed(2)}x`);
      console.log(`  GPU utilization: ${(performanceReport.stats.gpuUtilization * 100).toFixed(1)}%`);
      console.log(`  Memory usage: ${(performanceReport.memoryInfo.usageRatio * 100).toFixed(1)}%`);
      
      // 输出内核执行时间摘要
      if (performanceReport.kernelTimings.length > 0) {
        const topKernels = performanceReport.kernelTimings
          .sort((a, b) => b.totalTime - a.totalTime)
          .slice(0, 3);
        console.log('  Top kernels by time:');
        for (const kernel of topKernels) {
          console.log(`    ${kernel.name}: ${kernel.avgTime.toFixed(2)}ms avg (${kernel.executionCount} calls)`);
        }
      }
      
      // 输出警告摘要
      if (performanceReport.activeWarnings.length > 0) {
        console.log(`  Warnings: ${performanceReport.activeWarnings.length} active`);
      }
    }
  }
  
  /**
   * 保存权重到文件
   */
  private saveWeights(): void {
    const metadata = {
      trainedGames: this.stats.episode,
      avgScore: Math.round(this.stats.avgScore),
      maxTile: this.stats.maxTile,
      rate2048: Math.round(this.stats.rate2048 * 10000) / 10000,
      rate4096: Math.round(this.stats.rate4096 * 10000) / 10000,
      rate8192: Math.round(this.stats.rate8192 * 10000) / 10000,
      trainingTime: Math.round(this.stats.elapsedTime),
    };
    
    const success = saveGPUWeightsToFile(this.network, this.config.outputPath, metadata);
    
    if (success) {
      console.log(`Weights saved to: ${this.config.outputPath}`);
    } else {
      console.error('Failed to save weights');
    }
  }
  
  /**
   * 获取当前训练统计
   */
  getStats(): GPUTrainingStats {
    return { ...this.stats };
  }
  
  /**
   * 获取训练配置
   */
  getConfig(): GPUTrainingConfig {
    return { ...this.config };
  }
  
  /**
   * 获取当前学习率
   */
  getCurrentLearningRate(): number {
    return this.currentLearningRate;
  }
  
  /**
   * 手动触发验证
   */
  runValidation(): ValidationResult {
    return this.validateComputation();
  }
  
  /**
   * 获取性能监控器
   * 
   * @returns GPU性能监控器
   * 
   * Requirements: 6.4
   */
  getPerformanceMonitor(): GPUPerformanceMonitor {
    return this.performanceMonitor;
  }
  
  /**
   * 获取当前性能报告
   * 
   * @returns 性能报告
   * 
   * Requirements: 6.4
   */
  getPerformanceReport(): import('./performance-monitor').PerformanceReport {
    return this.performanceMonitor.generateReport();
  }
  
  /**
   * 打印性能报告
   * 
   * Requirements: 6.4
   */
  printPerformanceReport(): void {
    this.performanceMonitor.printReport();
  }
  
  /**
   * 释放资源
   */
  dispose(): void {
    this.batchState = null;
    this.prevValues = null;
    this.prevAfterstates = null;
    this.initialized = false;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建GPU训练器
 * 
 * @param engine GPU引擎
 * @param patterns 元组模式
 * @param config 训练配置
 * @returns GPU训练器
 */
export async function createGPUTrainer(
  engine: GPUEngine,
  patterns: Pattern[],
  config: Partial<GPUTrainingConfig> = {}
): Promise<GPUTrainer> {
  const batchSize = config.gpu?.batchSize ?? DEFAULT_GPU_TRAINING_CONFIG.gpu.batchSize;
  
  // 更新引擎批量大小
  engine.updateBatchSize(batchSize);
  
  // 创建模拟器
  const simulator = new BatchGameSimulator(engine, batchSize);
  simulator.initialize();
  
  // 创建GPU网络
  const network = new GPUNTupleNetwork(engine, patterns);
  network.initialize();
  
  // 创建训练器
  const trainer = new GPUTrainer(engine, simulator, network, config);
  trainer.initialize();
  
  return trainer;
}

/**
 * 从现有网络创建GPU训练器
 * 
 * @param engine GPU引擎
 * @param cpuNetwork CPU N-Tuple网络
 * @param config 训练配置
 * @returns GPU训练器
 */
export async function createGPUTrainerFromNetwork(
  engine: GPUEngine,
  cpuNetwork: NTupleNetwork,
  config: Partial<GPUTrainingConfig> = {}
): Promise<GPUTrainer> {
  const batchSize = config.gpu?.batchSize ?? DEFAULT_GPU_TRAINING_CONFIG.gpu.batchSize;
  
  // 更新引擎批量大小
  engine.updateBatchSize(batchSize);
  
  // 创建模拟器
  const simulator = new BatchGameSimulator(engine, batchSize);
  simulator.initialize();
  
  // 创建GPU网络并加载权重
  const network = new GPUNTupleNetwork(engine, cpuNetwork.getPatterns());
  network.initialize();
  network.loadFromNetwork(cpuNetwork);
  
  // 创建训练器
  const trainer = new GPUTrainer(engine, simulator, network, config);
  trainer.initialize();
  
  return trainer;
}
