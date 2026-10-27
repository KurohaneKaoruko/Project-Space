'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import type { Challenge, PoWBlock, PoWStats, SoloStats, Solution } from './simulation';
import { PoWMiner, SoloPoW, SoloPoW as SoloEngine } from './simulation';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

const DIFF_PRESETS = [
  { bits: 8, label: '入门 8' },
  { bits: 12, label: '简单 12' },
  { bits: 16, label: '标准 16' },
  { bits: 20, label: '困难 20' },
  { bits: 24, label: '极难 24' },
];

const SOLO_PRESET_MSGS = ['转账: Alice → Bob 10 BTC', '合约调用: mint(#1024)', '记录: 今日登录日志', '随机数据: 0x3fa2'];

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtRate = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GH/s` : n >= 1e6 ? `${(n / 1e6).toFixed(2)} MH/s` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} kH/s` : `${n.toFixed(0)} H/s`;

/** 哈希字符串按前导 0 上色 */
const HashText = ({ hash, maxLen = 64 }: { hash: string; maxLen?: number }) => {
  const h = hash.slice(0, maxLen);
  const zeros = h.match(/^0*/)?.[0].length ?? 0;
  return (
    <span className="font-mono break-all">
      {zeros > 0 && <span className="text-emerald-600 font-bold">{h.slice(0, zeros)}</span>}
      <span className="text-zinc-600">{h.slice(zeros)}</span>
    </span>
  );
};

type Mode = 'single' | 'chain';

