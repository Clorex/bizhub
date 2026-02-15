/**
 * Fail build if broken Naira symbol "\u00E2\u201A\u00A6" appears in source.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const BAD = "\u00E2\u201A\u00A6";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "dist" || name === "out") continue;
      walk(p, out);
    } else {
      if (!/\.(ts|tsx|js|jsx|json|md)$/.test(name)) continue;
      out.push(p);
    }
  }
  return out;
}

const files = fs.existsSync(ROOT) ? walk(ROOT) : [];
const hits = [];

for (const f of files) {
  const txt = fs.readFileSync(f, "utf8");
  if (txt.includes(BAD)) hits.push(f);
}

if (hits.length) {
  console.error(`Found broken Naira symbol "${BAD}" in:`);
  for (const f of hits) console.error(" - " + path.relative(process.cwd(), f));
  process.exit(1);
} else {
  console.log("OK: no broken Naira symbol found.");
}

