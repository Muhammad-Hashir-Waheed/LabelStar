"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/authUtils";
import {
  LayoutDashboard,
  Package,
  FileText,
  Settings,
  Menu,
  X,
  User,
} from "lucide-react";
import LogoutButton from "../components/LogoutButton";
import "./user-layout.css";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
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

      // Check if user is not admin (regular user)
      const profile = await getUserProfile(session.user.id, session.user.email!);

      if (!profile || profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      setUserProfile(profile);
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
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", href: "/user" },
    { icon: <Package size={20} />, label: "Generate Label", href: "/user/shipping-label" },
    { icon: <FileText size={20} />, label: "Bulk Upload", href: "/user/bulk-upload" },
    {
      icon: <Settings size={20} />,
      label: "Settings",
      href: "/user/settings",
    },
  ];

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!userProfile) return "U";
    const name = userProfile.full_name || userProfile.email || "";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="user-container">
      {/* Mobile Header */}
      <div className="user-mobile-header">
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
        
        {/* User Profile Section */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "2rem",
              height: "2rem",
              background: "linear-gradient(135deg, #059669, #047857)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            {getUserInitials()}
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            {userProfile?.full_name || userProfile?.email?.split('@')[0] || 'User'}
          </span>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <aside className={`user-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
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
                    background: "linear-gradient(135deg, #059669, #047857)",
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
        <main className="user-main-content">{children}</main>
      </div>
    </div>
  );
} 