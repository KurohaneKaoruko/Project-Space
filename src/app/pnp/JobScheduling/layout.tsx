import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '作业调度',
  description: '作业调度（P||Cmax）：n 个作业分给 m 台机器最小化最大负载，LPT 贪心与分支定界枚举最优实时对照，甘特图逐块填充、机器负载与 makespan 参考线动态更新，支持导入自己的实现',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
