'use client';

import Link from 'next/link';
import { useGame2048 } from './function/useGame2048';
import GameBoard from './components/GameBoard';
import GameStatus from './components/GameStatus';
import GameOver from './components/GameOver';
import CollapsibleGameRules from './components/CollapsibleGameRules';
import EmbeddedRankings from './components/EmbeddedRankings';
import { useEffect, useState } from 'react';

export default function Game2048Page() {
  const {
    board,
    score,
    gameOver,
    size,
    highScore,
    onSizeChange,
    onRestart,
    onSubmitScore,
  } = useGame2048();

  const [isMobile, setIsMobile] = useState(true);

  // 监听窗口尺寸变化
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 添加meta标签确保移动设备的正确缩放
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-4 px-4 flex flex-col">
      <div className="w-full max-w-screen-xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            返回首页
          </Link>
          {!isMobile && <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">2048 游戏</h1>}
          <Link 
            href="/projects" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            更多其他项目
            <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-6">
          {/* 游戏主区域 */}
          <div className="lg:flex-1 bg-white rounded-xl shadow-md overflow-hidden mb-4 lg:mb-0 p-4">
            {isMobile && <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">2048 游戏</h1>}
            <div className="flex flex-col lg:flex-row lg:space-x-6">
              {/* 左侧状态区域 */}
              <div className="lg:w-48 flex-shrink-0 space-y-3">
                <GameStatus size={size} score={score} highScore={highScore} onRestart={onRestart} onSizeChange={onSizeChange} />
                <CollapsibleGameRules />
              </div>
              
              {/* 游戏棋盘 */}
              <div className="flex-1">
                <GameBoard board={board} />
              </div>
            </div>
            
            {gameOver && (
              <GameOver score={score} onRestart={onRestart} onSubmitScore={onSubmitScore}/>
            )}
          </div>
          
          {/* 右侧排行榜区域 */}
          <div className="lg:w-80 xl:w-96 bg-white rounded-xl shadow-md overflow-hidden">
            <EmbeddedRankings size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}
