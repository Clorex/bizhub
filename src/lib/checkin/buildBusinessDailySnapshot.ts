import { adminDb } from "@/lib/firebase/admin";

interface BuildBusinessDailySnapshotParams {
  businessId: string;
}

export async function buildBusinessDailySnapshot({
  businessId,
}: BuildBusinessDailySnapshotParams) {
  // Placeholder snapshot with a "business" object
  return {
    businessId,
    business: {
      id: businessId,
      name: "", // you can fetch name from DB if you want
      slug: "", // you can fetch slug from DB if you want
    },
    today: {
      orders: 0,
      revenue: 0,
    },
    attention: {
      pendingConfirmCount: 0,
      disputedCount: 0,
    },
    revenue: 0,
    orders: 0,
    visits: 0,
    customers: 0,
    date: new Date().toISOString().slice(0, 10),
  };
}
