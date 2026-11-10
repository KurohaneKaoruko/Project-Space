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

type Pt = [number, number];

interface CPInput {
  points: Pt[];
}

interface CPStep {
  /** 当前考虑的点下标 */
  idx: number;
  /** 当前最优对 */
  best: [number, number] | null;
  bestDist: number;
  /** 暴力阶段窗口 / 分治阶段信息 */
  phase: 'scan' | 'done';
  note: string;
}

const TITLE = '最近点对';
const CLS = 'P' as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const keyOf = (p: Pt) => `${p[0]},${p[1]}`;

/* ---------------- 算法 ---------------- */

/** 参考解：O(n²) 暴力（判题用例都是小规模），返回点下标对 */
function closestPairRef(points: Pt[]): [number, number] {
  let best: [number, number] = [0, 1];
  let bd = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = dist(points[i], points[j]);
      if (d < bd) {
        bd = d;
        best = [i, j];
      }
    }
  }
  return best;
}

function validate(output: unknown, input: CPInput): boolean {
  if (!Array.isArray(output) || output.length !== 2) return false;
  const [i, j] = output as number[];
  if (!Number.isInteger(i) || !Number.isInteger(j)) return false;
  if (i < 0 || j < 0 || i >= input.points.length || j >= input.points.length || i === j) return false;
  const d = dist(input.points[i], input.points[j]);
  const ref = closestPairRef(input.points);
  const rd = dist(input.points[ref[0]], input.points[ref[1]]);
  return Math.abs(d - rd) < 1e-6;
}

