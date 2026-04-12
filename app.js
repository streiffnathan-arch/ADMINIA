<!DOCTYPE html>

<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<title>AdminAI</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1117;--s1:#171c27;--s2:#1e2535;--bd:#2a3347;--acc:#f0a830;--ok:#3dd68c;--no:#e05555;--t1:#e8eaf0;--t2:#8892a4;--t3:#4a5568}
body{background:var(--bg);color:var(--t1);font-family:system-ui,sans-serif;font-size:14px;padding:16px;min-height:100vh}
.wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:12px}

/* header */
.hdr{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(–bd)}
.logo{width:32px;height:32px;background:var(–acc);border-radius:7px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#0f1117;flex-shrink:0}
.hdr h1{font-size:16px;font-weight:600}
.hdr small{font-size:11px;color:var(–t3);display:block}

/* card */
.card{background:var(–s1);border:1px solid var(–bd);border-radius:8px;padding:14px}
.label{font-size:11px;font-weight:600;color:var(–t2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px}

/* file picker */
.pick{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px;
border:2px dashed var(–bd);border-radius:8px;cursor:pointer;background:var(–s2);text-align:center}
.pick:active{border-color:var(–acc)}
.pick input{display:none}

/* log box */
#log{font-size:12px;font-family:monospace;background:var(–s2);border:1px solid var(–bd);
border-radius:6px;padding:10px;min-height:60px;max-height:180px;overflow-y:auto;
white-space:pre-wrap;word-break:break-all;color:var(–t2);line-height:1.5}

/* buttons */
.row{display:flex;gap:8px;flex-wrap:wrap}
button{padding:9px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;transition:.15s}
.b1{background:var(–acc);color:#0f1117}.b1:disabled{background:var(–bd);color:var(–t3);cursor:not-allowed}
.b2{background:var(–s2);color:var(–t1);border:1px solid var(–bd)}
.b3{background:rgba(224,85,85,.15);color:var(–no);border:1px solid rgba(224,85,85,.3)}

/* progress */
.prow{display:flex;gap:8px;align-items:center;margin-top:10px}
.pbar{flex:1;height:4px;background:var(–s2);border-radius:2px;overflow:hidden}
.pfill{height:100%;background:var(–acc);width:0%;transition:width .3s}
#prog{font-size:12px;color:var(–t2);min-width:70px;font-family:monospace}

/* stats */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.stat{background:var(–s2);border:1px solid var(–bd);border-radius:8px;padding:10px 12px;text-align:center}
.sv{font-size:22px;font-weight:700;font-family:monospace}
.sl{font-size:10px;color:var(–t3);margin-top:2px}
.sa{color:var(–acc)}.sg{color:var(–ok)}.sr{color:var(–no)}

/* table */
.tscroll{overflow-x:auto;max-height:380px;overflow-y:auto;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead{position:sticky;top:0;z-index:2}
th{background:var(–s2);color:var(–t2);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:7px 10px;text-align:left;border-bottom:1px solid var(–bd)}
td{padding:7px 10px;border-bottom:1px solid rgba(42,51,71,.4);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
tr:hover td{background:rgba(255,255,255,.02)}
.oc{color:var(–ok);font-weight:700}.nc{color:var(–t3)}
</style>

</head>
<body>
<div class="wrap">

<div class="hdr">
  <div class="logo">A</div>
  <div><h1>AdminAI</h1><small>Enrichissement B2B · Claude + Web Search</small></div>
</div>

<!-- 1. FILE -->

<div class="card">
  <div class="label">1 · Fichier Excel</div>
  <label class="pick" id="pickLabel">
    <input type="file" id="fileInput" accept=".xlsx,.xls,.csv"/>
    <span style="font-size:26px">📊</span>
    <span id="fileName" style="font-weight:500">Appuie pour choisir ton fichier</span>
    <span style="font-size:11px;color:var(--t3)">.xlsx · .xls · .csv</span>
  </label>
</div>

<!-- LOG -->

<div id="log">En attente d'un fichier…</div>

<!-- 2. CONTROLS -->

<div class="card">
  <div class="label">2 · Lancement</div>
  <div class="row">
    <button class="b1" id="btnStart" disabled>🔍 Enrichir</button>
    <button class="b3" id="btnStop">⛔ Stop</button>
    <button class="b2" id="btnExport" disabled>📥 Exporter Excel</button>
  </div>
  <div class="prow">
    <div class="pbar"><div class="pfill" id="pfill"></div></div>
    <span id="prog">—</span>
  </div>
</div>

<!-- STATS -->

<div class="stats">
  <div class="stat"><div class="sv sa" id="sT">0</div><div class="sl">Total</div></div>
  <div class="stat"><div class="sv sg" id="sO">0</div><div class="sl">Enrichies ✓</div></div>
  <div class="stat"><div class="sv sr" id="sE">0</div><div class="sl">Vides ✗</div></div>
</div>

<!-- RESULTS -->

<div class="card">
  <div class="label">Résultats</div>
  <div class="tscroll">
    <table>
      <thead><tr><th>Entreprise</th><th>Site web</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th>✓</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
</div>

</div><!-- /wrap -->

<script>
// ─── CONFIG ─────────────────────────────────
const PROXY = 'https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/';
const MODEL = 'claude-sonnet-4-20250514';
const DELAY = 2500;

// ─── STATE ──────────────────────────────────
let workbook = null;
let headers  = [];
let rows     = [];
let results  = [];
let running  = false;
let okCount  = 0;

// ─── DOM ────────────────────────────────────
const fileInput  = document.getElementById('fileInput');
const btnStart   = document.getElementById('btnStart');
const btnStop    = document.getElementById('btnStop');
const btnExport  = document.getElementById('btnExport');
const logEl      = document.getElementById('log');
const pfill      = document.getElementById('pfill');
const progEl     = document.getElementById('prog');
const tbody      = document.getElementById('tbody');

// ─── LOGGING ────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  logEl.textContent = `[${t}] ${msg}`;
  console.log(msg);
}
function logAppend(msg) {
  const t = new Date().toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  logEl.textContent += `\n[${t}] ${msg}`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

// ─── UTILS ──────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc   = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function updateStats() {
  const done = results.length;
  const ok   = results.filter(r=>r.ok).length;
  document.getElementById('sT').textContent = rows.length || 0;
  document.getElementById('sO').textContent = ok;
  document.getElementById('sE').textContent = done - ok;
  pfill.style.width = rows.length ? (done/rows.length*100)+'%' : '0%';
  progEl.textContent = `${done}/${rows.length}`;
  document.title = running ? `⏳ ${done}/${rows.length}` : 'AdminAI';
}

// ─── COLUMN DETECTION ───────────────────────
let iName=-1, iSite=-1, iPhone=-1, iEmail=-1, iAddr=-1, iGeo=-1;

function findCol(...kws) {
  return headers.findIndex(h =>
    kws.some(k => String(h).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').includes(k))
  );
}
function detectCols() {
  iName  = findCol('nom','name','entreprise','company','client','raison','societe','société');
  iSite  = findCol('site','web','url','homepage');
  iPhone = findCol('tel','phone','telephone','téléphone','mobile','gsm','fax');
  iEmail = findCol('email','mail','courriel');
  iAddr  = findCol('adresse','address','rue','street');
  iGeo   = findCol('ville','city','canton','npa','zip','headquarter','hq','pays','country','location');
  if (iName < 0) iName = 0;
}

// ─── CLEANERS ───────────────────────────────
function cSite(v) {
  if (!v || !String(v).trim()) return null;
  let s = String(v).trim().replace(/^https?:\/\//i,'').replace(/^www\./i,'').replace(/\/$/,'').toLowerCase();
  return s.includes('.') ? s : null;
}
function cPhone(v) {
  if (!v) return null;
  const s = String(v).trim();
  const digits = s.replace(/\D/g,'');
  if (digits.length < 7) return null;
  return s;
}
function cEmail(v) {
  if (!v) return null;
  const m = String(v).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (!m) return null;
  const e = m[0].toLowerCase();
  if (/noreply|no-reply|example|test@|donotreply/.test(e)) return null;
  return e;
}
function cAddr(v) {
  if (!v) return null;
  const s = String(v).trim();
  return s.length > 8 ? s : null;
}

// ─── CLAUDE API CALL ────────────────────────
// IMPORTANT: with web_search tools, Claude returns multiple content blocks
// We must filter type:"text" blocks and join them all
function extractText(content) {
  if (!Array.isArray(content)) return String(content||'');
  return content
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join('\n');
}

function parseResult(text) {
  // Try JSON array first
  try {
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s >= 0 && e > s) {
      const arr = JSON.parse(text.slice(s, e+1));
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  } catch {}
  // Try JSON object
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1));
  } catch {}
  return null;
}

async function callAPI(company, geo, missingFields, isRetry) {
  const location = geo || 'Switzerland';
  const retryHint = isRetry
    ? `IMPORTANT - previous search returned nothing. Try these specifically:
- Google Maps search: "${company} ${location}"
- LinkedIn: company/${company.toLowerCase().replace(/\s+/g,'-')}
- moneyhouse.ch (ALWAYS has Swiss company addresses)
- zefix.ch (Swiss registry, always has address)
- FINMA supervised institutions (for financial firms)
- Try abbreviated or partial company name\n`
    : '';

  const prompt = `Find contact information for this Swiss company using web search.

COMPANY: "${company}"
LOCATION: ${location}  
FIND: ${missingFields.join(', ')}

${retryHint}SEARCH STRATEGY:
1. Search "${company} ${location} official website contact"
2. Visit their website → check /contact /impressum /about
3. Search moneyhouse.ch for "${company}" → always has registered address
4. Search zefix.ch for "${company}" → Swiss registry with official address  
5. Search local.ch for "${company} ${location}" → phone numbers
6. For banks/asset managers: check finma.ch supervised list

STRICT OUTPUT RULES:
- website = domain only, NO https:// prefix (e.g. "woodman.ch" NOT "https://woodman.ch")
- phone = Swiss number, keep as-is (e.g. "+41 22 819 00 00")
- email = real address only, NEVER invent
- address = full address with 4-digit postal code (e.g. "Place du Grand-Mézel 1, 1211 Genève")
- Set field to null if genuinely not found after searching

Return ONLY valid JSON, absolutely nothing else before or after:
[{"website":null,"phone":null,"email":null,"address":null}]`;

  const body = {
    model: MODEL,
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }]
  };

  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0,300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  const text = extractText(data.content);
  return parseResult(text);
}

