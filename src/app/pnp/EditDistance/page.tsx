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

interface EDInput {
  a: string;
  b: string;
}

interface EDStep {
  row: number;
  col: number;
  value: number;
  note: string;
}

const TITLE = '编辑距离';
const CLS = 'P' as const;

/** 判题：把 a 变成 b 的操作序列是否合法且代价等于声称的距离 */
function validate(output: unknown, input: EDInput): boolean {
  if (typeof output !== 'number' || !Number.isInteger(output)) return false;
  if (output < 0) return false;
  // 用 BFS-free 的方式验证：距离必须 >= |len 差|，且参考解可复核
  return output === editDistance(input.a, input.b);
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function makeCase(name: string, input: EDInput): TestCase<EDInput, number> {
  return {
    name,
    input,
    expected: editDistance(input.a, input.b),
    validate: (out) => validate(out, input),
  };
}

const CASES: TestCase<EDInput, number>[] = [
  makeCase('kitten→sitting', { a: 'kitten', b: 'sitting' }),
  makeCase('相同串', { a: 'abc', b: 'abc' }),
  makeCase('空串', { a: '', b: 'abc' }),
];

/** 逐格填充 DP 表，每个格子产出一帧 */
function* edGen(input: EDInput): Generator<EDStep, number, void> {
  const { a, b } = input;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
    yield { row: i, col: 0, value: i, note: `dp[${i}][0] = ${i}：把前 ${i} 个字符全部删除` };
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j;
    yield { row: 0, col: j, value: j, note: `dp[0][${j}] = ${j}：插入 ${j} 个字符` };
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        yield {
          row: i,
          col: j,
          value: dp[i][j],
          note: `'${a[i - 1]}' = '${b[j - 1]}'，免费对齐，继承左上角 ${dp[i][j]}`,
        };
      } else {
        const sub = dp[i - 1][j - 1];
        const del = dp[i - 1][j];
        const ins = dp[i][j - 1];
        dp[i][j] = 1 + Math.min(sub, del, ins);
        const op = sub <= del && sub <= ins ? '替换' : del <= ins ? '删除' : '插入';
        yield {
          row: i,
          col: j,
          value: dp[i][j],
          note: `'${a[i - 1]}' ≠ '${b[j - 1]}'，取 ${op}（${dp[i][j]} = 1 + ${Math.min(sub, del, ins)}）`,
        };
      }
    }
  }
  return dp[m][n];
}

function randomWord(len: number, rnd: () => number): string {
  const alphabet = 'abcdefg';
  return Array.from({ length: len }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('');
}

const TEMPLATE = `function solve(input) {
  const { a, b } = input;

  // TODO: 返回把 a 变成 b 的最少操作数（插入/删除/替换）
  return 0;
}`;

const SOLUTION = `function solve(input) {
  const { a, b } = input;
  const m = a.length, n = b.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}`;

export default function EditDistancePage() {
  const [lenA, setLenA] = useState(7);
  const [lenB, setLenB] = useState(8);
  const [seed, setSeed] = useState(3);
  const [speed, setSpeed] = useState(8);

  const input = useMemo<EDInput>(() => {
    const rnd = mulberry32(seed);
    return { a: randomWord(lenA, rnd), b: randomWord(lenB, rnd) };
  }, [lenA, lenB, seed]);

  const factory = useCallback(() => edGen(input), [input]);
  const solver = useLiveSolver<EDStep, number>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: EDStep = solver.current ?? { row: 0, col: 0, value: 0, note: '尚未开始' };
  const result = solver.result;
  const done = solver.done;

  const full = useMemo(() => {
    const { a, b } = input;
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp;
  }, [input]);

  const m = input.a.length;
  const n = input.b.length;
  const cell = Math.max(18, Math.min(34, Math.floor(560 / (n + 1))));

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
                meta={`"${input.a}" → "${input.b}"`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    {done ? `距离 = ${result}` : '填充中'}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                  <div className="inline-block">
                    <div className="flex">
                      <div className="w-8 shrink-0" />
                      <div className="w-8 shrink-0" />
                      {Array.from({ length: n }, (_, j) => (
                        <div
                          key={j}
                          className="text-center font-mono text-[10px] text-zinc-400"
                          style={{ width: cell, height: 16 }}
                        >
                          {input.b[j]}
                        </div>
                      ))}
                    </div>

                    {full.map((rowValues, i) => {
                      const isCurrentRow = i === step.row;
                      return (
                        <div key={i} className="flex items-center">
                          <div className="w-8 shrink-0" />
                          <div
                            className={`shrink-0 text-center font-mono text-[11px] ${
                              isCurrentRow ? 'text-blue-300' : 'text-zinc-500'
                            }`}
                            style={{ width: 32 }}
                          >
                            {i === 0 ? '∅' : input.a[i - 1]}
                          </div>
                          {rowValues.map((v, j) => {
                            const filled = i < step.row || (i === step.row && j <= step.col);
                            const current = i === step.row && j === step.col;
                            const isGoal = done && i === m && j === n;
                            return (
                              <div
                                key={j}
                                className={`rounded-[2px] transition-colors duration-150 ${
                                  current ? 'ring-1 ring-white/80' : ''
                                }`}
                                style={{
                                  width: cell - 2,
                                  height: cell - 2,
                                  margin: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: Math.max(9, cell * 0.38),
                                  fontFamily: 'monospace',
                                  background: isGoal
                                    ? '#10b981'
                                    : current
                                      ? '#93c5fd'
                                      : filled
                                        ? v === 0 && i + j > 0
                                          ? 'rgba(255,255,255,0.08)'
                                          : '#3b82f6'
                                        : 'rgba(255,255,255,0.04)',
                                  color: isGoal || current ? '#fff' : 'rgba(255,255,255,0.85)',
                                  opacity: filled ? 1 : 0.4,
                                }}
                              >
                                {filled ? v : ''}
                              </div>
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
                ) : (
                  <span className="text-emerald-700">
                    编辑距离 = {result}（{m}×{n} 表格，{(m + 1) * (n + 1)} 格）
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="串 A 长度" value={lenA} min={2} max={40} step={1} onChange={setLenA} />
              <Field label="串 B 长度" value={lenB} min={2} max={40} step={1} onChange={setLenB} />
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
                  <span className="text-zinc-400">串 A</span>
                  <span className="text-zinc-800">{input.a || '∅'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">串 B</span>
                  <span className="text-zinc-800">{input.b || '∅'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">格子总数</span>
                  <span className="tabular-nums text-zinc-800">{(m + 1) * (n + 1)}</span>
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
