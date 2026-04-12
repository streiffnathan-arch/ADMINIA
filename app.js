// ─────────────────────────────────────────────
//  AdminAI · app.js · v4 — recherche maximale
// ─────────────────────────────────────────────

const API_URL = “https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/”;
const MODEL   = “claude-sonnet-4-20250514”;

// Config
const BATCH_SIZE   = 1;    // 1 entreprise par appel Claude = résultats précis
const DELAY_MS     = 2500; // pause entre appels (évite rate limit 429)
const MAX_RETRIES  = 1;    // 1 retry si Claude trouve rien au 1er passage

// État global
let excelWorkbook  = null;
let excelRows      = [];
let headerRow      = [];
let results        = [];
let isRunning      = false;
let totalDone      = 0;
let totalOk        = 0;

// ─── DOM refs ────────────────────────────────
const fileInput   = document.getElementById(“fileInput”);
const btnLancer   = document.getElementById(“btnLancer”);
const statusEl    = document.getElementById(“status”);
const progressEl  = document.getElementById(“progress”);
const tableBody   = document.getElementById(“tableBody”);
const exportBtn   = document.getElementById(“exportBtn”);

// ─── CHARGEMENT EXCEL ────────────────────────
fileInput.addEventListener(“change”, e => {
const file = e.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = evt => {
const wb = XLSX.read(evt.target.result, { type: “array” });
excelWorkbook = wb;

```
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

// Première ligne = en-têtes
headerRow = data[0] || [];
excelRows = data.slice(1).filter(r => r.some(c => String(c).trim()));

setStatus(`✅ ${excelRows.length} lignes chargées. Colonnes : ${headerRow.join(" | ")}`);
btnLancer.disabled = false;
console.log("Headers:", headerRow);
console.log("Rows sample:", excelRows.slice(0, 3));
```

};
reader.readAsArrayBuffer(file);
});

// ─── PARSING RÉPONSE CLAUDE ──────────────────
// Claude avec web_search renvoie plusieurs blocs content[]
// Il faut extraire TOUS les blocs text et les concaténer
function extractText(content) {
if (!Array.isArray(content)) return String(content || “”);
return content
.filter(b => b.type === “text”)
.map(b => b.text || “”)
.join(”\n”);
}

function safeParseJSON(text) {
// Essai 1 : array JSON
try {
const s = text.indexOf(”[”);
const e = text.lastIndexOf(”]”);
if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1));
} catch {}

// Essai 2 : objet JSON simple
try {
const s = text.indexOf(”{”);
const e = text.lastIndexOf(”}”);
if (s >= 0 && e > s) return [JSON.parse(text.slice(s, e + 1))];
} catch {}

return null;
}

// ─── NETTOYEURS ──────────────────────────────
function cleanWebsite(v) {
if (!v) return null;
return String(v).trim()
.replace(/^https?:///i, “”)
.replace(/^www./i, “”)
.replace(//$/, “”)
.toLowerCase() || null;
}

function cleanPhone(v) {
if (!v) return null;
const s = String(v).trim();
// Garde +41 ou 0XX formats suisses
if (/(+41|0\d{2})[\s\d]{7,}/.test(s)) return s;
return null;
}

function cleanEmail(v) {
if (!v) return null;
const m = String(v).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}/);
if (!m) return null;
const e = m[0].toLowerCase();
if (e.includes(“example”) || e.includes(“noreply”) || e.includes(“test@”)) return null;
return e;
}

function cleanAddress(v) {
if (!v) return null;
const s = String(v).trim();
// Adresse suisse valide = contient un NPA 4 chiffres
if (/\b\d{4}\b/.test(s) && s.length > 10) return s;
// Ou adresse assez longue
if (s.length > 15) return s;
return null;
}

// ─── APPEL CLAUDE API ────────────────────────
async function callClaude(prompt, isRetry = false) {
const messages = [{
role: “user”,
content: isRetry
? prompt + “\n\nIMPORTANT: Previous search returned nothing. Be MORE aggressive. Try Google Maps, LinkedIn, ZEFIX, moneyhouse.ch. Return JSON even if partial.”
: prompt
}];

const body = {
model: MODEL,
max_tokens: 1500,
tools: [{ type: “web_search_20250305”, name: “web_search” }],
messages
};

const res = await fetch(API_URL, {
method: “POST”,
headers: { “Content-Type”: “application/json”, “anthropic-version”: “2023-06-01” },
body: JSON.stringify(body)
});

if (!res.ok) {
const err = await res.text();
throw new Error(`HTTP ${res.status}: ${err}`);
}

const data = await res.json();
if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

// CRITIQUE : extraire tous les blocs text (pas juste [0])
const text = extractText(data.content);
return text;
}

