/**
 * 2048游戏引擎模块
 * 
 * 纯函数实现，不依赖任何React或DOM API。
 * 所有函数都是无副作用的，返回新状态而不修改原状态。
 */

import type { 
  Direction, 
  Tile, 
  AnimatedTile,
  GameState, 
  MoveResult,
  CompressMergeResult 
} from '../types';

/**
 * 生成唯一的方块ID
 */
function generateTileId(): string {
  return `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 根据棋盘大小生成随机方块数值
 * @param size 棋盘大小
 */
function generateRandomTileValue(size: number): number {
  if (size <= 4) {
    return Math.random() < 0.9 ? 2 : 4;
  } else {
    // 5x5及以上棋盘，增加一点变化但保持正常数值
    return Math.random() < 0.7 ? 2 : Math.random() < 0.7 ? 4 : 8;
  }
}

/**
 * 将棋盘矩阵转换为Tile数组
 * @param board 棋盘矩阵
 */
export function boardToTiles(board: number[][]): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== 0) {
        tiles.push({
          id: generateTileId(),
          value: board[row][col],
          row,
          col,
        });
      }
    }
  }
  return tiles;
}

/**
 * 深拷贝棋盘矩阵
 * @param board 原始棋盘
 */
function cloneBoard(board: number[][]): number[][] {
  return board.map(row => [...row]);
}

/**
 * 检查游戏是否结束
 * 当没有空格且没有相邻相同数字时，游戏结束
 * @param board 棋盘矩阵
 */
export function isGameOver(board: number[][]): boolean {
  const size = board.length;
  
  // 检查是否有空格
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] === 0) return false;
    }
  }

  // 检查是否有相邻的相同数字
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const current = board[i][j];
      // 检查右边
      if (j < size - 1 && current === board[i][j + 1]) return false;
      // 检查下边
      if (i < size - 1 && current === board[i + 1][j]) return false;
    }
  }

  return true;
}

/**
 * 在棋盘上添加新的随机方块
 * @param board 棋盘矩阵（会被修改）
 * @param size 棋盘大小
 * @returns 新方块信息，如果没有空位返回null
 */
export function addRandomTile(board: number[][], size: number): Tile | null {
  const emptyCells: { row: number; col: number }[] = [];
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) {
    return null;
  }

  const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = generateRandomTileValue(size);
  board[row][col] = value;

  return {
    id: generateTileId(),
    value,
    row,
    col,
    isNew: true,
  };
}

/**
 * 创建初始游戏状态
 * @param size 棋盘大小 (4-7)
 * @param highScore 历史最高分
 */
export function createInitialState(size: number, highScore: number = 0): GameState {
  // 验证并限制棋盘大小
  const validSize = Math.max(4, Math.min(7, size));
  
  // 创建空棋盘
  const board: number[][] = Array(validSize)
    .fill(0)
    .map(() => Array(validSize).fill(0));
  
  // 添加初始方块（通常是1-2个）
  addRandomTile(board, validSize);
  
  return {
    board,
    tiles: boardToTiles(board),
    score: 0,
    gameOver: false,
    showGameOver: false,
    size: validSize,
    highScore,
  };
}


/**
 * 优化的单行压缩合并算法
 * 在单次遍历中完成压缩和合并操作
 * @param line 原始行/列数组
 * @returns 压缩合并结果
 */
export function compressAndMerge(line: number[]): CompressMergeResult {
  const result: number[] = [];
  let score = 0;
  let moved = false;
  const mergedIndices: number[] = [];
  
  // 过滤出非零值
  const nonZero = line.filter(v => v !== 0);
  
  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      // 合并相邻相同值
      const merged = nonZero[i] * 2;
      result.push(merged);
      score += merged;
      mergedIndices.push(result.length - 1);
      i += 2;
    } else {
      result.push(nonZero[i]);
      i++;
    }
  }
  
  // 填充零到原始长度
  while (result.length < line.length) {
    result.push(0);
  }
  
  // 检查是否发生移动
  moved = line.some((v, idx) => v !== result[idx]);
  
  return { result, score, moved, mergedIndices };
}

/**
 * 带ID追踪的压缩合并结果
 */
interface CompressMergeWithIdsResult extends CompressMergeResult {
  /** 结果行对应的方块ID */
  resultIds: (string | null)[];
}

/**
 * 带ID追踪的单行压缩合并算法
 * 在压缩合并过程中追踪方块ID，用于动画
 * @param line 原始行/列数组
 * @param idLine 原始行/列的ID数组
 * @returns 压缩合并结果（包含ID追踪）
 */
function compressAndMergeWithIds(line: number[], idLine: (string | null)[]): CompressMergeWithIdsResult {
  const result: number[] = [];
  const resultIds: (string | null)[] = [];
  let score = 0;
  let moved = false;
  const mergedIndices: number[] = [];
  
  // 过滤出非零值及其对应的ID
  const nonZero: { value: number; id: string | null }[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== 0) {
      nonZero.push({ value: line[i], id: idLine[i] });
    }
  }
  
  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i].value === nonZero[i + 1].value) {
      // 合并相邻相同值，保留第一个方块的ID
      const merged = nonZero[i].value * 2;
      result.push(merged);
      resultIds.push(nonZero[i].id); // 保留第一个方块的ID用于追踪
      score += merged;
      mergedIndices.push(result.length - 1);
      i += 2;
    } else {
      result.push(nonZero[i].value);
      resultIds.push(nonZero[i].id);
      i++;
    }
  }
  
  // 填充零到原始长度
  while (result.length < line.length) {
    result.push(0);
    resultIds.push(null);
  }
  
  // 检查是否发生移动
  moved = line.some((v, idx) => v !== result[idx]);
  
  return { result, score, moved, mergedIndices, resultIds };
}

/**
 * 从棋盘中提取指定方向的行
 * @param board 棋盘矩阵
 * @param direction 移动方向
 * @param index 行/列索引
 */
function extractLine(board: number[][], direction: Direction, index: number): number[] {
  const size = board.length;
  const line: number[] = [];
  
  switch (direction) {
    case 'left':
      // 从左到右提取行
      for (let j = 0; j < size; j++) {
        line.push(board[index][j]);
      }
      break;
    case 'right':
      // 从右到左提取行
      for (let j = size - 1; j >= 0; j--) {
        line.push(board[index][j]);
      }
      break;
    case 'up':
      // 从上到下提取列
      for (let i = 0; i < size; i++) {
        line.push(board[i][index]);
      }
      break;
    case 'down':
      // 从下到上提取列
      for (let i = size - 1; i >= 0; i--) {
        line.push(board[i][index]);
      }
      break;
  }
  
  return line;
}

/**
 * 从ID棋盘中提取指定方向的ID行
 * @param idBoard ID棋盘矩阵
 * @param direction 移动方向
 * @param index 行/列索引
 * @param size 棋盘大小
 */
function extractIdLine(idBoard: (string | null)[][], direction: Direction, index: number, size: number): (string | null)[] {
  const line: (string | null)[] = [];
  
  switch (direction) {
    case 'left':
      for (let j = 0; j < size; j++) {
        line.push(idBoard[index][j]);
      }
      break;
    case 'right':
      for (let j = size - 1; j >= 0; j--) {
        line.push(idBoard[index][j]);
      }
      break;
    case 'up':
      for (let i = 0; i < size; i++) {
        line.push(idBoard[i][index]);
      }
      break;
    case 'down':
      for (let i = size - 1; i >= 0; i--) {
        line.push(idBoard[i][index]);
      }
      break;
  }
  
  return line;
}

/**
 * 将处理后的行写回棋盘
 * @param board 棋盘矩阵（会被修改）
 * @param direction 移动方向
 * @param index 行/列索引
 * @param line 处理后的行
 */
function writeLine(board: number[][], direction: Direction, index: number, line: number[]): void {
  const size = board.length;
  
  switch (direction) {
    case 'left':
      for (let j = 0; j < size; j++) {
        board[index][j] = line[j];
      }
      break;
    case 'right':
      for (let j = 0; j < size; j++) {
        board[index][size - 1 - j] = line[j];
      }
      break;
    case 'up':
      for (let i = 0; i < size; i++) {
        board[i][index] = line[i];
      }
      break;
    case 'down':
      for (let i = 0; i < size; i++) {
        board[size - 1 - i][index] = line[i];
      }
      break;
  }
}

/**
 * 将处理后的ID行写回ID棋盘
 * @param idBoard ID棋盘矩阵（会被修改）
 * @param direction 移动方向
 * @param index 行/列索引
 * @param idLine 处理后的ID行
 * @param size 棋盘大小
 */
function writeIdLine(idBoard: (string | null)[][], direction: Direction, index: number, idLine: (string | null)[], size: number): void {
  switch (direction) {
    case 'left':
      for (let j = 0; j < size; j++) {
        idBoard[index][j] = idLine[j];
      }
      break;
    case 'right':
      for (let j = 0; j < size; j++) {
        idBoard[index][size - 1 - j] = idLine[j];
      }
      break;
    case 'up':
      for (let i = 0; i < size; i++) {
        idBoard[i][index] = idLine[i];
      }
      break;
    case 'down':
      for (let i = 0; i < size; i++) {
        idBoard[size - 1 - i][index] = idLine[i];
      }
      break;
  }
}

/**
 * 获取合并方块在棋盘上的实际位置
 * @param direction 移动方向
 * @param lineIndex 行/列索引
 * @param posInLine 在行内的位置
 * @param size 棋盘大小
 */
function getMergedTilePosition(
  direction: Direction, 
  lineIndex: number, 
  posInLine: number, 
  size: number
): { row: number; col: number } {
  switch (direction) {
    case 'left':
      return { row: lineIndex, col: posInLine };
    case 'right':
      return { row: lineIndex, col: size - 1 - posInLine };
    case 'up':
      return { row: posInLine, col: lineIndex };
    case 'down':
      return { row: size - 1 - posInLine, col: lineIndex };
  }
}

/**
 * 执行移动操作
 * 返回新状态而不修改原状态
 * 追踪每个方块的移动前位置，用于动画
 * @param state 当前游戏状态
 * @param direction 移动方向
 * @returns 移动结果
 */
export function move(state: GameState, direction: Direction): MoveResult {
  const size = state.size;
  
  // 记录移动前每个方块的位置（使用id作为key）
  const previousPositions = new Map<string, { row: number; col: number }>();
  for (const tile of state.tiles) {
    previousPositions.set(tile.id, { row: tile.row, col: tile.col });
  }
  
  // 创建棋盘的深拷贝
  const newBoard = cloneBoard(state.board);
  
  // 创建一个映射来追踪方块ID在棋盘上的位置变化
  // idBoard[row][col] = tileId 表示该位置的方块ID
  const idBoard: (string | null)[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
  
  // 初始化idBoard
  for (const tile of state.tiles) {
    idBoard[tile.row][tile.col] = tile.id;
  }
  
  let totalScore = 0;
  let anyMoved = false;
  const mergedTiles: Tile[] = [];
  // 记录合并后保留的方块ID（用于追踪合并动画）
  const mergedTileIds = new Set<string>();
  
  // 处理每一行/列
  for (let i = 0; i < size; i++) {
    const line = extractLine(newBoard, direction, i);
    const idLine = extractIdLine(idBoard, direction, i, size);
    const { result, score, moved, mergedIndices, resultIds } = compressAndMergeWithIds(line, idLine);
    
    if (moved) {
      anyMoved = true;
      writeLine(newBoard, direction, i, result);
      writeIdLine(idBoard, direction, i, resultIds, size);
      totalScore += score;
      
      // 记录合并的方块
      for (const pos of mergedIndices) {
        const { row, col } = getMergedTilePosition(direction, i, pos, size);
        const mergedId = resultIds[pos];
        if (mergedId) {
          mergedTileIds.add(mergedId);
        }
        mergedTiles.push({
          id: mergedId || generateTileId(),
          value: result[pos],
          row,
          col,
          isMerged: true,
        });
      }
    }
  }
  
  // 如果没有移动，返回原状态
  if (!anyMoved) {
    return {
      state,
      moved: false,
      scoreGained: 0,
      mergedTiles: [],
    };
  }
  
  // 添加新方块
  const newTile = addRandomTile(newBoard, size);
  
  // 更新最高分
  const newScore = state.score + totalScore;
  const newHighScore = Math.max(state.highScore, newScore);
  
  // 创建新的tiles数组，带有位置追踪信息
  const tiles: AnimatedTile[] = [];
  
  // 从idBoard重建tiles，保留原有ID并追踪位置变化
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (newBoard[row][col] !== 0) {
        const existingId = idBoard[row][col];
        const prevPos = existingId ? previousPositions.get(existingId) : null;
        
        // 检查是否是新生成的方块
        const isNewTile = newTile && newTile.row === row && newTile.col === col && !existingId;
        
        // 检查是否发生了移动
        const hasMoved = prevPos && (prevPos.row !== row || prevPos.col !== col);
        
        const tile: AnimatedTile = {
          id: isNewTile ? newTile.id : (existingId || generateTileId()),
          value: newBoard[row][col],
          row,
          col,
          isNew: isNewTile ? true : undefined,
          isMerged: existingId ? mergedTileIds.has(existingId) : false,
          previousRow: hasMoved ? prevPos.row : undefined,
          previousCol: hasMoved ? prevPos.col : undefined,
          isMoving: hasMoved ? true : undefined,
        };
        
        tiles.push(tile);
      }
    }
  }
  
  const isGameOverNow = isGameOver(newBoard);
  
  const newState: GameState = {
    board: newBoard,
    tiles,
    score: newScore,
    gameOver: isGameOverNow,
    showGameOver: isGameOverNow,
    size,
    highScore: newHighScore,
  };
  
  return {
    state: newState,
    moved: true,
    scoreGained: totalScore,
    mergedTiles,
  };
}
