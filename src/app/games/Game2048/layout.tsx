import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2048 游戏",
  description: "2048 游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
    {children}
    </>
  );
}
