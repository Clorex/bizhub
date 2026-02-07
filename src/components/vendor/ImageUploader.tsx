// FILE: src/components/vendor/ImageUploader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";
import "cropperjs/dist/cropper.css";
import { COVER_ASPECT_OPTIONS, normalizeCoverAspect, type CoverAspectKey } from "@/lib/products/coverAspect";

// Lazy-load Cropper
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

type AspectChoice = "free" | CoverAspectKey;

type DraftItem = {
  id: string;
  file: File;
  previewUrl: string;

  status: "ready" | "uploading" | "uploaded" | "error";
  progress: number; // 0..100
  error?: string;

  uploadedUrl?: string;
};

type RectPct = { x: number; y: number; w: number; h: number };

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

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
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

function suggestAspectFromSize(w: number, h: number): CoverAspectKey {
  const ww = Number(w || 0);
  const hh = Number(h || 0);
  if (!Number.isFinite(ww) || !Number.isFinite(hh) || ww <= 0 || hh <= 0) return "1:1";

  const r = ww / hh;

  let best: CoverAspectKey = "1:1";
  let bestDiff = Infinity;

  for (const opt of COVER_ASPECT_OPTIONS) {
    const rr = opt.w / opt.h;
    const diff = Math.abs(r - rr);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt.key;
    }
  }
  return best;
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

async function cropFileByRectPct(file: File, rect: RectPct) {
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

  const sx = Math.round(clamp01(rect.x) * iw);
  const sy = Math.round(clamp01(rect.y) * ih);
  const sw = Math.round(clamp01(rect.w) * iw);
  const sh = Math.round(clamp01(rect.h) * ih);

  const sx2 = Math.max(0, Math.min(iw - 1, sx));
  const sy2 = Math.max(0, Math.min(ih - 1, sy));
  const sw2 = Math.max(1, Math.min(iw - sx2, sw));
  const sh2 = Math.max(1, Math.min(ih - sy2, sh));

  const c = document.createElement("canvas");
  c.width = sw2;
  c.height = sh2;

  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (bmp) {
    ctx.drawImage(bmp, sx2, sy2, sw2, sh2, 0, 0, sw2, sh2);
  } else {
    const img = await fileToHtmlImage(file);
    ctx.drawImage(img, sx2, sy2, sw2, sh2, 0, 0, sw2, sh2);
  }

  const scaled = downscaleCanvas(c, 1600);
  const blob = await canvasToBlob(scaled, "image/jpeg", 0.86);

  const baseName = (file.name || "image").replace(/\.[a-z0-9]+$/i, "");
  return new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
}

// Cache signed payload briefly
const SIGN_TTL_MS = 2 * 60 * 1000;

function AspectTile(props: { opt: { key: CoverAspectKey; w: number; h: number }; active: boolean; onClick: () => void; disabled?: boolean }) {
  const { opt, active, onClick, disabled } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? "rounded-2xl border border-biz-accent/30 bg-white p-3 shadow-soft"
          : "rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
      }
    >
      {/* illustration */}
      <div className="flex items-center justify-center">
        <div className={active ? "h-10 w-10 rounded-xl bg-biz-cream flex items-center justify-center" : "h-10 w-10 rounded-xl bg-[#F6F7FB] flex items-center justify-center"}>
          <div
            className={active ? "border-2 border-biz-accent rounded-[6px] bg-white" : "border-2 border-gray-400/70 rounded-[6px] bg-white"}
            style={{
              // fixed icon area, ratio displayed inside
              width: 20,
              aspectRatio: `${opt.w} / ${opt.h}`,
            }}
          />
        </div>
      </div>

      <p className={active ? "mt-2 text-xs font-extrabold text-biz-ink text-center" : "mt-2 text-xs font-bold text-biz-ink text-center"}>
        {opt.key}
      </p>
    </button>
  );
}

