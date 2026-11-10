'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { randomPoints } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

interface HullInput {
  points: [number, number][];
}

type Pt = [number, number];

interface HullStep {
  hull: Pt[];
  considered: Pt | null;
  // 当前上下链正在处理的点
  chain: 'lower' | 'upper';
  inside: boolean;
  note: string;
}

const TITLE = '凸包';
const CLS = 'P' as const;

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const keyOf = (p: Pt) => `${p[0]},${p[1]}`;

/** 参考解：Andrew 单调链，返回逆时针凸包顶点（去重共线点） */
function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function validate(output: unknown, input: HullInput): boolean {
  if (!Array.isArray(output)) return false;
  const ref = convexHull(input.points);
  const out = output as Pt[];
  if (out.length !== ref.length) return false;
  // 集合相等 + 逆时针顺序
  const refSet = new Set(ref.map(keyOf));
  const outSet = new Set(out.map((p) => (Array.isArray(p) ? keyOf(p as Pt) : String(p))));
  if (refSet.size !== outSet.size || [...refSet].some((k) => !outSet.has(k))) return false;
  // 检查方向：有符号面积应为正
  let area2 = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i] as Pt;
    const b = out[(i + 1) % out.length] as Pt;
    area2 += a[0] * b[1] - a[1] * b[0];
  }
  return area2 > 0;
}

function makeCase(name: string, points: Pt[]): TestCase<HullInput, Pt[]> {
  const input = { points };
  const ref = convexHull(points);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<HullInput, Pt[]>[] = [
  makeCase('四边形+内点', [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [2, 2],
    [1, 3],
  ]),
  makeCase('共线点', [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [3, 0],
  ]),
  makeCase('三角', [
    [0, 0],
    [5, 2],
    [2, 5],
    [1, 1],
  ]),
];

/** Andrew 单调链：每个「压栈 / 弹栈」产出一帧 */
function* hullGen(input: HullInput): Generator<HullStep, Pt[], void> {
  const pts = [...input.points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      const popped = lower.pop() as Pt;
      yield {
        hull: [...lower, p],
        considered: popped,
        chain: 'lower',
        inside: false,
        note: `下链：${keyOf(popped)} 在转向内侧，弹出`,
      };
    }
    lower.push(p);
    yield {
      hull: [...lower],
      considered: p,
      chain: 'lower',
      inside: true,
      note: `下链：加入 (${p[0]},${p[1]})`,
    };
  }

  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      const popped = upper.pop() as Pt;
      yield {
        hull: [...lower.slice(0, -1), ...upper, p],
        considered: popped,
        chain: 'upper',
        inside: false,
        note: `上链：${keyOf(popped)} 在转向内侧，弹出`,
      };
    }
    upper.push(p);
    yield {
      hull: [...lower.slice(0, -1), ...upper],
      considered: p,
      chain: 'upper',
      inside: true,
      note: `上链：加入 (${p[0]},${p[1]})`,
    };
  }

  upper.pop();
  lower.pop();
  const hull = [...lower, ...upper];
  yield {
    hull,
    considered: null,
    chain: 'upper',
    inside: true,
    note: `完成：凸包 ${hull.length} 个顶点（逆时针）`,
  };
  return hull;
}

const TEMPLATE = `function solve(input) {
  const { points } = input; // [x, y] 数组

  // TODO: 返回凸包顶点（逆时针，首尾不重复）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const pts = [...input.points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return [...lower, ...upper];
}`;

/* 数据域固定 0..120,与 randomPoints 一致 */
const DOMAIN = 120;

