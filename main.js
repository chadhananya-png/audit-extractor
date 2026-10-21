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
const trialCard = $('trialCard');
const limitModal = $('limitModal');
const checkoutModal = $('checkoutModal');
const checkoutForm = $('checkoutForm');

const rows = [];
let selectedFiles = [];
const fileStatuses = new Map();
let toastTimer;
const TRIAL_DAYS = 10;
const DAILY_LIMIT = 5;
const STORAGE_KEYS = {
  start: 'auditExtractor.trialStartDate',
  lastDay: 'auditExtractor.lastProcessingDate',
  dailyCount: 'auditExtractor.dailyUsageCount',
  plan: 'auditExtractor.plan',
};

// For testing day changes and trial expiry, use ?today=YYYY-MM-DD in the URL.
function currentDate() {
  const override = new URLSearchParams(window.location.search).get('today');
  if (/^\d{4}-\d{2}-\d{2}$/.test(override || '')) {
    const parsed = new Date(`${override}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(override)) return override;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateDifference(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.floor((endDate - startDate) / 86400000);
}

function trialState() {
  const today = currentDate();
  const plan = localStorage.getItem(STORAGE_KEYS.plan);
  const start = localStorage.getItem(STORAGE_KEYS.start);
  const lastDay = localStorage.getItem(STORAGE_KEYS.lastDay);
  let count = Number(localStorage.getItem(STORAGE_KEYS.dailyCount) || 0);
  if (lastDay !== today) {
    count = 0;
    localStorage.setItem(STORAGE_KEYS.lastDay, today);
    localStorage.setItem(STORAGE_KEYS.dailyCount, '0');
  }
  return { today, plan, start, count, day: start ? dateDifference(start, today) + 1 : 0, ended: Boolean(start && dateDifference(start, today) >= TRIAL_DAYS) };
}

function updateTrialBanner() {
  const state = trialState();
  if (state.plan) {
    trialCard.classList.add('paid-plan');
    $('trialTitle').textContent = `${state.plan} plan`;
    $('trialDetail').textContent = 'Unlimited documents included';
    $('trialUpgradeBtn').hidden = true;
    return;
  }
  trialCard.classList.remove('paid-plan');
  $('trialUpgradeBtn').hidden = false;
  if (!state.start) {
    $('trialTitle').textContent = 'Free trial: 10 days, 5 documents per day';
    $('trialDetail').textContent = 'Your trial starts when you successfully process your first PDF.';
    return;
  }
  if (state.ended) {
    $('trialTitle').textContent = 'Free trial ended';
    $('trialDetail').textContent = 'Upgrade to keep extracting documents.';
    return;
  }
  $('trialTitle').textContent = `Free trial: ${state.count} of ${DAILY_LIMIT} documents used today, day ${Math.min(state.day, TRIAL_DAYS)} of ${TRIAL_DAYS}`;
  $('trialDetail').innerHTML = `<span class="progress-track"><span class="progress-fill" style="width:${(state.count / DAILY_LIMIT) * 100}%"></span></span>`;
}

function openLimitModal(kind) {
  const title = $('limitModalTitle');
  const content = $('limitModalContent');
  const actions = $('limitModalActions');
  actions.replaceChildren();
  if (kind === 'daily') {
    title.textContent = "You've used today's 5 free documents.";
    content.textContent = 'Come back tomorrow, or upgrade for unlimited documents.';
  } else {
    title.textContent = 'Your 10-day free trial has ended';
    content.innerHTML = '<p>Upgrade to keep extracting documents.</p><div class="plan-options"><div><strong>Monthly Pro</strong><span>$10/month, unlimited documents</span></div><div><strong>Yearly Pro</strong><span>$60/year ($5/month, billed yearly) · Save 50%</span></div><div><strong>Firm</strong><span>$99/month, team seats</span></div></div>';
  }
  ['Pro', 'Firm'].forEach((plan) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.textContent = `Upgrade to ${plan}`;
    button.addEventListener('click', () => { closeModals(); openCheckout(plan); });
    actions.appendChild(button);
  });
  limitModal.hidden = false;
}

function closeModals() {
  limitModal.hidden = true;
  checkoutModal.hidden = true;
}

function openCheckout(plan) {
  $('checkoutTitle').textContent = `${plan} plan`;
  const summaries = {
    Pro: '$10/month · Unlimited documents',
    'Yearly Pro': '$60/year ($5/month, billed yearly) · Unlimited documents',
    Firm: '$99/month · Team seats',
  };
  $('checkoutSummary').textContent = summaries[plan] || '';
  checkoutForm.hidden = false;
  checkoutForm.reset();
  $('checkoutSuccess').hidden = true;
  checkoutModal.hidden = false;
}

function canUpload() {
  const state = trialState();
  if (state.plan) return true;
  if (state.ended) {
    openLimitModal('ended');
    showStatus('Your free trial has ended. Upgrade to upload more PDFs.', 'error');
    return false;
  }
  if (state.count >= DAILY_LIMIT) {
    openLimitModal('daily');
    showStatus(`Today's ${DAILY_LIMIT}-document limit has been reached. Upgrade or try again tomorrow.`, 'error');
    return false;
  }
  return true;
}

function recordSuccessfulDocument() {
  const state = trialState();
  if (state.plan) return;
  if (!state.start) localStorage.setItem(STORAGE_KEYS.start, state.today);
  localStorage.setItem(STORAGE_KEYS.lastDay, state.today);
  localStorage.setItem(STORAGE_KEYS.dailyCount, String(state.count + 1));
  updateTrialBanner();
}

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
  if (isTool) updateTrialBanner();
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
  const allFiles = [...fileList];
  const files = allFiles.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  const invalidFiles = allFiles.filter((file) => !files.includes(file));
  if (!files.length) {
    showStatus('No PDFs selected. Please choose one or more PDF files.', 'error');
    return;
  }
  if (invalidFiles.length) {
    showStatus(`${invalidFiles.length} non-PDF file${invalidFiles.length === 1 ? '' : 's'} ignored. Please choose PDF files only.`, 'error');
  }
  updateTrialBanner();
  if (!canUpload()) return;
  let skipped = 0;
  let duplicates = 0;
  let noTextFound = 0;
  for (const file of files) {
    const existingIndex = selectedFiles.findIndex((item) => item.name === file.name && item.size === file.size);
    if (existingIndex !== -1) {
      if (fileStatuses.get(fileKey(selectedFiles[existingIndex])) !== 'Skipped') {
        duplicates += 1;
        continue;
      }
      fileStatuses.delete(fileKey(selectedFiles[existingIndex]));
      selectedFiles.splice(existingIndex, 1);
    }
    const state = trialState();
    if (!state.plan && state.count >= DAILY_LIMIT) {
      selectedFiles.push(file);
      fileStatuses.set(fileKey(file), 'Skipped');
      skipped += 1;
      continue;
    }
    selectedFiles.push(file);
    fileStatuses.set(fileKey(file), 'Processing');
    renderFileChips();
    showStatus(`Processing ${file.name}...`, 'info');
    try {
      const fields = await extractPdf(file);
      if (fields.noText) {
        const message = 'No text found. This looks like a scanned PDF and is not supported yet.';
        fileStatuses.set(fileKey(file), 'No text found');
        noTextFound += 1;
        showStatus(`${file.name}: ${message}`, 'warning');
        renderFileChips();
        continue;
      }
      rows.push({ fileName: file.name, ...fields });
      recordSuccessfulDocument();
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
  updateTrialBanner();
  const ignoredMessage = invalidFiles.length
    ? ` ${invalidFiles.length} non-PDF file${invalidFiles.length === 1 ? '' : 's'} ignored.`
    : '';
  if (duplicates && !skipped && !rows.length) {
    showStatus(`That PDF is already selected.${ignoredMessage}`, 'info');
  } else if (skipped) {
    renderFileChips();
    showStatus(`${skipped} file${skipped === 1 ? '' : 's'} were skipped: daily limit of ${DAILY_LIMIT} reached.${ignoredMessage}`, 'info');
  } else if (rows.length) {
    const scannedMessage = noTextFound
      ? ` ${noTextFound} scanned PDF${noTextFound === 1 ? '' : 's'} showed no text and was not added.`
      : '';
    const duplicateMessage = duplicates
      ? ` ${duplicates} duplicate PDF${duplicates === 1 ? '' : 's'} already selected.`
      : '';
    showStatus(`Extracted ${rows.length} document${rows.length === 1 ? '' : 's'}.${scannedMessage}${duplicateMessage}${ignoredMessage}`, noTextFound ? 'warning' : 'success');
  }
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
document.querySelectorAll('.pricing-cta').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.plan) openCheckout(button.dataset.plan);
  else showView('tool');
}));
navToggle.addEventListener('click', () => {
  const open = navLinksContainer.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});
browseBtn.addEventListener('click', () => { if (canUpload()) fileInput.click(); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
['dragenter', 'dragover'].forEach((eventName) => uploadDropzone.addEventListener(eventName, (event) => { event.preventDefault(); uploadDropzone.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach((eventName) => uploadDropzone.addEventListener(eventName, (event) => { event.preventDefault(); uploadDropzone.classList.remove('drag-over'); }));
uploadDropzone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
exportBtn.addEventListener('click', exportToExcel);
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
checkoutForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const plan = $('checkoutTitle').textContent.replace(' plan', '');
  if (!['Pro', 'Yearly Pro', 'Firm'].includes(plan)) return;
  localStorage.setItem(STORAGE_KEYS.plan, plan);
  checkoutForm.hidden = true;
  $('checkoutSuccess').textContent = `You're now on the ${plan} plan. Unlimited documents are enabled.`;
  $('checkoutSuccess').hidden = false;
  updateTrialBanner();
  showView('tool');
});
$('trialUpgradeBtn').addEventListener('click', () => openCheckout('Pro'));
$('resetDemoLink').addEventListener('click', (event) => {
  event.preventDefault();
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  updateTrialBanner();
  showStatus('Demo reset.', 'success');
});
updateTrialBanner();
