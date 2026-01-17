"use client";

import { memo, CSSProperties } from 'react';
import { AnimatedTile } from '../types';
import { calculateTransform } from '../function/animationUtils';

/**
 * GameTile组件属性
 * 
 * Requirements: 2.1, 2.4, 4.1
 */
interface TileProps {
  /** 方块数值 */
  value: number;
  /** 是否为新生成的方块 */
  isNew?: boolean;
  /** 是否为合并产生的方块 */
  isMerged?: boolean;
  /** 方块数据（用于动画计算） */
  tile?: AnimatedTile;
  /** 单个格子的像素大小 */
  cellSize?: number;
  /** 格子间距 */
  gap?: number;
  /** 动画持续时间(ms) */
  animationDuration?: number;
}

/**
 * 游戏方块组件
 * 
 * 使用React.memo优化，仅在value、isNew、isMerged或动画相关属性变化时重渲染。
 * 支持移动动画：通过CSS transform实现从原位置到目标位置的滑动效果。
 * 
 * Requirements: 2.1, 2.4, 4.1
 */
function GameTileComponent({ 
  value, 
  isNew = false, 
  isMerged = false,
  tile,
  cellSize = 0,
  gap = 0,
  animationDuration = 150
}: TileProps) {
  /**
   * 计算移动动画的transform偏移量
   * 
   * 动画流程：
   * 1. 移动开始时：isMoving=true, previousRow/Col 有值
   *    - 应用初始 transform 偏移（从原位置开始）
   *    - 启用 will-change 优化 GPU 渲染
   * 2. 动画进行中：transform 过渡到 (0, 0)
   * 3. 动画完成后：isMoving=false, previousRow/Col 被清除
   *    - 重置 transform 为 none
   *    - 清理 will-change 释放 GPU 内存
   * 
   * @see Requirements 2.1, 2.5, 5.2, 5.5
   */
  const getTransformStyle = (): CSSProperties => {
    // 如果没有 tile 数据或没有前一个位置信息，返回清理后的状态
    if (!tile || tile.previousRow === undefined || tile.previousCol === undefined) {
      // 动画完成后的清理状态
      // @see Requirements 2.5, 5.5
      return {
        transform: 'none',
        transition: 'none',
        willChange: 'auto'
      };
    }
    
    const offset = calculateTransform(tile, cellSize, gap);
    
    // 如果方块正在移动，应用动画样式
    if (tile.isMoving) {
      // 动画开始：应用初始偏移，启用 GPU 加速
      // @see Requirements 5.1, 5.2
      return {
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: `transform ${animationDuration}ms ease-out`,
        willChange: 'transform'
      };
    }
    
    // 如果没有偏移且不在移动中，返回清理状态
    if (offset.x === 0 && offset.y === 0) {
      // 动画完成后的清理状态
      // @see Requirements 2.5, 5.5
      return {
        transform: 'none',
        transition: 'none',
        willChange: 'auto'
      };
    }
    
    // 有偏移但不在移动中（可能是动画刚结束的过渡状态）
    // 应用 transform 但不启用 will-change
    return {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      transition: `transform ${animationDuration}ms ease-out`,
      willChange: 'auto'
    };
  };
  // 获取格子背景色
  const getTileColor = (value: number) => {
    switch (value) {
      case 0:
        return "bg-gray-200 animate-pulse";
      // 基础色系
      case 2:
        return "bg-blue-100";
      case 4:
        return "bg-blue-200";
      case 8:
        return "bg-blue-400";
      case 16:
        return "bg-blue-800";
      // 中级数值 (新增过渡色)
      case 32:
        return "bg-purple-400";
      case 64:
        return "bg-purple-500";
      case 128:
        return "bg-orange-400";
      case 256:
        return "bg-red-400";
      case 512:
        return "bg-pink-500";
      // 高级数值 (高饱和色)
      case 1024:
        return "bg-[#00C853] text-white"; // 荧光绿
      case 2048:
        return "bg-[#FF6D00] text-white"; // 橙红色
      case 4096:
        return "bg-[#6200EA] text-white"; // 深紫色
      case 8192:
        return "bg-[#FFD600] text-white"; // 亮黄色
      // 超大数值 (金属渐变)
      case 16384:
        return "bg-gradient-to-br from-[#FFEB3B] to-[#FF9800] text-white"; // 黄金
      case 32768:
        return "bg-gradient-to-br from-[#E0E0E0] to-[#9E9E9E] text-white"; // 白银
      case 65536:
        return "bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] text-white animate-pulse"; // 熔岩橙
      // 百万级数值 (霓虹特效)
      case 131072:
        return "bg-gradient-to-br from-[#00F2FE] to-[#4FACFE] text-white animate-pulse"; // 霓虹蓝
      case 262144:
        return "bg-gradient-to-br from-[#FF61D2] to-[#FE9090] text-white animate-pulse"; // 霓虹粉
      case 524288:
        return "bg-gradient-to-br from-[#76FF03] to-[#C6FF00] text-white animate-pulse shadow-glow"; // 霓虹绿
      // 终极特效 (动态渐变)
      default:
        return value >= 1048576
          ? "bg-gradient-to-br from-[#FF1744] via-[#D500F9] to-[#3D5AFE] animate-gradient-x text-white animate-pulse shadow-glow" // 流动三色
          : "bg-[#212121] text-white";
    }
  };

  // 获取文本颜色
  const getTextColor = (value: number) => {
    if (value === 0) return "text-transparent";
    if (value <= 4) return "text-blue-900";
    if (value <= 512) return "text-white";
    return "";
  };

  // 获取文本大小，根据数字长度和棋盘大小调整
  const getTextSize = (value: number) => {
    if (value === 0) return "text-base sm:text-lg md:text-xl";
    if (value < 100) return "text-sm sm:text-base md:text-lg";
    if (value < 1000) return "text-xs sm:text-sm md:text-base";
    return "text-[10px] sm:text-xs md:text-sm";
  };

  // 添加阴影和凸起效果
  const getShadow = (value: number) => {
    if (value === 0) return "shadow-none";
    if (value <= 4) return "shadow-sm";
    if (value <= 16) return "shadow";
    if (value <= 64) return "shadow-md";
    if (value <= 256) return "shadow-lg";
    return "shadow-xl";
  };

  // 添加动画效果
  const getAnimation = (value: number, isNew: boolean, isMerged: boolean) => {
    if (value === 0) return "";
    if (isNew) return "animate-tile-new";
    if (isMerged) return "animate-tile-merged";
    return "animate-tile-appear";
  };

  // 获取移动动画的transform样式
  const transformStyle = getTransformStyle();

  return (
    <div
      className={`
        aspect-square rounded-md flex items-center justify-center font-bold
        ${getTileColor(value)}
        ${getTextColor(value)}
        ${getTextSize(value)}
        ${getShadow(value)}
        ${getAnimation(value, isNew, isMerged)}
        border border-gray-300
        w-full h-full
      `}
      style={transformStyle}
    >
      {value !== 0 && (
        <p className="absolute">
          {value >= 1048576 && !Number.isNaN(value) && Number.isFinite(value)
            ? `2^${Math.log2(value)}`
            : value ?? "NaN"}
        </p>
      )}
    </div>
  );
}

