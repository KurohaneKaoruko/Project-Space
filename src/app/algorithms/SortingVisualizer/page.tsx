'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import {
  DISTRIBUTIONS,
  SORT_ALGORITHMS,
  createPlayer,
  generateData,
  getSortAlgorithm,
  resetPlayer,
  stepPlayer,
  type Distribution,
} from './sortingAlgorithms';

interface Snapshot {
  cursor: number;
  total: number;
  comparisons: number;
  swaps: number;
  writes: number;
  reads: number;
  phase: string;
  finished: boolean;
}

const ALGO_GROUPS = Array.from(new Set(SORT_ALGORITHMS.map((a) => a.group)));

// 条形配色
const COLORS = {
  default: '#3b82f6',
  sorted: '#34d399',
  compare: '#fbbf24',
  swap: '#fb7185',
  write: '#fb7185',
  read: '#22d3ee',
  pivot: '#c084fc',
  key: '#22d3ee',
};

export default function SortingVisualizerPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof createPlayer> | null>(null);
  const runningRef = useRef(false);
  const speedRef = useRef(80);

  const [algoId, setAlgoId] = useState('bubble');
  const [distribution, setDistribution] = useState<Distribution>('random');
  const [size, setSize] = useState(48);
  const [speed, setSpeed] = useState(80);
  const [running, setRunning] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  const meta = getSortAlgorithm(algoId);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // 算法 / 数量 / 分布变化时重建数据与操作流
  const rebuild = useCallback(() => {
    const data = generateData(distribution, size);
    playerRef.current = createPlayer(data, algoId);
  }, [algoId, distribution, size]);

  const pushSnap = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    setSnap({
      cursor: p.cursor,
      total: p.ops.length,
      comparisons: p.stats.comparisons,
      swaps: p.stats.swaps,
      writes: p.stats.writes,
      reads: p.stats.reads,
      phase: p.phase,
      finished: p.finished,
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const p = playerRef.current;
    if (!canvas || !p) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const m = 8 * dpr;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    const n = p.arr.length;
    if (!n) return;

    const slot = (w - 2 * m) / n;
    const barW = Math.max(1, slot - (slot > 3 * dpr ? dpr : 0));
    const usableH = h - 2 * m;
    const hl = p.highlight;

    for (let i = 0; i < n; i++) {
      let color = COLORS.default;
      if (p.sorted[i]) color = COLORS.sorted;

      if (hl) {
        if (hl.kind === 'compare' || hl.kind === 'swap') {
          if (i === hl.i || i === hl.j) color = hl.kind === 'compare' ? COLORS.compare : COLORS.swap;
        } else if (hl.kind === 'write' && i === hl.i) {
          color = COLORS.write;
        } else if (hl.kind === 'read' && i === hl.i) {
          color = COLORS.read;
        }
      }
      if (p.focus && p.focus.i === i) {
        color = p.focus.kind === 'pivot' ? COLORS.pivot : COLORS.key;
      }

      const dimmed = p.range !== null && !p.sorted[i] && (i < p.range[0] || i > p.range[1]);
      ctx.globalAlpha = dimmed ? 0.25 : 1;
      ctx.fillStyle = color;

      const bh = Math.max(2 * dpr, (p.arr[i] / 100) * usableH);
      ctx.fillRect(m + i * slot, h - m - bh, barW, bh);
    }
    ctx.globalAlpha = 1;

    // 基线
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(m, h - m, w - 2 * m, Math.max(1, dpr));
  }, []);

  // 重建后立即刷新一帧
  useEffect(() => {
    rebuild();
    draw();
    pushSnap();
  }, [rebuild, draw, pushSnap]);

  // 主循环：按速度回放操作流
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastSnap = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const p = playerRef.current;
      if (p && runningRef.current) {
        acc += dt * speedRef.current;
        const steps = Math.floor(acc);
        if (steps > 0) {
          acc -= steps;
          stepPlayer(p, Math.min(steps, 30000));
          if (p.finished) setRunning(false);
          if (now - lastSnap > 100) {
            lastSnap = now;
            pushSnap();
          }
        }
      }
      draw();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, pushSnap]);

  // 画布随容器尺寸自适应（device pixel）
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const actions = useMemo(
    () => [
      { label: running ? '暂停 (Pause)' : '开始 (Play)', onClick: () => setRunning((v) => !v), primary: true },
      {
        label: '单步 (Step)',
        onClick: () => {
          const p = playerRef.current;
          if (!p) return;
          stepPlayer(p, 1);
          pushSnap();
        },
        primary: false,
      },
      {
        label: '重播 (Replay)',
        onClick: () => {
          const p = playerRef.current;
          if (!p) return;
          resetPlayer(p);
          pushSnap();
        },
        primary: false,
      },
      {
        label: '新数据 (New)',
        onClick: () => {
          rebuild();
          pushSnap();
        },
        primary: false,
      },
    ],
    [running, rebuild, pushSnap]
  );

  const progress = snap && snap.total > 0 ? snap.cursor / snap.total : 0;

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="SORTING_VISUALIZER" />

      <div className="flex-1 flex flex-col lg:flex-row pt-16 h-full overflow-hidden">
        {/* 画布区 */}
        <div ref={wrapRef} className="h-64 shrink-0 lg:h-full lg:flex-1 relative overflow-hidden bg-zinc-950">
          <canvas ref={canvasRef} className="block w-full h-full" />
          <div className="absolute top-4 left-4 text-white/60 font-mono text-[11px] pointer-events-none whitespace-pre leading-5">
            {snap
              ? `${snap.phase}\n比较 ${snap.comparisons}  交换 ${snap.swaps}  写入 ${snap.writes}  读取 ${snap.reads}\nSTEP ${snap.cursor}/${snap.total}`
              : '...'}
          </div>
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-white/40 pointer-events-none">
            <LegendChip color={COLORS.default} label="未排序" />
            <LegendChip color={COLORS.compare} label="比较" />
            <LegendChip color={COLORS.swap} label="交换/写入" />
            <LegendChip color={COLORS.read} label="读取" />
            <LegendChip color={COLORS.pivot} label="枢轴" />
            <LegendChip color={COLORS.sorted} label="已就绪" />
          </div>
        </div>

        {/* 控制面板 */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-500"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// 排序算法可视化'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-500 uppercase">算法 ({SORT_ALGORITHMS.length} 种)</label>
              <select
                value={algoId}
                onChange={(e) => setAlgoId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {ALGO_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {SORT_ALGORITHMS.filter((a) => a.group === group).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.en})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={
                    a.primary
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
              <ControlSlider label="数量 (Elements)" value={size} min={8} max={160} step={1} onChange={setSize} />
              <ControlSlider label="速度 (Steps/s)" value={speed} min={1} max={600} step={1} onChange={setSpeed} />
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">数据分布</div>
              <div className="grid grid-cols-2 gap-2">
                {DISTRIBUTIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDistribution(d.id)}
                    className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                      distribution === d.id
                        ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 进度与统计 */}
            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">统计</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <StatCell label="比较" value={snap?.comparisons ?? 0} />
                <StatCell label="交换" value={snap?.swaps ?? 0} />
                <StatCell label="写入" value={snap?.writes ?? 0} />
                <StatCell label="读取" value={snap?.reads ?? 0} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400 uppercase">
                  <span>进度</span>
                  <span>
                    {snap ? `${snap.cursor}/${snap.total}` : '--'}
                    {snap?.finished ? ' · 完成' : ''}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-[width] duration-150"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 算法说明 */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">算法档案</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <InfoCell label="最好" value={meta.best} />
                <InfoCell label="平均" value={meta.avg} />
                <InfoCell label="最坏" value={meta.worst} />
                <InfoCell label="空间" value={meta.space} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-zinc-400 uppercase text-[10px]">稳定性</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                    meta.stable
                      ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                      : 'border-rose-200 text-rose-600 bg-rose-50'
                  }`}
                >
                  {meta.stable ? '稳定' : '不稳定'}
                </span>
                <span className="font-mono text-[10px] text-zinc-400 uppercase">{meta.group}</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">{meta.idea}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}></span>
      {label}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded px-2 py-1.5 flex justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-900 font-bold">{value}</span>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded px-2 py-1.5">
      <div className="text-zinc-400 text-[10px] uppercase">{label}</div>
      <div className="text-zinc-900 font-bold mt-0.5 break-words">{value}</div>
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
