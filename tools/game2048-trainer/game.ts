/**
 * 2048 N-Tuple Network Training - High Performance Game Engine
 * 
 * 使用位棋盘（bitboard）表示实现高性能2048游戏引擎。
 * 每个方块用4位表示（0-15对应空格到32768），整个棋盘用64位BigInt表示。
 * 
 * 棋盘位置布局（从高位到低位）：
 * 位置:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
 * 位:   60 56 52 48 44 40 36 32 28 24 20 16 12  8  4  0
 * 
 * 方块值编码：
 * 0 = 空格
 * 1 = 2
 * 2 = 4
 * 3 = 8
 * ...
 * 15 = 32768
 */

/**
 * 棋盘类型：64位整数
 * 每4位表示一个方块的指数值
 */
export type Board = bigint;

/**
 * 行移动结果
 */
export interface RowMoveResult {
  row: number;    // 移动后的行（16位）
  score: number;  // 合并得分
}

/**
 * 移动方向
 * 0 = 上, 1 = 右, 2 = 下, 3 = 左
 */
export type Direction = 0 | 1 | 2 | 3;

// 预计算表（在模块加载时初始化）
const LEFT_TABLE: RowMoveResult[] = new Array(65536);
const RIGHT_TABLE: RowMoveResult[] = new Array(65536);

// 标记表是否已初始化
let tablesInitialized = false;

/**
 * 计算单行向左移动的结果
 * @param row 原始行（16位，4个4位方块）
 * @returns 移动后的行和得分
 */
function computeRowLeft(row: number): RowMoveResult {
  // 提取4个方块值
  const tiles = [
    (row >> 12) & 0xF,
    (row >> 8) & 0xF,
    (row >> 4) & 0xF,
    row & 0xF,
  ];

  let score = 0;
  
  // 移除空格，将非空方块向左压缩
  const nonEmpty = tiles.filter(t => t !== 0);
  
  // 合并相邻相同的方块
  const merged: number[] = [];
  let i = 0;
  while (i < nonEmpty.length) {
    if (i + 1 < nonEmpty.length && nonEmpty[i] === nonEmpty[i + 1]) {
      // 合并：值+1（指数增加），得分为合并后的值
      const newValue = nonEmpty[i] + 1;
      merged.push(newValue);
      score += 1 << newValue; // 2^newValue
      i += 2;
    } else {
      merged.push(nonEmpty[i]);
      i++;
    }
  }
  
  // 填充空格到4个位置
  while (merged.length < 4) {
    merged.push(0);
  }
  
  // 组合成16位行
  const newRow = (merged[0] << 12) | (merged[1] << 8) | (merged[2] << 4) | merged[3];
  
  return { row: newRow, score };
}

/**
 * 反转行（用于计算向右移动）
 * @param row 原始行
 * @returns 反转后的行
 */
function reverseRow(row: number): number {
  return (
    ((row & 0xF) << 12) |
    (((row >> 4) & 0xF) << 8) |
    (((row >> 8) & 0xF) << 4) |
    ((row >> 12) & 0xF)
  );
}

/**
 * 初始化预计算移动表
 * 为所有65536种可能的行状态预计算移动结果
 */
export function initTables(): void {
  if (tablesInitialized) return;
  
  for (let row = 0; row < 65536; row++) {
    // 向左移动
    LEFT_TABLE[row] = computeRowLeft(row);
    
    // 向右移动 = 反转 -> 向左 -> 反转
    const reversed = reverseRow(row);
    const leftResult = computeRowLeft(reversed);
    RIGHT_TABLE[row] = {
      row: reverseRow(leftResult.row),
      score: leftResult.score,
    };
  }
  
  tablesInitialized = true;
}

/**
 * 从位棋盘提取指定行
 * @param board 位棋盘
 * @param rowIndex 行索引（0-3）
 * @returns 16位行值
 */
