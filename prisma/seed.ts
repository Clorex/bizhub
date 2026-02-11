import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.vendorDailyStats.deleteMany();
  await prisma.cartAdd.deleteMany();
  await prisma.productSave.deleteMany();
  await prisma.productClick.deleteMany();
  await prisma.productView.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();

  // ===========================
  // VENDOR 1: Paid, Premium, High Sales
  // ===========================
  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'Sarah Johnson',
      email: 'sarah@bizhub.com',
      store_name: 'Sarah\'s Boutique',
      is_paid: true,
      subscription_tier: 'premium',
      subscription_expiry: new Date('2025-12-31'),
    },
  });

  // ===========================
  // VENDOR 2: Unpaid (for testing locked state)
  // ===========================
  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'John Smith',
      email: 'john@bizhub.com',
      store_name: 'John\'s Tech Store',
      is_paid: false,
      subscription_tier: 'basic',
      subscription_expiry: new Date('2024-01-01'),
    },
  });

  // ===========================
  // VENDOR 3: Paid but expired
  // ===========================
  const vendor3 = await prisma.vendor.create({
    data: {
      name: 'Emma Wilson',
      email: 'emma@bizhub.com',
      store_name: 'Emma\'s Crafts',
      is_paid: true,
      subscription_tier: 'basic',
      subscription_expiry: new Date('2024-06-01'),
    },
  });

  console.log('✅ Vendors created');

  // ===========================
  // PRODUCTS for Vendor 1
  // ===========================
  const productNames = [
    { name: 'Leather Handbag', price: 89.99, image: '/images/products/handbag.jpg' },
    { name: 'Silk Scarf', price: 34.99, image: '/images/products/scarf.jpg' },
    { name: 'Gold Earrings', price: 59.99, image: '/images/products/earrings.jpg' },
    { name: 'Cotton Dress', price: 74.99, image: '/images/products/dress.jpg' },
    { name: 'Wool Sweater', price: 54.99, image: '/images/products/sweater.jpg' },
    { name: 'Denim Jacket', price: 99.99, image: '/images/products/jacket.jpg' },
    { name: 'Canvas Tote', price: 29.99, image: '/images/products/tote.jpg' },
  ];

  const products = [];
  for (const p of productNames) {
    const product = await prisma.product.create({
      data: {
        vendor_id: vendor1.id,
        name: p.name,
        price: p.price,
        image_url: p.image,
      },
    });
    products.push(product);
  }

  console.log('✅ Products created');

  // ===========================
  // ORDERS & ORDER ITEMS for last 60 days
  // ===========================
  for (let day = 0; day < 60; day++) {
    const date = daysAgo(day);
    // More orders in recent days (simulate growth)
    const orderCount = day < 30 ? randomBetween(3, 12) : randomBetween(1, 7);

    for (let o = 0; o < orderCount; o++) {
      const itemCount = randomBetween(1, 3);
      const selectedProducts = products
        .sort(() => Math.random() - 0.5)
        .slice(0, itemCount);

      const total = selectedProducts.reduce(
        (sum, p) => sum + p.price * randomBetween(1, 3),
        0
      );

      const orderDate = new Date(date);
      orderDate.setHours(randomBetween(8, 22), randomBetween(0, 59));

      const order = await prisma.order.create({
        data: {
          vendor_id: vendor1.id,
          customer_id: `customer_${randomBetween(1, 50)}`,
          total: Math.round(total * 100) / 100,
          status: 'completed',
          created_at: orderDate,
        },
      });

      for (const sp of selectedProducts) {
        const qty = randomBetween(1, 3);
        await prisma.orderItem.create({
          data: {
            order_id: order.id,
            product_id: sp.id,
            quantity: qty,
            price: sp.price,
            created_at: orderDate,
          },
        });
      }
    }
  }

  console.log('✅ Orders created');

  // ===========================
  // ENGAGEMENT DATA for last 60 days
  // ===========================
  for (let day = 0; day < 60; day++) {
    const date = daysAgo(day);

    for (const product of products) {
      // Views
      const viewCount = randomBetween(5, 40);
      for (let v = 0; v < viewCount; v++) {
        await prisma.productView.create({
          data: {
            product_id: product.id,
            vendor_id: vendor1.id,
            viewer_id: `viewer_${randomBetween(1, 100)}`,
            created_at: date,
          },
        });
      }

      // Clicks
      const clickCount = randomBetween(2, 20);
      for (let c = 0; c < clickCount; c++) {
        await prisma.productClick.create({
          data: {
            product_id: product.id,
            vendor_id: vendor1.id,
            clicker_id: `clicker_${randomBetween(1, 100)}`,
            created_at: date,
          },
        });
      }

      // Saves
      const saveCount = randomBetween(0, 8);
      for (let s = 0; s < saveCount; s++) {
        await prisma.productSave.create({
          data: {
            product_id: product.id,
            vendor_id: vendor1.id,
            user_id: `user_${randomBetween(1, 100)}`,
            created_at: date,
          },
        });
      }

      // Cart adds
      const cartCount = randomBetween(1, 10);
      for (let ca = 0; ca < cartCount; ca++) {
        await prisma.cartAdd.create({
          data: {
            product_id: product.id,
            vendor_id: vendor1.id,
            user_id: `user_${randomBetween(1, 100)}`,
            created_at: date,
          },
        });
      }
    }
  }

  console.log('✅ Engagement data created');

  // ===========================
  // PRE-AGGREGATE DAILY STATS
  // ===========================
  for (let day = 0; day < 60; day++) {
    const date = daysAgo(day);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: {
        vendor_id: vendor1.id,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const views = await prisma.productView.count({
      where: {
        vendor_id: vendor1.id,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const clicks = await prisma.productClick.count({
      where: {
        vendor_id: vendor1.id,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const saves = await prisma.productSave.count({
      where: {
        vendor_id: vendor1.id,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const cartAdds = await prisma.cartAdd.count({
      where: {
        vendor_id: vendor1.id,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    const revenue = orders.reduce((sum, o) => sum + o.total, 0);

    await prisma.vendorDailyStats.upsert({
      where: {
        vendor_id_date: {
          vendor_id: vendor1.id,
          date: startOfDay,
        },
      },
      update: {
        sales_count: orders.length,
        revenue: Math.round(revenue * 100) / 100,
        views,
        clicks,
        purchases: orders.length,
        saves,
        cart_adds: cartAdds,
        shares: randomBetween(0, 5),
      },
      create: {
        vendor_id: vendor1.id,
        date: startOfDay,
        sales_count: orders.length,
        revenue: Math.round(revenue * 100) / 100,
        views,
        clicks,
        purchases: orders.length,
        saves,
        cart_adds: cartAdds,
        shares: randomBetween(0, 5),
      },
    });
  }

  console.log('✅ Daily stats aggregated');

  console.log('');
  console.log('========================================');
  console.log('🎉 SEED COMPLETE');
  console.log('========================================');
  console.log(`Vendor 1 (PAID):    ${vendor1.email} - ${vendor1.id}`);
  console.log(`Vendor 2 (UNPAID):  ${vendor2.email} - ${vendor2.id}`);
  console.log(`Vendor 3 (EXPIRED): ${vendor3.email} - ${vendor3.id}`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });