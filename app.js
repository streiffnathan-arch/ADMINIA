// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMINIA — Extraction maximale de données clients
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ENRICH_URL = "https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/api/enrich";

// ── Définitions des champs cibles (multi-langue) ─────────────

const FIELDS = [
  {
    key: "company",
    label: "Société / Entreprise",
    headerPatterns: [
      /soci[eé]t[eé]/i, /entreprise/i, /company/i, /firma/i,
      /raison.?sociale/i, /nom.?soci/i, /^client$/i, /organisation/i,
      /^account$/i, /^compte$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "contact",
    label: "Contact / Nom",
    headerPatterns: [
      /^contact$/i, /interlocuteur/i, /responsable/i,
      /^nom$/i, /^name$/i, /^last.?name$/i, /^nachname$/i
    ],
    excludeHeaders: [/soci[eé]t[eé]/i, /entreprise/i, /company/i],
    valueHints: [],
    type: "text"
  },
  {
    key: "prenom",
    label: "Prénom",
    headerPatterns: [
      /pr[eé]nom/i, /^firstname$/i, /^first.?name$/i, /^vorname$/i,
      /^given.?name$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "email",
    label: "Email",
    headerPatterns: [/^e.?mail$/i, /courriel/i, /^mail$/i, /^email.?address/i],
    valueHints: [/@[\w.-]+\.\w{2,}/],
    type: "email"
  },
  {
    key: "email2",
    label: "Email 2",
    headerPatterns: [/e.?mail.?2/i, /^mail.?2$/i, /email.?secondaire/i, /^cc.?mail/i],
    valueHints: [/@[\w.-]+\.\w{2,}/],
    type: "email"
  },
  {
    key: "phone",
    label: "Téléphone fixe",
    headerPatterns: [
      /t[eé]l[eé]phone/i, /^t[eé]l\.?$/i, /^phone$/i,
      /^telephone$/i, /t[eé]l.?direct/i, /^tel.?bureau/i,
      /^fixe$/i, /^direct$/i
    ],
    excludeHeaders: [/mobile/i, /portable/i, /fax/i, /gsm/i, /cell/i, /natel/i],
    valueHints: [/^[\+\d][\d\s\-().]{6,}/],
    type: "phone"
  },
  {
    key: "mobile",
    label: "Mobile / Portable",
    headerPatterns: [
      /mobile/i, /portable/i, /^gsm$/i, /^cell/i, /natel/i,
      /^handy$/i, /^portable$/i
    ],
    valueHints: [],
    type: "phone"
  },
  {
    key: "fax",
    label: "Fax",
    headerPatterns: [/fax/i],
    valueHints: [],
    type: "phone"
  },
  {
    key: "address",
    label: "Adresse (rue)",
    headerPatterns: [
      /^adresse$/i, /^address$/i, /^rue$/i, /^strasse$/i,
      /^chemin$/i, /^route$/i, /^voie$/i, /adresse.?1/i,
      /^adresse.?postale$/i, /^street$/i, /^addr$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "address2",
    label: "Adresse complément",
    headerPatterns: [
      /adresse.?2/i, /address.?2/i, /compl[eé]ment.?adresse/i,
      /^b[aâ]timent/i, /^bo[iî]te/i, /^apt\.?$/i, /^suite$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "postal_code",
    label: "Code postal / NPA",
    headerPatterns: [
      /code.?postal/i, /^npa$/i, /^plz$/i,
      /^zip.?code$/i, /^zip$/i, /^cp$/i, /postal.?code/i
    ],
    valueHints: [/^\d{4,5}$/],
    type: "postal"
  },
  {
    key: "city",
    label: "Ville",
    headerPatterns: [
      /^ville$/i, /^city$/i, /localit[eé]/i,
      /^ort$/i, /^commune$/i, /^gemeinde$/i, /^municipality$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "region",
    label: "Région / Canton",
    headerPatterns: [
      /r[eé]gion/i, /^canton$/i, /^kanton$/i,
      /district/i, /d[eé]partement/i, /province/i, /^state$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "country",
    label: "Pays",
    headerPatterns: [
      /^pays$/i, /^country$/i, /^land$/i, /^nation$/i, /^pays.?r[eé]gion/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "website",
    label: "Site web",
    headerPatterns: [
      /site.?web/i, /website/i, /^url$/i, /^web$/i,
      /^site$/i, /homepage/i, /internet/i, /^domain/i
    ],
    valueHints: [/https?:\/\//i, /^www\./i, /\.(com|ch|fr|de|org|net|io|eu)$/i],
    type: "url"
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    headerPatterns: [/linkedin/i],
    valueHints: [/linkedin\.com/i],
    type: "url"
  },
  {
    key: "siret",
    label: "SIRET / SIREN",
    headerPatterns: [
      /^siret/i, /^siren/i, /^rcs$/i, /^rc\b/i,
      /immatriculation/i, /n[°o].?entreprise/i, /id.?entreprise/i
    ],
    valueHints: [/^\d{9}$/, /^\d{14}$/],
    type: "text"
  },
  {
    key: "vat",
    label: "N° TVA / IDE",
    headerPatterns: [
      /^tva$/i, /n[°o].?tva/i, /^uid$/i, /^vat$/i,
      /^mwst$/i, /^ide$/i, /n[°o].?ide/i, /^taxe?$/i
    ],
    valueHints: [/^(CHE|FR|DE|BE|IT|NL|ES|GB)[\d\-]/i, /^CH-\d/i],
    type: "text"
  },
  {
    key: "sector",
    label: "Secteur / Activité",
    headerPatterns: [
      /secteur/i, /industrie/i, /activit[eé]/i, /branche/i,
      /domaine/i, /m[eé]tier/i, /sector/i, /industry/i, /^naf$/i, /^nace$/i
    ],
    valueHints: [],
    type: "text"
  },
  {
    key: "employees",
    label: "Effectif",
    headerPatterns: [
      /effectif/i, /employ[eé]/i, /salari[eé]/i, /employee/i,
      /headcount/i, /personnel/i, /^staff$/i, /nb.?employ/i, /nb.?salari/i
    ],
    valueHints: [/^\d{1,6}$/],
    type: "number"
  },
  {
    key: "revenue",
    label: "Chiffre d'affaires",
    headerPatterns: [
      /chiffre.?affaire/i, /^ca\b/i, /^ca\.$/i,
      /revenue/i, /turnover/i, /umsatz/i, /^ca.?annuel/i
    ],
    valueHints: [],
    type: "currency"
  },
  {
    key: "notes",
    label: "Notes / Commentaires",
    headerPatterns: [
      /^notes?$/i, /^commentaires?$/i, /^remarques?$/i,
      /^observations?$/i, /^memo$/i, /^remarks?$/i, /^description$/i
    ],
    valueHints: [],
    type: "text"
  }
];

// Champs affichés dans le résumé fill rate
const SUMMARY_FIELDS = [
  "company", "contact", "email", "phone", "mobile",
  "address", "postal_code", "city", "country", "website"
];

// ── Normalisation des valeurs ─────────────────────────────────

function normalizeEmail(val) {
  if (!val) return "";
  const m = String(val).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase().trim() : "";
}

function normalizePhone(val) {
  if (!val) return "";
  const raw = String(val).trim();
  // Strip common formatting for analysis
  const digits = raw.replace(/[\s\-().]/g, "");
  if (!digits) return "";
  // Swiss local to international
  if (/^0041\d{9}$/.test(digits)) return "+41" + digits.slice(4);
  if (/^\+41\d{9}$/.test(digits)) return digits;
  if (/^0[1-9]\d{8}$/.test(digits)) return "+41" + digits.slice(1);
  // French local
  if (/^0[1-9]\d{8}$/.test(digits) && digits.startsWith("0033")) return "+33" + digits.slice(4);
  // Generic: keep but clean spacing
  return raw.replace(/\s{2,}/g, " ");
}

function normalizeUrl(val) {
  if (!val) return "";
  let s = String(val).trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^\/\//, "");
  return s.replace(/\/$/, "");
}

function normalizePostal(val) {
  if (!val) return "";
  const s = String(val).trim().replace(/\s/g, "");
  return s;
}

function normalizeText(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function normalizeValue(val, type) {
  switch (type) {
    case "email":    return normalizeEmail(val);
    case "phone":    return normalizePhone(val);
    case "url":      return normalizeUrl(val);
    case "postal":   return normalizePostal(val);
    case "number":
    case "currency": return normalizeText(val);
    default:         return normalizeText(val);
  }
}

// ── Détection automatique des colonnes ───────────────────────

function sampleValues(rows, header, limit = 15) {
  return rows
    .slice(0, 30)
    .map(r => r[header])
    .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
    .slice(0, limit);
}

function scoreColumn(header, samples, field) {
  let score = 0;
  const h = String(header || "").trim();

  // Vérifie les exclusions
  if (field.excludeHeaders) {
    for (const ex of field.excludeHeaders) {
      if (ex.test(h)) return 0;
    }
  }

  // Score sur le nom de colonne (poids élevé)
  for (const pat of field.headerPatterns) {
    if (pat.test(h)) {
      score += 10;
      break;
    }
  }

  // Score sur les valeurs échantillonnées
  if (field.valueHints && field.valueHints.length > 0 && samples.length > 0) {
    let matches = 0;
    for (const v of samples) {
      for (const hint of field.valueHints) {
        if (hint.test(String(v).trim())) { matches++; break; }
      }
    }
    score += Math.round((matches / samples.length) * 8);
  }

  return score;
}

function detectColumnMapping(headers, rows) {
  // Pré-calcul des échantillons par colonne
  const samplesMap = {};
  for (const h of headers) {
    samplesMap[h] = sampleValues(rows, h);
  }

  // Pour chaque champ, trouver la meilleure colonne
  const fieldBestMap = {}; // fieldKey -> { header, score }
  for (const field of FIELDS) {
    let best = { header: null, score: 0 };
    for (const h of headers) {
      const s = scoreColumn(h, samplesMap[h], field);
      if (s > best.score) best = { header: h, score: s };
    }
    fieldBestMap[field.key] = best;
  }

  // Attribution finale : chaque colonne ne peut être assignée qu'une fois
  // On trie par score décroissant pour prioriser les matches forts
  const sorted = FIELDS
    .map(f => ({ key: f.key, ...fieldBestMap[f.key] }))
    .sort((a, b) => b.score - a.score);

  const usedColumns = new Set();
  const mapping = {}; // fieldKey -> columnHeader | null

  for (const { key, header, score } of sorted) {
    if (score >= 5 && header && !usedColumns.has(header)) {
      mapping[key] = header;
      usedColumns.add(header);
    } else {
      mapping[key] = null;
    }
  }

  return mapping;
}

// ── État global ───────────────────────────────────────────────

let rawRows = [];
let allHeaders = [];
let columnMapping = {};
let extractedRows = [];
let originalFileName = "adminia";
let wb = null;
let sheetName = "";

// ── Initialisation ────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fileInput").addEventListener("change", handleFile);
  document.getElementById("extractBtn").addEventListener("click", doExtract);
  document.getElementById("exportLocalBtn").addEventListener("click", exportToExcel);
  document.getElementById("enrichBtn").addEventListener("click", doEnrich);
});

// ── 1. Chargement du fichier ──────────────────────────────────

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  originalFileName = file.name.replace(/\.[^.]+$/, "");
  document.getElementById("fileLabel").textContent = file.name;

  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      if (typeof XLSX === "undefined") throw new Error("Librairie XLSX non chargée");

      const data = new Uint8Array(ev.target.result);
      wb = XLSX.read(data, { type: "array" });
      sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rawRows.length) throw new Error("Fichier vide ou non lisible");

      allHeaders = Object.keys(rawRows[0]);
      columnMapping = detectColumnMapping(allHeaders, rawRows);

      const detected = Object.values(columnMapping).filter(Boolean).length;
      document.getElementById("fileInfo").textContent =
        `${file.name} — ${rawRows.length} lignes, ${allHeaders.length} colonnes, ${detected} champs détectés`;

      showStatus(`Fichier chargé : ${rawRows.length} lignes.`, "ok");
      showMappingUI();
    } catch (err) {
      showStatus("Erreur lecture : " + err.message, "err");
      console.error(err);
    }
  };
  reader.onerror = () => showStatus("Erreur de lecture du fichier", "err");
  reader.readAsArrayBuffer(file);
}

// ── 2. Interface de mapping des colonnes ──────────────────────

function showMappingUI() {
  const grid = document.getElementById("mappingGrid");
  grid.innerHTML = "";

  for (const field of FIELDS) {
    const detectedCol = columnMapping[field.key];

    const row = document.createElement("div");
    row.className = "mapping-row";

    // Label du champ cible
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = field.label;

    // Dropdown de sélection de colonne source
    const select = document.createElement("select");
    select.id = `map_${field.key}`;
    select.className = "map-select";

    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— Ignorer —";
    select.appendChild(emptyOpt);

    for (const h of allHeaders) {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      if (h === detectedCol) opt.selected = true;
      select.appendChild(opt);
    }

    // Badge de statut
    const badge = document.createElement("span");
    if (detectedCol) {
      badge.className = "badge detected";
      badge.textContent = "auto";
    } else {
      badge.className = "badge missing";
      badge.textContent = "—";
    }

    // Aperçu de la valeur détectée
    if (detectedCol && rawRows.length > 0) {
      const preview = document.createElement("span");
      preview.className = "col-preview";
      const sample = sampleValues(rawRows, detectedCol, 1)[0];
      preview.textContent = sample ? `ex: ${String(sample).slice(0, 30)}` : "";
      row.appendChild(label);
      row.appendChild(select);
      row.appendChild(badge);
      row.appendChild(preview);
    } else {
      row.appendChild(label);
      row.appendChild(select);
      row.appendChild(badge);
    }

    grid.appendChild(row);
  }

  const section = document.getElementById("step-mapping");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });
}

// ── 3. Extraction et normalisation ───────────────────────────

function doExtract() {
  // Lit le mapping final depuis les selects
  for (const field of FIELDS) {
    const sel = document.getElementById(`map_${field.key}`);
    if (sel) columnMapping[field.key] = sel.value || null;
  }

  // Extraction ligne par ligne
  extractedRows = rawRows.map((raw, idx) => {
    const out = { _row: idx + 2 }; // numéro de ligne Excel (1 = header)

    for (const field of FIELDS) {
      const col = columnMapping[field.key];
      if (col && raw[col] !== undefined) {
        out[field.key] = normalizeValue(raw[col], field.type);
      } else {
        out[field.key] = "";
      }
    }

    // Conserve les colonnes non mappées sous préfixe _orig
    for (const h of allHeaders) {
      const isMapped = Object.values(columnMapping).includes(h);
      if (!isMapped) {
        out[`_orig_${h}`] = normalizeText(raw[h]);
      }
    }

    return out;
  });

  showResults();
}

// ── 4. Affichage des résultats ────────────────────────────────

function showResults() {
  const total = extractedRows.length;

  // Statistiques globales
  const statsEl = document.getElementById("stats");
  const filledFields = SUMMARY_FIELDS.filter(key =>
    extractedRows.some(r => r[key] && r[key] !== "")
  ).length;
  const totalCells = SUMMARY_FIELDS.length * total;
  const filledCells = SUMMARY_FIELDS.reduce((acc, key) =>
    acc + extractedRows.filter(r => r[key] && r[key] !== "").length, 0
  );
  const globalPct = total > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  statsEl.innerHTML = `
    <span class="stat-item"><strong>${total}</strong> enregistrements</span>
    <span class="stat-item"><strong>${filledFields}/${SUMMARY_FIELDS.length}</strong> champs couverts</span>
    <span class="stat-item stat-highlight"><strong>${globalPct}%</strong> de remplissage global</span>
  `;

  // Taux de remplissage par champ
  const fillRatesEl = document.getElementById("fillRates");
  fillRatesEl.innerHTML = "<h3>Taux de remplissage par champ</h3>";

  for (const key of SUMMARY_FIELDS) {
    const field = FIELDS.find(f => f.key === key);
    if (!field) continue;

    const filled = extractedRows.filter(r => r[key] && r[key] !== "").length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const color = pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";

    const div = document.createElement("div");
    div.className = "fill-rate-row";
    div.innerHTML = `
      <span class="fill-label">${escapeHtml(field.label)}</span>
      <div class="fill-bar-bg">
        <div class="fill-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="fill-pct">${pct}%&nbsp;<span class="fill-count">(${filled}/${total})</span></span>
    `;
    fillRatesEl.appendChild(div);
  }

  // Tableau de prévisualisation
  renderPreview(extractedRows, SUMMARY_FIELDS);

  const section = document.getElementById("step-results");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });
  showStatus("Extraction terminée.", "ok");
}

