'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { PathfindingGrid, ALGO_LABELS, type AlgoKey, type PathResult } from './grid';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

const COLS = 46;
const ROWS = 28;

// 着色：访问先后 → 蓝→青渐变；墙 → 深灰；路径 → 琥珀
const COLOR_START = '#059669';
const COLOR_GOAL = '#dc2626';
const COLOR_WALL = '#18181b';
const COLOR_PATH = '#f59e0b';
const COLOR_VISITED_LATE = '#bfdbfe';
const COLOR_VISITED_EARLY = '#1d4ed8';

function colorForOrder(order: number, maxOrder: number) {
  if (order < 0) return null;
  const t = maxOrder > 0 ? order / maxOrder : 0;
  // 蓝(30,64,175) → 浅蓝(191,219,254)
  const r = Math.round(30 + (191 - 30) * t);
  const g = Math.round(64 + (219 - 64) * t);
  const b = Math.round(175 + (254 - 175) * t);
  return `rgb(${r},${g},${b})`;
}

/** 迷宫地图 SVG 图标风 control */
function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
        active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
      }`}
    >
      {children}
    </button>
  );
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

type Tool = 'wall' | 'start' | 'goal' | 'erase';

export default function PathfindingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<PathfindingGrid | null>(null);

  const [algo, setAlgo] = useState<AlgoKey>('astar');
  const [weight, setWeight] = useState(1);
  const [speed, setSpeed] = useState(2);
  const [running, setRunning] = useState(false);
  const [tool, setTool] = useState<Tool>('wall');
  const [result, setResult] = useState<PathResult | null>(null);
  const [algoMeta, setAlgoMeta] = useState<{ label: string; visited: number; cost: number; found: boolean } | null>(null);
  const [algoStats, setAlgoStats] = useState<Record<string, { visited: number; cost: number; found: boolean }> | null>(null);

  // 回放状态（ref 驱动）
  const playbackRef = useRef<{ result: PathResult; frame: number } | null>(null);
  const algoRef = useRef(algo);
  const weightRef = useRef(weight);
  const speedRef = useRef(speed);
  const runningRef = useRef(false);
  algoRef.current = algo;
  weightRef.current = weight;
  speedRef.current = speed;

  if (!gridRef.current) gridRef.current = new PathfindingGrid(COLS, ROWS);

  // 主渲染 + 回放循环
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const grid = gridRef.current;
    if (!canvas || !wrap || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let dpr = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      // 布局尺寸交给 CSS w-full/h-full，避免 inline px 宽度撑死 flex 项 min-content
      draw();
    };

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const cw = rect.width / COLS;
      const ch = rect.height / ROWS;
      const cell = Math.min(cw, ch);
      const ox = (rect.width - cell * COLS) / 2;
      const oy = (rect.height - cell * ROWS) / 2;

      let maxOrder = 1;
      for (const c of grid.cells) if (c.order > maxOrder) maxOrder = c.order;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // 播放进度截断：正在回放时只显示前 frame 步
      const pb = playbackRef.current;
      const limit = pb ? pb.frame : Infinity;

      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          const c = grid.cells[grid.idx(x, y)];
          const px = ox + x * cell;
          const py = oy + y * cell;
          let fill: string | null = null;
          if (c.wall) fill = COLOR_WALL;
          else if (c.order >= 0 && c.order <= limit) fill = colorForOrder(c.order, maxOrder);
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
          }
          if (c.onPath && (!pb || c.order <= limit)) {
            ctx.fillStyle = COLOR_PATH;
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // 网格线
      ctx.strokeStyle = 'rgba(24,24,27,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x += 1) {
        ctx.beginPath();
        ctx.moveTo(ox + x * cell, oy);
        ctx.lineTo(ox + x * cell, oy + ROWS * cell);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y += 1) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + y * cell);
        ctx.lineTo(ox + COLS * cell, oy + y * cell);
        ctx.stroke();
      }
      // 起点/终点
      const drawMarker = (pos: [number, number], color: string, label: string) => {
        const px = ox + pos[0] * cell;
        const py = oy + pos[1] * cell;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, cell * 0.42)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, px + cell / 2, py + cell / 2 + 0.5);
      };
      drawMarker(grid.start, COLOR_START, 'A');
      drawMarker(grid.goal, COLOR_GOAL, 'B');
    };

    const stepPlayback = () => {
      const pb = playbackRef.current;
      if (!pb) return;
      const stepsPerFrame = Math.max(1, Math.round(speedRef.current * 3));
      pb.frame = Math.min(pb.result.visitedCount, pb.frame + stepsPerFrame);
      if (pb.frame >= pb.result.visitedCount) {
        // 回放结束：显示完整结果
        playbackRef.current = null;
      }
    };

    const loop = () => {
      if (runningRef.current || playbackRef.current) stepPlayback();
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 首次 + 参数变化时即时计算（不改回放状态）
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.resetSearch();
    const r = grid.search(algo, weight);
    setResult(r);
    setAlgoMeta({ label: ALGO_LABELS[algo], visited: r.visitedCount, cost: r.pathCost, found: r.found });
  }, [algo, weight]);

  // 对比统计：四种算法在同一地图上各跑一遍
  const computeCompare = () => {
    const grid = gridRef.current;
    if (!grid) return;
    const snapWalls = grid.cells.map((c) => c.wall);
    const stats: Record<string, { visited: number; cost: number; found: boolean }> = {};
    (Object.keys(ALGO_LABELS) as AlgoKey[]).forEach((k) => {
      const r = grid.search(k, weight);
      stats[ALGO_LABELS[k]] = { visited: r.visitedCount, cost: r.pathCost, found: r.found };
    });
    grid.cells.forEach((c, i) => {
      c.wall = snapWalls[i];
    });
    // 恢复当前算法的显示
    const r = grid.search(algoRef.current, weightRef.current);
    setResult(r);
    setAlgoStats(stats);
  };

  const runSearch = () => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.resetSearch();
    const r = grid.search(algo, weight);
    setResult(r);
    setAlgoMeta({ label: ALGO_LABELS[algo], visited: r.visitedCount, cost: r.pathCost, found: r.found });
    playbackRef.current = { result: r, frame: 0 };
    runningRef.current = true;
    setRunning(true);
    const tick = () => {
      const pb = playbackRef.current;
      if (!pb) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // 画布交互：拖拽绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const paint = (e: PointerEvent, click = false) => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width / COLS;
      const ch = rect.height / ROWS;
      const cell = Math.min(cw, ch);
      const ox = (rect.width - cell * COLS) / 2;
      const oy = (rect.height - cell * ROWS) / 2;
      const x = Math.floor((e.clientX - rect.left - ox) / cell);
      const y = Math.floor((e.clientY - rect.top - oy) / cell);
      if (!grid.inside(x, y)) return;
      if (tool === 'wall') {
        if (click || e.buttons > 0) grid.toggleWall(x, y);
      } else if (tool === 'erase') {
        if (click || e.buttons > 0) {
          const c = grid.get(x, y);
          if (c) c.wall = false;
        }
      } else if (tool === 'start') {
        grid.setStart(x, y);
      } else if (tool === 'goal') {
        grid.setGoal(x, y);
      }
    };
    let painting = false;
    const onDown = (e: PointerEvent) => {
      painting = true;
      canvas.setPointerCapture(e.pointerId);
      // 单击墙格 = 擦除；单击空格 = 画墙（toggle 语义）
      if (tool === 'wall') {
        const rect = canvas.getBoundingClientRect();
        const cw = rect.width / COLS;
        const ch = rect.height / ROWS;
        const cell = Math.min(cw, ch);
        const ox = (rect.width - cell * COLS) / 2;
        const oy = (rect.height - cell * ROWS) / 2;
        const x = Math.floor((e.clientX - rect.left - ox) / cell);
        const y = Math.floor((e.clientY - rect.top - oy) / cell);
        const c = grid.get(x, y);
        if (c && c.wall) {
          c.wall = false;
          return;
        }
      }
      paint(e, true);
    };
    const onMove = (e: PointerEvent) => {
      if (painting) paint(e);
    };
    const onUp = () => {
      painting = false;
      // 画完即时重算，反馈可见
      grid.resetSearch();
      const r = grid.search(algoRef.current, weightRef.current);
      setResult(r);
      setAlgoMeta({ label: ALGO_LABELS[algoRef.current], visited: r.visitedCount, cost: r.pathCost, found: r.found });
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'crosshair';
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [tool]);

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="PATHFINDING" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[300px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5">
            <canvas ref={canvasRef} className="block h-full w-full" />
            {/* 图例 */}
            <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: 'linear-gradient(90deg,#1d4ed8,#bfdbfe)' }} /> 访问顺序</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_PATH }} /> 最短路径</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_WALL }} /> 墙</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_START }} /> 起点 A</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_GOAL }} /> 终点 B</span>
            </div>
          </div>
        </div>

        {/* 控制面板 */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-3 lg:w-[330px] lg:border-l lg:border-zinc-200 lg:bg-white/60">
          <div className={`${PANEL} p-1.5 grid grid-cols-4 gap-1`}>
            {(Object.keys(ALGO_LABELS) as AlgoKey[]).map((k) => (
              <SegButton key={k} active={algo === k} onClick={() => setAlgo(k)}>
                {ALGO_LABELS[k]}
              </SegButton>
            ))}
          </div>

          <div className={`${PANEL} p-4 space-y-3.5`}>
            <Slider label="启发权重 ε" value={weight} min={0} max={3} step={0.1} onChange={setWeight} fmt={(v) => (v === 0 ? '0 (Dijkstra)' : v.toFixed(1))} />
            <Slider label="回放速度" value={speed} min={0.5} max={10} step={0.5} onChange={setSpeed} fmt={(v) => `${v.toFixed(1)}×`} />
            <button
              onClick={runSearch}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
            >
              ▶ 从头播放搜索过程
            </button>
            <button
              onClick={computeCompare}
              className="w-full rounded-lg border border-zinc-200 py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              四算法对比（当前地图）
            </button>
          </div>

          {algoStats && (
            <div className={`${PANEL} p-4`}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">对比结果</div>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-zinc-400 text-left">
                    <th className="pb-1 font-normal">算法</th>
                    <th className="pb-1 font-normal text-right">访问</th>
                    <th className="pb-1 font-normal text-right">路径长</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(algoStats).map(([k, v]) => (
                    <tr key={k} className="border-t border-zinc-100">
                      <td className="py-1 text-zinc-700">{k}</td>
                      <td className="py-1 text-right text-zinc-800">{v.found ? v.visited : '—'}</td>
                      <td className="py-1 text-right text-zinc-800">{v.found ? v.cost : '不可达'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                访问格数越少 = 搜索越聚焦；路径长相同则说明都找到了最短路（ε≤1 时保证最优）。
              </div>
            </div>
          )}

          <div className={`${PANEL} p-4`}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">画笔工具</div>
            <div className="grid grid-cols-4 gap-1">
              {([
                ['wall', '画墙'],
                ['erase', '擦除'],
                ['start', '移 A'],
                ['goal', '移 B'],
              ] as [Tool, string][]).map(([t, label]) => (
                <SegButton key={t} active={tool === t} onClick={() => setTool(t)}>
                  {label}
                </SegButton>
              ))}
            </div>
            <button
              onClick={() => {
                gridRef.current?.clearWalls();
                const grid = gridRef.current;
                if (grid) {
                  grid.resetSearch();
                  const r = grid.search(algoRef.current, weightRef.current);
                  setResult(r);
                  setAlgoMeta({ label: ALGO_LABELS[algoRef.current], visited: r.visitedCount, cost: r.pathCost, found: r.found });
                }
              }}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 py-2 text-xs font-bold text-zinc-500 transition-colors hover:bg-zinc-100"
            >
              清空墙
            </button>
            <button
              onClick={() => {
                gridRef.current?.maze();
                const grid = gridRef.current;
                if (grid) {
                  const r = grid.search(algoRef.current, weightRef.current);
                  setResult(r);
                  setAlgoMeta({ label: ALGO_LABELS[algoRef.current], visited: r.visitedCount, cost: r.pathCost, found: r.found });
                }
              }}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 py-2 text-xs font-bold text-zinc-500 transition-colors hover:bg-zinc-100"
            >
              随机迷宫
            </button>
          </div>

          <div className={`${PANEL} p-4 font-mono text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-zinc-500">当前结果</div>
            <div className="flex justify-between"><span>算法</span><span className="text-zinc-800">{algoMeta?.label ?? '—'}</span></div>
            <div className="flex justify-between"><span>访问格子</span><span className="text-zinc-800">{algoMeta?.visited ?? '—'}</span></div>
            <div className="flex justify-between"><span>路径长度</span><span className="text-zinc-800">{algoMeta?.found ? algoMeta.cost : '不可达'}</span></div>
            <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-400">
              f(n) = g(n) + ε·h(n)。ε=0 退化为 Dijkstra；ε&gt;1 更快但可能失去最优性。
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
