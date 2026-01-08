/**
 * 2048游戏主Hook
 * 
 * 整合游戏引擎、历史管理、状态持久化和动画控制功能。
 * 提供完整的游戏状态管理和用户交互接口。
 * 
 * Requirements: 1.4, 3.1, 3.2, 3.3, 3.5, 6.1, 6.2
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 导入游戏引擎模块
import { 
  createInitialState, 
  move as engineMove, 
  boardToTiles 
} from './gameEngine';

// 导入历史管理Hook
import { useGameHistory } from './useGameHistory';

// 导入动画控制器Hook
import { useAnimationController } from './useAnimationController';

// 导入状态持久化模块
import { saveGameState, loadGameState, clearGameState } from './gameStorage';

// 导入本地数据工具
import { getValidSize, getGameSize, saveGameSize, getHighScore, saveHighScore } from './localData';

// 导入动画工具
import { DEFAULT_ANIMATION_DURATION } from './animationUtils';

// 导入类型
import type { Direction, GameState, HistoryEntry, AnimatedTile, AnimationState } from '../types';

/** useGame2048 Hook返回值类型 */
interface UseGame2048Return {
  /** 当前棋盘状态 */
  board: number[][];
  /** 带动画信息的方块列表 */
  tiles: AnimatedTile[];
  /** 当前分数 */
  score: number;
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 棋盘大小 */
  size: number;
  /** 历史最高分 */
  highScore: number;
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 动画状态 */
  animationState: AnimationState;
  /** 动画持续时间 */
  animationDuration: number;
  /** 切换游戏大小 */
  onSizeChange: (size: number) => void;
  /** 重新开始游戏 */
  onRestart: () => void;
  /** 撤销上一步操作 */
  onUndo: () => void;
  /** 执行移动操作 */
  moveTiles: (direction: Direction) => void;
  /** 直接执行移动（跳过动画检查，供AI极速模式使用） */
  moveImmediate: (direction: Direction) => void;
}

/**
 * 2048游戏主Hook
 * 
 * 提供完整的游戏状态管理，包括：
 * - 游戏初始化和重置
 * - 移动操作处理
 * - 撤销功能
 * - 状态持久化
 * - 键盘事件处理
 * - 动画控制和移动队列
 * 
 * @returns 游戏状态和操作接口
 */
