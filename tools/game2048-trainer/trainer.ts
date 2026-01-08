/**
 * 2048 N-Tuple Network Training - TD Learning Trainer
 * 
 * 实现TD(0) Learning算法的训练器，通过自我对弈来学习最优的权重参数。
 * 
 * TD Learning核心思想：
 * 1. AI使用当前权重进行游戏决策
 * 2. 每次移动后，根据实际获得的奖励和下一状态的预估价值来更新权重
 * 3. 通过大量游戏迭代，权重逐渐收敛到最优值
 * 
 * 更新公式：w += α × (reward + V(next_afterstate) - V(current_afterstate))
 */

import * as fs from 'fs';
import { Game, Board, Direction } from './game';
import { NTupleNetwork, WeightsConfig } from './network';

// ============================================
// 类型定义
// ============================================

/**
 * 训练配置
 */
export interface TrainingConfig {
  /** 训练轮数（游戏局数） */
  episodes: number;
  
  /** 学习率 (α) */
  learningRate: number;
  
  /** 是否启用学习率衰减 */
  enableDecay: boolean;
  
  /** 衰减率（每次衰减乘以此值） */
  decayRate: number;
  
  /** 衰减间隔（每多少局衰减一次） */
  decayInterval: number;
  
  /** 乐观初始值（0表示不使用） */
  optimisticInit: number;
  
  /** 进度报告间隔（每多少局报告一次） */
  reportInterval: number;
  
  /** 输出文件路径 */
  outputPath: string;
  
  /** 检查点保存间隔（每多少局保存一次，0表示不保存） */
  checkpointInterval: number;
  
  /** 检查点文件路径 */
  checkpointPath: string;
  
  /** 权重保存间隔（秒），0表示不定时保存 */
  weightsSaveInterval: number;
}

/**
 * 单局游戏结果
 */
interface EpisodeResult {
  /** 最终得分 */
  score: number;
  
  /** 最大方块值 */
  maxTile: number;
  
  /** 移动次数 */
  moves: number;
}

/**
 * 训练统计
 */
export interface TrainingStats {
  /** 当前训练轮数 */
  episode: number;
  
  /** 总得分 */
  totalScore: number;
  
  /** 平均得分 */
  avgScore: number;
  
  /** 最近N局平均得分 */
  recentAvgScore: number;
  
  /** 最大方块值 */
  maxTile: number;
  
  /** 达到2048的比例 */
  rate2048: number;
  
  /** 达到4096的比例 */
  rate4096: number;
  
  /** 达到8192的比例 */
  rate8192: number;
  
  /** 每秒训练局数 */
  episodesPerSecond: number;
  
  /** 已用时间（秒） */
  elapsedTime: number;
  
  /** 预计剩余时间（秒） */
  estimatedRemaining: number;
}

/**
 * 检查点数据（用于断点续训）
 */
export interface CheckpointData {
  /** 检查点版本 */
  version: number;
  
  /** 训练配置 */
  config: TrainingConfig;
  
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
  
  /** 权重数据 */
  weights: WeightsConfig;
  
  /** 保存时间戳 */
  timestamp: number;
}

/**
 * 默认训练配置
 */
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  episodes: 100000,
  learningRate: 0.0025,
  enableDecay: false,
  decayRate: 0.95,
  decayInterval: 10000,
  optimisticInit: 0,
  reportInterval: 100,  // 每100局报告一次，更频繁的反馈
  outputPath: 'weights.json',  // 保存到训练工具目录
  checkpointInterval: 1000,  // 每1000局保存检查点
  checkpointPath: 'checkpoint.json',  // 保存到训练工具目录
  weightsSaveInterval: 300,  // 每5分钟保存一次权重
};

// ============================================
// TD Learning 训练器
// ============================================

/**
 * TD Learning训练器
 * 
 * 使用TD(0)算法训练N-Tuple Network权重。
 * 训练过程中使用afterstate（移动后、添加随机方块前的状态）进行评估和更新。
 */
