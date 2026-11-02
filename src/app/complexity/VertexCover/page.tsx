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

interface CoverInput {
  n: number;
  edges: [number, number][];
}

interface CoverStep {
  chosen: boolean[];
  best: number[];
  bestSize: number;
  note: string;
  /** 当前已选点数 */
  size: number;
}

const TITLE = '顶点覆盖';
const CLS = 'NPC' as const;

/** 参考解：位掩码枚举最小覆盖 */
function minCover(input: CoverInput): number[] {
  const { n, edges } = input;
  let best: number[] = Array.from({ length: n }, (_, i) => i);

  for (let mask = 0; mask < 1 << n; mask++) {
    let size = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) size++;
    if (size >= best.length) continue;
    const ok = edges.every(([u, v]) => (mask & (1 << u)) !== 0 || (mask & (1 << v)) !== 0);
    if (!ok) continue;
    best = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) best.push(i);
  }
  return best;
}

function isCover(output: unknown, input: CoverInput): boolean {
  if (!Array.isArray(output)) return false;
  const picked = output as number[];
  const seen = new Set<number>();
  for (const v of picked) {
    if (!Number.isInteger(v) || v < 0 || v >= input.n || seen.has(v)) return false;
    seen.add(v);
  }
  return input.edges.every(([u, v]) => seen.has(u) || seen.has(v));
}

function makeCase(name: string, input: CoverInput): TestCase<CoverInput, number[]> {
  const ref = minCover(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => {
      if (!isCover(out, input)) return false;
      const size = (out as number[]).length;
      // 必须是最小覆盖
      return size === ref.length;
    },
  };
}

