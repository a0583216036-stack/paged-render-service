import express from 'express';

const app = express();
app.use(express.json({ limit: '50mb' }));

const jobs = new Map();

app.post('/api/render', (req, res) => {
  const jobId = `job_${Date.now()}`;
  jobs.set(jobId, {
    status: 'pending',
    progress: 0,
  });

  // סימולציה של render
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'done';
      job.progress = 100;
      job.previewPages = ['https://via.placeholder.com/600x800'];
      job.outputPdfUrl = 'https://via.placeholder.com/600x800';
      job.issues = [];
    }
  }, 2000);

  res.json({ jobId, status: 'pending' });
});

app.get('/api/render/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  
  res.json({
    status: job.status,
    progress: job.progress,
    previewPages: job.previewPages || [],
    outputPdfUrl: job.outputPdfUrl || null,
    issues: job.issues || [],
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});