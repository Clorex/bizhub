// FILE: src/lib/themes/storeThemes.ts

export type ThemeTier = "free" | "momentum" | "apex";

export interface StoreTheme {
  id: string;
  name: string;
  description: string;
  tier: ThemeTier;
  preview: string;
  
  headerGradient: string;
  headerTextColor: string;
  headerOverlay?: string;
  
  primaryColor: string;
  primaryLight: string;
  primaryDark: string;
  
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  
  buttonGradient: string;
  buttonText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryBorder: string;
  
  hasPattern?: boolean;
  patternOpacity?: number;
  hasAnimation?: boolean;
  animationType?: "gradient" | "shimmer" | "pulse";
  
  badgeBg: string;
  badgeText: string;
  saleBadgeBg: string;
  saleBadgeText: string;
}

export const STORE_THEMES: StoreTheme[] = [
  // FREE TIER - 2 themes
  {
    id: "classic",
    name: "Classic",
    description: "Clean, minimal white design that works for everyone",
    tier: "free",
    preview: "linear-gradient(135deg, #FF6B00 0%, #FF8A00 100%)",
    headerGradient: "linear-gradient(135deg, #FF6B00 0%, #FF8A00 50%, #FFA033 100%)",
    headerTextColor: "#ffffff",
    primaryColor: "#FF6B00",
    primaryLight: "#FFF4EB",
    primaryDark: "#E55A00",
    pageBg: "#F8F9FA",
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    buttonGradient: "linear-gradient(135deg, #FF6B00 0%, #FF8A00 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#FFFFFF",
    buttonSecondaryText: "#374151",
    buttonSecondaryBorder: "#E5E7EB",
    badgeBg: "#FFF4EB",
    badgeText: "#EA580C",
    saleBadgeBg: "#ECFDF5",
    saleBadgeText: "#059669",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Elegant dark mode for a premium feel",
    tier: "free",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    headerGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    headerTextColor: "#ffffff",
    primaryColor: "#E94560",
    primaryLight: "#2D1F3D",
    primaryDark: "#C73E54",
    pageBg: "#0F0F1A",
    cardBg: "#1A1A2E",
    cardBorder: "#2D2D44",
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0B2",
    textMuted: "#6B6B80",
    buttonGradient: "linear-gradient(135deg, #E94560 0%, #FF6B6B 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#2D2D44",
    buttonSecondaryText: "#FFFFFF",
    buttonSecondaryBorder: "#3D3D55",
    badgeBg: "#2D1F3D",
    badgeText: "#E94560",
    saleBadgeBg: "#1A3D2E",
    saleBadgeText: "#34D399",
  },

  // MOMENTUM TIER - 4 themes
  {
    id: "sunset-glow",
    name: "Sunset Glow",
    description: "Warm coral and orange gradients that radiate energy",
    tier: "momentum",
    preview: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FEC89A 100%)",
    headerGradient: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FEC89A 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)",
    primaryColor: "#FF6B6B",
    primaryLight: "#FFF0F0",
    primaryDark: "#E85555",
    pageBg: "#FFFAF8",
    cardBg: "#FFFFFF",
    cardBorder: "#FFE4D6",
    textPrimary: "#2D1810",
    textSecondary: "#6B4A3A",
    textMuted: "#A07A6A",
    buttonGradient: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#FFF5F0",
    buttonSecondaryText: "#C74B4B",
    buttonSecondaryBorder: "#FFD4C4",
    badgeBg: "#FFF0E8",
    badgeText: "#E85C3A",
    saleBadgeBg: "#ECFDF5",
    saleBadgeText: "#059669",
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Calming blue and teal tones inspired by the sea",
    tier: "momentum",
    preview: "linear-gradient(135deg, #667EEA 0%, #48C6EF 50%, #6DD5ED 100%)",
    headerGradient: "linear-gradient(135deg, #667EEA 0%, #48C6EF 50%, #6DD5ED 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 40%)",
    primaryColor: "#4F9CF9",
    primaryLight: "#EBF4FF",
    primaryDark: "#3B82F6",
    pageBg: "#F0F9FF",
    cardBg: "#FFFFFF",
    cardBorder: "#BAE6FD",
    textPrimary: "#0C4A6E",
    textSecondary: "#0369A1",
    textMuted: "#7DD3FC",
    buttonGradient: "linear-gradient(135deg, #4F9CF9 0%, #38BDF8 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#F0F9FF",
    buttonSecondaryText: "#0369A1",
    buttonSecondaryBorder: "#BAE6FD",
    badgeBg: "#E0F2FE",
    badgeText: "#0284C7",
    saleBadgeBg: "#D1FAE5",
    saleBadgeText: "#059669",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Fresh green tones inspired by nature",
    tier: "momentum",
    preview: "linear-gradient(135deg, #134E5E 0%, #3B8D6E 50%, #71B280 100%)",
    headerGradient: "linear-gradient(135deg, #134E5E 0%, #3B8D6E 50%, #71B280 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08) 0%, transparent 40%)",
    primaryColor: "#059669",
    primaryLight: "#ECFDF5",
    primaryDark: "#047857",
    pageBg: "#F0FDF9",
    cardBg: "#FFFFFF",
    cardBorder: "#A7F3D0",
    textPrimary: "#064E3B",
    textSecondary: "#047857",
    textMuted: "#6EE7B7",
    buttonGradient: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#ECFDF5",
    buttonSecondaryText: "#047857",
    buttonSecondaryBorder: "#A7F3D0",
    badgeBg: "#D1FAE5",
    badgeText: "#047857",
    saleBadgeBg: "#FEF3C7",
    saleBadgeText: "#D97706",
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    description: "Luxurious pink and gold for a premium boutique feel",
    tier: "momentum",
    preview: "linear-gradient(135deg, #B76E79 0%, #C9A0A0 50%, #D4A574 100%)",
    headerGradient: "linear-gradient(135deg, #B76E79 0%, #C9A0A0 50%, #D4A574 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2) 0%, transparent 50%)",
    primaryColor: "#B76E79",
    primaryLight: "#FDF2F4",
    primaryDark: "#9D5A63",
    pageBg: "#FDF8F8",
    cardBg: "#FFFFFF",
    cardBorder: "#F5D0D5",
    textPrimary: "#4A2C32",
    textSecondary: "#7D5A5F",
    textMuted: "#C9A0A0",
    buttonGradient: "linear-gradient(135deg, #B76E79 0%, #D4A574 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#FDF2F4",
    buttonSecondaryText: "#9D5A63",
    buttonSecondaryBorder: "#F5D0D5",
    badgeBg: "#FDF2F4",
    badgeText: "#B76E79",
    saleBadgeBg: "#FEF9E7",
    saleBadgeText: "#B8860B",
  },

  // APEX TIER - 4 themes
  {
    id: "neon-city",
    name: "Neon City",
    description: "Vibrant cyberpunk vibes with electric colors",
    tier: "apex",
    preview: "linear-gradient(135deg, #6B21A8 0%, #DB2777 50%, #F97316 100%)",
    headerGradient: "linear-gradient(135deg, #6B21A8 0%, #A855F7 30%, #DB2777 60%, #F97316 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)",
    primaryColor: "#A855F7",
    primaryLight: "#FAF5FF",
    primaryDark: "#7C3AED",
    pageBg: "#0F0A1A",
    cardBg: "#1A1025",
    cardBorder: "#3B2355",
    textPrimary: "#FFFFFF",
    textSecondary: "#C4B5FD",
    textMuted: "#7C6A99",
    buttonGradient: "linear-gradient(135deg, #A855F7 0%, #EC4899 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#2D1B4E",
    buttonSecondaryText: "#E9D5FF",
    buttonSecondaryBorder: "#4C1D95",
    hasAnimation: true,
    animationType: "shimmer",
    badgeBg: "#3B0764",
    badgeText: "#E879F9",
    saleBadgeBg: "#14532D",
    saleBadgeText: "#4ADE80",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    description: "Premium gold and amber for luxury brands",
    tier: "apex",
    preview: "linear-gradient(135deg, #92702C 0%, #D4A84B 50%, #F5D78E 100%)",
    headerGradient: "linear-gradient(135deg, #78350F 0%, #B8860B 40%, #D4A84B 70%, #F5D78E 100%)",
    headerTextColor: "#ffffff",
    headerOverlay: "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.15) 0%, transparent 60%)",
    primaryColor: "#B8860B",
    primaryLight: "#FFFBEB",
    primaryDark: "#92702C",
    pageBg: "#FFFCF5",
    cardBg: "#FFFFFF",
    cardBorder: "#F5D78E",
    textPrimary: "#422006",
    textSecondary: "#78350F",
    textMuted: "#B8860B",
    buttonGradient: "linear-gradient(135deg, #B8860B 0%, #D4A84B 50%, #F5D78E 100%)",
    buttonText: "#422006",
    buttonSecondaryBg: "#FFFBEB",
    buttonSecondaryText: "#92702C",
    buttonSecondaryBorder: "#F5D78E",
    hasPattern: true,
    patternOpacity: 0.5,
    badgeBg: "#FEF3C7",
    badgeText: "#92702C",
    saleBadgeBg: "#ECFDF5",
    saleBadgeText: "#059669",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Mesmerizing animated gradient like northern lights",
    tier: "apex",
    preview: "linear-gradient(135deg, #667EEA 0%, #764BA2 25%, #6DD5ED 50%, #38EF7D 75%, #667EEA 100%)",
    headerGradient: "linear-gradient(135deg, #667EEA 0%, #764BA2 25%, #6DD5ED 50%, #38EF7D 75%, #11998E 100%)",
    headerTextColor: "#ffffff",
    primaryColor: "#7C3AED",
    primaryLight: "#EDE9FE",
    primaryDark: "#5B21B6",
    pageBg: "#F5F3FF",
    cardBg: "#FFFFFF",
    cardBorder: "#C4B5FD",
    textPrimary: "#1E1B4B",
    textSecondary: "#4338CA",
    textMuted: "#A5B4FC",
    buttonGradient: "linear-gradient(135deg, #7C3AED 0%, #2DD4BF 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#EDE9FE",
    buttonSecondaryText: "#5B21B6",
    buttonSecondaryBorder: "#C4B5FD",
    hasAnimation: true,
    animationType: "gradient",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
    saleBadgeBg: "#D1FAE5",
    saleBadgeText: "#059669",
  },
  {
    id: "marble-luxe",
    name: "Marble Luxe",
    description: "Sophisticated marble texture with gold accents",
    tier: "apex",
    preview: "linear-gradient(135deg, #2C3E50 0%, #3D5A6C 50%, #1A252F 100%)",
    headerGradient: "linear-gradient(135deg, #2C3E50 0%, #3D5A6C 50%, #1A252F 100%)",
    headerTextColor: "#D4AF37",
    primaryColor: "#D4AF37",
    primaryLight: "#FDF9E8",
    primaryDark: "#B8972F",
    pageBg: "#FAFAFA",
    cardBg: "#FFFFFF",
    cardBorder: "#E5E5E5",
    textPrimary: "#1A1A1A",
    textSecondary: "#4A4A4A",
    textMuted: "#9A9A9A",
    buttonGradient: "linear-gradient(135deg, #2C3E50 0%, #D4AF37 100%)",
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#FFFFFF",
    buttonSecondaryText: "#2C3E50",
    buttonSecondaryBorder: "#D4AF37",
    hasPattern: true,
    patternOpacity: 0.4,
    badgeBg: "#F5F5F5",
    badgeText: "#2C3E50",
    saleBadgeBg: "#FDF9E8",
    saleBadgeText: "#B8972F",
  },
];

export function getThemeById(id: string): StoreTheme | undefined {
  return STORE_THEMES.find((t) => t.id === id);
}

export function getDefaultTheme(): StoreTheme {
  return STORE_THEMES[0];
}

export function getAvailableThemes(planKey: string): StoreTheme[] {
  const plan = planKey.toUpperCase();
  
  if (plan === "APEX") {
    return STORE_THEMES;
  }
  
  if (plan === "MOMENTUM") {
    return STORE_THEMES.filter((t) => t.tier !== "apex");
  }
  
  return STORE_THEMES.filter((t) => t.tier === "free");
}

export function isThemeAvailable(themeId: string, planKey: string): boolean {
  const theme = getThemeById(themeId);
  if (!theme) return false;
  
  const available = getAvailableThemes(planKey);
  return available.some((t) => t.id === themeId);
}

export function getTierLabel(tier: ThemeTier): string {
  switch (tier) {
    case "apex": return "Apex";
    case "momentum": return "Momentum";
    default: return "Free";
  }
}

export function getTierColor(tier: ThemeTier): { bg: string; text: string; border: string } {
  switch (tier) {
    case "apex":
      return { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" };
    case "momentum":
      return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
  }
}