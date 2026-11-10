import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '编辑距离',
  description: '编辑距离（Levenshtein）：DP 表逐格填充的实时可视化，展示对齐/插入/删除决策，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
