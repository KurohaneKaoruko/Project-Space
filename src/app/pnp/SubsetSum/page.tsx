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

interface SubsetInput {
  nums: number[];
  target: number;
}

interface SubsetStep {
  row: number;
  col: number;
  value: boolean;
  note: string;
}

const TITLE = '子集和';
const CLS = 'NPC' as const;

/** 判题：返回一组下标，对应数字之和等于 target */
function validate(output: unknown, input: SubsetInput): boolean {
  if (!Array.isArray(output)) return false;
  const seen = new Set<number>();
  let sum = 0;
  for (const idx of output) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= input.nums.length || seen.has(idx)) return false;
    seen.add(idx);
    sum += input.nums[idx];
  }
  return sum === input.target;
}

function referenceSolve(input: SubsetInput): number[] | null {
  const { nums, target } = input;
  const n = nums.length;
  const dp: boolean[][] = Array.from({ length: n + 1 }, () => new Array(target + 1).fill(false));
  dp[0][0] = true;
  for (let i = 1; i <= n; i++) {
    for (let s = 0; s <= target; s++) {
      dp[i][s] = dp[i - 1][s] || (s >= nums[i - 1] && dp[i - 1][s - nums[i - 1]]);
    }
  }
  if (!dp[n][target]) return null;
  const picked: number[] = [];
  let s = target;
  for (let i = n; i > 0; i--) {
    if (dp[i - 1][s]) continue;
    picked.push(i - 1);
    s -= nums[i - 1];
  }
  return picked;
}

function makeCase(name: string, input: SubsetInput): TestCase<SubsetInput, number[] | null> {
  const ref = referenceSolve(input);
  return {
    name,
    input,
    expected: ref,
    validate: (out) => (ref === null ? Array.isArray(out) && out.length === 0 : validate(out, input)),
  };
}

const CASES: TestCase<SubsetInput, number[] | null>[] = [
  makeCase('经典样例', { nums: [3, 34, 4, 12, 5, 2], target: 9 }),
  makeCase('无解', { nums: [2, 4, 6, 8], target: 7 }),
  makeCase('多解', { nums: [1, 2, 3, 4, 5, 6], target: 10 }),
];

/** 逐格填充 DP 表，每个格子产出一帧 */
function* dpGen(input: SubsetInput): Generator<SubsetStep, number[] | null, void> {
  const { nums, target } = input;
  const n = nums.length;
  const dp: boolean[][] = Array.from({ length: n + 1 }, () => new Array(target + 1).fill(false));
  dp[0][0] = true;

  yield { row: 0, col: 0, value: true, note: '空集只能凑出 0' };

  for (let i = 1; i <= n; i++) {
    const v = nums[i - 1];
    for (let s = 0; s <= target; s++) {
      dp[i][s] = dp[i - 1][s] || (s >= v && dp[i - 1][s - v]);
      yield {
        row: i,
        col: s,
        value: dp[i][s],
        note: `dp[${i}][${s}] = ${dp[i][s]}（用上 ${v} 或不使用它）`,
      };
    }
  }

  if (!dp[n][target]) return null;

  const picked: number[] = [];
  let s = target;
  for (let i = n; i > 0; i--) {
    if (dp[i - 1][s]) continue;
    picked.push(i - 1);
    s -= nums[i - 1];
  }
  return picked;
}

function randomInstance(count: number, target: number, seed: number): SubsetInput {
  const rnd = mulberry32(seed);
  // 数值范围随目标缩放，保证 target 在可达范围内有挑战性
  const maxVal = Math.max(20, Math.ceil(target * 0.35));
  const nums = Array.from({ length: count }, () => 1 + Math.floor(rnd() * maxVal));
  const total = nums.reduce((a, b) => a + b, 0);
  return { nums, target: Math.max(3, Math.min(target, total)) };
}

const TEMPLATE = `function solve(input) {
  const { nums, target } = input;

  // TODO: 返回一组下标，使对应数字之和等于 target；无解返回 []
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { nums, target } = input;
  const n = nums.length;

  // dp[i][s] = 前 i 个数能否凑出 s
  const dp = Array.from({ length: n + 1 }, () => new Array(target + 1).fill(false));
  dp[0][0] = true;
  for (let i = 1; i <= n; i++) {
    for (let s = 0; s <= target; s++) {
      dp[i][s] = dp[i - 1][s] || (s >= nums[i - 1] && dp[i - 1][s - nums[i - 1]]);
    }
  }
  if (!dp[n][target]) return [];

  const picked = [];
  let s = target;
  for (let i = n; i > 0; i--) {
    if (dp[i - 1][s]) continue;
    picked.push(i - 1);
    s -= nums[i - 1];
  }
  return picked;
}`;

