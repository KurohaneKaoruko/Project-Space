'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Brand({ className }: { className: string }) {
  return (
    <Link
      href="/"
      aria-label="返回首页"
      className={`group flex shrink-0 items-center gap-2.5 transition-colors ${className}`}
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 transition-colors group-hover:border-blue-500/50 group-hover:bg-blue-50">
        <svg
          className="h-5 w-5 text-zinc-900 transition-colors group-hover:text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="square" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="absolute -left-px -top-px h-1 w-1 bg-zinc-300 transition-colors group-hover:bg-blue-500" />
        <span className="absolute -bottom-px -right-px h-1 w-1 bg-zinc-300 transition-colors group-hover:bg-blue-500" />
      </div>
      <span className="hidden whitespace-nowrap font-mono uppercase tracking-tight text-zinc-900 sm:block">
        Project<span className="mx-0.5 text-blue-600">/</span>Space
      </span>
    </Link>
  );
}

/**
 * 站点顶栏。
 * - 传入 header：渲染整条顶栏（左品牌 / 中标题 / 右动作），页面内容靠 pt-16 让位。
 * - 不传 header：只保留左上角的品牌块，不占内容高度（既有页面沿用）。
 */
export default function Navigation({
  title,
  header,
  actions,
}: {
  /** 仅供读屏的页面标题 */
  title?: string;
  /** 顶栏中间内容 */
  header?: React.ReactNode;
  /** 顶栏右侧动作 */
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === '/') return null;

  if (!header) {
    return (
      <>
        <Brand className="fixed left-0 top-0 z-[56] h-16 border-b border-zinc-100 bg-white/95 px-4 backdrop-blur-sm" />
        {title && <span className="sr-only">{title}</span>}
      </>
    );
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[55] flex h-16 items-center border-b border-zinc-100 bg-white/95 pr-4 backdrop-blur-sm">
      <Brand className="h-16 border-r border-zinc-100 px-4 hover:bg-zinc-50" />

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5">
        {header}
      </div>

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}

      {title && <span className="sr-only">{title}</span>}
    </header>
  );
}
