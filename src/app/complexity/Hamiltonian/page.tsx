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

interface HamInput {
  n: number;
  edges: [number, number][];
}

interface HamStep {
  path: number[];
  active: number | null;
  note: string;
  backtracks: number;
}

const TITLE = '哈密顿回路';
const CLS = 'NPC' as const;

function isHamiltonian(output: unknown, input: HamInput): boolean {
  if (!Array.isArray(output) || output.length !== input.n) return false;
  const seen = new Set<number>();
  for (const v of output) {
    if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
    seen.add(v);
  }
  const has = (a: number, b: number) =>
    input.edges.some(([u, v]) => (u === a && v === b) || (u === b && v === a));
  for (let i = 0; i < output.length; i++) {
    if (!has(output[i], output[(i + 1) % output.length])) return false;
  }
  return true;
}

/** (n-1)!/2 的近似值（对数法避免溢出）；用于展示搜索空间规模 */
function factorialRatio(n: number): number {
  if (n > 170) return Infinity;
  let logSum = 0;
  for (let i = 2; i <= n; i++) logSum += Math.log10(i);
  logSum -= Math.log10(2);
  return Math.pow(10, logSum);
}

/** 参考解：回溯找一个哈密顿回路 */
function referenceSolve(input: HamInput): number[] | null {
  const { n, edges } = input;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  const path = [0];
  const used = new Array(n).fill(false);
  used[0] = true;
  let budget = 2000000;

  const dfs = (): boolean => {
    if (path.length === n) return adj[path[n - 1]].includes(path[0]);
    if (--budget <= 0) return false;
    for (const v of adj[path[path.length - 1]]) {
      if (used[v]) continue;
      used[v] = true;
      path.push(v);
      if (dfs()) return true;
      path.pop();
      used[v] = false;
    }
    return false;
  };

  return dfs() ? [...path] : null;
}

function makeCase(name: string, input: HamInput): TestCase<HamInput, number[] | null> {
  const ref = referenceSolve(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => (ref === null ? out === null : isHamiltonian(out, input)),
  };
}

const CASES: TestCase<HamInput, number[] | null>[] = [
  makeCase('6 环', {
    n: 6,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
    ],
  }),
  makeCase('带弦', {
    n: 5,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [0, 2],
    ],
  }),
  makeCase('无解（星形）', {
    n: 5,
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  }),
];

