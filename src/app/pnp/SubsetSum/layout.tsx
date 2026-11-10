import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '子集和',
  description: '子集和问题：DP 表逐格填充的实时可视化，可调物品数与目标和，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
