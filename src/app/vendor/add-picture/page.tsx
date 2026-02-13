// FILE: src/app/vendor/add-picture/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { toast } from "@/lib/ui/toast";

function parseBool(v: string | null, fallback: boolean) {
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return fallback;
}

function parseIntSafe(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readSessionUrls(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeSessionUrls(key: string, urls: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(urls || []));
  } catch {}
}

export default function VendorAddPicturePage() {
  const router = useRouter();
  const sp = useSearchParams();

  // configurable via query params
  const sessionKey = String(sp.get("k") || "bizhub_vendor_add_picture_urls_v1");
  const returnTo = sp.get("returnTo"); // optional
  const title = String(sp.get("title") || "Add Picture");
  const subtitle = String(sp.get("subtitle") || "Upload and press Done");
  const folderBase = String(sp.get("folderBase") || "bizhub/uploads");
  const max = parseIntSafe(sp.get("max"), 6);
  const multiple = parseBool(sp.get("multiple"), true);

  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    setUrls(readSessionUrls(sessionKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    writeSessionUrls(sessionKey, urls);
  }, [sessionKey, urls]);

  const canDone = useMemo(() => urls.length > 0, [urls.length]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <GradientHeader title={title} subtitle={subtitle} showBack={true} />

      <div className="px-4 pt-4 space-y-3">
        <Card className="p-4">
          <ImageUploader
            label="Pictures"
            value={urls}
            onChange={(next) => setUrls(next)}
            max={max}
            multiple={multiple}
            folderBase={folderBase}
          />
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setUrls([]);
              toast.info("Cleared.");
            }}
            disabled={urls.length === 0}
          >
            Clear
          </Button>

          <Button
            onClick={() => {
              // Persisted already via sessionStorage.
              if (returnTo) router.push(returnTo);
              else router.back();
            }}
            disabled={!canDone}
          >
            Done
          </Button>
        </div>

        <p className="text-[11px] text-gray-500">
          Tip: If you go back without pressing “Done”, your uploaded pictures will still be saved for this step.
        </p>
      </div>
    </div>
  );
}