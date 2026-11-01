'use client';

/** 分段控件：用于用例切换与算法切换，light / dark 两种底色 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  className = '',
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const shell =
    tone === 'dark'
      ? 'border-white/10 bg-white/[0.04]'
      : 'border-zinc-200 bg-zinc-100/80';
  const activeCls =
    tone === 'dark'
      ? 'bg-white/[0.1] text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
      : 'bg-white text-zinc-900 shadow-sm';
  const idleCls =
    tone === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800';

  return (
    <div className={`inline-flex rounded-lg border p-0.5 ${shell} ${className}`} role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={`relative rounded-[6px] px-3 py-1.5 text-[11px] font-bold transition-all duration-200 ${
              active ? activeCls : idleCls
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
