const fileInput = document.getElementById("fileInput");
const statusBox = document.getElementById("status");
const preview = document.getElementById("preview");

fileInput.addEventListener("change", handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) {
    statusBox.textContent = "Aucun fichier sélectionné.";
    return;
  }

  statusBox.textContent = `Chargement de ${file.name}...`;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      if (typeof XLSX === "undefined") {
        throw new Error("La librairie XLSX ne s’est pas chargée.");
      }

      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      statusBox.textContent =
        `Fichier chargé : ${file.name}\n` +
        `Onglet : ${firstSheetName}\n` +
        `Lignes : ${rows.length}`;

      renderPreview(rows);
    } catch (error) {
      console.error(error);
      statusBox.textContent = `Erreur : ${error.message}`;
    }
  };

  reader.onerror = function () {
    statusBox.textContent = "Erreur de lecture du fichier.";
  };

  reader.readAsArrayBuffer(file);
}

function renderPreview(rows) {
  if (!rows || rows.length === 0) {
    preview.innerHTML = "<p>Aucune donnée trouvée.</p>";
    return;
  }

  const headers = Object.keys(rows[0]);
  const sample = rows.slice(0, 10);

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
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
