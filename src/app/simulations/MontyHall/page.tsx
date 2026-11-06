'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

/**
 * 三门问题（Monty Hall）：
 * 主持人知晓门后内容，必定打开一扇「山羊门」且不碰玩家选的门。
 * 此时换门胜率 2/3、坚持胜率 1/3——页面上半部分手动玩，下半部分批量模拟看频率收敛。
 */

type Door = 0 | 1 | 2;
type Phase = 'pick' | 'reveal' | 'result';

interface RoundRecord {
  /** stay = 坚持原选择 / switch = 换到另一扇 / random = 抛硬币二选一 */
  strategy: 'stay' | 'switch' | 'random';
  won: boolean;
}

interface CurvePoint {
  n: number;
  rate: number;
}

type Strategy = 'stay' | 'switch' | 'random';

/** 单轮：随机放车 → 玩家选门 → 主持人开一扇山羊门 → 按策略决定最终门 → 结算 */
function playRound(strategy: Strategy, initialPick?: Door): RoundRecord {
  const car = Math.floor(Math.random() * 3) as Door;
  let pick = initialPick ?? (Math.floor(Math.random() * 3) as Door);
  const originalPick = pick;
  // 主持人：从「非玩家选门 & 非车」的门里开一扇
  const goatDoors = ([0, 1, 2] as Door[]).filter((d) => d !== pick && d !== car);
  const opened = goatDoors[Math.floor(Math.random() * goatDoors.length)];
  if (strategy === 'switch') {
    // 换门 = 选剩下的那扇（未选中、未被打开）
    pick = ([0, 1, 2] as Door[]).find((d) => d !== pick && d !== opened) as Door;
  } else if (strategy === 'random') {
    // 抛硬币：在原选择与另一扇未开门之间随机二选一
    const other = ([0, 1, 2] as Door[]).find((d) => d !== pick && d !== opened) as Door;
    pick = Math.random() < 0.5 ? originalPick : other;
  }
  return { strategy, won: pick === car };
}

