import { adminAuth, adminDb } from "@/lib/firebase/admin";

export type AppRole = "customer" | "owner" | "staff" | "admin";

export type MeProfile = {
  uid: string;
  email?: string | null;
  role: AppRole;
  businessId?: string | null;
  businessSlug?: string | null;
};

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "itabitamiracle090@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireMe(req: Request): Promise<MeProfile> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new Error("Missing Authorization Bearer token");

  const decoded = await adminAuth.verifyIdToken(token);

  const email = (decoded.email ?? "").toLowerCase();
  if (email && adminEmails().includes(email)) {
    return { uid: decoded.uid, email: decoded.email ?? null, role: "admin" };
  }

  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userSnap.exists ? (userSnap.data() as any) : {};

  const role: AppRole = (userData?.role as AppRole) || "customer";

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    role,
    businessId: userData?.businessId ?? null,
    businessSlug: userData?.businessSlug ?? null,
  };
}

export async function requireRole(req: Request, role: AppRole) {
  const me = await requireMe(req);
  if (me.role !== role) throw new Error("Not authorized");
  return me;
}

export async function requireAnyRole(req: Request, roles: AppRole[]) {
  const me = await requireMe(req);
  if (!roles.includes(me.role)) throw new Error("Not authorized");
  return me;
}