import prisma from '@/lib/db';
import { Vendor } from '@/types/vendor';

/**
 * Vendor Repository
 * Data access layer for vendor table.
 */
export class VendorRepository {
  /**
   * Find vendor by ID.
   */
  static async findById(vendorId: string): Promise<Vendor | null> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) return null;

      return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        store_name: vendor.store_name,
        is_paid: vendor.is_paid,
        subscription_tier: vendor.subscription_tier as Vendor['subscription_tier'],
        subscription_expiry: vendor.subscription_expiry ?? new Date(0),
        created_at: vendor.created_at,
        updated_at: vendor.updated_at,
      };
    } catch (error) {
      console.error('VendorRepository.findById error:', error);
      return null;
    }
  }

  /**
   * Find vendor by email.
   */
  static async findByEmail(email: string): Promise<Vendor | null> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { email },
      });

      if (!vendor) return null;

      return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        store_name: vendor.store_name,
        is_paid: vendor.is_paid,
        subscription_tier: vendor.subscription_tier as Vendor['subscription_tier'],
        subscription_expiry: vendor.subscription_expiry ?? new Date(0),
        created_at: vendor.created_at,
        updated_at: vendor.updated_at,
      };
    } catch (error) {
      console.error('VendorRepository.findByEmail error:', error);
      return null;
    }
  }

  /**
   * Update vendor subscription status.
   */
  static async updateSubscription(
    vendorId: string,
    data: {
      is_paid: boolean;
      subscription_tier: string;
      subscription_expiry: Date;
    }
  ): Promise<Vendor | null> {
    try {
      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          is_paid: data.is_paid,
          subscription_tier: data.subscription_tier,
          subscription_expiry: data.subscription_expiry,
        },
      });

      return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        store_name: vendor.store_name,
        is_paid: vendor.is_paid,
        subscription_tier: vendor.subscription_tier as Vendor['subscription_tier'],
        subscription_expiry: vendor.subscription_expiry ?? new Date(0),
        created_at: vendor.created_at,
        updated_at: vendor.updated_at,
      };
    } catch (error) {
      console.error('VendorRepository.updateSubscription error:', error);
      return null;
    }
  }
}