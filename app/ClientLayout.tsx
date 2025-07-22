"use client";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import "./ClientLayout.css";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a simplified version during SSR
  if (!mounted) {
    return (
      <div className="layout-container">
        <Navigation />
        <main className="main-content">{children}</main>
        <Toaster />
      </div>
    );
  }

  // Full version with theme support after hydration
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <div className="layout-container">
        <Navigation />
        <main className="main-content">{children}</main>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
