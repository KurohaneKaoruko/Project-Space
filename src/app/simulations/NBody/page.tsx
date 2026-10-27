'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { NBodySim, NBODY_DEFAULTS, type NBodyParams, type NBodyStats } from './simulation';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

const PRESETS = [
  { key: 'solar', label: '太阳系' },
  { key: 'binary', label: '双星系统' },
  { key: 'galaxies', label: '星系碰撞' },
  { key: 'cluster', label: '随机星团' },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'];

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

export default function NBodyPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<NBodySim | null>(null);

  const [running, setRunning] = useState(true);
  const [params, setParams] = useState<NBodyParams>(NBODY_DEFAULTS);
  const [newMass, setNewMass] = useState(60);
  const [stats, setStats] = useState<NBodyStats>({ bodies: 0, time: 0, ke: 0, collisions: 0 });

  // 指针发射状态（ref 驱动，避免重渲染抖动）
  const aimRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const massRef = useRef(newMass);
  massRef.current = newMass;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const sim = new NBodySim(canvas);
    simRef.current = sim;
    sim.presetSolar();
    sim.setOnFrame(setStats);
    setStats(sim.stats()); // 预设即刻反映到 HUD，不等首个 rAF
    sim.running = true;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      sim.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // 兜底：窗口 resize 时同步一次（部分环境下 ResizeObserver 首次回调可能延迟）
    window.addEventListener('resize', resize);
    sim.startLoop();

    // 指针交互：按下选位置，拖动设初速度，松手发射
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      aimRef.current = { sx: p.x, sy: p.y, cx: p.x, cy: p.y };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const a = aimRef.current;
      if (!a) return;
      const p = toLocal(e);
      a.cx = p.x;
      a.cy = p.y;
      sim.aim = { x1: a.sx, y1: a.sy, x2: p.x, y2: p.y, mass: massRef.current };
    };
    const onUp = (e: PointerEvent) => {
      const a = aimRef.current;
      aimRef.current = null;
      sim.aim = null;
      if (!a) return;
      const p = toLocal(e);
      const k = 0.04; // 拖距 → 初速度比例
      sim.addBody(a.sx, a.sy, (p.x - a.sx) * k, (p.y - a.sy) * k, massRef.current);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'crosshair';

    return () => {
      sim.dispose();
      ro.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // 参数同步
  useEffect(() => {
    simRef.current?.setParams(params);
  }, [params]);

  const applyPreset = (key: PresetKey) => {
    const sim = simRef.current;
    if (!sim) return;
    if (key === 'solar') sim.presetSolar();
    if (key === 'binary') sim.presetBinary();
    if (key === 'galaxies') sim.presetGalaxies();
    if (key === 'cluster') sim.presetCluster();
  };

  const upd = (p: Partial<NBodyParams>) => setParams((prev) => ({ ...prev, ...p }));

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="NBODY_GRAVITY" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[320px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-zinc-900/30">
            <canvas ref={canvasRef} className="block h-full w-full" />
            {/* 左上 HUD */}
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-300">
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">天体 {stats.bodies}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">并合 {stats.collisions}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">t = {stats.time.toFixed(1)}</span>
            </div>
            {/* 底部提示 */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-zinc-400">
              在画布上按住拖动松手，发射一颗新天体
            </div>
            {/* 暂停遮罩角标 */}
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
              onClick={() => simRef.current?.clearTrail()}
              className="flex-1 rounded-lg py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              清轨迹
            </button>
          </div>

          <div className={`${PANEL} p-4`}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">预设场景</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold text-zinc-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => simRef.current?.clear()}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 py-2 text-xs font-bold text-zinc-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              清空画布
            </button>
          </div>

          <div className={`${PANEL} space-y-3.5 p-4`}>
            <Slider label="引力常数 G" value={params.g} min={0.1} max={4} step={0.05} onChange={(v) => upd({ g: v })} fmt={(v) => v.toFixed(2)} />
            <Slider label="时间流速" value={params.speed} min={0.1} max={3} step={0.05} onChange={(v) => upd({ speed: v })} fmt={(v) => `${v.toFixed(2)}×`} />
            <Slider label="轨迹持续" value={params.trail} min={0} max={0.985} step={0.005} onChange={(v) => upd({ trail: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="软化长度" value={params.softening} min={2} max={60} step={1} onChange={(v) => upd({ softening: v })} fmt={(v) => `${v} px`} />
            <Slider label="新天体质量" value={newMass} min={5} max={4000} step={5} onChange={setNewMass} fmt={(v) => `${v}`} />
            <label className="flex cursor-pointer items-center justify-between pt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              碰撞并合
              <input
                type="checkbox"
                checked={params.merge}
                onChange={(e) => upd({ merge: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </div>

          <div className={`${PANEL} p-4 font-mono text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-zinc-500">统计</div>
            <div>天体数 · {stats.bodies}</div>
            <div>动能 · {stats.ke >= 1000 ? `${(stats.ke / 1000).toFixed(1)}k` : stats.ke.toFixed(0)}</div>
            <div>并合次数 · {stats.collisions}</div>
            <div>模拟时间 · {stats.time.toFixed(1)}</div>
            <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-400">
              半隐式欧拉 + Plummer 软化，O(n²) 直接求和
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
