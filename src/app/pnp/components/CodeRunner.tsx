'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { runUserCode } from '../lib/runner';
import { preview, type TestCase } from '../lib/types';

interface CaseResult {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
  actual?: string;
}

/**
 * 代码运行器：平时只占一个按钮，点开是浮层编辑器。
 * 代码在 Worker 中执行，**不设时限**，随时可手动停止。
 */
export default function CodeRunner<I, O>({
  template,
  solution,
  cases,
  label = '写代码',
}: {
  template: string;
  solution?: string;
  cases: TestCase<I, O>[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(template);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<CaseResult[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => code.split('\n').length, [code]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - started), 100);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [running]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults([]);

    const collected: CaseResult[] = [];
    for (const testCase of cases) {
      if (controller.signal.aborted) break;

      const outcome = await runUserCode<O>(code, testCase.input, controller.signal);
      if (outcome.aborted) break;

      if (!outcome.ok) {
        collected.push({ name: testCase.name, ok: false, ms: outcome.ms, error: outcome.error });
      } else {
        let pass = false;
        let error: string | undefined;
        try {
          pass = testCase.validate(outcome.value as O, testCase.input);
        } catch (err) {
          error = `判定时出错：${String(err)}`;
        }
        collected.push({
          name: testCase.name,
          ok: pass,
          ms: outcome.ms,
          error,
          actual: preview(outcome.value),
        });
      }
      setResults([...collected]);
    }

    setRunning(false);
    abortRef.current = null;
  };

  const passed = results?.filter((r) => r.ok).length ?? 0;
  const total = results?.length ?? 0;
  const aborted = results !== null && !running && total < cases.length;
  const allPass = total === cases.length && passed === total;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-lg border border-zinc-900 bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:border-blue-600 hover:bg-blue-600 active:scale-[0.97]"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square">
          <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
        </svg>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-3 backdrop-blur-md sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0c11] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="代码编辑器"
          >
            {/* 头部 */}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                  <i className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                  <i className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                </span>
                <span className="ml-1 font-mono text-[11px] text-zinc-400">solve.js</span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {solution && (
                  <button
                    onClick={() => setCode(solution)}
                    disabled={running}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                  >
                    载入参考
                  </button>
                )}
                <button
                  onClick={() => setCode(template)}
                  disabled={running}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  重置
                </button>
                {running ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-rose-500"
                  >
                    <span className="h-2 w-2 rounded-sm bg-white" />
                    停止 {(elapsed / 1000).toFixed(1)}s
                  </button>
                ) : (
                  <button
                    onClick={run}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4l13 8-13 8z" />
                    </svg>
                    运行用例
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="关闭"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 编辑器 */}
            <div className="flex h-[300px] overflow-hidden">
              <div
                ref={gutterRef}
                className="shrink-0 select-none overflow-hidden border-r border-white/[0.06] bg-white/[0.015] px-3 py-3 text-right font-mono text-[12.5px] leading-[1.65] text-zinc-600"
                aria-hidden
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                spellCheck={false}
                wrap="off"
                className="flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-zinc-100 outline-none [tab-size:2]"
                aria-label="代码编辑器"
              />
            </div>

            {/* 结果 */}
            <div className="border-t border-white/[0.07]">
              {!results && (
                <p className="px-4 py-3 font-mono text-[11px] leading-relaxed text-zinc-500">
                  代码在独立 Worker 中运行，不设时限，卡住可点「停止」；只能使用纯 JS，不能访问 DOM。
                </p>
              )}

              {results && (
                <>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-[11px] text-zinc-500">
                      通过{' '}
                      <b className={allPass ? 'text-emerald-400' : total > 0 ? 'text-rose-400' : 'text-zinc-400'}>
                        {passed}
                      </b>{' '}
                      / {cases.length}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          allPass ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${(passed / cases.length) * 100}%` }}
                      />
                    </div>
                    {running && (
                      <span className="font-mono text-[10px] text-zinc-500">
                        {(elapsed / 1000).toFixed(1)}s
                      </span>
                    )}
                    {aborted && <span className="font-mono text-[10px] text-amber-400">已中止</span>}
                  </div>

                  <ul className="max-h-52 divide-y divide-white/[0.05] overflow-y-auto">
                    {results.map((r) => (
                      <li key={r.name} className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                              r.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {r.ok ? '✓' : '✕'}
                          </span>
                          <span className="text-[12px] font-medium text-zinc-300">{r.name}</span>
                          <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">
                            {r.ms >= 1000 ? `${(r.ms / 1000).toFixed(2)}s` : `${r.ms}ms`}
                          </span>
                        </div>
                        {!r.ok && (
                          <div className="mt-1 space-y-0.5 pl-[26px]">
                            {r.error && (
                              <p className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-rose-400/90">
                                {r.error}
                              </p>
                            )}
                            {r.actual !== undefined && (
                              <p className="break-all font-mono text-[10px] text-zinc-500">
                                实际输出：{r.actual}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