export function ImageUploader(props: {
  label?: string;
  value?: string[];
  onChange?: (urls: string[]) => void;
  onUploaded?: (urls: string[]) => void;
  multiple?: boolean;
  max?: number;
  folderBase?: string;
  disabled?: boolean;

  aspectKey?: CoverAspectKey;
  onAspectKeyChange?: (k: CoverAspectKey) => void;

  autoOpenCrop?: boolean;

  // ✅ set false to remove "Free"
  allowFreeAspect?: boolean;
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
    aspectKey,
    onAspectKeyChange,
    autoOpenCrop = true,
    allowFreeAspect = true,
  } = props;

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const draftsRef = useRef<DraftItem[]>([]);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const [err, setErr] = useState<string | null>(null);

  // crop modal state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);

  const [aspect, setAspect] = useState<AspectChoice>(() => normalizeCoverAspect(aspectKey) || "1:1");
  useEffect(() => {
    const k = normalizeCoverAspect(aspectKey);
    if (k) setAspect(k);
  }, [aspectKey]);

  const [applyToAll, setApplyToAll] = useState(false);
  const [hasCroppedOnce, setHasCroppedOnce] = useState(false); // ✅ show "apply to all" only after first crop
  const [croppingBusy, setCroppingBusy] = useState(false);

  const [zoom, setZoom] = useState(1);
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

  const signedCacheRef = useRef<{ at: number; payload: SignedPayload } | null>(null);

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

  function aspectToRatio(a: AspectChoice) {
    if (a === "free") return NaN;
    const opt = COVER_ASPECT_OPTIONS.find((x) => x.key === a);
    return opt ? opt.w / opt.h : 1;
  }

  async function suggestAspectFromFile(file: File): Promise<CoverAspectKey | null> {
    try {
      const bmp = await fileToImageBitmap(file);
      if (bmp) return suggestAspectFromSize(bmp.width, bmp.height);
      const img = await fileToHtmlImage(file);
      return suggestAspectFromSize(img.naturalWidth, img.naturalHeight);
    } catch {
      return null;
    }
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

    if (slice[0]) {
      suggestAspectFromFile(slice[0]).then((k) => {
        if (!k) return;
        if (!allowFreeAspect) {
          setAspect(k);
          onAspectKeyChange?.(k);
        } else {
          if (typeof aspectKey === "undefined") setAspect(k);
          onAspectKeyChange?.(k);
        }
      });
    }

    if (autoOpenCrop && newDrafts[0]) {
      const firstId = newDrafts[0].id;
      setTimeout(() => {
        setCropId(firstId);
        setApplyToAll(false);
        setZoom(1);
        setCropOpen(true);
      }, 0);
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
    // ✅ only allow apply-to-all choice after first crop happened
    setApplyToAll(false);
    setZoom(1);
    setCropOpen(true);
  }

  function getCropRectPctFromCropper(): RectPct | null {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return null;

    const imgData = cropper.getImageData?.();
    const d = cropper.getData?.(true);

    const nw = Number(imgData?.naturalWidth || 0);
    const nh = Number(imgData?.naturalHeight || 0);
    if (!nw || !nh || !d) return null;

    const x = clamp01(Number(d.x || 0) / nw);
    const y = clamp01(Number(d.y || 0) / nh);
    const w = clamp01(Number(d.width || 0) / nw);
    const h = clamp01(Number(d.height || 0) / nh);

    return { x, y, w: Math.max(0.001, w), h: Math.max(0.001, h) };
  }

  async function applyCropToSome(rectPct: RectPct, ids: string[]) {
    for (const id of ids) {
      const d = draftsRef.current.find((x) => x.id === id);
      if (!d) continue;
      if (d.status === "uploading" || d.status === "uploaded") continue;

      try {
        const nextFile = await cropFileByRectPct(d.file, rectPct);
        const nextPreview = URL.createObjectURL(nextFile);

        setDrafts((prev) =>
          prev.map((x) => {
            if (x.id !== id) return x;
            try {
              URL.revokeObjectURL(x.previewUrl);
            } catch {}
            return { ...x, file: nextFile, previewUrl: nextPreview, status: "ready", progress: 0, error: undefined };
          })
        );

        // eslint-disable-next-line no-await-in-loop
        await sleep(10);
      } catch (e: any) {
        setDrafts((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status: "error", error: e?.message || "Crop failed" } : x))
        );
      }
    }
  }

  async function applyCrop() {
    if (!cropId) return;

    if (!allowFreeAspect && aspect === "free") {
      setErr("Choose an aspect ratio.");
      return;
    }

    const rectPct = getCropRectPctFromCropper();
    if (!rectPct) {
      setErr("Cropper not ready.");
      return;
    }

    setErr(null);
    setCroppingBusy(true);

    try {
      if (aspect !== "free") onAspectKeyChange?.(aspect);

      const targets = applyToAll
        ? draftsRef.current.filter((d) => d.status !== "uploading" && d.status !== "uploaded").map((d) => d.id)
        : [cropId];

      await applyCropToSome(rectPct, targets);

      // ✅ now we can show the “apply to all” choice in later crops
      setHasCroppedOnce(true);

      setCropOpen(false);
      setCropId(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to crop image(s)");
    } finally {
      setCroppingBusy(false);
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

        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: "uploaded", progress: 100, uploadedUrl: url } : d)));

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
    const queue = draftsRef.current.filter((d) => d.status === "ready" || d.status === "error").map((d) => d.id);
    await runPool(queue, 2);
  }

  const cropDraft = cropId ? drafts.find((d) => d.id === cropId) : null;

  // keep cropper zoom in sync
  useEffect(() => {
    if (!cropOpen) return;
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    try {
      cropper.zoomTo(zoom);
      cropper.setDragMode?.("move");
    } catch {}
  }, [zoom, cropOpen]);

  const showApplyChoice = hasCroppedOnce && drafts.length >= 2;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block text-sm font-bold text-biz-ink">{label}</label>
          <p className="mt-1 text-[11px] text-biz-muted">Select photos → crop → upload.</p>
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
          multiple={multiple}
          onChange={(e) => addFiles(e.target.files)}
          disabled={disabled || remainingSlots <= 0}
        />

        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remainingSlots <= 0 || uploadingAny || croppingBusy}
        >
          Choose photos
        </Button>

        <Button onClick={uploadAll} disabled={disabled || uploadingAny || croppingBusy || drafts.every((d) => d.status === "uploaded")}>
          Upload all
        </Button>

        {remainingSlots <= 0 ? (
          <span className="text-[11px] font-bold text-orange-700">Max reached</span>
        ) : (
          <span className="text-[11px] text-biz-muted">{remainingSlots} slot(s) left</span>
        )}
      </div>

      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}

      {/* Uploaded */}
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
                      disabled={disabled || d.status === "uploading" || d.status === "uploaded" || croppingBusy}
                    >
                      Crop
                    </button>

                    {d.status !== "uploaded" ? (
                      <button
                        className="text-[11px] font-bold text-gray-700 disabled:opacity-50"
                        onClick={() => removeDraft(d.id)}
                        disabled={disabled || d.status === "uploading" || croppingBusy}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  {d.status === "ready" ? (
                    <button
                      className="w-full py-2 rounded-xl text-[11px] font-extrabold bg-biz-cream text-biz-ink disabled:opacity-50"
                      onClick={() => uploadDraft(d.id)}
                      disabled={disabled || uploadingAny || croppingBusy || uploadedUrls.length >= max}
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
                        disabled={disabled || uploadingAny || croppingBusy}
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
        <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
          {/* responsive: bottom-sheet on mobile, centered on desktop */}
          <div className="min-h-full flex items-end md:items-center justify-center p-4">
            <div className="w-full max-w-[520px] rounded-3xl bg-white border border-biz-line overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="p-4 border-b border-biz-line">
                <p className="text-sm font-extrabold text-biz-ink">Crop photo</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  Drag the photo to reposition. Use zoom to fit. (The crop frame is fixed.)
                </p>
              </div>

              <div className="p-4">
                <div className="rounded-2xl overflow-hidden border border-biz-line bg-black">
                  <Cropper
                    key={`${cropId}_${String(aspect)}`}
                    src={cropDraft.previewUrl}
                    style={{ height: 360, width: "100%" }}
                    // @ts-ignore
                    ref={cropperRef}
                    viewMode={1}
                    guides
                    background={false}
                    responsive
                    checkOrientation={false}
                    aspectRatio={aspectToRatio(aspect)}
                    autoCropArea={1}
                    dragMode="move"
                    cropBoxMovable={false}
                    cropBoxResizable={false}
                    movable
                    zoomable
                    scalable={false}
                    rotatable={false}
                    toggleDragModeOnDblclick={false}
                    ready={() => {
                      try {
                        cropperRef.current?.cropper?.setDragMode?.("move");
                      } catch {}
                    }}
                  />
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold text-biz-ink">Zoom</p>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full"
                    disabled={croppingBusy}
                  />
                </div>

                {/* Aspect ratios with illustration */}
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-biz-ink">Aspect ratio</p>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {allowFreeAspect ? null : null /* no Free when allowFreeAspect=false */}
                    {COVER_ASPECT_OPTIONS.map((opt) => (
                      <AspectTile
                        key={opt.key}
                        opt={opt}
                        active={aspect === opt.key}
                        disabled={croppingBusy}
                        onClick={() => {
                          setAspect(opt.key);
                          onAspectKeyChange?.(opt.key);
                          setZoom(1);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* ✅ Only show this AFTER at least one crop has been done */}
                {showApplyChoice ? (
                  <div className="mt-4 rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-xs font-extrabold text-biz-ink">Apply to…</p>
                    <p className="text-[11px] text-biz-muted mt-1">Choose whether to crop only this photo or all selected photos.</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyToAll(false)}
                        className={
                          !applyToAll
                            ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                            : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
                        }
                        disabled={croppingBusy}
                      >
                        This photo
                      </button>

                      <button
                        type="button"
                        onClick={() => setApplyToAll(true)}
                        className={
                          applyToAll
                            ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                            : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
                        }
                        disabled={croppingBusy}
                      >
                        All selected
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setCropOpen(false)} disabled={croppingBusy}>
                    Cancel
                  </Button>
                  <Button onClick={applyCrop} loading={croppingBusy} disabled={croppingBusy}>
                    Apply crop
                  </Button>
                </div>

                <p className="mt-2 text-[11px] text-biz-muted">
                  Note: When this crop is your first crop, next time you open crop you’ll see “This photo / All selected”.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}