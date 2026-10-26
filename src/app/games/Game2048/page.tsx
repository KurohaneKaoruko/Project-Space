'use client';

import Navigation from '../../components/Navigation';
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
    showGameOver,
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
    onCloseGameOver,
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
    <main className="min-h-screen">
      <Navigation title="2048_EVOLUTION" />
      
      <div className="flex min-h-screen flex-col justify-center pb-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          {/* 移动端布局优化 */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* 游戏主区域 */}
            <div className="lg:flex-1 bg-white tech-border border border-zinc-200 p-4 lg:p-6 relative">
              {/* 装饰角标 */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-600"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-600"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-600"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-600"></div>

              {/* 移动端布局：游戏棋盘优先显示 */}
              {isMobile ? (
                <div className="flex flex-col gap-6">
                  {/* 游戏棋盘 */}
                  <div>
                    <GameBoard 
                      board={board} 
                      tiles={tiles}
                      isAnimating={animationState.isAnimating}
                      animationDuration={animationDuration}
                    />
                  </div>

                  {/* 状态区域 */}
                  <div className="w-full">
                    <GameStatus size={size} score={score} highScore={highScore} canUndo={canUndo} onRestart={onRestart} onSizeChange={onSizeChange} onUndo={onUndo} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* 左侧状态区域 */}
                  <div className="lg:w-64 shrink-0 space-y-6">
                    <GameStatus size={size} score={score} highScore={highScore} canUndo={canUndo} onRestart={onRestart} onSizeChange={onSizeChange} onUndo={onUndo} />
                    <CollapsibleGameRules />
                  </div>
                  
                  {/* 游戏棋盘 */}
                  <div className="flex-1 flex justify-center">
                    <GameBoard 
                      board={board} 
                      tiles={tiles}
                      isAnimating={animationState.isAnimating}
                      animationDuration={animationDuration}
                    />
                  </div>
                </div>
              )}
              
              {showGameOver && (
                <GameOver score={score} onRestart={onRestart} onClose={onCloseGameOver}/>
              )}
            </div>
            
            {/* 右侧AI设置面板区域 */}
            <div className="lg:w-80 xl:w-96 bg-white tech-border border border-zinc-200">
              <AISettingsPanel board={board} gameOver={gameOver} onMove={moveTiles} onMoveImmediate={moveImmediate} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
