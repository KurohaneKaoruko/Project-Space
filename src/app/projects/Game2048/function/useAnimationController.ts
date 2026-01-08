/**
 * 动画控制器Hook
 * 
 * 管理2048游戏的动画状态和时序，包括：
 * - 动画状态管理（idle, moving, merging, spawning）
 * - 移动队列逻辑（动画期间的移动请求排队）
 * - reduced motion 检测（无障碍支持）
 * 
 * @see Requirements 3.1, 3.5, 4.1, 4.2
 * @see Design: useAnimationController Hook
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AnimationState, AnimationPhase, Direction, AnimatedTile } from '../types';
import { clampDuration, DEFAULT_ANIMATION_DURATION } from './animationUtils';

/**
 * 动画控制器配置选项
 */
export interface AnimationControllerOptions {
  /** 动画持续时间(ms)，默认150ms */
  duration?: number;
  /** 动画完成回调 */
  onAnimationComplete?: () => void;
}

/**
 * 动画控制器Hook返回值
 */
export interface AnimationControllerReturn {
  /** 当前动画状态 */
  animationState: AnimationState;
  /** 开始移动动画 */
  startMoveAnimation: (tiles: AnimatedTile[]) => void;
  /** 动画完成回调 */
  completeAnimation: () => void;
  /** 是否应该跳过动画（reduced motion） */
  shouldReduceMotion: boolean;
  /** 添加移动到队列 */
  queueMove: (direction: Direction) => void;
  /** 获取并移除队列中的下一个移动 */
  dequeueMove: () => Direction | undefined;
  /** 检查是否有待处理的移动 */
  hasPendingMoves: () => boolean;
}

/**
 * 创建初始动画状态
 */
function createInitialAnimationState(duration: number): AnimationState {
  return {
    isAnimating: false,
    phase: 'idle',
    pendingMoves: [],
    duration: clampDuration(duration),
  };
}

/**
 * 动画控制器Hook
 * 
 * 管理动画状态和时序，协调移动、合并、生成动画。
 * 
 * @param options 配置选项
 * @returns 动画控制器接口
 * 
 * @example
 * const {
 *   animationState,
 *   startMoveAnimation,
 *   completeAnimation,
 *   shouldReduceMotion,
 *   queueMove,
 * } = useAnimationController({
 *   duration: 150,
 *   onAnimationComplete: () => console.log('Animation done'),
 * });
 * 
 * @see Requirements 3.1, 3.5, 4.1, 4.2
 * @see Design Property 4: Animation Blocking
 */
export function useAnimationController(
  options: AnimationControllerOptions = {}
): AnimationControllerReturn {
  const {
    duration = DEFAULT_ANIMATION_DURATION,
    onAnimationComplete,
  } = options;

  // 动画状态
  const [animationState, setAnimationState] = useState<AnimationState>(() =>
    createInitialAnimationState(duration)
  );

  // reduced motion 偏好检测
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  // 动画超时引用（用于清理）
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 回调引用（避免闭包问题）
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  onAnimationCompleteRef.current = onAnimationComplete;

  /**
   * 检测 prefers-reduced-motion 媒体查询
   * @see Requirements 4.1, 4.2
   */
  useEffect(() => {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // 设置初始值
    setShouldReduceMotion(mediaQuery.matches);

    // 监听变化
    const handleChange = (event: MediaQueryListEvent) => {
      setShouldReduceMotion(event.matches);
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);

    // 清理
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  /**
   * 清理动画超时
   */
  const clearAnimationTimeout = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  /**
   * 开始移动动画
   * 
   * 将动画状态设置为 'moving' 阶段，并在指定时间后自动完成。
   * 如果启用了 reduced motion，则跳过动画直接完成。
   * 
   * @param tiles 带动画信息的方块列表
   * @see Requirements 3.1
   */
  const startMoveAnimation = useCallback((tiles: AnimatedTile[]) => {
    // 清理之前的超时
    clearAnimationTimeout();

    // 检查是否有方块需要移动
    const hasMovingTiles = tiles.some(
      tile => tile.previousRow !== undefined && tile.previousCol !== undefined &&
              (tile.previousRow !== tile.row || tile.previousCol !== tile.col)
    );

    if (!hasMovingTiles) {
      // 没有移动的方块，直接完成
      return;
    }

    // 如果启用了 reduced motion，跳过动画
    if (shouldReduceMotion) {
      // 直接调用完成回调
      onAnimationCompleteRef.current?.();
      return;
    }

    // 设置动画状态为 moving
    setAnimationState(prev => ({
      ...prev,
      isAnimating: true,
      phase: 'moving',
    }));

    // 设置动画完成超时
    const effectiveDuration = clampDuration(animationState.duration);
    animationTimeoutRef.current = setTimeout(() => {
      // 动画完成，进入下一阶段或回到 idle
      setAnimationState(prev => ({
        ...prev,
        isAnimating: false,
        phase: 'idle',
      }));

      // 调用完成回调
      onAnimationCompleteRef.current?.();
    }, effectiveDuration);
  }, [shouldReduceMotion, animationState.duration, clearAnimationTimeout]);

  /**
   * 手动完成动画
   * 
   * 立即结束当前动画并重置状态。
   */
  const completeAnimation = useCallback(() => {
    clearAnimationTimeout();

    setAnimationState(prev => ({
      ...prev,
      isAnimating: false,
      phase: 'idle',
    }));

    onAnimationCompleteRef.current?.();
  }, [clearAnimationTimeout]);

  /**
   * 添加移动到队列
   * 
   * 当动画正在进行时，将新的移动请求添加到队列中。
   * 队列最大长度为1，只保留最新的待执行移动。
   * 
   * @param direction 移动方向
   * @see Requirements 3.5
   * @see Design Property 4: Animation Blocking
   */
  const queueMove = useCallback((direction: Direction) => {
    setAnimationState(prev => ({
      ...prev,
      // 只保留最新的移动（队列最大长度为1）
      pendingMoves: [direction],
    }));
  }, []);

  /**
   * 获取并移除队列中的下一个移动
   * 
   * @returns 下一个待执行的移动方向，如果队列为空则返回 undefined
   */
  const dequeueMove = useCallback((): Direction | undefined => {
    let nextMove: Direction | undefined;

    setAnimationState(prev => {
      if (prev.pendingMoves.length === 0) {
        return prev;
      }

      nextMove = prev.pendingMoves[0];
      return {
        ...prev,
        pendingMoves: prev.pendingMoves.slice(1),
      };
    });

    return nextMove;
  }, []);

  /**
   * 检查是否有待处理的移动
   * 
   * @returns 如果队列中有待处理的移动则返回 true
   */
  const hasPendingMoves = useCallback((): boolean => {
    return animationState.pendingMoves.length > 0;
  }, [animationState.pendingMoves.length]);

  /**
   * 更新动画时长
   */
  useEffect(() => {
    setAnimationState(prev => ({
      ...prev,
      duration: clampDuration(duration),
    }));
  }, [duration]);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      clearAnimationTimeout();
    };
  }, [clearAnimationTimeout]);

  return {
    animationState,
    startMoveAnimation,
    completeAnimation,
    shouldReduceMotion,
    queueMove,
    dequeueMove,
    hasPendingMoves,
  };
}

export default useAnimationController;
