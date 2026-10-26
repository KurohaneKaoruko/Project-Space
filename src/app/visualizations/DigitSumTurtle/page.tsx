'use client';

import { useEffect, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { DigitSumTurtleSim } from './simulation';
import type { DigitSumTurtleStats } from './simulation';

const PRESETS = [
  { value: '2,6', label: '科赫雪花风 · n=2, m=6（默认）' },
  { value: '3,6', label: '六角雪花 · n=3, m=6' },
  { value: '2,4', label: 'n=2, m=4（90°）' },
  { value: '3,4', label: 'n=3, m=4（90°）' },
  { value: '4,4', label: 'n=4, m=4（90°）' },
  { value: '5,8', label: 'n=5, m=8（45°）' },
  { value: '6,6', label: 'n=6, m=6（60°）' },
  { value: '2,3', label: '长带漂移 · n=2, m=3（120°）' },
];

function speedFromIdx(idx: number): number {
  return Math.max(1, Math.round(Math.pow(10, (idx / 100) * 5.7)));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function headingName(deg: number): string {
  /* 六等分方位：0=右 60=右下 120=左下 180=左 240=左上 300=右上 */
  const names = ['右', '右下', '左下', '左', '左上', '右上'];
  return names[Math.round(deg / 60) % 6];
}

export default function DigitSumTurtlePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<DigitSumTurtleSim | null>(null);

  const [running, setRunning] = useState(false);
  const [base, setBase] = useState(2);
  const [divs, setDivs] = useState(6);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [speedIdx, setSpeedIdx] = useState(58);
  const [lineWidth, setLineWidth] = useState(1.4);
  const [heading, setHeading] = useState(60);
  const [follow, setFollow] = useState(true);
  const [rainbow, setRainbow] = useState(false);
  const [color, setColor] = useState('#60a5fa');
  const [period, setPeriod] = useState(8192);
  const [startK, setStartK] = useState(0);
  const [stats, setStats] = useState<DigitSumTurtleStats | null>(null);

  const cfgRef = useRef({
    base: 2,
    divs: 6,
    dir: -1 as 1 | -1,
    speed: speedFromIdx(58),
    startHeading: 60,
    follow: true,
    color: '#60a5fa',
    rainbow: false,
    rainbowPeriod: 8192,
    lineWidth: 1.4,
    startK: 0,
  });
  useEffect(() => {
    cfgRef.current = {
      base,
      divs,
      dir,
      speed: speedFromIdx(speedIdx),
      startHeading: heading,
      follow,
      color,
      rainbow,
      rainbowPeriod: period,
      lineWidth,
      startK,
    };
  });

  useEffect(() => {
    simRef.current?.setConfig({ base });
  }, [base]);
  useEffect(() => {
    simRef.current?.setConfig({ divs });
  }, [divs]);
  useEffect(() => {
    simRef.current?.setConfig({ dir });
  }, [dir]);
  useEffect(() => {
    simRef.current?.setConfig({ speed: speedFromIdx(speedIdx) });
  }, [speedIdx]);
  useEffect(() => {
    simRef.current?.setConfig({ lineWidth });
  }, [lineWidth]);
  useEffect(() => {
    simRef.current?.setConfig({ rainbow, color, rainbowPeriod: period });
  }, [rainbow, color, period]);
  useEffect(() => {
    simRef.current?.setConfig({ follow });
  }, [follow]);
  useEffect(() => {
    if (running) simRef.current?.start();
    else simRef.current?.stop();
  }, [running]);

  // 挂载：创建模拟器 + 尺寸观察 + 统计轮询
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const sim = new DigitSumTurtleSim(canvas, {
      config: cfgRef.current,
      dotEl: dotRef.current,
      onFollowChange: setFollow,
    });
    simRef.current = sim;
    const doResize = () => {
      const rect = wrap.getBoundingClientRect();
      sim.resize(rect.width, rect.height);
    };
    doResize();
    const ro = new ResizeObserver(doResize);
    ro.observe(wrap);
    const tick = window.setInterval(() => setStats(sim.getStats()), 200);
    if (running) sim.start();
    return () => {
      window.clearInterval(tick);
      ro.disconnect();
      sim.destroy();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 键盘：空格 暂停/继续，R 重置，F 适配视图
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = (el && el.tagName) || '';
      if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setRunning((v) => !v);
      } else if (e.key === 'r' || e.key === 'R') {
        simRef.current?.reset();
      } else if (e.key === 'f' || e.key === 'F') {
        simRef.current?.fit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyHeading = (deg: number) => {
    simRef.current?.setConfig({ startHeading: deg });
    simRef.current?.reset();
  };

  const applyStartK = () => {
    simRef.current?.setConfig({ startK });
    simRef.current?.reset();
  };

  const applyPreset = (value: string) => {
    const [b, m] = value.split(',').map(Number);
    simRef.current?.setConfig({ base: b, divs: m });
    simRef.current?.reset();
    setBase(b);
    setDivs(m);
  };

  const overlay = stats
    ? 'K: ' +
      fmt(stats.k) +
      '  RATE: ' +
      fmt(stats.rate) +
      '/s  SEGS: ' +
      fmt(stats.segments) +
      '  TURNS: ' +
      fmt(stats.turns) +
      (stats.capHit ? '  [CAP]' : '')
    : '...';

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="DIGIT_SUM_TURTLE" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        <div ref={wrapRef} className="h-64 shrink-0 lg:h-full lg:flex-1 relative overflow-hidden bg-zinc-950">
          <canvas
            ref={canvasRef}
            className="block w-full h-full touch-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div ref={dotRef} className="absolute left-0 top-0 w-2 h-2 -mt-1 -ml-1 rounded-full bg-red-500 pointer-events-none z-10" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.9)' }} />

          <div className="absolute top-4 left-4 text-white/60 font-mono text-[11px] pointer-events-none whitespace-pre">
            {overlay}
          </div>
          <div className="absolute top-4 right-14 text-white/40 font-mono text-[11px] pointer-events-none">
            {follow ? 'CAM: FOLLOW' : 'CAM: FREE'}
          </div>
          {!running && (!stats || stats.segments === 0) ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-white/40 font-mono text-sm border border-white/10 rounded px-4 py-2 bg-black/30">
                按空格或点击「开始」开始绘图
              </div>
            </div>
          ) : null}
        </div>

        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// 数位和海龟绘图 (Digit-Sum Turtle)'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRunning((v) => !v)}
                className={
                  running
                    ? 'px-3 py-2 rounded-md font-bold text-xs transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'px-3 py-2 rounded-md font-bold text-xs transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200'
                }
              >
                {running ? '暂停 (Pause)' : stats && stats.segments > 0 ? '继续 (Play)' : '开始 (Start)'}
              </button>
              <button
                onClick={() => simRef.current?.step(1024)}
                className="px-3 py-2 bg-zinc-100 text-zinc-600 rounded-md font-bold text-xs hover:bg-zinc-200 transition-colors"
              >
                单步 x1024
              </button>
              <button
                onClick={() => simRef.current?.fit()}
                className="px-3 py-2 bg-zinc-100 text-zinc-600 rounded-md font-bold text-xs hover:bg-zinc-200 transition-colors"
              >
                适配视图 (F)
              </button>
              <button
                onClick={() => simRef.current?.reset()}
                className="px-3 py-2 bg-red-50 text-red-700 rounded-md font-bold text-xs hover:bg-red-100 transition-colors"
              >
                重置 (R)
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">预设</div>
              <select
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded text-xs font-mono focus:outline-none focus:border-blue-500"
                defaultValue="2,6"
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-5">
              <ControlSlider label="进制 n" value={base} min={2} max={36} step={1} onChange={setBase} />
              <ControlSlider
                label="份数 m"
                value={divs}
                min={1}
                max={64}
                step={1}
                onChange={setDivs}
                display={(v) => v + '（' + formatAngle(v) + '）'}
              />
              <ControlSlider
                label="初始朝向（松开应用）"
                value={heading}
                min={0}
                max={359}
                step={1}
                onChange={setHeading}
                onCommit={applyHeading}
                display={(v) => v + '° ' + headingName(v)}
              />
              <ControlSlider
                label="速度"
                value={speedIdx}
                min={0}
                max={100}
                step={1}
                onChange={setSpeedIdx}
                display={(v) => fmt(speedFromIdx(v)) + ' 步/帧'}
              />
              <ControlSlider
                label="线宽 (px)"
                value={lineWidth}
                min={0.5}
                max={4}
                step={0.1}
                onChange={setLineWidth}
                display={(v) => v.toFixed(1)}
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">镜头 / 方向 / 配色</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFollow((v) => !v)}
                  className={
                    follow
                      ? 'px-3 py-2 rounded text-xs font-bold transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'px-3 py-2 rounded text-xs font-bold transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }
                >
                  {follow ? '镜头跟随: 开' : '镜头跟随: 关'}
                </button>
                <button
                  onClick={() => setDir((d) => (d === 1 ? -1 : 1))}
                  className="px-3 py-2 bg-zinc-100 text-zinc-600 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                >
                  旋转: {dir === 1 ? '顺时针' : '逆时针'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-500 font-mono shrink-0">颜色</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 border border-zinc-200 rounded cursor-pointer bg-white"
                />
                <button
                  onClick={() => setRainbow((v) => !v)}
                  className={
                    rainbow
                      ? 'px-3 py-1.5 rounded text-xs font-bold transition-colors bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'
                      : 'px-3 py-1.5 rounded text-xs font-bold transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }
                >
                  彩虹
                </button>
                <label className="text-xs text-zinc-500 font-mono shrink-0">周期</label>
                <input
                  type="number"
                  min={16}
                  step={1}
                  value={period}
                  onChange={(e) => setPeriod(Math.max(16, Math.round(Number(e.target.value) || 8192)))}
                  className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">起点</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 font-mono shrink-0">起始 k</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={startK}
                  onChange={(e) => setStartK(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="flex-1 px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded text-xs font-mono"
                />
                <button
                  onClick={applyStartK}
                  className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                >
                  应用
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">统计</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <StatBox label="K" value={stats ? fmt(stats.k) : '...'} />
                <StatBox label="RATE /S" value={stats ? fmt(stats.rate) : '...'} />
                <StatBox label="SEGMENTS" value={stats ? fmt(stats.segments) : '...'} />
                <StatBox label="TURNS" value={stats ? fmt(stats.turns) : '...'} />
              </div>
              {stats && stats.capHit ? (
                <p className="mt-2 text-[11px] text-amber-600 font-mono">线段已达 800 万上限，数值继续推进，不再记录新线段</p>
              ) : null}
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">说明</div>
              <ul className="text-xs text-zinc-600 space-y-1.5 list-disc pl-4">
                <li>遍历自然数 k：n 进制数位和为偶数则前进画线，为奇数则原地旋转 360°/m，无限推进直至暂停</li>
                <li>n=2 即 Thue–Morse 序列；默认参数（朝向 60°，六等分的右下 + 逆时针）图形整体精确水平延展，呈科赫雪花式分形</li>
                <li>镜头跟随开启时自动缩放平移，始终展示完整图案；手动拖拽/缩放会自动关闭跟随</li>
                <li>拖拽平移 · 滚轮缩放 · 双指捏合；空格 暂停/继续 · R 重置 · F 适配视图</li>
                <li>
                  参考{' '}
                  <a href="https://en.wikipedia.org/wiki/Thue%E2%80%93Morse_sequence" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Thue–Morse sequence
                  </a>
                  {' · '}
                  <a href="https://en.wikipedia.org/wiki/Digit_sum" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Digit sum
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatAngle(divs: number): string {
  const a = 360 / divs;
  const s = a.toFixed(2).replace(/\.?0+$/, '');
  return s + '°';
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded px-2 py-1.5">
      <div className="text-[9px] text-zinc-400">{label}</div>
      <div className="text-zinc-800">{value}</div>
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
  onCommit,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  display?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
        <span>{display ? display(value) : value}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit ? (e) => onCommit(parseFloat((e.target as HTMLInputElement).value) || 0) : undefined}
        onKeyUp={onCommit ? (e) => onCommit(parseFloat((e.target as HTMLInputElement).value) || 0) : undefined}
      />
    </div>
  );
}