export class Trainer {
  /** N-Tuple Network */
  private network: NTupleNetwork;
  
  /** 训练配置 */
  private config: TrainingConfig;
  
  /** 训练统计 */
  private stats: TrainingStats;
  
  /** 最近N局的得分记录（用于计算滑动平均） */
  private recentScores: number[];
  
  /** 达到各个里程碑的局数统计 */
  private milestoneCount: { tile2048: number; tile4096: number; tile8192: number };
  
  /** 训练开始时间 */
  private startTime: number;
  
  /** 上次保存权重的时间 */
  private lastWeightsSaveTime: number;
  
  /** 当前学习率 */
  private currentLearningRate: number;
  
  /** 起始轮数（用于断点续训） */
  private startEpisode: number;
  
  /**
   * 构造函数
   * @param network N-Tuple Network实例
   * @param config 训练配置（可选，使用默认值）
   */
  constructor(network: NTupleNetwork, config: Partial<TrainingConfig> = {}) {
    this.network = network;
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
    this.currentLearningRate = this.config.learningRate;
    this.startEpisode = 1;
    
    // 初始化统计
    this.stats = {
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
    };
    
    this.recentScores = [];
    this.milestoneCount = { tile2048: 0, tile4096: 0, tile8192: 0 };
    this.startTime = 0;
    this.lastWeightsSaveTime = 0;
    
    // 如果配置了乐观初始化，应用它
    if (this.config.optimisticInit > 0) {
      this.network.initOptimistic(this.config.optimisticInit);
    }
  }
  
  /**
   * 从检查点恢复训练状态
   * @param checkpointPath 检查点文件路径
   * @returns 是否成功恢复
   */
  loadCheckpoint(checkpointPath?: string): boolean {
    const path = checkpointPath || this.config.checkpointPath;
    
    if (!fs.existsSync(path)) {
      return false;
    }
    
    try {
      const data = fs.readFileSync(path, 'utf-8');
      const checkpoint: CheckpointData = JSON.parse(data);
      
      // 验证版本
      if (checkpoint.version !== 1) {
        console.warn(`Checkpoint version mismatch: expected 1, got ${checkpoint.version}`);
        return false;
      }
      
      // 恢复状态
      this.startEpisode = checkpoint.episode + 1;
      this.currentLearningRate = checkpoint.currentLearningRate;
      this.stats = checkpoint.stats;
      this.milestoneCount = checkpoint.milestoneCount;
      this.recentScores = checkpoint.recentScores;
      
      // 恢复权重
      this.network.loadWeights(checkpoint.weights);
      
      console.log(`Checkpoint loaded from: ${path}`);
      console.log(`Resuming from episode ${this.startEpisode}`);
      
      return true;
    } catch (err) {
      console.error(`Failed to load checkpoint: ${(err as Error).message}`);
      return false;
    }
  }
  
  /**
   * 保存检查点
   */
  private saveCheckpoint(): void {
    const checkpoint: CheckpointData = {
      version: 1,
      config: this.config,
      episode: this.stats.episode,
      currentLearningRate: this.currentLearningRate,
      stats: { ...this.stats },
      milestoneCount: { ...this.milestoneCount },
      recentScores: [...this.recentScores],
      weights: this.network.exportWeights(),
      timestamp: Date.now(),
    };
    
    // 同步写入确保数据完整性
    fs.writeFileSync(this.config.checkpointPath, JSON.stringify(checkpoint));
  }

