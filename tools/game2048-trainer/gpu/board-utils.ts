/**
 * GPU Board Utilities - GPU棋盘表示转换工具
 * 
 * 提供BigInt位棋盘与Float32Array之间的转换功能，
 * 以及批量棋盘状态管理。
 * 
 * GPU.js使用Float32Array进行计算，而CPU版本使用BigInt位棋盘。
 * 本模块提供两种表示之间的高效转换。
 * 
 * Requirements: 2.1
 */

import { Board, getTile, setTile } from '../game';

/**
 * GPU优化的棋盘表示
 * 使用Float32Array而非BigInt，便于GPU处理
 * 每个位置存储方块的指数值（0-15）
 */
export interface GPUBoardState {
  /** 16个位置的方块值 [0-15] */
  tiles: Float32Array;
}

/**
 * 批量棋盘状态
 * 所有游戏的棋盘数据连续存储，便于GPU并行访问
 */
export interface BatchBoardState {
  /** 所有棋盘数据 [batchSize * 16] */
  data: Float32Array;
  /** 批量大小 */
  batchSize: number;
}

/**
 * 批量游戏状态（完整状态）
 */
export interface BatchGameState {
  /** 棋盘状态数组 [batchSize * 16] - 每个位置的方块指数 */
  boards: Float32Array;
  /** 游戏分数数组 [batchSize] */
  scores: Float32Array;
  /** 游戏是否结束标记 [batchSize] */
  gameOver: Uint8Array;
  /** 当前步数 [batchSize] */
  moves: Uint32Array;
  /** 批量大小 */
  batchSize: number;
}

/**
 * 将BigInt位棋盘转换为Float32Array
 * 
 * BigInt位棋盘格式：每4位表示一个方块的指数值（0-15）
 * Float32Array格式：16个元素，每个元素是方块的指数值
 * 
 * @param board BigInt位棋盘
 * @returns Float32Array表示的棋盘（16个元素）
 */
export function boardToFloat32Array(board: Board): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    result[i] = getTile(board, i);
  }
  return result;
}

/**
 * 将Float32Array转换为BigInt位棋盘
 * 
 * @param tiles Float32Array表示的棋盘（16个元素）
 * @returns BigInt位棋盘
 */
export function float32ArrayToBoard(tiles: Float32Array): Board {
  let board: Board = 0n;
  for (let i = 0; i < 16; i++) {
    board = setTile(board, i, Math.floor(tiles[i]));
  }
  return board;
}

/**
 * 将BigInt位棋盘写入Float32Array的指定位置
 * 
 * @param board BigInt位棋盘
 * @param target 目标Float32Array
 * @param offset 写入的起始偏移量
 */
export function writeBoardToArray(board: Board, target: Float32Array, offset: number): void {
  for (let i = 0; i < 16; i++) {
    target[offset + i] = getTile(board, i);
  }
}

/**
 * 从Float32Array的指定位置读取BigInt位棋盘
 * 
 * @param source 源Float32Array
 * @param offset 读取的起始偏移量
 * @returns BigInt位棋盘
 */
export function readBoardFromArray(source: Float32Array, offset: number): Board {
  let board: Board = 0n;
  for (let i = 0; i < 16; i++) {
    board = setTile(board, i, Math.floor(source[offset + i]));
  }
  return board;
}

/**
 * 创建批量棋盘状态
 * 
 * @param batchSize 批量大小
 * @returns 初始化的批量棋盘状态
 */
export function createBatchBoardState(batchSize: number): BatchBoardState {
  return {
    data: new Float32Array(batchSize * 16),
    batchSize,
  };
}

/**
 * 创建批量游戏状态
 * 
 * @param batchSize 批量大小
 * @returns 初始化的批量游戏状态
 */
export function createBatchGameState(batchSize: number): BatchGameState {
  return {
    boards: new Float32Array(batchSize * 16),
    scores: new Float32Array(batchSize),
    gameOver: new Uint8Array(batchSize),
    moves: new Uint32Array(batchSize),
    batchSize,
  };
}

/**
 * 将BigInt位棋盘数组转换为批量棋盘状态
 * 
 * @param boards BigInt位棋盘数组
 * @returns 批量棋盘状态
 */
export function boardsToBatchState(boards: Board[]): BatchBoardState {
  const batchSize = boards.length;
  const state = createBatchBoardState(batchSize);
  
  for (let i = 0; i < batchSize; i++) {
    writeBoardToArray(boards[i], state.data, i * 16);
  }
  
  return state;
}

/**
 * 将批量棋盘状态转换为BigInt位棋盘数组
 * 
 * @param state 批量棋盘状态
 * @returns BigInt位棋盘数组
 */
export function batchStateToBoards(state: BatchBoardState): Board[] {
  const boards: Board[] = [];
  
  for (let i = 0; i < state.batchSize; i++) {
    boards.push(readBoardFromArray(state.data, i * 16));
  }
  
  return boards;
}

/**
 * 获取批量状态中指定索引的棋盘
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 * @returns BigInt位棋盘
 */
