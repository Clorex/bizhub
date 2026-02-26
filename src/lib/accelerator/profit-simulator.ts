// FILE: src/lib/accelerator/profit-simulator.ts

import type { BusinessIdea, SimulationResult } from "./types";

interface SimulationInput {
  idea: BusinessIdea;
  capitalInput: number;
  marketingSpendPercent?: number;
}

export function simulateProfit(input: SimulationInput): SimulationResult {
  const { idea, capitalInput, marketingSpendPercent = 15 } = input;

  const inventoryCost = Math.round(capitalInput * 0.55);
  const marketingCost = Math.round(capitalInput * (marketingSpendPercent / 100));
  const operatingCost = Math.round(capitalInput * 0.10);
  const packagingCost = Math.round(capitalInput * 0.05);
  const miscCost = Math.round(capitalInput * 0.05);

  const totalCosts = inventoryCost + marketingCost + operatingCost + packagingCost + miscCost;

  // Revenue estimation based on idea profit ranges and capital
  const capitalRatio = capitalInput / Math.max(idea.estimatedStartupCapital.min, 1);
  const baseRevenue = (idea.estimatedMonthlyProfit.min + idea.estimatedMonthlyProfit.max) / 2;
  const projectedMonthlyRevenue = Math.round(
    Math.min(baseRevenue * Math.min(capitalRatio, 2.5), idea.estimatedMonthlyProfit.max * 2)
  );

  const projectedNetProfit = Math.max(0, projectedMonthlyRevenue - (totalCosts * 0.6));

  // Break-even calculation
  const dailyProfit = projectedNetProfit / 30;
  const breakEvenDays = dailyProfit > 0 ? Math.ceil(capitalInput / dailyProfit) : 999;

  // Risk level
  let riskLevel: "Low" | "Medium" | "High" = "Medium";
  if (idea.difficulty === "Easy" && idea.demandScore === "High") riskLevel = "Low";
  if (idea.difficulty === "Advanced" || idea.demandScore === "Low") riskLevel = "High";

  // 6-month projection
  const sixMonthProjection = Array.from({ length: 6 }, (_, i) => {
    const month = i + 1;
    const growthFactor = 1 + (i * 0.12);
    return {
      month,
      revenue: Math.round(projectedMonthlyRevenue * growthFactor),
      profit: Math.round(projectedNetProfit * growthFactor),
    };
  });

  return {
    capitalInput,
    costs: [
      { label: "Inventory / Stock", amount: inventoryCost },
      { label: "Marketing & Ads", amount: marketingCost },
      { label: "Operating Costs", amount: operatingCost },
      { label: "Packaging", amount: packagingCost },
      { label: "Miscellaneous", amount: miscCost },
    ],
    totalCosts,
    projectedMonthlyRevenue,
    projectedNetProfit: Math.round(projectedNetProfit),
    breakEvenDays: Math.min(breakEvenDays, 365),
    riskLevel,
    sixMonthProjection,
  };
}
