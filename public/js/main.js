// ===================== STATE =====================
const state = {
  token: localStorage.getItem('spsc_token'),
  user: JSON.parse(localStorage.getItem('spsc_user') || 'null'),
  selectedJob: null,
  currentStep: 1,
  uploadedFiles: { photo: null, cv: null, docs: [] }
};

const API = window.location.origin;

// ===================== DOM REFS =====================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ===================== TOAST =====================
function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ===================== API CALLS =====================
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token && !options.noAuth) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  try {
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    if (e.message !== 'Request failed') throw e;
    throw e;
  }
}

async function apiForm(path, formData) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  try {
    const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  } catch (e) {
    throw e;
  }
}

// ===================== LOADING =====================
window.addEventListener('load', () => {
  setTimeout(() => $('loadingScreen')?.classList.add('hidden'), 600);
});

// ===================== NAVBAR =====================
document.addEventListener('DOMContentLoaded', () => {
  // Mobile hamburger
  $('hamburger')?.addEventListener('click', () => {
    $('navLinks')?.classList.toggle('open');
  });

  // Close nav on link click (mobile)
  $$('.nav-links a').forEach(a => {
    a.addEventListener('click', () => $('navLinks')?.classList.remove('open'));
  });

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const navbar = $('navbar');
    if (window.scrollY > 50) navbar?.classList.add('scrolled');
    else navbar?.classList.remove('scrolled');

    // Active link detection
    const sections = ['home', 'about', 'jobs', 'results', 'apply', 'contact'];
    let current = 'home';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 200) current = id;
    });
    $$('.nav-links a').forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === `#${current}`) a.classList.add('active');
    });
  });

  // Close notification
  $('closeNotify')?.addEventListener('click', () => {
    $('notificationBar').style.display = 'none';
  });
});