export function getBoardFromBatch(state: BatchBoardState, index: number): Board {
  if (index < 0 || index >= state.batchSize) {
    throw new Error(`Board index ${index} out of range [0, ${state.batchSize})`);
  }
  return readBoardFromArray(state.data, index * 16);
}

/**
 * 设置批量状态中指定索引的棋盘
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 * @param board BigInt位棋盘
 */
export function setBoardInBatch(state: BatchBoardState, index: number, board: Board): void {
  if (index < 0 || index >= state.batchSize) {
    throw new Error(`Board index ${index} out of range [0, ${state.batchSize})`);
  }
  writeBoardToArray(board, state.data, index * 16);
}

/**
 * 获取批量状态中指定棋盘的指定位置的方块值
 * 
 * @param state 批量棋盘状态
 * @param boardIndex 棋盘索引
 * @param tileIndex 方块位置索引（0-15）
 * @returns 方块值（指数形式，0-15）
 */
export function getTileFromBatch(
  state: BatchBoardState,
  boardIndex: number,
  tileIndex: number
): number {
  return state.data[boardIndex * 16 + tileIndex];
}

/**
 * 设置批量状态中指定棋盘的指定位置的方块值
 * 
 * @param state 批量棋盘状态
 * @param boardIndex 棋盘索引
 * @param tileIndex 方块位置索引（0-15）
 * @param value 方块值（指数形式，0-15）
 */
export function setTileInBatch(
  state: BatchBoardState,
  boardIndex: number,
  tileIndex: number,
  value: number
): void {
  state.data[boardIndex * 16 + tileIndex] = value;
}

/**
 * 复制批量棋盘状态
 * 
 * @param state 源批量棋盘状态
 * @returns 新的批量棋盘状态副本
 */
export function copyBatchBoardState(state: BatchBoardState): BatchBoardState {
  return {
    data: new Float32Array(state.data),
    batchSize: state.batchSize,
  };
}

/**
 * 复制批量游戏状态
 * 
 * @param state 源批量游戏状态
 * @returns 新的批量游戏状态副本
 */
export function copyBatchGameState(state: BatchGameState): BatchGameState {
  return {
    boards: new Float32Array(state.boards),
    scores: new Float32Array(state.scores),
    gameOver: new Uint8Array(state.gameOver),
    moves: new Uint32Array(state.moves),
    batchSize: state.batchSize,
  };
}

/**
 * 重置批量游戏状态中的指定游戏
 * 
 * @param state 批量游戏状态
 * @param index 要重置的游戏索引
 */
export function resetGameInBatch(state: BatchGameState, index: number): void {
  // 清空棋盘
  for (let i = 0; i < 16; i++) {
    state.boards[index * 16 + i] = 0;
  }
  // 重置分数和状态
  state.scores[index] = 0;
  state.gameOver[index] = 0;
  state.moves[index] = 0;
}

/**
 * 检查批量状态中的棋盘是否全为空
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 * @returns 如果棋盘全为空返回true
 */
export function isBoardEmpty(state: BatchBoardState, index: number): boolean {
  const offset = index * 16;
  for (let i = 0; i < 16; i++) {
    if (state.data[offset + i] !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * 统计批量状态中指定棋盘的空格数量
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 * @returns 空格数量
 */
export function countEmptyInBatch(state: BatchBoardState, index: number): number {
  const offset = index * 16;
  let count = 0;
  for (let i = 0; i < 16; i++) {
    if (state.data[offset + i] === 0) {
      count++;
    }
  }
  return count;
}

/**
 * 获取批量状态中指定棋盘的空格位置
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 * @returns 空格位置数组（0-15）
 */
export function getEmptyPositionsInBatch(state: BatchBoardState, index: number): number[] {
  const offset = index * 16;
  const positions: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (state.data[offset + i] === 0) {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * 将Float32Array棋盘数据转换为2D数组（用于调试）
 * 
 * @param data Float32Array棋盘数据
 * @param offset 起始偏移量
 * @returns 4x4的2D数组
 */
export function toMatrix(data: Float32Array, offset: number = 0): number[][] {
  const matrix: number[][] = [];
  for (let r = 0; r < 4; r++) {
    const row: number[] = [];
    for (let c = 0; c < 4; c++) {
      const exp = data[offset + r * 4 + c];
      row.push(exp === 0 ? 0 : 1 << exp);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * 打印批量状态中的指定棋盘（调试用）
 * 
 * @param state 批量棋盘状态
 * @param index 棋盘索引
 */
export function printBoardFromBatch(state: BatchBoardState, index: number): void {
  const matrix = toMatrix(state.data, index * 16);
  console.log('┌──────┬──────┬──────┬──────┐');
  for (let r = 0; r < 4; r++) {
    const row = matrix[r].map(v => v === 0 ? '    ' : v.toString().padStart(4));
    console.log(`│ ${row.join(' │ ')} │`);
    if (r < 3) console.log('├──────┼──────┼──────┼──────┤');
  }
  console.log('└──────┴──────┴──────┴──────┘');
}