/** 三扇门布局：门体 + 门牌号 + 揭示内容（车/山羊） */
function DoorView({
  index,
  phase,
  picked,
  opened,
  carDoor,
  onPick,
  interactive,
}: {
  index: Door;
  phase: Phase;
  picked: Door | null;
  opened: Door | null;
  carDoor: Door | null;
  onPick: (d: Door) => void;
  interactive: boolean;
}) {
  const isPicked = picked === index;
  const isOpened = opened === index;
  // 只有结算(result)才揭示全部内容；reveal 阶段仅打开主持人那扇门，其余保持关闭
  const revealed = phase === 'result';
  const showCar = revealed && carDoor === index;
  const goat = revealed && !showCar;
  // 揭示阶段：玩家最初选的门保持高亮；换门后最终选中的门在结算时高亮
  return (
    <button
      type="button"
      onClick={() => interactive && onPick(index)}
      disabled={!interactive}
      className={`relative flex h-52 w-24 flex-col overflow-hidden rounded-xl border-2 transition-all duration-300 sm:h-64 sm:w-32 ${
        isOpened
          ? 'border-zinc-200 bg-zinc-100'
          : isPicked
            ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-600/15'
            : 'border-zinc-300 bg-white hover:border-blue-400 hover:shadow-md'
      } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
      aria-label={`门 ${index + 1}${isPicked ? '（你选的）' : ''}`}
    >
      {/* 门牌号 */}
      <span
        className={`absolute left-2 top-2 font-mono text-xs font-bold ${
          isOpened ? 'text-zinc-300' : isPicked ? 'text-blue-600' : 'text-zinc-400'
        }`}
      >
        {index + 1}
      </span>
      {isPicked && !isOpened && (
        <span className="absolute right-2 top-2 rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
          你的选择
        </span>
      )}

      {/* 门体内容 */}
      <div className="flex flex-1 items-center justify-center">
        {isOpened ? (
          <span className="rotate-0 text-4xl opacity-70">🐐</span>
        ) : showCar ? (
          <span className="text-4xl">🚗</span>
        ) : goat ? (
          <span className="text-4xl opacity-70">🐐</span>
        ) : (
          <svg viewBox="0 0 40 64" className="h-24 w-15 text-zinc-300" fill="none" stroke="currentColor">
            <rect x="4" y="4" width="32" height="56" rx="3" strokeWidth="2" />
            <circle cx="30" cy="32" r="2" fill="currentColor" stroke="none" />
            <path d="M8 12 h24 M8 20 h24" strokeWidth="1" opacity="0.5" />
          </svg>
        )}
      </div>

      {/* 底部结果标记 */}
      {phase === 'result' && (
        <span
          className={`py-1 text-center font-mono text-[10px] font-bold ${
            isPicked ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-500'
          }`}
        >
          {isPicked ? (showCar ? '命中 🎉' : '山羊…') : showCar ? '车在这里' : '山羊'}
        </span>
      )}
    </button>
  );
}

/** 胜率收敛曲线：switch / stay / random 三条，向 2/3、1/3、1/2 收敛 */
function WinRateChart({
  curves,
}: {
  curves: { key: Strategy; color: string; points: CurvePoint[] }[];
}) {
  const W = 560;
  const H = 150;
  const path = (curve: CurvePoint[]) => {
    if (curve.length < 2) return '';
    // x 轴用对数刻度：1 轮到上万轮都看得清收敛过程
    const l0 = Math.log10(curve[0].n);
    const l1 = Math.log10(curve[curve.length - 1].n);
    const span = Math.max(l1 - l0, 1e-9);
    return curve
      .map((p, i) => {
        const x = ((Math.log10(p.n) - l0) / span) * (W - 8) + 4;
        const y = H - 10 - p.rate * (H - 22);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="胜率收敛曲线">
      {/* 理论值参考线：2/3、1/2、1/3 */}
      {(
        [
          { v: 2 / 3, color: '#2563eb', label: '2/3 ≈ 66.7%' },
          { v: 1 / 2, color: '#16a34a', label: '1/2 = 50%' },
          { v: 1 / 3, color: '#f59e0b', label: '1/3 ≈ 33.3%' },
        ] as const
      ).map(({ v, color, label }) => (
        <g key={label}>
          <line x1="4" x2={W - 4} y1={H - 10 - v * (H - 22)} y2={H - 10 - v * (H - 22)} stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.35" />
          <text x="8" y={H - 10 - v * (H - 22) - 4} fontSize="10" fill={color} fontFamily="monospace">{label}</text>
        </g>
      ))}
      {curves.map(({ key, color, points }) =>
        points.length >= 2 ? <path key={key} d={path(points)} fill="none" stroke={color} strokeWidth="1.8" /> : null,
      )}
    </svg>
  );
}

export default function MontyHallPage() {
  // ---- 手动模式 ----
  const [phase, setPhase] = useState<Phase>('pick');
  const [picked, setPicked] = useState<Door | null>(null);
  const [opened, setOpened] = useState<Door | null>(null);
  const [carDoor, setCarDoor] = useState<Door | null>(null);
  const [finalPick, setFinalPick] = useState<Door | null>(null);
  const [finalStrategy, setFinalStrategy] = useState<Strategy | null>(null);
  const [manual, setManual] = useState<Record<Strategy, RoundRecord[]>>({ switch: [], stay: [], random: [] });

  // ---- 批量模拟 ----
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(10000);
  const [batch, setBatch] = useState<Record<Strategy, { rounds: number; wins: number }>>({
    switch: { rounds: 0, wins: 0 },
    stay: { rounds: 0, wins: 0 },
    random: { rounds: 0, wins: 0 },
  });
  const [batchCurves, setBatchCurves] = useState<Record<Strategy, CurvePoint[]>>({ switch: [], stay: [], random: [] });
  const timerRef = useRef(0);
  const cancelRef = useRef(false);

  const startManual = () => {
    setPhase('pick');
    setPicked(null);
    setOpened(null);
    setCarDoor(null);
    setFinalPick(null);
    setFinalStrategy(null);
  };

  const pick = (d: Door) => {
    if (phase !== 'pick') return;
    setPicked(d);
    // 放车 + 主持人开门
    const car = Math.floor(Math.random() * 3) as Door;
    const goatDoors = ([0, 1, 2] as Door[]).filter((x) => x !== d && x !== car);
    const openedDoor = goatDoors[Math.floor(Math.random() * goatDoors.length)];
    setCarDoor(car);
    setOpened(openedDoor);
    setPhase('reveal');
  };

  /** reveal 阶段结算：strategy 标记本轮用哪种策略（random 由按钮内部抛硬币后落地到具体门） */
  const settle = (d: Door, strategy: Strategy) => {
    if (phase !== 'reveal') return;
    setFinalPick(d);
    setFinalStrategy(strategy);
    setPhase('result');
    const won = d === carDoor;
    setManual((prev) => ({
      ...prev,
      [strategy]: [...prev[strategy], { strategy, won }],
    }));
  };

  /** reveal 阶段：stay = 保持原选择；switch = 点另一扇未开的门；random = 抛硬币二选一 */
  const chooseFinal = (d: Door, strategy: Strategy) => {
    if (phase !== 'reveal' || d === opened) return;
    if (strategy !== 'random' && d === picked) return;
    if (strategy === 'random') {
      // 抛硬币：原选择 vs 另一扇未开门
      const other = ([0, 1, 2] as Door[]).find((x) => x !== picked && x !== opened) as Door;
      const coin = Math.random() < 0.5;
      settle(coin ? (picked as Door) : other, 'random');
      return;
    }
    settle(d, strategy);
  };

  /** 批量模拟：每个时间片跑一段，避免阻塞；三种策略各跑 batchTotal 轮。
   *  只做增量计数 + 对数采样曲线点，不保存逐轮记录——百万轮内存 O(采样点) 而非 O(n)。 */
  const runBatch = useCallback(() => {
    cancelRef.current = false;
    setBatch({ switch: { rounds: 0, wins: 0 }, stay: { rounds: 0, wins: 0 }, random: { rounds: 0, wins: 0 } });
    setBatchCurves({ switch: [], stay: [], random: [] });
    setBatchProgress(0);
    setBatchRunning(true);
  }, []);

  useEffect(() => {
    if (!batchRunning) return;
    const CHUNK = 50000; // 每个时间片三种策略各跑 5 万轮（100 万轮约 7 个时间片）
    let done = 0;
    const tally: Record<Strategy, { rounds: number; wins: number }> = {
      switch: { rounds: 0, wins: 0 },
      stay: { rounds: 0, wins: 0 },
      random: { rounds: 0, wins: 0 },
    };
    const curves: Record<Strategy, CurvePoint[]> = { switch: [], stay: [], random: [] };
    // 对数间隔采样：≤100 每 10 轮记一点，之后每个数量级记 10 点
    const sampleAt = (n: number) =>
      n <= 100 ? n % 10 === 0 : n % Math.max(1, 10 ** Math.floor(Math.log10(n) - 1)) === 0;

    const tick = () => {
      if (cancelRef.current) {
        setBatchRunning(false);
        return;
      }
      for (let i = 0; i < CHUNK && done < batchTotal; i += 1) {
        (['switch', 'stay', 'random'] as Strategy[]).forEach((key) => {
          const r = playRound(key);
          tally[key].rounds += 1;
          if (r.won) tally[key].wins += 1;
          const n = tally[key].rounds;
          if (sampleAt(n)) curves[key].push({ n, rate: tally[key].wins / n });
        });
        done += 1;
      }
      setBatch({ switch: { ...tally.switch }, stay: { ...tally.stay }, random: { ...tally.random } });
      setBatchCurves({ switch: [...curves.switch], stay: [...curves.stay], random: [...curves.random] });
      setBatchProgress(done);
      if (done < batchTotal) {
        timerRef.current = window.setTimeout(tick, 0);
      } else {
        setBatchRunning(false);
      }
    };
    timerRef.current = window.setTimeout(tick, 0);
    return () => clearTimeout(timerRef.current);
  }, [batchRunning, batchTotal]);

  // 批量胜率：直接读增量计数；手动战绩仍从逐轮记录统计
  const tallyRate = (t: { rounds: number; wins: number }) => (t.rounds ? t.wins / t.rounds : null);
  const winRate = (records: RoundRecord[]) =>
    records.length ? records.filter((r) => r.won).length / records.length : null;
  const swRate = tallyRate(batch.switch);
  const stRate = tallyRate(batch.stay);
  const rdRate = tallyRate(batch.random);
  const manualSwRate = winRate(manual.switch);
  const manualStRate = winRate(manual.stay);
  const manualRdRate = winRate(manual.random);

  const resetBatch = () => {
    cancelRef.current = true;
    setBatchRunning(false);
    setBatch({ switch: { rounds: 0, wins: 0 }, stay: { rounds: 0, wins: 0 }, random: { rounds: 0, wins: 0 } });
    setBatchCurves({ switch: [], stay: [], random: [] });
    setBatchProgress(0);
  };

  const phaseNote = useMemo(() => {
    if (phase === 'pick') return '选一扇门（1 / 2 / 3）';
    if (phase === 'reveal') {
      const other = ([0, 1, 2] as Door[]).find((d) => d !== picked && d !== opened);
      return `主持人打开了门 ${opened! + 1}（山羊）。坚持、换到门 ${other! + 1}，或者抛硬币？`;
    }
    return { stay: '你坚持了原选择。', switch: '你换了门。', random: '你抛了硬币，听天由命。' }[finalStrategy ?? 'stay'];
  }, [phase, picked, opened, finalStrategy]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation title="三门问题" header={
        <>
          <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-700">
            概率悖论
          </span>
          <span className="font-mono text-sm font-bold tracking-wide text-zinc-900">三门问题</span>
        </>
      } />

      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col gap-5 px-4 pb-10 pt-16 sm:px-6">
        {/* 手动体验区 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">手动体验 (PLAY)</h2>
            <span className="font-mono text-[11px] text-zinc-500">{phaseNote}</span>
            <button
              onClick={startManual}
              className="ml-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-blue-500/50 hover:bg-white hover:text-blue-600"
            >
              重置 (RESET)
            </button>
          </div>

          <div className="flex justify-center gap-3 sm:gap-6">
            {([0, 1, 2] as Door[]).map((d) => (
              <DoorView
                key={d}
                index={d}
                phase={phase}
                picked={phase === 'result' && finalPick !== null ? finalPick : picked}
                opened={opened}
                carDoor={carDoor}
                onPick={phase === 'pick' ? pick : (x) => chooseFinal(x, 'switch')}
                interactive={phase === 'pick' || (phase === 'reveal' && d !== opened && d !== picked)}
              />
            ))}
          </div>

          {/* reveal 阶段给出三个明确动作按钮，避免误点门 */}
          {phase === 'reveal' && picked !== null && opened !== null && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => settle(picked, 'stay')}
                className="rounded-md border border-amber-300 bg-amber-50 px-5 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
              >
                坚持门 {picked + 1}（不换）
              </button>
              {([0, 1, 2] as Door[])
                .filter((d) => d !== picked && d !== opened)
                .map((d) => (
                  <button
                    key={d}
                    onClick={() => settle(d, 'switch')}
                    className="rounded-md border border-blue-500 bg-blue-600 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    换到门 {d + 1}
                  </button>
                ))}
              <button
                onClick={() => chooseFinal(picked as Door, 'random')}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-5 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                🎲 抛硬币随机
              </button>
            </div>
          )}

          {/* 手动累计 */}
          {(manual.switch.length > 0 || manual.stay.length > 0 || manual.random.length > 0) && (
            <div className="mt-5 flex flex-wrap justify-center gap-6 border-t border-zinc-100 pt-4 font-mono text-xs">
              <span className="text-zinc-500">
                换门战绩 <b className="text-blue-600">{manual.switch.filter((r) => r.won).length}</b>/{manual.switch.length}
                {manualSwRate !== null && <span className="text-zinc-400">（{(manualSwRate * 100).toFixed(1)}%）</span>}
              </span>
              <span className="text-zinc-500">
                坚持战绩 <b className="text-amber-600">{manual.stay.filter((r) => r.won).length}</b>/{manual.stay.length}
                {manualStRate !== null && <span className="text-zinc-400">（{(manualStRate * 100).toFixed(1)}%）</span>}
              </span>
              <span className="text-zinc-500">
                抛硬币战绩 <b className="text-emerald-600">{manual.random.filter((r) => r.won).length}</b>/{manual.random.length}
                {manualRdRate !== null && <span className="text-zinc-400">（{(manualRdRate * 100).toFixed(1)}%）</span>}
              </span>
            </div>
          )}
        </section>

        {/* 批量模拟区 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">批量模拟 (MONTE_CARLO)</h2>
            <span className="font-mono text-[11px] text-zinc-500">
              两种策略各跑 N 轮，看频率收敛到哪个数
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-zinc-500">每策略轮数</span>
              {[1000, 10000, 100000, 1000000].map((n) => (
                <button
                  key={n}
                  onClick={() => { setBatchTotal(n); resetBatch(); }}
                  disabled={batchRunning}
                  className={`rounded px-2.5 py-1 font-bold transition-colors disabled:opacity-40 ${
                    batchTotal === n ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {batchRunning ? (
                <button
                  onClick={() => { cancelRef.current = true; }}
                  className="rounded-md bg-amber-100 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-200"
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={runBatch}
                  className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  开始模拟
                </button>
              )}
              <button
                onClick={resetBatch}
                disabled={batchRunning}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
              >
                清零
              </button>
            </div>
          </div>

          {batchProgress > 0 && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full bg-blue-600 transition-[width] duration-150"
                style={{ width: `${(batchProgress / batchTotal) * 100}%` }}
              />
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue-700">换门 (SWITCH)</span>
                <span className="font-mono text-2xl font-black text-blue-600 tabular-nums">
                  {swRate !== null ? `${(swRate * 100).toFixed(2)}%` : '—'}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">
                {batch.switch.rounds.toLocaleString()} 轮 · 理论 2/3 ≈ 66.67%
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700">坚持 (STAY)</span>
                <span className="font-mono text-2xl font-black text-amber-600 tabular-nums">
                  {stRate !== null ? `${(stRate * 100).toFixed(2)}%` : '—'}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">
                {batch.stay.rounds.toLocaleString()} 轮 · 理论 1/3 ≈ 33.33%
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700">抛硬币 (RANDOM)</span>
                <span className="font-mono text-2xl font-black text-emerald-600 tabular-nums">
                  {rdRate !== null ? `${(rdRate * 100).toFixed(2)}%` : '—'}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">
                {batch.random.rounds.toLocaleString()} 轮 · 理论 1/2 = 50%
              </p>
            </div>
          </div>

          {(batch.switch.rounds >= 20 || batch.stay.rounds >= 20 || batch.random.rounds >= 20) && (
            <div className="mt-4">
              <WinRateChart
                curves={[
                  { key: 'switch', color: '#2563eb', points: batchCurves.switch },
                  { key: 'random', color: '#16a34a', points: batchCurves.random },
                  { key: 'stay', color: '#f59e0b', points: batchCurves.stay },
                ]}
              />
              <p className="mt-1 text-center font-mono text-[10px] text-zinc-400">
                横轴为轮数（对数刻度）· 蓝=换门 · 绿=抛硬币 · 琥珀=坚持 · 虚线为理论值
              </p>
            </div>
          )}
        </section>

        {/* 规则说明 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">为什么换门是 2/3 (WHY)</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
            <p>
              关键在于<b className="text-zinc-900">主持人知道答案，并且刻意避开汽车开门</b>——他开门的动作携带信息。
              你最初选中的概率是 1/3，这条信息不会因为主持人开门而改变；
              于是在主持人排除一扇山羊门之后，剩下那扇门集中了全部 2/3 的概率。
            </p>
            <p>
              一个干净的验算：把「不换」的胜率算清楚——只有当初恰好选中的时候不换才赢，概率 1/3。
              其余 2/3 的情况车都在另外两扇门里，而主持人必定帮你把其中是山羊的那扇开掉，
              所以「换门」恰好把这两种情形全部转化为胜利：2/3。
            </p>
            <p>
              「抛硬币」策略恰好是两者的混合：一半概率坚持（赢 1/3 × 1/2），一半概率换门（赢 2/3 × 1/2），
              合计 <b className="text-emerald-700">1/2</b>——比坚持好、比换门差，也印证了「换门多出来的那 1/6 优势」真实存在。
            </p>
            <p className="text-zinc-500">
              直觉陷阱在于把主持人开门当成等价于随机开一扇门（那才是 1/2 vs 1/2）。上面的批量模拟可以亲手验证：
              轮数越多，三条频率线越紧贴 2/3、1/2 与 1/3。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
