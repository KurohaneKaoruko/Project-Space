import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最近点对',
  description: '最近点对（Closest Pair）：x 排序 + 滑动窗口剪枝的扫描可视化，扫描线推进、最优对脉冲连线，均摊 O(n log n)，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
