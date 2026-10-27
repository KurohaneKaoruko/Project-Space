'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import SnakeBoard from './components/SnakeBoard';
import SnakeHUD from './components/SnakeHUD';
import SnakeAIControls from './components/SnakeAIControls';
import { useSnake } from './function/useSnake';
import { useSnakeAIController } from './function/useAIController';
import type { Direction } from './types';

const MAP_SIZES = [32, 64, 96, 31, 63, 95] as const;

function dirFromKey(key: string): Direction | null {
  if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'Up';
  if (key === 'ArrowDown' || key === 's' || key === 'S') return 'Down';
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'Left';
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'Right';
  return null;
}

export default function SnakePage() {
  const { state, settings, setSettings, setDirection, step, restart, togglePause } = useSnake({ width: 32, height: 32, tickMs: 120 });
  const ai = useSnakeAIController({ state, onStep: step });
  const startAI = ai.start;
  const [autoStartAI, setAutoStartAI] = useState(false);
  const didInitRef = useRef(false);

  // Auto-start AI when game becomes running (after restart)
  useEffect(() => {
    if (autoStartAI && state.status === 'running') {
      startAI();
      setAutoStartAI(false);
    }
  }, [state.status, autoStartAI, startAI]);

  // Fix Hydration mismatch: Re-randomize food on mount
  // Also ensure game is in 'running' state initially or 'paused' to wait for user?
  // Actually, 'running' is fine, but AI shouldn't start immediately unless user clicks.
  // The bug "Immediate Game Over on AI Start" might be because AI sends a move BEFORE state is ready?
  // Or state has snake colliding?
  
  // Double check restart.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    restart();
  }, [restart]);

  useEffect(() => {
    if (ai.isRunning) return;
    if (state.status !== 'running') return;
    const timer = setInterval(() => step(), Math.max(0, Math.floor(settings.tickMs)));
    return () => clearInterval(timer);
  }, [ai.isRunning, settings.tickMs, state.status, step]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const d = dirFromKey(e.key);
      if (d) {
        e.preventDefault();
        setDirection(d);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (ai.isRunning) ai.stop();
        togglePause();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (ai.isRunning) ai.stop();
        restart();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ai, restart, setDirection, togglePause]);

  const sizeLabel = useMemo(() => `${settings.width}x${settings.height}`, [settings.height, settings.width]);

  function onRestart() {
    ai.stop();
    restart();
  }

  function onTogglePause() {
    ai.stop();
    togglePause();
  }

  function handleAIStart() {
    if (state.status === 'game_over' || state.status === 'passed') {
        restart();
        setAutoStartAI(true);
    } else if (state.status === 'paused') {
        togglePause();
        // Since togglePause is sync state update in React batching (usually),
        // we might need to wait? Actually status change is async.
        // So use autoStartAI for paused too.
        setAutoStartAI(true);
    } else {
        ai.start();
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, 
          backgroundSize: '40px 40px' 
        }} 
      />
      
      <Navigation title="SNAKE_AI" />

      <div className="flex min-h-screen flex-col pb-10 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(520px,1fr)_320px] gap-6 items-stretch">
            
            {/* Left Column: Game Settings */}
            <section className="w-full xl:w-[320px] bg-white/80 backdrop-blur-sm border border-zinc-200 shadow-xl shadow-zinc-200/50 rounded-lg p-6 space-y-8 order-2 xl:order-1 transition-all hover:shadow-2xl hover:shadow-zinc-200/60 duration-300 relative">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-zinc-900 rounded-full"></div>
                    <div className="text-sm font-bold text-zinc-800 tracking-wide">游戏控制</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-1 bg-zinc-100 text-[10px] font-mono font-bold text-zinc-500 rounded-md border border-zinc-200">{sizeLabel}</div>
                    
                    {/* Help Icon & Tooltip */}
                    <div className="relative group">
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-help hover:bg-zinc-200 hover:text-zinc-600 transition-colors">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        
                        {/* Tooltip Content */}
                        <div className="absolute right-0 top-full mt-2 w-[280px] p-4 bg-white border border-zinc-200 shadow-xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto transform origin-top-right scale-95 group-hover:scale-100">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-100 pb-2">操作指南</div>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-zinc-500">移动</span>
                                    <div className="flex gap-1">
                                        <kbd className="px-1.5 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm min-w-[20px] text-center">W</kbd>
                                        <kbd className="px-1.5 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm min-w-[20px] text-center">A</kbd>
                                        <kbd className="px-1.5 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm min-w-[20px] text-center">S</kbd>
                                        <kbd className="px-1.5 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm min-w-[20px] text-center">D</kbd>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-zinc-500">功能</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-400">暂停/继续</span>
                                            <kbd className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm">SPACE</kbd>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-400">快速重开</span>
                                            <kbd className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono text-zinc-600 shadow-sm">ENTER</kbd>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              <SnakeHUD state={state} />

              {/* Game Controls */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onRestart}
                  className="px-4 py-4 bg-zinc-900 text-white text-xs font-bold tracking-wider uppercase hover:bg-zinc-800 transition-all rounded-lg shadow-lg shadow-zinc-900/20 active:scale-[0.98]"
                >
                  重新开始
                </button>
                <button
                  onClick={onTogglePause}
                  className="px-4 py-4 bg-white border-2 border-zinc-100 text-zinc-600 text-xs font-bold tracking-wider uppercase hover:border-zinc-300 hover:text-zinc-900 transition-all rounded-lg active:scale-[0.98]"
                >
                  {state.status === 'paused' ? '继续' : '暂停'}
                </button>
              </div>

              {/* Map Size */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 font-mono uppercase mb-3 tracking-wider">地图尺寸</label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-lg">
                  {MAP_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        ai.stop();
                        setSettings({ width: size, height: size });
                      }}
                      className={`py-2 text-[10px] font-bold tracking-widest font-mono rounded-md transition-all duration-200 ${
                        settings.width === size
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {size}x{size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Human Speed */}
              <div>
                <div className="flex justify-between mb-3">
                  <label className="block text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">玩家速度</label>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{settings.tickMs}ms</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={300}
                  value={settings.tickMs}
                  onChange={(e) => setSettings({ tickMs: Number(e.target.value) })}
                  className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900 hover:accent-zinc-700"
                  disabled={ai.isRunning}
                />
              </div>
            </section>

            {/* Middle Column: Simulation Area */}
            <section className="w-full flex flex-col items-stretch order-1 xl:order-2">
              <div className="w-full mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${ai.isRunning ? 'bg-blue-500 animate-pulse' : 'bg-zinc-300'}`}></div>
                  <span className="text-sm font-bold text-zinc-700 tracking-wider uppercase">模拟视窗</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    ai.isRunning 
                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                        : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                }`}>
                    {ai.isRunning ? 'AI 托管中' : '手动模式'}
                </div>
              </div>

              <SnakeBoard
                width={state.width}
                height={state.height}
                snake={state.snake}
                food={state.food}
                tick={state.tick}
                status={state.status}
                onRestart={onRestart}
              />
            </section>

            {/* Right Column: AI Settings */}
            <section className="w-full xl:w-[320px] bg-white/80 backdrop-blur-sm border border-zinc-200 shadow-xl shadow-zinc-200/50 rounded-lg p-6 space-y-8 order-3 transition-all hover:shadow-2xl hover:shadow-zinc-200/60 duration-300">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                 <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    <div className="text-sm font-bold text-zinc-800 tracking-wide">AI 设置</div>
                </div>
              </div>
              
              <SnakeAIControls ai={ai} status={state.status} onStartAI={handleAIStart} />

              <div className="text-[11px] text-zinc-500 leading-relaxed bg-blue-50/50 p-4 rounded-lg border border-blue-100/50">
                <p className="mb-2 font-bold text-blue-900/70">算法说明:</p>
                {ai.strategy === 'greedy' && (
                   <p>贪婪算法：仅关注眼前利益，直接冲向食物，容易陷入死胡同。</p>
                )}
                {ai.strategy === 'safe' && (
                   <p>保守算法：寻找食物的同时会规避死路，但可能会在吃掉食物后将自己围困。</p>
                )}
                {ai.strategy === 'strong' && (
                   <p>生存算法：AI 使用 <span className="font-mono font-bold text-blue-700">A*</span> 变体。不仅寻找最短路径，还会预判吃掉食物后是否能安全撤离（寻找尾巴），是生存率最高的策略。</p>
                )}
                {ai.strategy === 'hamiltonian' && (
                   <p>Hamilton 算法：构建一条覆盖全图的哈密顿回路。AI 默认沿回路移动（100% 安全），但在确保安全（不撞尾）的前提下会“抄近路”以最快速度吃到食物。这是理论上的最优解。</p>
                )}
                {ai.strategy === 'custom' && (
                   <p>自定义脚本：运行用户编写的 JavaScript 代码逻辑。你可以访问 <span className="font-mono text-amber-600">state</span> 和 <span className="font-mono text-amber-600">utils</span> 对象来编写自己的贪吃蛇 AI。</p>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
