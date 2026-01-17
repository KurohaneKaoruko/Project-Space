/**
 * AI控制器Hook
 * 
 * 管理AI运行状态和控制逻辑的React Hook。
 * 提供AI启动/停止、模式切换、速度调节等功能。
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5, 6.6
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getBestMove, type AIMode, resetNTupleNetwork, setNTupleNetwork } from './aiEngine';
import { createNTupleNetworkAsync } from './nTupleWeights';
import type { Direction } from '../types';

/** 移动速度类型 */
export type MoveSpeed = 'turbo' | 'fast' | 'normal' | 'slow';

/** 移动速度配置（毫秒） */
export const MOVE_SPEEDS: Record<MoveSpeed, number> = {
  turbo: 0,     // 极速模式，无延迟
  fast: 100,    // 100ms间隔
  normal: 300,  // 300ms间隔
  slow: 500,    // 500ms间隔
};

/** AI控制器配置选项 */
export interface AIControllerOptions {
  /** 当前棋盘状态 */
  board: number[][];
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 执行移动的回调（带动画） */
  onMove: (direction: Direction) => void;
  /** 直接执行移动的回调（跳过动画，供极速模式使用） */
  onMoveImmediate?: (direction: Direction) => void;
}

/** AI控制器返回值 */
export interface AIControllerReturn {
  /** AI是否正在运行 */
  isRunning: boolean;
  /** 当前AI模式 */
  currentMode: AIMode;
  /** 当前移动速度 */
  currentSpeed: MoveSpeed;
  /** N-Tuple权重是否正在加载 */
  isLoadingWeights: boolean;
  /** 权重加载错误信息 */
  weightLoadError: string | null;
  /** 启动AI */
  startAI: () => void;
  /** 停止AI */
  stopAI: () => void;
  /** 设置AI模式 */
  setMode: (mode: AIMode) => void;
  /** 设置移动速度 */
  setSpeed: (speed: MoveSpeed) => void;
}

/**
 * AI控制器Hook
 * 
 * 管理AI的运行状态，包括启动/停止、模式切换、速度调节。
 * 使用定时器定期调用AI引擎获取最佳移动并执行。
 * 
 * @param options AI控制器配置
 * @returns AI控制器接口
 * 
 * @example
 * ```tsx
 * const { isRunning, startAI, stopAI, setMode, setSpeed } = useAIController({
 *   board,
 *   gameOver,
 *   onMove: moveTiles,
 * });
 * ```
 */
