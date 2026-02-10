// fix-nextrequest.mjs
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

for (const filePath of files) {
  let content = fs.readFileSync(filePath, "utf8");
  const rel = filePath.replace(/\\/g, "/");

  if (!content.includes("NextRequest") && !content.includes("NextResponse")) continue;

  // Skip middleware
  if (rel.includes("middleware")) {
    console.log(`⏭️  SKIP (middleware): ${rel}`);
    continue;
  }

  const original = content;

  // --- Fix NextResponse ---
  content = content.replace(/NextResponse\.json\(/g, "Response.json(");
  content = content.replace(/NextResponse\.redirect\(/g, "Response.redirect(");
  content = content.replace(/new NextResponse\(/g, "new Response(");

  // --- Fix NextRequest → Request ---
  // In function params: (req: NextRequest) → (req: Request)
  content = content.replace(/:\s*NextRequest/g, ": Request");

  // --- Remove all import lines from "next/server" ---
  // Remove: import { NextRequest } from "next/server";
  // Remove: import { NextResponse } from "next/server";
  // Remove: import { NextRequest, NextResponse } from "next/server";
  // Remove: import type { NextRequest } from "next/server";
  content = content.replace(
    /import\s+(type\s+)?\{[^}]*(NextRequest|NextResponse)[^}]*\}\s*from\s*["']next\/server["']\s*;?\n?/g,
    ""
  );

  // Clean up multiple blank lines
  content = content.replace(/\n{3,}/g, "\n\n");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    fixedCount++;
    console.log(`✅ Fixed: ${rel}`);
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`✅ Fixed: ${fixedCount} files`);
console.log(`${"=".repeat(50)}`);