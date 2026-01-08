'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import GameTile from './GameTile';
import '../styles/GameBoard.scss';
import type { AnimatedTile } from '../types';
import { DEFAULT_ANIMATION_DURATION } from '../function/animationUtils';

/**
 * 根据棋盘大小获取格子间距
 */
function getCellGap(gridSize: number): number {
  if (gridSize >= 7) return 3;
  if (gridSize >= 6) return 4;
  return 6;
}

/**
 * GameBoard组件属性
 * 
 * Requirements: 2.1, 2.3, 4.2, 4.3, 4.4
 */
interface GameBoardProps {
  /** 棋盘数据（二维数组，用于兼容旧接口） */
  board: number[][];
  /** 带动画信息的方块列表（用于动画渲染） */
  tiles?: AnimatedTile[];
  /** 是否正在执行动画 */
  isAnimating?: boolean;
  /** 动画持续时间(ms) */
  animationDuration?: number;
  /** 动画完成回调 */
  onAnimationComplete?: () => void;
}

/**
 * 游戏棋盘组件
 * 
 * 支持两种渲染模式：
 * 1. 传统模式：使用 board 二维数组，通过 CSS Grid 布局
 * 2. 动画模式：使用 tiles 数组，通过绝对定位实现滑动动画
 * 
 * Requirements: 2.1, 2.3, 4.2, 4.3, 4.4
 */
