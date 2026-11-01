import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3-SAT',
  description: '3-SAT 可满足性判定：暴力枚举与 DPLL 可视化，支持导入自己的求解器运行',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
