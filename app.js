// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMINIA — Extraction maximale de données clients
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ENRICH_URL        = "https://shy-waterfall-8a1e.streiffnathan-432.workers.dev/api/enrich";
const CLAUDE_API_URL    = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL      = "claude-sonnet-4-6";
const ENRICH_BATCH_SIZE = 5;   // entreprises par appel API
const ENRICH_DELAY_MS   = 2500; // ms entre deux batchs (rate-limit)
const CACHE_KEY         = "adminia_enrich_cache_v1";
const APIKEY_LS_KEY     = "adminia_claude_key";

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

// ── Constantes de post-traitement ────────────────────────────

// Domaines email génériques → ne pas en déduire un site web
const GENERIC_MAIL_DOMAINS = new Set([
  "gmail.com","yahoo.com","yahoo.fr","yahoo.ch","hotmail.com","hotmail.fr",
  "outlook.com","live.com","live.fr","icloud.com","me.com","aol.com",
  "bluewin.ch","sunrise.ch","hispeed.ch","vtxnet.ch","swisscom.ch",
  "romandie.com","netplus.ch","gmx.ch","gmx.net","gmx.de","gmx.at",
  "free.fr","orange.fr","laposte.net","sfr.fr","wanadoo.fr",
  "proton.me","protonmail.com","pm.me","tutanota.com"
]);

