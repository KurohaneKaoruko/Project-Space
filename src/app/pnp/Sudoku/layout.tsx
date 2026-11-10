import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '数独',
  description: '数独求解：MRV 候选约束 + 回溯的实时可视化，逐格试数与回退、冲突高亮，可换题面，支持导入自己的求解器',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
