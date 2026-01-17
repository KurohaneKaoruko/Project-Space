/**
 * 动画工具函数
 * 
 * 本文件包含2048游戏移动动画所需的工具函数。
 * 主要功能：
 * - 计算方块移动的CSS transform偏移量
 * - 约束动画时长在有效范围内
 */

import { AnimatedTile } from '../types';

/**
 * 动画时长的最小值(ms)
 * @see Requirements 4.4
 */
export const MIN_ANIMATION_DURATION = 50;

/**
 * 动画时长的最大值(ms)
 * @see Requirements 4.4
 */
export const MAX_ANIMATION_DURATION = 500;

/**
 * 默认动画时长(ms)
 */
export const DEFAULT_ANIMATION_DURATION = 150;

/**
 * Transform偏移量
 */
export interface TransformOffset {
  /** X轴偏移量(px) */
  x: number;
  /** Y轴偏移量(px) */
  y: number;
}

/**
 * 计算方块的CSS transform偏移量
 * 
 * 根据方块的当前位置和移动前位置，计算需要应用的CSS transform偏移量。
 * 这个偏移量用于实现方块从原位置滑动到目标位置的动画效果。
 * 
 * @param tile 方块数据，包含当前位置和移动前位置
 * @param cellSize 单个格子大小(px)
 * @param gap 格子间距(px)
 * @returns Transform偏移量 { x, y }，单位为像素
 * 
 * @example
 * // 方块从(0,0)移动到(0,2)，格子大小100px，间距10px
 * const tile = { row: 0, col: 2, previousRow: 0, previousCol: 0, ... };
 * const offset = calculateTransform(tile, 100, 10);
 * // offset = { x: -220, y: 0 } (向左偏移2格)
 * 
 * @see Requirements 1.4
 * @see Design Property 3: Transform Calculation Correctness
 */
export function calculateTransform(
  tile: AnimatedTile,
  cellSize: number,
  gap: number
): TransformOffset {
  // 如果没有前一个位置信息，返回零偏移
  if (tile.previousRow === undefined || tile.previousCol === undefined) {
    return { x: 0, y: 0 };
  }

  // 计算行列差值
  // deltaRow > 0 表示方块从下方移动过来
  // deltaCol > 0 表示方块从右方移动过来
  const deltaRow = tile.previousRow - tile.row;
  const deltaCol = tile.previousCol - tile.col;

  // 计算像素偏移量
  // 每移动一格，偏移量 = 格子大小 + 间距
  const stepSize = cellSize + gap;

  return {
    x: deltaCol * stepSize,
    y: deltaRow * stepSize
  };
}

/**
 * 约束动画时长在有效范围内
 * 
 * 确保动画时长在50ms到500ms之间（包含边界值）。
 * 如果传入的值超出范围，将被钳制到最近的边界值。
 * 
 * @param duration 期望的动画时长(ms)
 * @returns 约束后的动画时长(ms)，范围[50, 500]
 * 
 * @example
 * clampDuration(100)  // 返回 100
 * clampDuration(30)   // 返回 50 (最小值)
 * clampDuration(600)  // 返回 500 (最大值)
 * clampDuration(-10)  // 返回 50 (最小值)
 * 
 * @see Requirements 4.4
 * @see Design Property 5: Duration Bounds
 */
export function clampDuration(duration: number): number {
  return Math.max(MIN_ANIMATION_DURATION, Math.min(MAX_ANIMATION_DURATION, duration));
}
