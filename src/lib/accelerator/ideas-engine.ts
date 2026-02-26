// FILE: src/lib/accelerator/ideas-engine.ts

import type {
  AcceleratorProfile,
  BusinessIdea,
  AcceleratorInterest,
  DifficultyLevel,
  DemandScore,
} from "./types";

const IDEAS_DATABASE: Omit<BusinessIdea, "id" | "whyItFitsYou">[] = [
  // FOOD
  {
    title: "Small Chops & Snacks Business",
    description: "Prepare and sell popular Nigerian small chops (puff-puff, spring rolls, samosa) for events and daily orders.",
    estimatedStartupCapital: { min: 50000, max: 150000 },
    estimatedMonthlyProfit: { min: 80000, max: 250000 },
    difficulty: "Easy",
    timeToFirstSale: "2-3 days",
    demandScore: "High",
    category: "food",
  },
  {
    title: "Meal Prep & Delivery Service",
    description: "Cook and deliver fresh meals to busy professionals and students in your area.",
    estimatedStartupCapital: { min: 100000, max: 300000 },
    estimatedMonthlyProfit: { min: 120000, max: 400000 },
    difficulty: "Moderate",
    timeToFirstSale: "3-5 days",
    demandScore: "High",
    category: "food",
  },
  {
    title: "Juice & Smoothie Bar",
    description: "Fresh fruit juices, smoothies, and parfaits sold from home or a small stand.",
    estimatedStartupCapital: { min: 80000, max: 200000 },
    estimatedMonthlyProfit: { min: 60000, max: 180000 },
    difficulty: "Easy",
    timeToFirstSale: "1-2 days",
    demandScore: "Medium",
    category: "food",
  },
  // FASHION
  {
    title: "Thrift Clothing (Okrika) Resale",
    description: "Source quality thrift clothes in bulk and resell online and locally at a markup.",
    estimatedStartupCapital: { min: 50000, max: 200000 },
    estimatedMonthlyProfit: { min: 60000, max: 200000 },
    difficulty: "Easy",
    timeToFirstSale: "1-2 days",
    demandScore: "High",
    category: "fashion",
  },
  {
    title: "Custom T-Shirt Printing",
    description: "Design and print custom t-shirts for individuals, events, and businesses.",
    estimatedStartupCapital: { min: 150000, max: 500000 },
    estimatedMonthlyProfit: { min: 100000, max: 350000 },
    difficulty: "Moderate",
    timeToFirstSale: "3-5 days",
    demandScore: "Medium",
    category: "fashion",
  },
  {
    title: "Sneaker & Shoe Reselling",
    description: "Source trendy sneakers and shoes from suppliers and resell at profit margins.",
    estimatedStartupCapital: { min: 200000, max: 800000 },
    estimatedMonthlyProfit: { min: 100000, max: 400000 },
    difficulty: "Moderate",
    timeToFirstSale: "2-4 days",
    demandScore: "High",
    category: "fashion",
  },
  // BEAUTY
  {
    title: "Hair Extensions & Wig Business",
    description: "Sell quality wigs, hair extensions and bundles online and in-person.",
    estimatedStartupCapital: { min: 200000, max: 1000000 },
    estimatedMonthlyProfit: { min: 150000, max: 600000 },
    difficulty: "Moderate",
    timeToFirstSale: "2-3 days",
    demandScore: "High",
    category: "beauty",
  },
  {
    title: "Skincare Products Line",
    description: "Create or resell natural skincare products (soaps, oils, creams) locally.",
    estimatedStartupCapital: { min: 100000, max: 400000 },
    estimatedMonthlyProfit: { min: 80000, max: 300000 },
    difficulty: "Moderate",
    timeToFirstSale: "5-7 days",
    demandScore: "Medium",
    category: "beauty",
  },
  {
    title: "Mobile Nail & Lash Services",
    description: "Offer nail art, lash extensions and beauty services at customers locations.",
    estimatedStartupCapital: { min: 80000, max: 250000 },
    estimatedMonthlyProfit: { min: 100000, max: 350000 },
    difficulty: "Easy",
    timeToFirstSale: "1-3 days",
    demandScore: "High",
    category: "beauty",
  },
  // TECH
  {
    title: "Phone Accessories Store",
    description: "Sell phone cases, screen protectors, chargers, airpods and accessories.",
    estimatedStartupCapital: { min: 100000, max: 500000 },
    estimatedMonthlyProfit: { min: 80000, max: 300000 },
    difficulty: "Easy",
    timeToFirstSale: "1-2 days",
    demandScore: "High",
    category: "tech",
  },
  {
    title: "Computer Repair & Services",
    description: "Offer laptop/phone repair, software installation, and tech support.",
    estimatedStartupCapital: { min: 150000, max: 400000 },
    estimatedMonthlyProfit: { min: 100000, max: 400000 },
    difficulty: "Advanced",
    timeToFirstSale: "3-5 days",
    demandScore: "Medium",
    category: "tech",
  },
  // DIGITAL
  {
    title: "Social Media Management",
    description: "Manage social media accounts for businesses. Create content, schedule posts, grow engagement.",
    estimatedStartupCapital: { min: 50000, max: 100000 },
    estimatedMonthlyProfit: { min: 100000, max: 500000 },
    difficulty: "Moderate",
    timeToFirstSale: "5-7 days",
    demandScore: "High",
    category: "digital",
  },
  {
    title: "Digital Product Sales (Templates, Guides)",
    description: "Create and sell digital products like Canva templates, e-books, printables.",
    estimatedStartupCapital: { min: 50000, max: 100000 },
    estimatedMonthlyProfit: { min: 50000, max: 300000 },
    difficulty: "Moderate",
    timeToFirstSale: "5-10 days",
    demandScore: "Medium",
    category: "digital",
  },
  // RETAIL
  {
    title: "Provision & Mini Mart",
    description: "Stock and sell everyday household provisions and groceries from a small shop or online.",
    estimatedStartupCapital: { min: 200000, max: 1000000 },
    estimatedMonthlyProfit: { min: 80000, max: 300000 },
    difficulty: "Easy",
    timeToFirstSale: "1 day",
    demandScore: "High",
    category: "retail",
  },
  {
    title: "Baby Products Store",
    description: "Sell baby clothes, diapers, feeding items, and accessories.",
    estimatedStartupCapital: { min: 150000, max: 600000 },
    estimatedMonthlyProfit: { min: 80000, max: 250000 },
    difficulty: "Easy",
    timeToFirstSale: "2-3 days",
    demandScore: "High",
    category: "retail",
  },
  // SERVICES
  {
    title: "Laundry & Dry Cleaning",
    description: "Offer wash, iron, and dry cleaning services with pickup and delivery.",
    estimatedStartupCapital: { min: 100000, max: 500000 },
    estimatedMonthlyProfit: { min: 80000, max: 300000 },
    difficulty: "Moderate",
    timeToFirstSale: "2-3 days",
    demandScore: "Medium",
    category: "services",
  },
  {
    title: "Event Planning & Decoration",
    description: "Plan and decorate for birthdays, weddings, and corporate events.",
    estimatedStartupCapital: { min: 200000, max: 800000 },
    estimatedMonthlyProfit: { min: 150000, max: 600000 },
    difficulty: "Advanced",
    timeToFirstSale: "7-14 days",
    demandScore: "Medium",
    category: "services",
  },
  {
    title: "Photography & Videography",
    description: "Offer professional photo and video services for events, products, and content creation.",
    estimatedStartupCapital: { min: 300000, max: 1500000 },
    estimatedMonthlyProfit: { min: 150000, max: 500000 },
    difficulty: "Advanced",
    timeToFirstSale: "5-10 days",
    demandScore: "Medium",
    category: "services",
  },
];

