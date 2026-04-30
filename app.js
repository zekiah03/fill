'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  apps: [],          // loaded app configs
  activeId: null,    // currently displayed app id
  diagState: {},     // per-app diagnostic progress { answers:[], currentQ:int }
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const appList       = document.getElementById('app-list');
const welcome       = document.getElementById('welcome');
const appContainer  = document.getElementById('app-container');
const jsonUpload    = document.getElementById('json-upload');

// ── Samples ─────────────────────────────────────────────────────────────────
const SAMPLES = {
  diagnostic: {
    id: 'sample-diag',
    type: 'diagnostic',
    title: 'ストレスチェック',
    description: '最近2週間の状態を選んでください。',
    icon: '🧠',
    questions: [
      {
        text: '仕事量が多すぎると感じることがある',
        options: [
          { label: 'まったくない', score: 0 },
          { label: 'たまにある',   score: 1 },
          { label: 'よくある',     score: 2 },
          { label: 'いつもある',   score: 3 },
        ],
      },
      {
        text: '睡眠が十分に取れていると感じる',
        options: [
          { label: 'いつもそう',     score: 0 },
          { label: 'だいたいそう',   score: 1 },
          { label: 'あまりそうでない', score: 2 },
          { label: 'まったくそうでない', score: 3 },
        ],
      },
      {
        text: '気分が落ち込んだり、憂うつになることがある',
        options: [
          { label: 'まったくない', score: 0 },
          { label: 'たまにある',   score: 1 },
          { label: 'よくある',     score: 2 },
          { label: 'いつもある',   score: 3 },
        ],
      },
      {
        text: '仕事でやりがいを感じることがある',
        options: [
          { label: 'いつもある',   score: 0 },
          { label: 'よくある',     score: 1 },
          { label: 'たまにある',   score: 2 },
          { label: 'まったくない', score: 3 },
        ],
      },
      {
        text: '身体的な疲労感がある',
        options: [
          { label: 'まったくない', score: 0 },
          { label: 'たまにある',   score: 1 },
          { label: 'よくある',     score: 2 },
          { label: 'いつもある',   score: 3 },
        ],
      },
    ],
    results: [
      { maxScore: 4,  label: '良好',     color: '#34c98b', description: 'ストレスは低い状態です。この調子で生活リズムを保ちましょう。' },
      { maxScore: 9,  label: '注意',     color: '#f7a04f', description: '軽度のストレスが見られます。休息や気分転換を意識してみてください。' },
      { maxScore: 15, label: '要注意',   color: '#f25c5c', description: 'ストレスが高い状態です。信頼できる人への相談や専門家への受診を検討してください。' },
    ],
  },

  record: {
    id: 'sample-record',
    type: 'record',
    title: '体調記録',
    description: '毎日の体調をログします。',
    icon: '📊',
    fields: [
      { key: 'date',        label: '日付',       type: 'date',     required: true },
      { key: 'mood',        label: '気分',        type: 'select',   required: true,
        options: ['とても良い', '良い', '普通', '悪い', 'とても悪い'] },
      { key: 'sleep_hours', label: '睡眠時間 (h)', type: 'number',   required: true,
        min: 0, max: 24, step: 0.5, hint: '昨夜の睡眠時間を入力してください' },
      { key: 'energy',      label: 'エネルギーレベル', type: 'range', required: false,
        min: 1, max: 10 },
      { key: 'symptoms',    label: '症状',        type: 'checkbox', required: false,
        options: ['頭痛', '疲労感', '食欲不振', '肩こり', '眼精疲労'] },
      { key: 'memo',        label: 'メモ',        type: 'textarea', required: false,
        hint: '自由に記録できます' },
    ],
  },
};

// ── Utils ────────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

function storageKey(appId) {
  return `apphub:records:${appId}`;
}

function loadRecords(appId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(appId)) || '[]');
  } catch { return []; }
}

function saveRecords(appId, records) {
  localStorage.setItem(storageKey(appId), JSON.stringify(records));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
}

