// ===== API Config —— 部署时修改此处指向你的后端服务器 =====
const API_BASE = (() => {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return localStorage.getItem('api_server') || '';
  }
  return ''; // 本地开发用相对路径
})();

function api(path, opts = {}) {
  return fetch(API_BASE + path, opts);
}

// 持久化 API 地址
if (API_BASE && !localStorage.getItem('api_server')) {
  localStorage.setItem('api_server', API_BASE);
}

// ===== State =====
const state = {
  jobId: null,
  stems: [],
  audioContext: null,
  currentPlaying: null,
  soloStem: null,
  audioBuffers: {},
  polling: null
};

// ===== DOM refs =====
const $ = id => document.getElementById(id);
const uploadZone = $('uploadZone');
const fileInput = $('fileInput');
const uploadBtn = $('uploadBtn');
const urlInput = $('urlInput');
const urlBtn = $('urlBtn');
const processingSection = $('processingSection');
const fileName = $('fileName');
const processStatus = $('processStatus');
const progressFill = $('progressFill');
const progressPct = $('progressPct');
const stemsSection = $('stemsSection');
const stemsGrid = $('stemsGrid');
const newTaskBtn = $('newTaskBtn');

// ===== Stem config =====
const STEM_CONFIG = {
  vocals: { label: '人声', color: '#4A90D9', icon: 'V' },
  drums:  { label: '鼓组', color: '#FF6B35', icon: 'D' },
  bass:   { label: '贝斯', color: '#48BB78', icon: 'B' },
  other:  { label: '其他', color: '#7B8CAA', icon: 'O' }
};

// ===== Upload Zone =====
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length) uploadFile(files[0]);
});
uploadZone.addEventListener('click', () => fileInput.click());
uploadBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) uploadFile(fileInput.files[0]);
});

// ===== Upload =====
async function uploadFile(file) {
  if (!ensureBackend()) return;

  const validTypes = ['.mp3','.wav','.flac','.m4a','.aac','.ogg'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validTypes.includes(ext)) {
    showToast('不支持该文件格式');
    return;
  }

  const form = new FormData();
  form.append('audio', file);

  showProcessing(file.name, '上传中...');
  updateProgress(15);

  try {
    const res = await api('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    state.jobId = json.data.id;
    await startProcessing();
  } catch (e) {
    showError('上传失败: ' + e.message);
  }
}

// ===== URL Capture =====
urlBtn.addEventListener('click', async () => {
  if (!ensureBackend()) return;
  const url = urlInput.value.trim();
  if (!url) { showToast('请输入音频链接'); return; }

  urlBtn.disabled = true;
  urlBtn.textContent = '抓取中...';

  showProcessing('在线音频', '抓取中...');
  updateProgress(10);

  try {
    const res = await api('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    state.jobId = json.data.id;
    await startProcessing();
  } catch (e) {
    showError('抓取失败: ' + e.message);
  } finally {
    urlBtn.disabled = false;
    urlBtn.textContent = '抓取并分轨';
  }
});

// ===== Start Processing =====
async function startProcessing() {
  updateProgress(30);
  setStepActive('stepAnalyze');

  try {
    const res = await api(`/api/process/${state.jobId}`, { method: 'POST' });
    // Start polling
    state.polling = setInterval(pollStatus, 400);
  } catch (e) {
    showError('处理失败: ' + e.message);
  }
}

// ===== Poll Status =====
async function pollStatus() {
  if (!state.jobId) return;

  try {
    const res = await api(`/api/status/${state.jobId}`);
    const json = await res.json();
    if (!json.success) { clearInterval(state.polling); return; }

    const data = json.data;
    updateProgress(data.progress);

    if (data.status === 'processing') {
      const modeLabel = { demucs: 'AI (Demucs)', hpss: '增强 (HPSS)', fft: '快速 (FFT)', fallback: '模拟' }[data.mode] || '分轨中';
      processStatus.textContent = `${modeLabel} ${data.progress}%`;
      if (data.progress >= 30) setStepActive('stepSeparate');
    } else if (data.status === 'completed') {
      clearInterval(state.polling);
      const modeLabel = { demucs: 'AI (Demucs)', fft: '快速 (FFT)', fallback: '模拟' }[data.mode] || '';
      processStatus.textContent = '分轨完成' + (modeLabel ? ' · ' + modeLabel : '');
      setStepDone('stepDone');
      setStepDone('stepSeparate');
      updateProgress(100);
      await loadStems();
    } else if (data.status === 'error') {
      clearInterval(state.polling);
      showError(data.error || '处理出错');
    }
  } catch (e) {
    // silent
  }
}

// ===== Load Stems =====
async function loadStems() {
  try {
    const res = await api(`/api/stems/${state.jobId}`);
    const json = await res.json();
    if (!json.success) return;

    state.stems = json.data;
    processingSection.style.display = 'none';
    renderStems();
    stemsSection.style.display = 'block';
  } catch (e) {
    showError('加载音轨失败');
  }
}

// ===== Render Stems =====
function renderStems() {
  stemsGrid.innerHTML = '';

  state.stems.forEach(stem => {
    const cfg = STEM_CONFIG[stem.name] || { label: stem.name, color: '#7B8CAA', icon: '?' };
    const card = document.createElement('div');
    card.className = 'stem-card';
    card.id = `stem-${stem.name}`;

    card.innerHTML = `
      <div class="stem-card-header">
        <div class="stem-info">
          <div class="stem-icon ${stem.name}">${cfg.icon}</div>
          <div>
            <div class="stem-name">${cfg.label}</div>
            <div class="stem-size">${formatSize(stem.size)} · WAV</div>
          </div>
        </div>
        <div class="stem-controls">
          <button class="control-btn play-btn" data-stem="${stem.name}" title="播放">
            <svg viewBox="0 0 24 24" width="16" height="16"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
          </button>
          <button class="control-btn solo-btn" data-stem="${stem.name}" title="独奏">
            S
          </button>
          <a class="download-btn" href="${API_BASE}/api/download/${state.jobId}/${stem.name}" download title="下载">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 3v12m-5-5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            下载
          </a>
        </div>
      </div>
      <canvas class="stem-waveform" id="wave-${stem.name}" data-stem="${stem.name}" height="48"></canvas>
    `;

    stemsGrid.appendChild(card);
  });

  // Bind controls after render
  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => togglePlay(btn.dataset.stem));
  });
  document.querySelectorAll('.solo-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSolo(btn.dataset.stem));
  });

  // Draw waveforms
  state.stems.forEach(stem => {
    const cfg = STEM_CONFIG[stem.name] || { color: '#7B8CAA' };
    drawWaveformPlaceholder(`wave-${stem.name}`, cfg.color);
  });
}

