/**
 * 游戏历史管理Hook
 * 
 * 用于管理游戏状态的历史记录，支持撤销功能。
 * 实现了历史记录长度限制，确保内存使用可控。
 * 
 * @module useGameHistory
 */

import { useState, useCallback, useRef } from 'react';
import { HistoryEntry, GameHistoryOptions, GameHistoryReturn } from '../types';

/** 默认最大历史记录数 */
const DEFAULT_MAX_HISTORY = 5;

/**
 * 游戏历史管理Hook
 * 
 * 提供历史记录的添加、撤销和清空功能。
 * 历史记录使用栈结构存储，最新状态在栈顶。
 * 
 * @param options - 配置选项
 * @param options.maxHistory - 最大历史记录数，默认5
 * @returns 历史管理接口
 * 
 * @example
 * ```typescript
 * const { history, canUndo, pushState, popState, clearHistory } = useGameHistory({ maxHistory: 5 });
 * 
 * // 添加新状态
 * pushState({ board: [[2, 0], [0, 2]], score: 0 });
 * 
 * // 撤销
 * if (canUndo) {
 *   const previousState = popState();
 * }
 * 
 * // 清空历史（游戏重新开始时）
 * clearHistory();
 * ```
 */
export function useGameHistory(options?: GameHistoryOptions): GameHistoryReturn {
  const maxHistory = options?.maxHistory ?? DEFAULT_MAX_HISTORY;
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  // 使用ref来同步访问历史记录，避免异步状态更新问题
  const historyRef = useRef<HistoryEntry[]>([]);

  /**
   * 添加新状态到历史记录
   * 
   * 如果历史记录已达到最大长度，会移除最旧的记录。
   * 
   * @param entry - 要添加的历史记录项
   */
  const pushState = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      // 创建新的历史记录数组
      const newHistory = [...prev, entry];
      
      // 如果超过最大长度，移除最旧的记录
      let result: HistoryEntry[];
      if (newHistory.length > maxHistory) {
        result = newHistory.slice(newHistory.length - maxHistory);
      } else {
        result = newHistory;
      }
      
      // 同步更新ref
      historyRef.current = result;
      return result;
    });
  }, [maxHistory]);

  /**
   * 弹出最近的状态（撤销操作）
   * 
   * 从历史记录中移除并返回最近的状态。
   * 如果历史记录为空，返回undefined。
   * 
   * @returns 最近的历史记录项，如果历史为空则返回undefined
   */
  const popState = useCallback((): HistoryEntry | undefined => {
    // 使用ref同步获取当前历史记录
    const currentHistory = historyRef.current;
    
    if (currentHistory.length === 0) {
      return undefined;
    }
    
    // 获取最后一个元素
    const poppedEntry = currentHistory[currentHistory.length - 1];
    
    // 更新历史记录
    const newHistory = currentHistory.slice(0, -1);
    historyRef.current = newHistory;
    setHistory(newHistory);
    
    return poppedEntry;
  }, []);

  /**
   * 清空历史记录
   * 
   * 在游戏重新开始时调用，清除所有历史记录。
   */
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  /**
   * 是否可以撤销
   * 
   * 当历史记录不为空时，可以执行撤销操作。
   */
  const canUndo = history.length > 0;

  return {
    history,
    canUndo,
    pushState,
    popState,
    clearHistory,
  };
}

export default useGameHistory;
