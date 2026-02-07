// FILE: src/lib/search/marketTaxonomy.ts
export type MarketCategoryKey =
  | "fashion"
  | "phones"
  | "beauty"
  | "home"
  | "bags"
  | "services"
  | "other";

export const MARKET_CATEGORIES: { key: MarketCategoryKey; label: string; hint: string; synonyms: string[] }[] = [
  {
    key: "fashion",
    label: "Fashion",
    hint: "Clothes, shoes",
    synonyms: [
      "fashion","clothes","cloth","shirt","tshirt","top","gown","dress","skirt","trouser","trousers","pants","jeans","joggers",
      "shoe","shoes","slipper","slippers","slides","slide","sandal","sandals","heels","sneaker","sneakers",
      "cap","hat","jacket","hoodie","native","agbada","kaftan","wear",
      // Nigeria common terms
      "pam","pams",
    ],
  },
  {
    key: "phones",
    label: "Phones",
    hint: "Android, iPhone",
    synonyms: [
      "phone","phones","iphone","ipad","android","samsung","tecno","infinix","itel","redmi","xiaomi",
      "airpod","airpods","earpiece","earpieces","earphone","earphones","charger","charging","powerbank","power",
      "screen","case","casing",
    ],
  },
  {
    key: "beauty",
    label: "Beauty",
    hint: "Hair, makeup",
    synonyms: [
      "beauty","hair","wig","wigs","attachment","braids","braid","weavon","weave","shampoo","conditioner",
      "makeup","lipstick","powder","foundation","lash","lashes","nails","nail","pedicure","manicure","skincare","cream","oil","perfume",
    ],
  },
  {
    key: "home",
    label: "Home",
    hint: "Kitchen, decor",
    synonyms: [
      "home","kitchen","decor","decoration","plate","plates","pot","pots","pan","pans","spoon","cup","mug","bowl",
      "bed","bedsheet","curtain","lamp","chair","table","furniture",
    ],
  },
  {
    key: "bags",
    label: "Bags",
    hint: "Handbags",
    synonyms: ["bag","bags","handbag","handbags","purse","purses","backpack","wallet","luggage","travelbag"],
  },
  {
    key: "services",
    label: "Services",
    hint: "Lash, nails",
    synonyms: ["service","services","repair","repairs","installation","install","barbing","barber","hairdresser","makeupartist","massage","cleaning"],
  },
  { key: "other", label: "Other", hint: "Everything else", synonyms: ["other"] },
];

function norm(s: string) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function suggestCategoriesFromText(text: string, max = 3): MarketCategoryKey[] {
  const t = norm(text);
  if (!t) return ["other"];

  const words = new Set(t.split(" ").filter(Boolean));

  const scored = MARKET_CATEGORIES.map((c) => {
    let score = 0;

    for (const syn of c.synonyms) {
      if (words.has(syn)) score += 3;
      for (const w of words) {
        if (w.length >= 4 && syn.length >= 4 && (w.includes(syn) || syn.includes(w))) score += 1;
      }
    }

    return { key: c.key, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return ["other"];

  const out: MarketCategoryKey[] = [];
  for (const x of scored) {
    if (out.includes(x.key)) continue;
    out.push(x.key);
    if (out.length >= Math.max(1, Math.min(3, Number(max || 3)))) break;
  }

  return out.length ? out : ["other"];
}