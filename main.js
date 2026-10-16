import * as pdfjsLib from 'pdfjs-dist';
import ExcelJS from 'exceljs';
import extractFields from './extract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

const $ = (id) => document.getElementById(id);
const landingView = $('landingView');
const toolView = $('toolView');
const navLinks = [...document.querySelectorAll('[data-view]')];
const navToggle = $('navToggle');
const navLinksContainer = $('navLinks');
const tryItFreeBtn = $('tryItFreeBtn');
const seePricingBtn = $('seePricingBtn');
const fileInput = $('fileInput');
const uploadDropzone = $('uploadDropzone');
const browseBtn = $('browseBtn');
const fileChips = $('fileChips');
const tableSection = $('tableSection');
const tableBody = $('tableBody');
const exportBtn = $('exportBtn');
const status = $('status');

const rows = [];
let selectedFiles = [];
const fileStatuses = new Map();
let toastTimer;

const columns = [
  ['fileName', 'File Name', false],
  ['documentType', 'Document Type', false],
  ['documentNumber', 'Document Number', false],
  ['reference', 'Reference', false],
  ['date', 'Date', false],
  ['dueDate', 'Due Date', false],
  ['seller', 'Seller', false],
  ['buyer', 'Buyer', false],
  ['sellerTaxId', 'Seller Tax ID', false],
  ['buyerTaxId', 'Buyer Tax ID', false],
  ['subtotal', 'Subtotal', true],
  ['taxAmount', 'Tax Amount', true],
  ['taxRate', 'Tax Rate', true],
  ['discount', 'Discount', true],
  ['shipping', 'Shipping', true],
  ['totalAmount', 'Total Amount', true],
  ['currency', 'Currency', false],
  ['paymentTerms', 'Payment Terms', false],
  ['confidence', 'Confidence', false],
];

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function showStatus(message, type = 'info') {
  status.textContent = message;
  status.className = `status-toast ${type}`;
  status.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { status.hidden = true; }, 4500);
}

