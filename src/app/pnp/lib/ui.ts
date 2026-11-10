/** P & NP 各页共用的样式常量 */

export const PANEL =
  'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

export const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition-all duration-200 hover:bg-blue-500 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

export const MONO = 'font-mono text-[11px] leading-relaxed text-zinc-500';

/* ---- 仪表盘配色：深色画布上的状态色 ---- */

export const INK = {
  idle: '#3f3f46',
  idleStroke: '#52525b',
  active: '#fbbf24',
  done: '#3b82f6',
  ok: '#10b981',
  bad: '#f43f5e',
} as const;

/** 深色画布容器（统一网格 + 顶部辉光） */
export const INSTRUMENT =
  'relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080a0f] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-32px_rgba(2,6,23,0.55)]';
