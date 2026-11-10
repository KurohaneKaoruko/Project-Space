import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最短路径',
  description: '单源最短路径：Dijkstra 贪心确定 + 边松弛的实时可视化，节点距离实时更新，可调节点数与边密度，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
