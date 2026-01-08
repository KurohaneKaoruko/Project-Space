/**
 * 2048游戏AI引擎模块
 * 
 * 纯函数实现，不依赖任何React或DOM API。
 * 提供三种AI模式：快速、均衡、最优
 * 
 * 优化特性：
 * - 转置表缓存避免重复计算
 * - 优化的评估函数
 * - 自适应权重
 */

import type { Direction } from '../types';
import { NTupleNetwork } from './nTupleEngine';
import { createDefaultNTupleNetwork, createNTupleNetworkAsync } from './nTupleWeights';

/** AI模式类型 */
export type AIMode = 'fast' | 'balanced' | 'optimal' | 'ntuple';

/** 方向列表 */
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

/** 移动模拟结果 */
interface SimulateMoveResult {
  board: number[][];
  moved: boolean;
  score: number;
}

/** 空格位置 */
interface EmptyCell {
  row: number;
  col: number;
}

// ============================================
// 转置表缓存（用于Expectimax优化）
// ============================================

/** 转置表缓存 */
const transpositionTable = new Map<string, number>();
const MAX_CACHE_SIZE = 50000;

/**
 * 生成棋盘的哈希键
 */
function boardToKey(board: number[][]): string {
  return board.map(row => row.join(',')).join('|');
}

/**
 * 清理缓存（当缓存过大时）
 */
function clearCacheIfNeeded(): void {
  if (transpositionTable.size > MAX_CACHE_SIZE) {
    transpositionTable.clear();
  }
}

// ============================================
// 基础工具函数
// ============================================

/**
 * 深拷贝棋盘矩阵
 */
export function cloneBoard(board: number[][]): number[][] {
  return board.map(row => [...row]);
}

/**
 * 统计空格数量
 */
export function countEmptyCells(board: number[][]): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 0) count++;
    }
  }
  return count;
}

/**
 * 获取所有空格位置
 */
export function getEmptyCells(board: number[][]): EmptyCell[] {
  const emptyCells: EmptyCell[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }
  return emptyCells;
}

/**
 * 获取棋盘上的最大方块值
 */
export function getMaxTile(board: number[][]): number {
  let max = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell > max) max = cell;
    }
  }
  return max;
}


/**
 * 压缩并合并单行（向左方向）
 */
function compressAndMergeLine(line: number[]): { result: number[]; score: number; moved: boolean } {
  const result: number[] = [];
  let score = 0;
  
  // 过滤出非零值
  const nonZero = line.filter(v => v !== 0);
  
  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      // 合并相邻相同值
      const merged = nonZero[i] * 2;
      result.push(merged);
      score += merged;
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
  const moved = line.some((v, idx) => v !== result[idx]);
  
  return { result, score, moved };
}

/**
 * 检查指定方向是否可以移动
 */
export function canMove(board: number[][], direction: Direction): boolean {
  const size = board.length;
  
  for (let i = 0; i < size; i++) {
    const line = extractLine(board, direction, i);
    const { moved } = compressAndMergeLine(line);
    if (moved) return true;
  }
  
  return false;
}

/**
 * 从棋盘中提取指定方向的行
 */
function extractLine(board: number[][], direction: Direction, index: number): number[] {
  const size = board.length;
  const line: number[] = [];
  
  switch (direction) {
    case 'left':
      for (let j = 0; j < size; j++) {
        line.push(board[index][j]);
      }
      break;
    case 'right':
      for (let j = size - 1; j >= 0; j--) {
        line.push(board[index][j]);
      }
      break;
    case 'up':
      for (let i = 0; i < size; i++) {
        line.push(board[i][index]);
      }
      break;
    case 'down':
      for (let i = size - 1; i >= 0; i--) {
        line.push(board[i][index]);
      }
      break;
  }
  
  return line;
}

/**
 * 将处理后的行写回棋盘
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
 * 模拟移动操作（不添加新方块）
 */
