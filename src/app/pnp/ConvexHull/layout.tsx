import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '凸包',
  description: '凸包（Andrew 单调链）：排序后上下链扫描、压栈弹栈的实时可视化，点云逐渐被包围，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