/** 回溯搜索，每试一个点产出一帧 */
function* hamGen(input: HamInput): Generator<HamStep, number[] | null, void> {
  const { n, edges } = input;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const path = [0];
  const used = new Array(n).fill(false);
  used[0] = true;
  let backtracks = 0;
  let budget = 2000000;

  yield { path: [...path], active: 0, note: '从 0 出发', backtracks };

  function* dfs(): Generator<HamStep, number[] | null, void> {
    if (path.length === n) {
      if (adj[path[n - 1]].includes(path[0])) {
        yield { path: [...path], active: path[0], note: '回到起点，找到哈密顿回路', backtracks };
        return [...path];
      }
      yield { path: [...path], active: path[n - 1], note: '末尾与起点不相邻，回溯', backtracks };
      return null;
    }

    if (--budget <= 0) {
      yield { path: [...path], active: path[path.length - 1], note: '搜索步数超限，已中止', backtracks };
      return null;
    }

    const last = path[path.length - 1];
    for (const v of adj[last]) {
      if (used[v]) continue;
      used[v] = true;
      path.push(v);
      yield { path: [...path], active: v, note: `走到 ${v}（第 ${path.length} 个点）`, backtracks };
      const found = yield* dfs();
      if (found) return found;
      path.pop();
      used[v] = false;
      backtracks++;
      yield { path: [...path], active: last, note: `从 ${v} 走不通，退回 ${last}`, backtracks };
    }
    return null;
  }

  return yield* dfs();
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  // TODO: 返回一个访问所有点恰好一次的回路（0..n-1 的排列），无解返回 null
  return null;
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const path = [0];
  const used = new Array(n).fill(false);
  used[0] = true;

  function dfs() {
    if (path.length === n) return adj[path[n - 1]].includes(path[0]);
    for (const v of adj[path[path.length - 1]]) {
      if (used[v]) continue;
      used[v] = true;
      path.push(v);
      if (dfs()) return true;
      path.pop();
      used[v] = false;
    }
    return false;
  }

  return dfs() ? path : null;
}`;

export default function HamiltonianPage() {
  const [n, setN] = useState(7);
  const [density, setDensity] = useState(0.35);
  const [seed, setSeed] = useState(5);
  const [speed, setSpeed] = useState(1);

  const input = useMemo<HamInput>(() => ({ n, edges: randomGraph(n, density, seed) }), [n, density, seed]);

  const factory = useCallback(() => hamGen(input), [input]);
  const solver = useLiveSolver<HamStep, number[] | null>(factory, [input], { stepsPerFrame: speed });

  const step: HamStep =
    solver.current ?? { path: [], active: null, note: '尚未开始，点「开始求解」', backtracks: 0 };
  const result = solver.result;
  const done = solver.done;

  const layout = useMemo(() => {
    const W = 820;
    const H = 380;
    const rx = 300;
    const ry = 128;
    const nodeR = input.n <= 10 ? 23 : input.n <= 16 ? 17 : 12;
    return {
      width: W,
      height: H,
      nodeR,
      pos: Array.from({ length: input.n }, (_, i) => {
        const angle = (i / input.n) * Math.PI * 2 - Math.PI / 2;
        return { x: W / 2 + rx * Math.cos(angle), y: H / 2 + ry * Math.sin(angle) };
      }),
    };
  }, [input]);

  const pathSet = new Set<string>();
  for (let i = 0; i < step.path.length - 1; i++) {
    const a = step.path[i];
    const b = step.path[i + 1];
    pathSet.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
  }
  const closed = done && result !== null;

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
                label="GRAPH"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">回溯 {step.backtracks}</span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full"
                    role="img"
                    aria-label="哈密顿回路搜索过程"
                  >
                    {input.edges.map(([u, v], i) => {
                      const onPath = pathSet.has(`${Math.min(u, v)}-${Math.max(u, v)}`);
                      return (
                        <line
                          key={i}
                          x1={layout.pos[u].x}
                          y1={layout.pos[u].y}
                          x2={layout.pos[v].x}
                          y2={layout.pos[v].y}
                          stroke={onPath ? '#60a5fa' : '#3f3f46'}
                          strokeWidth={onPath ? 3 : 1.2}
                          style={{ transition: 'stroke 200ms' }}
                        />
                      );
                    })}

                    {closed && result && (
                      <line
                        x1={layout.pos[result[result.length - 1]].x}
                        y1={layout.pos[result[result.length - 1]].y}
                        x2={layout.pos[result[0]].x}
                        y2={layout.pos[result[0]].y}
                        stroke="#34d399"
                        strokeWidth={3}
                        strokeDasharray="6 4"
                      />
                    )}

                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const inPath = step.path.includes(node);
                      const active = step.active === node;
                      return (
                        <g key={node}>
                          {active && (
                            <circle
                              cx={x}
                              cy={y}
                              r={layout.nodeR + 7}
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth={1}
                              opacity={0.6}
                              className="pulse-soft"
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={layout.nodeR}
                            fill={inPath ? 'rgba(59,130,246,0.85)' : '#111318'}
                            stroke={inPath ? '#93c5fd' : '#3f3f46'}
                            strokeWidth={1.6}
                            style={{ transition: 'fill 200ms, stroke 200ms' }}
                          />
                          <text
                            x={x}
                            y={y + layout.nodeR * 0.2}
                            textAnchor="middle"
                            fontSize={Math.max(8, Math.round(layout.nodeR * 0.6))}
                            fontFamily="monospace"
                            fill={inPath ? '#ffffff' : '#a1a1aa'}
                          >
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
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">
                    当前路径
                  </div>
                  <p className="mt-1 font-mono text-[13px] text-zinc-700">
                    {step.path.length ? step.path.join(' → ') : '—'}
                  </p>
                </div>
                <p className="ml-auto font-mono text-[11px]">
                  {!done ? (
                    <span className="text-zinc-400">—</span>
                  ) : result ? (
                    <span className="text-emerald-700">{result.join(' → ')} → {result[0]}</span>
                  ) : (
                    <span className="text-rose-700">无哈密顿回路</span>
                  )}
                </p>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="节点数 (NODES)"
                value={n}
                min={5}
                max={30}
                step={1}
                onChange={setN}
                format={(v) => {
                  const space = factorialRatio(v - 1);
                  return Number.isFinite(space)
                    ? `~${space.toExponential(2)} 条回路待穷举`
                    : '天文数字条回路';
                }}
              />
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
                  <span className="text-zinc-800">{input.n} / {input.edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">路径长度</span>
                  <span className="tabular-nums text-zinc-800">{step.path.length} / {input.n}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">回溯次数</span>
                  <span className="tabular-nums text-zinc-800">{step.backtracks}</span>
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
