'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import SegmentedControl from '../components/SegmentedControl';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

interface SetCoverInput {
  m: number;
  sets: number[][];
}

interface SetCoverStep {
  picked: number[];
  covered: boolean[];
  note: string;
}

const TITLE = '集合覆盖';
const CLS = 'NPC' as const;

/** 精确解：按顺序考虑每个集合，选或不选（k 大时搜索树指数爆炸，带访问预算退化为贪心近似） */
function exactCover(input: SetCoverInput): number[] {
  const { m, sets } = input;
  const covered = new Array(m).fill(false);
  const picked: number[] = [];
  let best: number[] | null = null;
  let budget = 500000;
  let exhausted = true;

  const dfs = (k: number) => {
    if (budget-- <= 0) {
      exhausted = false;
      return;
    }
    if (best && picked.length >= best.length) return;
    if (covered.every(Boolean)) {
      best = [...picked];
      return;
    }
    if (k >= sets.length) return;

    const newly = sets[k].filter((e) => !covered[e]);
    if (newly.length > 0) {
      for (const e of newly) covered[e] = true;
      picked.push(k);
      dfs(k + 1);
      picked.pop();
      for (const e of newly) covered[e] = false;
    }
    dfs(k + 1);
  };

  dfs(0);
  if (!exhausted) {
    // 预算内没搜完：退回贪心近似解，保证判题仍有参照
    return greedyApprox(input);
  }
  return best ?? [];
}

