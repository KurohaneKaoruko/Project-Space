import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '最大独立集',
  description: '最大独立集：分支定界逐点二选一（选/不选）、冲突剪枝的实时可视化，选中点蓝色点亮、历史最优绿色虚线环，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
