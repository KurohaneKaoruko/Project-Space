import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '拓扑排序',
  description: 'DAG 拓扑排序：Kahn 与 DFS 逆后序可视化，支持导入自己的实现运行',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