const CASES: TestCase<CoverInput, number[]>[] = [
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

/** 分支定界：每次挑一条未覆盖的边，二选一端点 */
function* coverGen(input: CoverInput): Generator<CoverStep, number[], void> {
  const { n, edges } = input;
  const chosen = new Array(n).fill(false);
  // 上界：全选
  let best = Array.from({ length: n }, (_, i) => i);
  let bestSize = n;
  let budget = 400000;

  const count = () => chosen.reduce((sum, v) => sum + (v ? 1 : 0), 0);

  yield {
    chosen: [...chosen],
    best: [...best],
    bestSize,
    size: 0,
    note: `平凡上界：全选 ${n} 个点`,
  };

  function* dfs(): Generator<CoverStep, void, void> {
    if (--budget <= 0) {
      yield {
        chosen: [...chosen],
        best: [...best],
        bestSize,
        size: count(),
        note: '搜索步数超限，已中止',
      };
      return;
    }

    const size = count();
    if (size >= bestSize) {
      yield {
        chosen: [...chosen],
        best: [...best],
        bestSize,
        size,
        note: `当前大小 ${size} 不优于最优 ${bestSize}，剪枝`,
      };
      return;
    }

    const edge = edges.find(([u, v]) => !chosen[u] && !chosen[v]);
    if (!edge) {
      bestSize = size;
      best = chosen.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      yield {
        chosen: [...chosen],
        best: [...best],
        bestSize,
        size,
        note: `得到大小为 ${size} 的覆盖，刷新最优`,
      };
      return;
    }

    const [u, v] = edge;
    for (const pick of [u, v]) {
      chosen[pick] = true;
      yield {
        chosen: [...chosen],
        best: [...best],
        bestSize,
        size: size + 1,
        note: `选中 ${pick}（覆盖边 ${u}–${v}）`,
      };
      yield* dfs();
      chosen[pick] = false;
      yield {
        chosen: [...chosen],
        best: [...best],
        bestSize,
        size: count(),
        note: `撤销 ${pick}，换另一端试试`,
      };
    }
  }

  yield* dfs();
  return best;
}

const TEMPLATE = `function solve(input) {
  const { n, edges } = input;

  // TODO: 返回一个顶点覆盖（下标数组），要求覆盖每条边且尽量小
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n, edges } = input;
  const chosen = new Array(n).fill(false);
  let best = Array.from({ length: n }, (_, i) => i);
  let bestSize = n;

  const count = () => chosen.filter(Boolean).length;

  function dfs() {
    const size = count();
    if (size >= bestSize) return;
    const edge = edges.find(([u, v]) => !chosen[u] && !chosen[v]);
    if (!edge) {
      bestSize = size;
      best = chosen.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      return;
    }
    for (const pick of edge) {
      chosen[pick] = true;
      dfs();
      chosen[pick] = false;
    }
  }

  dfs();
  return best;
}`;

export default function VertexCoverPage() {
  const [n, setN] = useState(8);
  const [density, setDensity] = useState(0.4);
  const [seed, setSeed] = useState(3);
  const [speed, setSpeed] = useState(1);

  const input = useMemo<CoverInput>(
    () => ({ n, edges: randomGraph(n, density, seed) }),
    [n, density, seed],
  );

  const factory = useCallback(() => coverGen(input), [input]);
  const solver = useLiveSolver<CoverStep, number[]>(factory, [input], { stepsPerFrame: speed });

  const step: CoverStep =
    solver.current ?? {
      chosen: new Array(input.n).fill(false),
      best: Array.from({ length: input.n }, (_, i) => i),
      bestSize: input.n,
      size: 0,
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

  // 初始上界是「全选」，还没真正搜到解，不要高亮
  const showBest = step.bestSize < input.n;
  const bestSet = new Set(showBest ? step.best : []);
  const chosenSet = new Set<number>();
  step.chosen.forEach((v, i) => {
    if (v) chosenSet.add(i);
  });
  // 跑完之后用最终解着色，避免「全撤销」导致画面全空
  const effective = done && result ? new Set(result) : chosenSet;
  const target = input.edges.find(([u, v]) => !step.chosen[u] && !step.chosen[v]);
  const uncovered = input.edges.filter(([u, v]) => !effective.has(u) && !effective.has(v)).length;

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
                label="COVER"
                meta={`${input.n} nodes / ${input.edges.length} edges`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {step.size} 选中 / 最优 {step.bestSize}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full max-h-[420px] w-full"
                    role="img"
                    aria-label="顶点覆盖搜索过程"
                  >
                    {input.edges.map(([u, v], i) => {
                      const open = !effective.has(u) && !effective.has(v);
                      const isTarget = target !== undefined && target[0] === u && target[1] === v;
                      const inBest = showBest && bestSet.has(u) && bestSet.has(v);
                      return (
                        <line
                          key={i}
                          x1={layout.pos[u].x}
                          y1={layout.pos[u].y}
                          x2={layout.pos[v].x}
                          y2={layout.pos[v].y}
                          stroke={isTarget ? '#fbbf24' : open ? '#f43f5e' : inBest ? '#34d399' : '#3f3f46'}
                          strokeWidth={isTarget ? 3 : open ? 2 : 1.2}
                          strokeDasharray={open && !isTarget ? '4 3' : undefined}
                          style={{ transition: 'stroke 180ms' }}
                        />
                      );
                    })}

                    {Array.from({ length: input.n }, (_, node) => {
                      const { x, y } = layout.pos[node];
                      const picked = effective.has(node);
                      const optimal = showBest && bestSet.has(node);
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
                            fill={picked ? 'rgba(251,191,36,0.85)' : '#111318'}
                            stroke={picked ? '#fcd34d' : optimal ? '#34d399' : '#3f3f46'}
                            strokeWidth={1.6}
                            style={{ transition: 'fill 180ms, stroke 180ms' }}
                          />
                          <text
                            x={x}
                            y={y + layout.nodeR * 0.2}
                            textAnchor="middle"
                            fontSize={Math.max(9, Math.round(layout.nodeR * 0.6))}
                            fontFamily="monospace"
                            fill={picked ? '#1c1917' : '#a1a1aa'}
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
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">当前选中</div>
                      <p className="mt-1 break-all font-mono text-sm leading-relaxed text-amber-300">
                        {effective.size > 0 ? `{${[...effective].join(', ')}}` : '—'}
                      </p>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">
                        大小 <b className="text-zinc-300">{step.size}</b>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">最优覆盖</span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">{step.bestSize} 个点</span>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-emerald-300">
                        {step.best.length ? `{${step.best.join(', ')}}` : '—'}
                      </p>
                      <div className="mt-2 font-mono text-[10px] text-zinc-500">
                        未覆盖边 <b className="text-zinc-300">{uncovered}</b>
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">result</div>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {!done ? (
                          <span className="text-zinc-600">求解中…</span>
                        ) : result ? (
                          <span className="text-emerald-400">最小覆盖 {result.length} 个</span>
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
                max={70}
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
                  <span className="text-zinc-400">当前大小</span>
                  <span className="tabular-nums text-zinc-800">{step.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">最优大小</span>
                  <span className="tabular-nums text-zinc-800">{step.bestSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">未覆盖边</span>
                  <span className="tabular-nums text-zinc-800">{uncovered}</span>
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
