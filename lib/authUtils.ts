import { supabase } from "./supabaseClient";

export interface UserProfile {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

/**
 * Ensures a user has a profile in the database
 * Creates one if it doesn't exist
 */
export async function ensureUserProfile(
  userId: string,
  userEmail: string
): Promise<UserProfile | null> {
  try {
    // First, try to get existing profile
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      // Check for various "no rows found" error messages
      const isNoRowsError = 
        profileError.message.includes("No rows found") ||
        profileError.message.includes("JSON object requested, multiple (or no) rows returned") ||
        profileError.code === "PGRST116";

      if (isNoRowsError) {
        console.log(`Creating profile for user ${userId} (${userEmail})`);
        
        // Profile doesn't exist, create one
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: userEmail,
            role: "user",
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating user profile:", createError);
          return null;
        }

        console.log(`Successfully created profile for user ${userId}`);
        profile = newProfile;
      } else {
        console.error("Error fetching user profile:", profileError);
        return null;
      }
    }

    return profile;
  } catch (error) {
    console.error("Error in ensureUserProfile:", error);
    return null;
  }
}

/**
 * Gets user profile with automatic creation if needed
 */
export async function getUserProfile(
  userId: string,
  userEmail: string
): Promise<UserProfile | null> {
  return await ensureUserProfile(userId, userEmail);
}

/**
 * Updates user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: "user" | "admin"
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      console.error("Error updating user role:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    return false;
  }
}