// ===================== AUTH =====================
function updateAuthUI() {
  const loginBtn = $('navLogin');
  const dashBtn = $('navDashboard');
  if (state.token && state.user) {
    loginBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Logout (${state.user.name.split(' ')[0]})`;
    loginBtn.style.background = '#dc2626';
    loginBtn.style.color = '#fff';
    dashBtn.style.display = 'block';
    $('applyLoginMsg')?.classList.add('hidden');
    $('applyLoginBtn')?.style.display = 'none';
  } else {
    loginBtn.innerHTML = `<i class="fas fa-user"></i> Login`;
    loginBtn.style.background = '';
    loginBtn.style.color = '';
    dashBtn.style.display = 'none';
    $('applyLoginMsg')?.classList.remove('hidden');
    $('applyLoginBtn')?.style.display = '';
  }
}

// Login
$('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cnic = $('loginCnic').value.trim();
  const password = $('loginPassword').value.trim();
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ cnic, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('spsc_token', data.token);
    localStorage.setItem('spsc_user', JSON.stringify(data.user));
    updateAuthUI();
    closeModal();
    showToast('Login successful! Welcome back.');
    loadJobs();
    loadJobSelection();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// Register
$('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('regName').value.trim();
  const cnic = $('regCnic').value.trim();
  const email = $('regEmail').value.trim();
  const password = $('regPassword').value;
  const confirm = $('regConfirm').value;
  if (password !== confirm) return showToast('Passwords do not match', 'error');
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, cnic, email, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('spsc_token', data.token);
    localStorage.setItem('spsc_user', JSON.stringify(data.user));
    updateAuthUI();
    closeModal();
    showToast('Account created successfully!');
    loadJobs();
    loadJobSelection();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// Logout
$('navLogin')?.addEventListener('click', (e) => {
  if (state.token) {
    e.preventDefault();
    state.token = null;
    state.user = null;
    localStorage.removeItem('spsc_token');
    localStorage.removeItem('spsc_user');
    updateAuthUI();
    showToast('Logged out successfully.');
    loadJobs();
    loadJobSelection();
  } else {
    e.preventDefault();
    openModal();
  }
});

// Dashboard
$('navDashboard')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = '#apply';
  showToast('Dashboard: Your applications will appear here.', 'info');
});

// ===================== MODAL =====================
function openModal() { $('loginModal')?.classList.add('show'); }
function closeModal() { $('loginModal')?.classList.remove('show'); }
$('.modal-close')?.addEventListener('click', closeModal);
$('loginModal')?.addEventListener('click', (e) => {
  if (e.target === $('loginModal')) closeModal();
});

// Modal tabs
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    $(`${btn.dataset.tab}Tab`)?.classList.add('active');
  });
});

// Apply login btn
$('applyLoginBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  openModal();
});

// ===================== LOAD JOBS =====================
async function loadJobs() {
  const grid = $('jobsGrid');
  const loading = $('jobsLoading');
  if (!grid) return;
  try {
    loading.style.display = 'block';
    const jobs = await api('/api/jobs');
    loading.style.display = 'none';
    renderJobs(jobs);
  } catch (e) {
    loading.style.display = 'none';
    grid.innerHTML = '<p style="text-align:center;color:var(--gray-400)">Failed to load jobs. Please try again.</p>';
  }
}

function renderJobs(jobs) {
  const grid = $('jobsGrid');
  if (!jobs.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--gray-400)">No vacancies available at the moment. Check back soon.</p>';
    return;
  }
  grid.innerHTML = jobs.map(job => `
    <div class="job-card" data-job-id="${job.id}">
      <span class="job-badge ${job.status}">${job.status === 'open' ? 'Open' : 'Closed'}</span>
      <h3>${job.title}</h3>
      <div class="job-meta">
        <span><i class="fas fa-building"></i> ${job.department}</span>
        <span><i class="fas fa-tag"></i> ${job.category}</span>
        <span><i class="fas fa-users"></i> ${job.vacancies} Vacancies</span>
        <span><i class="fas fa-map-marker-alt"></i> ${job.location}</span>
        <span><i class="fas fa-calendar-alt"></i> Last Date: ${job.lastDate}</span>
      </div>
      <p class="job-desc">${job.description}</p>
      <ul class="job-requirements">
        ${job.requirements.map(r => `<li>${r}</li>`).join('')}
      </ul>
      <button class="btn-apply" onclick="applyForJob('${job.id}')">
        <i class="fas fa-file-alt"></i> Apply Now
      </button>
    </div>
  `).join('');
}

// Apply button in jobs
function applyForJob(jobId) {
  if (!state.token) {
    showToast('Please login to apply.', 'info');
    openModal();
    return;
  }
  window.location.href = '#apply';
  // Select this job in the apply section
  const items = $$('.job-select-item');
  items.forEach(item => {
    if (item.dataset.jobId === jobId) {
      item.click();
    }
  });
}

// ===================== LOAD JOB SELECTION (Apply Step 1) =====================
async function loadJobSelection() {
  const grid = $('jobSelectGrid');
  if (!grid) return;
  try {
    const jobs = await api('/api/jobs');
    grid.innerHTML = jobs.filter(j => j.status === 'open').map(job => `
      <div class="job-select-item" data-job-id="${job.id}" onclick="selectJob('${job.id}', this)">
        <h4>${job.title}</h4>
        <p>${job.department} — ${job.category} — ${job.location} — Last: ${job.lastDate}</p>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--gray-400)">Unable to load jobs.</p>';
  }
}

function selectJob(jobId, el) {
  $$('.job-select-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedJob = jobId;
  if (!state.token) {
    showToast('Please login to continue.', 'info');
    openModal();
    return;
  }
  goToStep(2);
}

// ===================== APPLY STEPS =====================
function goToStep(num) {
  state.currentStep = num;
  $$('.apply-step-content').forEach(el => el.classList.remove('active'));
  $$('.step').forEach(el => el.classList.remove('active', 'completed'));

  $(`step${num}`)?.classList.add('active');
  for (let i = 1; i < num; i++) {
    $(`step${i}Indicator`)?.classList.add('completed');
  }
  $(`step${num}Indicator`)?.classList.add('active');
}

// Next/Prev step buttons
$$('.next-step').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = parseInt(btn.dataset.next);
    goToStep(next);
    if (next === 4) buildReview();
  });
});

$$('.prev-step').forEach(btn => {
  btn.addEventListener('click', () => {
    goToStep(parseInt(btn.dataset.prev));
  });
});