export default function PowSimPage() {
  const [mode, setMode] = useState<Mode>('single');

  return (
    <div className="h-screen overflow-hidden bg-zinc-50">
      <Navigation title="POW_SIMULATOR" />
      <div className="h-full flex flex-col max-w-[1800px] mx-auto px-4 sm:px-6 pt-3 pb-4 gap-2.5">
        {/* 模式切换 */}
        <div className={`${PANEL} shrink-0 p-1.5 flex gap-1 w-fit`}>
          {(
            [
              ['single', '单次 PoW'],
              ['chain', '区块链模式'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-lg font-bold text-xs transition-colors ${
                mode === m ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          {mode === 'single' ? <SingleMode /> : <ChainMode />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* 单次 PoW 模式：服务器下发题目 -> 矿工跑 hash -> 服务器验证        */
/* ================================================================ */

function SingleMode() {
  const soloRef = useRef<SoloPoW | null>(null);
  if (!soloRef.current) soloRef.current = new SoloPoW();
  const solo = soloRef.current;

  const [stats, setStats] = useState<SoloStats | null>(null);
  const [msgDraft, setMsgDraft] = useState(SOLO_PRESET_MSGS[0]);
  const [diffDraft, setDiffDraft] = useState(12);

  useEffect(() => {
    solo.setOnFrame(setStats);
    setStats(solo.getStats());
    return () => solo.stop();
  }, [solo]);

  const ch = stats?.challenge ?? null;
  const solved = stats?.solved ?? null;
  const verdict = useMemo(
    () => (ch && solved ? SoloEngine.verifySolution(ch, solved) : null),
    [ch, solved],
  );

  const issue = () => {
    solo.issueChallenge(msgDraft.trim() || '默认消息', diffDraft);
  };

  const progress = stats && ch ? Math.min(100, ((stats.bestBits + 1) / ch.difficulty) * 100) : 0;

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
      {/* 左：服务器 */}
      <div className={`${PANEL} p-4 flex flex-col gap-3 min-h-0 overflow-y-auto`}>
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-mono text-zinc-400 tracking-[0.25em] uppercase">Server · 服务器</div>
          <div className="font-mono text-[10px] text-zinc-400">
            {ch ? (
              <>
                题目 <span className="text-zinc-900 font-bold">#{ch.id}</span>
                <span className="text-zinc-300"> · </span>
                {new Date(ch.issuedAt).toLocaleTimeString()}
              </>
            ) : (
              '尚未下发题目'
            )}
          </div>
        </div>

        {/* 设置题目 */}
        <div className="space-y-2.5">
          <div>
            <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1">打包消息</div>
            <input
              value={msgDraft}
              onChange={(e) => setMsgDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && issue()}
              className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {SOLO_PRESET_MSGS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMsgDraft(m)}
                  className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors truncate max-w-[180px] ${
                    msgDraft === m ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
              <span>难度（前导 0 位数）</span>
              <span className="text-zinc-700 font-bold">
                {diffDraft} bit · 期望 ~{fmt(2 ** diffDraft)} 次
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={24}
              value={diffDraft}
              onChange={(e) => setDiffDraft(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="grid grid-cols-5 gap-1 mt-1.5">
              {DIFF_PRESETS.map((d) => (
                <button
                  key={d.bits}
                  onClick={() => setDiffDraft(d.bits)}
                  className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                    diffDraft === d.bits
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={issue}
            className="w-full px-4 py-2 rounded-md font-bold text-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {ch ? '下发新题目' : '下发题目'}
          </button>
        </div>

        {/* 服务器收到的解 & 验证 */}
        {ch && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 font-mono text-xs">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">challenge</div>
            <div className="break-all text-zinc-600">
              <span className="text-zinc-400">消息 </span>
              {ch.message}
            </div>
            <div className="text-zinc-600">
              <span className="text-zinc-400">难度 </span>
              {ch.difficulty} bit（前导 0）
            </div>
            <div className="break-all text-zinc-600">
              <span className="text-zinc-400">待哈希头 </span>
              {`${ch.message}|${ch.issuedAt}|`}
              <span className="text-blue-600 font-bold">{stats?.nonce ? fmt(stats.nonce) : 'nonce…'}</span>
            </div>
          </div>
        )}

        {/* 验证结果 */}
        {solved && verdict && (
          <div
            className={`rounded-lg border p-3 space-y-1.5 ${
              verdict.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className={`font-mono text-sm font-bold ${verdict.valid ? 'text-emerald-700' : 'text-red-700'}`}>
              {verdict.valid ? '✓ 服务器验证通过' : '✗ 服务器拒绝'}
            </div>
            <div className="font-mono text-[11px] text-zinc-600">{verdict.detail}</div>
            <div className="font-mono text-[11px] text-zinc-500">
              矿工耗时 {(solved.elapsedMs / 1000).toFixed(2)}s · {fmt(solved.attempts)} 次尝试 · nonce ={' '}
              {fmt(solved.nonce)}
            </div>
          </div>
        )}

        {/* 历史回合 */}
        {stats && stats.rounds.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">历史回合</div>
            {stats.rounds.map((r) => (
              <div
                key={r.seq}
                className="flex items-center justify-between px-3 py-1.5 rounded-md bg-zinc-50 border border-zinc-100 font-mono text-[11px]"
              >
                <span className="text-zinc-500">
                  #{r.seq} · {r.challenge.message.slice(0, 14)} · {r.challenge.difficulty}bit
                </span>
                <span className={r.valid ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                  {r.valid ? '✓ 通过' : '✗ 失败'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右：矿工 */}
      <div className={`${PANEL} p-4 flex flex-col gap-3 min-h-0 overflow-y-auto`}>
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-mono text-zinc-400 tracking-[0.25em] uppercase">Miner · 矿工</div>
          <div className="font-mono text-xs text-zinc-400">
            {stats?.running ? <span className="text-emerald-600">● 计算 nonce 中</span> : solved ? '○ 已提交' : '○ 待命'}
          </div>
        </div>

        {/* 当前哈希大屏 */}
        <div className="rounded-lg bg-zinc-950 p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              {ch ? `Challenge #${ch.id} · SHA-256` : '等待服务器下发题目'}
            </span>
            <span className="font-mono text-[10px] text-zinc-500">
              nonce <span className="text-zinc-300">{fmt(stats?.nonce ?? 0)}</span>
            </span>
          </div>
          <div className="text-sm leading-relaxed" style={{ wordBreak: 'break-all' }}>
            <HashText hash={stats?.currentHash ?? '0'.repeat(64)} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-zinc-400 shrink-0">
              最佳 <span className="text-emerald-400 font-bold">{Math.max(0, stats?.bestBits ?? 0)} bit</span>
              {ch ? <span className="text-zinc-500"> / {ch.difficulty}</span> : null}
            </span>
          </div>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Hashrate</div>
            <div className="font-mono font-bold text-zinc-900 tabular-nums">{fmtRate(stats?.hashRate ?? 0)}</div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">尝试次数</div>
            <div className="font-mono font-bold text-zinc-900 tabular-nums">{fmt(stats?.attempts ?? 0)}</div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">期望次数</div>
            <div className="font-mono font-bold text-zinc-900 tabular-nums">
              ~{fmt(stats?.expected ?? 0)}
            </div>
          </div>
        </div>

        {/* 操作 */}
        <div className="flex gap-2">
          <button
            onClick={() => (stats?.running ? solo.stop() : solo.start())}
            disabled={!ch || !!solved}
            className="flex-1 px-4 py-2.5 rounded-md font-bold text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            {stats?.running ? '暂停' : solved ? '已找到解' : '开始计算'}
          </button>
          <button
            onClick={() => solo.reset()}
            className="px-4 py-2.5 rounded-md font-bold text-sm bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors"
          >
            清空
          </button>
        </div>

        {/* 哈希滚动流 */}
        {stats && stats.recent.length > 0 && (
          <div className="space-y-0.5 font-mono text-[10px] leading-tight opacity-70">
            {stats.recent.map((h, i) => (
              <div key={`${i}-${h.slice(0, 8)}`} className="truncate">
                <span className="text-zinc-300 select-none">│ </span>
                <HashText hash={h} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ */
/* 区块链模式                                                        */
/* ================================================================ */

function ChainMode() {
  const minerRef = useRef<PoWMiner | null>(null);
  if (!minerRef.current) minerRef.current = new PoWMiner();
  const miner = minerRef.current;

  const [stats, setStats] = useState<PoWStats | null>(null);
  const [difficulty, setDifficulty] = useState(12);
  const [draft, setDraft] = useState('Alice → Bob: 3 BTC');
  const [chainTick, setChainTick] = useState(0);
  const [verifyResult, setVerifyResult] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    miner.setOnFrame((s) => {
      setStats(s);
      if (s.version !== versionRef.current) {
        versionRef.current = s.version;
        setChainTick((t) => t + 1);
      }
    });
    setStats(miner.getStats());
    setDifficulty(miner.getDifficulty());
    versionRef.current = miner.getStats().version;
    return () => miner.stop();
  }, [miner]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- chainTick 是手动刷新信号
  const chain = useMemo<PoWBlock[]>(() => miner.chain.slice().reverse(), [chainTick]);

  const applyDifficulty = (bits: number) => {
    setDifficulty(bits);
    miner.setAuto(false);
    miner.setDifficulty(bits);
    setVerifyResult(null);
  };
  const toggleAuto = () => {
    miner.setAuto(!miner.auto);
    setDifficulty(miner.getDifficulty());
    setVerifyResult(null);
  };
  const applyMessage = () => {
    miner.setAuto(false);
    miner.setMessage(draft);
    setVerifyResult(null);
  };
  const doVerify = () => setVerifyResult(miner.verify());

  const auto = stats?.auto ?? true;
  const progress = stats ? Math.min(100, ((stats.bestBits + 1) / stats.difficultyBits) * 100) : 0;

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
      {/* 左：矿机 */}
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        <div className={`${PANEL} p-4`}>
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-mono text-zinc-400 tracking-[0.25em] uppercase">Miner · 求解器</div>
            <div className="font-mono text-xs text-zinc-400">
              {stats?.running ? <span className="text-emerald-600">● 运行中</span> : '○ 待机'}
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-zinc-950 p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Block #{stats?.nextHeight ?? 0} · SHA-256
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                nonce <span className="text-zinc-300">{fmt(stats?.nonce ?? 0)}</span>
              </span>
            </div>
            <div className="text-sm leading-relaxed" style={{ wordBreak: 'break-all' }}>
              <HashText hash={stats?.currentHash ?? '0'.repeat(64)} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                最佳 <span className="text-emerald-400 font-bold">{Math.max(0, stats?.bestBits ?? 0)} bit</span> /{' '}
                {stats?.difficultyBits ?? 0}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Hashrate</div>
              <div className="font-mono font-bold text-zinc-900 tabular-nums">{fmtRate(stats?.hashRate ?? 0)}</div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">尝试次数</div>
              <div className="font-mono font-bold text-zinc-900 tabular-nums">{fmt(stats?.attempts ?? 0)}</div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg py-2.5">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">期望次数</div>
              <div className="font-mono font-bold text-zinc-900 tabular-nums">~{fmt(2 ** (stats?.difficultyBits ?? 0))}</div>
            </div>
          </div>
        </div>

        <div className={`${PANEL} p-4 space-y-3`}>
          <div className="flex gap-2">
            <button
              onClick={() => (stats?.running ? miner.stop() : miner.start())}
              className={`flex-1 px-4 py-2.5 rounded-md font-bold text-sm border transition-colors ${
                stats?.running
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {stats?.running ? '暂停' : '开始'}
            </button>
            <button
              onClick={() => {
                miner.reset();
                setDifficulty(miner.getDifficulty());
                setVerifyResult(null);
                setExpanded(null);
              }}
              className="px-4 py-2.5 rounded-md font-bold text-sm bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors"
            >
              重置
            </button>
          </div>

          {/* 自动 / 手动 难度 */}
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">难度模式</div>
            <div className="flex gap-1">
              <button
                onClick={() => !auto && toggleAuto()}
                className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${
                  auto ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                }`}
              >
                自动（服务器调节）
              </button>
              <button
                onClick={() => auto && toggleAuto()}
                className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${
                  !auto ? 'bg-zinc-900 text-white border-zinc-900 font-bold' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                }`}
              >
                手动
              </button>
            </div>
          </div>

          {auto ? (
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">目标出块间隔</span>
                <span className="text-zinc-800 font-bold">{((stats?.targetBlockMs ?? 3000) / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">当前难度</span>
                <span className="text-zinc-800 font-bold">
                  {stats?.difficultyBits ?? difficulty} bit · 期望 ~{fmt(2 ** (stats?.difficultyBits ?? difficulty))} 次
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">上一块耗时</span>
                <span className="text-zinc-800 font-bold">
                  {stats && stats.lastBlockMs > 0 ? `${(stats.lastBlockMs / 1000).toFixed(1)}s` : '—'}
                </span>
              </div>
              {stats && stats.difficultyLog.length > 0 && (
                <div className="pt-1 border-t border-zinc-200 font-mono text-[10px] text-zinc-500">
                  最新调整：#{stats.difficultyLog[stats.difficultyLog.length - 1].at} 块 {stats.difficultyLog[stats.difficultyLog.length - 1].from}→
                  {stats.difficultyLog[stats.difficultyLog.length - 1].to} bit（{stats.difficultyLog[stats.difficultyLog.length - 1].reason}）
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">
                <span>难度（前导 0 位数）</span>
                <span className="text-zinc-700 font-bold">
                  {difficulty} bit · 期望 ~{fmt(2 ** difficulty)} 次
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={28}
                value={difficulty}
                onChange={(e) => applyDifficulty(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="grid grid-cols-5 gap-1 mt-2">
                {DIFF_PRESETS.map((d) => (
                  <button
                    key={d.bits}
                    onClick={() => applyDifficulty(d.bits)}
                    className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                      difficulty === d.bits
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {auto ? (
            <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
              自动模式：每出一块，服务器随机生成新消息（显示在右侧区块链中），并按出块速度自动调节难度（目标 3s/块，每块最多 ±1 bit）。
              <button onClick={toggleAuto} className="text-blue-600 hover:underline font-bold ml-1">
                改为手动
              </button>
            </p>
          ) : (
            <div>
              <div className="flex justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">
                <span>区块消息（写入交易内容）</span>
                <button onClick={toggleAuto} className="text-blue-600 hover:underline font-bold">
                  改为自动随机
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyMessage()}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={applyMessage}
                  className="px-3 py-2 rounded-md font-bold text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors"
                >
                  应用
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-1">
                应用后从当前高度重新计算（消息变了，哈希自然全变）。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 右：区块链 */}
      <div className={`${PANEL} p-4 flex flex-col min-h-0`}>
        <div className="flex items-center justify-between shrink-0">
          <div className="text-[10px] font-mono text-zinc-400 tracking-[0.25em] uppercase">
            Blockchain · 区块链
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-zinc-400">
              高度 <span className="text-zinc-900 font-bold">{stats?.chainLength ?? 0}</span>
            </span>
            <button
              onClick={doVerify}
              className="px-3 py-1.5 rounded-md font-bold text-xs bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:border-blue-500/50 transition-colors"
            >
              校验整链
            </button>
          </div>
        </div>

        {verifyResult !== null && (
          <div
            className={`mt-3 shrink-0 px-3 py-2 rounded-md font-mono text-xs font-bold border ${
              verifyResult === -1
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {verifyResult === -1
              ? '✓ 整条链校验通过：所有哈希与前向链接均有效'
              : `✗ 第 ${verifyResult} 块无效（哈希不匹配或链接断裂）——再次运行将自动重新计算此块`}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
          {chain.length === 0 && (
            <div className="h-full flex items-center justify-center text-zinc-300 font-mono text-sm">
              还没有区块 —— 点「开始」计算创世块
            </div>
          )}
          {chain.map((b, idx) => {
            const isFirst = idx === chain.length - 1;
            const invalid = verifyResult !== -1 && verifyResult === b.height;
            const bad = b.tampered || invalid;
            const open = expanded === b.height;
            return (
              <div key={`${b.height}-${b.hash.slice(0, 12)}`}>
                <button
                  onClick={() => setExpanded(open ? null : b.height)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    bad
                      ? 'bg-red-50/70 border-red-200 hover:bg-red-50'
                      : 'bg-white border-zinc-200 hover:border-blue-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                          bad ? 'bg-red-500 text-white' : isFirst ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-white'
                        }`}
                      >
                        {b.height}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                          <span className="shrink-0">{b.height === 0 ? '创世块 Genesis' : `区块 #${b.height}`}</span>
                          {b.tampered && <span className="text-[10px] font-mono text-red-600">已篡改</span>}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-600 truncate" title={b.tampered ? `${b.message} [已篡改]` : b.message}>
                          {b.tampered ? `${b.message} [已篡改]` : b.message}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {fmt(b.attempts)} 次尝试 · {(b.elapsedMs / 1000).toFixed(1)}s · {b.difficulty} bit
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-zinc-300">{open ? '收起 −' : '详情 +'}</div>
                  </div>
                  <div className="mt-2.5 font-mono text-[11px]" style={{ wordBreak: 'break-all' }}>
                    <HashText hash={b.hash} maxLen={44} />
                  </div>
                  {bad && (
                    <div className="mt-2 text-[10px] font-mono text-red-600 font-bold">
                      ⚠ 重算哈希 ≠ 存储哈希
                    </div>
                  )}
                </button>

                {open && (
                  <div className="mt-1.5 mx-2 rounded-lg bg-zinc-950 p-4 space-y-2 font-mono text-[11px]">
                    <div>
                      <span className="text-zinc-500">消息 </span>
                      <span className="text-zinc-200">{b.tampered ? `${b.message} [已篡改]` : b.message}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">时间戳 </span>
                      <span className="text-zinc-200">{new Date(b.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="break-all">
                      <span className="text-zinc-500">prevHash </span>
                      <span className="text-zinc-200">{b.prevHash.slice(0, 32)}…</span>
                    </div>
                    <div className="break-all">
                      <span className="text-zinc-500">nonce </span>
                      <span className="text-zinc-200">{fmt(b.nonce)}</span>
                    </div>
                    <div className="break-all pt-1 border-t border-white/10">
                      <span className="text-zinc-500">重算哈希 </span>
                      <HashText hash={miner.recomputeHash(b.height)} maxLen={48} />
                    </div>
                    <div className="break-all">
                      <span className="text-zinc-500">存储哈希 </span>
                      <HashText hash={b.hash} maxLen={48} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        miner.tamper(b.height);
                        doVerify();
                      }}
                      className="mt-1 px-3 py-1.5 rounded font-bold text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                    >
                      {b.tampered ? '还原此块' : '模拟篡改此块'}
                    </button>
                  </div>
                )}
                {!isFirst && <div className="flex justify-center py-0.5 text-zinc-300 select-none">│</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

