// FILE: src/components/vendor/ImageUploader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";
import type { CoverAspectKey } from "@/lib/products/coverAspect";

type SignedPayload = {
  ok: boolean;
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  error?: string;
};

type DraftItem = {
  id: string;
  file: File;
  previewUrl: string;

  status: "ready" | "uploading" | "uploaded" | "error";
  progress: number; // internal only (UI uses minimal spinner)
  error?: string;

  uploadedUrl?: string;
};

function uid() {
  try {
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}
  return `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isImageFile(f: File) {
  return !!f?.type?.startsWith("image/");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create image blob"))), type, quality);
  });
}

function downscaleCanvas(src: HTMLCanvasElement, maxDim = 1600) {
  const w = src.width;
  const h = src.height;
  const max = Math.max(w, h);
  if (max <= maxDim) return src;

  const scale = maxDim / max;
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;

  const ctx = out.getContext("2d");
  if (!ctx) return src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, tw, th);
  return out;
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    if ("createImageBitmap" in window) {
      // @ts-ignore
      return await createImageBitmap(file);
    }
  } catch {}
  return null;
}

async function fileToHtmlImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    return img;
  } finally {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

async function compressIfLarge(file: File): Promise<File> {
  if (!isImageFile(file)) return file;
  if (file.size < 1_000_000) return file;

  const bmp = await fileToImageBitmap(file);
  if (bmp) {
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;

    const ctx = c.getContext("2d");
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0);

    const scaled = downscaleCanvas(c, 1600);
    const blob = await canvasToBlob(scaled, "image/jpeg", 0.86);

    const base = (file.name || "image").replace(/\.[a-z0-9]+$/i, "");
    return new File([blob], `${base}-optimized.jpg`, { type: "image/jpeg" });
  }

  return file;
}

async function cropFileToCenteredSquare(file: File) {
  const bmp = await fileToImageBitmap(file);

  let iw = 0;
  let ih = 0;

  if (bmp) {
    iw = bmp.width;
    ih = bmp.height;
  } else {
    const img = await fileToHtmlImage(file);
    iw = img.naturalWidth;
    ih = img.naturalHeight;
  }

  if (!iw || !ih) throw new Error("Invalid image dimensions");

  const side = Math.max(1, Math.min(iw, ih));
  const sx = Math.round((iw - side) / 2);
  const sy = Math.round((ih - side) / 2);

  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;

  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (bmp) {
    ctx.drawImage(bmp, sx, sy, side, side, 0, 0, side, side);
  } else {
    const img = await fileToHtmlImage(file);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);
  }

  const scaled = downscaleCanvas(c, 1600);
  const blob = await canvasToBlob(scaled, "image/jpeg", 0.86);

  const baseName = (file.name || "image").replace(/\.[a-z0-9]+$/i, "");
  return new File([blob], `${baseName}-square.jpg`, { type: "image/jpeg" });
}

async function getSigned(folderBase: string): Promise<SignedPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not logged in");

  const r = await fetch("/api/uploads/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folderBase }),
  });

  const data = (await r.json().catch(() => ({}))) as SignedPayload;
  if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to sign upload");
  return data;
}

function uploadOneToCloudinary(params: {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  file: File;
  onProgress: (pct: number) => void;
}) {
  const url = `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();

    form.append("file", params.file);
    form.append("api_key", params.apiKey);
    form.append("timestamp", String(params.timestamp));
    form.append("signature", params.signature);
    form.append("folder", params.folder);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      params.onProgress(Math.max(0, Math.min(100, pct)));
    };

    xhr.onerror = () => reject(new Error("Network error uploading to Cloudinary"));
    xhr.onabort = () => reject(new Error("Upload aborted"));

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          const secureUrl = String(json.secure_url || "");
          if (!secureUrl) return reject(new Error("Upload succeeded but no secure_url returned"));
          return resolve(secureUrl);
        }
        reject(new Error(String(json?.error?.message || "Cloudinary upload failed")));
      } catch (e: any) {
        reject(new Error(e?.message || "Failed to parse Cloudinary response"));
      }
    };

    xhr.open("POST", url);
    xhr.send(form);
  });
}

// Cache signed payload briefly
const SIGN_TTL_MS = 2 * 60 * 1000;