// ===================== FILE UPLOADS =====================
function setupUpload(triggerId, inputId, fileType) {
  const trigger = $(triggerId);
  const input = $(inputId);
  if (!trigger || !input) return;

  trigger.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const files = input.files;
    if (!files.length) return;

    if (fileType === 'photo') {
      state.uploadedFiles.photo = files[0];
      trigger.classList.add('has-file');
      trigger.innerHTML = `<i class="fas fa-check-circle"></i><p>${files[0].name}</p>`;
    } else if (fileType === 'cv') {
      state.uploadedFiles.cv = files[0];
      trigger.classList.add('has-file');
      trigger.innerHTML = `<i class="fas fa-check-circle"></i><p>${files[0].name}</p>`;
    } else if (fileType === 'docs') {
      state.uploadedFiles.docs = Array.from(files);
      trigger.classList.add('has-file');
      trigger.innerHTML = `<i class="fas fa-check-circle"></i><p>${files.length} document(s) selected</p>`;
    }
  });
}

setupUpload('photoUpload', 'appPhoto', 'photo');
setupUpload('cvUpload', 'appCv', 'cv');
setupUpload('docsUpload', 'appDocs', 'docs');

// ===================== REVIEW =====================
function buildReview() {
  const box = $('reviewBox');
  const job = $('jobSelectGrid')?.querySelector('.selected');
  const jobTitle = job ? job.querySelector('h4').textContent : 'Selected Job';
  box.innerHTML = `
    <p><strong>Position:</strong> ${jobTitle}</p>
    <p><strong>Full Name:</strong> ${$('appName')?.value || 'N/A'}</p>
    <p><strong>Father's Name:</strong> ${$('appFather')?.value || 'N/A'}</p>
    <p><strong>Date of Birth:</strong> ${$('appDob')?.value || 'N/A'}</p>
    <p><strong>CNIC:</strong> ${$('appCnic')?.value || 'N/A'}</p>
    <p><strong>Phone:</strong> ${$('appPhone')?.value || 'N/A'}</p>
    <p><strong>Address:</strong> ${$('appAddress')?.value || 'N/A'}</p>
    <p><strong>Qualification:</strong> ${$('appQualification')?.value || 'N/A'}</p>
    <p><strong>Experience:</strong> ${$('appExperience')?.value || '0'} years</p>
    <p><strong>Photo:</strong> ${state.uploadedFiles.photo ? 'Uploaded' : 'Not uploaded'}</p>
    <p><strong>CV:</strong> ${state.uploadedFiles.cv ? 'Uploaded' : 'Not uploaded'}</p>
    <p><strong>Documents:</strong> ${state.uploadedFiles.docs.length} file(s)</p>
  `;
}

// ===================== SUBMIT APPLICATION =====================
$('submitApplication')?.addEventListener('click', async () => {
  if (!state.token) {
    showToast('Please login first.', 'error');
    openModal();
    return;
  }
  if (!$('agreeTerms').checked) {
    showToast('Please agree to the terms.', 'error');
    return;
  }
  if (!state.selectedJob) {
    showToast('Please select a job.', 'error');
    goToStep(1);
    return;
  }

  try {
    const formData = new FormData();
    formData.append('jobId', state.selectedJob);
    formData.append('fullName', $('appName').value);
    formData.append('fatherName', $('appFather').value);
    formData.append('dob', $('appDob').value);
    formData.append('cnic', $('appCnic').value);
    formData.append('phone', $('appPhone').value);
    formData.append('address', $('appAddress').value);
    formData.append('qualification', $('appQualification').value);
    formData.append('experience', $('appExperience').value || '0');

    if (state.uploadedFiles.photo) formData.append('photo', state.uploadedFiles.photo);
    if (state.uploadedFiles.cv) formData.append('cv', state.uploadedFiles.cv);
    state.uploadedFiles.docs.forEach(doc => formData.append('documents', doc));

    $('submitApplication').disabled = true;
    $('submitApplication').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    await apiForm('/api/applications', formData);

    showToast('Application submitted successfully!');
    // Reset form
    state.selectedJob = null;
    state.uploadedFiles = { photo: null, cv: null, docs: [] };
    $$('.apply-step-content').forEach(el => el.classList.remove('active'));
    $(`step1`)?.classList.add('active');
    $$('.step').forEach(el => el.classList.remove('active', 'completed'));
    $(`step1Indicator`)?.classList.add('active');
    $('agreeTerms').checked = false;
    // Reset file upload displays
    $('photoUpload').innerHTML = '<i class="fas fa-camera"></i><p>Click to upload photo</p>';
    $('cvUpload').innerHTML = '<i class="fas fa-file-pdf"></i><p>Click to upload CV</p>';
    $('docsUpload').innerHTML = '<i class="fas fa-folder-open"></i><p>Click to upload documents (multiple)</p>';
    $$('.file-upload').forEach(el => el.classList.remove('has-file'));
    // Reset inputs
    $$('#apply input, #apply textarea, #apply select').forEach(el => { if (el.type !== 'file') el.value = ''; });
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    $('submitApplication').disabled = false;
    $('submitApplication').innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';
  }
});

