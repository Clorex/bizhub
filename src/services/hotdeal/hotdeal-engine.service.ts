import prisma from "@/lib/db";
import { cache } from "@/lib/redis";

const GLOBAL_TOP_LIMIT = 20;
const CATEGORY_TOP_LIMIT = 20;
const CATEGORY_STABILITY_BUFFER = 25;

const MAX_GLOBAL_PER_VENDOR = 5;
const MAX_CATEGORY_PER_VENDOR = 3;

export class HotDealEngine {
  static async recalculateAll() {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      include: { vendor: true },
    });

    const scored = [];

    for (const product of products) {
      const metrics = await this.collectMetrics(product.id);
      const normalized = this.normalizeMetrics(metrics);

      let hotScore =
        normalized.views * 0.25 +
        normalized.conversion * 0.25 +
        normalized.salesVelocity * 0.2 +
        normalized.discount * 0.15 +
        normalized.rating * 0.15;

      if (product.vendor.subscription_tier?.toLowerCase() === "apex") {
        hotScore *= 1.1;
      }

      scored.push({
        product,
        hotScore,
      });
    }

    await this.rankAndPersist(scored);
  }

  private static async collectMetrics(productId: string) {
    const start48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const start3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const views = await prisma.productView.count({
      where: {
        product_id: productId,
        created_at: { gte: start48h },
      },
    });

    const salesVelocity = await prisma.orderItem.count({
      where: {
        product_id: productId,
        order: {
          status: "completed",
          created_at: { gte: start3d },
        },
      },
    });

    const conversion = 0;
    const discount = 0;
    const rating = 4.5;

    return {
      views,
      conversion,
      salesVelocity,
      discount,
      rating,
    };
  }

  private static normalizeMetrics(metrics: any) {
    return {
      views: Math.min(metrics.views / 200, 1),
      conversion: Math.min(metrics.conversion, 1),
      salesVelocity: Math.min(metrics.salesVelocity / 30, 1),
      discount: Math.min(metrics.discount / 100, 1),
      rating: Math.min(metrics.rating / 5, 1),
    };
  }

  private static async rankAndPersist(scored: any[]) {
    // GLOBAL RANKING
    const globalSorted = [...scored].sort((a, b) => b.hotScore - a.hotScore);

    const vendorGlobalCount = new Map<string, number>();

    for (let i = 0; i < globalSorted.length; i++) {
      const { product, hotScore } = globalSorted[i];
      const vendorId = product.vendor_id;

      const globalRank = i + 1;
      let badgeType = "none";

      const vendorCount = vendorGlobalCount.get(vendorId) || 0;

      if (globalRank <= GLOBAL_TOP_LIMIT && vendorCount < MAX_GLOBAL_PER_VENDOR) {
        badgeType = "global_hot";
        vendorGlobalCount.set(vendorId, vendorCount + 1);
      }

      const previous = await prisma.productHotScore.findUnique({
        where: { product_id: product.id },
      });

      const previousRank = previous?.global_rank || null;
      const rankMovement = previousRank ? previousRank - globalRank : null;

      await prisma.productHotScore.upsert({
        where: { product_id: product.id },
        update: {
          hot_score: hotScore,
          global_rank: globalRank,
          previous_global_rank: previousRank,
          rank_movement: rankMovement,
          badge_type: badgeType,
          last_calculated_at: new Date(),
        },
        create: {
          product_id: product.id,
          category_id: null,
          hot_score: hotScore,
          global_rank: globalRank,
          previous_global_rank: null,
          rank_movement: null,
          badge_type: badgeType,
          last_calculated_at: new Date(),
        },
      });
    }

    // CATEGORY RANKING
    const categories = new Map<string, any[]>();

    for (const item of scored) {
      const category = item.product.category_id || "uncategorized";
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(item);
    }

    for (const [categoryId, items] of categories.entries()) {
      const sorted = items.sort((a, b) => b.hotScore - a.hotScore);

      const vendorCategoryCount = new Map<string, number>();

      for (let i = 0; i < sorted.length; i++) {
        const { product } = sorted[i];
        const categoryRank = i + 1;

        const vendorId = product.vendor_id;
        const vendorCount = vendorCategoryCount.get(vendorId) || 0;

        let badgeType = "none";

        if (
          categoryRank <= CATEGORY_TOP_LIMIT &&
          vendorCount < MAX_CATEGORY_PER_VENDOR
        ) {
          badgeType = "category_hot";
          vendorCategoryCount.set(vendorId, vendorCount + 1);
        }

        const previous = await prisma.productHotScore.findUnique({
          where: { product_id: product.id },
        });

        const previousRank = previous?.category_rank || null;
        const rankMovement = previousRank ? previousRank - categoryRank : null;

        await prisma.productHotScore.update({
          where: { product_id: product.id },
          data: {
            category_id: categoryId,
            category_rank: categoryRank,
            previous_category_rank: previousRank,
            rank_movement: rankMovement,
            badge_type:
              previous?.global_rank && previous.global_rank <= GLOBAL_TOP_LIMIT
                ? previous.badge_type
                : badgeType,
          },
        });
      }

      await cache.set(
        `hotdeal:category:${categoryId}`,
        sorted.slice(0, CATEGORY_TOP_LIMIT),
        6 * 60 * 60
      );
    }

    await cache.set(
      "hotdeal:global_top20",
      globalSorted.slice(0, GLOBAL_TOP_LIMIT),
      6 * 60 * 60
    );
  }
}
