import { adminApp, adminDb } from "@/lib/firebase/admin";
import { getMessaging } from "firebase-admin/messaging";

type SendArgs = {
  businessId: string;
  title: string;
  body: string;
  url: string; // where to open on click
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function sendBusinessPush(args: SendArgs) {
  const { businessId, title, body, url } = args;

  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
  const staffPushEnabled = !!biz?.settings?.notifications?.staffPushEnabled;

  const tokenSnap = await adminDb
    .collection("businesses")
    .doc(businessId)
    .collection("pushTokens")
    .limit(80)
    .get();

  const tokens = tokenSnap.docs
    .map((d) => d.data() as any)
    .filter((t) => !!t?.token)
    .filter((t) => String(t.role || "owner") !== "staff" || staffPushEnabled)
    .map((t) => String(t.token));

  if (!tokens.length) return { ok: true, sent: 0, tokens: 0 };

  const messaging = getMessaging(adminApp);

  let sent = 0;

  // Firebase multicast limit is 500, but keep it small & fast
  for (const group of chunk(tokens, 200)) {
    const res = await messaging.sendEachForMulticast({
      tokens: group,
      notification: { title, body },
      data: { url },
    });

    sent += res.successCount;

    // cleanup invalid tokens
    const toDelete: string[] = [];
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = (r.error as any)?.code || "";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        toDelete.push(group[i]);
      }
    });

    if (toDelete.length) {
      // delete by scanning docs (small set)
      const docs = tokenSnap.docs;
      const batch = adminDb.batch();
      for (const tok of toDelete) {
        const doc = docs.find((d) => String((d.data() as any)?.token) === tok);
        if (doc) batch.delete(doc.ref);
      }
      await batch.commit().catch(() => {});
    }
  }

  return { ok: true, sent, tokens: tokens.length };
}