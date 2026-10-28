'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import type { AntColorTheme, AntMode } from './simulation';
import { LangtonsAntSim } from './simulation';

export default function LangtonsAntPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<LangtonsAntSim | null>(null);

  const [running, setRunning] = useState(true);
  const [stepsPerSecond, setStepsPerSecond] = useState(600);
  const [cellSize, setCellSize] = useState(6);
  const [ants, setAnts] = useState(2);
  const [wrap, setWrap] = useState(true);
  const [theme, setTheme] = useState<AntColorTheme>('dark');
  const [syncUpdate, setSyncUpdate] = useState(false);
  const [density, setDensity] = useState(0.15);
  const [mode, setMode] = useState<AntMode>('classic');
  const [resolutionScale, setResolutionScale] = useState(1);
  const [colorStep, setColorStep] = useState(1);
  const [colorStepMin, setColorStepMin] = useState(1);
  const [colorStepMax, setColorStepMax] = useState(8);
  const [colorStepNoZero, setColorStepNoZero] = useState(true);
  const [trace, setTrace] = useState(false);

  const [stats, setStats] = useState<{
    steps: number;
    ants: number;
    cols: number;
    rows: number;
    mode: AntMode;
    scale: number;
  } | null>(null);

  const runningRef = useRef(running);
  const stepsPerSecondRef = useRef(stepsPerSecond);
  const cellSizeRef = useRef(cellSize);
  const antsRef = useRef(ants);
  const wrapRefValue = useRef(wrap);
  const themeRef = useRef<AntColorTheme>(theme);
  const modeRef = useRef<AntMode>(mode);
  const resolutionScaleRef = useRef(resolutionScale);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    stepsPerSecondRef.current = stepsPerSecond;
    simRef.current?.setConfig({ stepsPerSecond });
  }, [stepsPerSecond]);
  useEffect(() => {
    antsRef.current = ants;
    simRef.current?.setConfig({ ants });
  }, [ants]);
  useEffect(() => {
    wrapRefValue.current = wrap;
    simRef.current?.setConfig({ wrap });
  }, [wrap]);
  useEffect(() => {
    simRef.current?.setConfig({ syncUpdate });
  }, [syncUpdate]);
  useEffect(() => {
    themeRef.current = theme;
    simRef.current?.setConfig({ theme });
  }, [theme]);
  useEffect(() => {
    modeRef.current = mode;
    simRef.current?.setConfig({ mode });
  }, [mode]);
  useEffect(() => {
    resolutionScaleRef.current = resolutionScale;
    simRef.current?.setConfig({ resolutionScale });
  }, [resolutionScale]);
  useEffect(() => {
    simRef.current?.setConfig({ colorStep });
  }, [colorStep]);
  useEffect(() => {
    simRef.current?.setConfig({ colorStepMin });
  }, [colorStepMin]);
  useEffect(() => {
    simRef.current?.setConfig({ colorStepMax });
  }, [colorStepMax]);
  useEffect(() => {
    simRef.current?.setConfig({ colorStepNoZero });
  }, [colorStepNoZero]);
  useEffect(() => {
    simRef.current?.setConfig({ trace });
  }, [trace]);
  useEffect(() => {
    cellSizeRef.current = cellSize;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const wrapEl = wrapRef.current;
    if (!sim || !canvas || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    // 布局尺寸交给 CSS w-full/h-full，避免 inline px 宽度撑死 flex 项 min-content
    sim.resize(w, h, Math.max(1, Math.floor(cellSize * dpr)));
  }, [cellSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapEl = wrapRef.current;
    if (!canvas || !wrapEl) return;

    const sim = new LangtonsAntSim(canvas);
    simRef.current = sim;
    sim.setConfig({
      stepsPerSecond: stepsPerSecondRef.current,
      ants: antsRef.current,
      wrap: wrapRefValue.current,
      theme: themeRef.current,
      mode: modeRef.current,
      resolutionScale: resolutionScaleRef.current,
    });

    const doResize = () => {
      const rect = wrapEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      // 布局尺寸交给 CSS w-full/h-full，避免 inline px 宽度撑死 flex 项 min-content
      sim.resize(w, h, Math.max(1, Math.floor(cellSizeRef.current * dpr)));
    };

    doResize();
    const ro = new ResizeObserver(doResize);
    ro.observe(wrapEl);

    if (runningRef.current) sim.start();

    const tickStats = window.setInterval(() => {
      setStats(sim.getStats());
    }, 200);

    return () => {
      window.clearInterval(tickStats);
      sim.stop();
      ro.disconnect();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (running) sim.start();
    else sim.stop();
  }, [running]);

  const bgClass = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const overlayClass = theme === 'dark' ? 'text-white/60' : 'text-zinc-900/60';
  const turnHint =
    mode === 'fullColor'
      ? '每种颜色决定转向与递增通道，颜色通道按规则递增'
      : theme === 'dark'
        ? '黑格右转，白格左转，同时翻转格子颜色'
        : '白格右转，黑格左转，同时翻转格子颜色';

  const actions = useMemo(
    () => [
      { label: running ? '暂停 (Pause)' : '开始 (Play)', onClick: () => setRunning((v) => !v), kind: 'primary' as const },
      { label: '单步 (Step)', onClick: () => simRef.current?.step(1), kind: 'secondary' as const },
      { label: '步进 x100', onClick: () => simRef.current?.step(100), kind: 'secondary' as const },
      { label: '步进 x1000', onClick: () => simRef.current?.step(1000), kind: 'secondary' as const },
    ],
    [running]
  );

  const isDrawingRef = useRef(false);
  const lastCellKeyRef = useRef<string | null>(null);

  const mapEventToCanvas = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    onPointerMove(e);
  };
  const onPointerUp = () => {
    isDrawingRef.current = false;
    lastCellKeyRef.current = null;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const sim = simRef.current;
    if (!sim) return;
    const p = mapEventToCanvas(e);
    if (!p) return;
    const key = sim.getCellKeyAt(p.x, p.y);
    if (!key) return;
    if (lastCellKeyRef.current === key) return;
    lastCellKeyRef.current = key;
    sim.toggleCellAt(p.x, p.y);
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="LANGTONS_ANT" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        <div ref={wrapRef} className={`h-64 shrink-0 lg:h-full lg:flex-1 relative overflow-hidden ${bgClass}`}>
          <canvas
            ref={canvasRef}
            className="block w-full h-full touch-none"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />

          <div className={`absolute top-4 left-4 ${overlayClass} font-mono text-[11px] pointer-events-none whitespace-pre`}>
            {stats
              ? `STEPS: ${stats.steps}  ANTS: ${stats.ants}  GRID: ${stats.cols}x${stats.rows}  MODE: ${
                  stats.mode === 'fullColor'
                    ? `COLOR${stats.scale > 1 ? ` HRx${stats.scale}` : ''}`
                    : `CLASSIC${stats.scale > 1 ? ` HRx${stats.scale}` : ''}`
                }  UPDATE: ${stats.mode === 'classic' && syncUpdate ? 'SYNC' : 'SEQ'}`
              : '...'}
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// 兰顿蚂蚁 (Zero Player Game)'}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={
                    a.kind === 'primary'
                      ? running
                        ? 'px-3 py-2 rounded-md font-bold text-xs transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'px-3 py-2 rounded-md font-bold text-xs transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'px-3 py-2 bg-zinc-100 text-zinc-600 rounded-md font-bold text-xs hover:bg-zinc-200 transition-colors'
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <ControlSlider label="速度 (Steps/s)" value={stepsPerSecond} min={10} max={5000} step={10} onChange={setStepsPerSecond} />
              <ControlSlider label="格子大小 (px)" value={cellSize} min={2} max={14} step={1} onChange={setCellSize} />
              <ControlSlider label="高分辨率倍率" value={resolutionScale} min={1} max={6} step={1} onChange={setResolutionScale} />
              <ControlSlider label="蚂蚁数量" value={ants} min={1} max={16} step={1} onChange={setAnts} />
              <ControlSlider label="随机密度" value={density} min={0} max={0.6} step={0.01} onChange={setDensity} />
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">世界设置</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setWrap((v) => !v)}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    wrap ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {wrap ? '边界环绕: 开' : '边界环绕: 关'}
                </button>
                <button
                  onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    theme === 'dark' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {theme === 'dark' ? '主题: 暗色' : '主题: 亮色'}
                </button>
                <button
                  onClick={() => setSyncUpdate((v) => !v)}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    syncUpdate ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {syncUpdate ? '更新: 同步' : '更新: 顺序'}
                </button>
                <button
                  onClick={() => setMode((m) => (m === 'classic' ? 'fullColor' : 'classic'))}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    mode === 'fullColor' ? 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {mode === 'fullColor' ? '模式: 全色彩' : '模式: 经典'}
                </button>
              </div>
            </div>

            {mode === 'fullColor' ? (
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">全色彩参数</div>
                <div className="space-y-4">
                  <ControlSlider label="颜色步长 (dr)" value={colorStep} min={0} max={16} step={1} onChange={setColorStep} />
                  <ControlSlider label="随机步长最小 (d_min)" value={colorStepMin} min={0} max={16} step={1} onChange={setColorStepMin} />
                  <ControlSlider label="随机步长最大 (d_max)" value={colorStepMax} min={1} max={32} step={1} onChange={setColorStepMax} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setColorStepNoZero((v) => !v)}
                    className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                      colorStepNoZero ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {colorStepNoZero ? '步长非零: 开' : '步长非零: 关'}
                  </button>
                  <button
                    onClick={() => setTrace((v) => !v)}
                    className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                      trace ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {trace ? '追踪线: 开' : '追踪线: 关'}
                  </button>
                  <button
                    onClick={() => simRef.current?.regenerateColorRules()}
                    className="px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded text-xs font-bold hover:bg-fuchsia-100 transition-colors"
                  >
                    重置规则
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">操作</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => simRef.current?.randomize(density)}
                  className="px-3 py-2 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  随机重置
                </button>
                <button
                  onClick={() => simRef.current?.clear()}
                  className="px-3 py-2 bg-red-50 text-red-700 rounded text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  清空画布
                </button>
                <button
                  onClick={() => simRef.current?.setConfig({ ants: antsRef.current })}
                  className="px-3 py-2 bg-zinc-100 text-zinc-700 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                >
                  重置蚂蚁
                </button>
                <button
                  onClick={() => {
                    simRef.current?.setConfig({ ants: antsRef.current });
                    simRef.current?.clear();
                  }}
                  className="px-3 py-2 bg-zinc-100 text-zinc-700 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                >
                  重置全部
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">提示</div>
              <ul className="text-xs text-zinc-600 space-y-1 list-disc pl-4">
                <li>{turnHint}</li>
                <li>中速会先出现混沌，随后进入“高速公路”结构</li>
                <li>在画布上拖动可以翻转格子，改变演化路径</li>
                {mode === 'fullColor' ? <li>高分辨率倍率越大越耗性能</li> : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
        <span>{value}</span>
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
