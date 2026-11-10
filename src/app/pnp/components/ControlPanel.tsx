'use client';

import { useState } from 'react';

/** 单个参数：标签 + 数字输入 + 滑块 */
export function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const safe = Number.isFinite(value) ? value : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="font-mono text-[10px] font-medium uppercase text-zinc-500">
          {label}
        </label>
        <input
          type="number"
          value={safe}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-sm border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-right font-mono text-xs text-zinc-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
          aria-label={label}
        />
      </div>

      <input
        type="range"
        value={safe}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600"
        aria-label={label}
      />

      {format && (
        <div className="text-right font-mono text-[9px] tabular-nums text-zinc-400">
          {format(safe)}
        </div>
      )}
    </div>
  );
}

/** 可折叠分组 */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-900"
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

/** 右侧控制面板外壳：标题 + 重置/播放 + 分组内容 */
export default function ControlPanel({ children }: { children: React.ReactNode }) {
  return (
    <aside className="w-full shrink-0 border-t border-zinc-200 bg-white p-4 lg:sticky lg:top-16 lg:h-full lg:max-h-[calc(100vh-5.5rem)] lg:w-[272px] lg:overflow-y-auto lg:border-l lg:border-t-0">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-4 w-1 shrink-0 bg-blue-600" />
        <div>
          <h2 className="text-base font-bold text-zinc-900">控制面板 (CONTROL_PANEL)</h2>
          <p className="mt-1 font-mono text-[10px] uppercase text-zinc-500">
            {'/// 参数调节 (PARAMETER_TUNING)'}
          </p>
        </div>
      </div>


      <div className="mt-6 space-y-6">{children}</div>
    </aside>
  );
}
