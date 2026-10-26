'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import type { TSPTheme } from './simulation';
import { TSPAntColonySim } from './simulation';

export default function TSPAntColonyPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<TSPAntColonySim | null>(null);

  const [running, setRunning] = useState(true);
  const [stepsPerSecond, setStepsPerSecond] = useState(60);
  const [cityCount, setCityCount] = useState(28);
  const [antCount, setAntCount] = useState(20);
  const [alpha, setAlpha] = useState(1);
  const [beta, setBeta] = useState(3);
  const [evaporation, setEvaporation] = useState(0.4);
  const [deposit, setDeposit] = useState(1);
  const [showPheromones, setShowPheromones] = useState(true);
  const [showBest, setShowBest] = useState(true);
  const [theme, setTheme] = useState<TSPTheme>('dark');

  const [stats, setStats] = useState<{ iteration: number; bestLength: number; ants: number; cities: number } | null>(null);

  useEffect(() => {
    simRef.current?.setConfig({ stepsPerSecond });
  }, [stepsPerSecond]);
  useEffect(() => {
    simRef.current?.setConfig({ cityCount });
  }, [cityCount]);
  useEffect(() => {
    simRef.current?.setConfig({ antCount });
  }, [antCount]);
  useEffect(() => {
    simRef.current?.setConfig({ alpha });
  }, [alpha]);
  useEffect(() => {
    simRef.current?.setConfig({ beta });
  }, [beta]);
  useEffect(() => {
    simRef.current?.setConfig({ evaporation });
  }, [evaporation]);
  useEffect(() => {
    simRef.current?.setConfig({ deposit });
  }, [deposit]);
  useEffect(() => {
    simRef.current?.setConfig({ showPheromones });
  }, [showPheromones]);
  useEffect(() => {
    simRef.current?.setConfig({ showBest });
  }, [showBest]);
  useEffect(() => {
    simRef.current?.setConfig({ theme });
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const sim = new TSPAntColonySim(canvas);
    simRef.current = sim;
    sim.setConfig({
      stepsPerSecond,
      cityCount,
      antCount,
      alpha,
      beta,
      evaporation,
      deposit,
      showBest,
      showPheromones,
      theme,
    });

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sim.resize(w, h);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    if (running) sim.start();

    const timer = window.setInterval(() => {
      const s = sim.getStats();
      setStats(s);
    }, 200);

    return () => {
      window.clearInterval(timer);
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

  const actions = useMemo(
    () => [
      { label: running ? '暂停 (Pause)' : '开始 (Play)', onClick: () => setRunning((v) => !v), kind: 'primary' as const },
      { label: '单步 (Step)', onClick: () => simRef.current?.step(1), kind: 'secondary' as const },
      { label: '随机城市', onClick: () => simRef.current?.randomizeCities(cityCount), kind: 'secondary' as const },
      { label: '重置算法', onClick: () => simRef.current?.reset(), kind: 'secondary' as const },
    ],
    [running, cityCount]
  );

  const bgClass = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const overlayClass = theme === 'dark' ? 'text-white/60' : 'text-zinc-900/60';

  const bestText =
    stats && Number.isFinite(stats.bestLength) ? stats.bestLength.toFixed(1) : '--';

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="TSP_ANT_COLONY" />

      <div className="flex-1 flex flex-col lg:flex-row pt-16 h-full overflow-hidden">
        <div ref={wrapRef} className={`h-64 shrink-0 lg:h-full lg:flex-1 relative overflow-hidden ${bgClass}`}>
          <canvas ref={canvasRef} className="block w-full h-full" />
          <div className={`absolute top-4 left-4 ${overlayClass} font-mono text-[11px] pointer-events-none whitespace-pre`}>
            {stats
              ? `ITER: ${stats.iteration}  BEST: ${bestText}  ANTS: ${stats.ants}  CITIES: ${stats.cities}`
              : '...'}
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-500"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// TSP 蚁群算法 (ACO)'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={
                    a.kind === 'primary'
                      ? running
                        ? 'px-4 py-3 rounded-md font-bold text-sm transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'px-4 py-3 rounded-md font-bold text-sm transition-colors bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                      : 'px-4 py-3 bg-zinc-100 text-zinc-600 rounded-md font-bold text-sm hover:bg-zinc-200 transition-colors'
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <ControlSlider label="速度 (Steps/s)" value={stepsPerSecond} min={1} max={240} step={1} onChange={setStepsPerSecond} />
              <ControlSlider label="城市数量" value={cityCount} min={8} max={80} step={1} onChange={setCityCount} />
              <ControlSlider label="蚂蚁数量" value={antCount} min={1} max={60} step={1} onChange={setAntCount} />
              <ControlSlider label="α (信息素权重)" value={alpha} min={0.1} max={5} step={0.1} onChange={setAlpha} />
              <ControlSlider label="β (启发式权重)" value={beta} min={0.1} max={8} step={0.1} onChange={setBeta} />
              <ControlSlider label="挥发率 (ρ)" value={evaporation} min={0.05} max={0.9} step={0.01} onChange={setEvaporation} />
              <ControlSlider label="释放强度 (Q)" value={deposit} min={0.1} max={5} step={0.1} onChange={setDeposit} />
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">显示</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowPheromones((v) => !v)}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    showPheromones ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {showPheromones ? '信息素: 开' : '信息素: 关'}
                </button>
                <button
                  onClick={() => setShowBest((v) => !v)}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    showBest ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {showBest ? '最优路径: 显示' : '最优路径: 隐藏'}
                </button>
                <button
                  onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                    theme === 'dark' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {theme === 'dark' ? '主题: 暗色' : '主题: 亮色'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">提示</div>
              <ul className="text-xs text-zinc-600 space-y-1 list-disc pl-4">
                <li>蚂蚁会基于信息素与距离启发式选择下一城市</li>
                <li>挥发率越高，算法越偏向探索；越低则更强调历史路径</li>
                <li>提高 β 会更依赖距离，α 更依赖信息素</li>
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
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
