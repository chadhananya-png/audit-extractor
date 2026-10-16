const LABELS = [
  'Invoice No', 'Invoice #', 'Inv No', 'PO Number', 'Purchase Order #', 'Order No',
  'Credit Note No', 'Sales Order #', 'Invoice Date', 'Order Date', 'Date of issue',
  'Due Date', 'Date', 'Subtotal', 'Sub-total', 'Net amount', 'Taxable value',
  'Net credit', 'Tax', 'VAT', 'IGST', 'GST', 'Sales tax', 'Discount', 'Shipping',
  'Grand Total', 'Total credit', 'Amount Due', 'Total', 'Payment terms', 'Currency',
  'From', 'Sold by', 'Vendor / Supplier', 'Vendor', 'Supplier', 'Bill To', 'Billed To',
  'Buyer', 'Customer', 'Sold To', 'Original Invoice', 'Customer PO Ref', 'PO Reference',
  'GSTIN', 'VAT No', 'VAT Reg No', 'Customer VAT', 'TIN', 'EIN',
];

const AMOUNT_RE = /-?\d[\d.,]*(?:\s*(?:USD|EUR|GBP|INR|CAD|AUD))?/gi;
const CURRENCY_RE = /(?:USD|EUR|GBP|INR|\$|€|£|₹)/i;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return '';
  let source = String(value).trim().replace(/[^\d,.\-]/g, '');
  if (!source) return '';
  const negative = source.startsWith('-');
  source = source.replace(/-/g, '');
  const lastComma = source.lastIndexOf(',');
  const lastDot = source.lastIndexOf('.');
  let normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? source.replace(/\./g, '').replace(',', '.')
      : source.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = source.length - lastComma - 1;
    normalized = decimals === 2 ? source.replace(/\./g, '').replace(',', '.') : source.replace(/,/g, '');
  } else {
    normalized = source.replace(/,/g, '');
  }
  const number = Number.parseFloat(`${negative ? '-' : ''}${normalized}`);
  return Number.isFinite(number) ? number : '';
}

function amountCandidates(value) {
  return [...String(value ?? '').matchAll(AMOUNT_RE)]
    .map((match) => match[0])
    .filter((match) => !/^\d{1,3}%$/.test(match))
    .map(parseAmount)
    .filter((number) => number !== '');
}

