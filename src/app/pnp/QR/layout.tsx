import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '二次剩余',
  description: '二次剩余判定：暴力平方表 vs 因数分解 + 欧拉判据双解法对照， witnessing y² ≡ x (mod n) 的实时扫描可视化，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
