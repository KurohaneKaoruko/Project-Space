'use client';

import { useCallback, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import InstrumentPanel from '../components/InstrumentPanel';
import SegmentedControl from '../components/SegmentedControl';
import ControlPanel, { Field, Section } from '../components/ControlPanel';
import CodeRunner from '../components/CodeRunner';
import LiveControls from '../components/LiveControls';
import { useLiveSolver } from '../lib/useLiveSolver';
import { mulberry32 } from '../lib/generate';
import { CLASS_META, type TestCase } from '../lib/types';

/** 可视化用的输入：大整数用 BigInt，才能分解 20 位以上的数 */
interface FactorInput {
  n: bigint;
}

/** 判题用例用小整数（用户代码里就是普通 number） */
interface CaseInput {
  n: number;
}

interface FactorStep {
  m: bigint;
  d: bigint;
  factors: bigint[];
  note: string;
}

/* ---------------- BigInt 数论工具 ---------------- */

const gcdBig = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcdBig(b, a % b));

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/** Miller–Rabin：确定性判定到 3e24 */
function isPrimeBig(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of MR_BASES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }

  let d = n - 1n;
  let r = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }

  for (const a of MR_BASES) {
    if (a >= n) continue;
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let passed = false;
    for (let i = 0; i < r - 1; i++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        passed = true;
        break;
      }
    }
    if (!passed) return false;
  }
  return true;
}

/** 生成指定位数的合数 */
function randomCompositeBig(digits: number, seed: number): bigint {
  const rnd = mulberry32(seed);
  let text = String(1 + Math.floor(rnd() * 9));
  for (let i = 1; i < digits; i++) text += String(Math.floor(rnd() * 10));
  let n = BigInt(text);
  let guard = 0;
  while (isPrimeBig(n) && guard++ < 500) n += 1n;
  return n;
}

/** 由已找到的质因子推导短除法竖式（实时增长） */
function ladderFromFactors(n: bigint, factors: bigint[]) {
  const rows: { divisor: bigint; dividend: bigint; quotient: bigint }[] = [];
  let m = n;
  for (const f of factors) {
    if (f < 2n || m % f !== 0n) break;
    rows.push({ divisor: f, dividend: m, quotient: m / f });
    m /= f;
  }
  return rows;
}

/* ---------------- 判题用例（小整数） ---------------- */

const isPrimeNum = (n: number): boolean => {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
};

function isFactorization(output: unknown, input: CaseInput): boolean {
  if (!Array.isArray(output) || output.length === 0) return false;
  if (output.some((v) => !Number.isInteger(v) || v < 2)) return false;
  for (let i = 1; i < output.length; i++) if (output[i] < output[i - 1]) return false;
  const product = output.reduce((a, b) => a * b, 1);
  return product === input.n && output.every(isPrimeNum);
}

function referenceFactors(n: number): number[] {
  const factors: number[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % d === 0) {
      factors.push(d);
      m /= d;
    }
  }
  if (m > 1) factors.push(m);
  return factors;
}

const CASES: TestCase<CaseInput, number[]>[] = [
  { name: '360', input: { n: 360 }, expected: referenceFactors(360), validate: isFactorization },
  { name: '999983', input: { n: 999983 }, expected: referenceFactors(999983), validate: isFactorization },
  { name: '123456789', input: { n: 123456789 }, expected: referenceFactors(123456789), validate: isFactorization },
  { name: '1000000007', input: { n: 1000000007 }, expected: referenceFactors(1000000007), validate: isFactorization },
];

/* ---------------- 算法（生成器，边跑边产出） ---------------- */

const TRIAL_BUDGET = 500000;

function* trialGen(n: bigint): Generator<FactorStep, bigint[], void> {
  const factors: bigint[] = [];
  let m = n;
  let ops = 0;

  yield { m, d: 2n, factors: [], note: `从 d = 2 开始试除 ${n}` };

  for (let d = 2n; d * d <= m; d++) {
    if (m % d === 0n) {
      while (m % d === 0n) {
        factors.push(d);
        m /= d;
        yield { m, d, factors: [...factors], note: `${d} 整除，剩余 ${m}` };
      }
      continue;
    }
    ops++;
    if (ops % 2000 === 0) {
      yield { m, d, factors: [...factors], note: `试到 d = ${d}，仍未找到因子` };
    }
    if (ops >= TRIAL_BUDGET) {
      yield {
        m,
        d,
        factors: [...factors],
        note: `试除 ${TRIAL_BUDGET} 次仍无因子 → 这个规模下试除法不可行，换 Pollard's Rho`,
      };
      return factors;
    }
  }

  if (m > 1n) {
    factors.push(m);
    yield { m: 1n, d: m, factors: [...factors], note: `剩余 ${m} 是质数，收尾` };
  }
  return factors;
}

