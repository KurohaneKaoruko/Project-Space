import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '离散对数',
  description:
    '离散对数问题（DLP）：在模 p 乘法群与椭圆曲线群上求 g^x = h 的指数，暴力搜索与 Baby-step Giant-step 实时对比',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
