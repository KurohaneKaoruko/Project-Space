'use client';

import SegmentedControl from './SegmentedControl';

/**
 * 实时执行控制条：算法真的在跑，这里是启动/暂停/单步 + 真实耗时读数。
 */
export default function LiveControls({
  running,
  done,
  elapsed,
  computeMs,
  stepCount,
  total,
  speed,
  onSpeed,
  onStart,
  onPause,
  onReset,
  onStep,
  tone = 'dark',
}: {
  running: boolean;
  done: boolean;
  elapsed: number;
  computeMs: number;
  stepCount: number;
  total: number;
  speed: number;
  onSpeed: (v: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  tone?: 'light' | 'dark';
}) {
  const btn =
    tone === 'dark'
      ? 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white'
      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900';

  const label = tone === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const value = tone === 'dark' ? 'text-zinc-200' : 'text-zinc-800';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={running ? onPause : onStart}
        disabled={done}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
          running
            ? 'bg-amber-500 text-white hover:bg-amber-400'
            : 'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-500'
        }`}
      >
        {running ? (
          <>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            暂停
          </>
        ) : (
          <>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l13 8-13 8z" />
            </svg>
            {done ? '已完成' : stepCount === 0 ? '开始求解' : '继续'}
          </>
        )}
      </button>

      <button onClick={onStep} disabled={running || done} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-30 ${btn}`}>
        单步
      </button>

      <button onClick={onReset} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all ${btn}`}>
        重置
      </button>

      <div className="ml-auto flex items-center gap-3 font-mono text-[10px]">
        <span className={label}>
          计算 <b className={`tabular-nums ${value}`}>{computeMs.toFixed(2)}</b> ms
        </span>
        <span className={`hidden md:inline ${label}`}>
          播放 <b className="tabular-nums">{elapsed.toFixed(0)}</b> ms
        </span>
        <span className={label}>
          步数 <b className={`tabular-nums ${value}`}>{stepCount}</b>
        </span>
        <span className={`hidden sm:inline ${label}`}>
          {done ? '结束' : running ? '执行中' : stepCount === 0 ? '待开始' : '已暂停'}
        </span>
      </div>

      <SegmentedControl
        tone={tone}
        value={String(speed)}
        onChange={(v) => onSpeed(Number(v))}
        options={[
          { value: '0.1', label: '0.1×' },
          { value: '1', label: '1×' },
          { value: '8', label: '8×' },
          { value: '999', label: '全速' },
        ]}
      />
      <span className={`hidden font-mono text-[9px] lg:inline ${label}`}>每帧 {speed < 1 ? `1/${Math.round(1 / speed)}` : speed} 步</span>
    </div>
  );
}
