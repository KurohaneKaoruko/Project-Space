import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '斯坦纳树',
  description: '斯坦纳树：用最短的边连通全部指定终端（可借用中转点），Dreyfus–Wagner 子集 DP 逐步求解，树生长实时可视化，并与只连终端的 MST 对照，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
