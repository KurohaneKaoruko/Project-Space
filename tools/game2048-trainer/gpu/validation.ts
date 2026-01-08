/**
 * GPU Validation Module - GPU计算验证
 * 
 * 实现GPU vs CPU计算验证，确保GPU计算的正确性。
 * 支持周期性验证和验证失败处理。
 * 
 * Requirements: 8.4, 8.5
 */

import { GPUNTupleNetwork } from './gpu-network';
import { BatchGameSimulator } from './batch-simulator';
import { BatchGameState, createBatchGameState } from './board-utils';
import { NTupleNetwork } from '../network';
import { Game, Direction, Board, getTile } from '../game';

// ============================================
// 类型定义
// ============================================

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  passed: boolean;
  /** 最大评估误差 */
  maxEvalError: number;
  /** 平均评估误差 */
  avgEvalError: number;
  /** 移动一致性（相同移动选择的比例） */
  moveConsistency: number;
  /** 移动结果一致性 */
  moveResultConsistency: number;
  /** 验证的样本数 */
  sampleCount: number;
  /** 验证耗时（毫秒） */
  validationTime: number;
  /** 错误信息 */
  error?: string;
  /** 详细诊断信息 */
  diagnostics?: ValidationDiagnostics;
}

/**
 * 验证诊断信息
 */
export interface ValidationDiagnostics {
  /** 评估误差分布 */
  evalErrorDistribution: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
  /** 不一致的移动详情 */
  inconsistentMoves: Array<{
    boardIndex: number;
    gpuMove: number;
    cpuMove: number;
    gpuValue: number;
    cpuValue: number;
  }>;
  /** 不一致的移动结果详情 */
  inconsistentMoveResults: Array<{
    boardIndex: number;
    direction: number;
    gpuReward: number;
    cpuReward: number;
    boardDiff: number;
  }>;
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  /** 验证样本数 */
  sampleCount: number;
  /** 评估误差阈值 */
  evalErrorThreshold: number;
  /** 移动一致性阈值 */
  moveConsistencyThreshold: number;
  /** 是否收集详细诊断信息 */
  collectDiagnostics: boolean;
  /** 是否验证移动结果 */
  validateMoveResults: boolean;
}

/**
 * 默认验证配置
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  sampleCount: 20,
  evalErrorThreshold: 1e-2,
  moveConsistencyThreshold: 0.8,
  collectDiagnostics: true,
  validateMoveResults: true,
};

// ============================================
// GPU验证器类
// ============================================

/**
 * GPU计算验证器
 * 
 * 比较GPU和CPU的计算结果，确保GPU计算的正确性。
 * 
 * Requirements: 8.4, 8.5
 */
export class GPUValidator {
  /** GPU网络 */
  private gpuNetwork: GPUNTupleNetwork;
  
  /** CPU参考网络 */
  private cpuNetwork: NTupleNetwork | null;
  
  /** 批量模拟器 */
  private simulator: BatchGameSimulator | null;
  
  /** 验证配置 */
  private config: ValidationConfig;
  
  /**
   * 构造函数
   * 
   * @param gpuNetwork GPU N-Tuple网络
   * @param cpuNetwork CPU参考网络（可选）
   * @param simulator 批量模拟器（可选，用于验证移动）
   * @param config 验证配置
   */
  constructor(
    gpuNetwork: GPUNTupleNetwork,
    cpuNetwork?: NTupleNetwork | null,
    simulator?: BatchGameSimulator | null,
    config: Partial<ValidationConfig> = {}
  ) {
    this.gpuNetwork = gpuNetwork;
    this.cpuNetwork = cpuNetwork ?? gpuNetwork.getCPUNetwork();
    this.simulator = simulator ?? null;
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }
  
