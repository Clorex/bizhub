import { adminDb } from "@/lib/firebase/admin";
import { getEntitlement, type Entitlement } from "@/lib/bizhubPlans";

export async function getBusinessEntitlementById(businessId: string): Promise<{
  business: any | null;
  entitlement: Entitlement;
}> {
  const snap = await adminDb.collection("businesses").doc(businessId).get();
  const business = snap.exists ? ({ id: snap.id, ...(snap.data() as any) } as any) : null;

  const entitlement = getEntitlement({
    trial: business?.trial ?? null,
    subscription: business?.subscription ?? null,
  });

  return { business, entitlement };
}