'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

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

export default function LissajousPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [freqA, setFreqA] = useState(3); // x 频率
  const [freqB, setFreqB] = useState(2); // y 频率
  const [phase, setPhase] = useState(Math.PI / 2); // 相位差 δ
  const [trail, setTrail] = useState(0.25); // 残影强度（消隐速率反比）
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(true);
  const [showDots, setShowDots] = useState(true);

  const stateRef = useRef({ t: 0, running: true, speed: 1, trail: 0.25, freqA: 3, freqB: 2, phase: Math.PI / 2, showDots: true });
  stateRef.current = { t: 0, running, speed, trail, freqA, freqB, phase, showDots };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // resize 后重画底色
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);
    };

    const loop = () => {
      const s = stateRef.current;
      if (s.running) s.t += 0.016 * s.speed;

      // 残影：整屏低透明度覆盖
      ctx.fillStyle = `rgba(7, 11, 20, ${0.5 - s.trail * 0.48})`;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const amp = Math.min(w, h) * 0.42;

      // 参数方程采样画一小段（每帧增量画，形成光点拖尾流）
      const steps = 90;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)';
      ctx.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const tt = s.t - (steps - i) * 0.006;
        const x = cx + Math.sin(s.freqA * tt + s.phase) * amp;
        const y = cy + Math.sin(s.freqB * tt) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 引导投影点：x 分量（顶部）与 y 分量（左侧）+ 交点光斑
      if (s.showDots) {
        const x = Math.sin(s.freqA * s.t + s.phase);
        const y = Math.sin(s.freqB * s.t);
        const px = cx + x * amp;
        const py = cy + y * amp;
        // 顶部横条（x 正弦）
        ctx.fillStyle = 'rgba(244, 114, 182, 0.85)';
        ctx.beginPath();
        ctx.arc(px, cy - amp - 14, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.18)';
        ctx.beginPath();
        ctx.moveTo(px, cy - amp - 14);
        ctx.lineTo(px, py);
        ctx.stroke();
        // 左侧竖条（y 正弦）
        ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.beginPath();
        ctx.arc(cx - amp - 14, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.18)';
        ctx.beginPath();
        ctx.moveTo(cx - amp - 14, py);
        ctx.lineTo(px, py);
        ctx.stroke();
        // 曲线光点
        ctx.fillStyle = 'rgba(250, 250, 250, 0.95)';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 频率比变化时清屏重置残影
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = wrap.getBoundingClientRect();
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, [freqA, freqB, phase]);

  const ratio = freqB / freqA;
  const ratioStr = `${freqB}:${freqA}`;
  const closed = Number.isInteger(freqA) && Number.isInteger(freqB);

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="LISSAJOUS" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[320px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-zinc-900/30">
            <canvas ref={canvasRef} className="block" />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-300">
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">频率比 {ratioStr}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">相位 δ = {phase.toFixed(2)}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">{closed ? '闭合曲线' : '漂移中'}</span>
            </div>
            {!running && (
              <div className="absolute right-3 top-3 border border-amber-300/40 bg-amber-100/90 px-2 py-1 font-mono text-[11px] font-bold text-amber-700 rounded">
                已暂停
              </div>
            )}
          </div>
        </div>

        {/* 控制面板 */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-3 lg:w-[330px] lg:border-l lg:border-zinc-200 lg:bg-white/60">
          <div className={`${PANEL} p-1.5 flex gap-1`}>
            <button
              onClick={() => setRunning(!running)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                running ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {running ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button
              onClick={() => setShowDots(!showDots)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                showDots ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              投影引导
            </button>
          </div>

          <div className={`${PANEL} space-y-3.5 p-4`}>
            <Slider label="X 频率 a" value={freqA} min={1} max={9} step={1} onChange={setFreqA} />
            <Slider label="Y 频率 b" value={freqB} min={1} max={9} step={1} onChange={setFreqB} />
            <Slider label="相位差 δ" value={phase} min={0} max={Math.PI} step={0.01} onChange={setPhase} fmt={(v) => `${(v / Math.PI).toFixed(2)}π`} />
            <Slider label="残影持续" value={trail} min={0} max={0.49} step={0.01} onChange={setTrail} fmt={(v) => `${Math.round((v / 0.49) * 100)}%`} />
            <Slider label="速度" value={speed} min={0.1} max={3} step={0.1} onChange={setSpeed} fmt={(v) => `${v.toFixed(1)}×`} />
          </div>

          {/* 经典比例预设 */}
          <div className={`${PANEL} p-4`}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">经典频率比</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                [1, 1],
                [2, 1],
                [3, 2],
                [3, 1],
                [4, 3],
                [5, 4],
                [5, 2],
                [9, 8],
              ].map(([b, a]) => (
                <button
                  key={`${b}-${a}`}
                  onClick={() => {
                    setFreqA(a);
                    setFreqB(b);
                  }}
                  className={`rounded-lg border py-2 font-mono text-xs font-bold transition-colors ${
                    freqA === a && freqB === b
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  {b}:{a}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((p) => (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={`rounded-lg border py-2 font-mono text-xs font-bold transition-colors ${
                    Math.abs(phase - p) < 0.005
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  δ={((p / Math.PI) * 1).toFixed(2).replace(/\.?0+$/, '')}π
                </button>
              ))}
            </div>
          </div>

          <div className={`${PANEL} p-4 text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-zinc-500">说明</div>
            参数方程 x = sin(a·t + δ)、y = sin(b·t)。频率比为整数比时曲线闭合——
            b:a = 1:1 且 δ=π/2 退化为圆；1:2 呈「∞」字形；相位差决定曲线张合方向。
            频率比不可公度时曲线永不闭合，逐渐填满整个矩形（漂移中）。
          </div>
        </aside>
      </div>
    </div>
  );
}
