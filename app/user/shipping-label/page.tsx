"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShippingLabel } from "@/components/shipping-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getUserTrackingAssignment, hasAvailableTrackingIds, consumeTrackingIdForLabel, formatTrackingNumber } from "@/lib/trackingIdUtils";
import LoginPage from "@/app/login/page";
import "./shipping-label.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default function ShippingLabelPage() {
  const router = useRouter();
  const [trackingAssignment, setTrackingAssignment] = useState<{
    total_assigned: number;
    total_used: number;
    available: number;
  } | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(true);
  const [labelData, setLabelData] = useState({
    // Top section
    date: "2025-03-23",
    zipCode: "75069",
    commercialCode: "C4190745",
    weight: "0.5 LB",
    zone: "ZONE 4",
    postageBarcode: "090100000841",

    // Middle section
    senderAddress: {
      state: "TX",
      street: "510 N. KENTUCKY ST",
      city: "MCKINNEY",
      zip: "75069",
    },
    recipientAddress: {
      name: "LARRY WERTENBERGER",
      street: "2328 RIPLEY ROUTE B",
      city: "NAYLOR",
      state: "MO",
      zip: "63953-8237",
    },
    labelNumber: "0003",
    routeCode: "R061",

    // Bottom section
    trackingNumber: "9405 5362 0756 5275 3764 38",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/");
      } else {
        loadTrackingAssignment();
      }
    });
  }, [router]);

  const loadTrackingAssignment = async () => {
    try {
      setLoadingTracking(true);
      const assignment = await getUserTrackingAssignment();
      setTrackingAssignment(assignment);
    } catch (error) {
      console.error('Error loading tracking assignment:', error);
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleGenerateLabel = async () => {
    try {
      // Check if user has tracking IDs available
      const hasTrackingIds = await hasAvailableTrackingIds();
      if (!hasTrackingIds) {
        alert('No tracking IDs available. Please contact your administrator to get tracking IDs assigned.');
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Create a label ID for tracking ID consumption
      const labelId = crypto.randomUUID();
      
      // Consume a tracking ID
      const trackingNumber = await consumeTrackingIdForLabel(labelId);
      
      // Update the label data with the consumed tracking number
      const updatedLabelData = {
        ...labelData,
        trackingNumber: formatTrackingNumber(trackingNumber)
      };
      
      setLabelData(updatedLabelData);

      // Save the label to the database
      const { error: saveError } = await supabase
        .from('shipping_labels')
        .insert({
          id: labelId,
          user_id: user.id,
          tracking_number: trackingNumber,
          recipient_name: updatedLabelData.recipientAddress.name,
          recipient_city: updatedLabelData.recipientAddress.city,
          recipient_state: updatedLabelData.recipientAddress.state,
          recipient_zip: updatedLabelData.recipientAddress.zip,
          recipient_street: updatedLabelData.recipientAddress.street,
          sender_state: updatedLabelData.senderAddress.state,
          sender_city: updatedLabelData.senderAddress.city,
          sender_zip: updatedLabelData.senderAddress.zip,
          sender_street: updatedLabelData.senderAddress.street,
          label_data: updatedLabelData,
          status: 'generated',
          created_at: new Date().toISOString()
        });

      if (saveError) {
        console.error('Error saving label:', saveError);
        alert('Label generated but failed to save to history');
      }

      // Reload tracking assignment to show updated counts
      await loadTrackingAssignment();

      alert(`Label generated successfully! Tracking number: ${formatTrackingNumber(trackingNumber)}`);
    } catch (error) {
      console.error('Error generating label:', error);
      alert('Failed to generate label. Please try again.');
    }
  };

  const handleInputChange = (section: string, field: string, value: string) => {
    if (section === "senderAddress" || section === "recipientAddress") {
      setLabelData({
        ...labelData,
        [section]: {
          ...(labelData[section as keyof typeof labelData] as any),
          [field]: value,
        },
      });
    } else {
      setLabelData({
        ...labelData,
        [field]: value,
      });
    }
  };

  return (
    <div className="shipping-label-container">
      <h1 className="shipping-label-title">USPS Shipping Label Generator</h1>
      
      {/* Tracking ID Dashboard */}
      <div style={{ marginBottom: '2rem' }}>
        <Card>
          <CardHeader>
            <CardTitle>Tracking ID Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTracking ? (
              <div>Loading tracking ID status...</div>
            ) : trackingAssignment ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: trackingAssignment.available > 0 ? '#16a34a' : '#dc2626' }}>
                    {trackingAssignment.available} Tracking IDs Available
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {trackingAssignment.total_used} used of {trackingAssignment.total_assigned} assigned
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateLabel}
                  disabled={trackingAssignment.available === 0}
                  style={{ backgroundColor: trackingAssignment.available > 0 ? '#16a34a' : '#9ca3af' }}
                >
                  Generate Label with Tracking ID
                </Button>
              </div>
            ) : (
              <div style={{ color: '#dc2626' }}>
                No tracking IDs assigned. Please contact your administrator.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="shipping-label-grid">
        <div className="shipping-label-form-section">
          <Tabs defaultValue="basic">
            <TabsList className="tabs-list">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="sender">Sender</TabsTrigger>
              <TabsTrigger value="recipient">Recipient</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        value={labelData.date}
                        onChange={(e) =>
                          handleInputChange("", "date", e.target.value)
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <Label htmlFor="zipCode">Zip Code</Label>
                      <Input
                        id="zipCode"
                        value={labelData.zipCode}
                        onChange={(e) =>
                          handleInputChange("", "zipCode", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="commercialCode">Commercial Code</Label>
                    <Input
                      id="commercialCode"
                      value={labelData.commercialCode}
                      onChange={(e) =>
                        handleInputChange("", "commercialCode", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      value={labelData.weight}
                      onChange={(e) =>
                        handleInputChange("", "weight", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="zone">Zone</Label>
                    <Input
                      id="zone"
                      value={labelData.zone}
                      onChange={(e) =>
                        handleInputChange("", "zone", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="labelNumber">Label Number</Label>
                    <Input
                      id="labelNumber"
                      value={labelData.labelNumber}
                      onChange={(e) =>
                        handleInputChange("", "labelNumber", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="routeCode">Route Code</Label>
                    <Input
                      id="routeCode"
                      value={labelData.routeCode}
                      onChange={(e) =>
                        handleInputChange("", "routeCode", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="trackingNumber">Tracking Number</Label>
                    <Input
                      id="trackingNumber"
                      value={labelData.trackingNumber}
                      onChange={(e) =>
                        handleInputChange("", "trackingNumber", e.target.value)
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="postageBarcode">Postage Barcode</Label>
                    <Input
                      id="postageBarcode"
                      value={labelData.postageBarcode}
                      onChange={(e) =>
                        handleInputChange("", "postageBarcode", e.target.value)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sender">
              <Card>
                <CardHeader>
                  <CardTitle>Sender Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="senderState">State</Label>
                    <Input
                      id="senderState"
                      value={labelData.senderAddress.state}
                      onChange={(e) =>
                        handleInputChange(
                          "senderAddress",
                          "state",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="senderStreet">Street</Label>
                    <Input
                      id="senderStreet"
                      value={labelData.senderAddress.street}
                      onChange={(e) =>
                        handleInputChange(
                          "senderAddress",
                          "street",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="senderCity">City</Label>
                    <Input
                      id="senderCity"
                      value={labelData.senderAddress.city}
                      onChange={(e) =>
                        handleInputChange(
                          "senderAddress",
                          "city",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="senderZip">Zip</Label>
                    <Input
                      id="senderZip"
                      value={labelData.senderAddress.zip}
                      onChange={(e) =>
                        handleInputChange(
                          "senderAddress",
                          "zip",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recipient">
              <Card>
                <CardHeader>
                  <CardTitle>Recipient Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="recipientName">Name</Label>
                    <Input
                      id="recipientName"
                      value={labelData.recipientAddress.name}
                      onChange={(e) =>
                        handleInputChange(
                          "recipientAddress",
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="recipientStreet">Street</Label>
                    <Input
                      id="recipientStreet"
                      value={labelData.recipientAddress.street}
                      onChange={(e) =>
                        handleInputChange(
                          "recipientAddress",
                          "street",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="recipientCity">City</Label>
                    <Input
                      id="recipientCity"
                      value={labelData.recipientAddress.city}
                      onChange={(e) =>
                        handleInputChange(
                          "recipientAddress",
                          "city",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="recipientState">State</Label>
                    <Input
                      id="recipientState"
                      value={labelData.recipientAddress.state}
                      onChange={(e) =>
                        handleInputChange(
                          "recipientAddress",
                          "state",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <Label htmlFor="recipientZip">Zip</Label>
                    <Input
                      id="recipientZip"
                      value={labelData.recipientAddress.zip}
                      onChange={(e) =>
                        handleInputChange(
                          "recipientAddress",
                          "zip",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="shipping-label-preview-section">
          <ShippingLabel {...labelData} weight={Number(labelData.weight)} />
        </div>
      </div>
    </div>
  );
}
