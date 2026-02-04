"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";
import "cropperjs/dist/cropper.css";

// Lazy-load Cropper to keep initial pages lighter/smoother
// ✅ FIX: type dynamic component as any so TS allows Cropper props like `src`, `aspectRatio`, etc.
const Cropper = dynamic<any>(() => import("react-cropper").then((m: any) => m.default), { ssr: false });

type SignedPayload = {
  ok: boolean;
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  error?: string;
};

type AspectChoice = "free" | "1:1" | "4:5" | "16:9";

type DraftItem = {
  id: string;
  file: File;
  previewUrl: string;

  status: "ready" | "uploading" | "uploaded" | "error";
  progress: number; // 0..100
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
      return await createImageBitmap(file);
    }
  } catch {}
  return null;
}

async function compressIfLarge(file: File): Promise<File> {
  // Only compress big files (helps speed & data use)
  if (!isImageFile(file)) return file;
  if (file.size < 1_000_000) return file; // < 1MB keep as-is

  // Try ImageBitmap path first (fast)
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

  // Fallback: <img> decode
  return file;
}

async function getSigned(folderBase: string): Promise<SignedPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not logged in");

  const r = await fetch("/api/uploads/cloudinary/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

// Cache signed payload briefly (reduces extra requests while uploading many images)
const SIGN_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function ImageUploader(props: {
  label?: string;
  value?: string[];
  onChange?: (urls: string[]) => void;
  onUploaded?: (urls: string[]) => void;
  multiple?: boolean;
  max?: number;
  folderBase?: string;
  disabled?: boolean;
}) {
  const {
    label = "Product images",
    value,
    onChange,
    onUploaded,
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

  // Crop modal state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);
  const [aspect, setAspect] = useState<AspectChoice>("free");
  const cropperRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadedUrls: string[] = Array.isArray(value) ? value : [];
  const uploadedRef = useRef<string[]>(uploadedUrls);
  useEffect(() => {
    uploadedRef.current = uploadedUrls;
  }, [uploadedUrls]);

  const totalCount = uploadedUrls.length + drafts.length;
  const remainingSlots = Math.max(0, max - totalCount);

  const uploadingAny = useMemo(() => drafts.some((d) => d.status === "uploading"), [drafts]);

  // signed cache
  const signedCacheRef = useRef<{ at: number; payload: SignedPayload } | null>(null);

  useEffect(() => {
    // cleanup object URLs
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

  function openCrop(id: string) {
    setCropId(id);
    setAspect("free");
    setCropOpen(true);
  }

  function aspectToRatio(a: AspectChoice) {
    if (a === "free") return NaN;
    if (a === "1:1") return 1;
    if (a === "4:5") return 4 / 5;
    return 16 / 9;
  }

  async function applyCrop() {
    if (!cropId) return;

    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const draft = draftsRef.current.find((d) => d.id === cropId);
    if (!draft) return;

    try {
      const rawCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      const canvas = downscaleCanvas(rawCanvas, 1600);
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);

      const baseName = (draft.file.name || "image").replace(/\.[a-z0-9]+$/i, "");
      const nextFile = new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
      const nextPreview = URL.createObjectURL(nextFile);

      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id !== cropId) return d;
          try {
            URL.revokeObjectURL(d.previewUrl);
          } catch {}
          return { ...d, file: nextFile, previewUrl: nextPreview, status: "ready", progress: 0, error: undefined };
        })
      );

      setCropOpen(false);
      setCropId(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to crop image");
    }
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

        // compress big files for faster upload + less data
        const fileToSend = await compressIfLarge(d0.file);

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

        setDrafts((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "uploaded", progress: 100, uploadedUrl: url } : d))
        );

        const next = [...uploadedRef.current, url].slice(0, max);
        setUploaded(next);
        onUploaded?.([url]);

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
      prev.map((d) => (d.id === id ? { ...d, status: "error", progress: 0, error: lastErr?.message || "Upload failed" } : d))
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

    // Parallel upload (2 at a time) = faster but still stable on mobile networks
    await runPool(queue, 2);
  }

  const cropDraft = cropId ? drafts.find((d) => d.id === cropId) : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block text-sm font-bold text-biz-ink">{label}</label>
          <p className="mt-1 text-[11px] text-biz-muted">
            Up to <b className="text-biz-ink">{max}</b> images. Crop if you want, then upload.
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-biz-muted">
            {uploadedUrls.length}/{max} uploaded
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          disabled={disabled || remainingSlots <= 0}
        />

        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled || remainingSlots <= 0 || uploadingAny}>
          Choose photos
        </Button>

        <Button onClick={uploadAll} disabled={disabled || uploadingAny || drafts.every((d) => d.status === "uploaded")}>
          Upload all
        </Button>

        {remainingSlots <= 0 ? (
          <span className="text-[11px] font-bold text-orange-700">Max reached</span>
        ) : (
          <span className="text-[11px] text-biz-muted">{remainingSlots} slot(s) left</span>
        )}
      </div>

      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}

      {/* Uploaded URLs */}
      {uploadedUrls.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-biz-ink">Uploaded</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {uploadedUrls.map((u, idx) => {
              const thumb = cloudinaryOptimizedUrl(u, { w: 320, h: 240 });
              return (
                <div key={u} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="Uploaded" className="h-24 w-full object-cover" loading="lazy" decoding="async" />

                  <div className="p-2 space-y-2">
                    {idx === 0 ? (
                      <p className="text-[11px] font-extrabold text-emerald-700">Cover</p>
                    ) : (
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

      {/* Drafts */}
      {drafts.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-biz-ink">Selected (not uploaded yet)</p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.previewUrl} alt="Selected" className="h-24 w-full object-cover" />

                <div className="p-2 space-y-2">
                  <div className="flex flex-col gap-1">
                    <button
                      className="text-[11px] font-bold text-biz-accent disabled:opacity-50"
                      onClick={() => openCrop(d.id)}
                      disabled={disabled || d.status === "uploading" || d.status === "uploaded"}
                    >
                      Crop
                    </button>

                    {d.status !== "uploaded" ? (
                      <button
                        className="text-[11px] font-bold text-gray-700 disabled:opacity-50"
                        onClick={() => removeDraft(d.id)}
                        disabled={disabled || d.status === "uploading"}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

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
                    <div>
                      <p className="text-[11px] text-biz-muted">Uploading… {d.progress}%</p>
                      <div className="mt-1 h-2 w-full rounded-full bg-biz-cream overflow-hidden">
                        <div className="h-full bg-biz-accent" style={{ width: `${d.progress}%` }} />
                      </div>
                    </div>
                  ) : null}

                  {d.status === "uploaded" ? <p className="text-[11px] font-bold text-emerald-700">Uploaded</p> : null}

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

      {/* Crop Modal */}
      {cropOpen && cropDraft ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-[430px] px-4 safe-pb pb-4">
            <div className="rounded-3xl bg-white border border-biz-line overflow-hidden">
              <div className="p-4 border-b border-biz-line">
                <p className="text-sm font-extrabold text-biz-ink">Crop image</p>
                <p className="text-[11px] text-biz-muted mt-1">Choose an aspect ratio or use Free crop.</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(["free", "1:1", "4:5", "16:9"] as AspectChoice[]).map((a) => {
                    const active = aspect === a;
                    return (
                      <button
                        key={a}
                        className={
                          active
                            ? "px-3 py-2 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                            : "px-3 py-2 rounded-2xl text-xs font-extrabold border border-biz-line bg-white"
                        }
                        onClick={() => setAspect(a)}
                      >
                        {a === "free" ? "Free" : a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4">
                <div className="rounded-2xl overflow-hidden border border-biz-line bg-black">
                  <Cropper
                    src={cropDraft.previewUrl}
                    style={{ height: 360, width: "100%" }}
                    // @ts-ignore
                    ref={cropperRef}
                    viewMode={1}
                    guides
                    background={false}
                    autoCropArea={0.9}
                    responsive
                    checkOrientation={false}
                    aspectRatio={aspectToRatio(aspect)}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setCropOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={applyCrop}>Apply crop</Button>
                </div>

                <p className="mt-2 text-[11px] text-biz-muted">Tip: You can zoom and move the image inside the crop box.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}