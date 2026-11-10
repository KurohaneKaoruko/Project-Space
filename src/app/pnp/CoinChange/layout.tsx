import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '找零钱',
  description: '找零钱（最少硬币数）：DP 表条形图逐格填充，贪心大面额优先实时对照——标准币制贪心恰好最优，任意币制可能失败，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
