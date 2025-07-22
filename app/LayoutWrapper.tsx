"use client";
import { usePathname } from "next/navigation";
import ClientLayout from "./ClientLayout";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // If on login page, auth route, or user routes, render children only (no navbar)
  if (pathname === "/" || 
      pathname === "/login" || 
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/user/") ||
      pathname === "/user") {
    return <>{children}</>;
  }
  // Otherwise, wrap in ClientLayout (with navbar, etc)
  return <ClientLayout>{children}</ClientLayout>;
}
