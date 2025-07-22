"use client";

import type React from "react";

import { useState, useRef } from "react";
import { ShippingLabel } from "@/components/shipping-label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { AlertCircle, Download, FileDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ShippingData {
  Description?: string;
  "From Zip"?: string | number;
  FromZip?: string | number;
  FromCity?: string;
  FromCompany?: string;
  FromState?: string;
  FromStreet?: string;
  Height?: number;
  Length?: number;
  TRAKING?: string | number;
  Tracking?: string | number;
  ToCity?: string;
  ToName?: string;
  ToState?: string;
  ToStreet?: string;
  ToZip?: string | number;
  Weight?: number;
  Width?: number;
  __rowNum__?: number;
  [key: string]: any;
}

export default function BulkUploadPage() {
  const [shippingData, setShippingData] = useState<ShippingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    // Determine file type from extension
    const extension = file.name.split(".").pop()?.toLowerCase();
    setFileType(extension || null);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        let parsedData: ShippingData[] = [];

        // Parse based on file type
        if (extension === "csv") {
          // For CSV files
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json<ShippingData>(worksheet);
        } else if (extension === "xlsx" || extension === "xls") {
          // For Excel files
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json<ShippingData>(worksheet);
        } else {
          throw new Error("Unsupported file format");
        }

        if (parsedData.length === 0) {
          setError("The file doesn't contain any data");
          setShippingData([]);
        } else {
          setShippingData(parsedData);
          // Reset the refs array to match the new data length
          labelsRef.current = labelsRef.current.slice(0, parsedData.length);
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        setError(
          `Error parsing ${
            extension?.toUpperCase() || "file"
          }. Please check the format.`
        );
        setShippingData([]);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setIsLoading(false);
      setError("Error reading file");
      setShippingData([]);
    };

    reader.readAsBinaryString(file);
  };

  const handleDownloadPDF = async () => {
    if (shippingData.length === 0) return;

    setIsGeneratingPDF(true);
    try {
      await exportPDF();
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Error generating PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  function downloadTemplate(format: "xlsx" | "csv") {
    const sampleData = [
      {
        Description: "SunButter Sunflower Butter Natural Creamy",
        "From Zip": 75069,
        FromCity: "MCKINNEY",
        FromCompany: "",
        FromState: "TX",
        FromStreet: "510 N. KENTUCKY ST",
        Height: 5,
        Length: 12,
        TRAKING: "9405 5362 0756 5275 3764 38",
        ToCity: "NAYLOR",
        ToName: "LARRY WERTENBERGER",
        ToState: "MO",
        ToStreet: "2328 RIPLEY ROUTE B",
        ToZip: "63953-8237",
        Weight: 8,
        Width: 8,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shipping Data");

    // Convert to binary string
    const wbout = XLSX.write(workbook, { bookType: format, type: "binary" });

    // Convert binary string to ArrayBuffer
    const buf = new ArrayBuffer(wbout.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < wbout.length; i++) {
      view[i] = wbout.charCodeAt(i) & 0xff;
    }

    // Create Blob and download
    const blob = new Blob([buf], {
      type:
        format === "csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      format === "csv"
        ? "shipping_label_template.csv"
        : "shipping_label_template.xlsx";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  const exportPDF = async () => {
    if (!labelsRef.current.length) return;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    for (let i = 0; i < labelsRef.current.length; i++) {
      const el = labelsRef.current[i];
      if (!el) continue;
      const canvas = await html2canvas(el);
      const imgData = canvas.toDataURL("image/png");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const w = imgWidth * ratio;
      const h = imgHeight * ratio;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
    }
    pdf.save("shipping-labels.pdf");
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Card>
          <CardHeader>
            <CardTitle>Bulk Shipping Label Generator</CardTitle>
            <CardDescription>
              Upload an Excel or CSV file with shipping data to generate
              multiple labels at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div>
                <Label htmlFor="file-upload">Upload File</Label>
                <div
                  style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}
                >
                  <div style={{ flex: 1 }}>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      disabled={isLoading}
                      style={{ cursor: "pointer", width: "100%" }}
                    />
                  </div>
                  <Tabs defaultValue="xlsx" style={{ width: 180 }}>
                    <TabsList
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        width: "100%",
                      }}
                    >
                      <TabsTrigger value="xlsx">Excel</TabsTrigger>
                      <TabsTrigger value="csv">CSV</TabsTrigger>
                    </TabsList>
                    <TabsContent value="xlsx">
                      <Button
                        variant="outline"
                        onClick={() => downloadTemplate("xlsx")}
                        style={{ width: "100%" }}
                      >
                        <Download
                          style={{ marginRight: 8, height: 16, width: 16 }}
                        />
                        Template
                      </Button>
                    </TabsContent>
                    <TabsContent value="csv">
                      <Button
                        variant="outline"
                        onClick={() => downloadTemplate("csv")}
                        style={{ width: "100%" }}
                      >
                        <Download
                          style={{ marginRight: 8, height: 16, width: 16 }}
                        />
                        Template
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
                {fileName && !error && (
                  <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                    File: {fileName} ({fileType?.toUpperCase()})
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle style={{ height: 16, width: 16 }} />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isLoading && <p style={{ marginTop: 8 }}>Loading data...</p>}

              {shippingData.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <p style={{ fontSize: 14 }}>
                    Generated {shippingData.length} shipping label
                    {shippingData.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    onClick={exportPDF}
                    disabled={isGeneratingPDF}
                    style={{ marginTop: 4 }}
                  >
                    <FileDown
                      style={{ marginRight: 8, height: 16, width: 16 }}
                    />
                    {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        style={{
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {shippingData.map((data, index) => (
          <div
            key={index}
            style={{ pageBreakAfter: "always", marginBottom: 0 }}
          >
            <ShippingLabel
              ref={(el) => {
                if (el) {
                  labelsRef.current[index] = el;
                }
              }}
              description={data.Description}
              fromZip={data["From Zip"] || data.FromZip}
              fromCity={data.FromCity}
              fromCompany={data.FromCompany}
              fromState={data.FromState}
              fromStreet={data.FromStreet}
              height={data.Height}
              length={data.Length}
              tracking={data.TRAKING || data.Tracking}
              toCity={data.ToCity}
              toName={data.ToName}
              toState={data.ToState}
              toStreet={data.ToStreet}
              toZip={data.ToZip}
              weight={data.Weight}
              width={data.Width}
              labelNumber={`${String(index + 1).padStart(4, "0")}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