function showView(view) {
  const isTool = view === 'tool';
  landingView.classList.toggle('active', !isTool);
  toolView.classList.toggle('active', isTool);
  navLinks.forEach((link) => link.classList.toggle('active', link.dataset.view === view || (view === 'home' && link.dataset.view === 'home')));
  if (view === 'pricing') {
    landingView.classList.add('active');
    requestAnimationFrame(() => $('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function formatMoney(value, currency = '') {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return new Intl.NumberFormat('en-US', {
    style: currency ? 'currency' : 'decimal',
    currency: currency || undefined,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function normalizeText(content) {
  return content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
}

async function extractPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    pages.push(normalizeText(await page.getTextContent()));
  }
  const text = pages.join(' ').trim();
  if (!text) {
    return { noText: true };
  }
  return extractFields(text);
}

function createInput(value, key, rowIndex, numeric = false) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value ?? '';
  input.dataset.key = key;
  input.dataset.row = String(rowIndex);
  input.inputMode = numeric ? 'decimal' : 'text';
  input.addEventListener('change', () => {
    rows[rowIndex][key] = input.value;
    updateSummary();
  });
  return input;
}

function renderTable() {
  tableBody.replaceChildren();
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    if (row.confidence === 'Low') tr.classList.add('low-confidence');
    columns.forEach(([key, , numeric]) => {
      const td = document.createElement('td');
      if (numeric) td.className = 'num-col';
      td.appendChild(createInput(row[key], key, rowIndex, numeric));
      tr.appendChild(td);
    });
    const actionCell = document.createElement('td');
    actionCell.className = 'cell-actions';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-icon';
    remove.setAttribute('aria-label', `Remove ${row.fileName}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>';
    remove.addEventListener('click', () => {
      rows.splice(rowIndex, 1);
      selectedFiles = selectedFiles.filter((file) => file.name !== row.fileName);
      renderTable();
      renderFileChips();
    });
    actionCell.appendChild(remove);
    tr.appendChild(actionCell);
    tableBody.appendChild(tr);
  });
  tableSection.hidden = rows.length === 0;
  $('emptyState').hidden = rows.length !== 0;
  updateSummary();
}

function updateSummary() {
  const total = rows.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);
  const currency = rows[0]?.currency || '';
  $('summaryCount').textContent = `${rows.length} document${rows.length === 1 ? '' : 's'}`;
  $('summaryTotal').textContent = `${formatMoney(total, currency)} total`;
  $('docCount').textContent = `${rows.length} document${rows.length === 1 ? '' : 's'}`;
  $('totalAmount').textContent = `${formatMoney(total, currency)} total`;
  $('headerActions').hidden = rows.length === 0;
}

function renderFileChips() {
  fileChips.replaceChildren();
  selectedFiles.forEach((file) => {
    const chip = document.createElement('span');
    chip.className = 'file-chip';
    const name = document.createElement('span');
    name.textContent = file.name;
    chip.appendChild(name);
    const fileStatus = document.createElement('span');
    const currentStatus = fileStatuses.get(fileKey(file)) || 'Pending';
    const statusClass = currentStatus.startsWith('Failed') ? 'failed' : currentStatus.toLowerCase().replace(/\s+/g, '-');
    fileStatus.className = `file-chip-status file-chip-status-${statusClass}`;
    fileStatus.textContent = currentStatus;
    chip.appendChild(fileStatus);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    remove.addEventListener('click', () => {
      selectedFiles = selectedFiles.filter((item) => item !== file);
      const rowIndex = rows.findIndex((row) => row.fileName === file.name);
      if (rowIndex >= 0) rows.splice(rowIndex, 1);
      fileStatuses.delete(fileKey(file));
      renderFileChips();
      renderTable();
    });
    chip.appendChild(remove);
    fileChips.appendChild(chip);
  });
}

async function handleFiles(fileList) {
  const files = [...fileList].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (!files.length) {
    showStatus('Please choose one or more PDF files.', 'error');
    return;
  }
  for (const file of files) {
    if (selectedFiles.some((item) => item.name === file.name && item.size === file.size)) continue;
    selectedFiles.push(file);
    fileStatuses.set(fileKey(file), 'Processing');
    renderFileChips();
    showStatus(`Processing ${file.name}...`, 'info');
    try {
      const fields = await extractPdf(file);
      if (fields.noText) {
        const message = 'No text found. This looks like a scanned PDF and is not supported yet.';
        fileStatuses.set(fileKey(file), message);
        console.warn(`${file.name}: ${message}`);
        showStatus(message, 'error');
        renderFileChips();
        continue;
      }
      rows.push({ fileName: file.name, ...fields });
      fileStatuses.set(fileKey(file), 'Done');
      renderTable();
      renderFileChips();
    } catch (error) {
      fileStatuses.set(fileKey(file), `Failed: ${error.message}`);
      console.error(`Failed to extract ${file.name}`, error);
      renderFileChips();
      showStatus(`Could not extract ${file.name}: ${error.message}`, 'error');
    }
  }
  if (rows.length) showStatus(`Extracted ${rows.length} document${rows.length === 1 ? '' : 's'}.`, 'success');
  fileInput.value = '';
}

async function exportToExcel() {
  if (!rows.length) return;
  exportBtn.disabled = true;
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Audit Extractor';
    const sheet = workbook.addWorksheet('Extracted Data');
    sheet.columns = columns.map(([, header]) => ({ header, key: header }));
    rows.forEach((row) => {
      const values = {};
      columns.forEach(([key, header]) => { values[header] = row[key] ?? ''; });
      ['Subtotal', 'Tax Amount', 'Discount', 'Shipping', 'Total Amount'].forEach((header) => {
        if (values[header] !== '') values[header] = Number(values[header]);
      });
      sheet.addRow(values);
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.columns.forEach((column) => { column.width = Math.max(14, Math.min(34, String(column.header).length + 8)); });
    const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-extractor-${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
    showStatus('Excel export downloaded.', 'success');
  } catch (error) {
    console.error('Excel export failed', error);
    showStatus(`Export failed: ${error.message}`, 'error');
  } finally {
    exportBtn.disabled = false;
  }
}

navLinks.forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  showView(link.dataset.view);
  navLinksContainer.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}));
tryItFreeBtn.addEventListener('click', () => showView('tool'));
seePricingBtn.addEventListener('click', () => showView('pricing'));
document.querySelectorAll('.pricing-cta').forEach((button) => button.addEventListener('click', () => showView('tool')));
navToggle.addEventListener('click', () => {
  const open = navLinksContainer.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});
browseBtn.addEventListener('click', (event) => { event.stopPropagation(); fileInput.click(); });
uploadDropzone.addEventListener('click', () => fileInput.click());
uploadDropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
['dragenter', 'dragover'].forEach((eventName) => uploadDropzone.addEventListener(eventName, (event) => { event.preventDefault(); uploadDropzone.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach((eventName) => uploadDropzone.addEventListener(eventName, (event) => { event.preventDefault(); uploadDropzone.classList.remove('drag-over'); }));
uploadDropzone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
exportBtn.addEventListener('click', exportToExcel);
