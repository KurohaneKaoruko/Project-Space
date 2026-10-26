'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

/**
 * 广义冰雹猜想实验台
 * 规则：n 能被 c 整除 → n/c；否则 → a·n + b
 * 经典冰雹猜想 = c=2, a=3, b=1（所有正整数都收敛到 1→4→2 循环）
 * 其它参数（如 5n+1）会出现发散轨道或非平凡循环。
 */

interface Trajectory {
  id: number;
  start: number;
  a: number;
  b: number;
  c: number;
  /** 轨迹值序列（对数刻度绘制，超出精度后标记发散） */
  values: number[];
  /** 结局状态 */
  status: 'converged' | 'cycle' | 'diverged';
  /** 循环节内容（status === 'cycle' 时） */
  cycle: number[];
  peak: number;
}

const MAX_STEPS = 4096;
/** 超过此值视为发散（也避免浮点精度丢失后的假循环） */
const DIVERGE_LIMIT = 2 ** 53;

const TRAJ_COLORS = ['#38bdf8', '#fbbf24', '#fb7185', '#c084fc', '#34d399', '#f97316'];

const PRESETS = [
  { label: '经典 3n+1', a: 3, b: 1, c: 2 },
  { label: '5n+1', a: 5, b: 1, c: 2 },
  { label: '7n+1', a: 7, b: 1, c: 2 },
  { label: '3n-1', a: 3, b: -1, c: 2 },
  { label: '181n/2+1', a: 181, b: 1, c: 2 },
  { label: '3n+1 (c=4)', a: 3, b: 1, c: 4 },
];

/** 计算一条广义 Collatz 轨迹（浮点跟踪，循环用 Map 检测） */
function computeTrajectory(start: number, a: number, b: number, c: number): Trajectory {
  const values: number[] = [start];
  // 值 → 首次出现步数；再次出现即找到循环
  const seen = new Map<number, number>([[start, 0]]);
  let n = start;
  let peak = Math.abs(start);
  let status: Trajectory['status'] = 'diverged';
  let cycle: number[] = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    if (c > 1 && n % c === 0) {
      n = n / c;
    } else {
      n = a * n + b;
    }
    values.push(n);
    if (Math.abs(n) > peak) peak = Math.abs(n);

    if (n === 1 || n === 0 || n === -1) {
      status = 'converged';
      break;
    }
    if (!Number.isFinite(n) || Math.abs(n) > DIVERGE_LIMIT) {
      status = 'diverged';
      break;
    }
    const prev = seen.get(n);
    if (prev !== undefined) {
      status = 'cycle';
      cycle = values.slice(prev, values.length - 1);
      break;
    }
    seen.set(n, step);
  }
  if (status === 'diverged' && values.length > MAX_STEPS) status = 'diverged';

  return { id: 0, start, a, b, c, values, status, cycle, peak };
}