function renderPreview(rows, fieldKeys) {
  const preview = document.getElementById("preview");
  if (!rows.length) { preview.innerHTML = "<p class='muted'>Aucune donnée.</p>"; return; }

  const sample = rows.slice(0, 20);
  let html = '<div class="table-wrap"><table><thead><tr>';

  for (const key of fieldKeys) {
    const field = FIELDS.find(f => f.key === key);
    html += `<th>${escapeHtml(field ? field.label : key)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const row of sample) {
    html += "<tr>";
    for (const key of fieldKeys) {
      const val = row[key] || "";
      html += val
        ? `<td>${escapeHtml(val)}</td>`
        : `<td class="empty-cell"></td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  if (rows.length > 20) {
    html += `<p class="muted">Aperçu limité aux 20 premières lignes sur ${rows.length}.</p>`;
  }
  preview.innerHTML = html;
}

// ── 5. Export Excel ───────────────────────────────────────────

function exportToExcel() {
  if (!extractedRows.length) return;

  const exportData = extractedRows.map(row => {
    const out = {};
    for (const field of FIELDS) {
      if (row[field.key] !== undefined) {
        out[field.label] = row[field.key];
      }
    }
    // Inclure les colonnes originales non mappées
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith("_orig_")) {
        out[k.replace("_orig_", "")] = v;
      }
    }
    return out;
  });

  const newWb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(newWb, ws, "Données clients");
  XLSX.writeFile(newWb, `${originalFileName}_extrait.xlsx`);
  showStatus("Fichier exporté : " + originalFileName + "_extrait.xlsx", "ok");
}

