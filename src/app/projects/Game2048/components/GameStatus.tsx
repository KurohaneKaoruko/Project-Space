'use client';

import { useEffect, useState } from 'react';
import GameSettings from './GameSettings';
import '../styles/GameStatus.css';

interface GameStatusProps {
  size: number;
  score: number;
  highScore?: number;
  onRestart: () => void;
  onSizeChange: (size: number) => void;
}

export default function GameStatus({ size, score, highScore = 0, onRestart, onSizeChange }: GameStatusProps) {
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
      
      <button
        type="button"
        onClick={onRestart}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors justify-center flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        重新开始
      </button>
    </div>
  );
} 