// ── App list (sidebar) ───────────────────────────────────────────────────────
function renderAppList() {
  if (state.apps.length === 0) {
    appList.innerHTML = '<li class="app-list-empty">JSONファイルを読み込んでください</li>';
    return;
  }

  appList.innerHTML = '';
  state.apps.forEach(app => {
    const li = document.createElement('li');
    li.className = `app-item${app.id === state.activeId ? ' active' : ''}`;
    li.dataset.id = app.id;

    const typeLabel = app.type === 'diagnostic' ? '診断アプリ' : '記録アプリ';
    li.innerHTML = `
      <span class="app-item-icon">${app.icon || '📋'}</span>
      <div class="app-item-info">
        <div class="app-item-name">${esc(app.title)}</div>
        <div class="app-item-type">${typeLabel}</div>
      </div>
      <button class="app-item-delete" data-id="${app.id}" title="削除">✕</button>
    `;

    li.addEventListener('click', e => {
      if (e.target.closest('.app-item-delete')) {
        removeApp(app.id);
      } else {
        activateApp(app.id);
      }
    });

    appList.appendChild(li);
  });
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function removeApp(id) {
  state.apps = state.apps.filter(a => a.id !== id);
  if (state.activeId === id) {
    state.activeId = null;
    showWelcome();
  }
  renderAppList();
  toast('アプリを削除しました');
}

function activateApp(id) {
  state.activeId = id;
  renderAppList();
  const app = state.apps.find(a => a.id === id);
  if (!app) return;
  showAppContainer();
  if (app.type === 'diagnostic') renderDiagnostic(app);
  else if (app.type === 'record') renderRecord(app);
}

function showWelcome() {
  welcome.classList.remove('hidden');
  appContainer.classList.add('hidden');
}

function showAppContainer() {
  welcome.classList.add('hidden');
  appContainer.classList.remove('hidden');
}

// ── JSON loading ─────────────────────────────────────────────────────────────
function loadAppConfig(config, filename) {
  if (!config.type || !['diagnostic', 'record'].includes(config.type)) {
    throw new Error(`"type" は "diagnostic" または "record" が必要です。`);
  }
  if (!config.title) throw new Error(`"title" フィールドが必要です。`);
  if (config.type === 'diagnostic' && !Array.isArray(config.questions)) {
    throw new Error(`診断アプリには "questions" 配列が必要です。`);
  }
  if (config.type === 'record' && !Array.isArray(config.fields)) {
    throw new Error(`記録アプリには "fields" 配列が必要です。`);
  }

  // Avoid duplicates by id or title
  const existing = state.apps.find(a => a.id === config.id || a.title === config.title);
  if (existing) {
    toast(`「${config.title}」はすでに読み込まれています`, 'error');
    return;
  }

  const app = { ...config, id: config.id || uid(), _filename: filename };
  state.apps.push(app);
  renderAppList();
  activateApp(app.id);
  toast(`「${app.title}」を読み込みました`, 'success');
}

jsonUpload.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const config = JSON.parse(ev.target.result);
        loadAppConfig(config, file.name);
      } catch (err) {
        toast(`${file.name}: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  });
  e.target.value = '';
});

// ── Diagnostic app renderer ──────────────────────────────────────────────────
function getDiagState(appId) {
  if (!state.diagState[appId]) {
    state.diagState[appId] = { answers: [], currentQ: 0, done: false };
  }
  return state.diagState[appId];
}

function renderDiagnostic(app) {
  const ds = getDiagState(app.id);
  appContainer.innerHTML = `
    <div class="app-header">
      <div class="app-header-icon">${app.icon || '🔍'}</div>
      <div>
        <div class="app-title">${esc(app.title)}</div>
        ${app.description ? `<div class="app-desc">${esc(app.description)}</div>` : ''}
      </div>
    </div>
    <div class="diagnostic-progress">
      <div class="diagnostic-progress-bar" id="diag-progress-bar"></div>
    </div>
    <div id="diag-body"></div>
  `;

  if (ds.done) {
    renderDiagResult(app, ds);
  } else {
    renderDiagQuestion(app, ds);
  }
}

function renderDiagQuestion(app, ds) {
  const q = app.questions[ds.currentQ];
  const total = app.questions.length;
  const pct = (ds.currentQ / total) * 100;
  document.getElementById('diag-progress-bar').style.width = `${pct}%`;

  const body = document.getElementById('diag-body');
  const labels = ['A','B','C','D','E','F'];

  body.innerHTML = `
    <div class="question-card">
      <div class="question-num">質問 ${ds.currentQ + 1} / ${total}</div>
      <div class="question-text">${esc(q.text)}</div>
      <div class="options" id="options"></div>
      <div class="question-nav">
        <button class="btn btn-secondary" id="diag-back" ${ds.currentQ === 0 ? 'disabled' : ''}>← 戻る</button>
        <span class="q-counter">${ds.currentQ + 1} / ${total}</span>
        <button class="btn btn-primary" id="diag-next" disabled>次へ →</button>
      </div>
    </div>
  `;

  const optionsEl = document.getElementById('options');
  const savedAnswer = ds.answers[ds.currentQ];

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = `option-btn${savedAnswer === i ? ' selected' : ''}`;
    btn.innerHTML = `<span class="option-label">${labels[i] || i+1}</span><span>${esc(opt.label)}</span>`;
    btn.addEventListener('click', () => {
      optionsEl.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      ds.answers[ds.currentQ] = i;
      document.getElementById('diag-next').disabled = false;
    });
    optionsEl.appendChild(btn);
  });

  if (savedAnswer !== undefined) {
    document.getElementById('diag-next').disabled = false;
  }

  document.getElementById('diag-back').addEventListener('click', () => {
    ds.currentQ--;
    renderDiagQuestion(app, ds);
  });

  document.getElementById('diag-next').addEventListener('click', () => {
    if (ds.currentQ < total - 1) {
      ds.currentQ++;
      renderDiagQuestion(app, ds);
    } else {
      ds.done = true;
      renderDiagResult(app, ds);
    }
  });
}

function renderDiagResult(app, ds) {
  const total = app.questions.reduce((sum, q, i) => {
    const ansIdx = ds.answers[i];
    return sum + (ansIdx !== undefined ? (q.options[ansIdx]?.score ?? 0) : 0);
  }, 0);

  const maxPossible = app.questions.reduce((sum, q) => {
    const scores = q.options.map(o => o.score ?? 0);
    return sum + Math.max(...scores);
  }, 0);

  const results = app.results || [];
  let matched = results.find(r => total <= r.maxScore) || results[results.length - 1];
  if (!matched) matched = { label: 'スコア', color: '#4f8ef7', description: '' };

  document.getElementById('diag-progress-bar').style.width = '100%';

  const breakdown = app.questions.map((q, i) => {
    const ansIdx = ds.answers[i];
    const opt = q.options[ansIdx];
    return `<div class="breakdown-row"><span>${esc(q.text)}</span><span>${opt ? esc(opt.label) : '—'}</span></div>`;
  }).join('');

  document.getElementById('diag-body').innerHTML = `
    <div class="result-card">
      <div class="result-score-ring" style="border-color:${matched.color};color:${matched.color}">
        ${total}<small style="font-size:13px">/${maxPossible}</small>
      </div>
      <div class="result-label" style="color:${matched.color}">${esc(matched.label)}</div>
      <p class="result-desc">${esc(matched.description)}</p>
      <div class="result-breakdown">
        <div class="result-breakdown-title">回答内訳</div>
        ${breakdown}
      </div>
      <button class="btn btn-secondary" id="diag-retry">もう一度やり直す</button>
    </div>
  `;

  document.getElementById('diag-retry').addEventListener('click', () => {
    state.diagState[app.id] = { answers: [], currentQ: 0, done: false };
    renderDiagnostic(app);
  });
}

// ── Record app renderer ──────────────────────────────────────────────────────
function renderRecord(app) {
  appContainer.innerHTML = `
    <div class="app-header">
      <div class="app-header-icon">${app.icon || '📝'}</div>
      <div>
        <div class="app-title">${esc(app.title)}</div>
        ${app.description ? `<div class="app-desc">${esc(app.description)}</div>` : ''}
      </div>
    </div>
    <div class="record-form">
      <form id="record-form"></form>
      <div style="margin-top:20px">
        <button type="submit" form="record-form" class="btn btn-success">保存する</button>
      </div>
    </div>
    <div class="records-section">
      <div class="records-header">
        <span class="records-title">記録一覧</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="record-count" id="rec-count"></span>
          <button class="export-btn" id="rec-export">CSVエクスポート</button>
        </div>
      </div>
      <div class="records-list" id="records-list"></div>
    </div>
  `;

  buildRecordForm(app);
  renderRecordList(app);

  document.getElementById('record-form').addEventListener('submit', e => {
    e.preventDefault();
    saveRecord(app, e.target);
  });

  document.getElementById('rec-export').addEventListener('click', () => exportCSV(app));
}

function buildRecordForm(app) {
  const form = document.getElementById('record-form');
  form.innerHTML = '';

  app.fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = `<label class="form-label" for="field-${field.key}">${esc(field.label)}${field.required ? '<span class="required">*</span>' : ''}</label>`;

    let input = '';
    switch (field.type) {
      case 'text':
        input = `<input class="form-input" id="field-${field.key}" name="${field.key}" type="text" ${field.required ? 'required' : ''} placeholder="${esc(field.placeholder || '')}">`;
        break;
      case 'number':
        input = `<input class="form-input" id="field-${field.key}" name="${field.key}" type="number"
          ${field.min !== undefined ? `min="${field.min}"` : ''}
          ${field.max !== undefined ? `max="${field.max}"` : ''}
          ${field.step !== undefined ? `step="${field.step}"` : ''}
          ${field.required ? 'required' : ''}>`;
        break;
      case 'date':
        const today = new Date().toISOString().slice(0,10);
        input = `<input class="form-input" id="field-${field.key}" name="${field.key}" type="date" value="${today}" ${field.required ? 'required' : ''}>`;
        break;
      case 'select':
        const opts = (field.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
        input = `<select class="form-select" id="field-${field.key}" name="${field.key}" ${field.required ? 'required' : ''}><option value="">選択してください</option>${opts}</select>`;
        break;
      case 'textarea':
        input = `<textarea class="form-textarea" id="field-${field.key}" name="${field.key}" ${field.required ? 'required' : ''} placeholder="${esc(field.placeholder || '')}"></textarea>`;
        break;
      case 'radio': {
        const radios = (field.options || []).map(o =>
          `<label class="radio-label"><input type="radio" name="${field.key}" value="${esc(o)}" ${field.required ? 'required' : ''}> ${esc(o)}</label>`
        ).join('');
        input = `<div class="radio-group">${radios}</div>`;
        break;
      }
      case 'checkbox': {
        const checks = (field.options || []).map(o =>
          `<label class="checkbox-label"><input type="checkbox" name="${field.key}" value="${esc(o)}"> ${esc(o)}</label>`
        ).join('');
        input = `<div class="checkbox-group">${checks}</div>`;
        break;
      }
      case 'range': {
        const min = field.min ?? 1;
        const max = field.max ?? 10;
        const mid = Math.round((min + max) / 2);
        input = `<div class="range-row">
          <span style="font-size:12px;color:var(--text-muted)">${min}</span>
          <input class="form-range" id="field-${field.key}" name="${field.key}" type="range" min="${min}" max="${max}" value="${mid}" oninput="document.getElementById('rv-${field.key}').textContent=this.value">
          <span style="font-size:12px;color:var(--text-muted)">${max}</span>
          <span class="range-value" id="rv-${field.key}">${mid}</span>
        </div>`;
        break;
      }
      default:
        input = `<input class="form-input" id="field-${field.key}" name="${field.key}" type="text" ${field.required ? 'required' : ''}>`;
    }

    const hint = field.hint ? `<p class="form-hint">${esc(field.hint)}</p>` : '';
    group.innerHTML = label + input + hint;
    form.appendChild(group);
  });
}

function saveRecord(app, form) {
  const data = { _id: uid(), _savedAt: new Date().toISOString() };
  app.fields.forEach(field => {
    if (field.type === 'checkbox') {
      const checked = [...form.querySelectorAll(`input[name="${field.key}"]:checked`)].map(el => el.value);
      data[field.key] = checked;
    } else {
      const el = form.querySelector(`[name="${field.key}"]`);
      data[field.key] = el ? el.value : '';
    }
  });

  const records = loadRecords(app.id);
  records.unshift(data);
  saveRecords(app.id, records);
  form.reset();

  // Reset range displays
  app.fields.filter(f => f.type === 'range').forEach(f => {
    const mid = Math.round(((f.min ?? 1) + (f.max ?? 10)) / 2);
    const rvEl = document.getElementById(`rv-${f.key}`);
    const rangeEl = form.querySelector(`[name="${f.key}"]`);
    if (rvEl) rvEl.textContent = mid;
    if (rangeEl) rangeEl.value = mid;
  });

  // Reset date to today
  app.fields.filter(f => f.type === 'date').forEach(f => {
    const el = form.querySelector(`[name="${f.key}"]`);
    if (el) el.value = new Date().toISOString().slice(0,10);
  });

  renderRecordList(app);
  toast('記録を保存しました', 'success');
}

function renderRecordList(app) {
  const records = loadRecords(app.id);
  const listEl = document.getElementById('records-list');
  const countEl = document.getElementById('rec-count');
  if (!listEl) return;

  countEl.textContent = `${records.length}件`;

  if (records.length === 0) {
    listEl.innerHTML = '<div class="no-records">記録がまだありません。上のフォームから入力してください。</div>';
    return;
  }

  listEl.innerHTML = '';
  records.forEach(rec => {
    const row = document.createElement('div');
    row.className = 'record-row';

    const fields = app.fields.map(f => {
      let val = rec[f.key];
      if (Array.isArray(val)) val = val.join(', ') || '—';
      if (!val && val !== 0) val = '—';
      return `<span class="record-field"><strong>${esc(f.label)}:</strong> ${esc(String(val))}</span>`;
    }).join('');

    row.innerHTML = `
      <div class="record-row-header">
        <span class="record-timestamp">${formatDate(rec._savedAt)}</span>
        <button class="record-delete" data-id="${rec._id}">削除</button>
      </div>
      <div class="record-fields">${fields}</div>
    `;

    row.querySelector('.record-delete').addEventListener('click', () => {
      const updated = loadRecords(app.id).filter(r => r._id !== rec._id);
      saveRecords(app.id, updated);
      renderRecordList(app);
      toast('記録を削除しました');
    });

    listEl.appendChild(row);
  });
}

function exportCSV(app) {
  const records = loadRecords(app.id);
  if (records.length === 0) { toast('エクスポートするデータがありません', 'error'); return; }

  const cols = ['_savedAt', ...app.fields.map(f => f.key)];
  const headers = ['保存日時', ...app.fields.map(f => f.label)];

  const csvRows = [headers.join(',')];
  records.forEach(rec => {
    const row = cols.map(col => {
      let v = rec[col] ?? '';
      if (Array.isArray(v)) v = v.join(';');
      return `"${String(v).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });

  const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${app.title}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSVをエクスポートしました', 'success');
}

// ── Sample buttons ───────────────────────────────────────────────────────────
document.querySelectorAll('.sample-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sample;
    const sample = SAMPLES[key];
    if (!sample) return;
    const copy = JSON.parse(JSON.stringify(sample));
    copy.id = uid();
    loadAppConfig(copy, `${key}-sample.json`);
  });
});
