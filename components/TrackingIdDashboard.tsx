'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle, CheckCircle } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UserTrackingAssignment {
  total_assigned: number;
  total_used: number;
  available: number;
}

export default function TrackingIdDashboard() {
  const [assignment, setAssignment] = useState<UserTrackingAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserTrackingAssignment();
  }, []);

  const loadUserTrackingAssignment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_tracking_assignments')
        .select('total_assigned, total_used')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading tracking assignment:', error);
        return;
      }

      setAssignment({
        total_assigned: data?.total_assigned || 0,
        total_used: data?.total_used || 0,
        available: (data?.total_assigned || 0) - (data?.total_used || 0)
      });
    } catch (error) {
      console.error('Error loading tracking assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tracking IDs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tracking IDs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No tracking IDs assigned</p>
            <p className="text-sm text-muted-foreground">Contact your administrator to get tracking IDs</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (assignment.available === 0) return 'text-red-600';
    if (assignment.available <= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (assignment.available === 0) return <AlertCircle className="h-4 w-4" />;
    if (assignment.available <= 5) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Tracking IDs
        </CardTitle>
        <CardDescription>
          Your tracking ID quota and usage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {assignment.available === 0 
              ? 'No tracking IDs available' 
              : assignment.available <= 5 
                ? 'Low tracking IDs remaining' 
                : 'Tracking IDs available'
            }
          </span>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{assignment.total_assigned}</div>
            <div className="text-xs text-muted-foreground">Total Assigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{assignment.total_used}</div>
            <div className="text-xs text-muted-foreground">Used</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>{assignment.available}</div>
            <div className="text-xs text-muted-foreground">Available</div>
          </div>
        </div>

        {/* Warning/Info */}
        {assignment.available === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800 font-medium">
                No tracking IDs available
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              You cannot generate shipping labels without tracking IDs. Contact your administrator.
            </p>
          </div>
        )}

        {assignment.available > 0 && assignment.available <= 5 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800 font-medium">
                Low tracking IDs remaining
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              You have {assignment.available} tracking ID{assignment.available !== 1 ? 's' : ''} remaining. 
              Consider requesting more from your administrator.
            </p>
          </div>
        )}

        {assignment.available > 5 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">
                Tracking IDs available
              </span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              You can generate {assignment.available} shipping label{assignment.available !== 1 ? 's' : ''} with tracking IDs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