export function extractRow(board: Board, rowIndex: number): number {
  const shift = BigInt((3 - rowIndex) * 16);
  return Number((board >> shift) & 0xFFFFn);
}

/**
 * 设置位棋盘的指定行
 * @param board 位棋盘
 * @param rowIndex 行索引（0-3）
 * @param row 新的行值
 * @returns 更新后的位棋盘
 */
export function setRow(board: Board, rowIndex: number, row: number): Board {
  const shift = BigInt((3 - rowIndex) * 16);
  const mask = ~(0xFFFFn << shift);
  return (board & mask) | (BigInt(row) << shift);
}

/**
 * 转置棋盘（行列互换）
 * 用于将上下移动转换为左右移动
 * @param board 位棋盘
 * @returns 转置后的位棋盘
 */
export function transpose(board: Board): Board {
  // 提取所有16个方块
  const tiles: number[] = [];
  for (let i = 0; i < 16; i++) {
    const shift = BigInt((15 - i) * 4);
    tiles.push(Number((board >> shift) & 0xFn));
  }
  
  // 转置：位置(r,c) -> (c,r)
  // 原位置 i = r*4 + c
  // 新位置 j = c*4 + r
  const transposed: number[] = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      transposed[c * 4 + r] = tiles[r * 4 + c];
    }
  }
  
  // 重新组合成位棋盘
  let result = 0n;
  for (let i = 0; i < 16; i++) {
    result = (result << 4n) | BigInt(transposed[i]);
  }
  
  return result;
}

/**
 * 向左移动整个棋盘
 * @param board 位棋盘
 * @returns 移动后的棋盘和得分，如果无法移动返回null
 */
export function moveLeft(board: Board): { board: Board; score: number } | null {
  if (!tablesInitialized) initTables();
  
  let newBoard = 0n;
  let totalScore = 0;
  let moved = false;
  
  for (let r = 0; r < 4; r++) {
    const row = extractRow(board, r);
    const result = LEFT_TABLE[row];
    newBoard = setRow(newBoard, r, result.row);
    totalScore += result.score;
    if (result.row !== row) moved = true;
  }
  
  return moved ? { board: newBoard, score: totalScore } : null;
}

/**
 * 向右移动整个棋盘
 * @param board 位棋盘
 * @returns 移动后的棋盘和得分，如果无法移动返回null
 */
export function moveRight(board: Board): { board: Board; score: number } | null {
  if (!tablesInitialized) initTables();
  
  let newBoard = 0n;
  let totalScore = 0;
  let moved = false;
  
  for (let r = 0; r < 4; r++) {
    const row = extractRow(board, r);
    const result = RIGHT_TABLE[row];
    newBoard = setRow(newBoard, r, result.row);
    totalScore += result.score;
    if (result.row !== row) moved = true;
  }
  
  return moved ? { board: newBoard, score: totalScore } : null;
}

/**
 * 向上移动整个棋盘
 * 通过转置 -> 向左 -> 转置实现
 * @param board 位棋盘
 * @returns 移动后的棋盘和得分，如果无法移动返回null
 */
export function moveUp(board: Board): { board: Board; score: number } | null {
  const transposed = transpose(board);
  const result = moveLeft(transposed);
  if (result === null) return null;
  return { board: transpose(result.board), score: result.score };
}

/**
 * 向下移动整个棋盘
 * 通过转置 -> 向右 -> 转置实现
 * @param board 位棋盘
 * @returns 移动后的棋盘和得分，如果无法移动返回null
 */
export function moveDown(board: Board): { board: Board; score: number } | null {
  const transposed = transpose(board);
  const result = moveRight(transposed);
  if (result === null) return null;
  return { board: transpose(result.board), score: result.score };
}

/**
 * 执行指定方向的移动
 * @param board 位棋盘
 * @param dir 移动方向（0=上, 1=右, 2=下, 3=左）
 * @returns 移动后的棋盘和得分，如果无法移动返回null
 */
