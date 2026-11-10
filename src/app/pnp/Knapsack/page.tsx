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

interface KnapsackInput {
  weights: number[];
  values: number[];
  capacity: number;
}

interface KSStep {
  row: number;
  col: number;
  value: number;
  note: string;
}

const TITLE = '0/1 背包';
const CLS = 'NPC' as const;

/** 判题：一组下标，总重不超容量，价值等于声称的最大价值 */
function validate(output: unknown, input: KnapsackInput): boolean {
  if (!Array.isArray(output)) return false;
  const seen = new Set<number>();
  let w = 0;
  let v = 0;
  for (const idx of output) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= input.weights.length || seen.has(idx)) return false;
    seen.add(idx);
    w += input.weights[idx];
    v += input.values[idx];
  }
  if (w > input.capacity) return false;
  return v === bestValue(input);
}

function bestValue(input: KnapsackInput): number {
  const { weights, values, capacity } = input;
  const n = weights.length;
  const dp = new Array(capacity + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let c = capacity; c >= weights[i]; c--) {
      dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
    }
  }
  return dp[capacity];
}

function bestSet(input: KnapsackInput): number[] {
  const { weights, values, capacity } = input;
  const n = weights.length;
  // 二维表便于回溯
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (c >= weights[i - 1] && dp[i - 1][c - weights[i - 1]] + values[i - 1] > dp[i][c]) {
        dp[i][c] = dp[i - 1][c - weights[i - 1]] + values[i - 1];
      }
    }
  }
  const picked: number[] = [];
  let c = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      picked.push(i - 1);
      c -= weights[i - 1];
    }
  }
  return picked;
}

function makeCase(name: string, input: KnapsackInput): TestCase<KnapsackInput, number[]> {
  const ref = bestSet(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => validate(out, input),
  };
}

const CASES: TestCase<KnapsackInput, number[]>[] = [
  makeCase('经典样例', {
    weights: [2, 3, 4, 5],
    values: [3, 4, 5, 6],
    capacity: 5,
  }),
  makeCase('装不满', {
    weights: [5, 6, 7],
    values: [10, 20, 30],
    capacity: 4,
  }),
  makeCase('多解竞争', {
    weights: [1, 2, 3, 4],
    values: [6, 10, 12, 13],
    capacity: 7,
  }),
];

/** 逐格填充 DP 表，每个格子产出一帧 */
function* ksGen(input: KnapsackInput): Generator<KSStep, number[], void> {
  const { weights, values, capacity } = input;
  const n = weights.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  yield { row: 0, col: 0, value: 0, note: '第 0 行：没有物品可选，价值恒为 0' };

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1];
    const v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      const skip = dp[i - 1][c];
      const take = c >= w ? dp[i - 1][c - w] + v : -1;
      dp[i][c] = Math.max(skip, take);
      yield {
        row: i,
        col: c,
        value: dp[i][c],
        note:
          take < 0
            ? `容量 ${c} 装不下 w=${w}，继承上行 ${skip}`
            : dp[i][c] === take
              ? `装物品 ${i - 1}（w=${w}, v=${v}）更优：${skip} → ${dp[i][c]}`
              : `不装更优：保持 ${skip}`,
      };
    }
  }

  // 回溯找选中物品
  const picked: number[] = [];
  let c = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      picked.push(i - 1);
      c -= weights[i - 1];
    }
  }
  return picked;
}

function randomInstance(count: number, capacity: number, seed: number): KnapsackInput {
  const rnd = mulberry32(seed);
  const weights = Array.from({ length: count }, () => 1 + Math.floor(rnd() * Math.max(4, capacity * 0.3)));
  const values = Array.from({ length: count }, () => 2 + Math.floor(rnd() * 20));
  return { weights, values, capacity };
}

const TEMPLATE = `function solve(input) {
  const { weights, values, capacity } = input;

  // TODO: 返回选中物品的下标数组（总重不超容量，价值最大）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { weights, values, capacity } = input;
  const n = weights.length;

  // 一维滚动数组：容量倒序遍历
  const dp = new Array(capacity + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let c = capacity; c >= weights[i]; c--) {
      dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
    }
  }

  // 回溯选了哪些物品：重跑二维表
  const t = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= capacity; c++) {
      t[i][c] = t[i - 1][c];
      if (c >= weights[i - 1] && t[i - 1][c - weights[i - 1]] + values[i - 1] > t[i][c]) {
        t[i][c] = t[i - 1][c - weights[i - 1]] + values[i - 1];
      }
    }
  }
  const picked = [];
  let c = capacity;
  for (let i = n; i > 0; i--) {
    if (t[i][c] !== t[i - 1][c]) { picked.push(i - 1); c -= weights[i - 1]; }
  }
  return picked;
}`;

