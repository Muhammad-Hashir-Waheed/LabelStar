import jsPDF from "jspdf"
import html2canvas from "html2canvas"

export async function generatePDF(elements: (HTMLElement | null)[], filename: string): Promise<void> {
  if (!elements.length || elements.every((el) => el === null)) {
    throw new Error("No elements to generate PDF from")
  }

  // Filter out null elements
  const validElements = elements.filter((el): el is HTMLElement => el !== null)

  // Create a new PDF document with letter size (8.5 x 11 inches)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  })

  // Process each element
  for (let i = 0; i < validElements.length; i++) {
    try {
      // Add a new page for each label except the first one
      if (i > 0) {
        pdf.addPage()
      }

      const element = validElements[i]

      // Wait to ensure all content is rendered
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Use html2canvas with specific options to avoid CORS issues
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc, clonedElement) => {
          // Force all images and canvas elements to be rendered
          const images = clonedElement.querySelectorAll("img, canvas")
          images.forEach((img) => {
            img.setAttribute("crossorigin", "anonymous")
          })

          // Apply inline styles to ensure proper rendering
          clonedElement.style.width = "600px"
          clonedElement.style.margin = "0"
          clonedElement.style.padding = "0"
          clonedElement.style.backgroundColor = "#ffffff"
          clonedElement.style.border = "1px solid black"
        },
      })

      // Calculate dimensions to fit on the page with proper margins
      const pageWidth = 8.5 // Letter width in inches
      const pageHeight = 11 // Letter height in inches
      const margin = 0.5 // Margin in inches

      const availableWidth = pageWidth - 2 * margin
      const aspectRatio = canvas.height / canvas.width
      const imgHeight = availableWidth * aspectRatio

      // Add the image to the PDF
      pdf.addImage(
        canvas.toDataURL("image/png", 1.0),
        "PNG",
        margin,
        margin,
        availableWidth,
        Math.min(imgHeight, pageHeight - 2 * margin),
      )
    } catch (error) {
      console.error(`Error processing element ${i}:`, error)
      throw error
    }
  }

  // Save the PDF
  pdf.save(filename)
}
