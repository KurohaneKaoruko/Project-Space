'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { BrownianSim, BROWNIAN_DEFAULTS, type BrownianParams, type BrownianStats } from './simulation';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-blue-600">{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

/** MSD(t) 双对数曲线小图：斜率 1 ≈ 正常扩散，斜率 2 ≈ 弹道区 */
function MsdChart({ series }: { series: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = 'rgba(24,24,27,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo((w / 4) * i, 0);
      ctx.lineTo((w / 4) * i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (h / 4) * i);
      ctx.lineTo(w, (h / 4) * i);
      ctx.stroke();
    }
    if (series.length < 2) return;
    // 双对数（跳过 t=0）
    const pts: [number, number][] = [];
    for (let i = 1; i < series.length; i += 1) {
      const lv = Math.log10(Math.max(1, series[i]));
      const lt = Math.log10(i * 10);
      pts.push([lt, lv]);
    }
    let lx0 = Infinity;
    let lx1 = -Infinity;
    let ly0 = Infinity;
    let ly1 = -Infinity;
    for (const [lx, ly] of pts) {
      lx0 = Math.min(lx0, lx);
      lx1 = Math.max(lx1, lx);
      ly0 = Math.min(ly0, ly);
      ly1 = Math.max(ly1, ly);
    }
    const sx = (lx1 - lx0) || 1;
    const sy = (ly1 - ly0) || 1;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    pts.forEach(([lx, ly], i) => {
      const px = ((lx - lx0) / sx) * (w - 8) + 4;
      const py = h - 6 - ((ly - ly0) / sy) * (h - 12);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }, [series]);

  return (
    <div>
      <canvas ref={ref} className="h-24 w-full rounded-lg border border-zinc-200 bg-zinc-50" />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-400">
        <span>log MSD–log t</span>
        <span>斜率 1=扩散 / 2=弹道</span>
      </div>
    </div>
  );
}

export default function BrownianPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<BrownianSim | null>(null);

  const [running, setRunning] = useState(true);
  const [params, setParams] = useState<BrownianParams>(BROWNIAN_DEFAULTS);
  const [stats, setStats] = useState<BrownianStats>({ t: 0, msd: 0, displacement: 0, samples: 0 });
  const [msdTick, setMsdTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const sim = new BrownianSim(canvas);
    simRef.current = sim;
    sim.setOnFrame((s) => {
      setStats(s);
      setMsdTick((v) => v + 1);
    });
    sim.running = true;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      sim.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    sim.startLoop();

    return () => {
      sim.dispose();
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    simRef.current?.setParams(params);
  }, [params]);

  const upd = (p: Partial<BrownianParams>) => setParams((prev) => ({ ...prev, ...p }));

  // MSD 曲线数据快照（tick 触发重绘）
  const msdSeries = simRef.current?.msdSeries ?? [];

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="BROWNIAN_MOTION" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[320px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-zinc-900/30">
            <canvas ref={canvasRef} className="block h-full w-full" />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-300">
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">粒子 {stats.samples >= 0 ? params.count : 0}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">RMS 位移 {stats.displacement.toFixed(1)} px</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">t = {stats.t}</span>
            </div>
            {!running && (
              <div className="absolute right-3 top-3 border border-amber-300/40 bg-amber-100/90 px-2 py-1 font-mono text-[11px] font-bold text-amber-700 rounded">
                已暂停
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-zinc-400">
              十字标记 = 粒子出生点，颜色渐变 = 不同粒子
            </div>
          </div>
        </div>

        {/* 控制面板 */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-3 lg:w-[330px] lg:border-l lg:border-zinc-200 lg:bg-white/60">
          <div className={`${PANEL} p-1.5 flex gap-1`}>
            <button
              onClick={() => {
                const sim = simRef.current;
                if (!sim) return;
                sim.running = !sim.running;
                setRunning(sim.running);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                running ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {running ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button
              onClick={() => simRef.current?.advance()}
              className="flex-1 rounded-lg py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              单步
            </button>
            <button
              onClick={() => simRef.current?.clearTrails()}
              className="flex-1 rounded-lg py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              清轨迹
            </button>
            <button
              onClick={() => simRef.current?.respawn()}
              className="flex-1 rounded-lg py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              重置
            </button>
          </div>

          <div className={`${PANEL} space-y-3.5 p-4`}>
            <Slider label="粒子数" value={params.count} min={1} max={200} step={1} onChange={(v) => upd({ count: v })} />
            <Slider label="温度" value={params.temperature} min={0.2} max={4} step={0.1} onChange={(v) => upd({ temperature: v })} fmt={(v) => `${v.toFixed(1)}×`} />
            <Slider label="方向扰动" value={params.jitter} min={0.05} max={3} step={0.05} onChange={(v) => upd({ jitter: v })} fmt={(v) => v.toFixed(2)} />
            <Slider label="速度分量" value={params.speed} min={0.2} max={3} step={0.1} onChange={(v) => upd({ speed: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="轨迹长度" value={params.trail} min={0} max={600} step={10} onChange={(v) => upd({ trail: v })} fmt={(v) => `${v} 帧`} />
          </div>

          <div className={`${PANEL} p-4`}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">均方位移 MSD(t)</div>
            <MsdChart key={msdTick} series={[...msdSeries]} />
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
              <span>MSD</span>
              <span className="text-right text-zinc-800">{stats.msd.toFixed(0)} px²</span>
              <span>RMS 位移</span>
              <span className="text-right text-zinc-800">{stats.displacement.toFixed(1)} px</span>
              <span>采样点</span>
              <span className="text-right text-zinc-800">{stats.samples}</span>
            </div>
          </div>

          <div className={`${PANEL} p-4 text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">说明</div>
            每粒子采用「方向持久 + 高斯扰动」随机游走：温度升高 → 扰动与速度同增，扩散加快。
            双对数 MSD 曲线斜率 ≈ 1 时处于扩散区，初期接近 2 为弹道区——与爱因斯坦 1905 年对布朗运动的理论一致。
          </div>
        </aside>
      </div>
    </div>
  );
}
