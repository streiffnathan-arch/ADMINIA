const API_URL = "TON_WORKER_URL";
const MODEL = "claude-sonnet-4-20250514";

const SPEED = 5;
const DELAY = 800;

let rows = [];
let headers = [];
let results = [];

// ─────────────────────────────
// 📊 LOAD EXCEL
// ─────────────────────────────
document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {header:1});

    headers = data[0];
    rows = data.slice(1);

    console.log("Loaded:", rows.length);
  };

  reader.readAsArrayBuffer(file);
});

// ─────────────────────────────
// 🌐 SCRAPER WEBSITE
// ─────────────────────────────
async function scrapeWebsite(domain){
  try{
    const res = await fetch("https://" + domain);
    const html = await res.text();

    const email = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phone = html.match(/(\+41\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2})/);

    return {
      email: email ? email[0] : null,
      phone: phone ? phone[0] : null
    };
  }catch{
    return {};
  }
}

// ─────────────────────────────
// 🤖 API CALL
// ─────────────────────────────
async function callAPI(prompt){
  const res = await fetch(API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:MODEL,
      max_tokens:2000,
      tools:[{type:"web_search_20250305",name:"web_search"}],
      messages:[{role:"user",content:prompt}]
    })
  });

  const data = await res.json();
  return data.content[0].text;
}

// ─────────────────────────────
// 🧠 PROMPT
// ─────────────────────────────
function buildPrompt(batch){
  return `
Find contact data for these Swiss companies.

Use:
- Google Maps
- local.ch
- moneyhouse.ch
- zefix.ch
- LinkedIn

Return MAXIMUM data.

Companies:
${batch.map((c,i)=>`"${c[0]}"`).join("\n")}

Return JSON:
[
  {"idx":0,"website":null,"phone":null,"email":null,"address":null}
]
`;
}

// ─────────────────────────────
// ⚡ WORKER
// ─────────────────────────────
async function worker(queue){
  while(queue.length){
    const batch = queue.splice(0,2);

    const prompt = buildPrompt(batch);

    let res;
    try{
      res = await callAPI(prompt);
    }catch{
      continue;
    }

    let parsed = [];
    try{
      parsed = JSON.parse(res);
    }catch{}

    for(let i=0;i<batch.length;i++){
      let data = parsed[i] || {};

      // 🔥 scraping site
      if(data.website){
        const scraped = await scrapeWebsite(data.website);
        data.email = data.email || scraped.email;
        data.phone = data.phone || scraped.phone;
      }

      results.push({
        name: batch[i][0],
        ...data
      });

      console.log("✔", batch[i][0], data);
    }

    await new Promise(r=>setTimeout(r, DELAY));
  }
}

// ─────────────────────────────
// 🚀 START
// ─────────────────────────────
async function start(){
  const queue = [...rows];

  const workers = [];
  for(let i=0;i<SPEED;i++){
    workers.push(worker(queue));
  }

  await Promise.all(workers);

  exportExcel();
}

// ─────────────────────────────
// 📥 EXPORT
// ─────────────────────────────
function exportExcel(){
  const ws = XLSX.utils.json_to_sheet(results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  XLSX.writeFile(wb, "enriched.xlsx");
}