  /**
   * 定时保存权重文件
   * 
   * 将当前训练的权重保存到文件，文件名包含当前轮数以区分不同阶段的权重。
   * 使用流式写入避免大型JSON字符串超出内存限制。
   */
  private saveWeightsPeriodically(): void {
    const metadata: WeightsConfig['metadata'] = {
      trainedGames: this.stats.episode,
      avgScore: Math.round(this.stats.avgScore),
      maxTile: this.stats.maxTile,
      rate2048: Math.round(this.stats.rate2048 * 10000) / 10000,
      rate4096: Math.round(this.stats.rate4096 * 10000) / 10000,
      rate8192: Math.round(this.stats.rate8192 * 10000) / 10000,
      trainingTime: Math.round(this.stats.elapsedTime),
    };
    
    const weightsConfig = this.network.exportWeights(metadata);
    
    // 使用同步文件描述符进行流式写入，避免JSON.stringify超出字符串长度限制
    const fd = fs.openSync(this.config.outputPath, 'w');
    try {
      fs.writeSync(fd, '{\n');
      fs.writeSync(fd, `  "version": ${weightsConfig.version},\n`);
      fs.writeSync(fd, `  "patterns": ${JSON.stringify(weightsConfig.patterns)},\n`);
      
      if (weightsConfig.metadata) {
        fs.writeSync(fd, `  "metadata": ${JSON.stringify(weightsConfig.metadata)},\n`);
      }
      
      fs.writeSync(fd, '  "weights": [\n');
      for (let i = 0; i < weightsConfig.weights.length; i++) {
        const weightArray = weightsConfig.weights[i];
        fs.writeSync(fd, `    ${JSON.stringify(weightArray)}`);
        if (i < weightsConfig.weights.length - 1) {
          fs.writeSync(fd, ',');
        }
        fs.writeSync(fd, '\n');
      }
      fs.writeSync(fd, '  ]\n');
      fs.writeSync(fd, '}\n');
    } finally {
      fs.closeSync(fd);
    }
    
    console.log(`\n  [Weights saved: ${this.config.outputPath} @ episode ${this.stats.episode}]`);
  }

  
  /**
   * 开始训练
   * 
   * 执行指定轮数的训练，每轮进行一局完整的游戏。
   * 训练过程中会定期输出进度报告和保存检查点，训练完成后保存权重文件。
   * 
   * @param resume 是否尝试从检查点恢复
   */
  train(resume: boolean = false): void {
    // 尝试从检查点恢复
    if (resume) {
      this.loadCheckpoint();
    }
    
    console.log('='.repeat(60));
    console.log('N-Tuple Network Training');
    console.log('='.repeat(60));
    console.log(`Episodes: ${this.config.episodes}`);
    console.log(`Learning Rate: ${this.config.learningRate}`);
    console.log(`Decay: ${this.config.enableDecay ? `enabled (rate=${this.config.decayRate}, interval=${this.config.decayInterval})` : 'disabled'}`);
    console.log(`Optimistic Init: ${this.config.optimisticInit > 0 ? this.config.optimisticInit : 'disabled'}`);
    console.log(`Output: ${this.config.outputPath}`);
    console.log(`Checkpoint: ${this.config.checkpointPath} (every ${this.config.checkpointInterval} episodes)`);
    console.log(`Weights Save: every ${this.config.weightsSaveInterval} seconds`);
    if (this.startEpisode > 1) {
      console.log(`Resuming from episode: ${this.startEpisode}`);
    }
    console.log('='.repeat(60));
    console.log('');
    
    this.startTime = Date.now();
    this.lastWeightsSaveTime = this.startTime;
    let lastProgressTime = this.startTime;
    let lastCheckpointEpisode = this.startEpisode - 1;
    
    // 注册中断信号处理（Ctrl+C时保存检查点和权重）
    const handleInterrupt = () => {
      console.log('\n\nInterrupted! Saving checkpoint and weights...');
      this.saveCheckpoint();
      this.saveWeightsPeriodically();
      console.log(`Checkpoint and weights saved. Resume with --resume flag.`);
      process.exit(0);
    };
    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);
    
    // 训练开始前保存一次初始权重，确保即使训练极短时间也有权重可用
    console.log('Saving initial weights...');
    this.saveWeightsPeriodically();
    
