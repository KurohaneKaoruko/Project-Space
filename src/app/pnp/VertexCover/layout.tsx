import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '顶点覆盖',
  description: '顶点覆盖：分支定界求最小覆盖的实时可视化，可调点数与边密度，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