function* rhoIter(
  value: bigint,
): Generator<{ i: number; x: bigint; y: bigint; d: bigint }, bigint, void> {
  if (value % 2n === 0n) return 2n;
  let x = 2n;
  let y = 2n;
  const c = 1n;
  let d = 1n;
  let guard = 0;
  const f = (v: bigint) => (v * v + c) % value;
  while (d === 1n && guard++ < 200000) {
    x = f(x);
    y = f(f(y));
    d = gcdBig(x > y ? x - y : y - x, value);
    yield { i: guard, x, y, d };
  }
  return d === value ? -1n : d;
}

function* pollardGen(n: bigint): Generator<FactorStep, bigint[], void> {
  const factors: bigint[] = [];
  const snap = (m: bigint, d: bigint, note: string): FactorStep => ({
    m,
    d,
    factors: [...factors],
    note,
  });

  yield snap(n, 0n, `对 ${n} 调用 Pollard's Rho`);

  const stack = [n];
  while (stack.length) {
    const value = stack.pop() as bigint;
    if (value === 1n) continue;

    if (isPrimeBig(value)) {
      factors.push(value);
      factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      yield snap(1n, value, `${value} 是质数，收尾`);
      continue;
    }

    const iter = rhoIter(value);
    let cursor = iter.next();
    while (!cursor.done) {
      yield snap(value, cursor.value.d, `迭代 ${cursor.value.i}：gcd(|x−y|, n) = ${cursor.value.d}`);
      cursor = iter.next();
    }
    const d = cursor.value;

    if (d <= 1n) {
      yield snap(value, d, 'Pollard 没找到非平凡因子，放弃该分支');
      continue;
    }

    yield snap(value, d, `找到因子 ${d}，拆成 ${d} × ${value / d}`);
    stack.push(d, value / d);
  }

  return factors;
}

const TEMPLATE = `function solve(input) {
  const { n } = input;

  // TODO: 返回 n 的全部质因子，按升序排列（含重复，如 12 -> [2, 2, 3]）
  return [];
}`;

const SOLUTION = `function solve(input) {
  const { n } = input;
  const factors = [];
  let m = n;

  for (let d = 2; d * d <= m; d++) {
    while (m % d === 0) {
      factors.push(d);
      m /= d;
    }
  }
  if (m > 1) factors.push(m);
  return factors;
}`;

