export type AppRole = "customer" | "owner" | "admin";

/** Business */
export type Business = {
  id: string;
  name: string;
  slug: string;
  description?: string;

  ownerId?: string;
  createdAt?: any;
  updatedAt?: any;

  payoutDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
};

/** Product options + variants */
export type ProductOptionGroup = {
  name: string; // e.g. "Size", "Color"
  values: string[]; // e.g. ["38","39"] or ["Black","White"]
};

export type ProductVariant = {
  key: string; // e.g. "Size=38|Color=Black"
  price: number; // override price for this combo
  stock?: number; // optional stock per variant
};

/** Product */
export type Product = {
  id: string;
  businessId: string;

  // optional denormalized fields for easy linking in UI
  businessSlug?: string;
  businessName?: string;

  name: string;
  description?: string;

  price: number;
  stock?: number;

  images?: string[];
  videos?: string[];

  // variants
  optionGroups?: ProductOptionGroup[];
  variants?: ProductVariant[];

  createdAt?: any;
  updatedAt?: any;
};

/** Cart */
export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string;
};

export type CartState = {
  storeSlug: string | null;
  items: CartItem[];
};

/** Orders */
export type PaymentType = "paystack_escrow" | "direct_transfer";
export type EscrowStatus = "held" | "released" | "refunded" | "disputed" | "none";
export type OrderStatus =
  | "paid_held"
  | "released_to_vendor_wallet"
  | "refunded"
  | "awaiting_vendor_confirmation"
  | "disputed";

export type Order = {
  id: string;
  businessId: string;
  businessSlug: string;

  items: CartItem[];

  customer?: {
    fullName?: string;
    phone?: string;
    address?: string;
    email?: string;
  };

  paymentType: PaymentType;
  escrowStatus: EscrowStatus;
  orderStatus: OrderStatus;

  amount: number;
  amountKobo: number;
  currency?: string;

  holdUntilMs?: number;

  payment?: {
    provider?: "paystack";
    reference?: string;
    status?: string;
    channel?: string | null;
    paidAt?: string | null;
    feesKobo?: number | null;
  };

  createdAt?: any;
  updatedAt?: any;
};

/** Wallet */
export type Wallet = {
  businessId: string;
  pendingBalanceKobo: number;
  availableBalanceKobo: number;
  totalEarnedKobo: number;
  updatedAt?: any;
};

/** Disputes */
export type DisputeStatus = "open" | "closed";

export type Dispute = {
  id: string;
  orderId: string;
  businessId?: string | null;
  reason: string;
  details?: string;
  status: DisputeStatus;
  adminDecision?: "release" | "refund" | string;
  createdAt?: any;
  resolvedAt?: any;
};