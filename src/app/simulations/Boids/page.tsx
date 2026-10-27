'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { BoidsSim, BOID_DEFAULTS, type BoidParams, type BoidStats } from './simulation';

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

const PRESETS = [
  { key: 'free', label: '自由群' },
  { key: 'two', label: '双色两群' },
  { key: 'hunt', label: '捕食者追击' },
  { key: 'dense', label: '高密度涌动' },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'];

export default function BoidsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<BoidsSim | null>(null);

  const [running, setRunning] = useState(true);
  const [params, setParams] = useState<BoidParams>(BOID_DEFAULTS);
  const [stats, setStats] = useState<BoidStats>({ count: 0, predators: 0, avgNeighbors: 0, avgSpeed: 0 });
  const [followPointer, setFollowPointer] = useState(false);

  const followRef = useRef(followPointer);
  followRef.current = followPointer;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const sim = new BoidsSim(canvas);
    simRef.current = sim;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      sim.resize(rect.width, rect.height);
    };
    resize(); // 先确定画布尺寸，再生成个体（spawn 依赖 w/h）
    sim.presetFree();
    sim.setOnFrame(setStats);
    setStats(sim.stats());
    sim.running = true;

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    sim.startLoop();

    // 指针：按下/移动时驱赶（按住才生效），toggle 开启后悬停即驱赶
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    let pressing = false;
    const update = (e: PointerEvent) => {
      if (!pressing && !followRef.current) {
        sim.repel = null;
        return;
      }
      sim.repel = toLocal(e);
    };
    const onDown = (e: PointerEvent) => {
      pressing = true;
      canvas.setPointerCapture(e.pointerId);
      update(e);
    };
    const onMove = (e: PointerEvent) => update(e);
    const onUp = () => {
      pressing = false;
      if (!followRef.current) sim.repel = null;
    };
    const onLeave = () => {
      if (!pressing && !followRef.current) sim.repel = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
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
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  useEffect(() => {
    simRef.current?.setParams(params);
  }, [params]);

  const upd = (p: Partial<BoidParams>) => setParams((prev) => ({ ...prev, ...p }));

  const applyPreset = (key: PresetKey) => {
    const sim = simRef.current;
    if (!sim) return;
    if (key === 'free') {
      upd({ predators: 0 });
      sim.presetFree();
    } else if (key === 'two') {
      upd({ predators: 0 });
      sim.presetTwoGroups();
    } else if (key === 'hunt') {
      upd({ predators: 2 });
      sim.presetFree();
    } else if (key === 'dense') {
      upd({ count: 320, vision: 46, sepRadius: 16 });
      sim.presetFree();
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="BOIDS_FLOCKING" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden pt-2 lg:pt-3">
        {/* 画布区 */}
        <div className="relative flex-1 min-h-[320px] lg:min-h-0 p-3 lg:p-4">
          <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-zinc-900/30">
            <canvas ref={canvasRef} className="block h-full w-full" />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-300">
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">个体 {stats.count}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">捕食者 {stats.predators}</span>
              <span className="border border-white/10 bg-black/50 px-2 py-1 rounded">平均邻居 {stats.avgNeighbors.toFixed(1)}</span>
            </div>
            {!running && (
              <div className="absolute right-3 top-3 border border-amber-300/40 bg-amber-100/90 px-2 py-1 font-mono text-[11px] font-bold text-amber-700 rounded">
                已暂停
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-zinc-400">
              按住鼠标驱赶鸟群（开启「指针惊扰」后悬停即生效）
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
              onClick={() => simRef.current?.respawn()}
              className="flex-1 rounded-lg py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              重置
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
              onClick={() => setFollowPointer(!followPointer)}
              className={`mt-1.5 w-full rounded-lg border py-2 text-xs font-bold transition-colors ${
                followPointer
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              指针惊扰：{followPointer ? '开' : '关'}
            </button>
          </div>

          <div className={`${PANEL} space-y-3.5 p-4`}>
            <Slider label="个体数量" value={params.count} min={10} max={400} step={10} onChange={(v) => upd({ count: v })} />
            <Slider label="感知半径" value={params.vision} min={20} max={140} step={2} onChange={(v) => upd({ vision: v })} fmt={(v) => `${v} px`} />
            <Slider label="分离半径" value={params.sepRadius} min={8} max={60} step={2} onChange={(v) => upd({ sepRadius: v })} fmt={(v) => `${v} px`} />
            <Slider label="分离权重" value={params.wSep} min={0} max={4} step={0.1} onChange={(v) => upd({ wSep: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="对齐权重" value={params.wAli} min={0} max={4} step={0.1} onChange={(v) => upd({ wAli: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="聚合权重" value={params.wCoh} min={0} max={4} step={0.1} onChange={(v) => upd({ wCoh: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="巡航速度" value={params.speed} min={0.6} max={5} step={0.1} onChange={(v) => upd({ speed: v })} fmt={(v) => v.toFixed(1)} />
            <Slider label="轨迹残影" value={params.trail} min={0} max={0.985} step={0.005} onChange={(v) => upd({ trail: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <span>边界模式</span>
                <span className="font-mono text-blue-600">{params.edge === 'wrap' ? '环绕' : '反弹'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(['wrap', 'bounce'] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => upd({ edge: e })}
                    className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${
                      params.edge === e ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    {e === 'wrap' ? '环绕' : '反弹'}
                  </button>
                ))}
              </div>
            </label>
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <span>捕食者数量</span>
                <span className="font-mono text-blue-600">{params.predators}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => upd({ predators: n })}
                    className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${
                      params.predators === n ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className={`${PANEL} p-4 text-[11px] leading-relaxed text-zinc-500`}>
            <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-zinc-500">三条规则</div>
            <div><span className="font-bold text-zinc-700">分离</span>——与过近个体拉开距离</div>
            <div><span className="font-bold text-zinc-700">对齐</span>——转向邻居的平均航向</div>
            <div><span className="font-bold text-zinc-700">聚合</span>——靠拢邻居的质心</div>
            <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-400">
              没有领袖、没有全局协调，复杂群体行为完全从局部交互涌现（Craig Reynolds, 1986）。
              把聚合/对齐调 0 可观察纯分离的「气体」行为。
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
