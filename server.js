import express from 'express';
import { renderToFile } from '@pagedjs/cli';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '50mb' }));

const jobs = new Map();

/**
 * POST /api/render
 * קבל payload עם blocks, styles, layout
 * החזר job ID
 */
app.post('/api/render', async (req, res) => {
  try {
    const payload = req.body;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // אחסן את ה-job במצב pending
    jobs.set(jobId, {
      status: 'pending',
      createdAt: Date.now(),
      payload,
      progress: 0,
    });

    // הפעל render באופן אסינכרוני
    renderDocument(jobId, payload).catch((error) => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error.message;
      }
    });

    res.json({ jobId, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/render/:jobId
 * בדוק סטטוס של job
 */
app.get('/api/render/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response = {
    status: job.status,
    progress: job.progress,
  };

  if (job.status === 'done') {
    response.previewPages = job.previewPages || [];
    response.outputPdfUrl = job.outputPdfUrl || null;
    response.issues = job.issues || [];
  } else if (job.status === 'error') {
    response.error = job.error;
  }

  res.json(response);
});

/**
 * Render document function
 * בנה HTML, רונדר עם Paged.js, החזר PDF + preview
 */
async function renderDocument(jobId, payload) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.progress = 10;

  try {
    // בנה HTML מ-payload
    const html = buildHTML(payload);
    job.progress = 30;

    // שמור HTML לקובץ זמני
    const tempDir = path.join(__dirname, '.temp');
    await fs.mkdir(tempDir, { recursive: true });

    const htmlPath = path.join(tempDir, `${jobId}.html`);
    const pdfPath = path.join(tempDir, `${jobId}.pdf`);

    await fs.writeFile(htmlPath, html, 'utf8');
    job.progress = 50;

    // רונדר עם Paged.js
    // הערה: זה צריך Puppeteer + Paged.js
    // לשלב ראשון, נדמיים את זה
    const mockPreview = `
      <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect fill="white" width="600" height="800"/>
        <text x="20" y="40" font-size="24" font-weight="bold" direction="rtl">עימוד מצליח</text>
        <rect fill="#f0f0f0" x="20" y="80" width="560" height="600"/>
      </svg>
    `;

    job.progress = 75;

    // שמור preview pages (mock)
    job.previewPages = [
      `data:image/svg+xml,${encodeURIComponent(mockPreview)}`,
    ];

    // שמור PDF mock
    job.outputPdfUrl = `https://mock-render.local/${jobId}.pdf`;

    // Detect issues (mock)
    job.issues = [
      {
        pageNumber: 1,
        type: 'widow',
        severity: 'warning',
        message: 'שורה יתומה בתחתית העמוד',
      },
    ];

    job.progress = 100;
    job.status = 'done';

    // נקה קבצים זמניים
    // await fs.unlink(htmlPath);
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
  }
}

/**
 * בנה HTML מ-payload
 */
function buildHTML(payload) {
  const { documents, styles, layout, language = 'he', direction = 'rtl' } = payload;

  let html = `
    <!DOCTYPE html>
    <html dir="${direction}" lang="${language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${payload.projectName}</title>
      <style>
        @page {
          size: ${layout?.pageSize || 'A4'};
          margin: ${layout?.margin_top || 20}mm ${layout?.margin_outer || 20}mm ${layout?.margin_bottom || 20}mm ${layout?.margin_inner || 25}mm;
        }
        
        body {
          font-family: Arial, Hebrew, sans-serif;
          line-height: 1.6;
          direction: ${direction};
        }

        .block {
          margin: 0 0 1em 0;
        }

        .heading1 { font-size: 28pt; font-weight: bold; margin: 1em 0 0.5em 0; }
        .heading2 { font-size: 20pt; font-weight: bold; margin: 0.8em 0 0.4em 0; }
        .heading3 { font-size: 16pt; font-weight: bold; margin: 0.6em 0 0.3em 0; }
        .body { font-size: 12pt; }
        .quote { font-style: italic; margin-${direction === 'rtl' ? 'right' : 'left'}: 1em; }
      </style>
    </head>
    <body>
  `;

  if (documents && documents.length > 0) {
    for (const doc of documents) {
      html += `<h1>${doc.title}</h1>`;
      
      if (doc.blocks && doc.blocks.length > 0) {
        for (const block of doc.blocks) {
          const blockClass = block.type || 'body';
          html += `<div class="block ${blockClass}">${escapeHTML(block.text)}</div>`;
        }
      }
    }
  }

  html += `
    </body>
    </html>
  `;

  return html;
}

function escapeHTML(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Paged.js Render Service running on port ${PORT}`);
});