export function useAIController(options: AIControllerOptions): AIControllerReturn {
  const { board, gameOver, onMove, onMoveImmediate } = options;

  // AI运行状态
  const [isRunning, setIsRunning] = useState(false);
  
  // 当前AI模式
  const [currentMode, setCurrentMode] = useState<AIMode>('balanced');
  
  // 当前移动速度
  const [currentSpeed, setCurrentSpeed] = useState<MoveSpeed>('normal');

  // N-Tuple权重加载状态
  const [isLoadingWeights, setIsLoadingWeights] = useState(false);
  const [weightLoadError, setWeightLoadError] = useState<string | null>(null);

  // 定时器引用
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // requestAnimationFrame引用（用于极速模式）
  const rafRef = useRef<number | null>(null);
  
  // 极速模式运行标志
  const turboRunningRef = useRef(false);
  
  // 使用ref存储最新的board和mode，避免闭包问题
  const boardRef = useRef(board);
  const modeRef = useRef(currentMode);
  const onMoveRef = useRef(onMove);
  const onMoveImmediateRef = useRef(onMoveImmediate);
  const speedRef = useRef(currentSpeed);
  const isRunningRef = useRef(false);

  // 更新refs
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    modeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onMoveImmediateRef.current = onMoveImmediate;
  }, [onMoveImmediate]);

  useEffect(() => {
    speedRef.current = currentSpeed;
  }, [currentSpeed]);

  /**
   * 清理定时器和requestAnimationFrame
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    turboRunningRef.current = false;
  }, []);

  /**
   * 执行单次AI移动
   * 极速模式使用 onMoveImmediate 跳过动画
   * @returns 是否成功执行了移动
   */
  const executeAIMove = useCallback(() => {
    const bestMove = getBestMove(boardRef.current, modeRef.current);
    if (bestMove) {
      // 极速模式使用 onMoveImmediate 跳过动画检查
      if (speedRef.current === 'turbo' && onMoveImmediateRef.current) {
        onMoveImmediateRef.current(bestMove);
      } else {
        onMoveRef.current(bestMove);
      }
      return true;
    }
    return false;
  }, []);

  /**
   * 极速模式循环
   * 使用 setTimeout(0) 让出控制权给浏览器，避免阻塞UI
   */
  const turboLoop = useCallback(() => {
    if (!turboRunningRef.current || !isRunningRef.current) {
      return;
    }
    
    executeAIMove();
    
    // 使用 setTimeout(0) 让出控制权，允许 React 更新状态和渲染
    timerRef.current = setTimeout(turboLoop, 0);
  }, [executeAIMove]);

  /**
   * 调度下一次AI移动
   * 极速模式使用 setTimeout(0) 实现最快速度同时不阻塞UI
   */
  const scheduleNextMove = useCallback(() => {
    clearTimer();
    const interval = MOVE_SPEEDS[speedRef.current];
    
    if (interval === 0) {
      // 极速模式：启动turbo循环
      turboRunningRef.current = true;
      timerRef.current = setTimeout(turboLoop, 0);
    } else {
      // 普通模式：使用setTimeout
      timerRef.current = setTimeout(() => {
        executeAIMove();
        // 递归调度下一次移动
        scheduleNextMove();
      }, interval);
    }
  }, [clearTimer, executeAIMove, turboLoop]);

  /**
   * 启动AI
   * Requirements: 6.1
   */
  const startAI = useCallback(() => {
    if (gameOver) return;
    
    setIsRunning(true);
    isRunningRef.current = true;
    // 立即执行第一次移动
    executeAIMove();
    // 调度后续移动
    scheduleNextMove();
  }, [gameOver, executeAIMove, scheduleNextMove]);

  /**
   * 停止AI
   * Requirements: 6.2
   */
  const stopAI = useCallback(() => {
    setIsRunning(false);
    isRunningRef.current = false;
    clearTimer();
  }, [clearTimer]);

  /**
   * 设置AI模式
   * 运行中切换模式不中断AI
   * 切换到ntuple模式时异步加载权重
   * Requirements: 5.4, 6.5
   */
  const setMode = useCallback(async (mode: AIMode) => {
    // 清除之前的错误
    setWeightLoadError(null);
    
    // 如果切换到ntuple模式，异步加载权重
    if (mode === 'ntuple') {
      setIsLoadingWeights(true);
      
      try {
        // 异步加载权重
        const network = await createNTupleNetworkAsync();
        setNTupleNetwork(network);
        setIsLoadingWeights(false);
        setCurrentMode(mode);
      } catch (error) {
        // 处理加载失败的情况
        const errorMessage = error instanceof Error ? error.message : '权重加载失败';
        console.error('Failed to load N-Tuple weights:', error);
        setWeightLoadError(errorMessage);
        setIsLoadingWeights(false);
        // 加载失败时不切换模式，保持当前模式
        return;
      }
    } else {
      setCurrentMode(mode);
    }
    // 模式切换不需要重启定时器，下次执行时会使用新模式
  }, []);

  /**
   * 设置移动速度
   * 运行中切换速度会在下一次移动时生效
   * Requirements: 6.6
   */
  const setSpeed = useCallback((speed: MoveSpeed) => {
    setCurrentSpeed(speed);
    // 如果AI正在运行，重新调度以应用新速度
    if (isRunning) {
      scheduleNextMove();
    }
  }, [isRunning, scheduleNextMove]);

  /**
   * 游戏结束时自动停止AI
   * Requirements: 6.3
   */
  useEffect(() => {
    if (gameOver && isRunning) {
      stopAI();
    }
  }, [gameOver, isRunning, stopAI]);

  /**
   * 组件卸载时清理定时器
   */
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isRunning,
    currentMode,
    currentSpeed,
    isLoadingWeights,
    weightLoadError,
    startAI,
    stopAI,
    setMode,
    setSpeed,
  };
}

export default useAIController;