export default function GameBoard({ 
  board, 
  tiles,
  isAnimating = false,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  onAnimationComplete
}: GameBoardProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // 棋盘尺寸状态（用于计算方块像素位置）
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  
  // 最小滑动距离
  const minSwipeDistance = 50;
  
  // 棋盘大小（格子数）
  const gridSize = board.length;
  
  // 根据棋盘大小获取间距
  const cellGap = getCellGap(gridSize);

  /**
   * 监听棋盘尺寸变化
   * 用于计算方块的绝对定位位置
   */
  useEffect(() => {
    const updateBoardSize = () => {
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        setBoardSize({ width: rect.width, height: rect.height });
      }
    };

    // 初始化尺寸
    updateBoardSize();

    // 监听窗口大小变化
    window.addEventListener('resize', updateBoardSize);
    
    // 使用 ResizeObserver 监听棋盘尺寸变化
    const resizeObserver = new ResizeObserver(updateBoardSize);
    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBoardSize);
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * 计算单个格子的像素大小
   * 
   * @see Requirements 2.1, 2.3
   */
  const cellSize = useMemo(() => {
    if (boardSize.width === 0) return 0;
    // 总宽度 = 格子数 * 格子大小 + (格子数 - 1) * 间距
    // 格子大小 = (总宽度 - (格子数 - 1) * 间距) / 格子数
    return (boardSize.width - (gridSize - 1) * cellGap) / gridSize;
  }, [boardSize.width, gridSize, cellGap]);

  /**
   * 计算方块的像素位置
   * 
   * @param row 行索引
   * @param col 列索引
   * @returns 像素位置 { left, top }
   * 
   * @see Requirements 2.1, 2.3
   */
  const calculateTilePosition = useCallback((row: number, col: number) => {
    const left = col * (cellSize + cellGap);
    const top = row * (cellSize + cellGap);
    return { left, top };
  }, [cellSize, cellGap]);

  /**
   * 使用useMemo缓存棋盘网格样式
   * 仅在棋盘大小变化时重新计算
   * 
   * Requirements: 4.3
   */
  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
    gridTemplateRows: `repeat(${gridSize}, 1fr)`,
  }), [gridSize]);

  /**
   * 渲染背景格子（空白占位格）
   * 这些格子始终显示，作为棋盘的背景
   */
  const backgroundCells = useMemo(() => {
    return Array.from({ length: gridSize * gridSize }, (_, index) => (
      <div 
        key={`bg-${index}`} 
        className="aspect-square rounded-md bg-gray-200"
      />
    ));
  }, [gridSize]);

  /**
   * 渲染带动画的方块（绝对定位模式）
   * 
   * @see Requirements 2.1, 2.3
   */
  const animatedTiles = useMemo(() => {
    if (!tiles || tiles.length === 0 || cellSize === 0) return null;

    return tiles
      .filter(tile => tile.value !== 0)
      .map(tile => {
        const position = calculateTilePosition(tile.row, tile.col);
        
        return (
          <div
            key={tile.id}
            className={`absolute ${isAnimating && tile.isMoving ? 'animating' : ''}`}
            style={{
              left: position.left,
              top: position.top,
              width: cellSize,
              height: cellSize,
              padding: 0,
              margin: 0,
            }}
          >
            <GameTile
              value={tile.value}
              isNew={tile.isNew}
              isMerged={tile.isMerged}
              tile={tile}
              cellSize={cellSize}
              gap={cellGap}
              animationDuration={animationDuration}
            />
          </div>
        );
      });
  }, [tiles, cellSize, calculateTilePosition, isAnimating, animationDuration, cellGap]);

  /**
   * 渲染传统模式的方块（CSS Grid模式）
   * 当没有提供 tiles 数组时使用此模式
   * 
   * Requirements: 4.2
   */
  const gridTiles = useMemo(() => {
    if (tiles && tiles.length > 0) return null;
    
    return board.map((row, i) =>
      row.map((value, j) => (
        <GameTile key={`${i}-${j}`} value={value} />
      ))
    );
  }, [board, tiles]);

  /**
   * 动画完成处理
   * 在动画结束后调用回调
   * 
   * @see Requirements 2.5
   */
  useEffect(() => {
    if (!isAnimating || !onAnimationComplete) return;

    const timer = setTimeout(() => {
      onAnimationComplete();
    }, animationDuration);

    return () => clearTimeout(timer);
  }, [isAnimating, animationDuration, onAnimationComplete]);

  /**
   * 使用useCallback缓存触摸开始事件处理函数
   * 
   * Requirements: 4.4
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 只在游戏棋盘内阻止默认行为
    if (e.target && boardRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      setTouchEnd(null);
      setTouchStart({
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY
      });
    }
  }, []);

  /**
   * 使用useCallback缓存触摸移动事件处理函数
   * 
   * Requirements: 4.4
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    // 只在游戏棋盘内阻止默认行为
    if (e.target && boardRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      setTouchEnd({
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY
      });
    }
  }, []);

  /**
   * 使用useCallback缓存触摸结束事件处理函数
   * 
   * Requirements: 4.4
   */
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // 只在游戏棋盘内阻止默认行为
    if (e.target && boardRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      if (!touchStart || !touchEnd) return;
      
      const distanceX = touchStart.x - touchEnd.x;
      const distanceY = touchStart.y - touchEnd.y;
      const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
      
      if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
        if (distanceX > 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        } else {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        }
      } else if (!isHorizontalSwipe && Math.abs(distanceY) > minSwipeDistance) {
        if (distanceY > 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        } else {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        }
      }
    }
  }, [touchStart, touchEnd, minSwipeDistance]);
  
  useEffect(() => {
    // 直接在文档级别监听触摸事件，但只对游戏棋盘内的事件进行处理
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  // 判断是否使用动画模式（绝对定位）
  const useAnimationMode = tiles && tiles.length > 0;
  
  return (
    <div 
      ref={boardRef}
      id="game-board" 
      className="bg-gray-100 rounded-lg p-2 aspect-square max-w-[80vh] mx-auto touch-none"
    >
      <div 
        ref={gridRef}
        className={`game-grid ${useAnimationMode ? 'relative' : ''}`}
        data-size={gridSize}
        style={gridStyle}
      >
        {/* 背景格子（动画模式下显示） */}
        {useAnimationMode && backgroundCells}
        
        {/* 传统模式：CSS Grid 渲染 */}
        {gridTiles}
        
        {/* 动画模式：绝对定位渲染 */}
        {animatedTiles}
      </div>
    </div>
  );
}
