'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

type Basis = [number, number];

interface SVPInput {
  b1: Basis;
  b2: Basis;
  /** 搜索范围：i, j ∈ [-range, range] */
  range: number;
}

interface SVPStep {
  i: number;
  j: number;
  vec: [number, number];
  len: number;
  bestVec: [number, number] | null;
  bestLen: number;
  bestIJ: [number, number] | null;
  tried: number;
  note: string;
}

const TITLE = '格最短向量';
const CLS = 'NPH' as const;

/* ---------------- 算法 ---------------- */

/** v = i·b1 + j·b2 的长度 */
function latticeLen(b1: Basis, b2: Basis, i: number, j: number): number {
  return Math.hypot(i * b1[0] + j * b2[0], i * b1[1] + j * b2[1]);
}

interface SVPRef {
  vec: [number, number];
  len: number;
  ij: [number, number];
}

/** 参考解：在 range+2 范围内枚举全部整系数组合，取最短非零向量 */
function svpRef(input: SVPInput): SVPRef {
  const { b1, b2 } = input;
  const R = input.range + 2;
  let best: SVPRef | null = null;
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      if (i === 0 && j === 0) continue;
      const len = latticeLen(b1, b2, i, j);
      if (!best || len < best.len - 1e-9) {
        best = { vec: [i * b1[0] + j * b2[0], i * b1[1] + j * b2[1]], len, ij: [i, j] };
      }
    }
  }
  return best as SVPRef;
}

function validate(output: unknown, input: SVPInput): boolean {
  if (!Array.isArray(output) || output.length !== 2) return false;
  const [vx, vy] = output as number[];
  if (typeof vx !== 'number' || typeof vy !== 'number') return false;
  const ref = svpRef(input);
  if (Math.abs(Math.hypot(vx, vy) - ref.len) > 1e-6) return false;
  // 必须真的是格点：解 v = i·b1 + j·b2，i、j 应为非全零整数
  const det = input.b1[0] * input.b2[1] - input.b1[1] * input.b2[0];
  if (Math.abs(det) < 1e-9) return false;
  const i = (vx * input.b2[1] - vy * input.b2[0]) / det;
  const j = (input.b1[0] * vy - input.b1[1] * vx) / det;
  const ri = Math.round(i);
  const rj = Math.round(j);
  return (
    Math.abs(i - ri) < 1e-6 &&
    Math.abs(j - rj) < 1e-6 &&
    (ri !== 0 || rj !== 0)
  );
}

function makeCase(name: string, input: SVPInput): TestCase<SVPInput, [number, number]> {
  const ref = svpRef(input);
  return { name, input, expected: ref.vec, validate: (out) => validate(out, input) };
}

const CASES: TestCase<SVPInput, [number, number]>[] = [
  makeCase('斜基', { b1: [4, 1], b2: [1, 3], range: 3 }),
  makeCase('正交基', { b1: [5, 0], b2: [0, 3], range: 2 }),
  makeCase('需要做差', { b1: [6, 2], b2: [2, 6], range: 3 }),
];

/** 枚举 (i, j)：每个候选产出一帧，刷新最优时更新 best */
function* svpGen(input: SVPInput): Generator<SVPStep, [number, number], void> {
  const { b1, b2, range: R } = input;

  yield {
    i: 0,
    j: 0,
    vec: [0, 0],
    len: 0,
    bestVec: null,
    bestLen: Infinity,
    bestIJ: null,
    tried: 0,
    note: `在 i, j ∈ [${-R}, ${R}] 中枚举 v = i·b₁ + j·b₂，找最短非零向量`,
  };

  let bestVec: [number, number] | null = null;
  let bestLen = Infinity;
  let bestIJ: [number, number] | null = null;
  let tried = 0;

  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      if (i === 0 && j === 0) continue;
      tried++;
      const vec: [number, number] = [i * b1[0] + j * b2[0], i * b1[1] + j * b2[1]];
      const len = latticeLen(b1, b2, i, j);
      const improved = len < bestLen - 1e-9;
      if (improved) {
        bestLen = len;
        bestVec = vec;
        bestIJ = [i, j];
      }
      yield {
        i,
        j,
        vec,
        len,
        bestVec,
        bestLen,
        bestIJ,
        tried,
        note: improved
          ? `(${i})·b₁ + (${j})·b₂：长度 ${len.toFixed(2)}，刷新最优`
          : `(${i})·b₁ + (${j})·b₂：长度 ${len.toFixed(2)}`,
      };
    }
  }

  return bestVec as [number, number];
}

/* ---------------- 实例生成 ---------------- */

