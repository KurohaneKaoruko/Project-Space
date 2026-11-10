'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { randomGraph } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

interface MISInput {
  n: number;
  edges: [number, number][];
}

interface MISStep {
  inSet: boolean[];
  best: number[];
  bestSize: number;
  size: number;
  note: string;
}

const TITLE = '最大独立集';
const CLS = 'NPC' as const;

/* ---------------- 算法 ---------------- */

function adjMatrix(n: number, edges: [number, number][]) {
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  for (const [u, v] of edges) {
    m[u][v] = true;
    m[v][u] = true;
  }
  return m;
}

/** 参考解：位掩码枚举（判题用例都是小规模） */
function maxIS(input: MISInput): number[] {
  const { n, edges } = input;
  const m = adjMatrix(n, edges);
  if (n > 22) {
    // 退化为贪心近似（判题用例都是小规模，不会走到这里）
    const inSet = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (m[i].every((adj, j) => !inSet[j] || !adj)) inSet[i] = true;
    }
    return inSet.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  }
  let bestMask = 0;
  let bestSize = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    let size = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) size++;
    if (size <= bestSize) continue;
    const ok = edges.every(([u, v]) => !(mask & (1 << u)) || !(mask & (1 << v)));
    if (!ok) continue;
    bestMask = mask;
    bestSize = size;
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (bestMask & (1 << i)) out.push(i);
  return out;
}

function isIndependent(output: unknown, input: MISInput): boolean {
  if (!Array.isArray(output)) return false;
  const seen = new Set<number>();
  for (const v of output as number[]) {
    if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
    seen.add(v);
  }
  const inSet = new Set(output as number[]);
  return input.edges.every(([u, v]) => !inSet.has(u) || !inSet.has(v));
}

function makeCase(name: string, input: MISInput): TestCase<MISInput, number[]> {
  const ref = maxIS(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => isIndependent(out, input) && (out as number[]).length === ref.length,
  };
}

const CASES: TestCase<MISInput, number[]>[] = [
  makeCase('三角形', {
    n: 3,
    edges: [
      [0, 1],
      [1, 2],
      [0, 2],
    ],
  }),
  makeCase('四点路径', {
    n: 4,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  }),
  makeCase('星形', {
    n: 5,
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  }),
];