export function simulateMove(board: number[][], direction: Direction): SimulateMoveResult {
  const size = board.length;
  const newBoard = cloneBoard(board);
  let totalScore = 0;
  let anyMoved = false;
  
  for (let i = 0; i < size; i++) {
    const line = extractLine(newBoard, direction, i);
    const { result, score, moved } = compressAndMergeLine(line);
    
    if (moved) {
      anyMoved = true;
      writeLine(newBoard, direction, i, result);
      totalScore += score;
    }
  }
  
  return {
    board: newBoard,
    moved: anyMoved,
    score: totalScore,
  };
}


// ============================================
// 启发式评估函数
// ============================================

/** 评估权重配置 */
interface EvaluationWeights {
  emptyWeight: number;
  monotonicityWeight: number;
  smoothnessWeight: number;
  maxTileWeight: number;
  cornerWeight: number;
}

/** 均衡模式权重 */
const BALANCED_WEIGHTS: EvaluationWeights = {
  emptyWeight: 2.7,
  monotonicityWeight: 1.0,
  smoothnessWeight: 0.1,
  maxTileWeight: 1.0,
  cornerWeight: 1.5,
};

/** 最优模式权重 */
const OPTIMAL_WEIGHTS: EvaluationWeights = {
  emptyWeight: 2.7,
  monotonicityWeight: 1.0,
  smoothnessWeight: 0.1,
  maxTileWeight: 1.0,
  cornerWeight: 2.0,
};

/**
 * 计算单调性 - 行列数值递增/递减的程度
 * 优化版本：考虑数值的对数差异，更准确地评估单调性
 */
export function calculateMonotonicity(board: number[][]): number {
  const size = board.length;
  let monoLeft = 0, monoRight = 0, monoUp = 0, monoDown = 0;
  
  // 检查行的单调性（使用对数值）
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - 1; j++) {
      const current = board[i][j] > 0 ? Math.log2(board[i][j]) : 0;
      const next = board[i][j + 1] > 0 ? Math.log2(board[i][j + 1]) : 0;
      if (current > next) {
        monoLeft += next - current;
      } else if (next > current) {
        monoRight += current - next;
      }
    }
  }
  
  // 检查列的单调性
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size - 1; i++) {
      const current = board[i][j] > 0 ? Math.log2(board[i][j]) : 0;
      const next = board[i + 1][j] > 0 ? Math.log2(board[i + 1][j]) : 0;
      if (current > next) {
        monoUp += next - current;
      } else if (next > current) {
        monoDown += current - next;
      }
    }
  }
  
  // 返回最佳单调性方向的组合
  return Math.max(monoLeft, monoRight) + Math.max(monoUp, monoDown);
}

/**
 * 计算平滑度 - 相邻方块数值差异的负值
 * 平滑度越高（越接近0），相邻方块数值越接近
 */
export function calculateSmoothness(board: number[][]): number {
  let smoothness = 0;
  const size = board.length;
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] !== 0) {
        const value = Math.log2(board[i][j]);
        // 检查右边
        if (j < size - 1 && board[i][j + 1] !== 0) {
          smoothness -= Math.abs(value - Math.log2(board[i][j + 1]));
        }
        // 检查下边
        if (i < size - 1 && board[i + 1][j] !== 0) {
          smoothness -= Math.abs(value - Math.log2(board[i + 1][j]));
        }
      }
    }
  }
  
  return smoothness;
}

/**
 * 角落奖励 - 最大方块在角落时给予奖励
 * 优化版本：增加蛇形排列奖励
 */
export function cornerBonus(board: number[][]): number {
  const size = board.length;
  const maxTile = getMaxTile(board);
  
  // 角落位置检查
  const corners = [
    { row: 0, col: 0 },
    { row: 0, col: size - 1 },
    { row: size - 1, col: 0 },
    { row: size - 1, col: size - 1 },
  ];
  
  let bonus = 0;
  
  // 最大方块在角落的奖励
  for (const corner of corners) {
    if (board[corner.row][corner.col] === maxTile) {
      bonus += maxTile;
      
      // 额外奖励：检查蛇形排列（大数在边缘递减）
      bonus += calculateSnakeBonus(board, corner);
      break;
    }
  }
  
  return bonus;
}

/**
 * 计算蛇形排列奖励
 * 鼓励大数沿着边缘递减排列
 */
