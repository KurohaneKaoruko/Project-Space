import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '整数分解',
  description: '整数分解：试除法与 Pollard\u2019s Rho 对比，支持导入自己的实现运行',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
