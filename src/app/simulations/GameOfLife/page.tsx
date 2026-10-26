'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { GameOfLife } from './simulation';

export default function GameOfLifePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<GameOfLife | null>(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [density, setDensity] = useState(0.2);
  const [cellSize, setCellSize] = useState(10); // px
  const [colorTheme, setColorTheme] = useState('dark'); // dark | light

  // Interaction
  const isDragging = useRef(false);
  const cellSizeRef = useRef(cellSize);
  const colorThemeRef = useRef(colorTheme);

  const applyTheme = (theme: string, sim: GameOfLife) => {
    if (theme === 'dark') {
      sim.setColors('#10B981', '#18181B');
    } else {
      sim.setColors('#000000', '#FFFFFF');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Initialize Sim
    const sim = new GameOfLife(canvas);
    simRef.current = sim;

    const resize = () => {
       const rect = wrap.getBoundingClientRect();
       const dpr = window.devicePixelRatio || 1;
       const width = rect.width * dpr;
       const height = rect.height * dpr;
       
       // Update CSS size
       canvas.style.width = `${rect.width}px`;
       canvas.style.height = `${rect.height}px`;
       
       sim.resize(width, height, cellSizeRef.current * dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    
    // Apply theme
    applyTheme(colorThemeRef.current, sim);

    return () => {
      sim.stop();
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    cellSizeRef.current = cellSize;
    if (simRef.current) {
        const wrap = wrapRef.current;
        if (wrap) {
          const rect = wrap.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          simRef.current.resize(rect.width * dpr, rect.height * dpr, cellSize * dpr);
        }
    }
  }, [cellSize]);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.setSpeed(speed);
    }
  }, [speed]);

  useEffect(() => {
    colorThemeRef.current = colorTheme;
    if (simRef.current) {
      applyTheme(colorTheme, simRef.current);
    }
  }, [colorTheme]);

  const togglePlay = () => {
    if (simRef.current) {
      if (isRunning) {
        simRef.current.stop();
      } else {
        simRef.current.start();
      }
      setIsRunning(!isRunning);
    }
  };
  
  const step = () => {
    simRef.current?.step();
    setIsRunning(false);
  };

  const clear = () => {
    simRef.current?.clear();
    setIsRunning(false);
  };

  const randomize = () => {
    simRef.current?.randomize(density);
  };

  // Mouse Interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    handlePointerMove(e);
  };
  
  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !simRef.current || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
    
    simRef.current.drawCell(x, y, 1);
  };

  const canvasBgClass = colorTheme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const overlayClass = colorTheme === 'dark' ? 'text-white/50' : 'text-zinc-900/60';

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="GAME_OF_LIFE" />
      
      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Canvas */}
        <div ref={wrapRef} className={`h-64 shrink-0 lg:h-full lg:flex-1 relative ${canvasBgClass} overflow-hidden cursor-crosshair`}>
          <canvas 
            ref={canvasRef}
            className="block"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          <div className={`absolute top-4 left-4 ${overlayClass} text-xs font-mono pointer-events-none`}>
            Generations: Loop
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            
            {/* Header */}
            <div>
               <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                 <span className="w-1 h-4 bg-emerald-500"></span>
                 控制面板
               </h2>
               <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// 康威生命游戏 (Game of Life)'}</p>
            </div>

            {/* Main Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={togglePlay}
                className={`px-4 py-3 rounded-md font-bold text-sm transition-colors ${
                  isRunning 
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {isRunning ? '暂停 (Pause)' : '开始 (Play)'}
              </button>
              <button 
                onClick={step}
                className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-md font-bold text-sm hover:bg-zinc-200 transition-colors"
              >
                单步 (Step)
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-6">
               <ControlSlider 
                 label="速度 (FPS)" 
                 value={speed} min={1} max={120} step={1} 
                 onChange={setSpeed} 
               />
               <ControlSlider 
                 label="网格大小 (Cell Size)" 
                 value={cellSize} min={2} max={40} step={1} 
                 onChange={setCellSize} 
               />
               <ControlSlider 
                 label="初始密度 (Density)" 
                 value={density} min={0.05} max={0.9} step={0.05} 
                 onChange={setDensity} 
               />
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-zinc-100">
               <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">操作</div>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={randomize} className="px-3 py-2 bg-blue-50 text-blue-600 rounded text-xs font-bold hover:bg-blue-100">
                   随机重置
                 </button>
                 <button onClick={clear} className="px-3 py-2 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100">
                   清空画布
                 </button>
               </div>
            </div>

            {/* Theme */}
             <div className="space-y-3 pt-4 border-t border-zinc-100">
               <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">主题</div>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setColorTheme('dark')}
                    className={`flex-1 py-2 text-xs font-bold rounded border ${colorTheme === 'dark' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-500'}`}
                  >
                    暗色
                  </button>
                  <button 
                    onClick={() => setColorTheme('light')}
                    className={`flex-1 py-2 text-xs font-bold rounded border ${colorTheme === 'light' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-500'}`}
                  >
                    亮色
                  </button>
               </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
               <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">规则说明</div>
               <ul className="text-xs text-zinc-600 space-y-1 list-disc pl-4">
                 <li><span className="font-bold">生存</span>: 活细胞周围有 2 或 3 个活邻居。</li>
                 <li><span className="font-bold">死亡</span>: 活细胞周围有 &lt;2 或 &gt;3 个活邻居。</li>
                 <li><span className="font-bold">繁殖</span>: 死细胞周围正好有 3 个活邻居。</li>
               </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ControlSlider({ label, value, min, max, step, onChange }: { 
  label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void 
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
