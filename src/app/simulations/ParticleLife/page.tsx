'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { ParticleLifeSim, SimulationConfig } from './simulation';

const DEFAULT_CONFIG: SimulationConfig = {
  particleCount: 5000,
  colorsCount: 6,
  friction: 0.9,
  forceFactor: 10.0,
  rMax: 80.0,
  dt: 0.02,
  particleSize: 3.0,
  colors: [
    '#EF4444', // Red
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#EAB308', // Yellow
    '#06B6D4', // Cyan
    '#D946EF', // Magenta
  ]
};

type Preset = {
  name: string;
  config: Partial<SimulationConfig>;
  matrix?: number[]; // Flattened NxN
};

// Known stable configurations
const PRESETS: Preset[] = [
  {
    name: '混沌 (Chaos)',
    config: { friction: 0.9, forceFactor: 10, rMax: 80 },
    // No fixed matrix, uses random
  },
  {
    name: '细胞 (Cells)',
    config: { friction: 0.8, forceFactor: 12, rMax: 40, colorsCount: 6 },
    // Self-assembling clusters
    matrix: [
      1.0, -0.1, 0.3, -0.1, 0.3, -0.1,
      -0.1, 1.0, -0.1, 0.3, -0.1, 0.3,
      0.3, -0.1, 1.0, -0.1, 0.3, -0.1,
      -0.1, 0.3, -0.1, 1.0, -0.1, 0.3,
      0.3, -0.1, 0.3, -0.1, 1.0, -0.1,
      -0.1, 0.3, -0.1, 0.3, -0.1, 1.0
    ]
  },
  {
    name: '蛇 (Snake)',
    config: { friction: 0.85, forceFactor: 20, rMax: 60, colorsCount: 6 },
    // Chains chasing each other
    matrix: [
      0.2, 0.8, -0.2, 0.0, 0.0, 0.0,
      0.0, 0.2, 0.8, -0.2, 0.0, 0.0,
      0.0, 0.0, 0.2, 0.8, -0.2, 0.0,
      0.0, 0.0, 0.0, 0.2, 0.8, -0.2,
      -0.2, 0.0, 0.0, 0.0, 0.2, 0.8,
      0.8, -0.2, 0.0, 0.0, 0.0, 0.2
    ]
  },
];