// ─── ENRICH ONE ROW ─────────────────────────
async function enrichRow(row) {
  const company = String(row[iName] || '').trim();
  if (!company) return null;

  // Read existing data
  const existing = {
    website: cSite(iSite  >= 0 ? row[iSite]  : null),
    phone:   cPhone(iPhone >= 0 ? row[iPhone] : null),
    email:   cEmail(iEmail >= 0 ? row[iEmail] : null),
    address: cAddr(iAddr  >= 0 ? row[iAddr]  : null),
  };

  const geo = iGeo >= 0 && row[iGeo] ? String(row[iGeo]).trim() : null;

  const missing = ['website','phone','email','address'].filter(f => !existing[f]);

  if (!missing.length) {
    return { company, ...existing, ok: true, source: 'existing' };
  }

  let found = { website: null, phone: null, email: null, address: null };

  // Pass 1
  try {
    const raw = await callAPI(company, geo, missing, false);
    if (raw) {
      found = {
        website: cSite(raw.website),
        phone:   cPhone(raw.phone),
        email:   cEmail(raw.email),
        address: cAddr(raw.address),
      };
    }
  } catch (err) {
    const msg = String(err.message || err);
    logAppend(`⚠️ ${company}: ${msg.slice(0,100)}`);
    if (msg.includes('429')) {
      logAppend('⏳ Rate limit — pause 60s...');
      await sleep(60000);
    }
  }

  const hasData = Object.values(found).some(v => v);

  // Pass 2 — retry if empty
  if (!hasData && running) {
    await sleep(DELAY);
    try {
      const raw2 = await callAPI(company, geo, missing, true);
      if (raw2) {
        found = {
          website: cSite(raw2.website),
          phone:   cPhone(raw2.phone),
          email:   cEmail(raw2.email),
          address: cAddr(raw2.address),
        };
      }
    } catch (err2) {
      logAppend(`⚠️ Retry ${company}: ${String(err2.message||err2).slice(0,80)}`);
    }
  }

  const result = {
    company,
    website: found.website || existing.website,
    phone:   found.phone   || existing.phone,
    email:   found.email   || existing.email,
    address: found.address || existing.address,
  };
  result.ok = !!(result.website || result.phone || result.email || result.address);
  return result;
}

