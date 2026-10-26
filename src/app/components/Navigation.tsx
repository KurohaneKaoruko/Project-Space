'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';

/** 导航图标（24px 线框，square 端点呼应 tech 风格） */
const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 3l9 8.5" />
      <path d="M5.5 10.5V21h13V10.5" />
    </>
  ),
  games: (
    <>
      <rect x="2.5" y="7.5" width="19" height="11" rx="2" />
      <path d="M7 11v4M5 13h4" />
      <path d="M15.5 12h.01M18 14.5h.01" strokeWidth={2.5} />
    </>
  ),
  simulations: (
    <>
      <path d="M9.5 3v6.2L4.2 18.6A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.3-2.4L14.5 9.2V3" />
      <path d="M8 3h8M7 15.5h10" />
    </>
  ),
  algorithms: (
    <>
      <circle cx="6" cy="5.5" r="2" />
      <circle cx="6" cy="18.5" r="2" />
      <circle cx="18" cy="7.5" r="2" />
      <path d="M6 7.5v9" />
      <path d="M18 9.5c0 4.5-6.5 3.5-9.5 6.5" />
    </>
  ),
  visualizations: (
    <>
      <path d="M3.5 3.5v17h17" />
      <path d="M8.5 16.5v-5M13 16.5V6.5M17.5 16.5v-8" />
    </>
  ),
  tools: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
};

const NAV_ITEMS = [
  { href: '/', label: 'HOME', badge: '01', icon: 'home' },
  { href: '/games', label: 'GAMES', badge: '02', icon: 'games' },
  { href: '/simulations', label: 'SIMULATIONS', badge: '03', icon: 'simulations' },
  { href: '/algorithms', label: 'ALGORITHMS', badge: '04', icon: 'algorithms' },
  { href: '/visualizations', label: 'VISUALIZATIONS', badge: '05', icon: 'visualizations' },
  { href: '/tools', label: 'TOOLS', badge: '06', icon: 'tools' },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function NavIconGlyph({ name }: { name: string }) {
  return (
    <svg
      className="w-5 h-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {ICONS[name]}
    </svg>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 h-16 px-4 border-b border-zinc-100 shrink-0"
      aria-label="返回首页"
    >
      <div className="relative flex items-center justify-center w-8 h-8 shrink-0 border border-zinc-200 bg-zinc-50 transition-colors group-hover:border-blue-500/50 group-hover:bg-blue-50">
        <svg className="w-5 h-5 text-zinc-900 transition-colors group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="square" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="absolute -top-px -left-px w-1 h-1 bg-zinc-300 transition-colors group-hover:bg-blue-500" />
        <span className="absolute -bottom-px -right-px w-1 h-1 bg-zinc-300 transition-colors group-hover:bg-blue-500" />
      </div>
      <span className="font-mono uppercase tracking-tight text-zinc-900 whitespace-nowrap">
        Project<span className="mx-0.5 text-blue-600">/</span>Space
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="主导航">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-3 h-10 px-3 transition-colors duration-200 ${
              active
                ? 'text-blue-600 bg-blue-50/80'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {/* 右缘激活条（抽屉靠右） */}
            <span
              className={`absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 transition-all duration-200 ${
                active ? 'opacity-100' : 'opacity-0 scale-y-0'
              }`}
            />
            <NavIconGlyph name={item.icon} />
            <span className="flex-1 font-mono text-[13px] tracking-wider">{item.label}</span>
            <span className={`font-mono text-[10px] transition-colors ${active ? 'text-blue-500' : 'text-zinc-300 group-hover:text-zinc-400'}`}>
              {item.badge}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Navigation({ title }: { title?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 路由变化时自动关闭抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-[54] bg-zinc-900/30 animate-fade-in"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* 抽屉（右侧悬浮，默认藏在屏幕外） */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-[55] flex flex-col w-52 border-l border-zinc-200 bg-white shadow-[-4px_0_16px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <Logo />

        {/* 当前页面标题（项目子页传入） */}
        {title && (
          <div className="px-4 py-2 border-b border-zinc-100 shrink-0">
            <span className="block font-mono text-[10px] tracking-widest text-zinc-400 truncate" title={title}>
              {title}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
        </div>

        {/* 底部关闭按钮 */}
        <button
          onClick={() => setOpen(false)}
          className="flex items-center justify-end gap-3 h-10 px-4 border-t border-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors shrink-0"
          aria-label="关闭菜单"
        >
          <span className="font-mono text-[10px] tracking-widest">CLOSE</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </aside>

      {/* 浮动菜单按钮（右缘半嵌入，只占边缘窄条不遮内容；抽屉打开时隐藏） */}
      <button
        onClick={() => setOpen(true)}
        aria-label="打开菜单"
        aria-expanded={open}
        className={`fixed top-3 right-0 z-[56] flex items-center justify-center w-8 h-10 rounded-l-md border border-r-0 border-zinc-200 bg-white/90 backdrop-blur-sm text-zinc-500 shadow-[2px_2px_8px_rgba(0,0,0,0.08)] hover:text-blue-600 hover:border-blue-500/50 hover:w-10 transition-all duration-200 ${
          open ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </>
  );
}