export default function SubsetSumPage() {
  const [count, setCount] = useState(8);
  const [target, setTarget] = useState(40);
  const [seed, setSeed] = useState(11);
  const [speed, setSpeed] = useState(8);

  const input = useMemo(() => randomInstance(count, target, seed), [count, target, seed]);

  // 完整 DP 表（用于渲染），实际推进由生成器逐格驱动
  const table = useMemo(() => {
    const { nums, target: t } = input;
    const dp: boolean[][] = Array.from({ length: nums.length + 1 }, () => new Array(t + 1).fill(false));
    dp[0][0] = true;
    for (let i = 1; i <= nums.length; i++) {
      for (let s = 0; s <= t; s++) {
        dp[i][s] = dp[i - 1][s] || (s >= nums[i - 1] && dp[i - 1][s - nums[i - 1]]);
      }
    }
    return dp;
  }, [input]);

  const factory = useCallback(() => dpGen(input), [input]);
  const solver = useLiveSolver<SubsetStep, number[] | null>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: SubsetStep = solver.current ?? { row: 0, col: 0, value: true, note: '尚未开始' };
  const result = solver.result;
  const done = solver.done;


  const cols = input.target + 1;
  const cell = Math.max(3, Math.min(16, Math.floor(1200 / cols)));
  const picked = new Set(result ?? []);

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
                meta={`${input.nums.length} items / target ${input.target}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {done ? (result ? 'TARGET 可达' : 'TARGET 不可达') : '填充中'}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                  <div className="inline-block">
                    <div className="flex">
                      <div className="w-14 shrink-0" />
                      {Array.from({ length: cols }, (_, s) => (
                        <div
                          key={s}
                          className="text-center font-mono text-[8px] text-zinc-500"
                          style={{ width: cell, height: 12 }}
                        >
                          {s % 5 === 0 ? s : ''}
                        </div>
                      ))}
                    </div>

                    {table.map((rowValues, i) => {
                      const isCurrentRow = i === step.row;
                      return (
                        <div key={i} className="flex items-center">
                          <div
                            className={`w-14 shrink-0 pr-2 text-right font-mono text-xs ${
                              isCurrentRow ? 'text-blue-300' : 'text-zinc-500'
                            }`}
                          >
                            {i === 0 ? '∅' : input.nums[i - 1]}
                          </div>
                          {rowValues.map((_, s) => {
                            const filled = i < step.row || (i === step.row && s <= step.col);
                            const on = filled && table[i][s];
                            const current = i === step.row && s === step.col;
                            return (
                              <div
                                key={s}
                                className={`rounded-[1px] transition-colors duration-150 ${
                                  current ? 'ring-1 ring-white/80' : ''
                                }`}
                                style={{
                                  width: cell - 1,
                                  height: cell - 1,
                                  margin: 0.5,
                                  background: on
                                    ? current
                                      ? '#93c5fd'
                                      : '#3b82f6'
                                    : filled
                                      ? 'rgba(255,255,255,0.1)'
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
                    {result.map((i) => input.nums[i]).join(' + ')} = {input.target}
                  </span>
                ) : (
                  <span className="text-rose-700">无解</span>
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
                max={40}
                step={1}
                onChange={setCount}
                format={(v) => `2^${v} = ${(2 ** v).toLocaleString()} 个子集（暴力搜索空间）`}
              />
              <Field label="目标和 (TARGET)" value={target} min={20} max={2000} step={1} onChange={setTarget} />
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
                  <span className="text-zinc-400">数字</span>
                  <span className="break-all text-right text-zinc-800">[{input.nums.join(', ')}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">格子总数</span>
                  <span className="tabular-nums text-zinc-800">{(input.nums.length + 1) * cols}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已填充</span>
                  <span className="tabular-nums text-zinc-800">{solver.stepCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">选中</span>
                  <span className="break-all text-right text-zinc-800">
                    {result && result.length ? result.map((i) => input.nums[i]).join('+') : '—'}
                  </span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