function calculateSnakeBonus(board: number[][], corner: { row: number; col: number }): number {
  const size = board.length;
  let bonus = 0;
  
  // 根据角落位置定义蛇形权重矩阵
  const weights = createSnakeWeights(size, corner);
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] > 0) {
        bonus += Math.log2(board[i][j]) * weights[i][j];
      }
    }
  }
  
  return bonus * 0.1; // 缩放因子
}

/**
 * 创建蛇形权重矩阵
 */
function createSnakeWeights(size: number, corner: { row: number; col: number }): number[][] {
  const weights: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));
  
  // 简化的蛇形权重：距离角落越近权重越高
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const distRow = Math.abs(i - corner.row);
      const distCol = Math.abs(j - corner.col);
      weights[i][j] = Math.pow(0.5, distRow + distCol);
    }
  }
  
  return weights;
}

/**
 * 综合评估函数（均衡模式）
 */
export function evaluateBoard(board: number[][]): number {
  const emptyCells = countEmptyCells(board);
  const maxTile = getMaxTile(board);
  
  // 根据游戏阶段动态调整权重
  const emptyRatio = emptyCells / (board.length * board.length);
  const gamePhaseMultiplier = emptyRatio < 0.2 ? 1.5 : 1.0; // 空格少时更重视空格
  
  return (
    emptyCells * BALANCED_WEIGHTS.emptyWeight * gamePhaseMultiplier +
    calculateMonotonicity(board) * BALANCED_WEIGHTS.monotonicityWeight +
    calculateSmoothness(board) * BALANCED_WEIGHTS.smoothnessWeight +
    Math.log2(maxTile + 1) * BALANCED_WEIGHTS.maxTileWeight +
    cornerBonus(board) * BALANCED_WEIGHTS.cornerWeight
  );
}

/**
 * 综合评估函数（最优模式）
 * 更精细的评估，考虑更多因素
 */
export function evaluateBoardOptimal(board: number[][]): number {
  const emptyCells = countEmptyCells(board);
  const maxTile = getMaxTile(board);
  const size = board.length;
  
  // 根据游戏阶段动态调整权重
  const emptyRatio = emptyCells / (size * size);
  const gamePhaseMultiplier = emptyRatio < 0.15 ? 2.0 : emptyRatio < 0.3 ? 1.5 : 1.0;
  
  // 合并潜力：相邻相同数字的数量
  const mergePotential = calculateMergePotential(board);
  
  return (
    emptyCells * OPTIMAL_WEIGHTS.emptyWeight * gamePhaseMultiplier +
    calculateMonotonicity(board) * OPTIMAL_WEIGHTS.monotonicityWeight +
    calculateSmoothness(board) * OPTIMAL_WEIGHTS.smoothnessWeight +
    Math.log2(maxTile + 1) * OPTIMAL_WEIGHTS.maxTileWeight +
    cornerBonus(board) * OPTIMAL_WEIGHTS.cornerWeight +
    mergePotential * 0.5
  );
}

/**
 * 计算合并潜力 - 相邻相同数字的数量
 */
function calculateMergePotential(board: number[][]): number {
  const size = board.length;
  let potential = 0;
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] !== 0) {
        // 检查右边
        if (j < size - 1 && board[i][j] === board[i][j + 1]) {
          potential += Math.log2(board[i][j]);
        }
        // 检查下边
        if (i < size - 1 && board[i][j] === board[i + 1][j]) {
          potential += Math.log2(board[i][j]);
        }
      }
    }
  }
  
  return potential;
}


// ============================================
// 快速模式算法
// ============================================

/**
 * 快速模式移动
 * 优化版本：结合简单评估，避免卡死
 */
export function fastModeMove(board: number[][]): Direction | null {
  // 优先级顺序：down > right > left > up
  const priorities: Direction[] = ['down', 'right', 'left', 'up'];
  
  // 首先尝试按优先级移动
  for (const direction of priorities) {
    if (canMove(board, direction)) {
      // 简单检查：如果这个移动会导致很快卡死，尝试其他方向
      const result = simulateMove(board, direction);
      const emptyCells = countEmptyCells(result.board);
      
      // 如果移动后还有足够空格，或者没有其他选择，就执行
      if (emptyCells >= 2) {
        return direction;
      }
    }
  }
  
  // 如果所有优先移动都会导致空格太少，选择能产生最多空格的移动
  let bestMove: Direction | null = null;
  let maxEmpty = -1;
  
  for (const direction of DIRECTIONS) {
    if (canMove(board, direction)) {
      const result = simulateMove(board, direction);
      const emptyCells = countEmptyCells(result.board);
      if (emptyCells > maxEmpty) {
        maxEmpty = emptyCells;
        bestMove = direction;
      }
    }
  }
  
  return bestMove;
}


