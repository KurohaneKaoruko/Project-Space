import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '双单调 TSP',
  description: '双单调欧几里得 TSP：按 x 排序后两条不相交链逐步生长，蓝绿双色实时可视化——一般 TSP 是 NP-H，限定双单调结构后 DP 精确解只要 O(n²)，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
