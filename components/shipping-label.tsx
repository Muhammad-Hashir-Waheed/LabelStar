"use client";
import { useBarcode } from "next-barcode";
import { QRCodeCanvas } from "qrcode.react";
import { forwardRef, useEffect, useRef } from "react";

interface ShippingLabelProps {
  // Product info
  description?: string;

  // Sender info
  fromZip?: string | number;
  fromCity?: string;
  fromCompany?: string;
  fromState?: string;
  fromStreet?: string;

  // Recipient info
  toZip?: string | number;
  toCity?: string;
  toName?: string;
  toState?: string;
  toStreet?: string;

  // Package info
  height?: number;
  length?: number;
  width?: number;
  weight?: number;

  // Tracking
  tracking?: string | number;

  // Optional additional info
  date?: string;
  commercialCode?: string;
  labelNumber?: string;
  routeCode?: string;
}

export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(
  (
    {
      // Product info
      description,

      // Sender info
      fromZip,
      fromCity,
      fromCompany,
      fromState,
      fromStreet,

      // Recipient info
      toZip,
      toCity,
      toName,
      toState,
      toStreet,

      // Package info
      height,
      length,
      width,
      weight,

      // Tracking
      tracking,

      // Optional additional info
      date = "2025-03-23",
      commercialCode = "C4190745",
      labelNumber = "0003",
      routeCode = "R061",
    },
    ref
  ) => {
    // Format tracking number (handle scientific notation)
    const formattedTracking =
      typeof tracking === "number"
        ? tracking.toFixed(0)
        : tracking?.toString() || "9405 5362 0756 5275 3764 38";

    // Format zip codes
    const formattedFromZip = fromZip?.toString() || "75069";
    const formattedToZip = toZip?.toString() || "63953-8237";

    // Format weight
    const formattedWeight = weight
      ? `${(weight / 16).toFixed(1)} LB`
      : "0.5 LB";

    // Create refs for QR codes
    const addressQrRef = useRef<HTMLDivElement>(null);
    const trackingQrRef = useRef<HTMLDivElement>(null);

    const { inputRef: postageRef } = useBarcode({
      value: "090100000841",
      options: {
        format: "code128",
        displayValue: false,
        height: 50,
        width: 1.5,
        margin: 0,
        background: "#ffffff",
      },
    });

    const { inputRef: trackingRef } = useBarcode({
      value: formattedTracking.replace(/\s/g, ""),
      options: {
        format: "code128",
        displayValue: false,
        height: 70,
        width: 1.5,
        margin: 0,
        background: "#ffffff",
      },
    });

    // Ensure all elements are properly rendered
    useEffect(() => {
      const timer = setTimeout(() => {
        // Force re-render of barcodes if needed
        if (postageRef.current) {
          const parent = postageRef.current.parentElement;
          if (parent && !postageRef.current.getContext) {
            const clone = postageRef.current.cloneNode(true);
            parent.replaceChild(clone, postageRef.current);
          }
        }

        if (trackingRef.current) {
          const parent = trackingRef.current.parentElement;
          if (parent && !trackingRef.current.getContext) {
            const clone = trackingRef.current.cloneNode(true);
            parent.replaceChild(clone, trackingRef.current);
          }
        }
      }, 200);

      return () => clearTimeout(timer);
    }, [postageRef, trackingRef]);

    return (
      <div
        ref={ref}
        style={{
          width: 550,
          // border: "3px solid #000",
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#fff",
          margin: "0",
          pageBreakInside: "avoid",
        }}
      >
        {/* Top section */}
        <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
          <div
            style={{
              width: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRight: "1px solid #000",
            }}
          >
            <span
              style={{
                fontSize: 90,
                fontWeight: "600",
                lineHeight: 1,
                padding: "2rem",
                fontFamily: "OCR-A, OCR-B, Arial, Helvetica, sans-serif",
              }}
            >
              P
            </span>
          </div>
          <div style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: 14 }}>
            <div
              style={{
                fontSize: 22,
                display: "flex",
                flexDirection: "row",
                fontWeight: "bold",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontFamily: "OCR-A, OCR-B, Arial, Helvetica, sans-serif",
              }}
            >
              <div style={{ fontWeight: "600", fontSize: 18 }}>
                US POSTAGE AND FEES PAID
              </div>
              easypost
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: "600",
                justifyContent: "space-between",
              }}
            >
              {date}{" "}
              <canvas ref={postageRef} style={{ width: 300, height: 60 }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: "600" }}>
              {formattedFromZip}
            </div>
            <div style={{ fontSize: 13, fontWeight: "600" }}>
              {commercialCode}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: "600",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 13, alignSelf: "center" }}>
                Commercial
              </div>
              <div style={{ fontSize: 13, alignSelf: "center" }}>
                090100000841
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: "600" }}>
              {formattedWeight} ZONE 4
              <div style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
                US POSTAGE AND FEES PAID
              </div>
            </div>
          </div>
        </div>

        {/* Middle section */}
        <div style={{ borderBottom: "3px solid #000" }}>
          <div
            style={{
              textAlign: "center",
              fontWeight: "700",
              fontSize: 28,
              padding: "0.5rem 0",
              marginBottom: "10px",
              borderBottom: "2px solid #000",
              letterSpacing: 1,
            }}
          >
            USPS PRIORITY MAIL
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 10px",
              marginBottom: "60px",
            }}
          >
            <div style={{ width: "75%" }}>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: "bold", fontSize: 13 }}>
                  {fromState || "TX"}
                </div>
                <div style={{ fontSize: 13, fontWeight: "bold" }}>
                  {fromStreet || "510 N. KENTUCKY ST"}
                </div>
                <div style={{ fontSize: 13, fontWeight: "bold" }}>
                  {fromCity || "MCKINNEY"} {fromState || "TX"}{" "}
                  {formattedFromZip}
                </div>
              </div>
              <div style={{ marginTop: 70, display: "flex" }}>
                <div style={{ marginRight: 12 }} ref={addressQrRef}>
                  <QRCodeCanvas
                    value={`${toName || "LARRY WERTENBERGER"}, ${
                      toStreet || "2328 RIPLEY ROUTE B"
                    }, ${toCity || "NAYLOR"} ${
                      toState || "MO"
                    } ${formattedToZip}`}
                    size={60}
                    level="H"
                  />
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: "bold", fontSize: 12 }}>
                    {toName || "LARRY WERTENBERGER"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: "bold" }}>
                    {toStreet || "2328 RIPLEY ROUTE B"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: "bold" }}>
                    {toCity || "NAYLOR"} {toState || "MO"} {formattedToZip}
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                width: "25%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 8,
                  fontFamily: "OCR-A, OCR-B, Arial, Helvetica, sans-serif",
                }}
              >
                {labelNumber}
              </div>
              <div
                style={{
                  border: "2px solid #000",
                  padding: "0.25rem 0.75rem",
                  fontWeight: "bold",
                  fontSize: 18,
                  textAlign: "center",
                  paddingBottom: "10px",
                  fontFamily: "OCR-A, OCR-B, Arial, Helvetica, sans-serif",
                }}
              >
                {routeCode}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div style={{ padding: "1rem 0.5rem 0.5rem 0.5rem" }}>
          <div
            style={{
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "10px",
              fontSize: 18,
              letterSpacing: 1,
            }}
          >
            USPS TRACKING #
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <canvas ref={trackingRef} style={{ width: 450, height: 100 }} />
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 4,
              fontSize: 18,
              fontWeight: "600",
              fontFamily: "OCR-A, OCR-B, Arial, Helvetica, sans-serif",
            }}
          >
            {formattedTracking}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 8,
              borderTop: "3px solid #000",
              padding: "10px ",
            }}
            ref={trackingQrRef}
          >
            <QRCodeCanvas value={formattedTracking} size={60} level="H" />
          </div>
        </div>
      </div>
    );
  }
);

ShippingLabel.displayName = "ShippingLabel";