// ============================================
// 均衡模式算法 (Minimax)
// ============================================

/**
 * Minimax搜索算法
 * @param board 当前棋盘
 * @param depth 搜索深度
 * @param isMaxPlayer 是否为最大化玩家
 */
function minimax(board: number[][], depth: number, isMaxPlayer: boolean): number {
  if (depth === 0) {
    return evaluateBoard(board);
  }
  
  if (isMaxPlayer) {
    // 玩家回合：选择最大值
    let maxScore = -Infinity;
    
    for (const direction of DIRECTIONS) {
      const result = simulateMove(board, direction);
      if (result.moved) {
        const score = minimax(result.board, depth - 1, false);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return maxScore === -Infinity ? evaluateBoard(board) : maxScore;
  } else {
    // 对手回合（随机放置方块）：选择最小值
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) {
      return minimax(board, depth - 1, true);
    }
    
    let minScore = Infinity;
    
    // 简化：只考虑几个随机位置，避免搜索空间过大
    const sampleCells = emptyCells.slice(0, Math.min(4, emptyCells.length));
    
    for (const cell of sampleCells) {
      // 只考虑放置2（概率更高）
      const newBoard = cloneBoard(board);
      newBoard[cell.row][cell.col] = 2;
      const score = minimax(newBoard, depth - 1, true);
      minScore = Math.min(minScore, score);
    }
    
    return minScore === Infinity ? evaluateBoard(board) : minScore;
  }
}

/**
 * 均衡模式移动
 * 使用Minimax搜索，深度2-3
 */
export function balancedModeMove(board: number[][]): Direction | null {
  const depth = 2;
  let bestMove: Direction | null = null;
  let bestScore = -Infinity;
  
  for (const direction of DIRECTIONS) {
    const result = simulateMove(board, direction);
    if (result.moved) {
      const score = minimax(result.board, depth - 1, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = direction;
      }
    }
  }
  
  return bestMove;
}


// ============================================
// 最优模式算法 (Expectimax)
// ============================================

/**
 * Expectimax搜索算法
 * 考虑随机方块生成的概率（90%生成2，10%生成4）
 * 优化版本：使用转置表缓存
 * @param board 当前棋盘
 * @param depth 搜索深度
 * @param isMaxPlayer 是否为最大化玩家
 */
function expectimax(board: number[][], depth: number, isMaxPlayer: boolean): number {
  // 检查缓存
  const cacheKey = `${boardToKey(board)}_${depth}_${isMaxPlayer}`;
  const cached = transpositionTable.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  if (depth === 0) {
    return evaluateBoardOptimal(board);
  }
  
  let result: number;
  
  if (isMaxPlayer) {
    // 玩家回合：选择最大值
    let maxScore = -Infinity;
    
    for (const direction of DIRECTIONS) {
      const moveResult = simulateMove(board, direction);
      if (moveResult.moved) {
        const score = expectimax(moveResult.board, depth - 1, false);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    result = maxScore === -Infinity ? evaluateBoardOptimal(board) : maxScore;
  } else {
    // 随机回合：计算期望值
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) {
      result = expectimax(board, depth - 1, true);
    } else {
      let expectedScore = 0;
      
      // 优化采样：根据空格数量动态调整采样数
      const maxSamples = Math.min(emptyCells.length, depth > 3 ? 4 : 6);
      
      // 随机采样而不是顺序采样
      const sampledCells = emptyCells.length <= maxSamples 
        ? emptyCells 
        : shuffleAndTake(emptyCells, maxSamples);
      
      const probability = 1 / sampledCells.length;
      
      for (const cell of sampledCells) {
        // 90%概率生成2
        const board2 = cloneBoard(board);
        board2[cell.row][cell.col] = 2;
        expectedScore += 0.9 * probability * expectimax(board2, depth - 1, true);
        
        // 10%概率生成4
        const board4 = cloneBoard(board);
        board4[cell.row][cell.col] = 4;
        expectedScore += 0.1 * probability * expectimax(board4, depth - 1, true);
      }
      
      result = expectedScore;
    }
  }
  
  // 存入缓存
  clearCacheIfNeeded();
  transpositionTable.set(cacheKey, result);
  
  return result;
}

/**
 * 随机打乱数组并取前n个元素
 */
function shuffleAndTake<T>(array: T[], n: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

/**
 * 最优模式移动
 * 使用Expectimax算法，自适应深度（4-6）
 */
export function optimalModeMove(board: number[][]): Direction | null {
  // 每次调用前清理缓存（避免内存泄漏）
  transpositionTable.clear();
  
  const emptyCells = countEmptyCells(board);
  // 自适应深度：空格多时搜索较浅，空格少时搜索更深
  const depth = emptyCells > 8 ? 3 : emptyCells > 5 ? 4 : emptyCells > 3 ? 5 : 6;
  
  let bestMove: Direction | null = null;
  let bestScore = -Infinity;
  
  for (const direction of DIRECTIONS) {
    const result = simulateMove(board, direction);
    if (result.moved) {
      const score = expectimax(result.board, depth - 1, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = direction;
      }
    }
  }
  
  return bestMove;
}


// ============================================
// N-Tuple Network模式算法 (Expectimax with N-Tuple Evaluation)
// ============================================

/** N-Tuple Network转置表缓存 */
const nTupleTranspositionTable = new Map<string, number>();

/** N-Tuple Network实例（延迟初始化） */
let nTupleNetworkInstance: NTupleNetwork | null = null;

/** 是否正在加载权重 */
let isLoadingWeights = false;

/** 权重加载Promise */
let weightsLoadingPromise: Promise<NTupleNetwork> | null = null;

/**
 * 获取N-Tuple Network实例（单例模式）
 * 同步获取，如果未加载则使用默认启发式权重
 */
function getNTupleNetwork(): NTupleNetwork {
  if (!nTupleNetworkInstance) {
    // 如果没有预加载的实例，使用同步创建的默认权重
    nTupleNetworkInstance = createDefaultNTupleNetwork();
  }
  return nTupleNetworkInstance;
}

/**
 * 异步初始化N-Tuple Network
 * 在后台加载训练权重，加载完成后自动替换实例
 */
export async function initNTupleNetworkAsync(): Promise<NTupleNetwork> {
  if (nTupleNetworkInstance) {
    return nTupleNetworkInstance;
  }
  
  if (weightsLoadingPromise) {
    return weightsLoadingPromise;
  }
  
  isLoadingWeights = true;
  weightsLoadingPromise = createNTupleNetworkAsync().then(network => {
    nTupleNetworkInstance = network;
    isLoadingWeights = false;
    weightsLoadingPromise = null;
    return network;
  }).catch(error => {
    console.warn('Failed to load trained weights, using defaults:', error);
    nTupleNetworkInstance = createDefaultNTupleNetwork();
    isLoadingWeights = false;
    weightsLoadingPromise = null;
    return nTupleNetworkInstance;
  });
  
  return weightsLoadingPromise;
}

/**
 * 检查权重是否正在加载
 */
export function isNTupleWeightsLoading(): boolean {
  return isLoadingWeights;
}

/**
 * 重置N-Tuple Network实例
 * 主要用于测试或重新加载权重
 */
export function resetNTupleNetwork(): void {
  nTupleNetworkInstance = null;
}

/**
 * 设置自定义N-Tuple Network实例
 * 用于加载自定义权重
 */
export function setNTupleNetwork(network: NTupleNetwork): void {
  nTupleNetworkInstance = network;
}

/**
 * N-Tuple Expectimax搜索算法
 * 使用N-Tuple Network作为评估函数
 * 
 * @param board 当前棋盘
 * @param depth 搜索深度
 * @param isMaxPlayer 是否为最大化玩家
 * @param network N-Tuple Network实例
 * @returns 评估分数
 */
function nTupleExpectimax(
  board: number[][],
  depth: number,
  isMaxPlayer: boolean,
  network: NTupleNetwork
): number {
  // 检查缓存
  const cacheKey = `ntuple_${boardToKey(board)}_${depth}_${isMaxPlayer}`;
  const cached = nTupleTranspositionTable.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  // 叶子节点：使用N-Tuple Network评估
  if (depth === 0) {
    return network.evaluate(board);
  }
  
  let result: number;
  
  if (isMaxPlayer) {
    // 玩家回合：选择最大值
    let maxScore = -Infinity;
    
    for (const direction of DIRECTIONS) {
      const moveResult = simulateMove(board, direction);
      if (moveResult.moved) {
        const score = nTupleExpectimax(moveResult.board, depth - 1, false, network);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    result = maxScore === -Infinity ? network.evaluate(board) : maxScore;
  } else {
    // 随机回合：计算期望值
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) {
      result = nTupleExpectimax(board, depth - 1, true, network);
    } else {
      let expectedScore = 0;
      
      // 优化采样：根据空格数量和深度动态调整采样数
      const maxSamples = Math.min(emptyCells.length, depth > 3 ? 4 : 6);
      
      // 随机采样
      const sampledCells = emptyCells.length <= maxSamples 
        ? emptyCells 
        : shuffleAndTake(emptyCells, maxSamples);
      
      const probability = 1 / sampledCells.length;
      
      for (const cell of sampledCells) {
        // 90%概率生成2
        const board2 = cloneBoard(board);
        board2[cell.row][cell.col] = 2;
        expectedScore += 0.9 * probability * nTupleExpectimax(board2, depth - 1, true, network);
        
        // 10%概率生成4
        const board4 = cloneBoard(board);
        board4[cell.row][cell.col] = 4;
        expectedScore += 0.1 * probability * nTupleExpectimax(board4, depth - 1, true, network);
      }
      
      result = expectedScore;
    }
  }
  
  // 存入缓存
  if (nTupleTranspositionTable.size > MAX_CACHE_SIZE) {
    nTupleTranspositionTable.clear();
  }
  nTupleTranspositionTable.set(cacheKey, result);
  
  return result;
}

/**
 * N-Tuple Network模式移动
 * 使用Expectimax算法配合N-Tuple Network评估函数
 * 
 * Requirements: 5.1, 5.2, 5.5
 * 
 * @param board 当前棋盘状态
 * @returns 最佳移动方向，如果没有可用移动返回null
 */
export function nTupleModeMove(board: number[][]): Direction | null {
  // 清理缓存
  nTupleTranspositionTable.clear();
  
  // 获取N-Tuple Network实例
  const network = getNTupleNetwork();
  
  const emptyCells = countEmptyCells(board);
  // 自适应深度：空格多时搜索较浅，空格少时搜索更深
  // N-Tuple评估更快，可以使用稍深的搜索
  const depth = emptyCells > 10 ? 3 : emptyCells > 6 ? 4 : emptyCells > 3 ? 5 : 6;
  
  let bestMove: Direction | null = null;
  let bestScore = -Infinity;
  
  for (const direction of DIRECTIONS) {
    const result = simulateMove(board, direction);
    if (result.moved) {
      const score = nTupleExpectimax(result.board, depth - 1, false, network);
      if (score > bestScore) {
        bestScore = score;
        bestMove = direction;
      }
    }
  }
  
  return bestMove;
}


// ============================================
// 统一接口
// ============================================

/**
 * 获取最佳移动方向
 * 根据指定模式调用对应的算法
 * @param board 当前棋盘状态
 * @param mode AI模式
 * @returns 最佳移动方向，如果没有可用移动返回null
 */
export function getBestMove(board: number[][], mode: AIMode): Direction | null {
  switch (mode) {
    case 'fast':
      return fastModeMove(board);
    case 'balanced':
      return balancedModeMove(board);
    case 'optimal':
      return optimalModeMove(board);
    case 'ntuple':
      return nTupleModeMove(board);
    default:
      return fastModeMove(board);
  }
}
