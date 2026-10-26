'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';

export default function Navigation({ title }: { title?: string }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isGames = pathname.startsWith('/games');
  const isSimulations = pathname.startsWith('/simulations');
  const isAlgorithms = pathname.startsWith('/algorithms');
  const isVisualizations = pathname.startsWith('/visualizations');
  const isTools = pathname.startsWith('/tools');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 监听滚动事件，改变导航栏样式
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/90 backdrop-blur-md border-b border-zinc-200 shadow-sm' 
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="group flex items-center space-x-2 text-xl font-bold text-zinc-900 hover:text-blue-600 transition-colors tracking-tighter">
              <div className="relative flex items-center justify-center w-8 h-8 border border-zinc-200 bg-zinc-50 group-hover:border-blue-500/50 group-hover:bg-blue-50 transition-colors">
                <svg className="w-5 h-5 text-zinc-900 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {/* 装饰角标 */}
                <span className="absolute -top-px -left-px w-1 h-1 bg-zinc-300 group-hover:bg-blue-500"></span>
                <span className="absolute -bottom-px -right-px w-1 h-1 bg-zinc-300 group-hover:bg-blue-500"></span>
              </div>
              {title ? (
                <span className="font-mono uppercase text-lg">{title}</span>
              ) : (
                <span className="font-mono uppercase">Project<span className="text-blue-600 mx-1">/</span>Space</span>
              )}
            </Link>
          </div>
          
          {/* 桌面导航 */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <NavLink href="/" active={isHome} badge="01">
              HOME
            </NavLink>
            <NavLink href="/games" active={isGames} badge="02">
              GAMES
            </NavLink>
            <NavLink href="/simulations" active={isSimulations} badge="03">
              SIMULATIONS
            </NavLink>
            <NavLink href="/algorithms" active={isAlgorithms} badge="04">
              ALGORITHMS
            </NavLink>
            <NavLink href="/visualizations" active={isVisualizations} badge="05">
              VISUALIZATIONS
            </NavLink>
            <NavLink href="/tools" active={isTools} badge="06">
              TOOLS
            </NavLink>
          </div>
          
          {/* 移动端菜单按钮 */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 focus:outline-none"
            >
              <span className="sr-only">打开菜单</span>
              {mobileMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* 移动端菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-zinc-200 h-screen fixed inset-0 top-16 z-40">
          <div className="pt-8 pb-3 space-y-1 px-4 flex flex-col gap-4">
            <MobileNavLink href="/" active={isHome}>
              HOME
            </MobileNavLink>
            <MobileNavLink href="/games" active={isGames}>
              GAMES
            </MobileNavLink>
            <MobileNavLink href="/simulations" active={isSimulations}>
              SIMULATIONS
            </MobileNavLink>
            <MobileNavLink href="/algorithms" active={isAlgorithms}>
              ALGORITHMS
            </MobileNavLink>
            <MobileNavLink href="/visualizations" active={isVisualizations}>
              VISUALIZATIONS
            </MobileNavLink>
            <MobileNavLink href="/tools" active={isTools}>
              TOOLS
            </MobileNavLink>
          </div>
        </div>
      )}
    </nav>
  );
}

interface NavLinkProps {
  href: string;
  active: boolean;
  children: ReactNode;
  badge?: string;
}

// 桌面端导航链接
function NavLink({ href, active, children, badge }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className={`group relative px-1 py-2 text-sm font-bold tracking-widest transition-colors ${
        active 
          ? 'text-zinc-900' 
          : 'text-zinc-500 hover:text-zinc-900'
      }`}
    >
      <span className="relative z-10">{children}</span>
      {/* 悬停/激活效果 */}
      <span className={`absolute bottom-0 left-0 h-[2px] bg-blue-600 transition-all duration-300 ${
        active ? 'w-full' : 'w-0 group-hover:w-full'
      }`}></span>
      {active && badge && (
        <span className="absolute -top-1 -right-2 text-[10px] text-blue-600 font-mono">{badge}</span>
      )}
    </Link>
  );
}

// 移动端导航链接
function MobileNavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className={`block px-4 py-4 text-2xl font-bold tracking-widest border-l-2 transition-all ${
        active 
          ? 'border-blue-600 text-zinc-900 bg-zinc-50' 
          : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
      }`}
    >
      {children}
    </Link>
  );
} 
