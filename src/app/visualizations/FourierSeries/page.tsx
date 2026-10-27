'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

type WaveKind = 'square' | 'sawtooth' | 'triangle';

/** 傅里叶奇次谐波系数：方波 4/π·(1, 0, 1/3, 0, 1/5...)；锯齿 2/π·(1, -1/2, 1/3...) 全谐波 */
function harmonicCoefficient(kind: WaveKind, n: number): number {
  if (kind === 'square') return n % 2 === 1 ? 1 / n : 0;
  if (kind === 'sawtooth') return ((n % 2 === 1 ? 1 : -1) * 1) / n;
  // 三角波：奇次谐波交替正负 1/n²
  if (n % 2 === 0) return 0;
  const k = (n - 1) / 2;
  return ((k % 2 === 0 ? 1 : -1) * 1) / (n * n);
}

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

export default function FourierSeriesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [kind, setKind] = useState<WaveKind>('square');
  const [harmonics, setHarmonics] = useState(3);
  const [showCircles, setShowCircles] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(true);

  const stateRef = useRef({ t: 0, running: true, speed: 1 });
  stateRef.current = { t: stateRef.current.t, running, speed };

  // kind/harmonics 变化时保留相位
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);

    // 合成波形轨迹（右侧历史）
    const trace: number[] = [];
    const MAX_TRACE = 700;

    const loop = () => {
      const s = stateRef.current;
      if (s.running) {
        s.t += 0.016 * s.speed;
        tRef.current = s.t;
      }
      const t = tRef.current;

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);

      const cy = h / 2;
      const baseR = Math.min(h * 0.22, 110);
      const waveAmp = baseR * 1.35; // 合成波振幅（所有系数和的近似上界）
      // 圆链圆心
      const ox = w * 0.24;
      const gapX = ox + baseR * 2.9 + 60;
      const waveW = w - gapX - 24;

      // 计算第 n 次谐波端点（累加圆）
      let x = ox;
      let y = cy;
      const pts: [number, number][] = [[x, y]];
      let value = 0; // 当前合成值（y 偏移）
      let maxSum = 0;
      for (let n = 1; n <= harmonics * 2; n += 1) {
        const coef = harmonicCoefficient(kind, n);
        if (coef === 0) continue;
        maxSum += Math.abs(coef);
        const r = baseR * coef;
        const th = n * t;
        const px = x + Math.cos(th) * r;
        const py = y + Math.sin(th) * r;
        if (showCircles) {
          ctx.strokeStyle = 'rgba(96,165,250,0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
          ctx.stroke();
          // 连线
          ctx.strokeStyle = 'rgba(148,163,184,0.5)';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
        x = px;
        y = py;
        pts.push([x, y]);
        value += Math.sin(th) * r;
      }
      const norm = Math.max(1, maxSum);

      if (showCircles) {
        // 圆链末端亮点
        ctx.fillStyle = 'rgba(250,250,250,0.95)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        // 从末端连到波形起点
        ctx.strokeStyle = 'rgba(250,250,250,0.35)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(gapX, cy + (value / norm) * waveAmp);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 目标波形（灰虚线）
      if (showTarget) {
        ctx.strokeStyle = 'rgba(148,163,184,0.35)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= waveW; i += 2) {
          const tt = ((i / waveW) * Math.PI * 2 - t) % (Math.PI * 2);
          // 目标：理想方/锯齿/三角（在 (-π,π] 定义）
          let v = 0;
          const ph = ((tt % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // [0, 2π)
          if (kind === 'square') v = ph < Math.PI ? 1 : -1;
          else if (kind === 'sawtooth') v = 1 - (2 * ph) / Math.PI;
          else v = ph < Math.PI ? (2 * ph) / Math.PI - 1 : 3 - (2 * ph) / Math.PI;
          const yy = cy - v * waveAmp * 0.92;
          if (i === 0) ctx.moveTo(gapX + i, yy);
          else ctx.lineTo(gapX + i, yy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 合成波形历史轨迹
      trace.unshift(value / norm);
      if (trace.length > MAX_TRACE) trace.pop();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < trace.length; i += 1) {
        const yy = cy - trace[i] * waveAmp;
        if (i === 0) ctx.moveTo(gapX + i, yy);
        else ctx.lineTo(gapX + i, yy);
      }
      ctx.stroke();

      // 中轴线
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gapX - 6, cy);
      ctx.lineTo(w - 12, cy);
      ctx.stroke();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [kind, harmonics, showCircles, showTarget]);

  // 状态（running/speed）热更新：不重建循环，用 ref 透传
  useEffect(() => {
    stateRef.current.running = running;
    stateRef.current.speed = speed;
  }, [running, speed]);

  const waveNames: Record<WaveKind, string> = { square: '方波', sawtooth: '锯齿波', triangle: '三角波' };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="FOURIER_SERIES" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[320px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-zinc-900/30">
            <canvas ref={canvasRef} className="block" />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-300">
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">{waveNames[kind]}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">谐波 {harmonics} 组（最高 n={harmonics * 2 - 1}）</span>
            </div>
            {!running && (
              <div className="absolute right-3 top-3 border border-amber-300/40 bg-amber-100/90 px-2 py-1 font-mono text-[11px] font-bold text-amber-700 rounded">
                已暂停
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-zinc-400">
              旋转圆叠加 = 傅里叶级数各项 · 蓝色轨迹 = 部分和逼近的波形
            </div>
          </div>
        </div>

        {/* 控制面板 */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-3 lg:w-[330px] lg:border-l lg:border-zinc-200 lg:bg-white/60">
          <div className={`${PANEL} p-1.5 grid grid-cols-3 gap-1`}>
            {(['square', 'sawtooth', 'triangle'] as WaveKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                  kind === k ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {waveNames[k]}
              </button>
            ))}
          </div>

          <div className={`${PANEL} p-4 space-y-3.5`}>
            <Slider label="谐波组数" value={harmonics} min={1} max={30} step={1} onChange={setHarmonics} fmt={(v) => `${v} 组`} />
            <Slider label="速度" value={speed} min={0.1} max={3} step={0.1} onChange={setSpeed} fmt={(v) => `${v.toFixed(1)}×`} />
            <button
              onClick={() => setRunning(!running)}
              className={`w-full rounded-lg py-2.5 text-xs font-bold transition-colors ${
                running ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {running ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setShowCircles(!showCircles)}
                className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                  showCircles ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                旋转圆
              </button>
              <button
                onClick={() => setShowTarget(!showTarget)}
                className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                  showTarget ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                目标波形
              </button>
            </div>
          </div>

          <div className={`${PANEL} p-4`}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">级数系数 bₙ</div>
            <div className="space-y-1 font-mono text-[11px]">
              {Array.from({ length: Math.min(harmonics * 2, 12) }, (_, i) => i + 1).map((n) => {
                const c = harmonicCoefficient(kind, n);
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-8 text-zinc-400">b{n}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.abs(c) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-zinc-600">{c === 0 ? '0' : c.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
            {harmonics > 6 && <div className="mt-1 font-mono text-[10px] text-zinc-400">… 仅显示前 6 组</div>}
          </div>

          <div className={`${PANEL} p-4 text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-zinc-500">说明</div>
            任何周期信号都能写成正弦叠加。方波只含奇次谐波（bₙ = 4/πn）；锯齿波全谐波（bₙ = 2/π·(-1)ⁿ⁺¹/n）。
            谐波组数越多，合成波形越接近目标——但不连续点附近始终残留约 9% 的过冲（吉布斯现象），永远无法消除。
          </div>
        </aside>
      </div>
    </div>
  );
}