// ─── ADD TABLE ROW ──────────────────────────
function addTableRow(r) {
  if (!r) return;
  const tr = document.createElement('tr');
  const ok = r.ok;
  tr.innerHTML = `
    <td title="${esc(r.company)}">${esc(r.company)}</td>
    <td title="${esc(r.website)}">${r.website?esc(r.website):'<span class="nc">—</span>'}</td>
    <td>${r.phone?esc(r.phone):'<span class="nc">—</span>'}</td>
    <td title="${esc(r.email)}">${r.email?esc(r.email):'<span class="nc">—</span>'}</td>
    <td title="${esc(r.address)}">${r.address?esc(r.address):'<span class="nc">—</span>'}</td>
    <td class="${ok?'oc':'nc'}">${ok?'✓':'✗'}</td>`;
  tbody.appendChild(tr);
  tbody.scrollTop = tbody.scrollHeight;
}

// ─── FILE LOAD ──────────────────────────────
fileInput.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;

  document.getElementById('fileName').textContent = file.name;
  log(`Chargement de "${file.name}"…`);

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      workbook = XLSX.read(e.target.result, { type: 'array' });
      const ws   = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      headers = (data[0] || []).map(h => String(h).trim());
      rows    = data.slice(1).filter(r => r.some(c => String(c||'').trim() !== ''));

      detectCols();

      logAppend(`✅ ${rows.length} lignes · ${headers.length} colonnes`);
      logAppend(`Colonne nom : "${headers[iName] || 'A'}" (index ${iName})`);
      logAppend(`Colonnes détectées : site=${iSite} tel=${iPhone} email=${iEmail} addr=${iAddr} geo=${iGeo}`);
      logAppend(`Exemple ligne 1 : ${JSON.stringify(rows[0]).slice(0,150)}`);

      btnStart.disabled = false;
      document.getElementById('sT').textContent = rows.length;
    } catch (err) {
      log('❌ Erreur lecture : ' + err.message);
      console.error(err);
    }
  };
  reader.onerror = () => log('❌ Impossible de lire le fichier.');
  reader.readAsArrayBuffer(file);
});

