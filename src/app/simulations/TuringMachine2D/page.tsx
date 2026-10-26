'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import type { TM2DDef, TM2DStats } from './simulation';
import { PRESETS_2D, SYMBOL_COLORS, TM2DSim } from './simulation';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

export default function TuringMachine2DPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<TM2DSim | null>(null);

  const [presetId, setPresetId] = useState(PRESETS_2D[0].id);
  const preset = useMemo(() => PRESETS_2D.find((p) => p.id === presetId) ?? PRESETS_2D[0], [presetId]);

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(240);
  const [cellSize, setCellSize] = useState(8);
  const [stats, setStats] = useState<TM2DStats | null>(null);
  const [showTable, setShowTable] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [follow, setFollow] = useState(true); // 镜头跟随爬虫

  // 相机（世界坐标，格子单位）：follow 时锁定爬虫，否则用户平移
  const camRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);

  // 切换预设 -> 重建引擎
  useEffect(() => {
    const sim = new TM2DSim(preset as TM2DDef);
    sim.setStepsPerSecond(speed);
    sim.setOnFrame(setStats);
    sim.reset();
    simRef.current = sim;
    camRef.current = { x: 0, y: 0 };
    setRunning(false);
    setStats(sim.getStats());
    return () => sim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    simRef.current?.setStepsPerSecond(speed);
  }, [speed]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (running) sim.start();
    else sim.stop();
  }, [running]);

  useEffect(() => {
    if (stats?.halted) setRunning(false);
  }, [stats?.halted]);

  // ---------- 画布：世界坐标渲染，无限网格 ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const sim = simRef.current;
    if (!canvas || !wrap || !sim || !stats) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (follow) {
      camRef.current = { x: stats.x, y: stats.y };
    }
    const cs = cellSize * dpr;
    const cam = camRef.current;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    const halfW = w / (2 * cs);
    const halfH = h / (2 * cs);
    const x0 = Math.floor(cam.x - halfW) - 1;
    const x1 = Math.ceil(cam.x + halfW) + 1;
    const y0 = Math.floor(cam.y - halfH) - 1;
    const y1 = Math.ceil(cam.y + halfH) + 1;

    // 网格线
    if (cellSize >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let cx = x0; cx <= x1; cx++) {
        const px = Math.floor((cx - cam.x) * cs + w / 2) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let cy = y0; cy <= y1; cy++) {
        const py = Math.floor((cy - cam.y) * cs + h / 2) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
    }

    // 已访问格子：只遍历包围盒与视口交集
    const vx0 = Math.max(sim.bounds.minX, x0);
    const vx1 = Math.min(sim.bounds.maxX, x1);
    const vy0 = Math.max(sim.bounds.minY, y0);
    const vy1 = Math.min(sim.bounds.maxY, y1);
    for (let cy = vy0; cy <= vy1; cy++) {
      for (let cx = vx0; cx <= vx1; cx++) {
        const sym = sim.cell(cx, cy);
        if (sym === 0) continue;
        ctx.fillStyle = SYMBOL_COLORS[sym % SYMBOL_COLORS.length];
        ctx.fillRect(
          Math.floor((cx - cam.x) * cs + w / 2),
          Math.floor((cy - cam.y) * cs + h / 2),
          Math.ceil(cs),
          Math.ceil(cs),
        );
      }
    }

    // 原点标记（十字）
    const ox = (0 - cam.x) * cs + w / 2;
    const oy = (0 - cam.y) * cs + h / 2;
    if (ox >= 0 && ox <= w && oy >= 0 && oy <= h) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5 * dpr;
      const s = 7 * dpr;
      ctx.beginPath();
      ctx.moveTo(ox - s, oy);
      ctx.lineTo(ox + s, oy);
      ctx.moveTo(ox, oy - s);
      ctx.lineTo(ox, oy + s);
      ctx.stroke();
    }

    // 爬虫（状态色三角，按绝对移动方向无爬虫朝向——直接画在格子上）
    const px = (stats.x - cam.x) * cs + w / 2;
    const py = (stats.y - cam.y) * cs + h / 2;
    const colors = ['#0891b2', '#d97706', '#7c3aed', '#059669', '#db2777', '#2563eb', '#dc2626', '#65a30d'];
    ctx.fillStyle = stats.halted ? '#71717a' : colors[((stats.state % colors.length) + colors.length) % colors.length];
    const s = Math.max(cs * 0.8, 8 * dpr);
    ctx.beginPath();
    ctx.arc(px, py, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  }, [stats, cellSize, follow]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ---------- 交互：拖拽平移 / 点击改格子 ----------
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, camX: camRef.current.x, camY: camRef.current.y };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / cellSize;
    const dy = (e.clientY - d.startY) / cellSize;
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
      setFollow(false);
      camRef.current = { x: d.camX - dx, y: d.camY - dy };
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!d || !sim || !canvas) return;
    const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (moved < 4) {
      // 视为点击：循环改格子
      const rect = canvas.getBoundingClientRect();
      const cx = Math.floor(camRef.current.x + (e.clientX - rect.left - rect.width / 2) / cellSize);
      const cy = Math.floor(camRef.current.y + (e.clientY - rect.top - rect.height / 2) / cellSize);
      sim.paint(cx, cy, (sim.cell(cx, cy) + 1) % preset.nSymbols);
    }
  };

  // ---------- 操作 ----------
  const doStep = () => {
    setRunning(false);
    simRef.current?.step();
  };
  const doReset = () => {
    setRunning(false);
    simRef.current?.reset();
    camRef.current = { x: 0, y: 0 };
    setFollow(true);
    setStats(simRef.current?.getStats() ?? null);
  };
  const doRunN = (n: number) => {
    setRunning(false);
    const sim = simRef.current;
    if (!sim) return;
    sim.run(n);
    setStats(sim.getStats());
  };

  const fmt = (n: number) => n.toLocaleString('en-US');
  const stateLabel = (st: number) => `S${st}`;

  const bbox = stats ? `${fmt(stats.maxX - stats.minX + 1)} × ${fmt(stats.maxY - stats.minY + 1)}` : '—';

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 relative">
      <Navigation title="TURING_MACHINE_2D" />

      {/* 画布：占据导航栏以下的全部空间 */}
      <div ref={wrapRef} className="absolute left-0 right-0 top-16 bottom-0">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (dragRef.current = null)}
        />
      </div>

      {/* 覆盖层 */}
      <div className="absolute inset-0 top-16 pointer-events-none">
        {/* 左上：预设 + 状态 */}
        <div className="absolute left-4 top-4 sm:left-6 sm:top-6 w-[290px] pointer-events-auto">
          <div className={`${PANEL} p-4 space-y-3`}>
            <div className="text-[10px] font-mono text-zinc-400 tracking-[0.25em] uppercase">内置预设</div>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-sm text-zinc-900 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {PRESETS_2D.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded font-mono text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: stats?.halted ? '#71717a' : '#0891b2' }}
              >
                {stats?.halted ? 'HALT' : stateLabel(stats?.state ?? 0)}
              </span>
              <span className="text-zinc-500 text-xs font-mono">
                ({fmt(stats?.x ?? 0)}, {fmt(stats?.y ?? 0)})
              </span>
            </div>

            <button
              onClick={() => setShowNote((v) => !v)}
              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-700 transition-colors uppercase tracking-wider"
            >
              {showNote ? '收起说明 −' : '机器说明 +'}
            </button>
            {showNote && (
              <p className="text-[11px] leading-relaxed text-zinc-500 border-t border-zinc-100 pt-3">
                {preset.note}
              </p>
            )}
          </div>
        </div>

        {/* 右上：大步数 */}
        <div className="absolute right-16 top-4 sm:right-20 sm:top-6 text-right pointer-events-none">
          <div className="text-zinc-400 font-mono text-[10px] tracking-[0.3em] uppercase">Steps</div>
          <div className="text-zinc-900 font-mono font-black leading-none tracking-tighter text-5xl sm:text-7xl xl:text-8xl tabular-nums">
            {fmt(stats?.steps ?? 0)}
          </div>
          <div className="mt-2 flex gap-5 justify-end font-mono text-xs text-zinc-400">
            <span>
              覆盖 <span className="text-zinc-900 font-bold">{fmt(stats?.covered ?? 0)}</span>
            </span>
            <span>
              范围 <span className="text-zinc-900 font-bold">{bbox}</span>
            </span>
          </div>
        </div>

        {/* 左下：控制 */}
        <div className={`absolute left-4 bottom-4 sm:left-6 sm:bottom-6 w-[290px] pointer-events-auto ${PANEL} p-4 space-y-3`}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => !stats?.halted && setRunning((v) => !v)}
              disabled={stats?.halted}
              className={`px-3 py-2.5 rounded-md font-bold text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                running
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {running ? '暂停' : '开始'}
            </button>
            <button
              onClick={doStep}
              disabled={stats?.halted}
              className="px-3 py-2.5 rounded-md font-bold text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              单步
            </button>
            <button
              onClick={doReset}
              className="px-3 py-2.5 rounded-md font-bold text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors"
            >
              重置
            </button>
            <button
              onClick={() => doRunN(10000)}
              disabled={stats?.halted}
              title="同步快进 1 万步"
              className="px-3 py-2.5 rounded-md font-bold text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +10k
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
              <span>速度</span>
              <span className="text-zinc-700">{fmt(speed)} 步/秒</span>
            </div>
            <input
              type="range"
              className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              min={1}
              max={20000}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            />
            <div className="grid grid-cols-4 gap-1">
              {[1, 60, 1200, 20000].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                    speed === s
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                  }`}
                >
                  {s >= 1000 ? `${s / 1000}k` : s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                <span>缩放</span>
                <span className="text-zinc-700">{cellSize}px</span>
              </div>
              <input
                type="range"
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                min={2}
                max={24}
                step={1}
                value={cellSize}
                onChange={(e) => setCellSize(parseInt(e.target.value, 10))}
              />
            </div>
            <button
              onClick={() => setFollow((v) => !v)}
              className={`px-3 py-2 rounded-md font-bold text-xs border transition-colors shrink-0 ${
                follow
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-white'
              }`}
              title="镜头是否跟随爬虫"
            >
              {follow ? '跟随中' : '自由镜头'}
            </button>
          </div>
        </div>

        {/* 右下：规则表 */}
        <div className="absolute right-4 bottom-4 sm:right-6 sm:bottom-6 max-w-[calc(100vw-2rem)] pointer-events-auto">
          <div className={`${PANEL} overflow-hidden`}>
            <button
              onClick={() => setShowTable((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-mono text-zinc-400 uppercase tracking-widest hover:text-zinc-700 transition-colors"
            >
              <span>规则表 · δ(state, symbol)</span>
              <span>{showTable ? '−' : '+'}</span>
            </button>
            {showTable && (
              <div className="px-4 pb-4 -mt-1 overflow-x-auto">
                <table className="font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="pb-2 pr-3 text-left text-zinc-400 text-[10px] uppercase tracking-wider font-bold align-bottom">
                        δ
                      </th>
                      {Array.from({ length: preset.nStates }, (_, st) => (
                        <th
                          key={st}
                          className={`pb-2 px-1.5 text-left font-bold align-bottom whitespace-nowrap ${
                            stats?.state === st && !stats.halted ? 'text-blue-600' : 'text-zinc-400'
                          }`}
                        >
                          {stateLabel(st)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: preset.nSymbols }, (_, sym) => (
                      <tr key={sym} className="border-t border-zinc-100">
                        <td className="py-1.5 pr-3 text-zinc-400 whitespace-nowrap">
                          读
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm align-middle ml-1 border border-zinc-300"
                            style={{ backgroundColor: SYMBOL_COLORS[sym % SYMBOL_COLORS.length] }}
                          />
                        </td>
                        {Array.from({ length: preset.nStates }, (_, st) => {
                          const rule = preset.rules[st]?.[sym];
                          const moveGlyph = ['↑', '→', '↓', '←'][rule?.move ?? 1];
                          return (
                            <td key={st} className="py-1.5 px-2 tabular-nums whitespace-nowrap text-zinc-600">
                              {rule
                                ? `${rule.write}${moveGlyph}${rule.next === -1 ? 'H' : stateLabel(rule.next)}`
                                : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-zinc-400 font-mono mt-3 leading-relaxed">
                  写符号 + 移动方向(上下左右) + 下一状态。网格无界，拖拽平移、点击改格子、+10k 快进。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
