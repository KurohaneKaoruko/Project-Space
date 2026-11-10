import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最小生成树',
  description: '最小生成树：Kruskal 逐边判定（并查集判环）实时可视化，可调节点数与边密度，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
