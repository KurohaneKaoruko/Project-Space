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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-2 px-3 flex flex-col">
      <div className="w-full max-w-screen-xl mx-auto">
        {/* 移动端更紧凑的顶部导航 */}
        <div className="flex justify-between items-center mb-2 py-2">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            返回
          </Link>
          {isMobile && <h1 className="text-lg font-bold text-center text-gray-800">2048</h1>}
          {!isMobile && <h1 className="text-2xl font-bold text-center text-gray-800">2048 游戏</h1>}
          <Link 
            href="/projects" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors text-sm"
          >
            更多
            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
        
        {/* 移动端布局优化 */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-6">
          {/* 游戏主区域 */}
          <div className="lg:flex-1 bg-white rounded-xl shadow-md overflow-hidden mb-3 lg:mb-0 p-3">
            {/* 移动端布局：游戏棋盘优先显示 */}
            {isMobile ? (
              <div className="flex flex-col">
                {/* 游戏棋盘 */}
                <div className="mb-3">
                  <GameBoard board={board} />
                </div>

                {/* 状态区域 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 lg:col-span-1">
                    <GameStatus size={size} score={score} highScore={highScore} onRestart={onRestart} onSizeChange={onSizeChange} />
                  </div>
                </div>
              </div>
            ) : (
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
            )}
            
            {gameOver && (
              <GameOver score={score} onRestart={onRestart} onSubmitScore={onSubmitScore}/>
            )}
          </div>
          
          {/* 右侧排行榜区域 - 移动端下隐藏或显示更紧凑版本 */}
          {!isMobile ? (
            <div className="lg:w-80 xl:w-96 bg-white rounded-xl shadow-md overflow-hidden">
              <EmbeddedRankings size={size} />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden p-3">
              <EmbeddedRankings size={size} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