function normalizeDate(value) {
  const raw = clean(value).replace(/,/g, '');
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first <= 31 && second <= 12) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    if (first <= 12 && second <= 31) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  match = raw.match(/^(\d{1,2})[.]([0-9]{1,2})[.]([0-9]{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = raw.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (match) {
    const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
    if (month > 0) return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  match = raw.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/);
  if (match) {
    const month = new Date(`${match[2]} 1, 2000`).getMonth() + 1;
    if (month > 0) return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return '';
}

function segmentAfter(text, labelPattern) {
  const nextLabels = LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const boundary = '(?<![A-Za-z])';
  const match = text.match(new RegExp(`${boundary}(?:${labelPattern})(?![A-Za-z])\\s*[:#-]?\\s*(.*?)(?=\\s+${boundary}(?:${nextLabels})(?![A-Za-z])\\s*[:#-]?|$)`, 'i'));
  return match ? clean(match[1]) : '';
}

function lastSegmentAfter(text, labelPattern) {
  const matches = [...text.matchAll(new RegExp(`(?<![A-Za-z])(?:${labelPattern})(?![A-Za-z])`, 'gi'))];
  const match = matches.at(-1);
  if (!match) return '';
  const rest = text.slice((match.index ?? 0) + match[0].length);
  const nextLabel = rest.search(/\s+(?<![A-Za-z])(?:Invoice|Date|Due|Subtotal|Sub-total|Net amount|Taxable value|Net credit|Tax|VAT|IGST|GST|Sales tax|Discount|Shipping|Grand Total|Total credit|Amount Due|Total|Payment terms|Currency)\b/i);
  return clean(nextLabel >= 0 ? rest.slice(0, nextLabel) : rest.slice(0, 80));
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function amountAfter(text, labelPattern) {
  const matches = [...text.matchAll(new RegExp(`(?<![A-Za-z])(?:${labelPattern})(?![A-Za-z])`, 'gi'))];
  let result = '';
  for (const match of matches) {
    const rest = text.slice((match.index ?? 0) + match[0].length);
    const nextLabel = rest.search(/\s+(?<![A-Za-z])(?:Invoice|Date|Due|Subtotal|Sub-total|Net amount|Taxable value|Net credit|Tax|VAT|IGST|GST|Sales tax|Discount|Shipping|Grand Total|Total credit|Amount Due|Total|Payment terms|Currency)\b/i);
    const segment = nextLabel >= 0 ? rest.slice(0, nextLabel) : rest.slice(0, 80);
    const candidate = amountCandidates(segment).at(-1);
    if (candidate !== undefined) result = candidate;
  }
  return result;
}

function dateAfter(text, labelPattern) {
  const segment = segmentAfter(text, labelPattern);
  const match = segment.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}|\d{1,2}[ -][A-Za-z]+[ -]\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}/);
  return normalizeDate(match?.[0] ?? '');
}

function extractTaxRate(segment) {
  const match = segment.match(/(\d+(?:[.,]\d+)?)\s*%/i);
  return match ? parseAmount(match[1]) : '';
}

function documentType(text) {
  const upper = text.toUpperCase();
  if (/\bCREDIT\s+NOTE\b/.test(upper)) return 'Credit Note';
  if (/\bPURCHASE\s+ORDER\b/.test(upper)) return 'Purchase Order';
  if (/\bSALES\s+ORDER\b/.test(upper)) return 'Sales Order';
  if (/\bQUOTATION\b|\bQUOTE\b/.test(upper)) return 'Quotation';
  if (/\bTAX\s+INVOICE\b|\bINVOICE\b/.test(upper)) return 'Invoice';
  return '';
}

function extractCurrency(text) {
  const match = text.match(/\b(USD|EUR|GBP|INR)\b/i);
  if (match) return match[1].toUpperCase();
  if (text.includes('$')) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('₹')) return 'INR';
  return '';
}

function extractCompanyAtTop(text) {
  const beforeHeading = text.split(/\b(?:INVOICE|TAX INVOICE|PURCHASE ORDER|SALES ORDER|CREDIT NOTE|QUOTATION)\b/i)[0];
  const match = beforeHeading.match(/^\s*(.+?)(?=\s+(?:\d{1,5}|Plot)\s|(?:\s+(?:EIN|GSTIN|TIN|VAT|Tax ID)\b))/i);
  return clean(match?.[1] ?? '');
}

function extractCompanyAfterType(text) {
  const afterHeading = text.replace(/^\s*(?:INVOICE|TAX INVOICE|PURCHASE ORDER|SALES ORDER|CREDIT NOTE|QUOTATION)\s+/i, '');
  const match = afterHeading.match(/^\s*(.+?)(?=\s+\d{1,5}\s+[A-Za-z])/);
  const value = clean(match?.[1] ?? '');
  return /^(?:PO Number|Purchase Order|Order Date|Payment Terms|Invoice|Date)\b/i.test(value) ? '' : value;
}

function partyValue(text, labels) {
  const pattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return segmentAfter(text, `(?:${pattern})`);
}

function extractTaxId(text, labels) {
  const pattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const segment = segmentAfter(text, `(?:${pattern})`);
  return firstMatch(segment, [
    /((?:[A-Z0-9]{15}|[A-Z]{2}(?:\s*\d){8,}|[A-Z0-9-]{6,}))/i,
  ]);
}

function cleanParty(value) {
  return clean(value)
    .replace(/\s+(?:\d{1,5}\s+|Description\b|Item\b|Line Items\b|Ship To\b|Reason\b|Place of supply\b).*$/i, '')
    .trim();
}