    // 主训练循环
    for (let ep = this.startEpisode; ep <= this.config.episodes; ep++) {
      // 训练单局游戏
      const result = this.trainEpisode();
      
      // 更新统计
      this.updateStats(ep, result);
      
      // 学习率衰减
      if (this.config.enableDecay && ep % this.config.decayInterval === 0) {
        this.currentLearningRate *= this.config.decayRate;
      }
      
      // 进度报告（基于间隔或时间）
      const now = Date.now();
      const timeSinceLastProgress = now - lastProgressTime;
      
      // 每隔reportInterval局或每5秒报告一次（取先到者）
      if (ep % this.config.reportInterval === 0 || timeSinceLastProgress >= 5000) {
        this.reportProgress();
        lastProgressTime = now;
      }
      
      // 每10局输出一个简单的进度点（避免长时间无输出）
      else if (ep % 10 === 0 && ep < this.startEpisode + 100) {
        process.stdout.write('.');
      }
      
      // 保存检查点
      if (this.config.checkpointInterval > 0 && 
          ep - lastCheckpointEpisode >= this.config.checkpointInterval) {
        this.saveCheckpoint();
        lastCheckpointEpisode = ep;
      }
      
      // 定时保存权重
      if (this.config.weightsSaveInterval > 0) {
        const timeSinceLastSave = (now - this.lastWeightsSaveTime) / 1000;
        if (timeSinceLastSave >= this.config.weightsSaveInterval) {
          this.saveWeightsPeriodically();
          this.lastWeightsSaveTime = now;
        }
      }
    }
    
    // 移除中断处理
    process.removeListener('SIGINT', handleInterrupt);
    process.removeListener('SIGTERM', handleInterrupt);
    
    // 训练完成，输出最终统计
    console.log('');
    console.log('='.repeat(60));
    console.log('Training Complete!');
    console.log('='.repeat(60));
    this.reportProgress();
    
    // 保存权重
    this.saveWeights();
    
