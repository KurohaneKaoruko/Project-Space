import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '集合覆盖',
  description: '集合覆盖：贪心与精确搜索的实时可视化，可调元素数与集合数，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