// Regex de détection dans du texte brut
const EMAIL_RE  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE  = /(?:(?:\+|00)\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/g;
const URL_RE    = /(?:https?:\/\/|www\.)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:\/[^\s,<>"')\]]*)?/gi;
const POSTAL_RE = /\b(\d{4,5})\s+((?:[A-ZÀ-Ü\u00C0-\u017E][a-zA-Zà-ü\u00C0-\u017E\s\-]{2,29}))/g;

// NPA suisses → ville (couverture des ~300 NPA les plus fréquents)
const CH_POSTAL = {
  "1000":"Lausanne","1003":"Lausanne","1004":"Lausanne","1005":"Lausanne",
  "1006":"Lausanne","1007":"Lausanne","1008":"Prilly","1009":"Pully",
  "1010":"Lausanne","1011":"Lausanne","1012":"Lausanne","1015":"Lausanne",
  "1018":"Lausanne","1020":"Renens","1022":"Chavannes","1023":"Crissier",
  "1024":"Ecublens","1025":"St-Sulpice","1026":"Echandens","1028":"Préverenges",
  "1110":"Morges","1162":"St-Prex","1170":"Aubonne","1180":"Rolle",
  "1196":"Gland","1197":"Prangins","1200":"Genève","1201":"Genève",
  "1202":"Genève","1203":"Genève","1204":"Genève","1205":"Genève",
  "1206":"Genève","1207":"Genève","1208":"Genève","1209":"Genève",
  "1212":"Grand-Lancy","1213":"Petit-Lancy","1214":"Vernier","1215":"Genève",
  "1217":"Meyrin","1218":"Grand-Saconnex","1219":"Châtelaine","1220":"Les Avanchets",
  "1225":"Chêne-Bourg","1226":"Thônex","1227":"Carouge","1228":"Plan-les-Ouates",
  "1231":"Conches","1232":"Confignon","1233":"Bernex","1242":"Satigny",
  "1245":"Collonge-Bellerive","1246":"Corsier","1290":"Versoix","1292":"Chambésy",
  "1293":"Bellevue","1294":"Genthod","1295":"Mies","1296":"Coppet",
  "1297":"Founex","1299":"Crans-près-Céligny","1300":"Eclépens",
  "1400":"Yverdon-les-Bains","1401":"Yverdon","1450":"Ste-Croix",
  "1530":"Payerne","1700":"Fribourg","1701":"Fribourg","1702":"Fribourg",
  "1703":"Fribourg","1705":"Fribourg","1800":"Vevey","1814":"La Tour-de-Peilz",
  "1820":"Montreux","1844":"Villeneuve","1860":"Aigle","1950":"Sion",
  "1951":"Sion","1958":"St-Léonard","1960":"Sierre","1963":"Vétroz",
  "2000":"Neuchâtel","2001":"Neuchâtel","2002":"Neuchâtel","2300":"La Chaux-de-Fonds",
  "2500":"Biel/Bienne","2502":"Biel/Bienne","2503":"Biel/Bienne","2560":"Nidau",
  "2800":"Delémont","2900":"Porrentruy","3000":"Bern","3001":"Bern",
  "3002":"Bern","3003":"Bern","3004":"Bern","3005":"Bern","3006":"Bern",
  "3007":"Bern","3008":"Bern","3010":"Bern","3011":"Bern","3012":"Bern",
  "3013":"Bern","3014":"Bern","3015":"Bern","3018":"Bern","3027":"Bern",
  "3097":"Liebefeld","3098":"Köniz","3100":"Köniz","3110":"Münsingen",
  "3150":"Schwarzenburg","3172":"Niederwangen","3173":"Oberwangen",
  "3174":"Thörishaus","3176":"Neuenegg","3177":"Laupen","3250":"Lyss",
  "3270":"Aarberg","3280":"Murten","3400":"Burgdorf","3600":"Thun",
  "3601":"Thun","3602":"Thun","3603":"Thun","3604":"Thun","3608":"Thun",
  "3700":"Spiez","3800":"Interlaken","3900":"Brig","3920":"Zermatt",
  "3930":"Visp","3960":"Sierre","4000":"Basel","4001":"Basel","4002":"Basel",
  "4003":"Basel","4004":"Basel","4005":"Basel","4051":"Basel","4052":"Basel",
  "4053":"Basel","4054":"Basel","4055":"Basel","4056":"Basel","4057":"Basel",
  "4058":"Basel","4059":"Basel","4102":"Binningen","4103":"Bottmingen",
  "4104":"Oberwil","4123":"Allschwil","4125":"Riehen","4127":"Birsfelden",
  "4132":"Muttenz","4133":"Pratteln","4142":"Münchenbuchsee","4153":"Reinach",
  "4500":"Solothurn","4600":"Olten","4800":"Zofingen","4900":"Langenthal",
  "4901":"Langenthal","5000":"Aarau","5001":"Aarau","5200":"Brugg",
  "5210":"Windisch","5300":"Turgi","5400":"Baden","5401":"Baden",
  "5405":"Dättwil","5408":"Ennetbaden","5600":"Lenzburg","5610":"Wohlen",
  "5620":"Bremgarten","5700":"Zeihen","6000":"Luzern","6001":"Luzern",
  "6002":"Luzern","6003":"Luzern","6004":"Luzern","6005":"Luzern",
  "6006":"Luzern","6010":"Kriens","6020":"Emmenbrücke","6030":"Ebikon",
  "6032":"Emmen","6033":"Buchrain","6034":"Inwil","6036":"Dierikon",
  "6039":"Root","6043":"Adligenswil","6045":"Meggen","6048":"Horw",
  "6060":"Sarnen","6102":"Malters","6110":"Wolhusen","6130":"Willisau",
  "6210":"Sursee","6300":"Zug","6301":"Zug","6302":"Zug","6303":"Zug",
  "6304":"Zug","6340":"Baar","6343":"Rotkreuz","6370":"Stans",
  "6403":"Küssnacht","6410":"Goldau","6430":"Schwyz","6440":"Brunnen",
  "6460":"Altdorf","6500":"Bellinzona","6512":"Giubiasco","6600":"Locarno",
  "6648":"Minusio","6700":"Bellinzona","6850":"Mendrisio","6900":"Lugano",
  "6901":"Lugano","6902":"Lugano","6903":"Lugano","6904":"Lugano",
  "6905":"Lugano","6906":"Lugano","6907":"Lugano","6912":"Lugano",
  "6914":"Lugano","6916":"Grancia","6917":"Barbengo","6932":"Breganzona",
  "6933":"Muzzano","6934":"Bioggio","6942":"Savosa","6943":"Vezia",
  "6944":"Cureglia","6945":"Origlio","6946":"Ponte Capriasca","6948":"Porza",
  "6949":"Comano","6950":"Tesserete","6952":"Canobbio","6953":"Lugaggia",
  "7000":"Chur","7002":"Chur","7004":"Chur","7500":"St. Moritz",
  "7510":"Champfèr","7560":"Davos","8000":"Zürich","8001":"Zürich",
  "8002":"Zürich","8003":"Zürich","8004":"Zürich","8005":"Zürich",
  "8006":"Zürich","8007":"Zürich","8008":"Zürich","8032":"Zürich",
  "8037":"Zürich","8038":"Zürich","8041":"Zürich","8044":"Zürich",
  "8045":"Zürich","8046":"Zürich","8047":"Zürich","8048":"Zürich",
  "8049":"Zürich","8050":"Zürich","8051":"Zürich","8052":"Zürich",
  "8053":"Zürich","8055":"Zürich","8057":"Zürich","8064":"Zürich",
  "8102":"Oberengstringen","8103":"Unterengstringen","8105":"Regensdorf",
  "8108":"Dällikon","8152":"Glattbrugg","8153":"Rümlang","8154":"Oberglatt",
  "8155":"Niederhasli","8157":"Dielsdorf","8172":"Niederglatt","8180":"Bülach",
  "8200":"Schaffhausen","8201":"Schaffhausen","8202":"Schaffhausen",
  "8280":"Kreuzlingen","8400":"Winterthur","8401":"Winterthur",
  "8402":"Winterthur","8403":"Winterthur","8404":"Winterthur","8406":"Winterthur",
  "8408":"Winterthur","8500":"Frauenfeld","8570":"Weinfelden","8600":"Dübendorf",
  "8610":"Uster","8620":"Wetzikon","8630":"Rüti","8700":"Küsnacht",
  "8702":"Zollikon","8703":"Erlenbach","8704":"Herrliberg","8706":"Meilen",
  "8800":"Thalwil","8802":"Kilchberg","8803":"Rüschlikon","8804":"Au",
  "8805":"Richterswil","8810":"Horgen","8820":"Wädenswil","8832":"Wollerau",
  "8834":"Schindellegi","8840":"Einsiedeln","8902":"Urdorf","8903":"Birmensdorf",
  "8904":"Aesch","8906":"Bonstetten","8907":"Wettswil","8908":"Hedingen",
  "8910":"Affoltern am Albis","8952":"Schlieren","8953":"Dietikon","8954":"Geroldswil",
  "8955":"Oetwil","8962":"Bergdietikon","8963":"Kindhausen","8964":"Rudolfstetten",
  "8965":"Berikon","8966":"Oberwil","8967":"Niederwil","8972":"Obfelden",
  "8900":"Uster","9000":"St. Gallen","9001":"St. Gallen","9004":"St. Gallen",
  "9006":"St. Gallen","9008":"St. Gallen","9010":"St. Gallen","9011":"St. Gallen",
  "9012":"St. Gallen","9013":"St. Gallen","9014":"St. Gallen","9015":"St. Gallen",
  "9016":"St. Gallen","9030":"Abtwil","9032":"Engelburg","9033":"Untereggen",
  "9034":"Eggersriet","9100":"Herisau","9200":"Gossau","9201":"Gossau",
  "9205":"Gossau","9300":"Wittenbach","9400":"Rorschach","9424":"Rheineck",
  "9430":"St. Margrethen","9450":"Altstätten","9500":"Wil","9501":"Wil",
  "9600":"Buchs"
};

// Normalise un pays en clair → code ISO 2 lettres
const COUNTRY_ALIASES = {
  "suisse":"CH","switzerland":"CH","schweiz":"CH","svizzera":"CH","svizra":"CH",
  "france":"FR","frankreich":"FR","frankrijk":"FR",
  "allemagne":"DE","germany":"DE","deutschland":"DE",
  "italie":"IT","italy":"IT","italia":"IT",
  "belgique":"BE","belgium":"BE","belgie":"BE","belgien":"BE",
  "autriche":"AT","austria":"AT","österreich":"AT",
  "espagne":"ES","spain":"ES","españa":"ES",
  "pays-bas":"NL","netherlands":"NL","niederlande":"NL","holland":"NL",
  "royaume-uni":"GB","united kingdom":"GB","uk":"GB","great britain":"GB",
  "états-unis":"US","united states":"US","usa":"US",
  "luxembourg":"LU","liechtenstein":"LI","monaco":"MC"
};

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

// ── Post-traitement : scan universel ─────────────────────────
//
// Parcourt TOUTES les cellules d'une ligne brute pour y trouver
// des emails, téléphones ou URLs qui ne se trouvaient pas dans les
// colonnes mappées.  Ne remplace jamais une valeur déjà remplie.

function universalScan(rawRow, out, allHeaders) {
  let gained = 0;

  for (const h of allHeaders) {
    const cell = String(rawRow[h] ?? "").trim();
    if (cell.length < 4) continue;

    // ── Email ────────────────────────────────────────────────
    if (!out.email || !out.email2) {
      const hits = [...cell.matchAll(EMAIL_RE)].map(m => m[0].toLowerCase());
      for (const hit of hits) {
        if (!out.email)            { out.email  = hit; gained++; }
        else if (!out.email2 && hit !== out.email) { out.email2 = hit; gained++; }
      }
    }

    // ── Téléphone ────────────────────────────────────────────
    if (!out.phone || !out.mobile) {
      const hits = [...cell.matchAll(PHONE_RE)]
        .map(m => normalizePhone(m[0]))
        .filter(p => p.length >= 7);

      for (const hit of hits) {
        if (!out.phone)                      { out.phone  = hit; gained++; }
        else if (!out.mobile && hit !== out.phone) { out.mobile = hit; gained++; }
      }
    }

    // ── URL / Site web ────────────────────────────────────────
    if (!out.website) {
      const hits = [...cell.matchAll(URL_RE)].map(m => normalizeUrl(m[0]));
      if (hits.length) { out.website = hits[0]; gained++; }
    }

    // ── LinkedIn ─────────────────────────────────────────────
    if (!out.linkedin && /linkedin\.com/i.test(cell)) {
      const m = cell.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,<>"')]+/i);
      if (m) { out.linkedin = normalizeUrl(m[0]); gained++; }
    }
  }

  return gained;
}

// ── Post-traitement : déduction inter-champs ──────────────────
//
// Déduit des valeurs manquantes à partir de ce qui est déjà connu.
// Exemples :
//   email "jean@acme.ch"  → website "acme.ch"
//   postal_code "1200"    → city "Genève", country "CH"
//   contact "Jean Dupont" → prenom "Jean" + contact "Dupont"
//   address "Rue X 12, 1200 Genève" → postal_code + city + address nettoyée

function inferFromExisting(out) {
  let gained = 0;

  // ── Email → site web ─────────────────────────────────────────
  if (out.email && !out.website) {
    const at = out.email.lastIndexOf("@");
    if (at !== -1) {
      const domain = out.email.slice(at + 1).toLowerCase();
      if (!GENERIC_MAIL_DOMAINS.has(domain)) {
        out.website = domain;
        gained++;
      }
    }
  }

  // ── Adresse combinée → code postal + ville ───────────────────
  // Gère "Rue de la Paix 12, 1200 Genève" et "1200 Genève, Rue 5"
  if (out.address && (!out.postal_code || !out.city)) {
    const addr = out.address;

    // Cherche "NNNN Ville" ou "NNNNN Ville" dans l'adresse
    POSTAL_RE.lastIndex = 0;
    const pm = POSTAL_RE.exec(addr);
    if (pm) {
      const npa  = pm[1];
      const ville = pm[2].trim().replace(/[,;]+$/, "");

      if (!out.postal_code) { out.postal_code = npa;   gained++; }
      if (!out.city)        { out.city        = ville; gained++; }

      // Nettoie l'adresse : supprime la partie "1200 Genève"
      const cleanAddr = addr.replace(pm[0], "").replace(/[,\s]+$/, "").trim();
      if (cleanAddr) out.address = cleanAddr;
    }
  }

  // ── Code postal suisse → ville ───────────────────────────────
  if (out.postal_code && !out.city) {
    const npa = String(out.postal_code).replace(/\s/g, "");
    const found = CH_POSTAL[npa];
    if (found) { out.city = found; gained++; }
  }

  // ── Code postal → pays ────────────────────────────────────────
  if (out.postal_code && !out.country) {
    const npa = String(out.postal_code).replace(/\s/g, "");
    if (/^\d{4}$/.test(npa) && CH_POSTAL[npa]) {
      out.country = "CH"; gained++;
    } else if (/^\d{5}$/.test(npa)) {
      // 5 chiffres = France ou Allemagne ; ne pas deviner sans certitude
    }
  }

  // ── Normalisation du pays ─────────────────────────────────────
  if (out.country) {
    const key = out.country.toLowerCase().trim();
    const iso  = COUNTRY_ALIASES[key];
    if (iso && iso !== out.country) { out.country = iso; }
  }

  // ── Nom complet → prénom + nom ────────────────────────────────
  if (out.contact && !out.prenom) {
    const parts = out.contact.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Convention "NOM Prénom" (nom en majuscules) ?
      if (parts[0] === parts[0].toUpperCase() && parts[0].length > 1 && /[A-ZÀ-Ü]{2,}/.test(parts[0])) {
        out.prenom  = parts.slice(1).join(" ");
        out.contact = parts[0];
      } else {
        // Convention "Prénom NOM"
        out.prenom  = parts[0];
        out.contact = parts.slice(1).join(" ");
      }
      gained++;
    }
  }

  // ── Site web : si contient le domaine de l'email, garder le plus complet ─
  if (out.website && out.email) {
    const at = out.email.lastIndexOf("@");
    const domain = at !== -1 ? out.email.slice(at + 1).toLowerCase() : "";
    // Si le website est juste le domaine sans www, et que l'email le confirme, ok
    const cleanSite = out.website.replace(/^www\./i, "").toLowerCase().split("/")[0];
    if (domain && cleanSite !== domain && out.website.length < domain.length) {
      // Le domain d'email est plus précis
      if (!GENERIC_MAIL_DOMAINS.has(domain)) out.website = domain;
    }
  }

  return gained;
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
  // enrichDirectBtn est branché dynamiquement dans doEnrich()
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

// ── 3. Extraction, post-traitement et normalisation ──────────

function doExtract() {
  // Lit le mapping final depuis les selects
  for (const field of FIELDS) {
    const sel = document.getElementById(`map_${field.key}`);
    if (sel) columnMapping[field.key] = sel.value || null;
  }

  // ── Passe 1 : extraction depuis les colonnes mappées ─────────
  extractedRows = rawRows.map((raw, idx) => {
    const out = { _row: idx + 2 };

    for (const field of FIELDS) {
      const col = columnMapping[field.key];
      out[field.key] = (col && raw[col] !== undefined)
        ? normalizeValue(raw[col], field.type)
        : "";
    }

    // Conserve les colonnes non mappées sous préfixe _orig
    for (const h of allHeaders) {
      if (!Object.values(columnMapping).includes(h)) {
        out[`_orig_${h}`] = normalizeText(raw[h]);
      }
    }

    return out;
  });

  // Compte des cellules remplies après passe 1
  const baseFilled = countFilled(extractedRows);

  // ── Passe 2 : scan universel de toutes les cellules ───────────
  let scanGain = 0;
  extractedRows.forEach((out, i) => {
    scanGain += universalScan(rawRows[i], out, allHeaders);
  });

  // ── Passe 3 : déductions inter-champs ─────────────────────────
  let inferGain = 0;
  extractedRows.forEach(out => {
    inferGain += inferFromExisting(out);
  });

  const totalGain = scanGain + inferGain;
  const afterFilled = countFilled(extractedRows);

  showResults({ baseFilled, afterFilled, scanGain, inferGain });
}

function countFilled(rows) {
  return SUMMARY_FIELDS.reduce(
    (acc, key) => acc + rows.filter(r => r[key] && r[key] !== "").length, 0
  );
}

// ── 4. Affichage des résultats ────────────────────────────────

function showResults({ baseFilled = null, afterFilled = null, scanGain = 0, inferGain = 0 } = {}) {
  const total = extractedRows.length;
  const totalCells = SUMMARY_FIELDS.length * total;

  const filledCells = countFilled(extractedRows);
  const globalPct   = total > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const filledFields = SUMMARY_FIELDS.filter(key =>
    extractedRows.some(r => r[key] && r[key] !== "")
  ).length;

  // Statistiques globales
  const statsEl = document.getElementById("stats");
  let enhanceBadge = "";
  if (baseFilled !== null && afterFilled !== null) {
    const gained = afterFilled - baseFilled;
    const basePct = total > 0 ? Math.round((baseFilled / totalCells) * 100) : 0;
    if (gained > 0) {
      enhanceBadge = `
        <span class="stat-item stat-gain">
          +${gained} cellules via analyse locale
          <span class="stat-sub">(scan:${scanGain} + déduction:${inferGain})</span>
        </span>`;
    }
  }

  statsEl.innerHTML = `
    <span class="stat-item"><strong>${total}</strong> enregistrements</span>
    <span class="stat-item"><strong>${filledFields}/${SUMMARY_FIELDS.length}</strong> champs couverts</span>
    <span class="stat-item stat-highlight"><strong>${globalPct}%</strong> de remplissage global</span>
    ${enhanceBadge}
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

// ── 6. Enrichissement IA direct (Claude + web_search) ────────

// État de la session d'enrichissement
let enrichPaused  = false;
let enrichStopped = false;

// Cache de session pour éviter les doubles appels
function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}
function cacheKey(row) {
  return [row.company, row.city, row.region].map(v => (v || "").toLowerCase().trim()).join("|");
}

// Ouvre l'étape enrichissement et branche les contrôles
function doEnrich() {
  if (!extractedRows.length) return;

  const section = document.getElementById("step-enrich");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });

  // Restaure la clé API sauvegardée
  const saved = localStorage.getItem(APIKEY_LS_KEY) || "";
  if (saved) document.getElementById("apiKeyInput").value = saved;

  // Bouton afficher/masquer la clé
  document.getElementById("toggleKeyBtn").onclick = () => {
    const inp = document.getElementById("apiKeyInput");
    const btn = document.getElementById("toggleKeyBtn");
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    btn.textContent = show ? "Masquer" : "Afficher";
  };

  document.getElementById("enrichDirectBtn").onclick = startDirectEnrich;
  document.getElementById("pauseBtn").onclick  = () => { enrichPaused  = true;  updateCtrlBtns("paused"); };
  document.getElementById("resumeBtn").onclick = () => { enrichPaused  = false; updateCtrlBtns("running"); resumeEnrich(); };
  document.getElementById("stopBtn").onclick   = () => { enrichStopped = true;  updateCtrlBtns("stopped"); };
}

function updateCtrlBtns(state) {
  const s = document.getElementById;
  document.getElementById("pauseBtn").style.display  = state === "running" ? "inline-block" : "none";
  document.getElementById("resumeBtn").style.display = state === "paused"  ? "inline-block" : "none";
  document.getElementById("stopBtn").style.display   = state !== "stopped" ? "inline-block" : "none";
}

// Résumé des champs manquants pour une ligne
function missingFields(row) {
  return SUMMARY_FIELDS.filter(k => !row[k] || row[k] === "");
}

// ── Prompt d'enrichissement ───────────────────────────────────
//
// Envoyé à Claude pour chaque batch de ENRICH_BATCH_SIZE entreprises.
// Focalise la recherche sur les sources suisses connues.

function buildPrompt(batch) {
  const items = batch.map((row, i) => {
    const known = SUMMARY_FIELDS
      .filter(k => row[k] && row[k] !== "")
      .map(k => `${k}: "${row[k]}"`)
      .join(", ");
    const needed = missingFields(row).join(", ");
    return `[${i}] société="${row.company || "?"}"${row.city ? ` ville="${row.city}"` : ""}${row.region ? ` région="${row.region}"` : ""}
    connu: ${known || "—"}
    à trouver: ${needed}`;
  }).join("\n\n");

  return `Tu es un chercheur de données B2B suisse professionnel.
Pour chaque entreprise ci-dessous, effectue des recherches web pour trouver les données manquantes.

STRATÉGIE DE RECHERCHE (dans l'ordre) :
1. Google : "[nom société] [ville] contact Switzerland"
2. zefix.ch / moneyhouse.ch → toujours l'adresse officielle + IDE des sociétés suisses
3. local.ch / search.ch → numéro de téléphone + adresse
4. Site web officiel → page /contact, /impressum ou /about-us pour email et téléphone
5. LinkedIn company page → lien vers site web

RÈGLES :
- website : domaine sans protocole (ex: acme.ch, pas https://www.acme.ch)
- phone : format international suisse +41 XX XXX XX XX ; français +33 X XX XX XX XX
- email : email professionnel réel (jamais info@example.com ou inventé)
- postal_code : NPA suisse 4 chiffres ou CP français 5 chiffres
- country : code ISO 2 lettres (CH, FR, DE, IT, BE…)
- Si données introuvables après recherche → null (ne jamais inventer)
- Effectue au moins 2-3 recherches web par entreprise avant de déclarer null

ENTREPRISES :
${items}

Réponds UNIQUEMENT avec un tableau JSON valide (sans texte avant ni après) :
[
  {"idx":0,"website":…,"email":…,"phone":…,"mobile":…,"address":…,"postal_code":…,"city":…,"country":…},
  …
]`;
}

// ── Appel Claude API ──────────────────────────────────────────

async function callClaudeAPI(apiKey, prompt) {
  const resp = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 15
      }],
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (resp.status === 429) {
    // Rate limit — attendre et réessayer
    const retry = parseInt(resp.headers.get("retry-after") || "30", 10);
    logEnrich(`⏳ Rate limit — reprise dans ${retry}s…`);
    await sleep(retry * 1000);
    return callClaudeAPI(apiKey, prompt);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body.slice(0, 300)}`);
  }

  return resp.json();
}

// ── Extraction du JSON dans la réponse Claude ─────────────────

function extractJSON(apiResponse) {
  // Cherche le dernier bloc de texte dans les content blocks
  const blocks = apiResponse.content || [];
  let text = "";
  for (const b of blocks) {
    if (b.type === "text") text = b.text; // prend le dernier
  }

  // Extrait le tableau JSON (peut être entouré de texte parasite)
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); }
  catch { return null; }
}

