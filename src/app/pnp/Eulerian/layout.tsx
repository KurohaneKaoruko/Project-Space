import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '欧拉回路',
  description: '欧拉回路：Hierholzer 算法逐边推进的实时可视化，可调点数与边数，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
