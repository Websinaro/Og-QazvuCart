import { db } from './index';
import { eq, sql as rawSql } from 'drizzle-orm';
import {
  users,
  sellers,
  addresses,
  categories,
  products,
  productImages,
  productVariants,
  productSpecifications,
  reviews,
  questions,
  answers,
  orders,
  orderItems,
  orderTimeline,
} from './schema';
import { hashPassword } from '@/src/lib/password';

/**
 * DEVELOPMENT ONLY.
 *
 * This script seeds sample catalog data (categories/products) plus a
 * throwaway seller + customer account so the storefront has something to
 * show locally. It is NEVER run automatically (not on `npm install`,
 * `npm run build`, `npm start`, or as part of `db:migrate`) — it only runs
 * when a developer explicitly executes `npm run db:seed`.
 *
 * It intentionally does NOT create any admin account. Admins are created
 * exclusively via `npm run admin:create` (see src/scripts/create-admin.ts),
 * which prompts for credentials interactively and never uses a
 * predictable/hardcoded password.
 *
 * All seed account credentials must be supplied via environment variables —
 * there are no hardcoded fallback passwords. If you don't set these, run
 * `npm run db:seed` will simply throw instead of silently creating
 * well-known accounts.
 */
function requireSeedEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} is required to run the DEVELOPMENT-ONLY seed script. Set it in your local .env (never in production).`
    );
  }
  return value;
}

async function ensureSeedUser(options: {
  desiredUsername: string;
  email: string;
  phone: string;
  password: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  avatarUrl: string;
}): Promise<number> {
  const cleanEmail = options.email.toLowerCase().trim();

  const [existingByEmail] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, cleanEmail))
    .limit(1);

  if (existingByEmail) {
    if (existingByEmail.role !== options.role) {
      await db.update(users).set({ role: options.role }).where(eq(users.id, existingByEmail.id));
    }
    return existingByEmail.id;
  }

  let finalUsername = options.desiredUsername.trim();
  const [existingByUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, finalUsername))
    .limit(1);

  if (existingByUsername) {
    const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    finalUsername = `${finalUsername}_${emailPrefix}`;
    const [secondCheck] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, finalUsername))
      .limit(1);
    if (secondCheck) {
      finalUsername = `${options.desiredUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  const passwordHash = await hashPassword(options.password);
  const [inserted] = await db
    .insert(users)
    .values({
      username: finalUsername,
      email: cleanEmail,
      phone: options.phone,
      passwordHash,
      role: options.role,
      isVerified: true,
      avatarUrl: options.avatarUrl,
    })
    .returning({ id: users.id });

  return inserted.id;
}

