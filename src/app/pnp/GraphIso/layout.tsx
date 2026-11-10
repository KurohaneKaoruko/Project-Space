import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '图同构',
  description: '图同构判定：双图并排展示，回溯 + 邻域一致性剪枝找保边双射，配对顶点同色高亮，支持导入自己的求解器',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
