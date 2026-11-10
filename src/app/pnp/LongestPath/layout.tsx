import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最长路径',
  description: '最长简单路径：DFS 穷举 + 回溯实时可视化，与最短路径（P，Dijkstra）同图对照，直观体验 P 与 NP 困难之间的一线之隔，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
