// FILE: src/lib/accelerator/types.ts

export type AcceleratorInterest =
  | "food"
  | "fashion"
  | "beauty"
  | "tech"
  | "digital"
  | "retail"
  | "services";

export type TimeAvailability = "full-time" | "side-hustle";

export type DifficultyLevel = "Easy" | "Moderate" | "Advanced";
export type DemandScore = "Low" | "Medium" | "High";

export interface AcceleratorProfile {
  interests: AcceleratorInterest[];
  skills: string[];
  budgetMin: number;
  budgetMax: number;
  timeAvailability: TimeAvailability;
  location: {
    state: string;
    area: string;
  };
}

export interface BusinessIdea {
  id: string;
  title: string;
  description: string;
  estimatedStartupCapital: { min: number; max: number };
  estimatedMonthlyProfit: { min: number; max: number };
  difficulty: DifficultyLevel;
  timeToFirstSale: string;
  demandScore: DemandScore;
  whyItFitsYou: string;
  category: AcceleratorInterest;
}

export interface SimulationResult {
  capitalInput: number;
  costs: {
    label: string;
    amount: number;
  }[];
  totalCosts: number;
  projectedMonthlyRevenue: number;
  projectedNetProfit: number;
  breakEvenDays: number;
  riskLevel: "Low" | "Medium" | "High";
  sixMonthProjection?: {
    month: number;
    revenue: number;
    profit: number;
  }[];
}

export interface SupplierMatch {
  id: string;
  name: string;
  category: string;
  rating: number;
  reliabilityScore: number;
  location: string;
  verified: boolean;
  whatsappNumber?: string;
  autoMessage?: string;
}

export interface ActionPlanDay {
  day: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface AcceleratorProgress {
  currentStep: number;
  profile: Partial<AcceleratorProfile> | null;
  selectedIdeaId: string | null;
  selectedIdea: BusinessIdea | null;
  simulation: SimulationResult | null;
  actionPlan: ActionPlanDay[] | null;
  completedAt: string | null;
}

export type AcceleratorStep = 1 | 2 | 3 | 4 | 5 | 6;