export default function ConvexHullPage() {
  const [count, setCount] = useState(24);
  const [spread, setSpread] = useState(0.9);
  const [seed, setSeed] = useState(8);
  const [speed, setSpeed] = useState(2);

  const input = useMemo<HullInput>(() => ({ points: randomPoints(count, spread, seed) }), [count, spread, seed]);

  const factory = useCallback(() => hullGen(input), [input]);
  const solver = useLiveSolver<HullStep, Pt[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: HullStep =
    solver.current ??
    {
      hull: [],
      considered: null,
      chain: 'lower',
      inside: true,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const hullSet = new Set(step.hull.map(keyOf));
  const consideredKey = step.considered ? keyOf(step.considered) : null;

  /* 投影:数据域 0..120 → 画布 */
  const W = 760;
  const H = 420;
  const pad = 40;
  const px = (x: number) => pad + (x / DOMAIN) * (W - pad * 2);
  const py = (y: number) => H - pad - (y / DOMAIN) * (H - pad * 2);

  const area2 = useMemo(() => {
    const h = result ?? step.hull;
    if (h.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < h.length; i++) {
      const a = h[i];
      const b = h[(i + 1) % h.length];
      s += a[0] * b[1] - a[1] * b[0];
    }
    return s / 2;
  }, [result, step.hull]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title={TITLE}
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META[CLS].chip}`}>
              {CLASS_META[CLS].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">{TITLE}</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <InstrumentPanel
                label="MONOTONE CHAIN"
                meta={`${input.points.length} points / hull ${step.hull.length} vertices`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {step.chain === 'lower' ? '下链扫描' : '上链扫描'} · 面积 {area2.toFixed(0)}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-full max-h-[440px] w-full min-h-[200px]"
                    role="img"
                    aria-label="Andrew 单调链构造凸包过程"
                  >
                    {/* 凸包多边形 */}
                    {step.hull.length >= 3 && (
                      <polygon
                        points={step.hull.map((p) => `${px(p[0])},${py(p[1])}`).join(' ')}
                        fill="rgba(59,130,246,0.10)"
                        stroke="#3b82f6"
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                        style={{ transition: 'points 200ms ease' }}
                      />
                    )}
                    {/* 点集 */}
                    {input.points.map((p, i) => {
                      const k = keyOf(p);
                      const onHull = hullSet.has(k);
                      const isConsidered = k === consideredKey;
                      return (
                        <circle
                          key={i}
                          cx={px(p[0])}
                          cy={py(p[1])}
                          r={isConsidered ? 5.5 : onHull ? 4 : 3}
                          fill={isConsidered ? '#fbbf24' : onHull ? '#3b82f6' : '#52525b'}
                          opacity={isConsidered ? 1 : onHull ? 0.95 : 0.55}
                          style={{ transition: 'fill 200ms ease, r 200ms ease' }}
                        />
                      );
                    })}
                  </svg>
                </div>

                <div className="border-t border-white/[0.06] px-4 py-2.5">
                  <LiveControls
                    running={solver.running}
                    done={solver.done}
                    elapsed={solver.elapsed}
                    computeMs={solver.computeMs}
                    stepCount={solver.stepCount}
                    total={solver.stepCount}
                    speed={speed}
                    onSpeed={setSpeed}
                    onStart={solver.start}
                    onPause={solver.pause}
                    onReset={solver.reset}
                    onStep={solver.stepOnce}
                  />
                </div>
              </InstrumentPanel>
            </div>

            <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">结果</div>
              <p className="mt-1 font-mono text-[13px]">
                {!done ? (
                  <span className="text-zinc-400">—</span>
                ) : result && result.length >= 3 ? (
                  <span className="text-emerald-700">
                    凸包 {result.length} 个顶点，面积 {(area2).toFixed(1)}（{input.points.length} 点中 {input.points.length - result.length} 个在内部）
                  </span>
                ) : (
                  <span className="text-rose-700">点数不足或共线，无凸多边形</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="点数 (POINTS)" value={count} min={6} max={120} step={1} onChange={setCount} />
              <Field
                label="散布 (SPREAD)"
                value={spread}
                min={0}
                max={1}
                step={0.05}
                onChange={setSpread}
                format={(v) => (v < 0.5 ? '聚成几簇' : v > 0.92 ? '均匀散布' : '中等散布')}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">点数</span>
                  <span className="tabular-nums text-zinc-800">{input.points.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">包顶点</span>
                  <span className="tabular-nums text-zinc-800">{step.hull.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">当前链</span>
                  <span className="text-zinc-800">{step.chain === 'lower' ? '下链' : '上链'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">排序 + 单调链</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