function makeCase(name: string, points: Pt[]): TestCase<CPInput, [number, number]> {
  const input = { points };
  const ref = closestPairRef(points);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<CPInput, [number, number]>[] = [
  makeCase('四点方阵', [
    [0, 0],
    [3, 0],
    [0, 3],
    [10, 10],
  ]),
  makeCase('近邻干扰', [
    [0, 0],
    [5, 0],
    [6, 0.5],
    [20, 20],
    [21, 20],
  ]),
  makeCase('共线', [
    [0, 0],
    [2, 0],
    [5, 0],
    [7, 0],
  ]),
];

/**
 * 生成器：x 排序 + 滑动窗口（最近点对传播的简化演示）。
 * 每个候选对产出一帧；窗口宽度 = 当前最优距离（分治思想的均摊形态）。
 */
function* cpGen(input: CPInput): Generator<CPStep, [number, number], void> {
  const pts = input.points;
  const order = Array.from({ length: pts.length }, (_, i) => i).sort(
    (a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1],
  );

  yield { idx: -1, best: null, bestDist: Infinity, phase: 'scan', note: '按 x 排序后从左向右扫描，窗口宽度随发现的最短距离收缩' };

  let best: [number, number] | null = null;
  let bd = Infinity;

  for (let s = 0; s < order.length; s++) {
    const i = order[s];
    for (let t = s + 1; t < order.length; t++) {
      const j = order[t];
      // 窗口剪枝：x 距离已超过当前最优，更远的点不用再看
      if (pts[j][0] - pts[i][0] >= bd) break;
      const d = dist(pts[i], pts[j]);
      const improved = d < bd;
      if (improved) {
        bd = d;
        best = [i, j];
      }
      yield {
        idx: s,
        best,
        bestDist: bd,
        phase: 'scan',
        note: improved
          ? `点 ${i}–${j}：距离 ${d.toFixed(2)}，刷新最优`
          : `点 ${i}–${j}：距离 ${d.toFixed(2)}`,
      };
    }
  }

  yield {
    idx: -1,
    best,
    bestDist: bd,
    phase: 'done',
    note: `完成：最近点对 (${best?.[0]}, ${best?.[1]})，距离 ${bd.toFixed(3)}`,
  };
  return best as [number, number];
}

const TEMPLATE = `function solve(input) {
  const { points } = input; // [x, y] 数组

  // TODO: 返回最近点对的下标 [i, j]
  return [0, 1];
}`;

const SOLUTION = `function solve(input) {
  const pts = input.points;
  const order = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
  let best = [0, 1], bd = Infinity;
  for (let s = 0; s < order.length; s++) {
    for (let t = s + 1; t < order.length; t++) {
      const i = order[s], j = order[t];
      if (pts[j][0] - pts[i][0] >= bd) break; // 窗口剪枝
      const d = Math.hypot(pts[i][0]-pts[j][0], pts[i][1]-pts[j][1]);
      if (d < bd) { bd = d; best = [i, j]; }
    }
  }
  return best;
}`;

const DOMAIN = 120;

export default function ClosestPairPage() {
  const [count, setCount] = useState(30);
  const [spread, setSpread] = useState(0.95);
  const [seed, setSeed] = useState(11);
  const [speed, setSpeed] = useState(4);

  const input = useMemo<CPInput>(() => ({ points: randomPoints(count, spread, seed) }), [count, spread, seed]);

  const factory = useCallback(() => cpGen(input), [input]);
  const solver = useLiveSolver<CPStep, [number, number]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: CPStep =
    solver.current ??
    {
      idx: -1,
      best: null,
      bestDist: Infinity,
      phase: 'scan',
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const best = done && result ? result : step.best;
  const W = 760;
  const H = 420;
  const pad = 40;
  const px = (x: number) => pad + (x / DOMAIN) * (W - pad * 2);
  const py = (y: number) => H - pad - (y / DOMAIN) * (H - pad * 2);

  const scanX = step.idx >= 0 && step.idx < input.points.length ? px(input.points[step.idx][0]) : null;

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
                label="SWEEP + WINDOW PRUNE"
                meta={`${input.points.length} points / d = ${step.bestDist === Infinity ? '∞' : step.bestDist.toFixed(2)}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {done ? '完成' : `扫描 ${step.idx + 1}/${input.points.length}`}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-full max-h-[440px] w-full min-h-[200px]"
                    role="img"
                    aria-label="最近点对扫描过程"
                  >
                    {/* 扫描线 */}
                    {scanX !== null && !done && (
                      <line x1={scanX} y1={pad - 12} x2={scanX} y2={H - pad + 12} stroke="#fbbf24" strokeWidth={1.2} opacity={0.6} strokeDasharray="6 4" />
                    )}
                    {/* 当前最优对连线 */}
                    {best && (
                      <line
                        x1={px(input.points[best[0]][0])}
                        y1={py(input.points[best[0]][1])}
                        x2={px(input.points[best[1]][0])}
                        y2={py(input.points[best[1]][1])}
                        stroke="#3b82f6"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        style={{ transition: 'x1 150ms ease, y1 150ms ease, x2 150ms ease, y2 150ms ease' }}
                      >
                        <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
                      </line>
                    )}
                    {/* 点集 */}
                    {input.points.map((p, i) => {
                      const inBest = best ? i === best[0] || i === best[1] : false;
                      return (
                        <circle
                          key={i}
                          cx={px(p[0])}
                          cy={py(p[1])}
                          r={inBest ? 5.5 : 3}
                          fill={inBest ? '#3b82f6' : '#52525b'}
                          opacity={inBest ? 1 : 0.55}
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
                ) : result ? (
                  <span className="text-emerald-700">
                    最近点对 {result[0]}–{result[1]}，距离 {dist(input.points[result[0]], input.points[result[1]]).toFixed(3)}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                排序 + 窗口剪枝均摊 O(n log n)；经典分治解法在合并时只检查中线两侧 δ 带内的点
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="点数 (POINTS)" value={count} min={6} max={200} step={1} onChange={setCount} />
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
                  <span className="text-zinc-400">当前最优距离</span>
                  <span className="tabular-nums text-zinc-800">{step.bestDist === Infinity ? '—' : step.bestDist.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">暴力 O(n²)</span>
                  <span className="tabular-nums text-zinc-800">{(input.points.length ** 2).toLocaleString()} 对</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">窗口剪枝</span>
                  <span className="text-zinc-800">均摊 O(n log n)</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