export default function FactoringPage() {
  const [algo, setAlgo] = useState<'trial' | 'pollard'>('pollard');
  const [digits, setDigits] = useState(16);
  const [seed, setSeed] = useState(3);
  const [manual, setManual] = useState('');
  const [speed, setSpeed] = useState(1);

  const generated = useMemo(() => randomCompositeBig(digits, seed), [digits, seed]);
  const manualValid = /^\d+$/.test(manual) && manual.length > 0 && BigInt(manual) >= 2n;
  const n = manualValid ? BigInt(manual) : generated;

  const factory = useCallback(() => (algo === 'trial' ? trialGen(n) : pollardGen(n)), [algo, n]);
  const solver = useLiveSolver<FactorStep, bigint[]>(factory, [algo, n], { stepsPerFrame: speed });

  const step: FactorStep =
    solver.current ?? { m: n, d: 2n, factors: [], note: '尚未开始，点「开始求解」' };
  const ladder = ladderFromFactors(n, step.factors);
  const done = solver.done;
  const total = solver.result?.length ?? null;


  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation
        title="整数分解"
        header={
          <>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${CLASS_META['NP'].chip}`}>
              {CLASS_META['NP'].label}
            </span>
            <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">整数分解</span>
          </>
        }
        actions={<CodeRunner template={TEMPLATE} solution={SOLUTION} cases={CASES} />}
      />

      <div className="flex min-h-screen flex-col px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <InstrumentPanel
                label="LONG DIVISION"
                meta={`n = ${n} · ${n.toString().length} 位`}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col"
                actions={
                  <span className="font-mono text-[10px] text-zinc-600">
                    {algo === 'trial' ? 'TRIAL_DIVISION' : 'POLLARD_RHO'}
                  </span>
                }
              >
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
                    <div className="space-y-1">
                      {ladder.map((row, i) => (
                        <div key={i} className="flex items-stretch gap-4 font-mono">
                          <span className="w-24 self-center text-right text-2xl tabular-nums text-amber-400">
                            {row.divisor}
                          </span>
                          <span className="border-l border-white/[0.14] pl-6 text-[34px] tabular-nums text-zinc-100">
                            {row.dividend}
                          </span>
                        </div>
                      ))}

                      <div className="flex items-stretch gap-4 font-mono">
                        <span className="w-24" />
                        <span className="border-l border-transparent pl-6 text-[34px] tabular-nums">
                          <span className={done ? 'text-blue-400' : 'text-zinc-700'}>
                            {done ? (ladder[ladder.length - 1]?.quotient ?? n) : '?'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-5 border-t border-white/[0.06] p-4 sm:w-[240px] sm:border-l sm:border-t-0">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">n</div>
                      <div className="mt-1 break-all font-mono text-xl font-black tabular-nums text-zinc-100">
                        {n}
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-500">
                        剩余 <span className="text-zinc-300">{step.m}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                          factors
                        </span>
                        <span className="font-mono text-[9px] tabular-nums text-zinc-500">
                          {step.factors.length}
                          {total !== null ? `/${total}` : ''}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {step.factors.length === 0 && (
                          <span className="font-mono text-[11px] text-zinc-600">—</span>
                        )}
                        {step.factors.map((f, i) => (
                          <span
                            key={i}
                            className="rounded border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 font-mono text-sm font-bold text-blue-300"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                        {algo === 'trial' ? 'divisor' : 'gcd'}
                      </div>
                      <div className="mt-1 break-all font-mono text-xl tabular-nums text-zinc-100">
                        {step.d}
                      </div>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">
                        {step.note}
                      </p>
                    </div>

                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">
                        result
                      </div>
                      <p className="mt-1 break-all font-mono text-xs leading-relaxed">
                        {done && solver.result ? (
                          <span className="text-emerald-400">
                            {n} = {solver.result.join(' × ')}
                          </span>
                        ) : (
                          <span className="text-zinc-600">求解中…</span>
                        )}
                      </p>
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[10px] font-medium uppercase text-zinc-500">
                    数字 (NUMBER)
                  </div>
                  <button
                    onClick={() => setManual('')}
                    className="font-mono text-[10px] uppercase tracking-wider text-blue-600 transition-colors hover:text-blue-500"
                  >
                    用随机值
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manual}
                  onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 24))}
                  placeholder={String(generated)}
                  className="w-full rounded-sm border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-sm tabular-nums text-zinc-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                  aria-label="自定义数字"
                />
                {manual.length > 0 && !manualValid && (
                  <p className="font-mono text-[10px] text-rose-500">需为不小于 2 的整数</p>
                )}
                {manualValid && manual.length > 20 && (
                  <p className="font-mono text-[10px] text-amber-600">
                    超过 20 位，Pollard 也可能要跑很久
                  </p>
                )}
              </div>

              <Field
                label="随机位数 (DIGITS)"
                value={digits}
                min={6}
                max={24}
                step={1}
                onChange={(v) => {
                  setDigits(v);
                  setManual('');
                }}
              />
              <button
                onClick={() => {
                  setManual('');
                  setSeed((s) => s + 1);
                }}
                className="w-full border border-zinc-200 bg-zinc-50 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
              >
                重新生成 (RESHUFFLE)
              </button>
            </Section>

            <Section title="算法 (ALGORITHM)">
              <SegmentedControl
                value={algo}
                onChange={(v) => setAlgo(v as 'trial' | 'pollard')}
                options={[
                  { value: 'trial', label: '试除法' },
                  { value: 'pollard', label: "Pollard's Rho" },
                ]}
              />
            </Section>

            <Section title="数据 (DATA)">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">位数</span>
                  <span className="tabular-nums text-zinc-800">{n.toString().length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">剩余</span>
                  <span className="tabular-nums text-zinc-800">{step.m}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">已找到因子</span>
                  <span className="text-zinc-800">
                    {step.factors.length}
                    {total !== null ? ` / ${total}` : ''}
                  </span>
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
