import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import extractFields from './extract.js';

const samplesDir = path.resolve('samples');
const pdfFiles = fs.readdirSync(samplesDir).filter((name) => name.endsWith('.pdf')).sort();

for (const name of pdfFiles) {
  const data = new Uint8Array(fs.readFileSync(path.join(samplesDir, name)));
  const pdf = await pdfjsLib.getDocument({
    data,
    disableWorker: true,
    standardFontDataUrl: pathToFileURL(path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep).href,
  }).promise;
  let text = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str).join(' ')}\n`;
  }
  const fields = extractFields(text);
  console.log(JSON.stringify({ file: name, ...fields }, null, 2));
}
