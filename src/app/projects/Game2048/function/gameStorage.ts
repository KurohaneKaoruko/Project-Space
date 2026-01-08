/**
 * 游戏状态持久化模块
 * 
 * 负责将游戏状态序列化到localStorage并从中恢复。
 * 包含数据验证和版本兼容性检查。
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import type { GameState, SerializedGameState } from '../types';
import { boardToTiles, isGameOver } from './gameEngine';

/** 存储格式版本号，用于未来的格式升级 */
const STORAGE_VERSION = 1;

/** localStorage存储键名 */
const STORAGE_KEY = 'game2048_state';

/**
 * 验证棋盘数据是否有效
 * 检查棋盘是否为有效的二维数组，且所有值都是0或2的幂次方
 * 
 * @param board 待验证的棋盘数据
 * @returns 如果棋盘有效返回true，否则返回false
 */
export function isValidBoard(board: unknown): board is number[][] {
  // 检查是否为数组
  if (!Array.isArray(board)) return false;
  
  // 检查棋盘大小是否在有效范围内 (2-8)
  if (board.length < 2 || board.length > 8) return false;
  
  const size = board.length;
  
  // 检查每一行
  return board.every(row => {
    // 检查行是否为数组
    if (!Array.isArray(row)) return false;
    
    // 检查行长度是否与棋盘大小一致（正方形棋盘）
    if (row.length !== size) return false;
    
    // 检查每个单元格的值
    return row.every(cell => {
      // 必须是数字
      if (typeof cell !== 'number') return false;
      
      // 0是有效值（空格）
      if (cell === 0) return true;
      
      // 必须是正数且是2的幂次方
      if (cell <= 0) return false;
      
      // 检查是否为2的幂次方: log2(cell)必须是整数
      const log2Value = Math.log2(cell);
      return Number.isInteger(log2Value);
    });
  });
}

/**
 * 保存游戏状态到localStorage
 * 将游戏状态序列化为JSON并存储
 * 
 * Requirements: 6.1, 6.4
 * 
 * @param state 要保存的游戏状态
 */
export function saveGameState(state: GameState): void {
  try {
    const serialized: SerializedGameState = {
      version: STORAGE_VERSION,
      board: state.board,
      score: state.score,
      size: state.size,
      highScore: state.highScore,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    // localStorage可能因为配额限制或隐私模式而失败
    console.warn('Failed to save game state:', e);
  }
}

/**
 * 从localStorage加载游戏状态
 * 包含版本检查和数据验证
 * 
 * Requirements: 6.2, 6.3, 6.4
 * 
 * @returns 游戏状态，如果不存在或格式错误返回null
 */
export function loadGameState(): GameState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    
    // 没有保存的数据
    if (!data) return null;
    
    const parsed: unknown = JSON.parse(data);
    
    // 类型检查
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('Invalid game state format, starting new game');
      return null;
    }
    
    const serialized = parsed as Partial<SerializedGameState>;
    
    // 版本检查 (Requirement 6.4)
    if (serialized.version !== STORAGE_VERSION) {
      console.warn(`Game state version mismatch (expected ${STORAGE_VERSION}, got ${serialized.version}), starting new game`);
      return null;
    }
    
    // 数据验证 (Requirement 6.3)
    if (!isValidBoard(serialized.board)) {
      console.warn('Invalid board data, starting new game');
      return null;
    }
    
    // 验证其他必要字段
    if (typeof serialized.score !== 'number' || serialized.score < 0) {
      console.warn('Invalid score data, starting new game');
      return null;
    }
    
    if (typeof serialized.size !== 'number' || serialized.size < 4 || serialized.size > 7) {
      console.warn('Invalid size data, starting new game');
      return null;
    }
    
    if (typeof serialized.highScore !== 'number' || serialized.highScore < 0) {
      console.warn('Invalid highScore data, starting new game');
      return null;
    }
    
    // 验证棋盘大小与size字段一致
    if (serialized.board.length !== serialized.size) {
      console.warn('Board size mismatch, starting new game');
      return null;
    }
    
    // 构建完整的GameState
    return {
      board: serialized.board,
      tiles: boardToTiles(serialized.board),
      score: serialized.score,
      gameOver: isGameOver(serialized.board),
      size: serialized.size,
      highScore: serialized.highScore,
    };
  } catch (e) {
    // JSON解析错误或其他异常 (Requirement 6.3)
    console.warn('Failed to load game state:', e);
    return null;
  }
}

/**
 * 清除保存的游戏状态
 * 用于游戏重置时清除持久化数据
 */
export function clearGameState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear game state:', e);
  }
}
