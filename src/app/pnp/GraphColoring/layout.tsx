import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '图着色',
  description: 'k 色图着色判定：回溯与贪心可视化，支持导入自己的实现运行',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
