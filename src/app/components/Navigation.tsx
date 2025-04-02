'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';

export default function Navigation() {
  const pathname = usePathname();
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
        ? 'bg-white/90 backdrop-blur-md shadow-md' 
        : 'bg-white/80 backdrop-blur-sm border-b border-gray-200'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">项目空间</span>
            </Link>
          </div>
          
          {/* 桌面导航 */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <NavLink href="/" active={pathname === '/'}>
              首页
            </NavLink>
            <NavLink href="/projects" active={pathname === '/projects'}>
              项目
            </NavLink>
          </div>
          
          {/* 移动端菜单按钮 */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">打开菜单</span>
              {mobileMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* 移动端菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1 px-4">
            <MobileNavLink href="/" active={pathname === '/'}>
              首页
            </MobileNavLink>
            <MobileNavLink href="/projects" active={pathname === '/projects'}>
              项目
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
}

// 桌面端导航链接
function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className={`relative px-3 py-2 text-sm font-medium transition-colors ${
        active 
          ? 'text-blue-600' 
          : 'text-gray-600 hover:text-blue-600'
      }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full"></span>
      )}
    </Link>
  );
}

// 移动端导航链接
function MobileNavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className={`block px-3 py-2 rounded-md text-base font-medium ${
        active 
          ? 'bg-blue-50 text-blue-600' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
      }`}
    >
      {children}
    </Link>
  );
} 