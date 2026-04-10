const API_URL = "https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/";
const MODEL = "claude-sonnet-4-20250514";

const SPEED = 5;
const DELAY = 500;

let rows = [];
let results = [];

// 📊 LOAD EXCEL
document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {header:1});

    rows = data.slice(1);
    console.log("Loaded:", rows.length);
  };

  reader.readAsArrayBuffer(file);
});

// 🌐 SCRAPE SITE
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

// 📍 ADRESSE SIMPLE
async function searchAddress(name){
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json`);
    const data = await res.json();
    if(data.length){
      return data[0].display_name;
    }
  }catch{}
  return null;
}

// 🔧 SAFE JSON PARSE
function safeParse(text){
  try{
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if(start !== -1 && end !== -1){
      return JSON.parse(text.slice(start, end+1));
    }
  }catch{}
  return null;
}

// 🤖 CLAUDE BACKUP
async function callAPI(name){
  try{
    const res = await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        max_tokens:500,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{
          role:"user",
          content:`Find website, phone, email and address for ${name} Switzerland. Return JSON array.`
        }]
      })
    });

    const data = await res.json();
    const raw = data?.content?.[0]?.text || "";
    return safeParse(raw);
  }catch(e){
    console.error("API error:", e);
    return null;
  }
}

// ⚡ WORKER
async function worker(queue){
  while(queue.length){
    const row = queue.shift();
    const name = row[0];

    let data = {
      name,
      website:null,
      phone:null,
      email:null,
      address:null
    };

    // 1. Adresse rapide
    data.address = await searchAddress(name);

    // 2. Guess site
    const domain = name.toLowerCase().replace(/\s/g,'') + ".ch";

    const scraped = await scrapeWebsite(domain);
    data.website = domain;
    data.email = scraped.email;
    data.phone = scraped.phone;

    // 3. Backup Claude
    if(!data.email && !data.phone){
      const ai = await callAPI(name);
      if(ai && ai[0]){
        data = {...data, ...ai[0]};
      }
    }

    results.push(data);
    console.log("✔", data);

    await new Promise(r=>setTimeout(r, DELAY));
  }
}

// 🚀 START
async function start(){
  const queue = [...rows];

  const workers = [];
  for(let i=0;i<SPEED;i++){
    workers.push(worker(queue));
  }

  await Promise.all(workers);

  exportExcel();
}

// 📥 EXPORT
function exportExcel(){
  const ws = XLSX.utils.json_to_sheet(results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  XLSX.writeFile(wb, "results.xlsx");
}
