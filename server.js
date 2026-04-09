import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const jobs = new Map();

// Submit render job
app.post('/api/render', async (req, res) => {
  const jobId = Date.now().toString();
  const payload = req.body;
  
  jobs.set(jobId, { status: 'pending', payload });
  
  // Start async rendering
  renderDocument(jobId, payload).catch(err => {
    const job = jobs.get(jobId);
    if (job) job.status = 'error';
  });
  
  res.json({ jobId });
});

// Get job status
app.get('/api/render/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  res.json({
    status: job.status,
    output_pdf_url: job.output_pdf_url,
    preview_pages: job.preview_pages || [],
    issues_summary: job.issues_summary || {}
  });
});

async function renderDocument(jobId, payload) {
  const job = jobs.get(jobId);
  if (!job) return;
  
  job.status = 'running';
  
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Generate HTML
    const html = generateHTML(payload);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Mock PDF
    const pdf = await page.pdf({ format: 'A4' });
    const pdfUrl = `https://example.com/pdfs/${jobId}.pdf`;
    
    job.status = 'done';
    job.output_pdf_url = pdfUrl;
    job.preview_pages = ['https://via.placeholder.com/300x400'];
    job.issues_summary = {};
    
    await browser.close();
  } catch (err) {
    job.status = 'error';
  }
}

function generateHTML(payload) {
  const { textBlocks = [], layout = {}, language = 'he' } = payload;
  const direction = language === 'he' ? 'rtl' : 'ltr';
  
  const blocksHTML = textBlocks.map(block => 
    `<p>${block.text || ''}</p>`
  ).join('');
  
  return `
    <!DOCTYPE html>
    <html dir="${direction}" lang="${language}">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial; direction: ${direction}; }
        p { margin: 1em 0; }
      </style>
    </head>
    <body>${blocksHTML}</body>
    </html>
  `;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));