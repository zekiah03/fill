'use strict';

// ── Dimension definitions ────────────────────────────────────────────────────
const DIMENSIONS = [
  { key: 'needs',       label: '心理的ニーズ',  icon: '🧠', hint: 'gap / 欲求診断アプリ' },
  { key: 'behavior',    label: '行動パターン',   icon: '⚙️',  hint: 'AIrobot / ルールアプリ' },
  { key: 'personality', label: 'パーソナリティ', icon: '🔮', hint: 'Prism' },
  { key: 'values',      label: '価値観',         icon: '💎', hint: '価値観アプリ' },
  { key: 'skills',      label: 'スキル・成長',   icon: '📈', hint: '進化診断' },
  { key: 'health',      label: '健康・身体',      icon: '❤️',  hint: '健康管理' },
  { key: 'identity',    label: '自己定義',        icon: '🪞', hint: 'わたしの定義' },
  { key: 'past',        label: '過去・軌跡',      icon: '🔍', hint: 'Past Inference' },
];

const SLOT_LABELS = { morning: '朝', afternoon: '昼', evening: '夕', night: '夜', anytime: 'いつでも' };
const SLOT_ICONS  = { morning: '🌅', afternoon: '☀️', evening: '🌙', night: '🌃', anytime: '🔄' };
const MAX_NEED = 20;

// ── State ────────────────────────────────────────────────────────────────────
const twin = {
  sources:     [],
  needs:       null,
  behavior:    null,
  personality: null,
  values:      null,
  skills:      null,
  health:      null,
  identity:    null,
  past:        null,
};

// ── Source detection ─────────────────────────────────────────────────────────
function detectType(json) {
  // Psychological needs (gap app)
  if (Array.isArray(json.axes) && json.axes.length > 0 &&
      typeof json.axes[0].score === 'number' && typeof json.axes[0].key === 'string') {
    return 'needs';
  }
  // Behavior rules (AIrobot app)
  if (Array.isArray(json.rules) && json.rules.length > 0 &&
      typeof json.rules[0].ifCondition === 'string') {
    return 'behavior';
  }
  // Personality (Prism - dimensions object with numeric values)
  if (json.dimensions && typeof json.dimensions === 'object' && !Array.isArray(json.dimensions) &&
      Object.values(json.dimensions).every(v => typeof v === 'number')) {
    return 'personality';
  }
  // Values (price-based array of strings or value objects)
  if (Array.isArray(json.values) && json.values.length > 0 &&
      (typeof json.values[0] === 'string' || json.values[0]?.name)) {
    return 'values';
  }
  // Health records
  if (Array.isArray(json.records) && json.records.length > 0 &&
      (json.records[0].mood !== undefined || json.records[0].sleep_hours !== undefined)) {
    return 'health';
  }
  // Skills / evolution
  if (json.skills && typeof json.skills === 'object') return 'skills';
  // Identity / self-definition
  if (json.selfDefinitions || json.whoAmI || json.definitions) return 'identity';
  // Past inference
  if (json.pastEvents || json.inferences || json.timeline) return 'past';

  return null;
}

// ── Data mappers ─────────────────────────────────────────────────────────────
function mapNeeds(json) {
  const axes = json.axes.map(a => ({
    ...a,
    fulfillment: Math.max(0, 1 - a.score / MAX_NEED),
  }));
  const dominant = [...axes].sort((a, b) => b.score - a.score).filter(a => a.score > 3);
  return {
    axes,
    dominant,
    overallFulfillment: axes.reduce((s, a) => s + a.fulfillment, 0) / axes.length,
    generatedAt: json.generatedAt,
  };
}

function mapBehavior(json) {
  const rules = json.rules || [];
  const slots = ['morning', 'afternoon', 'evening', 'night', 'anytime'];
  const bySlot = Object.fromEntries(slots.map(s => [s, rules.filter(r => r.timeSlot === s)]));

  const traits = [];
  const chk = (cond, label, icon) => { if (cond) traits.push({ label, icon }); };

  chk(rules.some(r => r.category === 'social' && (r.thenAction.includes('距離') || (r.title || '').includes('回避'))),
      '集団回避傾向', '🚶');
  chk(rules.some(r => ['筋トレ', '運動', 'ストレッチ'].some(k => r.thenAction.includes(k))),
      '運動習慣あり', '💪');
  chk(rules.some(r => r.thenAction.includes('薬')), '服薬ルーティン', '💊');
  chk(rules.some(r => r.thenAction.includes('瞑想')), '瞑想習慣あり', '🧘');
  chk(rules.some(r => r.thenAction.includes('読書')), '読書習慣あり', '📚');
  chk(rules.some(r => r.ifCondition.includes('興味') || r.thenAction.includes('興味')),
      '好奇心優先型', '🔍');
  chk(rules.some(r => r.thenAction.includes('猫') || (r.ifCondition || '').includes('猫')),
      'ペット（猫）', '🐱');
  chk(rules.some(r => r.thenAction.includes('稼ぎ') || r.ifCondition.includes('資金')),
      '金銭管理意識', '💰');

  return {
    totalRules: rules.length,
    bySlot,
    traits,
    identityScore: json.identityScore ?? 0,
    loginStreak: json.loginStreak ?? 0,
    credits: json.credits ?? 0,
  };
}

