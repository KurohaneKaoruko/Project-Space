import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '三门问题',
  description: 'Monty Hall 概率悖论：手动体验 + 蒙特卡洛批量模拟，看换门 2/3 与坚持 1/3 的频率收敛',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
