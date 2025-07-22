"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/authUtils";

export function Navigation() {
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await getUserProfile(session.user.id, session.user.email!);
        setUserProfile(profile);
      }
    };

    loadUserProfile();
  }, []);

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
    <nav
      style={{
        background: "#fff",
        padding: "1rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
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
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
            {userProfile?.full_name || userProfile?.email?.split('@')[0] || 'User'}
          </span>
        </div>
      </div>
    </nav>
  );
}
