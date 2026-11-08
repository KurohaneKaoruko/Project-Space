'use client';

import { useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';

/** 数字/字母与值的双向映射：0-9 用数字，10-35 用 A-Z */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 把非负 BigInt 写成 toBase 进制字符串（toBase 2~36） */
function bigintToBase(value: bigint, toBase: number): string {
  if (value === 0n) return '0';
  const digits: string[] = [];
  const b = BigInt(toBase);
  let v = value;
  while (v > 0n) {
    digits.push(DIGITS[Number(v % b)]);
    v /= b;
  }
  return digits.reverse().join('');
}

/** 解析 fromBase 进制字符串为 BigInt；非法字符返回 null */
function parseInBase(text: string, fromBase: number): bigint | null {
  const t = text.trim().toUpperCase().replace(/[\s_]/g, '');
  if (!t) return null;
  const b = BigInt(fromBase);
  let v = 0n;
  for (const ch of t) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= fromBase) return null;
    v = v * b + BigInt(d);
  }
  return v;
}

/** 常用进制快捷项 */
const QUICK_BASES = [2, 8, 10, 16, 32, 36];

/** 每组位数（按进制选习惯分组：二进制 4 位一组，其他 4~5 位） */
const groupSpacing = (base: number) => (base === 2 ? 4 : base <= 16 ? 4 : 5);

/** 每 groupSize 位插一个窄空格，方便读长串 */
function groupDigits(s: string, groupSize: number): string {
  const cleaned = s.replace(/[\u2009_]/g, '');
  const parts: string[] = [];
  for (let i = cleaned.length; i > 0; i -= groupSize) parts.unshift(cleaned.slice(Math.max(0, i - groupSize), i));
  return parts.join('\u2009');
}