function normalizePartyCase(value) {
  const party = cleanParty(value);
  if (!party || party !== party.toUpperCase()) return party;
  return party.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function extractFields(inputText) {
  const text = clean(inputText);
  const type = documentType(text);
  const noText = !text;
  const number = firstMatch(text, [
    /(?:Invoice\s*(?:No|Number)|Invoice\s*#|Inv\s*No\.?|PO\s*Number|Purchase\s*Order\s*#|Order\s*No\.?|Credit\s*Note\s*No|Sales\s*Order\s*#)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i,
  ]);
  const date = dateAfter(text, '(?:Invoice\\s+Date|Order\\s+Date|Date\\s+of\\s+issue|Date)');
  const dueDate = dateAfter(text, '(?:Due\\s+Date|Due)');
  const taxPattern = '(?:Tax(?!able|\\s+ID)|VAT(?!\\s*(?:No|Reg))|IGST|GST|Sales\\s+tax)';
  const discountSegment = segmentAfter(text, 'Discount');
  const shippingSegment = segmentAfter(text, 'Shipping(?!\\s+Address)');
  const total = amountAfter(text, '(?:Grand\\s+Total|Total\\s+(?:USD|EUR|GBP|INR)|Total\\s+credit|Amount\\s+Due|Total)');
  const subtotal = amountAfter(text, '(?:Subtotal|Sub-total|Net\\s+amount|Taxable\\s+value|Net\\s+credit)');
  let seller = cleanParty(partyValue(text, ['From', 'Sold by', 'Vendor / Supplier', 'Vendor', 'Supplier']));
  let buyer = cleanParty(partyValue(text, ['Bill To', 'Billed To', 'Buyer', 'Customer', 'Sold To']));
  if (type === 'Purchase Order') {
    const vendorSegment = partyValue(text, ['Vendor / Supplier', 'Vendor', 'Supplier']);
    const companies = [...vendorSegment.matchAll(/([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){1,5})\s+\d{1,5}\s/g)]
      .map((match) => clean(match[1]).replace(/\s+-\s+.*$/, ''));
    const headerCompany = extractCompanyAfterType(text);
    if (headerCompany) {
      buyer = headerCompany;
      seller = cleanParty(vendorSegment);
    } else if (companies.length >= 2) {
      buyer = cleanParty(companies[0]);
      seller = cleanParty(companies[1]);
    }
  }
  seller ||= extractCompanyAtTop(text);
  const reference = firstMatch(text, [
    /(?:Customer\s+PO\s+Ref|PO\s+Reference)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i,
    /Original\s+Invoice\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i,
  ]);
  const sellerTaxId = extractTaxId(
    seller ? text : '',
    ['GSTIN', 'VAT No', 'VAT Reg No', 'TIN', 'EIN', 'Tax ID'],
  );
  const buyerTaxId = firstMatch(text, [
    /(?:Buyer|Customer|Billed To|Bill To|Sold To)[\s\S]{0,100}?(?:GSTIN|VAT|TIN|EIN)\s*[:#-]?\s*((?:[A-Z0-9]{15}|[A-Z]{2}\s*\d{3}\s*\d{4}\s*[A-Z]|[A-Z0-9-]{6,}))/i,
  ]);
  const paymentTerms = segmentAfter(text, '(?:Payment\\s+terms|Payment\\s+Terms|Terms)').split(/[|.]/)[0].trim();
  const fields = {
    documentType: type,
    documentNumber: number,
    reference,
    date,
    dueDate,
    seller: normalizePartyCase(seller),
    buyer: normalizePartyCase(buyer),
    sellerTaxId: clean(sellerTaxId),
    buyerTaxId: clean(buyerTaxId),
    subtotal,
    taxAmount: amountAfter(text, taxPattern),
    taxRate: extractTaxRate(lastSegmentAfter(text, taxPattern)),
    discount: amountCandidates(discountSegment).at(-1) ?? '',
    shipping: amountCandidates(shippingSegment).at(-1) ?? '',
    totalAmount: total,
    currency: extractCurrency(text),
    paymentTerms: clean(paymentTerms),
    confidence: '',
    noText,
  };
  const missing = [fields.documentNumber, fields.date, fields.totalAmount].filter((value) => !value).length;
  fields.confidence = missing === 0 ? 'High' : missing === 1 ? 'Medium' : 'Low';
  return fields;
}

export default extractFields;
