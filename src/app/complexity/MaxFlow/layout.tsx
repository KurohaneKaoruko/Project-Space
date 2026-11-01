import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最大流',
  description: '最大流最小割：Edmonds–Karp 增广路径的实时可视化，可调网络规模，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
