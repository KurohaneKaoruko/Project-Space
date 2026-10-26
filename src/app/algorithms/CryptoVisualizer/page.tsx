'use client';

import { useEffect, useMemo, useState } from 'react';
import Navigation from '../../components/Navigation';
import {
  CRYPTO_ALGORITHMS,
  CryptoError,
  getCryptoAlgorithm,
  type CryptoVisual,
  type CryptoMode,
} from './cryptoAlgorithms';

const ALGO_GROUPS = Array.from(new Set(CRYPTO_ALGORITHMS.map((a) => a.group)));

export default function CryptoVisualizerPage() {
  const [algoId, setAlgoId] = useState('caesar');
  const [mode, setMode] = useState<CryptoMode>('encrypt');
  const [input, setInput] = useState(CRYPTO_ALGORITHMS[0].inputDefault);
  const [key, setKey] = useState(CRYPTO_ALGORITHMS[0].keyDefault ?? '');
  const [seed, setSeed] = useState(42);
  const [hexInput, setHexInput] = useState(false);
  const [hexKey, setHexKey] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);

  const meta = getCryptoAlgorithm(algoId);

  // 切换算法时恢复该算法的默认演示参数
  useEffect(() => {
    const m = getCryptoAlgorithm(algoId);
    setInput(m.inputDefault);
    setKey(m.keyDefault ?? '');
    setMode('encrypt');
    setHexInput(false);
    setHexKey(false);
    setSeed(42);
  }, [algoId]);

  const run = useMemo(() => {
    try {
      return { ok: true as const, run: meta.run({ input, key, seed, mode, hexInput, hexKey }) };
    } catch (e) {
      return { ok: false as const, error: e instanceof CryptoError ? e.message : '演示参数无效' };
    }
  }, [meta, input, key, seed, mode, hexInput, hexKey]);

  // 参数变化后回到第一步并停止播放
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [run]);

  // 自动播放
  useEffect(() => {
    if (!playing || !run.ok) return;
    const total = run.run.steps.length;
    const timer = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, total - 1));
    }, Math.max(120, 1000 / speed));
    return () => window.clearInterval(timer);
  }, [playing, run, speed]);

  useEffect(() => {
    if (playing && run.ok && stepIndex >= run.run.steps.length - 1) setPlaying(false);
  }, [playing, run, stepIndex]);

  const applyResult = () => {
    if (!run.ok) return;
    setInput(run.run.result);
    setMode(mode === 'encrypt' ? 'decrypt' : 'encrypt');
    // 切到解密时输入是 HEX 密文；切回加密时结果已还原为文本
    if (meta.hexToggle) setHexInput(mode === 'encrypt');
  };

  const steps = run.ok ? run.run.steps : [];
  const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 flex flex-col">
      <Navigation title="CRYPTO_VISUALIZER" />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* 演示区：lg 下列高锁定为容器高，卡片作为唯一弹性元素吸收/让出空间，控制区始终可见 */}
        <div className="flex-1 min-h-0 bg-zinc-950 overflow-y-auto lg:overflow-hidden">
          <div className="min-h-full lg:h-full w-full max-w-4xl mx-auto p-5 lg:px-10 lg:py-6 flex flex-col gap-4">
            {!run.ok ? (
              <div className="my-auto bg-zinc-900 border border-rose-500/40 rounded-xl p-6">
                <div className="text-rose-400 font-bold text-sm font-mono uppercase mb-2">参数无效</div>
                <p className="text-zinc-300 text-sm">{run.error}</p>
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                    {meta.name} · 步骤 {stepIndex + 1}/{steps.length}
                  </div>
                  <h2 className="text-xl font-bold text-zinc-100 mt-1">{step.title}</h2>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{step.detail}</p>
                </div>

                <div className="grow shrink min-h-[160px] bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex overflow-auto">
                  <div className="m-auto w-full flex justify-center">
                    <VisualView visual={step.visual} />
                  </div>
                </div>

                {/* 步骤进度 */}
                <div className="shrink-0 space-y-2">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-[width] duration-200"
                      style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setStepIndex(i)}
                        className={`w-6 h-6 shrink-0 text-[10px] font-mono rounded transition-colors ${
                          i === stepIndex
                            ? 'bg-cyan-500 text-zinc-950 font-bold'
                            : i < stepIndex
                              ? 'bg-zinc-800 text-cyan-400 hover:bg-zinc-700'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 播放控制 */}
                <div className="shrink-0 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setStepIndex(0);
                      setPlaying(false);
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-md text-xs font-bold hover:bg-zinc-700 transition-colors"
                  >
                    ↺ 重置
                  </button>
                  <button
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    disabled={stepIndex === 0}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-md text-xs font-bold hover:bg-zinc-700 transition-colors disabled:opacity-40"
                  >
                    ◀ 上一步
                  </button>
                  <button
                    onClick={() => setPlaying((v) => !v)}
                    className="px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-md text-xs font-bold hover:bg-cyan-500/30 transition-colors"
                  >
                    {playing ? '⏸ 暂停' : '▶ 自动播放'}
                  </button>
                  <button
                    onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                    disabled={stepIndex >= steps.length - 1}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-md text-xs font-bold hover:bg-zinc-700 transition-colors disabled:opacity-40"
                  >
                    下一步 ▶
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">速度</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={speed}
                      onChange={(e) => setSpeed(parseInt(e.target.value))}
                      className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-[10px] font-mono text-zinc-400">{speed}x</span>
                  </div>
                </div>
              </>
            )}

            {/* 输出结果 */}
            {run.ok && (
              <div className="shrink-0 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">{run.run.resultLabel}</div>
                  <div className="font-mono text-emerald-300 font-bold mt-1 break-all">{run.run.result || '(空)'}</div>
                </div>
                {meta.type === 'cipher' && (
                  <button
                    onClick={applyResult}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-md text-xs font-bold hover:bg-zinc-700 transition-colors"
                  >
                    {mode === 'encrypt' ? '填入并解密 ↓' : '填入并加密 ↑'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 控制面板 */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col lg:h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-500"></span>
                控制面板
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{'/// 加密算法可视化'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-500 uppercase">算法 ({CRYPTO_ALGORITHMS.length} 种)</label>
              <select
                value={algoId}
                onChange={(e) => setAlgoId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {ALGO_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {CRYPTO_ALGORITHMS.filter((a) => a.group === group).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.en})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {meta.type === 'cipher' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">方向</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['encrypt', 'decrypt'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-2 rounded text-xs font-bold transition-colors ${
                        mode === m
                          ? m === 'encrypt'
                            ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {m === 'encrypt' ? '加密 →' : '← 解密'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {meta.inputMax > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-500 uppercase">{meta.inputLabel}</label>
                <input
                  value={input}
                  maxLength={meta.inputMax}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={mode === 'decrypt' && meta.id === 'rsa' ? '例如 855 263 431' : ''}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-mono text-zinc-900 focus:outline-none focus:border-blue-500"
                />
                {meta.hexToggle && (
                  <HexToggle checked={hexInput} onChange={setHexInput} label="输入按 HEX 解析" />
                )}
              </div>
            )}

            {meta.keyKind === 'shift' && (
              <ControlSlider label={meta.keyLabel ?? '移位量'} value={Math.round(Number(key)) || 0} min={0} max={25} step={1} onChange={(v) => setKey(String(v))} />
            )}
            {meta.keyKind === 'rails' && (
              <ControlSlider label={meta.keyLabel ?? '导轨数'} value={Math.round(Number(key)) || 3} min={2} max={6} step={1} onChange={(v) => setKey(String(v))} />
            )}
            {meta.keyKind === 'keyword' && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-500 uppercase">{meta.keyLabel}</label>
                <input
                  value={key}
                  maxLength={16}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-mono text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            {meta.keyKind === 'key' && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-500 uppercase">{meta.keyLabel}</label>
                <input
                  value={key}
                  maxLength={meta.id === 'aes' ? 48 : 32}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-mono text-zinc-900 focus:outline-none focus:border-blue-500"
                />
                {meta.hexToggle && <HexToggle checked={hexKey} onChange={setHexKey} label="密钥按 HEX 解析" />}
              </div>
            )}

            {meta.keyKind === 'none' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  {meta.id === 'rsa' ? '密钥对' : '交换参数'}
                </div>
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                  className="w-full px-3 py-2 bg-cyan-50 text-cyan-700 rounded text-xs font-bold hover:bg-cyan-100 transition-colors"
                >
                  🎲 随机生成{meta.id === 'rsa' ? '密钥对' : '私钥'}
                </button>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {meta.id === 'rsa'
                    ? '从素数表中按种子确定 p、q，自动计算 n、φ、e、d。密钥生成过程展示在左侧步骤里。'
                    : '由种子确定素数 p、生成元 g 与双方私钥 a、b，交换过程展示在左侧步骤里。'}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">算法档案</div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase mb-1">原理</div>
                <p className="text-xs text-zinc-600 leading-relaxed">{meta.idea}</p>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase mb-1">安全性</div>
                <p className="text-xs text-zinc-600 leading-relaxed border-l-2 border-rose-300 pl-2">{meta.security}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HexToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-cyan-600 w-3.5 h-3.5"
      />
      {label}
    </label>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />
    </div>
  );
}

// ---------- 可视化渲染器 ----------

function VisualView({ visual }: { visual: CryptoVisual }) {
  switch (visual.kind) {
    case 'letters': {
      // 横排字符卡片：每格自上而下 = 原文 / 运算 / 结果，超出一行自动换行
      const all = visual.rows.flatMap((r) => [r.cells[0], r.cells[1], r.cells[2]]);
      const maxLen = Math.max(...all.map((s) => s.length), 1);
      const cellW = maxLen > 9 ? 'w-24' : maxLen > 5 ? 'w-20' : 'w-14';
      const fontFor = (s: string) => (s.length > 4 ? 'text-[11px]' : s.length > 2 ? 'text-sm' : 'text-lg');
      return (
        <div className="max-w-full">
          <div className="flex items-center justify-center gap-3 mb-2 font-mono text-[10px] uppercase tracking-wider">
            <span className="text-zinc-500">{visual.headers[0]}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-amber-300/80">{visual.headers[1]}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-cyan-300/80">{visual.headers[2]}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {visual.rows.map((row, i) => (
              <div
                key={i}
                className={`${cellW} rounded-lg border px-1 py-1.5 text-center ${
                  row.status === 'active'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-zinc-800 bg-zinc-950/40'
                }`}
              >
                <div className={`font-mono text-zinc-100 leading-tight ${fontFor(row.cells[0])}`}>{row.cells[0]}</div>
                <div className={`font-mono text-amber-300/90 leading-tight py-0.5 break-all ${fontFor(row.cells[1])}`}>
                  {row.cells[1]}
                </div>
                <div className={`font-mono text-cyan-300 font-bold leading-tight ${fontFor(row.cells[2])}`}>
                  {row.cells[2]}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'zigzag': {
      const cols = visual.rails[0]?.length ?? 0;
      const narrow = cols > 24;
      return (
        <div className="space-y-1.5">
          {visual.rails.map((row, r) => (
            <div key={r} className={`flex ${narrow ? 'gap-0.5' : 'gap-1'} items-center`}>
              <span className="w-7 text-[10px] font-mono text-zinc-500 shrink-0">R{r}</span>
              {row.map((ch, i) => {
                const idx = visual.indices?.[r]?.[i];
                const filled = visual.show === 'indices' ? idx !== undefined && idx >= 0 : Boolean(ch);
                return (
                  <div
                    key={i}
                    className={`${narrow ? 'w-6 h-7 text-xs' : 'w-7 h-8 text-sm'} flex items-center justify-center border rounded-sm font-mono ${
                      filled
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                        : 'border-zinc-800 text-zinc-700'
                    }`}
                  >
                    {visual.show === 'indices' ? (idx !== undefined && idx >= 0 ? idx : '·') : ch ?? '·'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    case 'bits': {
      const { current } = visual;
      const rows = current
        ? [
            { label: '明文', byte: current.p },
            { label: '⊕ 密钥', byte: current.k },
            { label: '= 密文', byte: current.p ^ current.k },
          ]
        : [];
      return (
        <div className="space-y-4">
          {visual.done.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-w-md">
              {visual.done.map((d, i) => (
                <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[11px] text-zinc-400">
                  {d.label}→<span className="text-cyan-300">{d.hex}</span>
                </span>
              ))}
            </div>
          )}
          {current && (
            <div className="space-y-1.5">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-12 text-[10px] font-mono text-zinc-500 text-right shrink-0">{row.label}</span>
                  {Array.from({ length: 8 }, (_, i) => {
                    const bit = (row.byte >> (7 - i)) & 1;
                    return (
                      <div
                        key={i}
                        className={`w-8 h-8 flex items-center justify-center border rounded-sm font-mono text-sm ${
                          bit
                            ? row.label === '密文'
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                              : 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                            : 'border-zinc-800 text-zinc-600'
                        }`}
                      >
                        {bit}
                      </div>
                    );
                  })}
                  <span className="w-16 text-[11px] font-mono text-zinc-500">
                    0x{row.byte.toString(16).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'matrix':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {visual.cells.map((row, r) =>
              row.map((cell, c) => {
                const changed = visual.changed?.some(([cr, cc]) => cr === r && cc === c);
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`w-14 h-14 flex items-center justify-center border rounded font-mono text-base transition-colors ${
                      changed
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 font-bold'
                        : 'border-zinc-800 text-zinc-300'
                    }`}
                  >
                    {cell}
                  </div>
                );
              }),
            )}
          </div>
          {visual.keyHex && (
            <div className="text-[11px] font-mono text-zinc-500">
              <span className="text-amber-400/80">圆密钥</span>{' '}
              <span className="text-amber-300 break-all">{visual.keyHex}</span>
            </div>
          )}
        </div>
      );

    case 'numbers':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl">
          {visual.items.map((item, i) => (
            <div key={i} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5">
                {item.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>}
                <span className="text-[10px] font-mono text-zinc-500 uppercase truncate">{item.label}</span>
              </div>
              <div
                className={`font-mono text-lg mt-1 break-all ${item.muted ? 'text-zinc-500' : 'text-zinc-100'}`}
                style={!item.muted && item.color ? { color: item.color } : undefined}
              >
                {item.value}
              </div>
              {item.note && <div className="text-[10px] text-zinc-500 mt-1">{item.note}</div>}
            </div>
          ))}
        </div>
      );
  }
}