// ===== Audio Playback =====
async function togglePlay(stemName) {
  if (state.currentPlaying === stemName) {
    stopPlayback();
    return;
  }

  if (state.currentPlaying) {
    stopPlayback();
  }

  const btn = document.querySelector(`.play-btn[data-stem="${stemName}"]`);
  btn.classList.add('playing');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>';

  state.currentPlaying = stemName;

  // Check if we have a real stem URL
  const previewUrl = `${API_BASE}/api/preview/${state.jobId}/${stemName}`;
  try {
    const audio = new Audio(previewUrl);
    audio.addEventListener('ended', stopPlayback);
    state._audioEl = audio;
    audio.play().catch(() => {
      // If playback fails, use oscillator as fallback
      fallbackPlay(stemName);
    });
  } catch {
    fallbackPlay(stemName);
  }
}

function stopPlayback() {
  if (state._audioEl) {
    state._audioEl.pause();
    state._audioEl = null;
  }
  if (state.currentPlaying) {
    const btn = document.querySelector(`.play-btn[data-stem="${state.currentPlaying}"]`);
    if (btn) {
      btn.classList.remove('playing');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>';
    }
  }
  state.currentPlaying = null;
}

function fallbackPlay(stemName) {
  // Create a tone based on stem type for demo
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const ctx = state.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const freqs = { vocals: 440, drums: 220, bass: 82, other: 330 };
  osc.frequency.value = freqs[stemName] || 440;
  osc.type = stemName === 'drums' ? 'square' : stemName === 'bass' ? 'sine' : 'triangle';
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 2);
  state.currentPlaying = stemName;
  state._osc = osc;

  osc.onended = stopPlayback;
}

function toggleSolo(stemName) {
  const btn = document.querySelector(`.solo-btn[data-stem="${stemName}"]`);
  if (state.soloStem === stemName) {
    state.soloStem = null;
    btn.classList.remove('solo-active');
  } else {
    document.querySelectorAll('.solo-btn').forEach(b => b.classList.remove('solo-active'));
    state.soloStem = stemName;
    btn.classList.add('solo-active');
  }
}

