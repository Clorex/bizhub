export type FlwCreatePaymentArgs = {
  tx_ref: string;
  amount: number; // major unit (e.g. 5000 for NGN, 20 for USD)
  currency: "NGN" | "USD";
  redirect_url: string;

  // Flutterwave expects: email, phonenumber, name (some methods require phone/name)
  customer: { email: string; name?: string; phonenumber?: string };

  meta?: any;
  title?: string;
  description?: string;

  // optional: limit allowed methods
  payment_options?: string; // e.g. "card,banktransfer,ussd"
};

export type FlwVerifiedTx = {
  id: number;
  tx_ref: string;
  status: string; // "successful" | "failed" | ...
  amount: number; // major
  currency: string; // "NGN" | "USD"
  customer?: { email?: string | null };
  meta?: any;
  created_at?: string;
};

// ✅ Fixed function, no typos
function flwSecretKey() {
  return process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || "";
}

function flwBaseUrl() {
  const v = process.env.FLW_BASE_URL || process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com";
  return String(v).replace(/\/$/, "");
}

async function readJsonSafe(r: Response) {
  return await r.json().catch(() => ({} as any));
}

// ✅ Flutterwave hosted checkout is strict about meta.
// Ensure meta values are primitives only (no objects/arrays).
function sanitizeFlwMeta(meta: any) {
  const out: Record<string, string | number | boolean> = {};
  if (!meta || typeof meta !== "object") return out;

  for (const [kRaw, v] of Object.entries(meta)) {
    const k = String(kRaw || "").trim().slice(0, 40);
    if (!k) continue;
    if (v === undefined || v === null) continue;

    if (typeof v === "string") out[k] = v.slice(0, 300);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    // drop objects/arrays completely (prevents "Invalid meta data passed")
  }

  return out;
}

export async function flwCreatePaymentLink(args: FlwCreatePaymentArgs) {
  // ✅ Call function with parenthesis, this fixes the "not defined" error
  const sk = flwSecretKey();
  if (!sk) throw new Error("Missing Flutterwave secret key (set FLUTTERWAVE_SECRET_KEY or FLW_SECRET_KEY)");

  const url = `${flwBaseUrl()}/v3/payments`;

  const payload: any = {
    tx_ref: args.tx_ref,
    amount: args.amount,
    currency: args.currency,
    redirect_url: args.redirect_url,
    customer: {
      email: String(args.customer?.email || "").trim(),
      name: args.customer?.name ? String(args.customer.name).trim().slice(0, 80) : undefined,
      phonenumber: args.customer?.phonenumber ? String(args.customer.phonenumber).trim().slice(0, 30) : undefined,
    },
    meta: sanitizeFlwMeta(args.meta ?? {}),
    customizations: {
      title: args.title ?? "Bizhub Payment",
      description: args.description ?? "Payment",
    },
  };

  if (args.payment_options) payload.payment_options = String(args.payment_options);

  // remove undefined
  Object.keys(payload.customer).forEach((k) => payload.customer[k] === undefined && delete payload.customer[k]);

  // Debug logs
  console.log("📤 SENDING TO FLUTTERWAVE: ", JSON.stringify(payload, null, 2))

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const j = await readJsonSafe(r);
  console.log("📥 FLUTTERWAVE RESPONSE: ", JSON.stringify(j, null, 2))

  if (!r.ok || j?.status !== "success") {
    console.error("❌ FLUTTERWAVE ERROR: ", j)
    throw new Error(j?.message || "Flutterwave init failed");
  }

  const link = String(j?.data?.link || "");
  if (!link) throw new Error("Flutterwave init failed: missing payment link");
  return { link };
}

export async function flwVerifyTransaction(transactionId: string | number): Promise<FlwVerifiedTx> {
  const sk = flwSecretKey();
  if (!sk) throw new Error("Missing Flutterwave secret key (set FLUTTERWAVE_SECRET_KEY or FLW_SECRET_KEY)");

  const id = String(transactionId || "").trim();
  if (!id) throw new Error("Missing transactionId");

  const url = `${flwBaseUrl()}/v3/transactions/${encodeURIComponent(id)}/verify`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${sk}` } });

  const j = await readJsonSafe(r);
  if (!r.ok || j?.status !== "success") throw new Error(j?.message || "Flutterwave verify failed");

  return j.data as FlwVerifiedTx;
}