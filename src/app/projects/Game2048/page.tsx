'use client';

import Link from 'next/link';
import { useGame2048 } from './function/useGame2048';
import GameBoard from './components/GameBoard';
import GameStatus from './components/GameStatus';
import GameOver from './components/GameOver';
import CollapsibleGameRules from './components/CollapsibleGameRules';
import AISettingsPanel from './components/AISettingsPanel';
import { useEffect, useState } from 'react';

export default function Game2048Page() {
  const {
    board,
    tiles,
    score,
    gameOver,
    size,
    highScore,
    canUndo,
    animationState,
    animationDuration,
    onSizeChange,
    onRestart,
    onUndo,
    moveTiles,
    moveImmediate,
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
        {/* 顶部导航栏 */}
        <div className="flex justify-between items-center mb-3 py-2">
          <Link 
            href="/" 
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            首页
          </Link>
          
          <h1 className={`font-bold text-gray-800 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
            2048
          </h1>
          
          <Link 
            href="/projects" 
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow transition-all text-sm font-medium"
          >
            更多
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
                  <GameBoard 
                    board={board} 
                    tiles={tiles}
                    isAnimating={animationState.isAnimating}
                    animationDuration={animationDuration}
                  />
                </div>

                {/* 状态区域 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 lg:col-span-1">
                    <GameStatus size={size} score={score} highScore={highScore} canUndo={canUndo} onRestart={onRestart} onSizeChange={onSizeChange} onUndo={onUndo} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row lg:space-x-6">
                {/* 左侧状态区域 */}
                <div className="lg:w-48 flex-shrink-0 space-y-3">
                  <GameStatus size={size} score={score} highScore={highScore} canUndo={canUndo} onRestart={onRestart} onSizeChange={onSizeChange} onUndo={onUndo} />
                  <CollapsibleGameRules />
                </div>
                
                {/* 游戏棋盘 */}
                <div className="flex-1">
                  <GameBoard 
                    board={board} 
                    tiles={tiles}
                    isAnimating={animationState.isAnimating}
                    animationDuration={animationDuration}
                  />
                </div>
              </div>
            )}
            
            {gameOver && (
              <GameOver score={score} onRestart={onRestart}/>
            )}
          </div>
          
          {/* 右侧AI设置面板区域 - Requirements: 1.1, 1.2 */}
          {!isMobile ? (
            <div className="lg:w-80 xl:w-96 bg-white rounded-xl shadow-md overflow-hidden">
              <AISettingsPanel board={board} gameOver={gameOver} onMove={moveTiles} onMoveImmediate={moveImmediate} />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <AISettingsPanel board={board} gameOver={gameOver} onMove={moveTiles} onMoveImmediate={moveImmediate} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
