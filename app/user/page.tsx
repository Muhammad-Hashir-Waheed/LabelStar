'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, FileText, Download, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { getUserTrackingAssignment } from '@/lib/trackingIdUtils';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UserTrackingAssignment {
  total_assigned: number;
  total_used: number;
  available: number;
}

interface LabelHistory {
  id: string;
  created_at: string;
  tracking_number: string;
  recipient_name: string;
  recipient_city: string;
  recipient_state: string;
  status: 'generated' | 'downloaded';
  label_data: any;
}

export default function UserDashboard() {
  const [trackingAssignment, setTrackingAssignment] = useState<UserTrackingAssignment | null>(null);
  const [labelHistory, setLabelHistory] = useState<LabelHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTrackingAssignment(),
        loadLabelHistory()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrackingAssignment = async () => {
    try {
      const assignment = await getUserTrackingAssignment();
      setTrackingAssignment(assignment);
    } catch (error) {
      console.error('Error loading tracking assignment:', error);
    }
  };

  const loadLabelHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading label history:', error);
        return;
      }

      setLabelHistory(data || []);
    } catch (error) {
      console.error('Error loading label history:', error);
    }
  };

  const handleDownloadLabel = async (labelId: string) => {
    try {
      // Get the label data
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('id', labelId)
        .single();

      if (error) {
        console.error('Error fetching label data:', error);
        return;
      }

      // Update status to downloaded
      await supabase
        .from('shipping_labels')
        .update({ status: 'downloaded' })
        .eq('id', labelId);

      // Generate and download the label
      // This would integrate with your existing label generation logic
      console.log('Downloading label:', data);
      
      // For now, just show an alert
      alert('Label download functionality would be implemented here');
      
      // Reload history to update status
      loadLabelHistory();
    } catch (error) {
      console.error('Error downloading label:', error);
    }
  };

  const handleViewLabel = async (labelId: string) => {
    try {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('id', labelId)
        .single();

      if (error) {
        console.error('Error fetching label data:', error);
        return;
      }

      // Navigate to label view page
      window.open(`/single-label/${labelId}`, '_blank');
    } catch (error) {
      console.error('Error viewing label:', error);
    }
  };

  const getStatusColor = () => {
    if (!trackingAssignment) return 'text-gray-600';
    if (trackingAssignment.available === 0) return 'text-red-600';
    if (trackingAssignment.available <= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (!trackingAssignment) return <Clock className="h-4 w-4" />;
    if (trackingAssignment.available === 0) return <AlertCircle className="h-4 w-4" />;
    if (trackingAssignment.available <= 5) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your shipping label overview.</p>
      </div>

      {/* Tracking ID Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tracking ID Status
          </CardTitle>
          <CardDescription>
            Your tracking ID quota and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trackingAssignment ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`font-medium ${getStatusColor()}`}>
                  {trackingAssignment.available === 0 
                    ? 'No tracking IDs available' 
                    : trackingAssignment.available <= 5 
                      ? 'Low tracking IDs remaining' 
                      : 'Tracking IDs available'
                  }
                </span>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{trackingAssignment.total_assigned}</div>
                  <div className="text-xs text-muted-foreground">Total Assigned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{trackingAssignment.total_used}</div>
                  <div className="text-xs text-muted-foreground">Used</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getStatusColor()}`}>{trackingAssignment.available}</div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Link href="/user/shipping-label">
                  <Button className="w-full">
                    Generate New Label
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No tracking IDs assigned</p>
              <p className="text-sm text-muted-foreground">Contact your administrator to get tracking IDs</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Label History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Label History
          </CardTitle>
          <CardDescription>
            Your recently generated shipping labels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {labelHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tracking Number</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labelHistory.map((label) => (
                    <TableRow key={label.id}>
                      <TableCell>{formatDate(label.created_at)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {label.tracking_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{label.recipient_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {label.recipient_city}, {label.recipient_state}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={label.status === 'downloaded' ? 'default' : 'secondary'}>
                          {label.status === 'downloaded' ? 'Downloaded' : 'Generated'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewLabel(label.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadLabel(label.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No labels generated yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Start by generating your first shipping label
              </p>
              <Link href="/user/shipping-label">
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate First Label
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 