document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("status");
  const preview = document.getElementById("preview");

  fileInput.addEventListener("change", handleFile);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    status.textContent = "Chargement...";

    const reader = new FileReader();

    reader.onload = function (event) {
      try {
        if (typeof XLSX === "undefined") {
          throw new Error("XLSX non chargé");
        }

        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        status.textContent = `OK : ${json.length} lignes`;

        renderTable(json);
      } catch (err) {
        console.error(err);
        status.textContent = "Erreur : " + err.message;
      }
    };

    reader.onerror = () => {
      status.textContent = "Erreur lecture fichier";
    };

    reader.readAsArrayBuffer(file);
  }

  function renderTable(rows) {
    if (!rows.length) {
      preview.innerHTML = "Aucune donnée";
      return;
    }

    const headers = Object.keys(rows[0]);
    const sample = rows.slice(0, 10);

    let html = "<table><thead><tr>";
    headers.forEach(h => html += `<th>${h}</th>`);
    html += "</tr></thead><tbody>";

    sample.forEach(row => {
      html += "<tr>";
      headers.forEach(h => {
        html += `<td>${row[h] ?? ""}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    preview.innerHTML = html;
  }
});
