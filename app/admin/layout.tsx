"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/authUtils";
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  Menu,
  X,
  Hash,
} from "lucide-react";
import LogoutButton from "../components/LogoutButton";
import "./admin-layout.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) {
        router.replace("/");
        return;
      }

      // Check if user is admin using the utility function
      const profile = await getUserProfile(session.user.id, session.user.email!);

      if (!profile || profile.role !== "admin") {
        router.replace("/");
      }
    };

    checkUser();

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setIsSidebarOpen(window.innerWidth >= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [router]);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", href: "/admin" },
    { icon: <Users size={20} />, label: "Users", href: "/admin/users" },
    { icon: <Hash size={20} />, label: "Tracking IDs", href: "/admin/tracking-ids" },
    { icon: <Package size={20} />, label: "Labels", href: "/admin/labels" },
    {
      icon: <Settings size={20} />,
      label: "Settings",
      href: "/admin/settings",
    },
  ];

  return (
    <div className="admin-container">
      {/* Mobile Header */}
      <div className="admin-mobile-header">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            padding: "0.5rem",
            borderRadius: "0.375rem",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: "2rem",
              height: "2rem",
              background: "linear-gradient(135deg, #2563eb, #1e40af)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: "white",
                fontWeight: "bold",
                fontSize: "0.875rem",
              }}
            >
              ED
            </span>
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>E-Con Den</h1>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <aside className={`admin-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
          <div
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <div style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <div
                  style={{
                    width: "2rem",
                    height: "2rem",
                    background: "linear-gradient(135deg, #2563eb, #1e40af)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "0.875rem",
                    }}
                  >
                    ED
                  </span>
                </div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  E-Con Den
                </h2>
              </div>
            </div>
            <nav style={{ flex: 1, padding: "1rem" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {menuItems.map((item) => (
                  <li key={item.href} style={{ marginBottom: "0.5rem" }}>
                    <Link
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 1rem",
                        borderRadius: "0.5rem",
                        textDecoration: "none",
                        color: "#111",
                        transition: "background 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.background = "#f3f4f6")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.background = "none")
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb" }}>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-main-content">{children}</main>
      </div>
    </div>
  );
}