export default function KnapsackPage() {
  const [count, setCount] = useState(6);
  const [capacity, setCapacity] = useState(18);
  const [seed, setSeed] = useState(9);
  const [speed, setSpeed] = useState(8);

  const input = useMemo(() => randomInstance(count, capacity, seed), [count, capacity, seed]);

  const factory = useCallback(() => ksGen(input), [input]);
  const solver = useLiveSolver<KSStep, number[]>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: KSStep = solver.current ?? { row: 0, col: 0, value: 0, note: '尚未开始' };
  const result = solver.result;
  const done = solver.done;

  const full = useMemo(() => {
    const { weights, values, capacity: cap } = input;
    const n = weights.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let c = 0; c <= cap; c++) {
        dp[i][c] = dp[i - 1][c];
        if (c >= weights[i - 1] && dp[i - 1][c - weights[i - 1]] + values[i - 1] > dp[i][c]) {
          dp[i][c] = dp[i - 1][c - weights[i - 1]] + values[i - 1];
        }
      }
    }
    return dp;
  }, [input]);

  const cols = input.capacity + 1;
  const cell = Math.max(3, Math.min(16, Math.floor(1200 / cols)));
  const picked = new Set(result ?? []);
  const pickedW = (result ?? []).reduce((s, i) => s + input.weights[i], 0);
  const pickedV = (result ?? []).reduce((s, i) => s + input.values[i], 0);

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
                label="DP TABLE"
                meta={`${input.weights.length} items / capacity ${input.capacity}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {done ? `最优价值 ${result ? pickedV : 0}` : '填充中'}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                  <div className="inline-block">
                    <div className="flex">
                      <div className="w-14 shrink-0" />
                      {Array.from({ length: cols }, (_, c) => (
                        <div
                          key={c}
                          className="text-center font-mono text-[8px] text-zinc-500"
                          style={{ width: cell, height: 12 }}
                        >
                          {c % 5 === 0 ? c : ''}
                        </div>
                      ))}
                    </div>

                    {full.map((rowValues, i) => {
                      const isCurrentRow = i === step.row;
                      const isPickedRow = picked.has(i - 1);
                      return (
                        <div key={i} className="flex items-center">
                          <div
                            className={`w-14 shrink-0 pr-2 text-right font-mono text-xs ${
                              isPickedRow && done ? 'text-emerald-300' : isCurrentRow ? 'text-blue-300' : 'text-zinc-500'
                            }`}
                          >
                            {i === 0 ? '∅' : `${input.weights[i - 1]}·${input.values[i - 1]}`}
                          </div>
                          {rowValues.map((v, c) => {
                            const filled = i < step.row || (i === step.row && c <= step.col);
                            const current = i === step.row && c === step.col;
                            return (
                              <div
                                key={c}
                                className={`rounded-[1px] transition-colors duration-150 ${
                                  current ? 'ring-1 ring-white/80' : ''
                                }`}
                                style={{
                                  width: cell - 1,
                                  height: cell - 1,
                                  margin: 0.5,
                                  background: current
                                    ? '#93c5fd'
                                    : filled
                                      ? v > 0
                                        ? '#3b82f6'
                                        : 'rgba(255,255,255,0.1)'
                                      : 'rgba(255,255,255,0.05)',
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
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

            <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-400">结果</div>
              <p className="mt-1 font-mono text-[13px]">
                {!done ? (
                  <span className="text-zinc-400">—</span>
                ) : result && result.length > 0 ? (
                  <span className="text-emerald-700">
                    价值 {pickedV} = [{result.map((i) => input.values[i]).join(' + ')}]，重量 {pickedW}/{input.capacity}
                  </span>
                ) : (
                  <span className="text-rose-700">装不下任何物品</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field
                label="物品数 (ITEMS)"
                value={count}
                min={4}
                max={60}
                step={1}
                onChange={setCount}
              />
              <Field label="容量 (CAPACITY)" value={capacity} min={8} max={600} step={1} onChange={setCapacity} />
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
                  <span className="text-zinc-400">重量</span>
                  <span className="break-all text-right text-zinc-800">[{input.weights.join(', ')}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">价值</span>
                  <span className="break-all text-right text-zinc-800">[{input.values.join(', ')}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">格子总数</span>
                  <span className="tabular-nums text-zinc-800">{(input.weights.length + 1) * cols}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已填充</span>
                  <span className="tabular-nums text-zinc-800">{solver.stepCount}</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
