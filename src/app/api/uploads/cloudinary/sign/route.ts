import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireMe } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanFolderPart(s: string) {
  return String(s || "")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function cloudinarySign(params: Record<string, string | number>, apiSecret: string) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));

  const base = entries.map(([k, v]) => `${k}=${v}`).join("&");
  return crypto.createHash("sha1").update(base + apiSecret).digest("hex");
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const folderBase = cleanFolderPart(body.folderBase || "bizhub");

    // Tie uploads to user UID to prevent abuse
    const folder = `${folderBase}/${me.uid}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = { folder, timestamp };
    const signature = cloudinarySign(paramsToSign, apiSecret);

    return NextResponse.json({
      ok: true,
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}