/**
 * 使用React.memo包装的GameTile组件
 * 
 * 自定义比较函数：仅在value、isNew、isMerged或动画相关属性变化时重渲染
 * 
 * Requirements: 2.1, 2.4, 4.1
 */
const GameTile = memo(GameTileComponent, (prevProps, nextProps) => {
  // 基础属性比较
  if (
    prevProps.value !== nextProps.value ||
    prevProps.isNew !== nextProps.isNew ||
    prevProps.isMerged !== nextProps.isMerged
  ) {
    return false;
  }
  
  // 动画相关属性比较
  if (
    prevProps.cellSize !== nextProps.cellSize ||
    prevProps.gap !== nextProps.gap ||
    prevProps.animationDuration !== nextProps.animationDuration
  ) {
    return false;
  }
  
  // tile对象比较（用于动画）
  const prevTile = prevProps.tile;
  const nextTile = nextProps.tile;
  
  if (prevTile === nextTile) {
    return true;
  }
  
  if (!prevTile || !nextTile) {
    return prevTile === nextTile;
  }
  
  // 比较tile的动画相关属性
  return (
    prevTile.row === nextTile.row &&
    prevTile.col === nextTile.col &&
    prevTile.previousRow === nextTile.previousRow &&
    prevTile.previousCol === nextTile.previousCol &&
    prevTile.isMoving === nextTile.isMoving
  );
});

// 设置displayName便于调试
GameTile.displayName = 'GameTile';

export default GameTile;
