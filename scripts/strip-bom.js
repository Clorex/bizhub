const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/strip-bom.js <path>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  fs.writeFileSync(file, buf.slice(3));
  console.log(`[strip-bom] Removed UTF-8 BOM: ${file}`);
} else {
  console.log(`[strip-bom] No BOM found: ${file}`);
}
