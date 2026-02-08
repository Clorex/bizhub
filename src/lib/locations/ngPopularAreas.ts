// FILE: src/lib/locations/ngPopularAreas.ts
export const NG_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NgState = (typeof NG_STATES)[number];

export const NG_AREAS_BY_STATE: Record<NgState, string[]> = {
  Abia: ["Aba", "Umuahia", "Osisioma", "Ohafia", "Arochukwu", "Bende", "Isiala Ngwa", "Ukwa", "Ugwunagbo"],
  Adamawa: ["Yola", "Jimeta", "Mubi", "Numan", "Ganye", "Hong", "Gombi", "Song", "Michika"],
  "Akwa Ibom": ["Uyo", "Eket", "Ikot Ekpene", "Oron", "Abak", "Etinan", "Itu", "Mkpat Enin", "Ibeno"],
  Anambra: ["Awka", "Onitsha", "Nnewi", "Ekwulobia", "Nkpor", "Ogidi", "Ihiala", "Agulu", "Otuocha"],
  Bauchi: ["Bauchi", "Azare", "Misau", "Jama’are", "Katagum", "Tafawa Balewa", "Darazo", "Ningi"],
  Bayelsa: ["Yenagoa", "Ogbia", "Sagbama", "Nembe", "Brass", "Ekeremor"],
  Benue: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala", "Vandeikya", "Ushongo", "Adikpo"],
  Borno: ["Maiduguri", "Jere", "Biu", "Bama", "Konduga", "Monguno", "Gwoza", "Dikwa"],
  "Cross River": ["Calabar", "Ikom", "Ogoja", "Ugep", "Obudu", "Akamkpa", "Bekwarra"],
  Delta: ["Asaba", "Warri", "Sapele", "Ughelli", "Agbor", "Oleh", "Ogwashi-Uku", "Burutu", "Ozoro"],
  Ebonyi: ["Abakaliki", "Afikpo", "Onueke", "Ishielu", "Ezza", "Ikwo"],
  Edo: ["Benin City", "Auchi", "Ekpoma", "Uromi", "Igueben", "Irrua"],
  Ekiti: ["Ado-Ekiti", "Ikere", "Ilawe", "Ise", "Emure", "Omuo"],
  Enugu: ["Enugu", "Nsukka", "Agbani", "Awgu", "Udi", "Oji River"],
  FCT: ["Abuja", "Garki", "Wuse", "Maitama", "Asokoro", "Gwarinpa", "Jabi", "Kubwa", "Karu", "Lugbe", "Kuje", "Bwari"],
  Gombe: ["Gombe", "Kumo", "Billiri", "Bajoga", "Dukku"],
  Imo: ["Owerri", "Orlu", "Okigwe", "Mbaise", "Oguta", "Nkwerre"],
  Jigawa: ["Dutse", "Hadejia", "Gumel", "Ringim", "Kazaure", "Birnin Kudu"],
  Kaduna: ["Kaduna", "Zaria", "Kafanchan", "Sabon Tasha", "Saminaka", "Birnin Gwari", "Makarfi"],
  Kano: ["Kano", "Wudil", "Bichi", "Gaya", "Rano", "Dawakin Tofa", "Kura"],
  Katsina: ["Katsina", "Daura", "Funtua", "Malumfashi", "Dutsin-Ma", "Kankia"],
  Kebbi: ["Birnin Kebbi", "Argungu", "Yauri", "Zuru", "Jega"],
  Kogi: ["Lokoja", "Okene", "Anyigba", "Idah", "Kabba", "Ajaokuta"],
  Kwara: ["Ilorin", "Offa", "Omu-Aran", "Jebba", "Lafiagi", "Patigi"],
  Lagos: [
    "Ikeja",
    "Lekki",
    "Ajah",
    "VI",
    "VGC",
    "Ikoyi",
    "Yaba",
    "Surulere",
    "Maryland",
    "Gbagada",
    "Magodo",
    "Ogba",
    "Egbeda",
    "Ikorodu",
    "Epe",
    "Badagry",
    "Festac",
    "Amuwo Odofin",
    "Oshodi",
    "Ketu",
    "Mile 2",
    "Apapa",
    "Alimosho",
    "Agege",
  ],
  Nasarawa: ["Lafia", "Keffi", "Akwanga", "Karu", "Nasarawa", "Wamba"],
  Niger: ["Minna", "Bida", "Suleja", "Kontagora", "New Bussa", "Lapai"],
  Ogun: ["Abeokuta", "Ijebu Ode", "Sagamu", "Ota", "Ilaro", "Mowe", "Ibafo", "Sango Ota"],
  Ondo: ["Akure", "Ondo", "Owo", "Ikare", "Okitipupa", "Igbokoda"],
  Osun: ["Osogbo", "Ile-Ife", "Ilesa", "Ede", "Ikirun", "Iwo"],
  Oyo: ["Ibadan", "Ogbomoso", "Oyo", "Iseyin", "Saki", "Igboho"],
  Plateau: ["Jos", "Bukuru", "Pankshin", "Shendam", "Langtang", "Mangu"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Bonny", "Eleme", "Ikwerre", "Okrika", "Ahoada", "Degema"],
  Sokoto: ["Sokoto", "Wamako", "Tambuwal", "Gwadabawa", "Illela"],
  Taraba: ["Jalingo", "Wukari", "Takum", "Bali", "Serti", "Gembu"],
  Yobe: ["Damaturu", "Potiskum", "Gashua", "Nguru", "Geidam"],
  Zamfara: ["Gusau", "Kaura Namoda", "Talata Mafara", "Anka", "Bungudu"],
};

function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isKnownNgState(v: any): v is NgState {
  const n = norm(v);
  return NG_STATES.some((x) => norm(x) === n);
}

export function canonicalNgState(v: any): NgState | null {
  const n = norm(v);
  const found = NG_STATES.find((x) => norm(x) === n) || null;
  return found;
}

export function areasForState(state: NgState | string | null | undefined): string[] {
  const s = canonicalNgState(state);
  if (!s) return [];
  return NG_AREAS_BY_STATE[s] || [];
}