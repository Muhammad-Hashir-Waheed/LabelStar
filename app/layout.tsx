import type React from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import LayoutWrapper from "@/app/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

export const metadata = {
  generator: "v0.dev",
};