// ── Radar chart SVG ──────────────────────────────────────────────────────────
function buildRadar(axes, size = 210) {
  const cx = size / 2, cy = size / 2;
  const R = size * 0.35;
  const n = axes.length;
  const ang = i => (i * 2 * Math.PI / n) - Math.PI / 2;

  const grid = [0.25, 0.5, 0.75, 1].map(lv => {
    const pts = axes.map((_, i) =>
      `${cx + R * lv * Math.cos(ang(i))},${cy + R * lv * Math.sin(ang(i))}`
    ).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(148,163,184,.15)" stroke-width="1"/>`;
  }).join('');

  const lines = axes.map((_, i) =>
    `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(ang(i))}" y2="${cy + R * Math.sin(ang(i))}" stroke="rgba(148,163,184,.15)" stroke-width="1"/>`
  ).join('');

  // Fulfillment polygon (inverted — larger = more satisfied)
  const pts = axes.map((ax, i) => {
    const r = ax.fulfillment * R;
    return `${cx + r * Math.cos(ang(i))},${cy + r * Math.sin(ang(i))}`;
  }).join(' ');

  const labelR = R + 24;
  const labels = axes.map((ax, i) => {
    const a = ang(i);
    const lx = cx + labelR * Math.cos(a);
    const ly = cy + labelR * Math.sin(a);
    const anchor = lx < cx - 4 ? 'end' : lx > cx + 4 ? 'start' : 'middle';
    const hi = ax.score > 5;
    const short = (ax.label.split('・')[0]).slice(0, 3);
    return `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle"
      font-size="10" fill="${hi ? '#fb923c' : 'rgba(148,163,184,.7)'}"
      font-weight="${hi ? 700 : 400}">${short}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${grid}${lines}
    <polygon points="${pts}" fill="rgba(99,179,237,.2)" stroke="#63b3ed" stroke-width="2" stroke-linejoin="round"/>
    ${labels}
  </svg>`;
}

// ── Section renderers ─────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderNeeds(data) {
  const radar = buildRadar(data.axes);
  const pct = Math.round(data.overallFulfillment * 100);

  const topGaps = data.dominant.slice(0, 3).map(a => `
    <div class="gap-item">
      <span class="gap-label">${esc(a.label.split('・')[0])}</span>
      <div class="gap-bar-wrap">
        <div class="gap-bar" style="width:${Math.min((a.score / MAX_NEED) * 100, 100)}%"></div>
      </div>
      <span class="gap-score">${a.score}</span>
    </div>
  `).join('');

  const topInterpretation = data.dominant[0]?.interpretation ?? '';

  return `
    <div class="needs-layout">
      <div class="radar-wrap">${radar}</div>
      <div class="needs-detail">
        <div class="fulfillment-pct">
          <span class="pct-num">${pct}%</span>
          <span class="pct-label">全体充足度</span>
        </div>
        ${data.dominant.length > 0
          ? `<div class="gap-title">主要な欠乏軸</div>${topGaps}`
          : `<div class="all-good">🌟 すべての軸が充足しています</div>`
        }
      </div>
    </div>
    ${topInterpretation
      ? `<div class="interpretation">${esc(topInterpretation)}</div>`
      : ''}
  `;
}

function renderBehavior(data) {
  const slotOrder = ['morning', 'afternoon', 'evening', 'night'];

  const routines = slotOrder.map(slot => {
    const rules = data.bySlot[slot];
    if (!rules.length) return '';
    return `
      <div class="slot-group">
        <div class="slot-header">
          <span>${SLOT_ICONS[slot]} ${SLOT_LABELS[slot]}</span>
          <span class="slot-count">${rules.length}件</span>
        </div>
        <div class="slot-rules">
          ${rules.slice(0, 5).map(r => `<div class="rule-chip">${esc(r.thenAction)}</div>`).join('')}
          ${rules.length > 5 ? `<div class="rule-more">+${rules.length - 5}件</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const anytime = data.bySlot.anytime;
  const anytimeHtml = anytime.length ? `
    <div class="slot-group">
      <div class="slot-header">
        <span>${SLOT_ICONS.anytime} ${SLOT_LABELS.anytime}</span>
        <span class="slot-count">${anytime.length}件</span>
      </div>
      <div class="slot-rules">
        ${anytime.slice(0, 6).map(r => `
          <div class="rule-ifthen">
            <span class="if-part">${esc(r.ifCondition)}</span>
            <span class="arrow">→</span>
            <span class="then-part">${esc(r.thenAction)}</span>
          </div>
        `).join('')}
        ${anytime.length > 6 ? `<div class="rule-more">+${anytime.length - 6}件</div>` : ''}
      </div>
    </div>
  ` : '';

  const traitsHtml = data.traits.map(t =>
    `<span class="trait-badge">${t.icon} ${esc(t.label)}</span>`
  ).join('');

  return `
    <div class="behavior-stats">
      <div class="bstat">
        <div class="bstat-num">${data.totalRules}</div>
        <div class="bstat-label">ルール総数</div>
      </div>
      <div class="bstat">
        <div class="bstat-num">${Object.values(data.bySlot).filter(a => a.length > 0).length}</div>
        <div class="bstat-label">活動時間帯</div>
      </div>
      <div class="bstat">
        <div class="bstat-num">${data.identityScore}</div>
        <div class="bstat-label">IDスコア</div>
      </div>
    </div>
    ${traitsHtml ? `<div class="traits-row">${traitsHtml}</div>` : ''}
    <div class="routines">${routines}${anytimeHtml}</div>
  `;
}

function renderGenericCard(data) {
  const preview = JSON.stringify(data, null, 2).slice(0, 400);
  return `<pre style="font-size:11px;color:#64748b;overflow:auto;max-height:200px;background:#f8fafc;border-radius:8px;padding:10px">${esc(preview)}${preview.length >= 400 ? '\n...' : ''}</pre>`;
}

function renderEmptyCard(dim) {
  return `<div class="empty-card">
    <div class="empty-hint">「${esc(dim.hint)}」から<br>JSONをエクスポートして<br>読み込んでください</div>
  </div>`;
}

// ── Cross-analysis ────────────────────────────────────────────────────────────
function computeInsights() {
  const { needs, behavior } = twin;
  if (!needs || !behavior) return [];

  const insights = [];
  const axis = key => needs.axes.find(a => a.key === key);
  const hasTrait = label => behavior.traits.some(t => t.label === label);

  const belonging = axis('belonging');
  const freedom   = axis('freedom');
  const recognition = axis('recognition');
  const safety    = axis('safety');

  if (belonging?.score > 10 && hasTrait('集団回避傾向')) {
    insights.push({
      type: 'conflict',
      title: '所属欲求 × 集団回避',
      text: '「所属・仲間」への欲求が高い一方、集団を避けるルールを持っています。大人数より少人数・一対一の深いつながりを求めている可能性があります。',
    });
  }

  if (freedom?.score > 5 && hasTrait('好奇心優先型')) {
    insights.push({
      type: 'compensation',
      title: '自由欲求 × 興味優先ルール',
      text: '「自由・自律」への欲求を「興味が湧いたら優先する」ルールで補完しています。自分のペースを守ることが重要な生存戦略になっています。',
    });
  }

  if (needs.overallFulfillment > 0.75 && behavior.bySlot.morning.length >= 6) {
    insights.push({
      type: 'strength',
      title: '充足した基盤 × 構造化された朝',
      text: `心理的充足度${Math.round(needs.overallFulfillment * 100)}%の安定した基盤の上に、朝${behavior.bySlot.morning.length}件のルーティンが構築されています。安定した毎日の立ち上がりが機能しています。`,
    });
  }

  if (hasTrait('服薬ルーティン')) {
    const safetyOk = safety?.score === 0;
    insights.push({
      type: safetyOk ? 'info' : 'conflict',
      title: '服薬ルーティン' + (safetyOk ? '（安全感は充足）' : '× 安全感の欠乏'),
      text: safetyOk
        ? '服薬が日課として定着しています。安全感の欲求は充足しており、医療的ケアと安心感が両立しています。'
        : '服薬が日課になっており、安全感への欲求にも欠乏があります。身体的・精神的ケアへの意識が高いと見られます。',
    });
  }

  if (recognition?.score > 3 && !hasTrait('承認求め行動')) {
    insights.push({
      type: 'info',
      title: '承認欲求への静かな適応',
      text: `承認欲求にわずかな欠乏（スコア${recognition.score}）がありますが、それを補うような行動ルールは見当たりません。内側で処理している可能性があります。`,
    });
  }

  return insights;
}

// ── Dashboard render ─────────────────────────────────────────────────────────
function renderDashboard() {
  const filled = DIMENSIONS.filter(d => twin[d.key] !== null).length;
  const pct = Math.round((filled / DIMENSIONS.length) * 100);

  document.getElementById('comp-fill').style.width = `${pct}%`;
  document.getElementById('comp-text').textContent = `完成度 ${filled} / ${DIMENSIONS.length}`;
  document.getElementById('comp-pct').textContent = `${pct}%`;

  // Source map sidebar
  document.getElementById('source-map-list').innerHTML = DIMENSIONS.map(d => {
    const loaded = twin[d.key] !== null;
    return `<li class="smap-item ${loaded ? 'loaded' : ''}">
      <span>${d.icon}</span>
      <span style="flex:1">${esc(d.label)}</span>
      <span class="smap-status">${loaded ? '✓' : '—'}</span>
    </li>`;
  }).join('');

  // Twin cards
  document.getElementById('twin-grid').innerHTML = DIMENSIONS.map(dim => {
    const data = twin[dim.key];
    let body = '';
    if (data) {
      if (dim.key === 'needs')    body = renderNeeds(data);
      else if (dim.key === 'behavior') body = renderBehavior(data);
      else body = renderGenericCard(data);
    } else {
      body = renderEmptyCard(dim);
    }
    return `<div class="twin-card ${data ? 'has-data' : 'no-data'}" data-key="${dim.key}">
      <div class="card-header">
        <span class="card-icon">${dim.icon}</span>
        <span class="card-title">${esc(dim.label)}</span>
        ${data ? `<button class="card-remove" data-key="${dim.key}" title="削除">✕</button>` : ''}
      </div>
      <div class="card-body">${body}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.card-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      twin[key] = null;
      twin.sources = twin.sources.filter(s => s.mappedKey !== key);
      renderSourcesList();
      renderDashboard();
    });
  });

  // Insights
  const insights = computeInsights();
  const insightsEl = document.getElementById('insights');
  if (insights.length > 0) {
    insightsEl.classList.remove('hidden');
    insightsEl.innerHTML = `
      <div class="insights-header">⚡ 統合インサイト（${insights.length}件）</div>
      <div class="insights-list">
        ${insights.map(ins => `
          <div class="insight-item ${ins.type}">
            <div class="insight-title">${esc(ins.title)}</div>
            <div class="insight-text">${esc(ins.text)}</div>
          </div>
        `).join('')}
      </div>`;
  } else {
    insightsEl.classList.add('hidden');
  }
}

// ── Sources sidebar ───────────────────────────────────────────────────────────
function renderSourcesList() {
  const el = document.getElementById('sources-list');
  if (twin.sources.length === 0) {
    el.innerHTML = '<div class="empty-sources">JSONを読み込んでください</div>';
    return;
  }
  el.innerHTML = twin.sources.map(s => {
    const dim = DIMENSIONS.find(d => d.key === s.mappedKey);
    return `<div class="source-item">
      <span class="source-icon">${dim?.icon || '📄'}</span>
      <div class="source-info">
        <div class="source-name" title="${esc(s.filename)}">${esc(s.filename)}</div>
        <div class="source-type">${esc(dim?.label || s.mappedKey)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── File loading ──────────────────────────────────────────────────────────────
function loadFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);
      const type = detectType(json);
      if (!type) {
        showToast(`${file.name}: 対応形式を検出できませんでした`, 'error');
        return;
      }
      if (twin[type] !== null) {
        showToast(`「${DIMENSIONS.find(d => d.key === type)?.label}」は既に読み込まれています`, 'error');
        return;
      }
      const mappers = { needs: mapNeeds, behavior: mapBehavior };
      twin[type] = mappers[type] ? mappers[type](json) : json;
      twin.sources.push({ filename: file.name, mappedKey: type, importedAt: new Date().toISOString() });
      renderSourcesList();
      renderDashboard();
      showToast(`「${DIMENSIONS.find(d => d.key === type)?.label}」を読み込みました`, 'success');
    } catch (err) {
      showToast(`${file.name}: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportTwin() {
  const filled = DIMENSIONS.filter(d => twin[d.key] !== null).length;
  if (filled === 0) { showToast('データが読み込まれていません', 'error'); return; }

  const output = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    completeness: {
      total: DIMENSIONS.length,
      filled,
      percentage: Math.round(filled / DIMENSIONS.length * 100),
    },
    profile: Object.fromEntries(
      DIMENSIONS.filter(d => twin[d.key]).map(d => [d.key, {
        label: d.label,
        source: twin.sources.find(s => s.mappedKey === d.key)?.filename,
        importedAt: twin.sources.find(s => s.mappedKey === d.key)?.importedAt,
        data: twin[d.key],
      }])
    ),
    insights: computeInsights(),
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `digital-twin-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('デジタルツインをエクスポートしました', 'success');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', e => {
  Array.from(e.target.files).forEach(loadFile);
  e.target.value = '';
});

document.getElementById('export-btn').addEventListener('click', exportTwin);

renderDashboard();
renderSourcesList();