export function ImageUploader(props: {
  label?: string;
  value?: string[];
  onChange?: (urls: string[]) => void;
  onUploaded?: (urls: string[]) => void;
  multiple?: boolean;
  max?: number;
  folderBase?: string;
  disabled?: boolean;

  // Back-compat (ignored). Kept so existing pages passing these props do not break.
  aspectKey?: CoverAspectKey;
  onAspectKeyChange?: (k: CoverAspectKey) => void;
  allowFreeAspect?: boolean;
  autoOpenCrop?: boolean;
}) {
  const {
    label = "Product images",
    value,
    onChange,
    onUploaded,
    multiple = true,
    max = 10,
    folderBase = "bizhub/uploads",
    disabled = false,
  } = props;

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const draftsRef = useRef<DraftItem[]>([]);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const [err, setErr] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadedUrls: string[] = Array.isArray(value) ? value : [];
  const uploadedRef = useRef<string[]>(uploadedUrls);
  useEffect(() => {
    uploadedRef.current = uploadedUrls;
  }, [uploadedUrls]);

  const totalCount = uploadedUrls.length + drafts.length;
  const remainingSlots = Math.max(0, max - totalCount);

  const uploadingAny = useMemo(() => drafts.some((d) => d.status === "uploading"), [drafts]);

  const readyCount = useMemo(
    () => drafts.filter((d) => d.status === "ready" || d.status === "error").length,
    [drafts]
  );

  const signedCacheRef = useRef<{ at: number; payload: SignedPayload } | null>(null);

  // cleanup object URLs
  useEffect(() => {
    return () => {
      for (const d of draftsRef.current) {
        try {
          URL.revokeObjectURL(d.previewUrl);
        } catch {}
      }
    };
  }, []);

  function setUploaded(next: string[]) {
    uploadedRef.current = next;
    onChange?.(next);
  }

  async function getSignedCached() {
    const cached = signedCacheRef.current;
    const now = Date.now();
    if (cached && now - cached.at < SIGN_TTL_MS) return cached.payload;

    const payload = await getSigned(folderBase);
    signedCacheRef.current = { at: now, payload };
    return payload;
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);

    const picked = Array.from(files);

    for (const f of picked) {
      if (!isImageFile(f)) {
        setErr("Only image files are allowed.");
        return;
      }
    }

    if (remainingSlots <= 0) {
      setErr(`You can only upload up to ${max} images.`);
      return;
    }

    const slice = picked.slice(0, remainingSlots);

    const newDrafts: DraftItem[] = slice.map((file) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "ready",
      progress: 0,
    }));

    setDrafts((prev) => [...prev, ...newDrafts]);

    if (inputRef.current) inputRef.current.value = "";

    if (picked.length > slice.length) {
      setErr(`Only ${remainingSlots} slot(s) left. Extra images were ignored.`);
    }
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d) {
        try {
          URL.revokeObjectURL(d.previewUrl);
        } catch {}
      }
      return prev.filter((x) => x.id !== id);
    });
  }

  function removeUploaded(url: string) {
    setUploaded(uploadedRef.current.filter((u) => u !== url));
  }

  function makeCover(url: string) {
    const cur = uploadedRef.current;
    setUploaded([url, ...cur.filter((u) => u !== url)]);
  }

  async function uploadDraft(id: string) {
    const d0 = draftsRef.current.find((d) => d.id === id);
    if (!d0) return;
    if (d0.status === "uploading") return;

    if (uploadedRef.current.length >= max) {
      setErr(`You can only upload up to ${max} images.`);
      return;
    }

    setErr(null);
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: "uploading", progress: 0 } : d)));

    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const signed = await getSignedCached();

        // Enforce square output (no cropper UI)
        const squared = await cropFileToCenteredSquare(d0.file);
        const fileToSend = await compressIfLarge(squared);

        const url = await uploadOneToCloudinary({
          cloudName: signed.cloudName,
          apiKey: signed.apiKey,
          folder: signed.folder,
          timestamp: signed.timestamp,
          signature: signed.signature,
          file: fileToSend,
          onProgress: (pct) => {
            setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, progress: pct } : d)));
          },
        });

        // Add to uploaded list (final UI)
        const next = [...uploadedRef.current, url].slice(0, max);
        setUploaded(next);
        onUploaded?.([url]);

        // B9-1: remove success status indicator entirely by removing the draft item
        setDrafts((prev) => {
          const d = prev.find((x) => x.id === id);
          if (d) {
            try {
              URL.revokeObjectURL(d.previewUrl);
            } catch {}
          }
          return prev.filter((x) => x.id !== id);
        });

        return;
      } catch (e: any) {
        lastErr = e;
        if (attempt < 3) {
          await sleep(400 * attempt);
          continue;
        }
      }
    }

    setDrafts((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "error", progress: 0, error: lastErr?.message || "Upload failed" } : d
      )
    );
  }

  async function runPool(ids: string[], concurrency: number) {
    const q = [...ids];
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (q.length) {
        if (uploadedRef.current.length >= max) return;
        const id = q.shift();
        if (!id) return;
        // eslint-disable-next-line no-await-in-loop
        await uploadDraft(id);
      }
    });
    await Promise.all(workers);
  }

  async function uploadAll() {
    const queue = draftsRef.current
      .filter((d) => d.status === "ready" || d.status === "error")
      .map((d) => d.id);
    await runPool(queue, 2);
  }

  return (
    <div className="pb-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block text-sm font-bold text-biz-ink">{label}</label>
          <p className="mt-1 text-[11px] text-biz-muted">Images are automatically center-cropped to square (1:1).</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-biz-muted">
            {uploadedUrls.length}/{max}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => addFiles(e.target.files)}
          disabled={disabled || remainingSlots <= 0}
        />

        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remainingSlots <= 0 || uploadingAny}
        >
          Add photo
        </Button>

        <Button onClick={uploadAll} disabled={disabled || uploadingAny || readyCount === 0}>
          Upload all
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        {remainingSlots <= 0 ? (
          <span className="text-[11px] font-bold text-orange-700">Max reached</span>
        ) : (
          <span className="text-[11px] text-biz-muted">{remainingSlots} slot(s) left</span>
        )}
      </div>

      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}

      {/* Final thumbnails (no status badges) */}
      {uploadedUrls.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-biz-ink">Photos</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {uploadedUrls.map((u, idx) => {
              const thumb = cloudinaryOptimizedUrl(u, { w: 320, h: 320 });
              return (
                <div
                  key={u}
                  className={
                    idx === 0
                      ? "rounded-2xl border border-biz-accent/40 overflow-hidden bg-white shadow-soft"
                      : "rounded-2xl border border-biz-line overflow-hidden bg-white"
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="Photo" className="aspect-square w-full object-cover" loading="lazy" decoding="async" />

                  <div className="p-2 space-y-2">
                    {idx === 0 ? null : (
                      <button className="text-[11px] font-bold text-biz-accent" onClick={() => makeCover(u)}>
                        Make cover
                      </button>
                    )}

                    <button className="text-[11px] font-bold text-red-600" onClick={() => removeUploaded(u)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Drafts (no "uploaded" success state; success drafts are removed) */}
      {drafts.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-biz-ink">Selected</p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.previewUrl} alt="Selected" className="aspect-square w-full object-cover" />

                <div className="p-2 space-y-2">
                  <button
                    className="text-[11px] font-bold text-gray-700 disabled:opacity-50"
                    onClick={() => removeDraft(d.id)}
                    disabled={disabled || d.status === "uploading"}
                  >
                    Remove
                  </button>

                  {d.status === "ready" ? (
                    <button
                      className="w-full py-2 rounded-xl text-[11px] font-extrabold bg-biz-cream text-biz-ink disabled:opacity-50"
                      onClick={() => uploadDraft(d.id)}
                      disabled={disabled || uploadingAny || uploadedUrls.length >= max}
                    >
                      Upload
                    </button>
                  ) : null}

                  {d.status === "uploading" ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full border-2 border-biz-line border-t-biz-accent animate-spin"
                        aria-label="Uploading"
                      />
                      <p className="text-[11px] text-biz-muted">Uploading…</p>
                    </div>
                  ) : null}

                  {d.status === "error" ? (
                    <div>
                      <p className="text-[11px] font-bold text-red-700">{d.error || "Upload failed"}</p>
                      <button
                        className="mt-1 w-full py-2 rounded-xl text-[11px] font-extrabold bg-white border border-biz-line"
                        onClick={() => uploadDraft(d.id)}
                        disabled={disabled || uploadingAny}
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}