// ─── PROMPT ENRICHISSEMENT ───────────────────
function buildPrompt(company, geo, existingData, isRetry) {
const known = [];
if (existingData.website) known.push(`website already known: ${existingData.website}`);
if (existingData.phone)   known.push(`phone already known: ${existingData.phone}`);
if (existingData.email)   known.push(`email already known: ${existingData.email}`);
if (existingData.address) known.push(`address already known: ${existingData.address}`);

const missing = [];
if (!existingData.website) missing.push(“website”);
if (!existingData.phone)   missing.push(“phone”);
if (!existingData.email)   missing.push(“email”);
if (!existingData.address) missing.push(“address”);

if (missing.length === 0) return null; // tout est déjà rempli

return `You are a Swiss B2B contact researcher. Find REAL contact data for this company.

COMPANY: “${company}”
${geo ? `LOCATION: ${geo}` : “COUNTRY: Switzerland”}
${known.length ? `ALREADY KNOWN: ${known.join(", ")}` : “”}
NEED TO FIND: ${missing.join(”, “)}

SEARCH STRATEGY (in order):

1. Search: “${company} ${geo || ‘Switzerland’} contact”
1. Search: “${company} site officiel Switzerland”
1. Check moneyhouse.ch — ALWAYS has registered address for Swiss companies
1. Check zefix.ch — Swiss commercial register with official address
1. Visit official website → /contact or /impressum for phone + email
1. Check local.ch or search.ch for phone
1. ${isRetry ? ‘Try Google Maps, LinkedIn company page, FINMA supervised list’ : ‘Try variations of company name’}

RULES:

- website: domain only, NO https:// (e.g. “company.ch”)
- phone: Swiss format +41 XX XXX XX XX
- email: real professional address only
- address: full Swiss address with 4-digit NPA (e.g. “Rue du Rhône 14, 1204 Genève”)
- NEVER invent data. null if not found.

Return ONLY this JSON, nothing else:
[{“website”:null,“phone”:null,“email”:null,“address”:null}]`;
}

// ─── ENRICHISSEMENT D’UNE LIGNE ──────────────
async function enrichRow(row) {
// Détecter colonnes automatiquement
const nameIdx = detectColIndex([“nom”, “name”, “entreprise”, “company”, “client”, “raison”]);
const geoIdx  = detectColIndex([“ville”, “city”, “adresse”, “address”, “canton”, “npa”, “localit”]);

const company = String(row[nameIdx] || row[0] || “”).trim();
if (!company) return null;

// Données déjà connues dans le fichier
const existing = {
website: cleanWebsite(row[detectColIndex([“site”, “web”, “url”])]),
phone:   cleanPhone(row[detectColIndex([“tel”, “phone”, “téléphone”])]),
email:   cleanEmail(row[detectColIndex([“email”, “mail”, “courriel”])]),
address: cleanAddress(row[detectColIndex([“adresse”, “address”, “rue”])])
};

// Contexte géographique
const geo = String(row[geoIdx] || “”).trim() || null;

const prompt = buildPrompt(company, geo, existing, false);
if (!prompt) {
// Tout déjà rempli
return { company, …existing, source: “existing” };
}

let found = { website: null, phone: null, email: null, address: null };

try {
const text = await callClaude(prompt, false);
const parsed = safeParseJSON(text);

```
if (parsed && parsed[0]) {
  found = {
    website: cleanWebsite(parsed[0].website),
    phone:   cleanPhone(parsed[0].phone),
    email:   cleanEmail(parsed[0].email),
    address: cleanAddress(parsed[0].address)
  };
}
```

} catch (err) {
if (String(err).includes(“429”)) {
console.warn(“Rate limit, pause 60s…”);
await sleep(60000);
}
console.error(“Pass 1 error:”, err.message);
}

// RETRY si rien trouvé
const hasData = Object.values(found).some(v => v);
if (!hasData) {
await sleep(DELAY_MS);
try {
const text2 = await callClaude(buildPrompt(company, geo, existing, true), true);
const parsed2 = safeParseJSON(text2);
if (parsed2 && parsed2[0]) {
found = {
website: cleanWebsite(parsed2[0].website),
phone:   cleanPhone(parsed2[0].phone),
email:   cleanEmail(parsed2[0].email),
address: cleanAddress(parsed2[0].address)
};
}
} catch (err) {
console.error(“Pass 2 error:”, err.message);
}
}

// Fusionner avec données existantes
return {
company,
website: found.website || existing.website,
phone:   found.phone   || existing.phone,
email:   found.email   || existing.email,
address: found.address || existing.address,
source: “enriched”
};
}

// ─── DETECT INDEX DE COLONNE ─────────────────
function detectColIndex(keywords) {
const idx = headerRow.findIndex(h =>
keywords.some(k => String(h).toLowerCase().normalize(“NFD”)
.replace(/[\u0300-\u036f]/g, “”).includes(k))
);
return idx >= 0 ? idx : -1;
}