export function move(board: Board, dir: Direction): { board: Board; score: number } | null {
  switch (dir) {
    case 0: return moveUp(board);
    case 1: return moveRight(board);
    case 2: return moveDown(board);
    case 3: return moveLeft(board);
  }
}

/**
 * 统计棋盘上的空格数量
 * @param board 位棋盘
 * @returns 空格数量
 */
export function countEmpty(board: Board): number {
  let count = 0;
  let b = board;
  for (let i = 0; i < 16; i++) {
    if ((b & 0xFn) === 0n) count++;
    b >>= 4n;
  }
  return count;
}

/**
 * 获取所有空格位置
 * @param board 位棋盘
 * @returns 空格位置数组（0-15）
 */
export function getEmptyPositions(board: Board): number[] {
  const positions: number[] = [];
  for (let i = 0; i < 16; i++) {
    const shift = BigInt((15 - i) * 4);
    if (((board >> shift) & 0xFn) === 0n) {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * 在指定位置设置方块值
 * @param board 位棋盘
 * @param pos 位置（0-15）
 * @param value 方块值（指数形式，1=2, 2=4, ...）
 * @returns 更新后的位棋盘
 */
export function setTile(board: Board, pos: number, value: number): Board {
  const shift = BigInt((15 - pos) * 4);
  const mask = ~(0xFn << shift);
  return (board & mask) | (BigInt(value) << shift);
}

/**
 * 获取指定位置的方块值
 * @param board 位棋盘
 * @param pos 位置（0-15）
 * @returns 方块值（指数形式）
 */
export function getTile(board: Board, pos: number): number {
  const shift = BigInt((15 - pos) * 4);
  return Number((board >> shift) & 0xFn);
}

/**
 * 在随机空格位置添加新方块
 * 90%概率添加2（值=1），10%概率添加4（值=2）
 * @param board 位棋盘
 * @returns 添加方块后的位棋盘，如果没有空格返回原棋盘
 */
export function addRandomTile(board: Board): Board {
  const emptyPositions = getEmptyPositions(board);
  if (emptyPositions.length === 0) return board;
  
  const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  const value = Math.random() < 0.9 ? 1 : 2; // 1=2, 2=4
  
  return setTile(board, pos, value);
}

/**
 * 获取棋盘上的最大方块值
 * @param board 位棋盘
 * @returns 最大方块的实际值（2, 4, 8, ..., 32768）
 */
export function getMaxTile(board: Board): number {
  let maxExp = 0;
  let b = board;
  for (let i = 0; i < 16; i++) {
    const exp = Number(b & 0xFn);
    if (exp > maxExp) maxExp = exp;
    b >>= 4n;
  }
  return maxExp === 0 ? 0 : 1 << maxExp;
}

/**
 * 检查游戏是否结束（没有有效移动）
 * @param board 位棋盘
 * @returns 如果游戏结束返回true
 */
export function isGameOver(board: Board): boolean {
  // 检查是否有空格
  if (countEmpty(board) > 0) return false;
  
  // 检查是否有可合并的相邻方块
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const pos = r * 4 + c;
      const tile = getTile(board, pos);
      
      // 检查右边
      if (c < 3 && getTile(board, pos + 1) === tile) return false;
      
      // 检查下边
      if (r < 3 && getTile(board, pos + 4) === tile) return false;
    }
  }
  
  return true;
}

/**
 * 将4x4数组转换为位棋盘
 * @param matrix 4x4数组，值为实际方块值（0, 2, 4, 8, ...）
 * @returns 位棋盘
 */
export function matrixToBoard(matrix: number[][]): Board {
  let board = 0n;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const value = matrix[r][c];
      // 将实际值转换为指数（0->0, 2->1, 4->2, 8->3, ...）
      const exp = value === 0 ? 0 : Math.log2(value);
      board = (board << 4n) | BigInt(exp);
    }
  }
  return board;
}