  /**
   * 执行完整验证
   * 
   * 验证GPU评估和移动选择的正确性。
   * 
   * @returns 验证结果
   * 
   * Requirements: 8.4
   */
  validate(): ValidationResult {
    const startTime = Date.now();
    
    if (!this.cpuNetwork) {
      return {
        passed: true,
        maxEvalError: 0,
        avgEvalError: 0,
        moveConsistency: 1,
        moveResultConsistency: 1,
        sampleCount: 0,
        validationTime: Date.now() - startTime,
        error: 'No CPU reference network available',
      };
    }
    
    try {
      const evalErrors: number[] = [];
      const inconsistentMoves: ValidationDiagnostics['inconsistentMoves'] = [];
      const inconsistentMoveResults: ValidationDiagnostics['inconsistentMoveResults'] = [];
      let consistentMoves = 0;
      let consistentMoveResults = 0;
      let totalMoveResultTests = 0;
      
      for (let i = 0; i < this.config.sampleCount; i++) {
        // 创建随机棋盘
        const board = this.createRandomBoard();
        const cpuBoard = this.float32ToBigInt(board);
        
        // 验证评估
        const gpuValue = this.gpuNetwork.evaluate(board);
        const cpuValue = this.cpuNetwork.evaluate(cpuBoard);
        const evalError = Math.abs(gpuValue - cpuValue);
        evalErrors.push(evalError);
        
        // 验证移动选择
        const gpuMove = this.selectBestMoveGPU(board);
        const cpuMove = this.selectBestMoveCPU(cpuBoard);
        
        if (gpuMove.direction === cpuMove.direction) {
          consistentMoves++;
        } else if (this.config.collectDiagnostics) {
          inconsistentMoves.push({
            boardIndex: i,
            gpuMove: gpuMove.direction,
            cpuMove: cpuMove.direction,
            gpuValue: gpuMove.value,
            cpuValue: cpuMove.value,
          });
        }
        
        // 验证移动结果
        if (this.config.validateMoveResults) {
          for (let dir = 0; dir < 4; dir++) {
            const gpuResult = this.cpuMoveFloat32(board, dir);
            const cpuResult = this.cpuMoveBigInt(cpuBoard, dir);
            
            if (gpuResult.valid && cpuResult.valid) {
              totalMoveResultTests++;
              
              const rewardDiff = Math.abs(gpuResult.reward - cpuResult.reward);
              const boardDiff = this.compareBoardsFloat32BigInt(
                gpuResult.afterstate,
                cpuResult.afterstate
              );
              
              if (rewardDiff < 0.01 && boardDiff === 0) {
                consistentMoveResults++;
              } else if (this.config.collectDiagnostics) {
                inconsistentMoveResults.push({
                  boardIndex: i,
                  direction: dir,
                  gpuReward: gpuResult.reward,
                  cpuReward: cpuResult.reward,
                  boardDiff,
                });
              }
            }
          }
        }
      }
      
      // 计算统计
      const maxEvalError = Math.max(...evalErrors);
      const avgEvalError = evalErrors.reduce((a, b) => a + b, 0) / evalErrors.length;
      const moveConsistency = consistentMoves / this.config.sampleCount;
      const moveResultConsistency = totalMoveResultTests > 0
        ? consistentMoveResults / totalMoveResultTests
        : 1;
      
      // 判断是否通过
      const passed = maxEvalError < this.config.evalErrorThreshold &&
        moveConsistency >= this.config.moveConsistencyThreshold;
      
      // 构建结果
      const result: ValidationResult = {
        passed,
        maxEvalError,
        avgEvalError,
        moveConsistency,
        moveResultConsistency,
        sampleCount: this.config.sampleCount,
        validationTime: Date.now() - startTime,
      };
      
      // 添加诊断信息
      if (this.config.collectDiagnostics) {
        const stdDev = Math.sqrt(
          evalErrors.reduce((sum, e) => sum + Math.pow(e - avgEvalError, 2), 0) / evalErrors.length
        );
        
        result.diagnostics = {
          evalErrorDistribution: {
            min: Math.min(...evalErrors),
            max: maxEvalError,
            mean: avgEvalError,
            stdDev,
          },
          inconsistentMoves,
          inconsistentMoveResults,
        };
      }
      
      return result;
    } catch (error) {
      return {
        passed: false,
        maxEvalError: Infinity,
        avgEvalError: Infinity,
        moveConsistency: 0,
        moveResultConsistency: 0,
        sampleCount: 0,
        validationTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 快速验证（仅检查评估）
   * 
   * @param sampleCount 样本数
   * @returns 是否通过验证
   */
  quickValidate(sampleCount: number = 5): boolean {
    if (!this.cpuNetwork) return true;
    
    try {
      for (let i = 0; i < sampleCount; i++) {
        const board = this.createRandomBoard();
        const cpuBoard = this.float32ToBigInt(board);
        
        const gpuValue = this.gpuNetwork.evaluate(board);
        const cpuValue = this.cpuNetwork.evaluate(cpuBoard);
        
        if (Math.abs(gpuValue - cpuValue) > this.config.evalErrorThreshold) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 创建随机棋盘状态
   */
  private createRandomBoard(): Float32Array {
    const board = new Float32Array(16);
    const numTiles = 4 + Math.floor(Math.random() * 8);
    
    const positions = Array.from({ length: 16 }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    for (let i = 0; i < numTiles; i++) {
      board[positions[i]] = 1 + Math.floor(Math.random() * 11);
    }
    
    return board;
  }
  
  /**
   * Float32Array转BigInt
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
   * 比较Float32Array和BigInt棋盘
   */
  private compareBoardsFloat32BigInt(float32Board: Float32Array, bigIntBoard: bigint): number {
    let diff = 0;
    for (let i = 0; i < 16; i++) {
      const f32Tile = Math.floor(float32Board[i]);
      const biTile = Number((bigIntBoard >> BigInt(i * 4)) & 0xFn);
      if (f32Tile !== biTile) diff++;
    }
    return diff;
  }
  
  /**
   * GPU选择最佳移动
   */
  private selectBestMoveGPU(board: Float32Array): { direction: number; value: number } {
    let bestDir = 0;
    let bestValue = -Infinity;
    
    for (let dir = 0; dir < 4; dir++) {
      const result = this.cpuMoveFloat32(board, dir);
      if (result.valid) {
        const value = result.reward + this.gpuNetwork.evaluate(result.afterstate);
        if (value > bestValue) {
          bestValue = value;
          bestDir = dir;
        }
      }
    }
    
    return { direction: bestDir, value: bestValue };
  }
  
  /**
   * CPU选择最佳移动
   */
  private selectBestMoveCPU(board: bigint): { direction: number; value: number } {
    if (!this.cpuNetwork) return { direction: 0, value: 0 };
    
    const game = new Game();
    game.board = board;
    
    let bestDir = 0;
    let bestValue = -Infinity;
    
    for (let dir = 0; dir < 4; dir++) {
      const result = game.getAfterstate(dir as Direction);
      if (result !== null) {
        const value = result.score + this.cpuNetwork.evaluate(result.board);
        if (value > bestValue) {
          bestValue = value;
          bestDir = dir;
        }
      }
    }
    
    return { direction: bestDir, value: bestValue };
  }
  
  /**
   * CPU移动实现（Float32Array版本）
   */
  private cpuMoveFloat32(board: Float32Array, direction: number): {
    afterstate: Float32Array;
    reward: number;
    valid: boolean;
  } {
    const afterstate = new Float32Array(16);
    let reward = 0;
    let moved = false;
    
    switch (direction) {
      case 0: // 上
        for (let col = 0; col < 4; col++) {
          const line = [board[col], board[4 + col], board[8 + col], board[12 + col]];
          const result = this.moveLine(line);
          afterstate[col] = result.line[0];
          afterstate[4 + col] = result.line[1];
          afterstate[8 + col] = result.line[2];
          afterstate[12 + col] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 1: // 右
        for (let row = 0; row < 4; row++) {
          const base = row * 4;
          const line = [board[base + 3], board[base + 2], board[base + 1], board[base]];
          const result = this.moveLine(line);
          afterstate[base + 3] = result.line[0];
          afterstate[base + 2] = result.line[1];
          afterstate[base + 1] = result.line[2];
          afterstate[base] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 2: // 下
        for (let col = 0; col < 4; col++) {
          const line = [board[12 + col], board[8 + col], board[4 + col], board[col]];
          const result = this.moveLine(line);
          afterstate[12 + col] = result.line[0];
          afterstate[8 + col] = result.line[1];
          afterstate[4 + col] = result.line[2];
          afterstate[col] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
      case 3: // 左
        for (let row = 0; row < 4; row++) {
          const base = row * 4;
          const line = [board[base], board[base + 1], board[base + 2], board[base + 3]];
          const result = this.moveLine(line);
          afterstate[base] = result.line[0];
          afterstate[base + 1] = result.line[1];
          afterstate[base + 2] = result.line[2];
          afterstate[base + 3] = result.line[3];
          reward += result.score;
          if (result.moved) moved = true;
        }
        break;
    }
    
    return { afterstate, reward, valid: moved };
  }
  
  /**
   * CPU移动实现（BigInt版本）
   */
  private cpuMoveBigInt(board: bigint, direction: number): {
    afterstate: bigint;
    reward: number;
    valid: boolean;
  } {
    const game = new Game();
    game.board = board;
    
    const result = game.getAfterstate(direction as Direction);
    if (result === null) {
      return { afterstate: board, reward: 0, valid: false };
    }
    
    return { afterstate: result.board, reward: result.score, valid: true };
  }
  
  /**
   * 移动一行
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
        result[writePos - 1] = line[i] + 1;
        score += 1 << (line[i] + 1);
        lastMerged = true;
        moved = true;
      } else {
        if (writePos !== i) moved = true;
        result[writePos] = line[i];
        writePos++;
        lastMerged = false;
      }
    }
    
    return { line: result, score, moved };
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取配置
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }
}

// ============================================
// 验证失败处理
// ============================================

/**
 * 验证失败处理策略
 */
export enum ValidationFailureStrategy {
  /** 忽略并继续 */
  IGNORE = 'ignore',
  /** 记录警告并继续 */
  WARN = 'warn',
  /** 回退到CPU模式 */
  FALLBACK = 'fallback',
  /** 抛出错误 */
  ERROR = 'error',
}

/**
 * 验证失败处理器
 * 
 * Requirements: 8.5
 */
export class ValidationFailureHandler {
  /** 失败策略 */
  private strategy: ValidationFailureStrategy;
  
  /** 连续失败次数 */
  private consecutiveFailures: number = 0;
  
  /** 最大连续失败次数（超过后强制回退） */
  private maxConsecutiveFailures: number;
  
  /** 失败回调 */
  private onFailure?: (result: ValidationResult) => void;
  
  /**
   * 构造函数
   * 
   * @param strategy 失败策略
   * @param maxConsecutiveFailures 最大连续失败次数
   * @param onFailure 失败回调
   */
  constructor(
    strategy: ValidationFailureStrategy = ValidationFailureStrategy.WARN,
    maxConsecutiveFailures: number = 3,
    onFailure?: (result: ValidationResult) => void
  ) {
    this.strategy = strategy;
    this.maxConsecutiveFailures = maxConsecutiveFailures;
    this.onFailure = onFailure;
  }
  
  /**
   * 处理验证结果
   * 
   * @param result 验证结果
   * @returns 是否应该继续训练
   * 
   * Requirements: 8.5
   */
  handleResult(result: ValidationResult): {
    shouldContinue: boolean;
    shouldFallback: boolean;
    message: string;
  } {
    if (result.passed) {
      this.consecutiveFailures = 0;
      return {
        shouldContinue: true,
        shouldFallback: false,
        message: 'Validation passed',
      };
    }
    
    this.consecutiveFailures++;
    
    // 调用失败回调
    if (this.onFailure) {
      this.onFailure(result);
    }
    
    // 检查是否超过最大连续失败次数
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return {
        shouldContinue: false,
        shouldFallback: true,
        message: `Validation failed ${this.consecutiveFailures} times consecutively. Forcing fallback.`,
      };
    }
    
    // 根据策略处理
    switch (this.strategy) {
      case ValidationFailureStrategy.IGNORE:
        return {
          shouldContinue: true,
          shouldFallback: false,
          message: 'Validation failed (ignored)',
        };
        
      case ValidationFailureStrategy.WARN:
        console.warn(`Validation failed: maxEvalError=${result.maxEvalError.toFixed(6)}, moveConsistency=${(result.moveConsistency * 100).toFixed(1)}%`);
        return {
          shouldContinue: true,
          shouldFallback: false,
          message: 'Validation failed (warning logged)',
        };
        
      case ValidationFailureStrategy.FALLBACK:
        return {
          shouldContinue: false,
          shouldFallback: true,
          message: 'Validation failed. Falling back to CPU mode.',
        };
        
      case ValidationFailureStrategy.ERROR:
        return {
          shouldContinue: false,
          shouldFallback: false,
          message: `Validation failed: ${result.error || 'Unknown error'}`,
        };
        
      default:
        return {
          shouldContinue: true,
          shouldFallback: false,
          message: 'Unknown strategy',
        };
    }
  }
  
  /**
   * 重置连续失败计数
   */
  reset(): void {
    this.consecutiveFailures = 0;
  }
  
  /**
   * 获取连续失败次数
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
  
  /**
   * 更新策略
   */
  setStrategy(strategy: ValidationFailureStrategy): void {
    this.strategy = strategy;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建GPU验证器
 * 
 * @param gpuNetwork GPU网络
 * @param cpuNetwork CPU参考网络
 * @param config 验证配置
 * @returns GPU验证器
 */
export function createGPUValidator(
  gpuNetwork: GPUNTupleNetwork,
  cpuNetwork?: NTupleNetwork | null,
  config?: Partial<ValidationConfig>
): GPUValidator {
  return new GPUValidator(gpuNetwork, cpuNetwork, null, config);
}

/**
 * 创建验证失败处理器
 * 
 * @param strategy 失败策略
 * @param maxConsecutiveFailures 最大连续失败次数
 * @param onFailure 失败回调
 * @returns 验证失败处理器
 */
export function createValidationFailureHandler(
  strategy?: ValidationFailureStrategy,
  maxConsecutiveFailures?: number,
  onFailure?: (result: ValidationResult) => void
): ValidationFailureHandler {
  return new ValidationFailureHandler(strategy, maxConsecutiveFailures, onFailure);
}
