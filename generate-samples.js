const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSamples() {
  const samplesDir = path.join(__dirname, 'samples');
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  // Helper function to create a PDF with given content
  async function createPDF(title, lines, filename) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 60;
    const lineHeight = 18;
    const leftMargin = 60;

    // Title
    page.drawText(title, {
      x: leftMargin,
      y,
      size: 22,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 35;

    // Company header
    page.drawText('Acme Corporation', {
      x: leftMargin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= lineHeight;
    page.drawText('123 Business Ave, Suite 400', {
      x: leftMargin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= lineHeight;
    page.drawText('New York, NY 10001 | Tel: (212) 555-0100', {
      x: leftMargin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= lineHeight;
    page.drawText('Email: billing@acmecorp.com | Tax ID: 12-3456789', {
      x: leftMargin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 30;

    // Draw a line
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: width - leftMargin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 25;

    // Content lines
    for (const line of lines) {
      const isBold = line.bold || false;
      const size = line.size || 11;
      const indent = line.indent || 0;
      const color = line.color || rgb(0.1, 0.1, 0.1);

      page.drawText(line.text, {
        x: leftMargin + indent,
        y,
        size,
        font: isBold ? fontBold : font,
        color,
      });
      y -= lineHeight * (line.spacing || 1);
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(samplesDir, filename), pdfBytes);
    console.log(`Created: ${filename}`);
  }

  // Sample 1: Invoice
  await createPDF('INVOICE', [
    { text: 'Invoice #: INV-2026-0042', bold: true },
    { text: 'Date: 01/15/2026', bold: true },
    { text: '', spacing: 0.5 },
    { text: 'Bill To:', bold: true, size: 12 },
    { text: 'GlobalTech Solutions Inc.', indent: 20 },
    { text: '450 Innovation Drive', indent: 20 },
    { text: 'San Francisco, CA 94105', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Ship To:', bold: true, size: 12 },
    { text: 'GlobalTech Solutions Inc.', indent: 20 },
    { text: '450 Innovation Drive', indent: 20 },
    { text: 'San Francisco, CA 94105', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Description', bold: true, size: 11 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'Enterprise Software License (Annual)', indent: 0 },
    { text: '  Qty: 10  |  Unit Price: $2,500.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Cloud Hosting Services - Premium Tier', indent: 0 },
    { text: '  Qty: 12  |  Unit Price: $800.00/month', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Professional Services - Implementation', indent: 0 },
    { text: '  Qty: 1  |  Unit Price: $15,000.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: '', spacing: 0.5 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'Subtotal: $54,600.00', bold: true },
    { text: 'Tax (8.5%): $4,641.00', bold: true },
    { text: 'Total: $59,241.00', bold: true, size: 13, color: rgb(0.1, 0.4, 0.1) },
    { text: '', spacing: 0.5 },
    { text: 'Currency: USD', bold: true },
    { text: 'Payment Terms: Net 30', indent: 0, color: rgb(0.4, 0.4, 0.4) },
  ], 'sample-invoice.pdf');

  // Sample 2: Sales Order
  await createPDF('SALES ORDER', [
    { text: 'Sales Order #: SO-2026-0187', bold: true },
    { text: 'Date: 02/20/2026', bold: true },
    { text: '', spacing: 0.5 },
    { text: 'Customer:', bold: true, size: 12 },
    { text: 'Meridian Health Systems', indent: 20 },
    { text: '789 Medical Center Blvd', indent: 20 },
    { text: 'Boston, MA 02115', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Shipping Address:', bold: true, size: 12 },
    { text: 'Meridian Health Systems - Warehouse', indent: 20 },
    { text: '100 Logistics Way', indent: 20 },
    { text: 'Woburn, MA 01801', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Sales Rep: Jennifer Martinez', bold: true },
    { text: 'PO Reference: PO-MHS-2026-003', bold: true },
    { text: '', spacing: 0.5 },
    { text: 'Items Ordered', bold: true, size: 11 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'Medical Grade Monitors 24"', indent: 0 },
    { text: '  Qty: 25  |  Unit Price: $1,200.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Patient Monitoring Workstations', indent: 0 },
    { text: '  Qty: 15  |  Unit Price: $3,500.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Wireless Vital Sign Sensors', indent: 0 },
    { text: '  Qty: 50  |  Unit Price: $280.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Installation & Training Services', indent: 0 },
    { text: '  Qty: 1  |  Unit Price: $8,500.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: '', spacing: 0.5 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'Subtotal: $112,750.00', bold: true },
    { text: 'Tax (6.25%): $7,046.88', bold: true },
    { text: 'Total: $119,796.88', bold: true, size: 13, color: rgb(0.1, 0.4, 0.1) },
    { text: '', spacing: 0.5 },
    { text: 'Currency: USD', bold: true },
    { text: 'Delivery: 4-6 weeks ARO', indent: 0, color: rgb(0.4, 0.4, 0.4) },
  ], 'sample-sales-order.pdf');

  // Sample 3: Purchase Order
  await createPDF('PURCHASE ORDER', [
    { text: 'Purchase Order #: PO-2026-0093', bold: true },
    { text: 'Date: 03/10/2026', bold: true },
    { text: '', spacing: 0.5 },
    { text: 'Vendor:', bold: true, size: 12 },
    { text: 'Precision Manufacturing LLC', indent: 20 },
    { text: '2200 Industrial Parkway', indent: 20 },
    { text: 'Cleveland, OH 44115', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Ship To:', bold: true, size: 12 },
    { text: 'Acme Corporation - Receiving Dock', indent: 20 },
    { text: '123 Business Ave, Suite 400', indent: 20 },
    { text: 'New York, NY 10001', indent: 20 },
    { text: '', spacing: 0.5 },
    { text: 'Buyer: Robert Chen, Procurement Manager', bold: true },
    { text: 'Contact: procurement@acmecorp.com | (212) 555-0100', indent: 0, color: rgb(0.4, 0.4, 0.4) },
    { text: '', spacing: 0.5 },
    { text: 'Line Items', bold: true, size: 11 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'CNC Machined Aluminum Brackets (Custom)', indent: 0 },
    { text: '  Part #: AMB-2026-001  |  Qty: 500  |  Unit Price: $42.50', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Stainless Steel Fastener Kit M8x1.25', indent: 0 },
    { text: '  Part #: SSF-M8-125  |  Qty: 2,000  |  Unit Price: $1.85', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Precision Ground Shafts 25mm x 500mm', indent: 0 },
    { text: '  Part #: PGS-25-500  |  Qty: 100  |  Unit Price: $85.00', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: 'Surface Treatment: Anodizing Type II', indent: 0 },
    { text: '  Qty: 500  |  Unit Price: $8.75', indent: 20, color: rgb(0.3, 0.3, 0.3) },
    { text: '', spacing: 0.5 },
    { text: '-----------------------------------------------------', color: rgb(0.7, 0.7, 0.7) },
    { text: 'Subtotal: $58,500.00', bold: true },
    { text: 'Tax (8.0%): $4,680.00', bold: true },
    { text: 'Total: $63,180.00', bold: true, size: 13, color: rgb(0.1, 0.4, 0.1) },
    { text: '', spacing: 0.5 },
    { text: 'Currency: USD', bold: true },
    { text: 'Terms: Net 45 | FOB: Destination', indent: 0, color: rgb(0.4, 0.4, 0.4) },
    { text: 'Requested Delivery: 04/15/2026', indent: 0, color: rgb(0.4, 0.4, 0.4) },
  ], 'sample-purchase-order.pdf');

  console.log('\nAll sample PDFs generated in ./samples/');
}

generateSamples().catch(console.error);