function randomBasis(skew: number, seed: number): { b1: Basis; b2: Basis } {
  const rnd = mulberry32(seed * 7 + 3);
  const b1: Basis = [9 + Math.floor(rnd() * 7), 3 + Math.floor(rnd() * 5)];
  const b2x = 4 + Math.floor(rnd() * 4);
  let b2y = skew;
  // 保证行列式非零（基不退化）
  if (Math.abs(b1[0] * b2y - b1[1] * b2x) < 0.5) b2y += 3;
  return { b1, b2: [b2x, b2y] };
}

const TEMPLATE = `function solve(input) {
  const { b1, b2, range } = input;

  // TODO: 返回最短非零格点向量 [x, y]
  //（即某个 i·b1 + j·b2，(i, j) 不全为 0）
  return [0, 0];
}`;

const SOLUTION = `function solve(input) {
  const { b1, b2, range } = input;
  let best = null, bestLen = Infinity;
  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      if (i === 0 && j === 0) continue;
      const vx = i*b1[0] + j*b2[0], vy = i*b1[1] + j*b2[1];
      const len = Math.hypot(vx, vy);
      if (len < bestLen - 1e-9) { bestLen = len; best = [vx, vy]; }
    }
  }
  return best;
}`;

const TOTAL_CANDIDATES = (R: number) => (2 * R + 1) * (2 * R + 1) - 1;

