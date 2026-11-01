import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '装箱',
  description: '装箱问题：First-Fit Decreasing 逐件装箱的实时可视化，可调物品数与箱子容量',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