// ===== Waveform Canvas =====
function drawWaveformPlaceholder(canvasId, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 600;
  const h = 48;
  canvas.width = w * (window.devicePixelRatio || 1);
  canvas.height = h * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  // Generate pseudo-random waveform based on stem type
  const baseFreq = { vocals: 8, drums: 15, bass: 4, other: 10 }[canvas.dataset.stem] || 8;
  const amp = { vocals: 0.6, drums: 0.9, bass: 0.5, other: 0.4 }[canvas.dataset.stem] || 0.5;
  const bars = 120;
  const barW = w / bars;
  const mid = h / 2;

  for (let i = 0; i < bars; i++) {
    const t = (i / bars) * Math.PI * 4 * baseFreq;
    const r = Math.random() * 0.3 + 0.7;
    const val = Math.sin(t) * r * amp * mid;
    const x = i * barW;
    const barH = Math.max(2, Math.abs(val));

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, mid - barH / 2, barW - 1, barH, 1) : ctx.rect(x, mid - barH / 2, barW - 1, barH);
    ctx.fillStyle = color + '40'; // 25% opacity
    ctx.fill();

    // Brighter center bar
    const centerVal = Math.sin(t + 0.1) * r * amp * mid;
    const cH = Math.max(2, Math.abs(centerVal));
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, mid - cH / 2, barW - 1, cH, 1) : ctx.rect(x, mid - cH / 2, barW - 1, cH);
    ctx.fillStyle = color + '80'; // 50% opacity
    ctx.fill();
  }

  // Animate
  let offset = 0;
  function animate() {
    offset += 0.02;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < bars; i++) {
      const t = ((i / bars) + offset) * Math.PI * 4 * baseFreq;
      const r = Math.random() * 0.3 + 0.7;
      const val = Math.sin(t) * r * amp * mid;
      const x = i * barW;
      const barH = Math.max(2, Math.abs(val));
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, mid - barH / 2, barW - 1, barH, 1) : ctx.rect(x, mid - barH / 2, barW - 1, barH);
      ctx.fillStyle = color + '40';
      ctx.fill();

      const centerVal = Math.sin(t + 0.1) * r * amp * mid;
      const cH = Math.max(2, Math.abs(centerVal));
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, mid - cH / 2, barW - 1, cH, 1) : ctx.rect(x, mid - cH / 2, barW - 1, cH);
      ctx.fillStyle = color + '80';
      ctx.fill();
    }
    canvas._animId = requestAnimationFrame(animate);
  }
  if (canvas._animId) cancelAnimationFrame(canvas._animId);
  animate();
}

// ===== UI Helpers =====
function showProcessing(name, status) {
  fileName.textContent = name;
  processStatus.textContent = status;
  document.querySelector('.upload-section').style.display = 'none';
  stemsSection.style.display = 'none';
  processingSection.style.display = 'block';
  setStepActive('stepUpload');
}

function updateProgress(pct) {
  const circumference = 339.292;
  const offset = circumference - (pct / 100) * circumference;
  progressFill.style.strokeDashoffset = offset;
  progressPct.textContent = Math.round(pct) + '%';
}

function setStepActive(id) {
  document.getElementById(id)?.classList.add('active');
}

function setStepDone(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); el.classList.add('done'); }
}

function showError(msg) {
  processStatus.textContent = msg;
  processStatus.style.color = '#E53E3E';
  clearInterval(state.polling);
}

function formatSize(bytes) {
  if (!bytes) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < 3) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    padding: '10px 24px', borderRadius: 'var(--radius-md)',
    background: 'rgba(229,62,62,0.95)', color: 'white', fontSize: '14px',
    zIndex: '999', animation: 'fadeSlideUp 0.3s ease'
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== New Task =====
newTaskBtn.addEventListener('click', () => {
  stopPlayback();
  clearInterval(state.polling);
  state.jobId = null;
  state.stems = [];
  processingSection.style.display = 'none';
  stemsSection.style.display = 'none';
  document.querySelector('.upload-section').style.display = 'block';
  urlInput.value = '';
  fileInput.value = '';
  processStatus.style.color = '';
  // Reset steps
  ['stepUpload','stepAnalyze','stepSeparate','stepDone'].forEach(id => {
    document.getElementById(id)?.classList.remove('active', 'done');
  });
});

// ===== Backend Config =====
if (!API_BASE && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  showBackendPrompt();
}

function showBackendPrompt() {
  const section = document.querySelector('.upload-section');
  const banner = document.createElement('div');
  banner.className = 'backend-banner';
  banner.innerHTML = `
    <div class="backend-banner-inner">
      <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>未配置后端服务器，上传和处理功能暂不可用</span>
      <button class="backend-config-btn" id="backendConfigBtn">配置后端地址</button>
    </div>
  `;
  section.insertBefore(banner, section.firstChild);
  $('backendConfigBtn').addEventListener('click', configureBackend);
}

function configureBackend() {
  const current = localStorage.getItem('api_server') || '';
  const url = prompt('请输入后端服务器地址：', current);
  if (url) {
    localStorage.setItem('api_server', url);
    location.reload();
  }
}

function ensureBackend() {
  if (!localStorage.getItem('api_server') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    showToast('请先点击"配置后端地址"设置服务器');
    return false;
  }
  return true;
}

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    stopPlayback();
  }
});
