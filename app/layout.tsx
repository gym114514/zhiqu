import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知趣 · 好奇心学习机",
  description: "从一个好问题出发，通过预测、探索与表达，开启一个陌生领域。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