/**
 * 将位棋盘转换为4x4数组
 * @param board 位棋盘
 * @returns 4x4数组，值为实际方块值
 */
export function boardToMatrix(board: Board): number[][] {
  const matrix: number[][] = [];
  for (let r = 0; r < 4; r++) {
    const row: number[] = [];
    for (let c = 0; c < 4; c++) {
      const pos = r * 4 + c;
      const exp = getTile(board, pos);
      row.push(exp === 0 ? 0 : 1 << exp);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * 打印棋盘（调试用）
 * @param board 位棋盘
 */
export function printBoard(board: Board): void {
  const matrix = boardToMatrix(board);
  console.log('┌──────┬──────┬──────┬──────┐');
  for (let r = 0; r < 4; r++) {
    const row = matrix[r].map(v => v === 0 ? '    ' : v.toString().padStart(4));
    console.log(`│ ${row.join(' │ ')} │`);
    if (r < 3) console.log('├──────┼──────┼──────┼──────┤');
  }
  console.log('└──────┴──────┴──────┴──────┘');
}

/**
 * 游戏引擎类
 * 封装游戏状态和操作，提供面向对象的接口
 */
export class Game {
  board: Board;
  score: number;
  
  constructor() {
    this.board = 0n;
    this.score = 0;
  }
  
  /**
   * 初始化新游戏
   * 清空棋盘，添加2个随机方块
   */
  init(): void {
    // 确保预计算表已初始化
    initTables();
    
    this.board = 0n;
    this.score = 0;
    
    // 添加2个初始方块
    this.board = addRandomTile(this.board);
    this.board = addRandomTile(this.board);
  }
  
  /**
   * 执行移动
   * @param dir 移动方向（0=上, 1=右, 2=下, 3=左）
   * @returns 移动结果，包含是否成功和得分
   */
  move(dir: Direction): { moved: boolean; score: number } {
    const result = move(this.board, dir);
    
    if (result === null) {
      return { moved: false, score: 0 };
    }
    
    this.board = result.board;
    this.score += result.score;
    
    return { moved: true, score: result.score };
  }
  
  /**
   * 获取afterstate（移动后、添加方块前的状态）
   * 用于TD Learning训练
   * @param dir 移动方向
   * @returns afterstate棋盘和得分，如果无法移动返回null
   */
  getAfterstate(dir: Direction): { board: Board; score: number } | null {
    return move(this.board, dir);
  }
  
  /**
   * 添加随机方块
   */
  addRandomTile(): void {
    this.board = addRandomTile(this.board);
  }
  
  /**
   * 检查游戏是否结束
   * @returns 如果没有有效移动返回true
   */
  isGameOver(): boolean {
    return isGameOver(this.board);
  }
  
  /**
   * 获取最大方块值
   * @returns 最大方块的实际值（2, 4, 8, ..., 32768）
   */
  getMaxTile(): number {
    return getMaxTile(this.board);
  }
  
  /**
   * 获取空格数量
   * @returns 空格数量
   */
  countEmpty(): number {
    return countEmpty(this.board);
  }
  
  /**
   * 克隆当前游戏状态
   * @returns 新的Game实例，具有相同的状态
   */
  clone(): Game {
    const game = new Game();
    game.board = this.board;
    game.score = this.score;
    return game;
  }
  
  /**
   * 从矩阵设置棋盘状态
   * @param matrix 4x4数组
   * @param score 可选的分数
   */
  setFromMatrix(matrix: number[][], score: number = 0): void {
    this.board = matrixToBoard(matrix);
    this.score = score;
  }
  
  /**
   * 获取棋盘的矩阵表示
   * @returns 4x4数组
   */
  toMatrix(): number[][] {
    return boardToMatrix(this.board);
  }
  
  /**
   * 打印棋盘（调试用）
   */
  print(): void {
    console.log(`Score: ${this.score}`);
    printBoard(this.board);
  }
}
