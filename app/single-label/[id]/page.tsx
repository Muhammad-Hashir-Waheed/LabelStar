'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import { ShippingLabel } from '@/components/shipping-label';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LabelData {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_city: string;
  recipient_state: string;
  recipient_zip: string;
  recipient_street: string;
  sender_state: string;
  sender_city: string;
  sender_zip: string;
  sender_street: string;
  label_data: any;
  status: string;
  created_at: string;
}

export default function SingleLabelPage() {
  const params = useParams();
  const labelId = params.id as string;
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLabelData();
  }, [labelId]);

  const loadLabelData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('id', labelId)
        .single();

      if (error) {
        console.error('Error loading label:', error);
        setError('Label not found or access denied');
        return;
      }

      setLabelData(data);
    } catch (error) {
      console.error('Error loading label:', error);
      setError('Failed to load label');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!labelData) return;

    try {
      // Update status to downloaded
      await supabase
        .from('shipping_labels')
        .update({ status: 'downloaded' })
        .eq('id', labelData.id);

      // Reload data to update status
      await loadLabelData();

      // Here you would implement the actual download logic
      // For now, just show an alert
      alert('Label download functionality would be implemented here');
    } catch (error) {
      console.error('Error downloading label:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !labelData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Label Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The requested label could not be found.'}</p>
          <Link href="/user">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Convert database data to label component format
  const labelComponentData = {
    date: labelData.label_data?.date || new Date(labelData.created_at).toISOString().split('T')[0],
    zipCode: labelData.label_data?.zipCode || '',
    commercialCode: labelData.label_data?.commercialCode || '',
    weight: labelData.label_data?.weight || '',
    zone: labelData.label_data?.zone || '',
    postageBarcode: labelData.label_data?.postageBarcode || '',
    senderAddress: {
      state: labelData.sender_state,
      street: labelData.sender_street,
      city: labelData.sender_city,
      zip: labelData.sender_zip,
    },
    recipientAddress: {
      name: labelData.recipient_name,
      street: labelData.recipient_street,
      city: labelData.recipient_city,
      state: labelData.recipient_state,
      zip: labelData.recipient_zip,
    },
    labelNumber: labelData.label_data?.labelNumber || '0001',
    routeCode: labelData.label_data?.routeCode || 'R001',
    trackingNumber: labelData.tracking_number,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/user">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipping Label</h1>
            <p className="text-gray-600">Generated on {new Date(labelData.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={labelData.status === 'downloaded' ? 'default' : 'secondary'}>
            {labelData.status === 'downloaded' ? 'Downloaded' : 'Generated'}
          </Badge>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Label Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tracking Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Tracking Number:</span>
                <p className="font-mono text-sm">{labelData.tracking_number}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status:</span>
                <p className="capitalize">{labelData.status}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Created:</span>
                <p>{new Date(labelData.created_at).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recipient</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Name:</span>
                <p>{labelData.recipient_name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Address:</span>
                <p>{labelData.recipient_street}</p>
                <p>{labelData.recipient_city}, {labelData.recipient_state} {labelData.recipient_zip}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sender</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Address:</span>
                <p>{labelData.sender_street}</p>
                <p>{labelData.sender_city}, {labelData.sender_state} {labelData.sender_zip}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Label Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Label Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-white">
            <ShippingLabel {...labelComponentData} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 