function generateId(title: string, index: number): string {
  return `idea_${title.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30)}_${index}`;
}

function budgetOverlaps(
  ideaMin: number,
  ideaMax: number,
  userMin: number,
  userMax: number
): boolean {
  return ideaMin <= userMax && ideaMax >= userMin;
}

function difficultyMatchesTime(
  difficulty: DifficultyLevel,
  time: "full-time" | "side-hustle"
): number {
  if (time === "side-hustle") {
    if (difficulty === "Easy") return 3;
    if (difficulty === "Moderate") return 2;
    return 1;
  }
  return 2;
}

function generateWhyItFitsYou(
  idea: Omit<BusinessIdea, "id" | "whyItFitsYou">,
  profile: AcceleratorProfile
): string {
  const reasons: string[] = [];

  if (profile.interests.includes(idea.category)) {
    reasons.push(`matches your interest in ${idea.category}`);
  }

  if (budgetOverlaps(idea.estimatedStartupCapital.min, idea.estimatedStartupCapital.max, profile.budgetMin, profile.budgetMax)) {
    reasons.push("fits within your budget range");
  }

  if (idea.difficulty === "Easy" && profile.timeAvailability === "side-hustle") {
    reasons.push("easy to start as a side hustle");
  }

  if (idea.demandScore === "High") {
    reasons.push("high customer demand in Nigeria");
  }

  if (idea.timeToFirstSale.includes("1")) {
    reasons.push("you can make your first sale very quickly");
  }

  if (reasons.length === 0) {
    reasons.push("great potential for growth in your area");
  }

  return "This " + reasons.slice(0, 3).join(", ") + ".";
}

export function generateBusinessIdeas(
  profile: AcceleratorProfile
): BusinessIdea[] {
  const scored = IDEAS_DATABASE.map((idea, idx) => {
    let score = 0;

    // Interest match
    if (profile.interests.includes(idea.category)) score += 10;

    // Budget match
    if (budgetOverlaps(idea.estimatedStartupCapital.min, idea.estimatedStartupCapital.max, profile.budgetMin, profile.budgetMax)) {
      score += 8;
    }

    // Time/difficulty match
    score += difficultyMatchesTime(idea.difficulty, profile.timeAvailability);

    // Demand bonus
    if (idea.demandScore === "High") score += 3;
    if (idea.demandScore === "Medium") score += 1;

    // Skills match
    const ideaWords = (idea.title + " " + idea.description).toLowerCase();
    for (const skill of profile.skills) {
      if (ideaWords.includes(skill.toLowerCase())) score += 4;
    }

    return { idea, idx, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ idea, idx }) => ({
    ...idea,
    id: generateId(idea.title, idx),
    whyItFitsYou: generateWhyItFitsYou(idea, profile),
  }));
}