// ─── UTILS ───────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function setStatus(msg) {
if (statusEl) statusEl.textContent = msg;
}

function updateProgress(done, total, ok) {
if (progressEl) progressEl.textContent = `${done}/${total} traitées · ${ok} enrichies`;
document.title = `⏳ ${done}/${total} — AdminAI`;
}

function addTableRow(r) {
if (!tableBody) return;
const tr = document.createElement(“tr”);
const hasData = r && (r.website || r.phone || r.email || r.address);
tr.innerHTML = `<td>${r?.company || "?"}</td> <td>${r?.website || "—"}</td> <td>${r?.phone   || "—"}</td> <td>${r?.email   || "—"}</td> <td>${r?.address || "—"}</td> <td style="color:${hasData ? '#3dd68c' : '#e05555'}">${hasData ? "✓" : "✗"}</td>`;
tableBody.appendChild(tr);
}

// ─── LANCEMENT ───────────────────────────────
async function lancer() {
if (isRunning) return;
if (!excelRows.length) { setStatus(“⚠️ Charge un fichier Excel d’abord.”); return; }

isRunning  = true;
results    = [];
totalDone  = 0;
totalOk    = 0;
if (tableBody) tableBody.innerHTML = “”;
if (exportBtn) exportBtn.disabled = true;
btnLancer.disabled = true;
document.title = “⏳ AdminAI en cours…”;

const total = excelRows.length;
setStatus(`🔍 Enrichissement de ${total} entreprises…`);

for (let i = 0; i < excelRows.length; i++) {
if (!isRunning) break;

```
const row = excelRows[i];
updateProgress(i + 1, total, totalOk);

try {
  const r = await enrichRow(row);
  if (r) {
    results.push(r);
    const hasData = r.website || r.phone || r.email || r.address;
    if (hasData) totalOk++;
    addTableRow(r);
  }
} catch (err) {
  console.error("Row error:", err);
  results.push({ company: String(row[0] || "?"), website: null, phone: null, email: null, address: null });
}

totalDone++;

// Pause entre appels
if (i < excelRows.length - 1) await sleep(DELAY_MS);
```

}

// Terminé
isRunning = false;
document.title = `✅ ${totalOk}/${total} — AdminAI`;
setStatus(`✅ Terminé ! ${totalOk}/${total} entreprises enrichies.`);
btnLancer.disabled = false;
if (exportBtn) exportBtn.disabled = false;
}

// ─── EXPORT EXCEL ────────────────────────────
function exportExcel() {
if (!results.length) { setStatus(“⚠️ Rien à exporter.”); return; }

// Si on a le workbook original, on l’enrichit directement
if (excelWorkbook) {
const wb  = excelWorkbook;
const ws  = wb.Sheets[wb.SheetNames[0]];
const ref = XLSX.utils.decode_range(ws[”!ref”] || “A1”);

```
// Indices des colonnes cibles
const colWebsite = detectColIndex(["site", "web", "url"]);
const colPhone   = detectColIndex(["tel", "phone", "téléphone"]);
const colEmail   = detectColIndex(["email", "mail", "courriel"]);
const colAddress = detectColIndex(["adresse", "address", "rue"]);
const nameIdx    = detectColIndex(["nom", "name", "entreprise", "company", "client"]);

results.forEach(r => {
  // Trouver la ligne Excel correspondante
  const rowIdx = excelRows.findIndex(row => String(row[nameIdx >= 0 ? nameIdx : 0] || "").trim() === r.company);
  if (rowIdx < 0) return;
  const xlsxRow = rowIdx + 1; // +1 pour header (0-indexed dans sheet)

  const write = (colIdx, val) => {
    if (colIdx < 0 || !val) return;
    const addr = XLSX.utils.encode_cell({ r: xlsxRow, c: colIdx });
    ws[addr] = { t: "s", v: val };
    // Étendre le range si nécessaire
    if (xlsxRow > ref.e.r) ref.e.r = xlsxRow;
  };

  write(colWebsite, r.website);
  write(colPhone,   r.phone);
  write(colEmail,   r.email);
  write(colAddress, r.address);
});

ws["!ref"] = XLSX.utils.encode_range(ref);
XLSX.writeFile(wb, "adminia_enrichi.xlsx");
```

} else {
// Fallback : nouveau fichier
const ws = XLSX.utils.json_to_sheet(results);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, “Enrichi”);
XLSX.writeFile(wb, “adminia_enrichi.xlsx”);
}

setStatus(“📥 Fichier Excel exporté !”);
}

// ─── STOP ────────────────────────────────────
function stopEnrich() {
isRunning = false;
setStatus(`⛔ Arrêté. ${totalOk}/${totalDone} enrichies.`);
btnLancer.disabled = false;
}

// Exposer au HTML
window.lancer      = lancer;
window.exportExcel = exportExcel;
window.stopEnrich  = stopEnrich;
