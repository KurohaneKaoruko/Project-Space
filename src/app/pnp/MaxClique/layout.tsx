import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最大团',
  description: '最大团：回溯搜索与剪枝的实时可视化，可调点数与边密度，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
