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

interface CliqueInput {
  n: number;
  edges: [number, number][];
}

interface CliqueStep {
  /** 当前正在扩张的团 */
  clique: number[];
  /** 还能加入的候选点 */
  candidates: number[];
  best: number[];
  note: string;
}

const TITLE = '最大团';
const CLS = 'NPC' as const;

function buildAdj(input: CliqueInput) {
  const adj = Array.from({ length: input.n }, () => new Array<boolean>(input.n).fill(false));
  for (const [u, v] of input.edges) {
    adj[u][v] = true;
    adj[v][u] = true;
  }
  return adj;
}

/** 参考解：带回溯的极大团搜索 */
function maxClique(input: CliqueInput): number[] {
  const adj = buildAdj(input);
  let best: number[] = [];
  let budget = 500000;

  const expand = (R: number[], P: number[]) => {
    if (--budget <= 0) return;
    if (R.length > best.length) best = [...R];
    for (let i = 0; i < P.length; i++) {
      if (R.length + (P.length - i) <= best.length) return;
      const v = P[i];
      expand([...R, v], P.slice(i + 1).filter((u) => adj[v][u]));
    }
  };

  expand([], Array.from({ length: input.n }, (_, i) => i));
  return best;
}

function isClique(output: unknown, input: CliqueInput): boolean {
  if (!Array.isArray(output)) return false;
  const nodes = output as number[];
  const seen = new Set<number>();
  for (const v of nodes) {
    if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
    seen.add(v);
  }
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) continue;
      const linked = input.edges.some(([u, v]) => (u === a && v === b) || (u === b && v === a));
      if (!linked) return false;
    }
  }
  return true;
}

function makeCase(name: string, input: CliqueInput): TestCase<CliqueInput, number[]> {
  const ref = maxClique(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => isClique(out, input) && (out as number[]).length === ref.length,
  };
}

const CASES: TestCase<CliqueInput, number[]>[] = [
  makeCase('三角形 + 尾巴', {
    n: 5,
    edges: [
      [0, 1],
      [1, 2],
      [0, 2],
      [2, 3],
      [3, 4],
    ],
  }),
  makeCase('五边形', {
    n: 5,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ],
  }),
  makeCase('K4 带弦', {
    n: 6,
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  }),
];