export default function CollatzPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);

  const [startN, setStartN] = useState(27);  const [a, setA] = useState(3);
  const [b, setB] = useState(1);
  const [c, setC] = useState(2);
  const [speed, setSpeed] = useState(60);
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  /** 逐帧生长的显示步数（-1 表示完整显示） */
  const [reveal, setReveal] = useState(-1);

  // 动画循环内需要读到的最新值走 ref，避免闭包过期/依赖重跑
  const trajectoriesRef = useRef<Trajectory[]>([]);
  const speedRef = useRef(speed);
  const rafRef = useRef(0);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const applyTrajectories = useCallback((next: Trajectory[]) => {
    trajectoriesRef.current = next;
    setTrajectories(next);
  }, []);

  /** 从头逐帧生长显示所有轨迹；到达最长轨迹后自动停止（自终止循环，不会重播闪烁） */
  const startReveal = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const maxLen = Math.max(...trajectoriesRef.current.map((t) => t.values.length), 1);
    const step = Math.max(1, Math.round((maxLen * speedRef.current) / 600));
    let r = 0;
    const tick = () => {
      r += step;
      if (r >= maxLen) {
        setReveal(-1); // 完整显示，循环自然终止
        return;
      }
      setReveal(r);
      rafRef.current = requestAnimationFrame(tick);
    };
    setReveal(0);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // 卸载时停止动画
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const addTrajectory = useCallback(() => {
    const n = Math.floor(startN);
    if (!Number.isFinite(n) || n === 0) return;
    const t = computeTrajectory(n, a, b, c);
    t.id = ++idRef.current;
    applyTrajectories([...trajectoriesRef.current.slice(-5), t]);
    setSelected(t.id);
    startReveal();
  }, [startN, a, b, c, applyTrajectories, startReveal]);

  // 首屏：经典 3n+1, n=27
  useEffect(() => {
    const t = computeTrajectory(27, 3, 1, 2);
    t.id = ++idRef.current;
    applyTrajectories([t]);
    setSelected(t.id);
    startReveal();
  }, [applyTrajectories, startReveal]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth * dpr;
    const h = wrap.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    if (trajectories.length === 0) return;

    const maxLen = Math.max(...trajectories.map((t) => t.values.length));
    // 对数刻度范围（|v| >= 0.5 参与，避免 log(0)）
    let maxLog = 1;
    for (const t of trajectories) {
      for (const v of t.values) maxLog = Math.max(maxLog, Math.log2(Math.max(Math.abs(v), 0.5)));
    }
    maxLog = Math.ceil(maxLog) + 0.5;

    const m = 34 * dpr;
    const plotW = w - 2 * m;
    const plotH = h - 2 * m;
    const xOf = (i: number) => m + (i / Math.max(maxLen - 1, 1)) * plotW;
    const yOf = (v: number) => {
      const lg = Math.log2(Math.max(Math.abs(v), 0.5));
      return m + (1 - lg / maxLog) * plotH;
    };

    // 网格：2^k 参考线
    ctx.font = `${9 * dpr}px monospace`;
    ctx.textAlign = 'left';
    for (let k = 0; k <= Math.ceil(maxLog); k++) {
      const y = m + (1 - k / maxLog) * plotH;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m, y);
      ctx.lineTo(w - m, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(`2^${k}`, w - m + 3 * dpr, y + 3 * dpr);
    }

    // 轨迹
    trajectories.forEach((t, ti) => {
      const color = TRAJ_COLORS[ti % TRAJ_COLORS.length];
      const shown = reveal < 0 ? t.values.length : Math.min(reveal, t.values.length);
      const dim = selected !== null && selected !== t.id;
      const baseAlpha = dim ? 0.25 : 1;

      // 折线
      ctx.strokeStyle = color;
      ctx.globalAlpha = baseAlpha;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      for (let i = 0; i < shown; i++) {
        const x = xOf(i);
        const y = yOf(t.values[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 生长头部
      if (reveal >= 0 && shown > 0 && shown < t.values.length) {
        const hx = xOf(shown - 1);
        const hy = yOf(t.values[shown - 1]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(hx, hy, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 峰值标记
      if (reveal < 0 && t.values.length > 2) {
        let peakIdx = 0;
        for (let i = 1; i < t.values.length; i++) {
          if (t.values[i] > t.values[peakIdx]) peakIdx = i;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = baseAlpha * 0.9;
        ctx.fillRect(xOf(peakIdx) - 2 * dpr, yOf(t.values[peakIdx]) - 2 * dpr, 4 * dpr, 4 * dpr);
      }
      ctx.globalAlpha = 1;
    });

    // 图例信息
    ctx.textAlign = 'left';
    ctx.font = `${10 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const sel = trajectories.find((t) => t.id === selected);
    if (sel) {
      const info =
        sel.status === 'converged'
          ? `n=${sel.start} 收敛 · ${sel.values.length - 1} 步 · 峰值 ${formatNum(sel.peak)}`
          : sel.status === 'cycle'
            ? `n=${sel.start} 循环(长度 ${sel.cycle.length}) · 峰值 ${formatNum(sel.peak)}`
            : `n=${sel.start} 发散/超限 · 峰值 ${formatNum(sel.peak)}`;
      ctx.fillText(info, m + 6 * dpr, m + 14 * dpr);
    }
  }, [trajectories, selected, reveal]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 画布尺寸自适应
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const sel = useMemo(() => trajectories.find((t) => t.id === selected), [trajectories, selected]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setA(p.a);
    setB(p.b);
    setC(p.c);
  };

  const stats = useMemo(
    () => ({
      steps: sel ? sel.values.length - 1 : 0,
      peak: sel?.peak ?? 0,
      cycleLen: sel?.status === 'cycle' ? sel.cycle.length : 0,
    }),
    [sel]
  );

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="COLLATZ_GENERALIZED" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* 画布区 */}
        <div ref={wrapRef} className="h-64 shrink-0 lg:h-full lg:flex-1 relative overflow-hidden bg-zinc-950">
          <canvas ref={canvasRef} className="block w-full h-full" />
          <div className="absolute top-4 right-14 font-mono text-[10px] text-white/40 pointer-events-none text-right leading-5">
            {'规则: n ≡ 0 (mod c) → n/c'}
            <br />
            {'否则: n → a·n + b'}
            <br />
            {'纵轴: log₂|n|'}
          </div>
        </div>

        {/* 控制面板 */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600"></span>
                冰雹猜想 · 实验台
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// generalized collatz: n/c | an+b'}</p>
            </div>

            {/* 参数 */}
            <div className="space-y-4">
              <NumberField
                label="起点 n"
                value={startN}
                min={1}
                max={999999}
                onChange={(v) => setStartN(Math.round(v))}
              />
              <ControlSlider label="a (奇数倍率)" value={a} min={-99} max={99} step={2} onChange={setA} />
              <ControlSlider label="b (加数)" value={b} min={-99} max={99} step={1} onChange={setB} />
              <ControlSlider label="c (整除数)" value={c} min={2} max={16} step={1} onChange={setC} />
              <ControlSlider label="回放速度" value={speed} min={5} max={300} step={5} onChange={setSpeed} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={addTrajectory}
                className="px-4 py-3 rounded-md font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                添加轨迹 (Trace)
              </button>
              <button
                onClick={() => {
                  cancelAnimationFrame(rafRef.current);
                  applyTrajectories([]);
                  setSelected(null);
                  setReveal(-1);
                }}
                className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-md font-bold text-sm hover:bg-zinc-200 transition-colors"
              >
                清空 (Clear)
              </button>
            </div>

            {/* 预设 */}
            <div className="space-y-2 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">预设参数</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={`px-2 py-2 rounded text-xs font-bold font-mono transition-colors ${
                      a === p.a && b === p.b && c === p.c
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                经典 3n+1 所有正整数都收敛；5n+1 / 7n+1 多数发散；3n-1 存在多重循环环。
              </p>
            </div>

            {/* 轨迹列表 */}
            {trajectories.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-zinc-100">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">轨迹 ({trajectories.length})</div>
                <div className="space-y-1">
                  {trajectories.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left font-mono text-[11px] transition-colors ${
                        selected === t.id ? 'border-blue-300 bg-blue-50' : 'border-zinc-100 bg-zinc-50 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: TRAJ_COLORS[i % TRAJ_COLORS.length] }} />
                      <span className="text-zinc-700 font-bold">n={t.start}</span>
                      <span className="text-zinc-400">
                        {t.a}n{t.b >= 0 ? '+' : ''}{t.b}/{t.c}
                      </span>
                      <span
                        className={
                          t.status === 'converged'
                            ? 'text-emerald-600 ml-auto'
                            : t.status === 'cycle'
                              ? 'text-amber-600 ml-auto'
                              : 'text-rose-600 ml-auto'
                        }
                      >
                        {t.status === 'converged' ? '收敛' : t.status === 'cycle' ? `循环${t.cycle.length}` : '发散'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 循环节 */}
            {sel?.status === 'cycle' && (
              <div className="space-y-2 pt-4 border-t border-zinc-100">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">循环节</div>
                <div className="bg-zinc-950 rounded p-3 font-mono text-[11px] text-blue-300 break-all leading-5">
                  {sel.cycle.map(formatNum).join(' → ')}
                </div>
              </div>
            )}

            {/* 统计 */}
            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">统计</div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <StatCell label="步数" value={formatNum(stats.steps)} />
                <StatCell label="峰值" value={formatNum(stats.peak)} />
                <StatCell label="环长" value={stats.cycleLen || '—'} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNum(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e12) return v.toExponential(3).replace('e+', 'e');
  return String(Math.round(v));
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded px-2 py-1.5">
      <div className="text-zinc-400 text-[10px] uppercase">{label}</div>
      <div className="text-zinc-900 font-bold mt-0.5 truncate" title={String(value)}>{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
      />
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
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
    </div>
  );
}