// ── 6. Enrichissement IA ──────────────────────────────────────

async function doEnrich() {
  if (!extractedRows.length) return;

  const enrichBtn = document.getElementById("enrichBtn");
  enrichBtn.disabled = true;

  const section = document.getElementById("step-enrich");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });

  const enrichStatus = document.getElementById("enrichStatus");
  enrichStatus.textContent = `Envoi de ${extractedRows.length} lignes au Worker IA...`;

  try {
    const response = await fetch(ENRICH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: extractedRows,
        fieldMap: FIELDS.map(f => ({ key: f.key, label: f.label }))
      })
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Réponse non JSON : " + text.slice(0, 200)); }

    if (!data.ok) throw new Error(data.error || "Erreur Worker");
    if (!Array.isArray(data.enriched)) throw new Error("Réponse invalide (pas de tableau enriched)");

    extractedRows = data.enriched;
    showResults();
    enrichStatus.innerHTML = `<span class="ok">Enrichissement terminé — ${data.enriched.length} lignes mises à jour.</span>`;
    showStatus("Enrichissement IA terminé.", "ok");
  } catch (err) {
    enrichStatus.innerHTML = `<span class="err">Erreur : ${escapeHtml(err.message)}</span>`;
    showStatus("Erreur enrichissement : " + err.message, "err");
    console.error(err);
  } finally {
    enrichBtn.disabled = false;
  }
}

// ── Utilitaires ───────────────────────────────────────────────

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.innerHTML = `<span class="${type || ""}">${escapeHtml(msg)}</span>`;
}

function escapeHtml(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
