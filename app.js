let workbook = null;
let activeSheet = null;
let rows = [];
let headers = [];

// Remplace cette URL par ton backend plus tard
const BACKEND_URL = "https://TON-BACKEND/api/enrich";

const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const preview = document.getElementById("preview");
const startBtn = document.getElementById("startBtn");
const statusBox = document.getElementById("status");

fileInput.addEventListener("change", handleFileSelect);
startBtn.addEventListener("click", startEnrichment);

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileInfo.textContent = `Fichier chargé : ${file.name}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      workbook = XLSX.read(data, { type: "array" });

      activeSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[activeSheet];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      rows = json;
      headers = json.length ? Object.keys(json[0]) : [];

      renderPreview(rows, headers);
      startBtn.disabled = rows.length === 0;
      statusBox.textContent = `${rows.length} lignes détectées.`;
    } catch (error) {
      console.error(error);
      statusBox.textContent = `Erreur lecture Excel : ${error.message}`;
    }
  };

  reader.readAsArrayBuffer(file);
}

function renderPreview(data, cols) {
  if (!data.length) {
    preview.innerHTML = "<p class='muted'>Aucune donnée à afficher</p>";
    return;
  }

  const sample = data.slice(0, 10);

  let html = "<table><thead><tr>";
  cols.forEach((col) => {
    html += `<th>${escapeHtml(col)}</th>`;
  });
  html += "</tr></thead><tbody>";

  sample.forEach((row) => {
    html += "<tr>";
    cols.forEach((col) => {
      html += `<td>${escapeHtml(String(row[col] ?? ""))}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  preview.innerHTML = html;
}

async function startEnrichment() {
  if (!rows.length) return;

  statusBox.textContent = "Envoi des données au backend...";

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sheetName: activeSheet,
        rows
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Backend ${response.status}: ${text}`);
    }

    const result = await response.json();

    statusBox.textContent =
      `Traitement terminé.\n` +
      `Lignes traitées : ${result.total}\n` +
      `Lignes enrichies : ${result.enriched}\n` +
      `Télécharge le fichier : ${result.downloadUrl}`;

    if (result.downloadUrl) {
      const a = document.createElement("a");
      a.href = result.downloadUrl;
      a.textContent = "Télécharger le fichier enrichi";
      a.target = "_blank";
      a.style.display = "inline-block";
      a.style.marginTop = "12px";
      preview.appendChild(a);
    }
  } catch (error) {
    console.error(error);
    statusBox.textContent = `Erreur enrichissement : ${error.message}`;
  }
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