/** 贪心近似：每轮挑新增覆盖最多的集合 */
function greedyApprox(input: SetCoverInput): number[] {
  const { m, sets } = input;
  const covered = new Array(m).fill(false);
  const picked: number[] = [];
  while (covered.some((c) => !c)) {
    let bestIdx = -1;
    let bestGain = 0;
    for (let i = 0; i < sets.length; i++) {
      if (picked.includes(i)) continue;
      const gain = sets[i].filter((e) => !covered[e]).length;
      if (gain > bestGain) { bestGain = gain; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    picked.push(bestIdx);
    for (const e of sets[bestIdx]) covered[e] = true;
  }
  return picked;
}

function coversAll(output: unknown, input: SetCoverInput): boolean {
  if (!Array.isArray(output)) return false;
  const picked = output as number[];
  const seen = new Set<number>();
  for (const i of picked) {
    if (!Number.isInteger(i) || i < 0 || i >= input.sets.length || seen.has(i)) return false;
    seen.add(i);
  }
  for (let e = 0; e < input.m; e++) {
    let hit = false;
    for (const i of seen) {
      if (input.sets[i].includes(e)) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }
  return true;
}

function makeCase(name: string, input: SetCoverInput): TestCase<SetCoverInput, number[]> {
  const ref = exactCover(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => coversAll(out, input) && (out as number[]).length === ref.length,
  };
}

const CASES: TestCase<SetCoverInput, number[]>[] = [
  makeCase('教材样例', {
    m: 6,
    sets: [
      [0, 1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [0, 5],
    ],
  }),
  makeCase('重叠覆盖', {
    m: 5,
    sets: [
      [0, 1],
      [1, 2, 3],
      [3, 4],
      [0, 4],
    ],
  }),
  makeCase('需要三个集合', {
    m: 7,
    sets: [
      [0, 1],
      [1, 2],
      [2, 3, 4],
      [4, 5],
      [5, 6],
    ],
  }),
];

function randomSets(m: number, k: number, seed: number): SetCoverInput {
  const rnd = mulberry32(seed);
  const sets: number[][] = [];

  for (let i = 0; i < k; i++) {
    const size = 2 + Math.floor(rnd() * Math.max(1, Math.ceil(m / 2)));
    const picked = new Set<number>();
    while (picked.size < Math.min(size, m)) picked.add(Math.floor(rnd() * m));
    sets.push([...picked].sort((a, b) => a - b));
  }

  // 保证每个元素至少出现在一个集合里
  for (let e = 0; e < m; e++) {
    if (!sets.some((s) => s.includes(e))) {
      const target = Math.floor(rnd() * k);
      sets[target] = [...new Set([...sets[target], e])].sort((a, b) => a - b);
    }
  }

  return { m, sets };
}

/** 贪心：每轮挑「新增覆盖最多」的集合 */
function* greedyGen(input: SetCoverInput): Generator<SetCoverStep, number[], void> {
  const covered = new Array(input.m).fill(false);
  const picked: number[] = [];

  yield { picked: [], covered: [...covered], note: '每轮挑新增覆盖最多的集合' };

  while (covered.some((c) => !c)) {
    let bestIdx = -1;
    let bestGain = 0;
    for (let i = 0; i < input.sets.length; i++) {
      if (picked.includes(i)) continue;
      const gain = input.sets[i].filter((e) => !covered[e]).length;
      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      yield { picked: [...picked], covered: [...covered], note: '剩余元素无法再被覆盖，停止' };
      break;
    }

    picked.push(bestIdx);
    for (const e of input.sets[bestIdx]) covered[e] = true;
    yield {
      picked: [...picked],
      covered: [...covered],
      note: `选集合 ${bestIdx}，新增 ${bestGain} 个元素`,
    };
  }

  return picked;
}

/** 精确解：选或不选，带最优剪枝 */
function* exactGen(input: SetCoverInput): Generator<SetCoverStep, number[], void> {
  const { m, sets } = input;
  const covered = new Array(m).fill(false);
  const picked: number[] = [];
  let best: number[] | null = null;
  let budget = 2000000;

  yield { picked: [], covered: [...covered], note: '深度优先枚举子集，遇到更小的解就更新' };

  function* dfs(k: number): Generator<SetCoverStep, void, void> {
    if (--budget <= 0) {
      yield { picked: [...picked], covered: [...covered], note: '搜索步数超限，已中止' };
      return;
    }
    if (best && picked.length >= best.length) return;
    if (covered.every(Boolean)) {
      best = [...picked];
      yield {
        picked: [...picked],
        covered: [...covered],
        note: `得到大小为 ${picked.length} 的覆盖，刷新最优`,
      };
      return;
    }
    if (k >= sets.length) return;

    const newly = sets[k].filter((e) => !covered[e]);
    if (newly.length > 0) {
      for (const e of newly) covered[e] = true;
      picked.push(k);
      yield {
        picked: [...picked],
        covered: [...covered],
        note: `选集合 ${k}，新增 ${newly.length} 个元素`,
      };
      yield* dfs(k + 1);
      picked.pop();
      for (const e of newly) covered[e] = false;
      yield { picked: [...picked], covered: [...covered], note: `撤销集合 ${k}` };
    }

    yield* dfs(k + 1);
  }

  yield* dfs(0);
  return best ?? [];
}

const TEMPLATE = `function solve(input) {
  const { m, sets } = input;

  // TODO: 返回一组集合下标，使 0..m-1 每个元素都被至少一个选中集合覆盖
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { m, sets } = input;
  const covered = new Array(m).fill(false);
  const picked = [];

  while (covered.some((c) => !c)) {
    let bestIdx = -1;
    let bestGain = 0;
    for (let i = 0; i < sets.length; i++) {
      if (picked.includes(i)) continue;
      const gain = sets[i].filter((e) => !covered[e]).length;
      if (gain > bestGain) { bestGain = gain; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    picked.push(bestIdx);
    for (const e of sets[bestIdx]) covered[e] = true;
  }
  return picked;
}`;

export default function SetCoverPage() {
  const [m, setM] = useState(10);
  const [k, setK] = useState(7);
  const [seed, setSeed] = useState(2);
  const [algo, setAlgo] = useState<'greedy' | 'exact'>('greedy');
  const [speed, setSpeed] = useState(1);

  const input = useMemo<SetCoverInput>(() => randomSets(m, k, seed), [m, k, seed]);
  const factory = useCallback(
    () => (algo === 'greedy' ? greedyGen(input) : exactGen(input)),
    [algo, input],
  );
  const solver = useLiveSolver<SetCoverStep, number[]>(factory, [algo, input], {
    stepsPerFrame: speed,
  });

  const step: SetCoverStep =
    solver.current ?? {
      picked: [],
      covered: new Array(input.m).fill(false),
      note: '尚未开始，点「开始求解」',
    };
  const result = solver.result;
  const done = solver.done;

  const coveredCount = step.covered.filter(Boolean).length;
  const maxSetSize = Math.max(1, ...input.sets.map((s) => s.length));
  const lowerBound = Math.ceil(input.m / maxSetSize);

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
                label="SET COVER"
                meta={`${input.m} elements / ${input.sets.length} sets`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    覆盖 {coveredCount}/{input.m}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
                  <div className="my-auto w-full">
                  {/* 全集 */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
                    <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                      universe
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: input.m }, (_, e) => (
                        <span
                          key={e}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border font-mono text-[11px] transition-colors duration-200 ${
                            step.covered[e]
                              ? 'border-amber-400/60 bg-amber-500/80 text-zinc-900'
                              : 'border-white/10 bg-white/[0.03] text-zinc-500'
                          }`}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 集合列表 */}
                  <div className="mt-3 space-y-1.5">
                    {input.sets.map((set, i) => {
                      const picked = step.picked.includes(i);
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 rounded-sm border px-2.5 py-2 transition-colors duration-200 ${
                            picked
                              ? 'border-amber-500/40 bg-amber-500/[0.12]'
                              : 'border-white/[0.06] bg-white/[0.02]'
                          }`}
                        >
                          <span
                            className={`w-8 shrink-0 font-mono text-[10px] ${
                              picked ? 'text-amber-300' : 'text-zinc-500'
                            }`}
                          >
                            S{i}
                          </span>
                          <div className="flex flex-1 flex-wrap gap-1">
                            {set.map((e) => (
                              <span
                                key={e}
                                className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1 font-mono text-[10px] transition-colors duration-200 ${
                                  step.covered[e]
                                    ? 'bg-blue-500/70 text-white'
                                    : 'bg-white/[0.06] text-zinc-500'
                                }`}
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                          <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-600">
                            {set.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-4 border-t border-white/[0.06] p-4 sm:w-[230px] sm:border-l sm:border-t-0">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">已选集合</div>
                      <p className="mt-1 break-all font-mono text-sm leading-relaxed text-amber-300">
                        {step.picked.length ? step.picked.map((i) => `S${i}`).join(' + ') : '—'}
                      </p>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">
                        个数 <b className="text-zinc-300">{step.picked.length}</b>
                        <span className="ml-3">下界 <b className="text-zinc-300">{lowerBound}</b></span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">覆盖进度</span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">
                          {coveredCount}/{input.m}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${(coveredCount / Math.max(1, input.m)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">result</div>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {!done ? (
                          <span className="text-zinc-600">求解中…</span>
                        ) : result ? (
                          <span className="text-emerald-400">
                            {algo === 'exact' ? '最优' : '贪心'} {result.length} 个集合
                          </span>
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
              <Field
                label="元素数 (ELEMENTS)"
                value={m}
                min={6}
                max={40}
                step={1}
                onChange={setM}
              />
              <Field
                label="集合数 (SETS)"
                value={k}
                min={4}
                max={24}
                step={1}
                onChange={setK}
                format={(v) => `2^${v} = ${(2 ** v).toExponential(1)} 种选法`}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="算法 (ALGORITHM)">
              <SegmentedControl
                value={algo}
                onChange={(v) => setAlgo(v as 'greedy' | 'exact')}
                options={[
                  { value: 'greedy', label: '贪心' },
                  { value: 'exact', label: '精确' },
                ]}
              />
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">元素 / 集合</span>
                  <span className="text-zinc-800">
                    {input.m} / {input.sets.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已覆盖</span>
                  <span className="tabular-nums text-zinc-800">
                    {coveredCount} / {input.m}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已选集合</span>
                  <span className="tabular-nums text-zinc-800">{step.picked.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">下界</span>
                  <span className="tabular-nums text-zinc-800">{lowerBound}</span>
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
