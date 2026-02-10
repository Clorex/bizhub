// fix-nextresponse.mjs
import fs from "fs";
import path from "path";

function getAllFiles(dir, ext = [".ts", ".tsx"]) {
  let results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !["node_modules", ".next", ".git"].includes(entry.name)) {
        results = results.concat(getAllFiles(full, ext));
      } else if (ext.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = getAllFiles("src");
let fixedCount = 0;
let skippedMiddleware = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, "utf8");
  const rel = filePath.replace(/\\/g, "/");

  // Skip if no NextResponse usage
  if (!content.includes("NextResponse")) continue;

  // SKIP middleware — it still uses NextResponse.next() in Next.js 16
  if (rel.includes("middleware.ts") || rel.includes("middleware.js")) {
    skippedMiddleware++;
    console.log(`⏭️  SKIP (middleware): ${rel}`);
    continue;
  }

  const original = content;

  // 1. Replace NextResponse.json( → Response.json(
  content = content.replace(/NextResponse\.json\(/g, "Response.json(");

  // 2. Replace NextResponse.redirect( → Response.redirect(
  content = content.replace(/NextResponse\.redirect\(/g, "Response.redirect(");

  // 3. Replace new NextResponse( → new Response(
  content = content.replace(/new NextResponse\(/g, "new Response(");

  // 4. Replace NextResponse.next( → Response (only if somehow used outside middleware)
  // content = content.replace(/NextResponse\.next\(/g, "Response.next(");

  // 5. Remove the import line for NextResponse
  // Handle various import patterns:

  // Pattern: import { NextResponse } from "next/server";
  content = content.replace(
    /import\s*\{\s*NextResponse\s*\}\s*from\s*["']next\/server["']\s*;?\n?/g,
    ""
  );

  // Pattern: import { NextRequest, NextResponse } from "next/server";
  // → import { NextRequest } from "next/server";
  content = content.replace(
    /import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*["']next\/server["']/g,
    'import { NextRequest } from "next/server"'
  );

  // Pattern: import { NextResponse, NextRequest } from "next/server";
  // → import { NextRequest } from "next/server";
  content = content.replace(
    /import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*["']next\/server["']/g,
    'import { NextRequest } from "next/server"'
  );

  // Pattern: import type { NextRequest } + import { NextResponse } separate
  // Already handled above

  // Clean up any leftover empty lines from removed imports (max 2 blank lines → 1)
  content = content.replace(/\n{3,}/g, "\n\n");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    fixedCount++;
    console.log(`✅ Fixed: ${rel}`);
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`✅ Fixed: ${fixedCount} files`);
console.log(`⏭️  Skipped middleware: ${skippedMiddleware}`);
console.log(`📁 Total scanned: ${files.length}`);
console.log(`${"=".repeat(50)}`);