/** 回溯枚举团：加入一个点一帧，剪枝也产出一帧 */
function* cliqueGen(input: CliqueInput): Generator<CliqueStep, number[], void> {
  const adj = buildAdj(input);
  let best: number[] = [];
  let budget = 300000;

  function* expand(R: number[], P: number[]): Generator<CliqueStep, void, void> {
    if (--budget <= 0) {
      yield { clique: [...R], candidates: [...P], best: [...best], note: '搜索步数超限，已中止' };
      return;
    }

    if (R.length > best.length) {
      best = [...R];
      yield {
        clique: [...R],
        candidates: [...P],
        best: [...best],
        note: `找到更大的团：${R.length} 个点`,
      };
    }

    for (let i = 0; i < P.length; i++) {
      if (R.length + (P.length - i) <= best.length) {
        yield {
          clique: [...R],
          candidates: P.slice(i),
          best: [...best],
          note: `剩余 ${P.length - i} 个候选，全加入也超不过 ${best.length}，剪枝`,
        };
        return;
      }
      const v = P[i];
      const next = P.slice(i + 1).filter((u) => adj[v][u]);
      yield {
        clique: [...R, v],
        candidates: next,
        best: [...best],
        note: `加入 ${v}，与它相邻的候选还剩 ${next.length} 个`,
      };
      yield* expand([...R, v], next);
    }
  }

  yield {
    clique: [],
    candidates: Array.from({ length: input.n }, (_, i) => i),
    best: [],
    note: '空团起步，候选为全部顶点',
  };

  yield* expand([], Array.from({ length: input.n }, (_, i) => i));
  return best;
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;

  // TODO: 返回一个最大团（下标数组，团内任意两点都有边）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const adj = Array.from({ length: n }, () => new Array(n).fill(false));
  for (const [u, v] of edges) {
    adj[u][v] = true;
    adj[v][u] = true;
  }

  let best = [];

  function expand(R, P) {
    if (R.length > best.length) best = [...R];
    for (let i = 0; i < P.length; i++) {
      if (R.length + (P.length - i) <= best.length) return;
      const v = P[i];
      expand([...R, v], P.slice(i + 1).filter((u) => adj[v][u]));
    }
  }

  expand([], Array.from({ length: n }, (_, i) => i));
  return best;
}`;

export default function MaxCliquePage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.5);
  const [seed, setSeed] = useState(4);
  const [speed, setSpeed] = useState(1);

  const input = useMemo<CliqueInput>(
    () => ({ n, edges: randomGraph(n, density, seed) }),
    [n, density, seed],
  );

  const factory = useCallback(() => cliqueGen(input), [input]);
  const solver = useLiveSolver<CliqueStep, number[]>(factory, [input], { stepsPerFrame: speed });

  const step: CliqueStep =
    solver.current ?? {
      clique: [],
      candidates: Array.from({ length: input.n }, (_, i) => i),
      best: [],
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    const nodeR = input.n <= 10 ? 23 : input.n <= 14 ? 18 : 14;
    return {
      width: W,
      height: H,
      nodeR,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + 300 * Math.cos(angle), y: H / 2 + 130 * Math.sin(angle) };
      }),
    };
  }, [input]);

  // 跑完之后用最终解着色
  const displayClique = done && result ? result : step.clique;
  const cliqueSet = new Set(displayClique);
  const bestSet = new Set(step.best);
  const candidateSet = new Set(step.candidates);
  const cliqueEdges = new Set<string>();
  for (let i = 0; i < displayClique.length; i++) {
    for (let j = i + 1; j < displayClique.length; j++) {
      const a = displayClique[i];
      const b = displayClique[j];
      cliqueEdges.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    }
  }

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
                label="CLIQUE"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    当前 {step.clique.length} / 最优 {step.best.length}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full"
                    role="img"
                    aria-label="最大团搜索过程"
                  >
                    {input.edges.map(([u, v], i) => {
                      const inClique = cliqueEdges.has(`${Math.min(u, v)}-${Math.max(u, v)}`);
                      return (
                        <line
                          key={i}
                          x1={layout.pos[u].x}
                          y1={layout.pos[u].y}
                          x2={layout.pos[v].x}
                          y2={layout.pos[v].y}
                          stroke={inClique ? '#fbbf24' : '#3f3f46'}
                          strokeWidth={inClique ? 3.2 : 1.1}
                          style={{ transition: 'stroke 180ms, stroke-width 180ms' }}
                        />
                      );
                    })}

                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const inClique = cliqueSet.has(node);
                      const optimal = bestSet.has(node);
                      const candidate = candidateSet.has(node);
                      return (
                        <g key={node}>
                          {optimal && (
                            <circle
                              cx={x}
                              cy={y}
                              r={layout.nodeR + 5}
                              fill="none"
                              stroke="#34d399"
                              strokeWidth={1.4}
                              opacity={0.75}
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={layout.nodeR}
                            fill={inClique ? 'rgba(251,191,36,0.9)' : '#111318'}
                            stroke={inClique ? '#fcd34d' : candidate ? '#60a5fa' : '#3f3f46'}
                            strokeWidth={candidate && !inClique ? 1.8 : 1.5}
                            style={{ transition: 'fill 180ms, stroke 180ms' }}
                          />
                          <text
                            x={x}
                            y={y + layout.nodeR * 0.2}
                            textAnchor="middle"
                            fontSize={Math.max(9, Math.round(layout.nodeR * 0.6))}
                            fontFamily="monospace"
                            fill={inClique ? '#1c1917' : candidate ? '#bfdbfe' : '#a1a1aa'}
                          >
                            {node}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-4 border-t border-white/[0.06] p-4 sm:w-[230px] sm:border-l sm:border-t-0">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">当前团</div>
                      <p className="mt-1 break-all font-mono text-sm leading-relaxed text-amber-300">
                        {displayClique.length ? `{${displayClique.join(', ')}}` : '—'}
                      </p>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">
                        大小 <b className="text-zinc-300">{displayClique.length}</b>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">最优团</span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">{step.best.length} 个点</span>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-emerald-300">
                        {step.best.length ? `{${step.best.join(', ')}}` : '—'}
                      </p>
                      <div className="mt-2 font-mono text-[10px] text-zinc-500">
                        候选点 <b className="text-zinc-300">{step.candidates.length}</b>
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">result</div>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {!done ? (
                          <span className="text-zinc-600">求解中…</span>
                        ) : result ? (
                          <span className="text-emerald-400">最大团 {result.length} 个</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">{step.note}</p>
                    </div>
                  </div>
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

          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="节点数 (NODES)" value={n} min={6} max={14} step={1} onChange={setN} />
              <Field
                label="边密度 (DENSITY)"
                value={Math.round(density * 100)}
                min={20}
                max={80}
                step={5}
                onChange={(v) => setDensity(v / 100)}
                format={(v) => `${v}%`}
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
                  <span className="text-zinc-400">节点 / 边</span>
                  <span className="text-zinc-800">
                    {input.n} / {input.edges.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">当前团</span>
                  <span className="tabular-nums text-zinc-800">{step.clique.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">最优团</span>
                  <span className="tabular-nums text-zinc-800">{step.best.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">候选点</span>
                  <span className="tabular-nums text-zinc-800">{step.candidates.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">计算耗时</span>
                  <span className="tabular-nums text-zinc-800">{solver.computeMs.toFixed(2)} ms</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
