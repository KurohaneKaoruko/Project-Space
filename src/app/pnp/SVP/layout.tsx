import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '格最短向量',
  description: '格最短向量问题（SVP）：二维格基变换，枚举整系数组合 i·b₁+j·b₂ 找最短非零向量，格点网与候选向量同屏实时可视化，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
