const BACKEND_URL = "https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/api/enrich";

let workbook = null;
let worksheetName = "";
let rows = [];
let originalFileName = "adminia";

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const statusBox = document.getElementById("status");
  const preview = document.getElementById("preview");
  const startBtn = document.getElementById("startBtn");
  const downloadBox = document.getElementById("downloadBox");

  if (!fileInput || !statusBox || !preview || !startBtn || !downloadBox) {
    console.error("Éléments HTML introuvables");
    return;
  }

  fileInput.addEventListener("change", handleFile);
  startBtn.addEventListener("click", startEnrichment);

  function handleFile(event) {
    const file = event.target.files[0];
    if (!file) {
      statusBox.textContent = "Aucun fichier sélectionné.";
      return;
    }

    originalFileName = file.name.replace(/\.[^.]+$/, "");
    statusBox.textContent = `Chargement de ${file.name}...`;
    downloadBox.innerHTML = "";

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        if (typeof XLSX === "undefined") {
          throw new Error("La librairie XLSX ne s’est pas chargée.");
        }

        const data = new Uint8Array(e.target.result);
        workbook = XLSX.read(data, { type: "array" });

        worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rows.length) {
          statusBox.textContent = "Le fichier est vide ou illisible.";
          startBtn.disabled = true;
          preview.innerHTML = "";
          return;
        }

        statusBox.textContent =
          `Fichier chargé : ${file.name}\n` +
          `Onglet : ${worksheetName}\n` +
          `Lignes : ${rows.length}`;

        renderPreview(rows);
        startBtn.disabled = false;
      } catch (error) {
        console.error(error);
        statusBox.textContent = `Erreur lecture fichier : ${error.message}`;
        startBtn.disabled = true;
      }
    };

    reader.onerror = function () {
      statusBox.textContent = "Erreur de lecture du fichier.";
      startBtn.disabled = true;
    };

    reader.readAsArrayBuffer(file);
  }

  async function startEnrichment() {
    if (!rows.length) {
      statusBox.textContent = "Aucune ligne à envoyer.";
      return;
    }

    try {
      startBtn.disabled = true;
      downloadBox.innerHTML = "";
      statusBox.textContent =
        `Envoi au Worker...\n` +
        `URL : ${BACKEND_URL}\n` +
        `Lignes envoyées : ${rows.length}`;

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows })
      });

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`Backend ${response.status}: ${rawText}`);
      }

      let result;
      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error(`Réponse non JSON: ${rawText}`);
      }

      if (!result.ok) {
        throw new Error(result.error || "Le Worker a renvoyé une erreur.");
      }

      if (!Array.isArray(result.enriched)) {
        throw new Error("Le Worker n’a pas renvoyé de tableau 'enriched'.");
      }

      statusBox.textContent =
        `Traitement terminé.\n` +
        `Lignes envoyées : ${rows.length}\n` +
        `Lignes reçues : ${result.enriched.length}`;

      renderPreview(result.enriched);
      exportEnrichedFile(result.enriched);
    } catch (error) {
      console.error(error);
      statusBox.textContent = `Erreur enrichissement : ${error.message}`;
    } finally {
      startBtn.disabled = false;
    }
  }

  function exportEnrichedFile(enrichedRows) {
    try {
      const newWorkbook = XLSX.utils.book_new();
      const newWorksheet = XLSX.utils.json_to_sheet(enrichedRows);

      XLSX.utils.book_append_sheet(
        newWorkbook,
        newWorksheet,
        worksheetName || "Enriched"
      );

      const exportFileName = `${originalFileName}_enrichi.xlsx`;

      XLSX.writeFile(newWorkbook, exportFileName);

      downloadBox.innerHTML =
        `<div>Export terminé : <strong>${escapeHtml(exportFileName)}</strong></div>`;
    } catch (error) {
      console.error(error);
      downloadBox.innerHTML =
        `<div>Erreur export : ${escapeHtml(error.message)}</div>`;
    }
  }

  function renderPreview(data) {
    if (!data || data.length === 0) {
      preview.innerHTML = "<p>Aucune donnée trouvée.</p>";
      return;
    }

    const headers = Object.keys(data[0]);
    const sample = data.slice(0, 10);

    let html = "<table><thead><tr>";
    for (const header of headers) {
      html += `<th>${escapeHtml(header)}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (const row of sample) {
      html += "<tr>";
      for (const header of headers) {
        html += `<td>${escapeHtml(String(row[header] ?? ""))}</td>`;
      }
      html += "</tr>";
    }

    html += "</tbody></table>";
    preview.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