// ── Application des résultats sur extractedRows ───────────────

function applyResults(batch, results, cache) {
  let filled = 0;
  for (const item of results) {
    const row = batch[item.idx];
    if (!row) continue;

    const ENRICHABLE = ["website","email","email2","phone","mobile",
                        "address","postal_code","city","country","linkedin"];
    for (const key of ENRICHABLE) {
      const val = item[key];
      if (val && val !== "null" && String(val).trim() !== "" && !row[key]) {
        row[key] = normalizeValue(val, FIELDS.find(f => f.key === key)?.type || "text");
        filled++;
      }
    }

    // Re-run inferences now that more data is known
    inferFromExisting(row);
    cache[cacheKey(row)] = Object.fromEntries(
      ENRICHABLE.map(k => [k, row[k] || ""])
    );
  }
  return filled;
}

// ── Boucle principale d'enrichissement ───────────────────────

let resumeCallback = null;

async function startDirectEnrich() {
  const apiKey = document.getElementById("apiKeyInput").value.trim();
  if (!apiKey || !apiKey.startsWith("sk-ant")) {
    document.getElementById("enrichStatus").innerHTML =
      `<span class="err">Clé API invalide. Elle doit commencer par "sk-ant-…"</span>`;
    return;
  }
  localStorage.setItem(APIKEY_LS_KEY, apiKey);

  enrichPaused  = false;
  enrichStopped = false;

  document.getElementById("enrichDirectBtn").disabled = true;
  document.getElementById("enrichProgressBox").style.display = "block";
  document.getElementById("enrichStatus").innerHTML = "";
  updateCtrlBtns("running");

  const cache = loadCache();

  // Sélectionne uniquement les lignes avec des champs manquants
  const toProcess = extractedRows.filter(r => missingFields(r).length > 0);
  let done = 0;
  let totalFilled = 0;
  let skipped = 0;

  logEnrich(`🚀 ${toProcess.length} entreprises à enrichir (${extractedRows.length - toProcess.length} déjà complètes)`);

  for (let i = 0; i < toProcess.length; i += ENRICH_BATCH_SIZE) {
    if (enrichStopped) break;

    // Gestion de la pause
    while (enrichPaused) {
      await sleep(500);
      if (enrichStopped) break;
    }
    if (enrichStopped) break;

    const batch = toProcess.slice(i, i + ENRICH_BATCH_SIZE);

    // Vérifie le cache pour chaque ligne du batch
    const toFetch = [];
    for (const row of batch) {
      const ck = cacheKey(row);
      if (cache[ck]) {
        // Applique le cache directement
        const cached = cache[ck];
        for (const [k, v] of Object.entries(cached)) {
          if (v && !row[k]) { row[k] = v; totalFilled++; }
        }
        skipped++;
      } else {
        toFetch.push(row);
      }
    }

    if (toFetch.length > 0) {
      try {
        const names = toFetch.map(r => r.company || "?").join(", ");
        logEnrich(`🔍 [${i + 1}–${Math.min(i + ENRICH_BATCH_SIZE, toProcess.length)}/${toProcess.length}] ${names}`);

        const prompt   = buildPrompt(toFetch);
        const response = await callClaudeAPI(apiKey, prompt);
        const results  = extractJSON(response);

        if (results) {
          const gained = applyResults(toFetch, results, cache);
          totalFilled += gained;
          saveCache(cache);
          logEnrich(`  ✓ +${gained} cellules remplies`);
        } else {
          logEnrich(`  ⚠ Réponse non parsable — batch ignoré`);
        }
      } catch (err) {
        logEnrich(`  ✗ Erreur : ${err.message}`);
        console.error(err);
      }
    }

    done += batch.length;
    updateEnrichProgress(done, toProcess.length);

    // Délai entre batchs (sauf pour le dernier)
    if (i + ENRICH_BATCH_SIZE < toProcess.length && !enrichStopped) {
      await sleep(ENRICH_DELAY_MS);
    }
  }

  const finalMsg = enrichStopped
    ? `Arrêté. ${totalFilled} cellules enrichies (${skipped} depuis cache).`
    : `Terminé. ${totalFilled} cellules enrichies sur ${toProcess.length} entreprises.`;

  document.getElementById("enrichStatus").innerHTML =
    `<span class="ok">${escapeHtml(finalMsg)}</span>`;

  updateCtrlBtns("stopped");
  document.getElementById("enrichDirectBtn").disabled = false;
  showResults();
}

function updateEnrichProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById("enrichProgressLabel").textContent = `${done} / ${total} entreprises`;
  document.getElementById("enrichProgressPct").textContent   = `${pct}%`;
  document.getElementById("enrichBar").style.width           = `${pct}%`;
}

function logEnrich(msg) {
  const log = document.getElementById("enrichLog");
  const p = document.createElement("p");
  p.className = "log-line";
  p.textContent = msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