    // 删除检查点文件（训练完成后不再需要）
    if (fs.existsSync(this.config.checkpointPath)) {
      fs.unlinkSync(this.config.checkpointPath);
      console.log(`Checkpoint file removed.`);
    }
  }
  
  /**
   * 训练单局游戏
   * 
   * 使用TD(0)算法进行一局完整的游戏训练。
   * 
   * 算法流程：
   * 1. 初始化游戏
   * 2. 循环直到游戏结束：
   *    a. 选择最佳移动方向
   *    b. 执行移动，获取afterstate
   *    c. 如果有上一个afterstate，计算TD误差并更新权重
   *    d. 添加随机方块
   * 3. 游戏结束时，进行最终更新（V(terminal) = 0）
   * 
   * @returns 单局游戏结果
   */
  private trainEpisode(): EpisodeResult {
    const game = new Game();
    game.init();
    
    let moves = 0;
    let prevAfterstate: Board | null = null;
    let prevValue = 0;
    
    // 游戏主循环
    while (!game.isGameOver()) {
      // 选择最佳移动
      const bestMove = this.selectBestMove(game);
      
      if (bestMove === -1) {
        // 没有有效移动，游戏结束
        break;
      }
      
      // 获取afterstate（移动后、添加方块前）
      const afterstateResult = game.getAfterstate(bestMove);
      
      if (afterstateResult === null) {
        // 移动无效，尝试下一个方向
        continue;
      }
      
      const { board: afterstate, score: reward } = afterstateResult;
      const currentValue = this.network.evaluate(afterstate);
      
      // TD更新：如果有上一个afterstate，更新权重
      if (prevAfterstate !== null) {
        // TD误差 = reward + V(current_afterstate) - V(previous_afterstate)
        const tdError = reward + currentValue - prevValue;
        
        // 更新权重：w += α × TD误差
        this.network.updateWeights(prevAfterstate, this.currentLearningRate * tdError);
      }
      
      // 执行移动
      game.move(bestMove);
      game.addRandomTile();
      
      // 保存当前afterstate用于下一次更新
      prevAfterstate = afterstate;
      prevValue = currentValue;
      moves++;
    }
    
    // 游戏结束时的最终更新
    // V(terminal) = 0，所以TD误差 = 0 - V(last_afterstate)
    if (prevAfterstate !== null) {
      const finalTdError = 0 - prevValue;
      this.network.updateWeights(prevAfterstate, this.currentLearningRate * finalTdError);
    }
    
    return {
      score: game.score,
      maxTile: game.getMaxTile(),
      moves,
    };
  }
  
  /**
   * 选择最佳移动方向
   * 
   * 评估所有有效移动的afterstate，选择评估值最高的方向。
   * 评估值 = 移动得分 + V(afterstate)
   * 
   * @param game 当前游戏状态
   * @returns 最佳移动方向（0-3），如果没有有效移动返回-1
   */
  private selectBestMove(game: Game): Direction | -1 {
    let bestDir: Direction | -1 = -1;
    let bestValue = -Infinity;
    
    // 尝试所有4个方向
    for (let dir = 0; dir < 4; dir++) {
      const result = game.getAfterstate(dir as Direction);
      
      if (result !== null) {
        // 评估值 = 移动得分 + afterstate价值
        const value = result.score + this.network.evaluate(result.board);
        
        if (value > bestValue) {
          bestValue = value;
          bestDir = dir as Direction;
        }
      }
    }
    
    return bestDir;
  }

  
  /**
   * 获取当前学习率
   * 
   * 如果启用了学习率衰减，返回衰减后的学习率；
   * 否则返回初始学习率。
   * 
   * @returns 当前学习率
   */
  getCurrentLearningRate(): number {
    return this.currentLearningRate;
  }
  
  /**
   * 更新训练统计
   * 
   * @param episode 当前轮数
   * @param result 单局游戏结果
   */
  private updateStats(episode: number, result: EpisodeResult): void {
    this.stats.episode = episode;
    this.stats.totalScore += result.score;
    this.stats.avgScore = this.stats.totalScore / episode;
    
    // 更新最大方块记录
    if (result.maxTile > this.stats.maxTile) {
      this.stats.maxTile = result.maxTile;
    }
    
    // 更新里程碑统计
    if (result.maxTile >= 2048) this.milestoneCount.tile2048++;
    if (result.maxTile >= 4096) this.milestoneCount.tile4096++;
    if (result.maxTile >= 8192) this.milestoneCount.tile8192++;
    
    // 更新达成率
    this.stats.rate2048 = this.milestoneCount.tile2048 / episode;
    this.stats.rate4096 = this.milestoneCount.tile4096 / episode;
    this.stats.rate8192 = this.milestoneCount.tile8192 / episode;
    
    // 更新最近得分（保留最近1000局）
    this.recentScores.push(result.score);
    if (this.recentScores.length > 1000) {
      this.recentScores.shift();
    }
    
    // 计算最近平均得分
    const recentSum = this.recentScores.reduce((a, b) => a + b, 0);
    this.stats.recentAvgScore = recentSum / this.recentScores.length;
    
    // 更新时间统计
    const now = Date.now();
    this.stats.elapsedTime = (now - this.startTime) / 1000;
    
    // 计算本次训练的轮数（考虑断点续训的情况）
    const episodesThisRun = episode - this.startEpisode + 1;
    this.stats.episodesPerSecond = episodesThisRun / this.stats.elapsedTime;
    
    // 预计剩余时间
    const remainingEpisodes = this.config.episodes - episode;
    this.stats.estimatedRemaining = remainingEpisodes / this.stats.episodesPerSecond;
  }
  
  /**
   * 输出进度报告
   * 
   * 显示当前训练进度、统计信息和预计剩余时间。
   * 使用单行格式，便于快速浏览。
   */
  private reportProgress(): void {
    const { stats } = this;
    const progress = (stats.episode / this.config.episodes * 100).toFixed(1);
    
    // 格式化时间
    const formatTime = (seconds: number): string => {
      if (seconds < 60) return `${seconds.toFixed(0)}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
      return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
    };
    
    // 创建进度条
    const barWidth = 20;
    const filled = Math.round(stats.episode / this.config.episodes * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    
    // 单行紧凑格式
    const line = `[${bar}] ${progress.padStart(5)}% | ` +
      `Ep: ${stats.episode.toString().padStart(6)}/${this.config.episodes} | ` +
      `Score: ${stats.recentAvgScore.toFixed(0).padStart(6)} | ` +
      `2048: ${(stats.rate2048 * 100).toFixed(1).padStart(5)}% | ` +
      `Speed: ${stats.episodesPerSecond.toFixed(0).padStart(4)} ep/s | ` +
      `ETA: ${formatTime(stats.estimatedRemaining).padStart(8)}`;
    
    // 使用回车覆盖当前行（在终端中实现动态更新效果）
    process.stdout.write('\r' + line);
    
    // 每1000局或训练结束时换行并显示详细信息
    if (stats.episode % 1000 === 0 || stats.episode === this.config.episodes) {
      console.log(''); // 换行
      console.log(`  Max: ${stats.maxTile} | 4096: ${(stats.rate4096 * 100).toFixed(1)}% | 8192: ${(stats.rate8192 * 100).toFixed(1)}% | LR: ${this.currentLearningRate.toExponential(2)}`);
    }
  }
  
  /**
   * 保存权重到文件
   * 
   * 将训练好的权重导出为JSON格式，包含训练元数据。
   * 使用流式写入处理大型权重文件。
   */
  private saveWeights(): void {
    const metadata: WeightsConfig['metadata'] = {
      trainedGames: this.stats.episode,
      avgScore: Math.round(this.stats.avgScore),
      maxTile: this.stats.maxTile,
      rate2048: Math.round(this.stats.rate2048 * 10000) / 10000,
      rate4096: Math.round(this.stats.rate4096 * 10000) / 10000,
      rate8192: Math.round(this.stats.rate8192 * 10000) / 10000,
      trainingTime: Math.round(this.stats.elapsedTime),
    };
    
    const weightsConfig = this.network.exportWeights(metadata);
    
    // 使用流式写入处理大型权重文件
    const stream = fs.createWriteStream(this.config.outputPath, { encoding: 'utf-8' });
    
    // 写入开头
    stream.write('{\n');
    stream.write(`  "version": ${weightsConfig.version},\n`);
    stream.write(`  "patterns": ${JSON.stringify(weightsConfig.patterns)},\n`);
    
    // 写入元数据
    if (weightsConfig.metadata) {
      stream.write(`  "metadata": ${JSON.stringify(weightsConfig.metadata)},\n`);
    }
    
    // 流式写入权重数组
    stream.write('  "weights": [\n');
    for (let i = 0; i < weightsConfig.weights.length; i++) {
      const weightArray = weightsConfig.weights[i];
      // 将权重数组转换为JSON字符串（不带缩进以节省空间）
      stream.write(`    ${JSON.stringify(weightArray)}`);
      if (i < weightsConfig.weights.length - 1) {
        stream.write(',');
      }
      stream.write('\n');
    }
    stream.write('  ]\n');
    stream.write('}\n');
    
    stream.end();
    
    // 等待写入完成
    stream.on('finish', () => {
      const stats = fs.statSync(this.config.outputPath);
      console.log(`Weights saved to: ${this.config.outputPath}`);
      console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });
    
    stream.on('error', (err) => {
      console.error(`Error saving weights: ${err.message}`);
    });
  }
  
  /**
   * 获取当前训练统计
   * @returns 训练统计对象
   */
  getStats(): TrainingStats {
    return { ...this.stats };
  }
  
  /**
   * 获取训练配置
   * @returns 训练配置对象
   */
  getConfig(): TrainingConfig {
    return { ...this.config };
  }
}