export default function ParticleLifePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ParticleLifeSim | null>(null);
  const simInitRef = useRef({ initializing: false, started: false });
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [diag, setDiag] = useState<{ dpr: number; cw: number; ch: number; pw: number; ph: number; started: boolean } | null>(null);
  
  // Matrix grid state (NxN)
  const [matrix, setMatrix] = useState<number[]>([]);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resizeAndMaybeInit = async () => {
      const rect = wrap.getBoundingClientRect();
      const pw = Math.floor(rect.width);
      const ph = Math.floor(rect.height);
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.max(1, Math.floor(pw * dpr));
      const ch = Math.max(1, Math.floor(ph * dpr));

      setDiag({ dpr, cw, ch, pw, ph, started: simInitRef.current.started });

      if (pw <= 0 || ph <= 0) return;

      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;

      if (simRef.current) {
        simRef.current.resize(cw, ch);
        return;
      }

      if (simInitRef.current.initializing || simInitRef.current.started) return;
      simInitRef.current.initializing = true;
      setError(null);
      try {
        const sim = new ParticleLifeSim(DEFAULT_CONFIG);
        simRef.current = sim;
        await sim.init(canvas);
        simInitRef.current.started = true;
        const m = sim.randomizeRules();
        setMatrix([...m]);
        setDiag((prev) => (prev ? { ...prev, started: true } : prev));
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'WebGPU initialization failed');
      } finally {
        simInitRef.current.initializing = false;
      }
    };

    resizeAndMaybeInit();
    const ro = new ResizeObserver(() => {
      resizeAndMaybeInit();
    });
    ro.observe(wrap);

    return () => {
      simRef.current?.stop();
      ro.disconnect();
    };
  }, []);

  const updateParam = (key: keyof SimulationConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    if (simRef.current) {
      simRef.current.setConfig({ [key]: value });
    }
  };
  
  const updateColor = (index: number, hex: string) => {
    const newColors = [...(config.colors || [])];
    newColors[index] = hex;
    const newConfig = { ...config, colors: newColors };
    setConfig(newConfig);
    if (simRef.current) {
      simRef.current.setConfig({ colors: newColors });
    }
  };

  const randomize = () => {
    if (simRef.current) {
      const m = simRef.current.randomizeRules();
      setMatrix([...m]);
    }
  };
  
  const updateMatrixCell = (row: number, col: number, val: number) => {
    const N = config.colorsCount;
    const newMatrix = [...matrix];
    newMatrix[row * N + col] = val;
    setMatrix(newMatrix);
    
    if (simRef.current) {
      simRef.current.setConfig({ matrix: newMatrix });
    }
  };

  const loadPreset = (preset: Preset) => {
    const newConfig = { ...config, ...preset.config };
    setConfig(newConfig);
    
    let newMatrix = preset.matrix;
    if (!newMatrix && simRef.current) {
      newMatrix = simRef.current.generateRandomMatrix(newConfig.colorsCount);
    }
    
    if (newMatrix) {
      setMatrix(newMatrix);
      if (simRef.current) {
        simRef.current.setConfig({ ...newConfig, matrix: newMatrix });
      }
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="PARTICLE_LIFE" />
      
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Canvas Area */}
          <div ref={canvasWrapRef} className="h-64 shrink-0 lg:h-full lg:flex-1 relative bg-black overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900/90 text-red-400 p-8 text-center">
              <div>
                <h2 className="text-2xl font-bold mb-2">WebGPU Error</h2>
                <pre className="text-left whitespace-pre-wrap break-words text-sm text-red-300 max-w-[70ch]">{error}</pre>
                <p className="text-sm text-zinc-500 mt-4">Please try Chrome/Edge on Desktop.</p>
              </div>
            </div>
          )}
          <canvas 
            ref={canvasRef} 
            className="block w-full h-full"
          />
          
          <div className="absolute top-4 left-4 text-white/50 font-mono text-xs pointer-events-none">
            粒子数: {config.particleCount}
          </div>
          {diag && (
            <div className="absolute bottom-4 left-4 text-white/50 font-mono text-[10px] pointer-events-none whitespace-pre">
              {`视口: ${diag.pw}x${diag.ph}  画布: ${diag.cw}x${diag.ch}  DPR: ${diag.dpr.toFixed(2)}  已启动: ${diag.started ? '是' : '否'}`}
            </div>
          )}
        </div>

        {/* Controls Sidebar */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
           <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// WebGPU 加速'}</p>
            </div>

            <div className="space-y-5">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">预设 (Presets)</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset)}
                    className="px-3 py-2 bg-zinc-100 hover:bg-blue-50 hover:text-blue-600 text-zinc-600 text-xs font-medium rounded-md transition-colors text-left"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">全局参数</div>
              <ControlSlider 
                label="摩擦系数 (Friction)" 
                value={config.friction} 
                min={0.5} max={0.99} step={0.01} 
                onChange={v => updateParam('friction', v)} 
              />
              <ControlSlider 
                label="作用力系数 (Force)" 
                value={config.forceFactor} 
                min={1} max={50} step={1} 
                onChange={v => updateParam('forceFactor', v)} 
              />
              <ControlSlider 
                label="交互半径 (Radius)" 
                value={config.rMax} 
                min={10} max={200} step={5} 
                onChange={v => updateParam('rMax', v)} 
              />
              <ControlSlider 
                label="时间步长 (DT)" 
                value={config.dt} 
                min={0.001} max={0.1} step={0.001} 
                onChange={v => updateParam('dt', v)} 
              />
              <ControlSlider 
                label="粒子大小 (Size)" 
                value={config.particleSize} 
                min={1.0} max={10.0} step={0.5} 
                onChange={v => updateParam('particleSize', v)} 
              />
            </div>
            
            {/* Matrix Editor */}
            <div className="space-y-4">
               <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                 <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">交互矩阵 (Matrix)</div>
                 <button
                    onClick={randomize}
                    className="text-[10px] px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-sm font-bold uppercase tracking-wider transition-colors"
                  >
                    随机生成
                  </button>
               </div>
               
               <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${config.colorsCount}, 1fr)` }}>
                 {/* Column Headers (Colors) */}
                 {config.colors?.map((c, i) => (
                    <div key={`col-${i}`} className="h-1 w-full rounded-full mb-1" style={{ backgroundColor: c }}></div>
                 ))}
                 
                 {/* Matrix Cells */}
                 {matrix.length > 0 && Array.from({ length: config.colorsCount * config.colorsCount }).map((_, i) => {
                    const row = Math.floor(i / config.colorsCount);
                    const col = i % config.colorsCount;
                    const val = matrix[i];
                    // Map -1..1 to color (Red..Black..Green)
                    const bg = val > 0 
                      ? `rgba(34, 197, 94, ${val})` // Green
                      : `rgba(239, 68, 68, ${Math.abs(val)})`; // Red
                    
                    return (
                      <div 
                        key={i} 
                        className="relative aspect-square w-full bg-zinc-100 rounded-sm overflow-hidden group cursor-ns-resize border border-zinc-200"
                        title={`Row ${row} -> Col ${col}: ${val.toFixed(2)}`}
                      >
                         <div className="absolute inset-0 transition-colors" style={{ backgroundColor: bg, opacity: 0.5 }}></div>
                         {/* Simple visual indicator */}
                         <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-zinc-500 opacity-0 group-hover:opacity-100 select-none">
                           {val.toFixed(1)}
                         </div>
                         {/* Input overlay for precise control */}
                         <input 
                           type="range" 
                           min="-1" max="1" step="0.1" 
                           value={val}
                           onChange={(e) => updateMatrixCell(row, col, parseFloat(e.target.value))}
                           className="absolute inset-0 opacity-0 cursor-ns-resize"
                         />
                      </div>
                    );
                 })}
               </div>
               <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                 <span>行: 作用者 (Actor)</span>
                 <span>列: 目标 (Target)</span>
               </div>
            </div>

            {/* Colors Editor */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">颜色配置 (Colors)</div>
              <div className="grid grid-cols-3 gap-2">
                {config.colors?.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={c}
                      onChange={(e) => updateColor(i, e.target.value)}
                      className="w-6 h-6 rounded-full overflow-hidden border-none p-0 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">类型 {i}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">提示 (Tips)</div>
              <ul className="text-xs text-zinc-600 space-y-1 list-disc pl-4">
                <li>绿色 (正值) = 吸引</li>
                <li>红色 (负值) = 排斥</li>
                <li>调整 “作用力系数” 以增强交互效果</li>
                <li>“摩擦系数” 可稳定混沌运动</li>
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
        <span>{value.toFixed(3)}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