export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the development seed script with NODE_ENV=production. ' +
        'This script is for local/dev databases only.'
    );
  }

  const [existingCategory] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existingCategory) {
    return;
  }

  console.log('Seeding DEVELOPMENT-ONLY marketplace data (not for production use)...');

  const customerUserId = await ensureSeedUser({
    desiredUsername: 'dev_customer',
    email: requireSeedEnv('SEED_CUSTOMER_EMAIL'),
    phone: '+91 9876543210',
    password: requireSeedEnv('SEED_CUSTOMER_PASSWORD'),
    role: 'CUSTOMER',
    avatarUrl: '/assets/default-avatar.svg',
  });

  const sellerUserId = await ensureSeedUser({
    desiredUsername: 'dev_seller',
    email: requireSeedEnv('SEED_SELLER_EMAIL'),
    phone: '+91 9876500001',
    password: requireSeedEnv('SEED_SELLER_PASSWORD'),
    role: 'SELLER',
    avatarUrl: '/assets/default-avatar.svg',
  });

  let sellerId: number;
  const [existingSeller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.userId, sellerUserId)).limit(1);
  if (!existingSeller) {
    const [insertedSeller] = await db
      .insert(sellers)
      .values({
        userId: sellerUserId,
        storeName: 'Prime Electronics & Lifestyle',
        slug: 'prime-electronics',
        rating: '4.9',
        reviewCount: 1420,
        isVerified: true,
      })
      .returning({ id: sellers.id });
    sellerId = insertedSeller.id;
  } else {
    sellerId = existingSeller.id;
  }

  const [existingAddress] = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, customerUserId)).limit(1);
  if (!existingAddress) {
    await db.insert(addresses).values([
      {
        userId: customerUserId,
        fullName: 'John Doe',
        phoneNumber: '+91 9876543210',
        houseBuilding: 'Flat 402, Sunshine Heights',
        streetArea: 'MG Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India',
        isDefault: true,
      },
      {
        userId: customerUserId,
        fullName: 'John Doe (Office)',
        phoneNumber: '+91 9876543210',
        houseBuilding: 'Tech Park, 5th Floor',
        streetArea: 'Outer Ring Road, Bellandur',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560103',
        country: 'India',
        isDefault: false,
      },
    ]);
  }

  const categoryData = [
    { name: 'Electronics', slug: 'electronics', icon: 'Smartphone', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80', desc: 'Audio, Mobiles, Laptops & Accessories' },
    { name: 'Fashion', slug: 'fashion', icon: 'Shirt', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80', desc: 'Apparel, Footwear, Watches & Bags' },
    { name: 'Home & Living', slug: 'home-living', icon: 'Home', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&q=80', desc: 'Kitchenware, Furniture & Decor' },
    { name: 'Beauty & Care', slug: 'beauty-care', icon: 'Sparkles', imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80', desc: 'Skincare, Fragrances & Grooming' },
    { name: 'Sports & Fitness', slug: 'sports-fitness', icon: 'Dumbbell', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80', desc: 'Gym Gear, Footwear & Outdoor Sports' },
    { name: 'Accessories', slug: 'accessories', icon: 'Watch', imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', desc: 'Smartwatches, Belts, Sunglasses & Wallets' },
  ];

  const categoryMap: { [slug: string]: number } = {};

  for (let i = 0; i < categoryData.length; i++) {
    const cat = categoryData[i];
    const [inserted] = await db
      .insert(categories)
      .values({
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        description: cat.desc,
        displayOrder: i + 1,
      })
      .returning({ id: categories.id });
    categoryMap[cat.slug] = inserted.id;
  }

  const products_ = [
      {
        categoryId: categoryMap['electronics'],
        name: 'SonicBlast Pro Wireless Noise-Cancelling Headphones',
        slug: 'sonicblast-pro-wireless-headphones',
        description: 'Engineered for supreme acoustic precision. The SonicBlast Pro features custom 40mm graphene drivers, active hybrid noise cancellation (ANC) up to 42dB, ultra-low latency gaming mode, and exceptional 60-hour continuous battery life on a single USB-C charge.',
        basePrice: 2499,
        discountPrice: 1499,
        stock: 65,
        brand: 'SonicBlast',
        model: 'SB-X200',
        warranty: '1 Year Brand Replacement Warranty',
        weight: '240g',
        deliveryFee: 40,
        estimatedDays: 2,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.6,
        reviewCount: 238,
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80',
          'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&q=80',
          'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&q=80',
        ],
        variants: [
          { name: 'Matte Obsidian Black', sku: 'SB-X200-BLK', priceAdjustment: 0, stock: 35, attrs: { Color: 'Black' } },
          { name: 'Platinum Silver Grey', sku: 'SB-X200-SLV', priceAdjustment: 100, stock: 20, attrs: { Color: 'Silver' } },
          { name: 'Midnight Navy Blue', sku: 'SB-X200-BLU', priceAdjustment: 100, stock: 10, attrs: { Color: 'Navy' } },
        ],
        specs: [
          { key: 'Brand', value: 'SonicBlast' },
          { key: 'Model', value: 'SB-X200 ANC Pro' },
          { key: 'Driver Size', value: '40mm Graphene Diaphragm' },
          { key: 'Noise Cancellation', value: 'Hybrid Active Noise Cancellation (42dB)' },
          { key: 'Battery Life', value: '60 Hours (ANC Off) / 45 Hours (ANC On)' },
          { key: 'Connectivity', value: 'Bluetooth 5.3 + 3.5mm Aux' },
          { key: 'Fast Charging', value: '10 Mins Charge = 5 Hours Playback' },
          { key: 'Weight', value: '240g' },
          { key: 'Warranty', value: '1 Year Manufacturer Warranty' },
        ],
      },
      {
        categoryId: categoryMap['electronics'],
        name: 'AuraBook Max 15.6" Ultra Thin Quad-Core Laptop',
        slug: 'aurabook-max-ultra-thin-laptop',
        description: 'The AuraBook Max combines high computing performance with a sleek aluminum unibody chassis. Featuring a 15.6-inch Full HD anti-glare IPS display, 16GB DDR4 RAM, 512GB NVMe ultra-fast SSD, backlit keyboard, and all-day 10-hour battery life.',
        basePrice: 79999,
        discountPrice: 54999,
        stock: 25,
        brand: 'AuraTech',
        model: 'AB-M15-PRO',
        warranty: '2 Years Comprehensive Warranty',
        weight: '1.45 kg',
        deliveryFee: 0,
        estimatedDays: 2,
        isFeatured: 1,
        isDeal: 0,
        rating: 4.8,
        reviewCount: 142,
        images: [
          'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900&q=80',
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&q=80',
        ],
        variants: [
          { name: '16GB RAM + 512GB SSD / Space Grey', sku: 'AB-16-512-GRY', priceAdjustment: 0, stock: 15, attrs: { Storage: '512GB', Color: 'Space Grey' } },
          { name: '32GB RAM + 1TB SSD / Space Grey', sku: 'AB-32-1TB-GRY', priceAdjustment: 12000, stock: 10, attrs: { Storage: '1TB', Color: 'Space Grey' } },
        ],
        specs: [
          { key: 'Brand', value: 'AuraTech' },
          { key: 'Processor', value: 'Intel Core i7 13th Gen' },
          { key: 'RAM', value: '16GB / 32GB LPDDR5' },
          { key: 'Display', value: '15.6" IPS 100% sRGB Anti-Glare' },
          { key: 'Weight', value: '1.45 kg' },
          { key: 'OS', value: 'Windows 11 Home Pre-Installed' },
        ],
      },
      {
        categoryId: categoryMap['electronics'],
        name: 'NovaPulse Smartwatch Series 7 with AMOLED Display & Bluetooth Calling',
        slug: 'novapulse-smartwatch-series-7',
        description: 'Stay seamlessly connected with the NovaPulse Series 7. Features a crystal-clear 1.96-inch Always-On AMOLED screen, advanced continuous SpO2 and Heart Rate monitoring, 120+ sport modes, and IP68 waterproof rating.',
        basePrice: 5999,
        discountPrice: 2999,
        stock: 90,
        brand: 'NovaPulse',
        model: 'NP-S7-AMOLED',
        warranty: '1 Year Manufacturer Warranty',
        weight: '48g',
        deliveryFee: 40,
        estimatedDays: 3,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.5,
        reviewCount: 312,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80',
          'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=900&q=80',
        ],
        variants: [
          { name: 'Carbon Black Metal Strap', sku: 'NP7-BLK-MTL', priceAdjustment: 0, stock: 45, attrs: { Color: 'Black', Strap: 'Metal' } },
          { name: 'Rose Gold Silicone Strap', sku: 'NP7-GLD-SIL', priceAdjustment: 0, stock: 45, attrs: { Color: 'Rose Gold', Strap: 'Silicone' } },
        ],
        specs: [
          { key: 'Brand', value: 'NovaPulse' },
          { key: 'Display', value: '1.96" AMOLED Always-On (410x502)' },
          { key: 'Sensors', value: 'Heart Rate, SpO2, Sleep Tracker, Step Counter' },
          { key: 'Battery', value: 'Up to 10 Days Typical Usage' },
          { key: 'Water Resistance', value: 'IP68 Swim-Proof' },
        ],
      },
      {
        categoryId: categoryMap['fashion'],
        name: 'AeroFlex Premium Organic Cotton Heavyweight Oversized T-Shirt',
        slug: 'aeroflex-organic-cotton-oversized-tshirt',
        description: 'Crafted from 100% 240 GSM combed organic cotton. Features drop-shoulder tailored cut, pre-shrunk bio-washed fabric for extreme softness, and reinforced ribbed collar that never loses shape.',
        basePrice: 1299,
        discountPrice: 699,
        stock: 120,
        brand: 'AeroFlex',
        model: 'AF-OS-TEE',
        warranty: '30 Days Hassle-Free Returns',
        weight: '280g',
        deliveryFee: 40,
        estimatedDays: 3,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.4,
        reviewCount: 115,
        images: [
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&q=80',
          'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80',
        ],
        variants: [
          { name: 'Vintage Washed Black / Size M', sku: 'AF-TEE-BLK-M', priceAdjustment: 0, stock: 30, attrs: { Color: 'Black', Size: 'M' } },
          { name: 'Vintage Washed Black / Size L', sku: 'AF-TEE-BLK-L', priceAdjustment: 0, stock: 30, attrs: { Color: 'Black', Size: 'L' } },
          { name: 'Oatmeal Beige / Size M', sku: 'AF-TEE-BEG-M', priceAdjustment: 0, stock: 30, attrs: { Color: 'Beige', Size: 'M' } },
          { name: 'Oatmeal Beige / Size L', sku: 'AF-TEE-BEG-L', priceAdjustment: 0, stock: 30, attrs: { Color: 'Beige', Size: 'L' } },
        ],
        specs: [
          { key: 'Brand', value: 'AeroFlex' },
          { key: 'Material', value: '100% Combed Organic Cotton' },
          { key: 'GSM', value: '240 GSM Heavyweight' },
          { key: 'Fit', value: 'Drop-Shoulder Oversized Fit' },
          { key: 'Care', value: 'Machine Wash Cold, Inside Out' },
        ],
      },
      {
        categoryId: categoryMap['fashion'],
        name: 'CloudWalk Pro Cushion Lightweight Running Shoes',
        slug: 'cloudwalk-pro-cushion-running-shoes',
        description: 'Experience bouncy energy return on every stride. Engineered with multi-density EVA foam midsoles, breathable mesh upper, and anti-abrasion carbon rubber outsole for superior grip on asphalt and tracks.',
        basePrice: 4999,
        discountPrice: 2499,
        stock: 45,
        brand: 'CloudWalk',
        model: 'CW-RUN-PRO',
        warranty: '6 Months Brand Warranty',
        weight: '420g (Pair)',
        deliveryFee: 0,
        estimatedDays: 2,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.7,
        reviewCount: 340,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80',
          'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=900&q=80',
        ],
        variants: [
          { name: 'Racing Crimson / UK 8', sku: 'CW-RED-8', priceAdjustment: 0, stock: 15, attrs: { Color: 'Red', Size: 'UK 8' } },
          { name: 'Racing Crimson / UK 9', sku: 'CW-RED-9', priceAdjustment: 0, stock: 15, attrs: { Color: 'Red', Size: 'UK 9' } },
          { name: 'Stealth Black / UK 9', sku: 'CW-BLK-9', priceAdjustment: 0, stock: 15, attrs: { Color: 'Black', Size: 'UK 9' } },
        ],
        specs: [
          { key: 'Brand', value: 'CloudWalk' },
          { key: 'Upper Material', value: 'Engineered Jacquard Breathable Mesh' },
          { key: 'Sole Material', value: 'Dual-Density Nitro Foam & Carbon Rubber' },
          { key: 'Pronation', value: 'Neutral Support' },
          { key: 'Closure', value: 'Lace-Up' },
        ],
      },
      {
        categoryId: categoryMap['home-living'],
        name: 'SmartChef 15-Bar Automatic Italian Espresso & Cappuccino Machine',
        slug: 'smartchef-automatic-espresso-machine',
        description: 'Brew cafe-quality barista espressos, lattes, and silky microfoam cappuccinos right at home. Equipped with professional 15-bar Italian pressure pump, thermoblock rapid heating, and adjustable stainless steel steam wand.',
        basePrice: 12999,
        discountPrice: 7499,
        stock: 35,
        brand: 'SmartChef',
        model: 'SC-ESP15-PRO',
        warranty: '2 Years Manufacturer Replacement Warranty',
        weight: '3.8 kg',
        deliveryFee: 0,
        estimatedDays: 3,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.8,
        reviewCount: 94,
        images: [
          'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=900&q=80',
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=900&q=80',
        ],
        variants: [
          { name: 'Brushed Stainless Steel', sku: 'SC-ESP-SS', priceAdjustment: 0, stock: 20, attrs: { Finish: 'Stainless Steel' } },
          { name: 'Matte Vintage Black', sku: 'SC-ESP-BLK', priceAdjustment: 500, stock: 15, attrs: { Finish: 'Matte Black' } },
        ],
        specs: [
          { key: 'Brand', value: 'SmartChef' },
          { key: 'Pump Pressure', value: '15-Bar Italian High Pressure' },
          { key: 'Water Tank Capacity', value: '1.5 Litre Removable' },
          { key: 'Steam Wand', value: 'Professional Microfoam Milk Frother' },
          { key: 'Power', value: '1350 Watts Rapid Thermoblock' },
        ],
      },
      {
        categoryId: categoryMap['beauty-care'],
        name: 'GlowRadiance 24K Gold Vitamin C & Hyaluronic Brightening Serum (30ml)',
        slug: 'glowradiance-24k-gold-vitamin-c-serum',
        description: 'A dermatologically tested potent brightening serum infused with 15% pure Ethyl Ascorbic Acid, fermented 24K gold flakes, and multi-molecular Hyaluronic Acid to fade dark spots and boost collagen.',
        basePrice: 1599,
        discountPrice: 799,
        stock: 80,
        brand: 'GlowRadiance',
        model: 'GR-GLD-SERUM-30',
        warranty: '100% Authentic & Dermatologist Tested',
        weight: '85g',
        deliveryFee: 40,
        estimatedDays: 2,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.7,
        reviewCount: 210,
        images: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80',
          'https://images.unsplash.com/photo-1608248597359-bb9943f55098?w=900&q=80',
        ],
        variants: [
          { name: 'Standard 30ml Bottle', sku: 'GR-SERUM-30', priceAdjustment: 0, stock: 50, attrs: { Volume: '30ml' } },
          { name: 'Value Pack 60ml (2 x 30ml)', sku: 'GR-SERUM-60', priceAdjustment: 600, stock: 30, attrs: { Volume: '60ml' } },
        ],
        specs: [
          { key: 'Brand', value: 'GlowRadiance' },
          { key: 'Key Actives', value: '15% Vitamin C, 24K Gold, Hyaluronic Acid, Niacinamide' },
          { key: 'Skin Type', value: 'All Skin Types (Non-comedogenic)' },
          { key: 'Free From', value: 'Parabens, Sulfates, Artificial Fragrance' },
        ],
      },
      {
        categoryId: categoryMap['sports-fitness'],
        name: 'IronGrip 20kg Adjustable Quick-Dial Dumbbell Set with Stand',
        slug: 'irongrip-adjustable-dumbbell-set-20kg',
        description: 'Replaces 10 individual weights in one compact system. Effortlessly adjust between 2kg to 20kg with a single turn of the smooth precision dial. Durable thermoplastic molded plates prevent floor damage.',
        basePrice: 8999,
        discountPrice: 4999,
        stock: 40,
        brand: 'IronGrip',
        model: 'IG-AD20-PAIR',
        warranty: '2 Years Structural Warranty',
        weight: '21 kg',
        deliveryFee: 0,
        estimatedDays: 4,
        isFeatured: 1,
        isDeal: 1,
        rating: 4.9,
        reviewCount: 156,
        images: [
          'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=900&q=80',
          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900&q=80',
        ],
        variants: [
          { name: 'Single 20kg Adjustable Dumbbell + Base', sku: 'IG-20-SGL', priceAdjustment: 0, stock: 20, attrs: { Set: 'Single 20kg' } },
          { name: 'Pair (2 x 20kg = 40kg Total) + Stand', sku: 'IG-40-PAIR', priceAdjustment: 4500, stock: 20, attrs: { Set: 'Pair 40kg' } },
        ],
        specs: [
          { key: 'Brand', value: 'IronGrip' },
          { key: 'Adjustment Range', value: '2kg, 4kg, 8kg, 12kg, 16kg, 20kg' },
          { key: 'Material', value: 'Heavy Duty Cast Iron with Molded Thermoplastic' },
          { key: 'Locking Mechanism', value: 'Dual-Safety Precision Quick Dial' },
        ],
      },
    ];

  for (const prod of products_) {
    const [insertedProduct] = await db
      .insert(products)
      .values({
        sellerId,
        categoryId: prod.categoryId,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        basePrice: prod.basePrice,
        discountPrice: prod.discountPrice,
        stock: prod.stock,
        status: 'ACTIVE',
        brand: prod.brand,
        model: prod.model,
        warranty: prod.warranty,
        weight: prod.weight,
        deliveryFee: prod.deliveryFee,
        estimatedDays: prod.estimatedDays,
        isFeatured: Boolean(prod.isFeatured),
        isDeal: Boolean(prod.isDeal),
        rating: String(prod.rating),
        reviewCount: prod.reviewCount,
      })
      .returning({ id: products.id });

    const productId = insertedProduct.id;

    if (prod.images.length > 0) {
      await db.insert(productImages).values(
        prod.images.map((url, i) => ({
          productId,
          imageUrl: url,
          altText: `${prod.name} image ${i + 1}`,
          displayOrder: i + 1,
          isPrimary: i === 0,
        }))
      );
    }

    if (prod.variants.length > 0) {
      await db.insert(productVariants).values(
        prod.variants.map((v) => ({
          productId,
          variantName: v.name,
          sku: v.sku,
          priceAdjustment: v.priceAdjustment,
          stockCount: v.stock,
          attributesJson: v.attrs,
        }))
      );
    }

    if (prod.specs.length > 0) {
      await db.insert(productSpecifications).values(
        prod.specs.map((s, i) => ({
          productId,
          specKey: s.key,
          specValue: s.value,
          displayOrder: i + 1,
        }))
      );
    }

    if (prod.slug === 'sonicblast-pro-wireless-headphones') {
      await db.insert(reviews).values([
        {
          productId,
          userId: customerUserId,
          rating: 5,
          title: 'Exceptional Sound & Battery Life!',
          comment:
            'I bought these for daily gym and flight commutes. The noise cancellation easily cuts out train and ambient noise. Sound signature is punchy and crisp. Battery lasts almost 2 full weeks!',
          isVerifiedPurchase: true,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ]);

      const [q1] = await db
        .insert(questions)
        .values({
          productId,
          userId: customerUserId,
          questionText: 'Does this support dual device connection (multi-point Bluetooth)?',
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        })
        .returning({ id: questions.id });

      await db.insert(answers).values({
        questionId: q1.id,
        userId: sellerUserId,
        answerText:
          'Yes! You can connect to your laptop and mobile phone simultaneously. It switches automatically when you receive a call.',
        isSellerAnswer: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });

      const [q2] = await db
        .insert(questions)
        .values({
          productId,
          userId: customerUserId,
          questionText: 'Does fast charging work with any standard 20W Type-C adapter?',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        })
        .returning({ id: questions.id });

      await db.insert(answers).values({
        questionId: q2.id,
        userId: sellerUserId,
        answerText: 'Yes, it supports universal Type-C fast charging with any 10W-65W charger.',
        isSellerAnswer: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
    }
  }

  // Seed one past DELIVERED order for John Doe so review-eligibility testing works
  // out of the box (review eligibility requires an order with status = DELIVERED).
  const firstProduct = products_[0];
  const [insertedOrder] = await db
    .insert(orders)
    .values({
      orderNumber: 'ORD-10245',
      userId: customerUserId,
      status: 'DELIVERED',
      subtotal: 1499,
      discount: 0,
      deliveryFee: 40,
      total: 1539,
      shippingAddressSnapshot: {
        fullName: 'John Doe',
        phoneNumber: '+91 9876543210',
        houseBuilding: 'Flat 402, Sunshine Heights',
        streetArea: 'MG Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India',
      },
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      estimatedDeliveryDate: 'Wednesday, Sep 3',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: orders.id });

  const orderId = insertedOrder.id;

  await db.insert(orderItems).values({
    orderId,
    productId: 1,
    variantId: 1,
    productName: firstProduct.name,
    productImage: firstProduct.images[0],
    variantName: 'Matte Obsidian Black',
    unitPrice: 1499,
    quantity: 1,
    totalPrice: 1499,
  });

  const timelineSteps = [
    { status: 'PLACED', title: 'Order Placed', desc: 'Order was successfully verified and confirmed.' },
    { status: 'CONFIRMED', title: 'Payment Confirmed', desc: 'Payment received via UPI.' },
    { status: 'PACKED', title: 'Packed by Seller', desc: 'Item safely packaged with tamper-proof seal.' },
    { status: 'SHIPPED', title: 'Shipped via Express Logistics', desc: 'Tracking #EXPR-88392-IN.' },
    { status: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', desc: 'Courier agent is on the way.' },
    { status: 'DELIVERED', title: 'Delivered', desc: 'Package handed over to customer.' },
  ];

  await db.insert(orderTimeline).values(
    timelineSteps.map((step) => ({
      orderId,
      status: step.status,
      title: step.title,
      description: step.desc,
      completed: true,
      occurredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }))
  );

  console.log('Database seeded successfully with multi-vendor marketplace data!');
}
