// FILE: src/lib/accelerator/plan-generator.ts

import type { BusinessIdea, ActionPlanDay } from "./types";

export function generate7DayPlan(idea: BusinessIdea): ActionPlanDay[] {
  return [
    {
      day: 1,
      title: "Secure your supplier",
      description: `Research and contact at least 2-3 suppliers for your ${idea.title.toLowerCase()} business. Compare prices, minimum orders, and delivery timelines.`,
      completed: false,
    },
    {
      day: 2,
      title: "Confirm pricing & margins",
      description: "Calculate your selling price based on supplier costs. Aim for at least 40-60% margin. Factor in packaging, delivery, and marketing costs.",
      completed: false,
    },
    {
      day: 3,
      title: "Create your product listings",
      description: "Set up your myBizHub store. Write clear product names, descriptions, and set competitive prices. Add at least 3-5 products to start.",
      completed: false,
    },
    {
      day: 4,
      title: "Upload product images",
      description: "Take clear, well-lit photos of your products. Use natural light. Show different angles. Upload to your store listings.",
      completed: false,
    },
    {
      day: 5,
      title: "Set up marketing channels",
      description: "Create a WhatsApp Business account. Set up your Instagram page. Share your myBizHub store link on your status and social media.",
      completed: false,
    },
    {
      day: 6,
      title: "Soft launch",
      description: "Share your store with close friends and family. Ask for honest feedback. Make adjustments to pricing or descriptions if needed.",
      completed: false,
    },
    {
      day: 7,
      title: "First sales push",
      description: "Post your products on all channels. Offer a small launch discount. Reach out directly to 10-20 potential customers. Your first sale is coming!",
      completed: false,
    },
  ];
}