// ─── START ──────────────────────────────────
btnStart.addEventListener('click', async function() {
  if (running || !rows.length) return;

  running  = true;
  results  = [];
  okCount  = 0;
  tbody.innerHTML = '';
  btnStart.disabled  = true;
  btnExport.disabled = true;

  log(`🚀 Démarrage enrichissement de ${rows.length} entreprises…`);
  updateStats();

  for (let i = 0; i < rows.length; i++) {
    if (!running) { logAppend('⛔ Arrêté par l\'utilisateur.'); break; }

    const company = String(rows[i][iName] || '').trim();
    log(`🔍 [${i+1}/${rows.length}] ${company || '(vide)'}…`);

    try {
      const r = await enrichRow(rows[i]);
      if (r) {
        results.push(r);
        if (r.ok) okCount++;
        addTableRow(r);
        if (r.ok) logAppend(`  ✓ ${r.website||''} ${r.phone||''} ${r.email||''}`);
        else      logAppend(`  ✗ Rien trouvé`);
      }
    } catch (err) {
      logAppend(`  ❌ Erreur : ${String(err.message||err).slice(0,120)}`);
      results.push({ company, website:null, phone:null, email:null, address:null, ok:false });
      addTableRow(results[results.length-1]);
    }

    updateStats();
    if (i < rows.length-1 && running) await sleep(DELAY);
  }

  running = false;
  document.title = 'AdminAI';
  const ok = results.filter(r=>r.ok).length;
  log(`✅ Terminé ! ${ok}/${rows.length} enrichies.`);
  btnStart.disabled  = false;
  btnExport.disabled = results.length === 0;
  updateStats();
});

// ─── STOP ───────────────────────────────────
btnStop.addEventListener('click', function() {
  if (!running) return;
  running = false;
  btnStart.disabled  = false;
  btnExport.disabled = results.length === 0;
  log(`⛔ Arrêté.`);
});

// ─── EXPORT ─────────────────────────────────
btnExport.addEventListener('click', function() {
  if (!results.length) { log('⚠️ Rien à exporter.'); return; }

  try {
    if (workbook) {
      // Write into original workbook
      const ws  = workbook.Sheets[workbook.SheetNames[0]];
      const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1');

      results.forEach(r => {
        const ri = rows.findIndex(row => String(row[iName]||'').trim() === r.company);
        if (ri < 0) return;
        const exRow = ri + 1; // skip header row (0-indexed in sheet array)

        const write = (ci, val) => {
          if (ci < 0 || !val) return;
          const addr = XLSX.utils.encode_cell({ r: exRow, c: ci });
          ws[addr] = { t: 's', v: val };
          if (exRow > ref.e.r) ref.e.r = exRow;
        };
        write(iSite,  r.website);
        write(iPhone, r.phone);
        write(iEmail, r.email);
        write(iAddr,  r.address);
      });

      ws['!ref'] = XLSX.utils.encode_range(ref);
      XLSX.writeFile(workbook, 'adminia_enrichi.xlsx');

    } else {
      // Fallback: new file
      const ws = XLSX.utils.json_to_sheet(results.map(r => ({
        Entreprise: r.company,
        'Site web':  r.website  || '',
        Téléphone:   r.phone    || '',
        Email:       r.email    || '',
        Adresse:     r.address  || ''
      })));
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'Enrichi');
      XLSX.writeFile(wb2, 'adminia_enrichi.xlsx');
    }
    log('📥 adminia_enrichi.xlsx téléchargé !');
  } catch (err) {
    log('❌ Export error: ' + err.message);
    console.error(err);
  }
});
</script>

</body>
</html>
