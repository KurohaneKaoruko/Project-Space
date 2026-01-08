'use client';

import { useEffect, useState } from 'react';
import GameSettings from './GameSettings';
import '../styles/GameStatus.css';

/**
 * GameStatus组件属性
 * 
 * Requirements: 3.3
 */
interface GameStatusProps {
  /** 棋盘大小 */
  size: number;
  /** 当前分数 */
  score: number;
  /** 历史最高分 */
  highScore?: number;
  /** 是否可以撤销 */
  canUndo?: boolean;
  /** 重新开始游戏回调 */
  onRestart: () => void;
  /** 切换棋盘大小回调 */
  onSizeChange: (size: number) => void;
  /** 撤销操作回调 */
  onUndo?: () => void;
}

/**
 * 游戏状态组件
 * 
 * 显示当前分数、最高分数，提供重新开始和撤销按钮。
 * 
 * Requirements: 3.3
 */
export default function GameStatus({ 
  size, 
  score, 
  highScore = 0, 
  canUndo = false,
  onRestart, 
  onSizeChange,
  onUndo 
}: GameStatusProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) return null;

  return (
    <div className="status-container flex flex-col gap-3">
      <div className="score-box">
        <div className="bg-gray-100 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">当前分数</p>
          <p className="text-xl font-bold text-blue-600">{score}</p>
        </div>
        
        <div className="bg-gray-100 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">最高分数</p>
          <p className="text-xl font-bold text-purple-600">{highScore}</p>
        </div>
      </div>

      <GameSettings size={size} onSizeChange={onSizeChange} />
      
      {/* 移动端：按钮并排显示；桌面端：按钮分两行显示 */}
      <div className="flex gap-2 lg:flex-col">
        {/* 撤销按钮 - Requirements: 3.3 */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`
            flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors 
            justify-center flex items-center
            ${canUndo 
              ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
          title={canUndo ? '撤销上一步' : '无法撤销'}
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          撤销
        </button>

        {/* 重新开始按钮 */}
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors justify-center flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          重新开始
        </button>
      </div>
    </div>
  );
}
