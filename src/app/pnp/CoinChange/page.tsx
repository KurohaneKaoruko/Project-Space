'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { CLASS_META, type TestCase } from '../lib/types';

interface CCInput {
  coins: number[];
  amount: number;
}

interface CCStep {
  /** DP 表（0..amount，-1 = 不可达） */
  dp: number[];
  row: number;
  coin: number;
  note: string;
}

const TITLE = '找零钱';
const CLS = 'P' as const;

/* ---------------- 算法 ---------------- */

/** 参考解：标准 DP，返回最少硬币数（不可达返回 -1） */
function coinRef(input: CCInput): number {
  const { coins, amount } = input;
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let s = 1; s <= amount; s++) {
    for (const c of coins) {
      if (c <= s && dp[s - c] + 1 < dp[s]) dp[s] = dp[s - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

/** 贪心：大面额优先（对标准币制最优，任意币制可能失败） */
function greedyRef(input: CCInput): { count: number; used: number[] } | null {
  const { coins, amount } = input;
  const sorted = [...coins].sort((a, b) => b - a);
  let rest = amount;
  const used: number[] = [];
  for (const c of sorted) {
    while (rest >= c) {
      rest -= c;
      used.push(c);
    }
  }
  return rest === 0 ? { count: used.length, used } : null;
}

function validate(output: unknown, input: CCInput): boolean {
  if (typeof output !== 'number') return false;
  return output === coinRef(input);
}

function makeCase(name: string, input: CCInput): TestCase<CCInput, number> {
  const ref = coinRef(input);
  return { name, input, expected: ref, validate: (out) => validate(out, input) };
}

const CASES: TestCase<CCInput, number>[] = [
  makeCase('标准币制', { coins: [1, 5, 10, 25], amount: 63 }),
  makeCase('贪心陷阱', { coins: [1, 3, 4], amount: 6 }), // 贪心 4+1+1=3 枚,DP 3+3=2 枚
  makeCase('不可达', { coins: [5, 7], amount: 3 }),
];

/** DP 生成器：逐金额填充，每个 (金额, 币) 组合产出一帧 */
function* ccGen(input: CCInput): Generator<CCStep, number, void> {
  const { coins, amount } = input;
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  yield { dp: [...dp], row: 0, coin: 0, note: 'dp[0] = 0：金额 0 需要 0 枚硬币，其余暂为 ∞' };

  for (let s = 1; s <= amount; s++) {
    for (const c of coins) {
      if (c > s) continue;
      const cand = dp[s - c] + 1;
      const improved = cand < dp[s];
      if (improved) dp[s] = cand;
      yield {
        dp: [...dp],
        row: s,
        coin: c,
        note: improved
          ? `dp[${s}] = dp[${s - c}] + 1 = ${dp[s]}（用 ${c} 面额更省）`
          : `dp[${s}]：用 ${c} 面额得 ${cand === Infinity ? '∞' : cand}，不如当前最优`,
      };
    }
  }

  const ans = dp[amount] === Infinity ? -1 : dp[amount];
  yield {
    dp: [...dp],
    row: amount,
    coin: 0,
    note: ans >= 0 ? `完成：dp[${amount}] = ${ans} 枚硬币` : `完成：金额 ${amount} 无法凑出`,
  };
  return ans;
}

const TEMPLATE = `function solve(input) {
  const { coins, amount } = input;

  // TODO: 返回凑出 amount 的最少硬币数，无法凑出返回 -1
  //（每种面额无限供应）
  return -1;
}`;

const SOLUTION = `function solve(input) {
  const { coins, amount } = input;
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let s = 1; s <= amount; s++) {
    for (const c of coins) {
      if (c <= s && dp[s - c] + 1 < dp[s]) dp[s] = dp[s - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}`;

export default function CoinChangePage() {
  const [amount, setAmount] = useState(36);
  const [preset, setPreset] = useState(0);
  const [seed, setSeed] = useState(3);
  const [speed, setSpeed] = useState(4);

  /* 币制集合：标准 + 贪心会失误的 + 随机 */
  const COIN_SYSTEMS = useMemo(
    () => [
      { label: '标准 [1,5,10,25]', coins: [1, 5, 10, 25] },
      { label: '陷阱 [1,3,4]', coins: [1, 3, 4] },
      { label: '无 1 [5,7,9]', coins: [5, 7, 9] },
    ],
    [],
  );

  const rndCoins = useMemo(() => {
    const r = (seed * 2654435761) % 97;
    const pool = [1, 2, 3, 4, 6, 7, 9, 11, 13];
    return [1, pool[r % pool.length], pool[(r * 7 + 3) % pool.length], pool[(r * 13 + 5) % pool.length]]
      .filter((c, i, a) => a.indexOf(c) === i)
      .sort((a, b) => a - b);
  }, [seed]);

  const input = useMemo<CCInput>(
    () => ({ coins: COIN_SYSTEMS[preset]?.coins ?? rndCoins, amount }),
    [preset, COIN_SYSTEMS, rndCoins, amount],
  );

  const factory = useCallback(() => ccGen(input), [input]);
  const solver = useLiveSolver<CCStep, number>(factory, [input], {
    stepsPerFrame: speed,
  });

  const step: CCStep =
    solver.current ?? { dp: [0], row: 0, coin: 0, note: '尚未开始，点「开始求解」' };
  const result = solver.result;
  const done = solver.done;

  const dp = step.dp;
  const curBest = dp[step.row] === Infinity ? '∞' : dp[step.row];

  /* 贪心对照 */
  const greedy = greedyRef(input);
  const opt = coinRef(input);

  /* 渲染参数：DP 条形 */
  const n = dp.length;
  const cellW = Math.max(4, Math.min(18, Math.floor(1100 / Math.max(n, 1))));
  const maxCount = Math.max(...dp.filter((v) => v !== Infinity), 1);

  const greedyUsed = greedy?.used ?? [];
  const greedyHist: Record<number, number> = {};
  for (const c of greedyUsed) greedyHist[c] = (greedyHist[c] ?? 0) + 1;

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
                meta={`coins [${input.coins.join(', ')}] / amount ${input.amount}`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-500">
                    填充到 {step.row}/{input.amount} · 当前 {curBest}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 items-end justify-center overflow-auto p-4">
                  <div className="flex items-end gap-0" style={{ height: 200 }}>
                    {dp.map((v, s) => {
                      const isCurrent = s === step.row && !done;
                      const h = v === Infinity ? 4 : Math.max(6, (v / maxCount) * 180);
                      return (
                        <div
                          key={s}
                          title={`dp[${s}] = ${v === Infinity ? '∞' : v}`}
                          style={{
                            width: cellW,
                            height: h,
                            marginRight: 1,
                            background: isCurrent
                              ? '#fbbf24'
                              : v === Infinity
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(59,130,246,0.6)',
                            outline: isCurrent ? '1px solid rgba(251,191,36,0.8)' : undefined,
                          }}
                          className="transition-[height,background] duration-150"
                        />
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
                ) : result !== null && result >= 0 ? (
                  <span className="text-emerald-700">
                    最少 {result} 枚硬币凑出 {input.amount}
                  </span>
                ) : (
                  <span className="text-rose-700">金额 {input.amount} 无法用 [{input.coins.join(', ')}] 凑出</span>
                )}
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">{step.note}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                贪心对照（大面额优先）：
                {greedy ? `${greedy.count} 枚 [${greedyUsed.join('+')}]` : '无法凑出'}
                {greedy && opt >= 0 && greedy.count > opt ? ` —— 比 DP 的 ${opt} 枚差！贪心在任意币制下不保证最优` : greedy && opt >= 0 ? '（与 DP 持平，标准币制下贪心恰好最优）' : ''}
              </p>
            </div>
          </div>

          <ControlPanel>
            <Section title="实例 (INSTANCE)">
              <Field label="金额 (AMOUNT)" value={amount} min={5} max={300} step={1} onChange={setAmount} />
              <Field
                label="币制 (SYSTEM)"
                value={preset}
                min={0}
                max={COIN_SYSTEMS.length}
                step={1}
                onChange={setPreset}
                format={(v) =>
                  v < COIN_SYSTEMS.length ? COIN_SYSTEMS[v].label : `随机 [${rndCoins.join(', ')}]`
                }
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                换随机币制 (RESHUFFLE)
              </button>
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">币种数</span>
                  <span className="tabular-nums text-zinc-800">{input.coins.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">表宽</span>
                  <span className="tabular-nums text-zinc-800">{input.amount + 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">DP 复杂度</span>
                  <span className="text-zinc-800">O(amount·k)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">贪心</span>
                  <span className="text-zinc-800">仅标准币制最优</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">状态转移</span>
                  <span className="text-zinc-800">dp[s] = min dp[s−c]+1</span>
                </div>
              </div>
            </Section>
          </ControlPanel>
        </div>
      </div>
    </main>
  );
}
