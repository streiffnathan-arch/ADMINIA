// ═══════════════════════════════════════════
//  AdminAI · app.js
//  Enrichissement B2B Suisse via Claude API
// ═══════════════════════════════════════════

const API_URL = ‘https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/’;
const MODEL   = ‘claude-sonnet-4-20250514’;
const DELAY   = 2500; // ms entre appels API

// ── État ────────────────────────────────────
let wb       = null;   // workbook Excel original
let headers  = [];     // ligne d’en-têtes
let rows     = [];     // lignes de données
let results  = [];     // résultats enrichissement
let running  = false;
let done     = 0;
let okCount  = 0;

// ── DOM ─────────────────────────────────────
const fileInput = document.getElementById(‘fileInput’);
const btnStart  = document.getElementById(‘btnStart’);
const btnStop   = document.getElementById(‘btnStop’);
const btnExport = document.getElementById(‘btnExport’);
const statusEl  = document.getElementById(‘status’);
const pfill     = document.getElementById(‘pfill’);
const progEl    = document.getElementById(‘prog’);
const tbody     = document.getElementById(‘tbody’);
const sTotal    = document.getElementById(‘sTotal’);
const sOk       = document.getElementById(‘sOk’);
const sEmpty    = document.getElementById(‘sEmpty’);

// ── Helpers UI ──────────────────────────────
const log    = msg  => { statusEl.textContent = msg; };
const sleep  = ms   => new Promise(r => setTimeout(r, ms));

function updateStats() {
const t = results.length;
const o = results.filter(r => r.ok).length;
sTotal.textContent = rows.length;
sOk.textContent    = o;
sEmpty.textContent = t - o;
pfill.style.width  = rows.length ? (t / rows.length * 100) + ‘%’ : ‘0%’;
progEl.textContent = `${t}/${rows.length}`;
document.title = running ? `⏳ ${t}/${rows.length} — AdminAI` : ‘AdminAI’;
}

function addRow(r) {
const tr = document.createElement(‘tr’);
const ok = !!(r.website || r.phone || r.email || r.address);
tr.innerHTML = ` <td title="${esc(r.company)}">${esc(r.company)}</td> <td title="${esc(r.website)}">${r.website ? esc(r.website) : '<span class="no-b">—</span>'}</td> <td>${r.phone   ? esc(r.phone)   : '<span class="no-b">—</span>'}</td> <td title="${esc(r.email)}">${r.email   ? esc(r.email)   : '<span class="no-b">—</span>'}</td> <td title="${esc(r.address)}">${r.address ? esc(r.address) : '<span class="no-b">—</span>'}</td> <td class="${ok ? 'ok-b' : 'no-b'}">${ok ? '✓' : '✗'}</td>`;
tbody.appendChild(tr);
tr.scrollIntoView({ behavior: ‘smooth’, block: ‘nearest’ });
}

function esc(v) {
return String(v || ‘’).replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}

// ── Détection colonnes ───────────────────────
function colIdx(keywords) {
return headers.findIndex(h =>
keywords.some(k => String(h).toLowerCase().normalize(‘NFD’)
.replace(/[\u0300-\u036f]/g,’’).includes(k))
);
}

let iName, iSite, iPhone, iEmail, iAddr, iHQ;

function detectColumns() {
iName  = colIdx([‘nom’,‘name’,‘entreprise’,‘company’,‘client’,‘raison’,‘société’]);
iSite  = colIdx([‘site’,‘web’,‘url’,‘homepage’,‘internet’]);
iPhone = colIdx([‘tel’,‘phone’,‘téléphone’,‘mobile’,‘gsm’,‘fax’]);
iEmail = colIdx([‘email’,‘mail’,‘courriel’,’@’]);
iAddr  = colIdx([‘adresse’,‘address’,‘rue’,‘street’,‘localit’]);
iHQ    = colIdx([‘ville’,‘city’,‘canton’,‘npa’,‘zip’,‘headquarter’,‘hq’,‘pays’,‘country’,‘location’,‘région’]);
if (iName < 0) iName = 0; // fallback col A
}

// ── Nettoyeurs ───────────────────────────────
function cleanSite(v) {
if (!v || String(v).trim() === ‘’) return null;
return String(v).trim()
.replace(/^https?:///i,’’).replace(/^www./i,’’).replace(//+$/,’’).toLowerCase() || null;
}
function cleanPhone(v) {
if (!v) return null;
const s = String(v).trim();
if (/(+41|0\d{2})[\s\d-.]{7,}/.test(s)) return s;
if (/\d{7,}/.test(s.replace(/\D/g,’’))) return s;
return null;
}
function cleanEmail(v) {
if (!v) return null;
const m = String(v).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}/);
if (!m) return null;
const e = m[0].toLowerCase();
if ([‘example’,‘noreply’,‘no-reply’,‘test@’,‘donotreply’].some(x => e.includes(x))) return null;
return e;
}
function cleanAddr(v) {
if (!v) return null;
const s = String(v).trim();
if (s.length < 8) return null;
return s;
}

