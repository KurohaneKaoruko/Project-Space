import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rubik Cube AI',
  description: '3D 魔方 + 分层还原求解算法',
};

export default function RubiksCubeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
