'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Users, Package, BarChart3, Plus, Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface TrackingId {
  id: string;
  tracking_number: string;
  status: 'available' | 'assigned' | 'used';
  assigned_to: string | null;
  assigned_at: string | null;
  used_at: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  } | null;
}

interface TrackingIdStats {
  total_tracking_ids: number;
  available_tracking_ids: number;
  assigned_tracking_ids: number;
  used_tracking_ids: number;
  user_assignments: Array<{
    user_id: string;
    user_email: string;
    full_name: string | null;
    total_assigned: number;
    total_used: number;
    available: number;
  }>;
}

export default function TrackingIdsPage() {
  const [stats, setStats] = useState<TrackingIdStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [trackingIds, setTrackingIds] = useState<TrackingId[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [assignQuantity, setAssignQuantity] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadTrackingIds()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // First check if full_name column exists
      const { data: profileColumns, error: columnsError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (columnsError) {
        console.error('Error checking profiles table:', columnsError);
        toast.error('Failed to check profiles table structure');
        return;
      }

      // Load users
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('role', 'user')
        .order('email');
      
      if (error) {
        console.error('Error loading users:', error);
        toast.error('Failed to load users');
        return;
      }
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadTrackingIds = async () => {
    try {
      // First try with full_name
      const { data, error } = await supabase
        .from('tracking_ids')
        .select(`
          *,
          profiles!tracking_ids_assigned_to_fkey (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        // If error, try without full_name
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('tracking_ids')
          .select(`
            *,
            profiles!tracking_ids_assigned_to_fkey (
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (fallbackError) {
          console.error('Error loading tracking IDs:', fallbackError);
          toast.error('Failed to load tracking IDs');
          return;
        }
        setTrackingIds(fallbackData || []);
      } else {
        setTrackingIds(data || []);
      }
    } catch (error) {
      console.error('Error loading tracking IDs:', error);
      toast.error('Failed to load tracking IDs');
    }
  };

  const loadStats = async () => {
    try {
      // First try get_tracking_id_stats function
      const { data, error } = await supabase.rpc('get_tracking_id_stats');
      
      if (error) {
        // If function doesn't exist, get stats manually
        const [totalCount, availableCount, assignedCount, usedCount] = await Promise.all([
          supabase.from('tracking_ids').select('count'),
          supabase.from('tracking_ids').select('count').eq('status', 'available'),
          supabase.from('tracking_ids').select('count').eq('status', 'assigned'),
          supabase.from('tracking_ids').select('count').eq('status', 'used')
        ]);

        const stats = {
          total_tracking_ids: totalCount.count || 0,
          available_tracking_ids: availableCount.count || 0,
          assigned_tracking_ids: assignedCount.count || 0,
          used_tracking_ids: usedCount.count || 0,
          user_assignments: []
        };

        setStats(stats);
      } else {
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load tracking ID stats');
    }
  };

  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleData = [
      { 'Tracking Number': '9405536207565275376438' },
      { 'Tracking Number': '9405536207565275376439' },
      { 'Tracking Number': '9405536207565275376440' },
      { 'Tracking Number': '9405536207565275376441' },
      { 'Tracking Number': '9405536207565275376442' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tracking Numbers');

    // Convert to binary string
    const wbout = XLSX.write(workbook, { bookType: format, type: 'binary' });

    // Convert binary string to ArrayBuffer
    const buf = new ArrayBuffer(wbout.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < wbout.length; i++) {
      view[i] = wbout.charCodeAt(i) & 0xff;
    }

    // Create Blob and download
    const blob = new Blob([buf], {
      type: format === 'csv' 
        ? 'text/csv' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracking_numbers_template.${format}`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);
      
      let trackingNumbers: string[] = [];
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Handle Excel files
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Extract tracking numbers from the first column
        trackingNumbers = jsonData
          .map((row: any) => row[0]) // Get first column
          .filter((value: any) => value && String(value).trim().length > 0) // Filter out empty values
          .map((value: any) => String(value).trim()); // Convert to string and trim
      } else if (fileExtension === 'csv' || fileExtension === 'txt') {
        // Handle CSV and text files
        const text = await selectedFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        trackingNumbers = lines.map(line => line.trim()).filter(line => line.length > 0);
      } else {
        toast.error('Unsupported file format. Please use .xlsx, .xls, .csv, or .txt files');
        return;
      }
      
      if (trackingNumbers.length === 0) {
        toast.error('No tracking numbers found in file');
        return;
      }

      console.log('Extracted tracking numbers:', trackingNumbers.slice(0, 5)); // Log first 5 for debugging

      // Upload to database
      const { data, error } = await supabase.rpc('bulk_upload_tracking_ids', {
        tracking_numbers: trackingNumbers,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Error uploading tracking IDs:', error);
        toast.error(`Failed to upload tracking IDs: ${error.message}`);
        return;
      }

      toast.success(`Successfully uploaded ${data.inserted} tracking IDs`);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      loadData();
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const handleAssignTrackingIds = async () => {
    if (!selectedUser || assignQuantity <= 0) {
      toast.error('Please select a user and enter a valid quantity');
      return;
    }

    try {
      setAssigning(true);
      
      const { data, error } = await supabase.rpc('assign_tracking_ids_to_user', {
        target_user_id: selectedUser,
        quantity: assignQuantity,
        assigned_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Error assigning tracking IDs:', error);
        toast.error(error.message || 'Failed to assign tracking IDs');
        return;
      }

      toast.success(`Successfully assigned ${data.assigned} tracking IDs`);
      setAssignDialogOpen(false);
      setSelectedUser('');
      setAssignQuantity(1);
      loadData();
    } catch (error) {
      console.error('Error assigning tracking IDs:', error);
      toast.error('Failed to assign tracking IDs');
    } finally {
      setAssigning(false);
    }
  };

  const handleRevokeTrackingIds = async (userId: string, quantity: number) => {
    if (!confirm(`Are you sure you want to revoke ${quantity} tracking IDs from this user?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('revoke_tracking_ids_from_user', {
        target_user_id: userId,
        quantity: quantity,
        revoked_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Error revoking tracking IDs:', error);
        toast.error('Failed to revoke tracking IDs');
        return;
      }

      toast.success(`Successfully revoked ${data.revoked} tracking IDs`);
      loadData();
    } catch (error) {
      console.error('Error revoking tracking IDs:', error);
      toast.error('Failed to revoke tracking IDs');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="secondary">Available</Badge>;
      case 'assigned':
        return <Badge variant="default">Assigned</Badge>;
      case 'used':
        return <Badge variant="destructive">Used</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTrackingNumber = (number: string) => {
    // Format as USPS tracking number: 9300 1201 1141 1476 2251 30
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.length === 22) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)} ${cleaned.slice(16, 20)} ${cleaned.slice(20)}`;
    }
    return number;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Loading tracking ID management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tracking ID Management</h1>
          <p className="text-muted-foreground">Manage USPS tracking IDs for shipping labels</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Tracking IDs
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Tracking IDs</DialogTitle>
                <DialogDescription>
                  Upload a CSV or Excel file containing USPS tracking numbers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadTemplate('xlsx')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel Template
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadTemplate('csv')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    CSV Template
                  </Button>
                </div>
                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Supported formats:</strong> .xlsx, .xls, .csv, .txt</p>
                  <p><strong>File format:</strong> One tracking number per row in the first column</p>
                  <p><strong>Example:</strong> 9405536207565275376438</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleFileUpload} disabled={!selectedFile || uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Assign to User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Tracking IDs</DialogTitle>
                <DialogDescription>
                  Assign tracking IDs to a specific user
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user">Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={assignQuantity}
                    onChange={(e) => setAssignQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignTrackingIds} disabled={!selectedUser || assignQuantity <= 0 || assigning}>
                  {assigning ? 'Assigning...' : 'Assign'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tracking IDs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_tracking_ids}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.available_tracking_ids}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.assigned_tracking_ids}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Used</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.used_tracking_ids}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Assignments */}
      {stats?.user_assignments && stats.user_assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>User Assignments</CardTitle>
            <CardDescription>Current tracking ID assignments by user</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Total Assigned</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.user_assignments.map((assignment) => (
                  <TableRow key={assignment.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.full_name || assignment.user_email}</div>
                        <div className="text-sm text-muted-foreground">{assignment.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{assignment.total_assigned}</TableCell>
                    <TableCell>{assignment.total_used}</TableCell>
                    <TableCell>{assignment.available}</TableCell>
                    <TableCell>
                      {assignment.available > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeTrackingIds(assignment.user_id, assignment.available)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoke All
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Tracking IDs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tracking IDs</CardTitle>
          <CardDescription>Latest tracking IDs in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trackingIds.map((trackingId) => (
                <TableRow key={trackingId.id}>
                  <TableCell className="font-mono">
                    {formatTrackingNumber(trackingId.tracking_number)}
                  </TableCell>
                  <TableCell>{getStatusBadge(trackingId.status)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {trackingId.profiles?.full_name || trackingId.profiles?.email || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {trackingId.profiles?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(trackingId.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