export function useGame2048(): UseGame2048Return {
  // 游戏状态
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    tiles: [],
    score: 0,
    gameOver: false,
    size: 4,
    highScore: 0
  });

  // 历史管理Hook（用于撤销功能）
  const { canUndo, pushState, popState, clearHistory } = useGameHistory({ maxHistory: 5 });

  // 用于追踪是否已初始化
  const isInitialized = useRef(false);

  // 动画控制器Hook
  const {
    animationState,
    startMoveAnimation,
    queueMove,
    dequeueMove,
  } = useAnimationController({
    duration: DEFAULT_ANIMATION_DURATION,
  });

  /**
   * 初始化游戏
   * 尝试从localStorage恢复状态，如果失败则创建新游戏
   * 
   * Requirements: 6.2
   */
  const initGame = useCallback((size: number = 4, forceNew: boolean = false) => {
    try {
      const validSize = getValidSize(size);
      const highScore = getHighScore(validSize);

      // 尝试从localStorage恢复游戏状态（除非强制新游戏）
      if (!forceNew) {
        const savedState = loadGameState();
        if (savedState && savedState.size === validSize) {
          // 恢复保存的状态
          setGameState({
            ...savedState,
            highScore: Math.max(savedState.highScore, highScore),
          });
          
          return;
        }
      }

      // 创建新游戏状态
      const newState = createInitialState(validSize, highScore);

      // 清空历史记录（新游戏）
      clearHistory();

      // 清除旧的持久化状态
      if (forceNew) {
        clearGameState();
      }

      setGameState(newState);
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }, [clearHistory]);

  /**
   * 切换游戏大小
   * 
   * Requirements: 3.4
   */
  const onSizeChange = useCallback((size: number = 4) => {
    saveGameSize(size);
    clearHistory();
    clearGameState();
    initGame(size, true);
  }, [initGame, clearHistory]);

  /**
   * 重新开始游戏
   * 
   * Requirements: 3.4
   */
  const onRestart = useCallback(() => {
    const size = getGameSize();
    clearHistory();
    clearGameState();
    initGame(size, true);
  }, [initGame, clearHistory]);

  /**
   * 撤销上一步操作
   * 
   * Requirements: 3.2, 3.3
   */
  const onUndo = useCallback(() => {
    if (!canUndo) return;

    const previousEntry = popState();
    if (previousEntry) {
      // 恢复到上一个状态
      const restoredState: GameState = {
        board: previousEntry.board,
        tiles: boardToTiles(previousEntry.board),
        score: previousEntry.score,
        gameOver: false, // 撤销后游戏不应该结束
        size: gameState.size,
        highScore: gameState.highScore,
      };

      setGameState(restoredState);

      // 保存恢复后的状态
      saveGameState(restoredState);
    }
  }, [canUndo, popState, gameState.size, gameState.highScore]);

  /**
   * 内部移动执行函数
   * 实际执行移动逻辑，不检查动画状态
   * 
   * @param direction 移动方向
   * @param skipAnimation 是否跳过动画（极速模式使用）
   * @see Requirements 1.2, 1.4, 3.1
   */
  const executeMoveInternal = useCallback((direction: Direction, skipAnimation: boolean = false) => {
    if (gameState.gameOver) return;

    // 保存当前状态到历史（用于撤销）
    const currentEntry: HistoryEntry = {
      board: gameState.board.map(row => [...row]), // 深拷贝
      score: gameState.score,
    };

    // 使用游戏引擎执行移动
    const result = engineMove(gameState, direction);

    if (result.moved) {
      // 移动有效，保存当前状态到历史
      pushState(currentEntry);

      // 更新最高分
      const newHighScore = Math.max(result.state.highScore, gameState.highScore);
      if (newHighScore > gameState.highScore) {
        saveHighScore(gameState.size, newHighScore);
      }

      // 更新游戏状态
      const newState = {
        ...result.state,
        highScore: newHighScore,
      };
      setGameState(newState);

      // 启动移动动画（除非跳过）
      // @see Requirements 3.1
      if (!skipAnimation) {
        startMoveAnimation(result.state.tiles as AnimatedTile[]);
      }

      // 持久化新状态
      saveGameState(newState);
    }
  }, [gameState, pushState, startMoveAnimation]);

  /**
   * 执行移动操作
   * 如果动画正在进行，将移动加入队列
   * 
   * @see Requirements 1.2, 1.4, 3.1, 3.5
   */
  const moveTiles = useCallback((direction: Direction) => {
    if (gameState.gameOver) return;

    // 如果动画正在进行，将移动加入队列
    // @see Requirements 3.1, 3.5
    if (animationState.isAnimating) {
      queueMove(direction);
      return;
    }

    // 直接执行移动
    executeMoveInternal(direction);
  }, [gameState.gameOver, animationState.isAnimating, queueMove, executeMoveInternal]);

  /**
   * 直接执行移动（跳过动画检查）
   * 供AI极速模式使用，不会被动画阻塞
   * 
   * @param direction 移动方向
   */
  const moveImmediate = useCallback((direction: Direction) => {
    if (gameState.gameOver) return;
    executeMoveInternal(direction, true);
  }, [gameState.gameOver, executeMoveInternal]);

  /**
   * 键盘事件处理
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveTiles('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveTiles('down');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveTiles('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveTiles('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveTiles]);

  /**
   * 初始化游戏（仅在首次挂载时）
   */
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      const size = getGameSize();
      initGame(size);
    }
  }, [initGame]);

  /**
   * 动画完成后处理队列中的下一个移动
   * 
   * @see Requirements 3.2, 3.3, 3.5
   */
  useEffect(() => {
    // 当动画从进行中变为完成时，检查队列
    if (!animationState.isAnimating && animationState.pendingMoves.length > 0) {
      const nextMove = dequeueMove();
      if (nextMove) {
        // 延迟执行下一个移动，确保状态已更新
        const timer = setTimeout(() => {
          executeMoveInternal(nextMove);
        }, 10);
        return () => clearTimeout(timer);
      }
    }
  }, [animationState.isAnimating, animationState.pendingMoves.length, dequeueMove, executeMoveInternal]);

  return {
    board: gameState.board,
    tiles: gameState.tiles as AnimatedTile[],
    score: gameState.score,
    gameOver: gameState.gameOver,
    size: gameState.size,
    highScore: gameState.highScore,
    canUndo,
    animationState,
    animationDuration: animationState.duration,
    onSizeChange,
    onRestart,
    onUndo,
    moveTiles,
    moveImmediate,
  };
}

export default useGame2048;
