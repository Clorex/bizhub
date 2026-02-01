"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";

type SignedPayload = {
  ok: boolean;
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  error?: string;
};

export function ImageUploader({
  label = "Upload images",
  onUploaded,
  multiple = true,
}: {
  label?: string;
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function getSigned(): Promise<SignedPayload> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not logged in");

    const r = await fetch("/api/uploads/cloudinary/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ folderBase: "bizhub/uploads" }),
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

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setErr(null);
    setDetail(null);

    const user = auth.currentUser;
    if (!user?.uid) {
      setErr("Please login first");
      return;
    }

    // quick file type guard
    for (const f of Array.from(files)) {
      if (!f.type?.startsWith("image/")) {
        setErr("Only image files are allowed.");
        return;
      }
    }

    setProgress(0);

    try {
      const signed = await getSigned();
      const urls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setDetail(`Uploading ${i + 1}/${files.length}…`);

        const url = await uploadOneToCloudinary({
          cloudName: signed.cloudName,
          apiKey: signed.apiKey,
          folder: signed.folder,
          timestamp: signed.timestamp,
          signature: signed.signature,
          file,
          onProgress: (pct) => setProgress(pct),
        });

        urls.push(url);
      }

      setProgress(null);
      setDetail(null);
      setErr(null);

      if (inputRef.current) inputRef.current.value = "";
      onUploaded(urls);
    } catch (e: any) {
      setProgress(null);
      setDetail(null);
      setErr(e?.message || "Upload failed");
    }
  }

  return (
    <div>
      <label className="block text-sm font-bold text-biz-ink">{label}</label>

      <input
        ref={inputRef}
        className="mt-2 block w-full text-sm"
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => upload(e.target.files)}
      />

      {progress != null ? (
        <p className="mt-2 text-xs text-biz-muted">
          Uploading… {progress}% {detail ? `• ${detail}` : ""}
        </p>
      ) : null}

      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
    </div>
  );
}