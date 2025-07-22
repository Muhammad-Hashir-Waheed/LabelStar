"use client"

import { useState, useRef } from "react"
import { ShippingLabel } from "@/components/shipping-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDown } from "lucide-react"
import { generatePDF } from "@/lib/pdf-generator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SingleLabelPage() {
  const [labelData, setLabelData] = useState({
    // Sender info
    fromZip: "75069",
    fromCity: "MCKINNEY",
    fromCompany: "",
    fromState: "TX",
    fromStreet: "510 N. KENTUCKY ST",

    // Recipient info
    toZip: "63953-8237",
    toCity: "NAYLOR",
    toName: "LARRY WERTENBERGER",
    toState: "MO",
    toStreet: "2328 RIPLEY ROUTE B",

    // Package info
    height: 5,
    length: 12,
    width: 8,
    weight: 8,

    // Tracking
    tracking: "9405 5362 0756 5275 3764 38",

    // Optional additional info
    date: "2025-03-23",
    commercialCode: "C4190745",
    labelNumber: "0003",
    routeCode: "R061",
  })

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  const handleInputChange = (field: string, value: string | number) => {
    setLabelData({
      ...labelData,
      [field]: value,
    })
  }

  const handleDownloadPDF = async () => {
    if (!labelRef.current) return

    setIsGeneratingPDF(true)
    try {
      await generatePDF([labelRef.current], "shipping-label.pdf")
    } catch (error) {
      console.error("Error generating PDF:", error)
      setError("Error generating PDF. Please try again.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create Single Shipping Label</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Tabs defaultValue="sender">
            <TabsList className="mb-4">
              <TabsTrigger value="sender">Sender</TabsTrigger>
              <TabsTrigger value="recipient">Recipient</TabsTrigger>
              <TabsTrigger value="package">Package</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="sender">
              <Card>
                <CardHeader>
                  <CardTitle>Sender Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromCompany">Company</Label>
                    <Input
                      id="fromCompany"
                      value={labelData.fromCompany}
                      onChange={(e) => handleInputChange("fromCompany", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromStreet">Street</Label>
                    <Input
                      id="fromStreet"
                      value={labelData.fromStreet}
                      onChange={(e) => handleInputChange("fromStreet", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromCity">City</Label>
                      <Input
                        id="fromCity"
                        value={labelData.fromCity}
                        onChange={(e) => handleInputChange("fromCity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromState">State</Label>
                      <Input
                        id="fromState"
                        value={labelData.fromState}
                        onChange={(e) => handleInputChange("fromState", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromZip">Zip Code</Label>
                    <Input
                      id="fromZip"
                      value={labelData.fromZip}
                      onChange={(e) => handleInputChange("fromZip", e.target.value)}
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
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="toName">Name</Label>
                    <Input
                      id="toName"
                      value={labelData.toName}
                      onChange={(e) => handleInputChange("toName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toStreet">Street</Label>
                    <Input
                      id="toStreet"
                      value={labelData.toStreet}
                      onChange={(e) => handleInputChange("toStreet", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="toCity">City</Label>
                      <Input
                        id="toCity"
                        value={labelData.toCity}
                        onChange={(e) => handleInputChange("toCity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toState">State</Label>
                      <Input
                        id="toState"
                        value={labelData.toState}
                        onChange={(e) => handleInputChange("toState", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toZip">Zip Code</Label>
                    <Input
                      id="toZip"
                      value={labelData.toZip}
                      onChange={(e) => handleInputChange("toZip", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="package">
              <Card>
                <CardHeader>
                  <CardTitle>Package Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="length">Length (in)</Label>
                      <Input
                        id="length"
                        type="number"
                        value={labelData.length}
                        onChange={(e) => handleInputChange("length", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="width">Width (in)</Label>
                      <Input
                        id="width"
                        type="number"
                        value={labelData.width}
                        onChange={(e) => handleInputChange("width", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (in)</Label>
                      <Input
                        id="height"
                        type="number"
                        value={labelData.height}
                        onChange={(e) => handleInputChange("height", Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (oz)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={labelData.weight}
                      onChange={(e) => handleInputChange("weight", Number(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tracking">
              <Card>
                <CardHeader>
                  <CardTitle>Tracking Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tracking">Tracking Number</Label>
                    <Input
                      id="tracking"
                      value={labelData.tracking}
                      onChange={(e) => handleInputChange("tracking", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      value={labelData.date}
                      onChange={(e) => handleInputChange("date", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="labelNumber">Label Number</Label>
                      <Input
                        id="labelNumber"
                        value={labelData.labelNumber}
                        onChange={(e) => handleInputChange("labelNumber", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="routeCode">Route Code</Label>
                      <Input
                        id="routeCode"
                        value={labelData.routeCode}
                        onChange={(e) => handleInputChange("routeCode", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4">
            <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="print:hidden">
              <FileDown className="mr-2 h-4 w-4" />
              {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow print:shadow-none">
          <ShippingLabel ref={labelRef} {...labelData} />
        </div>
      </div>
    </div>
  )
}
