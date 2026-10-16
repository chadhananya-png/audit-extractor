# Audit Extractor - answer key (all data is fake)

Upload the 7 PDFs, then compare each table row with this key.
Dates should come out as YYYY-MM-DD. Amounts as plain numbers.

| # | File | Type | Number | Date | Seller | Buyer | Subtotal | Tax | Total | Currency |
|---|------|------|--------|------|--------|-------|----------|-----|-------|----------|
| 1 | 01_invoice_standard.pdf | Invoice | INV-2026-0417 | 2026-10-12 (due 2026-11-11) | Northwind Traders Ltd | Contoso Retail Pvt Ltd | 4,700.00 | 376.00 (8%) | 5,076.00 | USD |
| 2 | 02_invoice_gst_india.pdf | Invoice (Tax Invoice) | SS/26-27/00382 | 2026-10-12 | Sharma & Sons Enterprises | Kapoor Textiles Pvt Ltd | 1,00,000.00 | 18,000.00 (IGST 18%) | 1,18,000.00 | INR |
| 3 | 03_purchase_order.pdf | Purchase Order | PO-88213 | 2026-10-05 | Acme Components LLC (vendor) | Globex Manufacturing Inc. | 4,800.00 | - | 4,950.00 (incl. 150 shipping) | USD |
| 4 | 04_sales_order_eur.pdf | Sales Order | SO-2026-5521 | 2026-10-09 | Bergmann Maschinenbau GmbH | Lumiere Industries SARL | 11.550,00 = 11550.00 | 2.194,50 = 2194.50 (19%) | 13.744,50 = 13744.50 | EUR |
| 5 | 05_credit_note_gbp.pdf | Credit Note | CN-00923 | 2026-10-20 | Thames Office Supplies Ltd | Albion Law Partners LLP | 320.00 | 64.00 (20%) | 384.00 | GBP |
| 6 | 06_invoice_discount_shipping.pdf | Invoice | PW-70115 | 2026-10-12 (due 2026-11-26) | Pacific Wholesale Co. | Sunrise Cafe & Bakery | 1,720.00 | 98.04 (6%) | 1,777.04 (discount -86.00, shipping 45.00, amount due 1,777.04) | USD |
| 7 | 07_scanned_image_only.pdf | - | - | - | - | - | - | - | - | - |

## Extra things to check
- Tax IDs: #1 seller EIN 12-3456789 | #2 seller GSTIN 07AABCS1234F1Z5, buyer GSTIN 29AAACK5678M1ZP | #4 seller VAT DE123456789, customer VAT FR98765432101 | #5 seller VAT GB 123 4567 89 | #6 seller TIN 98-7654321
- Payment terms: #1 Net 30 | #2 45 days | #3 Net 30
- #4 customer PO reference: LUM-4410 | #5 original invoice: INV-7745
- #4 uses European number format (1.234,56). A wrong answer here looks like 11.55 or 1155000.

## Pass / fail rules
- Rows 1-6 should be filled with High confidence where number, date and total were found.
- Row 7 is a scan with no text. The app must NOT fail silently. It should show a clear
  message such as "No text found. This looks like a scanned PDF and is not supported yet."
