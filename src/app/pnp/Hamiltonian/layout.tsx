import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '哈密顿回路',
  description: '哈密顿回路：回溯搜索的实时可视化，可调节点数与边密度，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
