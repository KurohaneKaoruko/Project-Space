/**
 * 2048 N-Tuple Network Training - Pattern Definitions
 * 
 * 定义用于2048游戏AI训练的N-Tuple元组模式。
 * 这些模式与Web应用中的模式兼容，确保训练出的权重可以直接在Web应用中使用。
 * 
 * 2048棋盘位置索引布局（4x4）：
 *  0  1  2  3
 *  4  5  6  7
 *  8  9 10 11
 * 12 13 14 15
 */

/**
 * 元组模式类型
 * 每个元组是一组棋盘位置索引的数组
 */
export type Pattern = number[];

/**
 * 标准4-tuple水平线模式
 * 覆盖棋盘的4条水平线
 */
export const HORIZONTAL_4TUPLE: Pattern[] = [
  [0, 1, 2, 3],     // 第一行
  [4, 5, 6, 7],     // 第二行
  [8, 9, 10, 11],   // 第三行
  [12, 13, 14, 15], // 第四行
];

/**
 * 标准4-tuple垂直线模式
 * 覆盖棋盘的4条垂直线
 */
export const VERTICAL_4TUPLE: Pattern[] = [
  [0, 4, 8, 12],    // 第一列
  [1, 5, 9, 13],    // 第二列
  [2, 6, 10, 14],   // 第三列
  [3, 7, 11, 15],   // 第四列
];

/**
 * 标准6-tuple 2x3矩形模式
 * 覆盖棋盘的关键2x3区域
 */
export const RECTANGLE_6TUPLE: Pattern[] = [
  [0, 1, 2, 4, 5, 6],       // 左上2x3
  [1, 2, 3, 5, 6, 7],       // 右上2x3
  [4, 5, 6, 8, 9, 10],      // 中左2x3
  [5, 6, 7, 9, 10, 11],     // 中右2x3
  [8, 9, 10, 12, 13, 14],   // 左下2x3
  [9, 10, 11, 13, 14, 15],  // 右下2x3
];

/**
 * 标准6-tuple角落L形模式
 * 覆盖棋盘的4个角落L形区域
 */
export const CORNER_6TUPLE: Pattern[] = [
  [0, 1, 4, 5, 8, 9],       // 左上角L形
  [2, 3, 6, 7, 10, 11],     // 右上角L形
  [4, 5, 8, 9, 12, 13],     // 左下角L形
  [6, 7, 10, 11, 14, 15],   // 右下角L形
];

/**
 * 标准6-tuple模式（设计文档中定义的模式）
 * 包含2x3矩形和角落L形模式
 * 
 * 这是训练程序的默认模式配置，与设计文档中的STANDARD_6TUPLE_PATTERNS一致
 */
export const STANDARD_6TUPLE_PATTERNS: Pattern[] = [
  // 2x3矩形
  [0, 1, 2, 4, 5, 6],
  [4, 5, 6, 8, 9, 10],
  [1, 2, 3, 5, 6, 7],
  [5, 6, 7, 9, 10, 11],
  [8, 9, 10, 12, 13, 14],
  [9, 10, 11, 13, 14, 15],
  
  // 角落模式
  [0, 1, 4, 5, 8, 9],
  [2, 3, 6, 7, 10, 11],
  [4, 5, 8, 9, 12, 13],
  [6, 7, 10, 11, 14, 15],
];

/**
 * 4-tuple行列模式
 * 用于更简单的训练配置
 */
export const ROW_COL_4TUPLE_PATTERNS: Pattern[] = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
];

/**
 * 默认训练模式
 * 使用标准6-tuple模式，为2048游戏AI提供良好的特征覆盖和训练效果
 */
export const DEFAULT_TRAINING_PATTERNS: Pattern[] = STANDARD_6TUPLE_PATTERNS;

/**
 * 计算给定元组大小的查找表大小
 * LUT大小 = 16^n（n为元组大小，16对应2048游戏中0-32768共16种方块值）
 * 
 * @param tupleSize 元组大小
 * @returns 查找表大小
 */
export function calculateLutSize(tupleSize: number): number {
  return Math.pow(16, tupleSize);
}
