"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Search,
  Download,
  Eye,
  Trash2,
  Filter,
} from "lucide-react";

export default function LabelsPage() {
  const [labels, setLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // all, today, week, month

  useEffect(() => {
    fetchLabels();
  }, [dateFilter]);

  const fetchLabels = async () => {
    try {
      let query = supabase
        .from("shipping_labels")
        .select(`
          *,
          profiles:user_id (email)
        `)
        .order("created_at", { ascending: false });

      // Apply date filter
      if (dateFilter !== "all") {
        const date = new Date();
        switch (dateFilter) {
          case "today":
            date.setHours(0, 0, 0, 0);
            break;
          case "week":
            date.setDate(date.getDate() - 7);
            break;
          case "month":
            date.setMonth(date.getMonth() - 1);
            break;
        }
        query = query.gte("created_at", date.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLabels(data || []);
    } catch (error) {
      console.error("Error fetching labels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (labelId: string) => {
    // Implement label download functionality
    console.log("Downloading label:", labelId);
  };

  const handleDelete = async (labelId: string) => {
    try {
      const { error } = await supabase
        .from("shipping_labels")
        .delete()
        .eq("id", labelId);

      if (error) throw error;
      fetchLabels(); // Refresh the list
    } catch (error) {
      console.error("Error deleting label:", error);
    }
  };

  const filteredLabels = labels.filter((label: any) =>
    label.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    label.profiles?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Shipping Labels</h1>
        <div className="flex gap-4">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by tracking number or user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Labels Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tracking Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredLabels.map((label: any) => (
              <tr key={label.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {label.tracking_number}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {label.profiles?.email || "Unknown User"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(label.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Generated
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleDownload(label.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Download size={18} />
                    </button>
                    <button className="text-gray-600 hover:text-gray-900">
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(label.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 