export default function BaseConverterPage() {
  /** 输入进制 / 输出进制（同一套 2~36） */
  const [fromBase, setFromBase] = useState(10);
  const [toBase, setToBase] = useState(2);
  /** 用户输入的源进制文本 */
  const [input, setInput] = useState('2026');

  const parsed = useMemo(() => parseInBase(input, fromBase), [input, fromBase]);
  const invalid = input.trim() !== '' && parsed === null;
  const output = parsed === null ? '' : bigintToBase(parsed, toBase);

  /** 负数与小数不支持的提示（保持工具聚焦整数） */
  const hasMinus = input.trim().startsWith('-');
  const hasDot = input.includes('.');

  /** 1/2/4/8 字节对齐的二进制位分组（只在源值为整数且较小时展示） */
  const bitGroups = useMemo(() => {
    if (parsed === null || parsed < 0n || parsed > 0xffffffffn) return null;
    const bins = [8, 16, 32, 64]
      .filter((bits) => bits <= 64)
      .map((bits) => ({
        bits,
        text: groupDigits(parsed.toString(2).padStart(bits, '0'), 8),
      }));
    return bins;
  }, [parsed]);

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <main className="min-h-screen bg-zinc-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <Navigation title="BASE CONVERTER" />

      <div className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto w-full max-w-[1000px] space-y-8">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-blue-600" />
              <h1 className="text-3xl font-black text-zinc-900 tracking-tight">进制转换</h1>
              <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 rounded">TOOL</span>
            </div>
            <p className="text-sm text-zinc-500 font-mono max-w-3xl">
              {'/// 2~36 进制互转，BigInt 精度无位数上限，实时双向换算。'}
            </p>
          </header>

          {/* 转换主卡 */}
          <section className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-xl p-6 shadow-xl shadow-zinc-200/40 space-y-6">
            {/* 源 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">输入 (FROM)</span>
                <span className="font-mono text-[10px] text-zinc-400">base {fromBase}</span>
                {QUICK_BASES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setFromBase(b)}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
                      fromBase === b ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
                {/* 交换方向 */}
                <button
                  onClick={() => {
                    setFromBase(toBase);
                    setToBase(fromBase);
                    if (parsed !== null) setInput(bigintToBase(parsed, toBase));
                  }}
                  className="ml-auto px-2.5 py-1 text-[10px] font-mono font-bold text-zinc-500 border border-zinc-200 rounded hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  ⇄ 交换
                </button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                spellCheck={false}
                placeholder={`输入 ${fromBase} 进制整数（支持空格/下划线分组）`}
                className="w-full p-4 bg-zinc-950 text-zinc-100 font-mono text-lg rounded-lg border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/60 resize-none"
              />
              <div className="min-h-[16px] text-[11px] font-mono">
                {invalid && <span className="text-red-600">✗ 含 {fromBase} 进制外的字符（合法：0-9 / A-Z 中前 {fromBase} 个）</span>}
                {hasMinus && <span className="text-amber-600">⚠ 暂不支持负数，已忽略符号</span>}
                {hasDot && <span className="text-amber-600">⚠ 暂不支持小数，已截断小数部分</span>}
                {parsed !== null && !invalid && (
                  <span className="text-zinc-400">
                    十进制位数 {bigintToBase(parsed, 10).length} · bit 长度 {parsed.toString(2).length}
                  </span>
                )}
              </div>
            </div>

            {/* 目标 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">输出 (TO)</span>
                <span className="font-mono text-[10px] text-zinc-400">base {toBase}</span>
                {QUICK_BASES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setToBase(b)}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
                      toBase === b ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
                <span className="ml-auto text-[10px] font-mono text-zinc-400">分组 {groupSpacing(toBase)} 位</span>
              </div>
              <div className="relative">
                <div
                  className={`w-full min-h-[64px] p-4 font-mono text-lg rounded-lg border break-all whitespace-pre-wrap ${
                    parsed === null ? 'bg-zinc-50 text-zinc-300 border-zinc-200' : 'bg-emerald-50/60 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {parsed === null ? '—' : groupDigits(output, groupSpacing(toBase))}
                </div>
                {parsed !== null && (
                  <button
                    onClick={() => copy(output)}
                    className="absolute right-2 top-2 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 bg-white/80 border border-emerald-200 rounded hover:bg-emerald-100"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 常用进制一览 */}
          <section className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-xl p-6 shadow-xl shadow-zinc-200/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">常用进制一览</div>
              <div className="text-[10px] font-mono text-zinc-500">DEC · HEX · OCT · BIN · 32 · 36</div>
            </div>
            {parsed === null ? (
              <p className="text-xs font-mono text-zinc-400">输入合法数字后，这里同时列出 2/8/10/16/32/36 六种进制表示。</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {QUICK_BASES.map((b) => {
                  const text = bigintToBase(parsed, b);
                  return (
                    <div key={b} className="flex items-baseline gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2">
                      <span className={`shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        b === 10 ? 'bg-blue-100 text-blue-700' : b === 16 ? 'bg-violet-100 text-violet-700' : 'bg-zinc-200 text-zinc-600'
                      }`}>
                        base {b}
                      </span>
                      <span className="font-mono text-sm text-zinc-800 break-all">{groupDigits(text, groupSpacing(b))}</span>
                      <button
                        onClick={() => copy(text)}
                        className="ml-auto shrink-0 text-[10px] font-mono text-zinc-400 hover:text-blue-600"
                      >
                        复制
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 二进制位宽视图 */}
          <section className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-xl p-6 shadow-xl shadow-zinc-200/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">位宽视图 (BIT GROUPS)</div>
              <div className="text-[10px] font-mono text-zinc-500">8 / 16 / 32 / 64-bit 补零对齐</div>
            </div>
            {bitGroups ? (
              <div className="space-y-2">
                {bitGroups.map(({ bits, text }) => (
                  <div key={bits} className="flex items-baseline gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-zinc-500 w-14">{bits}-bit</span>
                    <span className="font-mono text-sm text-zinc-800 break-all">{text}</span>
                  </div>
                ))}
                <p className="text-[10px] font-mono text-zinc-400">
                  每 8 位一组，便于对照字节边界；超过 64 位的整数请直接看上面的 base 2 输出。
                </p>
              </div>
            ) : (
              <p className="text-xs font-mono text-zinc-400">输入合法整数且不超过 2⁶⁴-1 时，这里展示按字节对齐的二进制分组。</p>
            )}
          </section>

          {/* 说明 */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">说明 (NOTES)</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
              <p>
                进制范围 <b className="text-zinc-900">2 ~ 36</b>：数字用 0-9，超过 10 的位用字母 A-Z（大小写等价），
                与 <code className="font-mono text-[12px] bg-zinc-100 px-1 rounded">parseInt(s, base)</code> / Java <code className="font-mono text-[12px] bg-zinc-100 px-1 rounded">Integer.toString</code> 的约定一致。
              </p>
              <p>
                内部用 <b className="text-zinc-900">BigInt</b> 计算，没有 2⁵³ 的精度墙——可以转几百位的数。
                输入里的空格和下划线会被忽略，方便粘贴带分组的串。
              </p>
              <p>
                「⇄ 交换」把当前输出进制变成输入进制、输入内容也随之切换为结果串，相当于以结果为新的源继续转。
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
