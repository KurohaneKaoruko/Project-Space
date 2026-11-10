import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '0/1 背包',
  description: '0/1 背包：DP 表逐格填充 + 回溯找选中物品的实时可视化，可调物品数与容量，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
