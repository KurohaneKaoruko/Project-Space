import { INSTRUMENT } from '../lib/ui';

/** 四角刻度，让画布看起来像一台仪表 */
function CornerTicks() {
  const base = 'pointer-events-none absolute h-2.5 w-2.5 border-white/15';
  return (
    <>
      <span className={`${base} left-2 top-2 border-l border-t`} />
      <span className={`${base} right-2 top-2 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </>
  );
}

/**
 * 深色仪表盘容器：网格底 + 顶部辉光 + 四角刻度。
 * 所有问题的可视化都放在这里面，保证同一套「实验台」质感。
 */
export default function InstrumentPanel({
  label,
  meta,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  label?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${INSTRUMENT} ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/[0.09] blur-3xl"
      />
      <CornerTicks />

      {(label || actions) && (
        <header className="relative flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
          {label && (
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              {label}
            </span>
          )}
          {meta && <span className="font-mono text-[10px] text-zinc-600">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}

      <div className={`relative ${bodyClassName}`}>{children}</div>
    </section>
  );
}
