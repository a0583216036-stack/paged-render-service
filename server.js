import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json({ limit: '50mb' }));

const jobs = new Map();

app.post('/api/render', (req, res) => {
  const jobId = Date.now().toString();
  jobs.set(jobId, { status: 'pending', payload: req.body });
  
  renderAsync(jobId, req.body);
  res.json({ jobId });
});

app.get('/api/render/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  
  res.json({
    status: job.status,
    output_pdf_url: job.pdf_url || '',
    preview_pages: job.pages || [],
    issues_summary: {}
  });
});

async function renderAsync(jobId, payload) {
  const job = jobs.get(jobId);
  job.status = 'running';
  
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const html = `<!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="UTF-8"></head>
      <body>${payload.textBlocks?.map(b => `<p>${b.text}</p>`).join('') || ''}</body>
      </html>`;
    
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4' });
    
    job.status = 'done';
    job.pdf_url = 'https://example.com/output.pdf';
    job.pages = ['https://via.placeholder.com/300x400'];
    
    await browser.close();
  } catch (err) {
    job.status = 'error';
  }
}

app.listen(process.env.PORT || 3000);