// ===================== LOAD RESULTS =====================
async function loadResults() {
  const grid = $('resultsGrid');
  if (!grid) return;
  try {
    const results = await api('/api/results');
    grid.innerHTML = results.map(r => `
      <div class="result-card">
        <p class="result-date">${r.date}</p>
        <h4>${r.title}</h4>
        <span class="result-status">${r.status}</span>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<p style="text-align:center;color:var(--gray-400)">Results will be available soon.</p>';
  }
}

// ===================== CONTACT FORM =====================
$('contactForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: $('contactName').value.trim(),
    email: $('contactEmail').value.trim(),
    subject: $('contactSubject').value.trim(),
    message: $('contactMessage').value.trim()
  };
  try {
    await api('/api/contact', { method: 'POST', body: JSON.stringify(data) });
    showToast('Message sent successfully!');
    e.target.reset();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ===================== SUBSCRIBE =====================
$('subscribeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('subscribeEmail').value.trim();
  try {
    await api('/api/subscribe', { method: 'POST', body: JSON.stringify({ email }) });
    showToast('Subscribed successfully!');
    e.target.reset();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ===================== JOB FILTERS =====================
$$('.filter-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    try {
      $('jobsLoading').style.display = 'block';
      const jobs = filter === 'all' ? await api('/api/jobs') : await api(`/api/jobs?status=${filter}`);
      $('jobsLoading').style.display = 'none';
      renderJobs(jobs);
    } catch (e) {
      $('jobsLoading').style.display = 'none';
    }
  });
});

// ===================== JOB SEARCH =====================
$('jobSearch')?.addEventListener('input', async (e) => {
  const query = e.target.value.toLowerCase();
  try {
    const jobs = await api('/api/jobs');
    const filtered = jobs.filter(j =>
      j.title.toLowerCase().includes(query) ||
      j.department.toLowerCase().includes(query) ||
      j.category.toLowerCase().includes(query)
    );
    renderJobs(filtered);
  } catch (e) { /* ignore */ }
});

// ===================== CHATBOT =====================
const chatbotBtn = $('chatbotBtn');
const chatbotWidget = $('chatbotWidget');
const chatbotClose = $('chatbotClose');
const chatbotMessages = $('chatbotMessages');
const chatbotInput = $('chatbotInput');
const chatbotSend = $('chatbotSend');
const chatbotTyping = $('chatbotTyping');

chatbotBtn?.addEventListener('click', () => {
  chatbotWidget.classList.toggle('open');
  if (chatbotWidget.classList.contains('open')) {
    chatbotInput.focus();
    scrollChat();
  }
});

chatbotClose?.addEventListener('click', () => {
  chatbotWidget.classList.remove('open');
});

function scrollChat() {
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function addMessage(text, isUser = false) {
  const div = document.createElement('div');
  div.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
  div.innerHTML = `<div class="msg-content"><p>${text}</p></div>`;
  chatbotMessages.appendChild(div);
  scrollChat();
}

async function sendChatMessage() {
  const text = chatbotInput.value.trim();
  if (!text) return;

  addMessage(text, true);
  chatbotInput.value = '';
  chatbotTyping.style.display = 'flex';
  scrollChat();

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
      noAuth: true
    });
    chatbotTyping.style.display = 'none';
    addMessage(data.reply.replace(/\n/g, '<br>'));
  } catch (e) {
    chatbotTyping.style.display = 'none';
    addMessage('I apologize, but I am having trouble connecting. Please try again or contact our office directly.');
  }
}

chatbotSend?.addEventListener('click', sendChatMessage);
chatbotInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  loadJobs();
  loadJobSelection();
  loadResults();
});