/** 分支定界：逐点二选一（选 / 不选），冲突剪枝 */
function* misGen(input: MISInput): Generator<MISStep, number[], void> {
  const { n, edges } = input;
  const m = adjMatrix(n, edges);
  const inSet = new Array(n).fill(false);
  let best = Array(n).fill(0) as number[];
  let bestSize = 0;
  let budget = 1000000000;

  const count = (arr: boolean[]) => arr.reduce((s, v) => s + (v ? 1 : 0), 0);

  const write = function* (i: number): Generator<MISStep, void, void> {
    if (budget-- <= 0) return;
    if (i === n) {
      const size = count(inSet);
      if (size > bestSize) {
        bestSize = size;
        best = inSet.map((v, k) => (v ? k : -1)).filter((k) => k >= 0);
        yield {
          inSet: [...inSet],
          best: [...best],
          bestSize,
          size,
          note: `叶子：独立集大小 ${size}，刷新最优（${best.join(',')}）`,
        };
      }
      return;
    }

    // 剪枝：当前 + 剩余 全选也追不上最优
    if (count(inSet) + (n - i) <= bestSize) return;

    // 尝试选 i
    if (m[i].every((adj, j) => !inSet[j] || !adj)) {
      inSet[i] = true;
      yield {
        inSet: [...inSet],
        best: [...best],
        bestSize,
        size: count(inSet),
        note: `选 ${i}：与已选点不相邻，进入下一个点`,
      };
      yield* write(i + 1);
      inSet[i] = false;
    }

    // 不选 i
    yield {
      inSet: [...inSet],
      best: [...best],
      bestSize,
      size: count(inSet),
      note: `不选 ${i}${inSet.some((v, j) => v && m[i][j]) ? '（与已选点相邻）' : ''}`,
    };
    yield* write(i + 1);
  };

  yield* write(0);
  return best;
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;

  // TODO: 返回最大独立集的点数组（两两不相邻）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  let best = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    let size = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) size++;
    if (size <= best.length) continue;
    const ok = edges.every(([u, v]) => !(mask & (1 << u)) || !(mask & (1 << v)));
    if (!ok) continue;
    best = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) best.push(i);
  }
  return best;
}`;

export default function MaxIndependentSetPage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.35);
  const [seed, setSeed] = useState(7);
  const [speed, setSpeed] = useState(8);

  const input = useMemo(() => ({ n, edges: randomGraph(n, density, seed) }), [n, density, seed]);

  const factory = useCallback(() => misGen(input), [input]);
  const solver = useLiveSolver<MISStep, number[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: MISStep =
    solver.current ??
    {
      inSet: new Array(input.n).fill(false),
      best: [],
      bestSize: 0,
      size: 0,
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;
  const bestSet = new Set(done && result ? result : step.best);

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    const rx = 300;
    const ry = 128;
    return {
      width: W,
      height: H,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + rx * Math.cos(angle), y: H / 2 + ry * Math.sin(angle) };
      }),
    };
  }, [input.n]);

  const inSet = new Set(step.inSet.map((v, i) => (v ? i : -1)).filter((i) => i >= 0));

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
                label="BRANCH & BOUND"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    当前 {step.size} · 最优 {Math.max(step.bestSize, done && result ? result.length : 0)}
                  </span>
                }
              >
                <div className="flex flex-1 items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full min-h-[180px]"
                    role="img"
                    aria-label="最大独立集分支定界搜索过程"
                  >
                    {input.edges.map(([u, v], i) => {
                      const bothIn = inSet.has(u) && inSet.has(v);
                      return (
                        <line
                          key={i}
                          x1={layout.pos[u].x}
                          y1={layout.pos[u].y}
                          x2={layout.pos[v].x}
                          y2={layout.pos[v].y}
                          stroke={bothIn ? '#f43f5e' : '#3f3f46'}
                          strokeWidth={bothIn ? 2.2 : 1.3}
                          opacity={bothIn ? 0.9 : 0.45}
                          style={{ transition: 'stroke 200ms ease' }}
                        />
                      );
                    })}
                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const chosen = inSet.has(node);
                      const isBest = bestSet.has(node);
                      const ring = isBest && !chosen;
                      return (
                        <g key={node}>
                          {ring && <circle cx={x} cy={y} r={16} fill="none" stroke="#10b981" strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8} />}
                          <circle
                            cx={x}
                            cy={y}
                            r={13}
                            fill={chosen ? '#3b82f6' : '#111318'}
                            stroke={ring ? '#10b981' : '#52525b'}
                            strokeWidth={1.6}
                            style={{ transition: 'fill 200ms ease' }}
                          />
                          <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={chosen ? '#fff' : '#a1a1aa'}>
                            {node}
                          </text>
                        </g>
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
                ) : (
                  <span className="text-emerald-700">
                    最大独立集大小 {result?.length ?? 0}：{(result ?? []).join(', ')}
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={4} max={60} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={density}
                min={0.15}
                max={0.6}
                step={0.05}
                onChange={setDensity}
                format={(v) => `期望边数 ≈ ${Math.round((v * n * (n - 1)) / 2)}`}
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
                  <span className="text-zinc-400">边数</span>
                  <span className="tabular-nums text-zinc-800">{input.edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">当前集合</span>
                  <span className="tabular-nums text-zinc-800">{step.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">历史最优</span>
                  <span className="tabular-nums text-zinc-800">{step.bestSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">策略</span>
                  <span className="text-zinc-800">二选一 + 冲突剪枝</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