// ── Parsing réponse Claude ───────────────────
// CRUCIAL : avec web_search, Claude renvoie plusieurs blocs content[]
// Il faut filtrer type:“text” et tout concaténer
function extractText(content) {
if (!Array.isArray(content)) return String(content || ‘’);
return content.filter(b => b.type === ‘text’).map(b => b.text || ‘’).join(’\n’);
}

function parseJSON(text) {
// Essai array
try {
const s = text.indexOf(’[’), e = text.lastIndexOf(’]’);
if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1));
} catch {}
// Essai objet unique
try {
const s = text.indexOf(’{’), e = text.lastIndexOf(’}’);
if (s >= 0 && e > s) return [JSON.parse(text.slice(s, e+1))];
} catch {}
return null;
}

// ── Appel Claude API ─────────────────────────
async function callClaude(prompt) {
const res = await fetch(API_URL, {
method:  ‘POST’,
headers: { ‘Content-Type’: ‘application/json’, ‘anthropic-version’: ‘2023-06-01’ },
body: JSON.stringify({
model:      MODEL,
max_tokens: 1500,
tools:      [{ type: ‘web_search_20250305’, name: ‘web_search’ }],
messages:   [{ role: ‘user’, content: prompt }]
})
});

if (!res.ok) {
const txt = await res.text();
throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
}

const data = await res.json();
if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

return extractText(data.content);
}

// ── Prompt enrichissement ────────────────────
function buildPrompt(company, geo, missing, retry) {
const loc = geo || ‘Switzerland’;
const retryNote = retry
? `\nPREVIOUS SEARCH FOUND NOTHING. Try harder:\n- Google Maps: "${company} ${loc}"\n- LinkedIn company page\n- FINMA supervised institutions list\n- Try just first word of name + city\n- moneyhouse.ch or zefix.ch always have Swiss addresses\n`
: ‘’;

return `You are a Swiss B2B data researcher. Find contact data for this company using web search.

COMPANY: “${company}”
LOCATION: ${loc}
FIND: ${missing.join(’, ’)}
${retryNote}
SEARCH STEPS:

1. Search: “${company} ${loc} contact”
1. Visit official website → check /contact /impressum /about pages
1. moneyhouse.ch → registered address for ALL Swiss companies
1. zefix.ch → Swiss commercial register, always has address
1. local.ch or search.ch → phone numbers
1. FINMA list → for financial firms (asset managers, banks)

OUTPUT RULES:

- website: domain only, NO https:// (e.g. “company.ch”)
- phone: Swiss format +41 XX XXX XX XX
- email: real address only, never invent
- address: full address with 4-digit NPA (e.g. “Rue du Rhône 14, 1204 Genève”)
- null if genuinely not found

Return ONLY this JSON, zero other text:
[{“website”:null,“phone”:null,“email”:null,“address”:null}]`;
}

// ── Enrichissement d’une ligne ───────────────
async function enrichOne(row) {
const company = String(row[iName] || ‘’).trim();
if (!company) return null;

// Données déjà présentes dans le fichier
const existing = {
website: cleanSite(iSite  >= 0 ? row[iSite]  : null),
phone:   cleanPhone(iPhone >= 0 ? row[iPhone] : null),
email:   cleanEmail(iEmail >= 0 ? row[iEmail] : null),
address: cleanAddr(iAddr  >= 0 ? row[iAddr]  : null)
};

// Contexte géographique (ville, canton, HQ…)
const geo = iHQ >= 0 && row[iHQ] ? String(row[iHQ]).trim() : null;

// Champs manquants
const missing = [];
if (!existing.website) missing.push(‘website’);
if (!existing.phone)   missing.push(‘phone’);
if (!existing.email)   missing.push(‘email’);
if (!existing.address) missing.push(‘address’);

if (!missing.length) {
// Tout déjà rempli
return { company, …existing, ok: true };
}

let found = { website: null, phone: null, email: null, address: null };

// ── PASS 1 ──────────────────────────────────
try {
const text = await callClaude(buildPrompt(company, geo, missing, false));
const parsed = parseJSON(text);
if (parsed?.[0]) {
found = {
website: cleanSite(parsed[0].website),
phone:   cleanPhone(parsed[0].phone),
email:   cleanEmail(parsed[0].email),
address: cleanAddr(parsed[0].address)
};
}
} catch (err) {
const msg = String(err.message || err);
if (msg.includes(‘429’)) {
log(`⏳ Rate limit — pause 60s...`);
await sleep(60000);
} else {
console.warn(‘Pass 1 error:’, msg);
}
}

// ── PASS 2 si rien trouvé ───────────────────
const hasData1 = Object.values(found).some(v => v);
if (!hasData1 && running) {
await sleep(DELAY);
try {
const text2 = await callClaude(buildPrompt(company, geo, missing, true));
const parsed2 = parseJSON(text2);
if (parsed2?.[0]) {
found = {
website: cleanSite(parsed2[0].website),
phone:   cleanPhone(parsed2[0].phone),
email:   cleanEmail(parsed2[0].email),
address: cleanAddr(parsed2[0].address)
};
}
} catch (err) {
console.warn(‘Pass 2 error:’, String(err.message || err));
}
}

// Fusionner avec données existantes
const final = {
company,
website: found.website || existing.website,
phone:   found.phone   || existing.phone,
email:   found.email   || existing.email,
address: found.address || existing.address
};
final.ok = !!(final.website || final.phone || final.email || final.address);
return final;
}

