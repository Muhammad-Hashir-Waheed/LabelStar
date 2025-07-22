"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    defaultQuota: 100,
    allowBulkUpload: true,
    requireApproval: false,
    maxFileSize: 5,
    allowedFileTypes: ["pdf", "png", "jpg"],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(settings);

      if (error) throw error;
      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={20} />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Default Quota */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default User Quota (labels per month)
          </label>
          <input
            type="number"
            value={settings.defaultQuota}
            onChange={(e) =>
              setSettings({ ...settings, defaultQuota: parseInt(e.target.value) })
            }
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bulk Upload */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.allowBulkUpload}
              onChange={(e) =>
                setSettings({ ...settings, allowBulkUpload: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              Allow Bulk Upload
            </span>
          </label>
        </div>

        {/* Require Approval */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.requireApproval}
              onChange={(e) =>
                setSettings({ ...settings, requireApproval: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              Require Admin Approval for New Users
            </span>
          </label>
        </div>

        {/* Max File Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum File Size (MB)
          </label>
          <input
            type="number"
            value={settings.maxFileSize}
            onChange={(e) =>
              setSettings({ ...settings, maxFileSize: parseInt(e.target.value) })
            }
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Allowed File Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allowed File Types
          </label>
          <div className="flex flex-wrap gap-2">
            {settings.allowedFileTypes.map((type) => (
              <span
                key={type}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 