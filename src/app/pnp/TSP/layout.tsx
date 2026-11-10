import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '旅行商问题',
  description: 'TSP：最近邻、2-opt、暴力最优可视化，支持导入自己的实现运行',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