// ── Chargement fichier ───────────────────────
fileInput.addEventListener(‘change’, e => {
const file = e.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = evt => {
try {
wb = XLSX.read(evt.target.result, { type: ‘array’ });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: ‘’ });

```
  headers = (data[0] || []).map(h => String(h));
  rows    = data.slice(1).filter(r => r.some(c => String(c).trim() !== ''));

  detectColumns();

  log(`✅ ${rows.length} lignes chargées · Colonnes : ${headers.join(' | ')}\nColonne nom détectée : "${headers[iName] || 'col A'}"`);
  btnStart.disabled = false;
  sTotal.textContent = rows.length;
} catch (err) {
  log('❌ Erreur lecture fichier : ' + err.message);
}
```

};
reader.onerror = () => log(‘❌ Impossible de lire le fichier.’);
reader.readAsArrayBuffer(file);
});

// ── START ────────────────────────────────────
btnStart.addEventListener(‘click’, async () => {
if (running || !rows.length) return;

running   = true;
done      = 0;
okCount   = 0;
results   = [];
tbody.innerHTML = ‘’;
btnStart.disabled  = true;
btnExport.disabled = true;
updateStats();

log(`🔍 Enrichissement de ${rows.length} entreprises…`);

for (let i = 0; i < rows.length; i++) {
if (!running) break;

```
const company = String(rows[i][iName] || '').trim();
log(`🔍 [${i+1}/${rows.length}] ${company}…`);

try {
  const r = await enrichOne(rows[i]);
  if (r) {
    results.push(r);
    if (r.ok) okCount++;
    addRow(r);
  }
} catch (err) {
  console.error('Row error:', err);
  results.push({ company, website: null, phone: null, email: null, address: null, ok: false });
  addRow(results[results.length - 1]);
}

done++;
updateStats();

if (i < rows.length - 1 && running) await sleep(DELAY);
```

}

running = false;
document.title = ‘AdminAI’;
log(`✅ Terminé ! ${okCount}/${rows.length} entreprises enrichies.`);
btnStart.disabled  = false;
btnExport.disabled = false;
updateStats();
});

// ── STOP ─────────────────────────────────────
btnStop.addEventListener(‘click’, () => {
if (!running) return;
running = false;
log(`⛔ Arrêté. ${okCount}/${done} enrichies.`);
btnStart.disabled  = false;
btnExport.disabled = results.length === 0;
});

// ── EXPORT EXCEL ─────────────────────────────
btnExport.addEventListener(‘click’, () => {
if (!results.length) { log(‘⚠️ Rien à exporter.’); return; }

if (wb) {
// Écrire directement dans le workbook original
const ws  = wb.Sheets[wb.SheetNames[0]];
const ref = XLSX.utils.decode_range(ws[’!ref’] || ‘A1’);

```
results.forEach(r => {
  // Trouver la ligne Excel par nom d'entreprise
  const ri = rows.findIndex(row => String(row[iName] || '').trim() === r.company);
  if (ri < 0) return;
  const xlsRow = ri + 1; // +1 pour header (0-indexed)

  const write = (ci, val) => {
    if (ci < 0 || !val) return;
    const addr = XLSX.utils.encode_cell({ r: xlsRow, c: ci });
    ws[addr] = { t: 's', v: val };
    if (xlsRow > ref.e.r) ref.e.r = xlsRow;
  };

  write(iSite,  r.website);
  write(iPhone, r.phone);
  write(iEmail, r.email);
  write(iAddr,  r.address);
});

ws['!ref'] = XLSX.utils.encode_range(ref);
XLSX.writeFile(wb, 'adminia_enrichi.xlsx');
```

} else {
// Fallback : nouveau fichier simple
const ws = XLSX.utils.json_to_sheet(results.map(r => ({
Entreprise: r.company,
‘Site web’:  r.website  || ‘’,
Téléphone:   r.phone    || ‘’,
Email:       r.email    || ‘’,
Adresse:     r.address  || ‘’
})));
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, ws, ‘Enrichi’);
XLSX.writeFile(newWb, ‘adminia_enrichi.xlsx’);
}

log(‘📥 Fichier adminia_enrichi.xlsx téléchargé !’);
});