export default function SVPPage() {
  const [range, setRange] = useState(4);
  const [skew, setSkew] = useState(6);
  const [seed, setSeed] = useState(2);
  const [speed, setSpeed] = useState(2);

  const { b1, b2 } = useMemo(() => randomBasis(skew, seed), [skew, seed]);
  const input = useMemo<SVPInput>(() => ({ b1, b2, range }), [b1, b2, range]);

  const factory = useCallback(() => svpGen(input), [input]);
  const solver = useLiveSolver<SVPStep, [number, number]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: SVPStep =
    solver.current ??
    {
      i: 0,
      j: 0,
      vec: [0, 0],
      len: 0,
      bestVec: null,
      bestLen: Infinity,
      bestIJ: null,
      tried: 0,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  /* 投影：格坐标 → 画布，自动缩放 */
  const view = useMemo(() => {
    const W = 760;
    const H = 420;
    const pad = 52;
    let maxX = 1;
    let maxY = 1;
    for (let i = -range - 1; i <= range + 1; i++) {
      for (let j = -range - 1; j <= range + 1; j++) {
        maxX = Math.max(maxX, Math.abs(i * b1[0] + j * b2[0]));
        maxY = Math.max(maxY, Math.abs(i * b1[1] + j * b2[1]));
      }
    }
    const k = Math.min((W / 2 - pad) / maxX, (H / 2 - pad) / maxY);
    return {
      W,
      H,
      k,
      px: (x: number) => W / 2 + x * k,
      py: (y: number) => H / 2 - y * k,
    };
  }, [b1, b2, range]);

  const latticePt = (i: number, j: number) => ({
    x: view.px(i * b1[0] + j * b2[0]),
    y: view.py(i * b1[1] + j * b2[1]),
  });

  const bestVec = done && result ? result : step.bestVec;
  const bestLen = done && result ? Math.hypot(result[0], result[1]) : step.bestLen;
  const bestIJ = done && result ? svpRef({ ...input, range: range + 2 }).ij : step.bestIJ;

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
                label="LATTICE SVP"
                meta={`b₁ = [${b1[0]}, ${b1[1]}] / b₂ = [${b2[0]}, ${b2[1]}] / R = ${range}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    已试 {step.tried}/{TOTAL_CANDIDATES(range)}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${view.W} ${view.H}`}
                    className="h-full max-h-[440px] w-full min-h-[200px]"
                    role="img"
                    aria-label="二维格与最短向量搜索过程"
                  >
                    {/* 平行四边形格线 */}
                    {Array.from({ length: 2 * range + 1 }, (_, t) => t - range).map((i) => (
                      <line
                        key={`li${i}`}
                        x1={latticePt(i, -range).x}
                        y1={latticePt(i, -range).y}
                        x2={latticePt(i, range).x}
                        y2={latticePt(i, range).y}
                        stroke="#52525b"
                        strokeWidth={0.6}
                        opacity={0.16}
                      />
                    ))}
                    {Array.from({ length: 2 * range + 1 }, (_, t) => t - range).map((j) => (
                      <line
                        key={`lj${j}`}
                        x1={latticePt(-range, j).x}
                        y1={latticePt(-range, j).y}
                        x2={latticePt(range, j).x}
                        y2={latticePt(range, j).y}
                        stroke="#52525b"
                        strokeWidth={0.6}
                        opacity={0.16}
                      />
                    ))}
                    {/* 格点 */}
                    {Array.from({ length: 2 * range + 1 }, (_, t) => t - range).map((i) =>
                      Array.from({ length: 2 * range + 1 }, (_, t2) => t2 - range).map((j) => {
                        const p = latticePt(i, j);
                        const isBest = bestIJ !== null && bestIJ[0] === i && bestIJ[1] === j && !(i === 0 && j === 0);
                        return (
                          <circle
                            key={`p${i}_${j}`}
                            cx={p.x}
                            cy={p.y}
                            r={isBest ? 3.4 : 2}
                            fill={isBest ? '#3b82f6' : '#71717a'}
                            opacity={isBest ? 0.95 : i === 0 && j === 0 ? 0 : 0.45}
                            style={{ transition: 'fill 200ms ease, r 200ms ease' }}
                          />
                        );
                      }),
                    )}
                    {/* 原点 */}
                    <circle cx={view.px(0)} cy={view.py(0)} r={5} fill="#e4e4e7" stroke="#3f3f46" strokeWidth={1.4} />
                    {/* 基向量 */}
                    {(
                      [
                        { b: b1, label: 'b₁', color: '#a1a1aa' },
                        { b: b2, label: 'b₂', color: '#a1a1aa' },
                      ] as const
                    ).map(({ b, label, color }, k) => {
                      const tip = latticePt(k === 0 ? 1 : 0, k === 0 ? 0 : 1);
                      return (
                        <g key={label}>
                          <line x1={view.px(0)} y1={view.py(0)} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={1.6} opacity={0.6} />
                          <circle cx={tip.x} cy={tip.y} r={3} fill={color} />
                          <text x={tip.x + (k === 0 ? 10 : -4)} y={tip.y + (k === 0 ? -6 : 14)} fontSize={11} fontFamily="monospace" fill={color}>
                            {label}
                          </text>
                        </g>
                      );
                    })}
                    {/* 历史最优向量 */}
                    {bestVec && bestLen < Infinity && (
                      <g>
                        <line
                          x1={view.px(0)}
                          y1={view.py(0)}
                          x2={view.px(bestVec[0])}
                          y2={view.py(bestVec[1])}
                          stroke="#3b82f6"
                          strokeWidth={2.6}
                          strokeLinecap="round"
                          style={{ transition: 'x2 150ms ease, y2 150ms ease' }}
                        />
                        <text
                          x={view.px(bestVec[0]) + 10}
                          y={view.py(bestVec[1]) - 8}
                          fontSize={10}
                          fontFamily="monospace"
                          fill="#93c5fd"
                        >
                          {bestIJ ? `(${bestIJ[0]},${bestIJ[1]}) ` : ''}
                          {bestLen.toFixed(2)}
                        </text>
                      </g>
                    )}
                    {/* 当前候选向量 */}
                    {!done && step.tried > 0 && (
                      <g>
                        <line
                          x1={view.px(0)}
                          y1={view.py(0)}
                          x2={view.px(step.vec[0])}
                          y2={view.py(step.vec[1])}
                          stroke={step.bestIJ && step.i === step.bestIJ[0] && step.j === step.bestIJ[1] ? '#3b82f6' : '#fbbf24'}
                          strokeWidth={1.4}
                          opacity={0.75}
                          strokeDasharray="5 4"
                        />
                        <circle
                          cx={view.px(step.vec[0])}
                          cy={view.py(step.vec[1])}
                          r={3.2}
                          fill={step.bestIJ && step.i === step.bestIJ[0] && step.j === step.bestIJ[1] ? '#3b82f6' : '#fbbf24'}
                        />
                      </g>
                    )}
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
                    最短向量 [{result[0].toFixed(2)}, {result[1].toFixed(2)}]，长度 {Math.hypot(result[0], result[1]).toFixed(3)}
                    {bestIJ ? `（= (${bestIJ[0]})·b₁ + (${bestIJ[1]})·b₂）` : ''}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="搜索范围 (RANGE)"
                value={range}
                min={2}
                max={12}
                step={1}
                onChange={setRange}
                format={(v) => `候选 ${(2 * v + 1) * (2 * v + 1) - 1} 个`}
              />
              <Field
                label="b₂ 倾斜 (SKEW)"
                value={skew}
                min={-10}
                max={10}
                step={1}
                onChange={setSkew}
                format={(v) => `b₂ = [${randomBasis(v, seed).b2[0]}, ${v}]`}
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
                  <span className="text-zinc-400">b₁</span>
                  <span className="tabular-nums text-zinc-800">[{b1[0]}, {b1[1]}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">b₂</span>
                  <span className="tabular-nums text-zinc-800">[{b2[0]}, {b2[1]}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已试组合</span>
                  <span className="tabular-nums text-zinc-800">{step.tried}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">当前最优</span>
                  <span className="tabular-nums text-zinc-800">{bestLen === Infinity ? '—' : bestLen.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">暴力复杂度</span>
                  <span className="text-zinc-800">O(R²)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">高维精确解</span>
                  <span className="text-zinc-800">2^Ω(n)·超多项式</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
