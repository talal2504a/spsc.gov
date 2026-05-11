const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'spsc-gov-secret-key-2025';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// File upload config
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|doc|docx/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk || mimeOk);
  }
});

// Helper: read JSON file
function readJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Helper: write JSON file
function writeJSON(filename, data) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Helper: generate ID
function genID(prefix) {
  const num = Date.now().toString(36).toUpperCase();
  return `${prefix}-${num.slice(-5)}`;
}

// Helper: auth middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper: admin middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ======================== API ROUTES ========================

// --- AUTH ---

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { name, cnic, email, password } = req.body;
    if (!name || !cnic || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const users = readJSON('users.json');
    if (users.find(u => u.cnic === cnic)) {
      return res.status(400).json({ error: 'CNIC already registered' });
    }
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: genID('USR'),
      name,
      cnic,
      email,
      password: hashed,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeJSON('users.json', users);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, cnic: user.cnic } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { cnic, password } = req.body;
    if (!cnic || !password) {
      return res.status(400).json({ error: 'CNIC and Password required' });
    }
    const users = readJSON('users.json');
    const user = users.find(u => u.cnic === cnic);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, cnic: user.cnic } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/me
app.get('/api/me', authenticate, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, cnic: user.cnic });
});

// --- JOBS ---

// GET /api/jobs
app.get('/api/jobs', (req, res) => {
  const jobs = readJSON('jobs.json');
  const { status } = req.query;
  if (status) {
    res.json(jobs.filter(j => j.status === status));
  } else {
    res.json(jobs);
  }
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', (req, res) => {
  const jobs = readJSON('jobs.json');
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// POST /api/jobs (admin)
app.post('/api/jobs', authenticate, requireAdmin, (req, res) => {
  const jobs = readJSON('jobs.json');
  const job = {
    id: genID('JOB'),
    ...req.body,
    status: req.body.status || 'open',
    postedDate: new Date().toISOString().split('T')[0]
  };
  jobs.push(job);
  writeJSON('jobs.json', jobs);
  res.status(201).json(job);
});

// PUT /api/jobs/:id (admin)
app.put('/api/jobs/:id', authenticate, requireAdmin, (req, res) => {
  const jobs = readJSON('jobs.json');
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Job not found' });
  jobs[idx] = { ...jobs[idx], ...req.body };
  writeJSON('jobs.json', jobs);
  res.json(jobs[idx]);
});

// DELETE /api/jobs/:id (admin)
app.delete('/api/jobs/:id', authenticate, requireAdmin, (req, res) => {
  let jobs = readJSON('jobs.json');
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Job not found' });
  jobs.splice(idx, 1);
  writeJSON('jobs.json', jobs);
  res.json({ message: 'Job deleted' });
});

// --- APPLICATIONS ---

// POST /api/applications (authenticated)
app.post('/api/applications', authenticate, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
  { name: 'documents', maxCount: 5 }
]), (req, res) => {
  try {
    const { jobId, fullName, fatherName, dob, cnic, phone, address, qualification, experience } = req.body;
    if (!jobId || !fullName || !cnic || !phone) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const apps = readJSON('applications.json');
    const existing = apps.find(a => a.cnic === cnic && a.jobId === jobId);
    if (existing) {
      return res.status(400).json({ error: 'You already applied for this job' });
    }
    const appData = {
      id: genID('APP'),
      jobId,
      userId: req.user.id,
      fullName,
      fatherName: fatherName || '',
      dob: dob || '',
      cnic,
      phone,
      address: address || '',
      qualification: qualification || '',
      experience: experience || '',
      photo: req.files?.photo?.[0] ? `/uploads/${req.files.photo[0].filename}` : '',
      cv: req.files?.cv?.[0] ? `/uploads/${req.files.cv[0].filename}` : '',
      documents: req.files?.documents ? req.files.documents.map(f => `/uploads/${f.filename}`) : [],
      status: 'pending',
      appliedAt: new Date().toISOString()
    };
    apps.push(appData);
    writeJSON('applications.json', apps);
    res.status(201).json(appData);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/applications (authenticated - user sees own, admin sees all)
app.get('/api/applications', authenticate, (req, res) => {
  const apps = readJSON('applications.json');
  if (req.user.role === 'admin') {
    return res.json(apps);
  }
  res.json(apps.filter(a => a.userId === req.user.id));
});

// GET /api/applications/:id (authenticated)
app.get('/api/applications/:id', authenticate, (req, res) => {
  const apps = readJSON('applications.json');
  const appData = apps.find(a => a.id === req.params.id);
  if (!appData) return res.status(404).json({ error: 'Application not found' });
  if (req.user.role !== 'admin' && appData.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(appData);
});

// PUT /api/applications/:id/status (admin)
app.put('/api/applications/:id/status', authenticate, requireAdmin, (req, res) => {
  const apps = readJSON('applications.json');
  const idx = apps.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });
  apps[idx].status = req.body.status || apps[idx].status;
  apps[idx].remarks = req.body.remarks || apps[idx].remarks;
  writeJSON('applications.json', apps);
  res.json(apps[idx]);
});

// --- CONTACT FORM ---

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }
  // In production, send email. For now just log.
  console.log('Contact Form:', { name, email, subject, message });
  res.json({ message: 'Your message has been received. We will contact you soon.' });
});

// --- SUBSCRIBE ---

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const subscribers = readJSON('users.json');
  // Simple check - in production use a separate subscribers file
  console.log('New subscriber:', email);
  res.json({ message: 'Subscribed successfully!' });
});

// --- RESULTS ---

app.get('/api/results', (req, res) => {
  const results = [
    { id: 'RES-001', title: 'CSS Competitive Examination 2024', date: '2024-12-15', file: '/uploads/results/css-2024.pdf', status: 'published' },
    { id: 'RES-002', title: 'Assistant Director (IT) Written Test', date: '2025-01-20', file: '/uploads/results/asst-director-it.pdf', status: 'published' },
    { id: 'RES-003', title: 'Junior Clerk Typing Test', date: '2025-02-10', file: '/uploads/results/junior-clerk-typing.pdf', status: 'published' },
    { id: 'RES-004', title: 'Section Officer Interview Schedule', date: '2025-03-05', file: '/uploads/results/so-interview.pdf', status: 'published' }
  ];
  res.json(results);
});

// ======================== GROQ AI CHAT ========================

const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Get current jobs for context
    const jobs = readJSON('jobs.json');
    const openJobs = jobs.filter(j => j.status === 'open');
    const jobsContext = openJobs.map(j => `${j.title} (${j.department}) - ${j.category} - ${j.vacancies} vacancies - Last date: ${j.lastDate}`).join('\n');

    const systemPrompt = `You are the official AI assistant for the Sindh Public Service Commission (SPSC) website. 
Your role is to help visitors with information about:
- Job vacancies, applications, and recruitment processes
- SPSC procedures, eligibility criteria, and exam schedules
- Results, merit lists, and selection processes
- General information about the commission

Available job vacancies:\n${jobsContext || 'No current vacancies'}

Keep responses concise, professional, and helpful. Be specific about SPSC-related queries. 
If asked about something outside SPSC scope, politely redirect. Always respond in English.
Format responses with bullet points or short paragraphs for readability.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', errText);
      return res.status(500).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'I apologize, but I am unable to process your request at the moment.';

    res.json({ reply });
  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: 'AI service error' });
  }
});
// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SPSC Server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});