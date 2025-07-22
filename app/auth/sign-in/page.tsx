"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./signIn.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get or create user profile
      const profile = await getUserProfile(data.user.id, data.user.email!);

      if (!profile) {
        throw new Error("Failed to create user profile");
      }

      // Redirect based on role
      if (profile.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <Card className="signin-card">
        <CardHeader className="signin-header">
          <div className="signin-logo">ED</div>
          <CardTitle className="signin-title">Welcome to E-Con Den</CardTitle>
          <CardDescription className="signin-desc">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="signin-form">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <div
                style={{
                  color: "#ef4444",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="signin-footer">
          Don't have an account? Contact your administrator
        </CardFooter>
      </Card>
    </div>
  );
}
