/**
 * Seed dummy orders for a storefront customer so the invoice + multi-address
 * flows can be tested BEFORE the Razorpay gateway is live.
 *
 * It creates (all owned by one customer, keyed by email so they survive login):
 *   • the customer (if missing) + 2 saved addresses (so checkout has an address book)
 *   • 1 single-address order  (PLACED) — ships to the customer's own address
 *   • 1 multi-address order   (PLACED) — one order split across 2 recipient
 *                                        addresses, per-item quantity mapping
 *
 * Run (CRM dev server STOPPED, schema synced with `npx prisma db push` first):
 *   npx ts-node prisma/seed-test-orders.ts [email]
 *   # defaults to sakshi@olioglobaladtech.com — pass the email you log in with.
 */
import * as dotenv from "dotenv";
import * as crypto from "crypto";
import { PrismaClient, OrderStatus, PaymentMode } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const embeddedGst = (inclusive: number) => round2(inclusive - inclusive / 1.18);
const orderNo = () => `ORD-TEST-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;

async function main() {
  const email = (process.argv[2] || "sakshi@olioglobaladtech.com").toLowerCase();

  // 1. Customer (reused by OTP login via findOrCreateCustomer → same id).
  const customer = await prisma.customer.upsert({
    where: { email },
    update: {},
    create: {
      name: "Test Customer",
      email,
      // OTP-only login; password column is required but never used here.
      password: "seed-placeholder-not-usable",
      uniqueId: crypto.randomUUID(),
      status: true,
    },
  });
  console.log(`👤 Customer #${customer.id} <${customer.email}>`);

  // 2. Saved address book (only if the customer has none yet).
  const existingAddrs = await prisma.customerAddress.count({
    where: { customerId: customer.id },
  });
  if (existingAddrs === 0) {
    await prisma.customerAddress.createMany({
      data: [
        {
          customerId: customer.id,
          name: "Test Customer",
          phoneNumber: "9876500001",
          email,
          streetAddress: "402, Sunrise Apartments, Linking Road",
          landmarks: "Opp. HDFC Bank",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          pincode: "400050",
          isDefault: true,
          addressType: "Home",
        },
        {
          customerId: customer.id,
          name: "Test Customer (Office)",
          phoneNumber: "9876500002",
          email,
          streetAddress: "7th Floor, Tech Park, SV Road",
          landmarks: "Near Metro Station",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          pincode: "400064",
          isDefault: false,
          addressType: "Work",
        },
      ],
    });
    console.log("🏠 Added 2 saved addresses");
  } else {
    console.log(`🏠 Customer already has ${existingAddrs} saved address(es) — left as-is`);
  }

  // 3. Products to build order lines from.
  const variations = await prisma.productVariation.findMany({
    take: 2,
    include: { product: true },
  });
  if (variations.length === 0) {
    console.error("❌ No products found. Add a product (or run the catalog seed) first, then re-run.");
    return;
  }
  const vA = variations[0];
  const vB = variations[1] ?? variations[0]; // fall back to the same product if only one exists
  const priceOf = (v: typeof vA) => Number(v.specialPrice ?? v.price) || 999;

  // ── Order 1: single address, one line, with a personalisation ──────────────
  {
    const unit = priceOf(vA);
    const qty = 1;
    const total = round2(unit * qty);
    const on = orderNo();
    const personalization = { text: "Happy Birthday, Anaya!", font: "Great Vibes", image: null, fee: 0 };
    const o = await prisma.orderMaster.create({
      data: {
        custName: "Test Customer",
        custEmail: email,
        custNumber: "9876500001",
        customerId: customer.id,
        streetAddress: "402, Sunrise Apartments, Linking Road",
        landmarks: "Opp. HDFC Bank",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        pincode: "400050",
        addressType: "Home",
        orderNumber: on,
        orderDate: new Date(),
        itemTotal: total,
        deliveryFee: 0,
        gstCharges: embeddedGst(total),
        grandtotal: total,
        razorpayTransactionAmount: total,
        orderStatus: OrderStatus.PLACED,
        paymentMode: PaymentMode.RAZORPAY,
        paymentStatus: "Paid",
        paymentMethod: "Razorpay (test)",
        razorpayOrderId: `order_TEST${Date.now()}A`,
        razorpayPaymentId: `pay_TEST${Date.now()}A`,
        orderDetails: {
          create: [
            {
              productId: vA.productId,
              variationId: vA.id,
              productName: vA.product.productName,
              sku: vA.sku,
              attributes: { personalization },
              quantity: qty,
              subOrderNumber: `SUB-${on}-1`,
              unitPrice: round2(unit / 1.18),
              priceWithGst: unit,
              total,
              deliveryFee: 0,
              gstCharges: embeddedGst(total),
              orderStatus: OrderStatus.PLACED,
            },
          ],
        },
      },
    });
    console.log(`✅ Single-address order ${on} (id ${o.id}) — ${vA.product.productName} ×${qty}`);
  }

  // ── Order 2: ONE order split across TWO recipient addresses ────────────────
  // vA qty 2 → 1 to Meera, 1 to Ravi. (This is the multi-address / gifting flow.)
  {
    const unit = priceOf(vA);
    const line1 = round2(unit * 1);
    const line2 = round2(unit * 1);
    const itemTotal = round2(line1 + line2);
    const on = orderNo();
    const recipients = [
      {
        name: "Meera Nair", phone: "9812300001",
        street: "18 Rose Villa, Bandra West", landmarks: "Near Carter Road",
        city: "Mumbai", state: "Maharashtra", pincode: "400050",
      },
      {
        name: "Ravi Kumar", phone: "9812300002",
        street: "221B MG Road, Indiranagar", landmarks: "Above Cafe Coffee Day",
        city: "Bengaluru", state: "Karnataka", pincode: "560038",
      },
    ];
    const o = await prisma.orderMaster.create({
      data: {
        custName: "Test Customer",
        custEmail: email,
        custNumber: "9876500001",
        customerId: customer.id,
        // OrderMaster carries the FIRST recipient as the primary/billing address.
        streetAddress: recipients[0].street,
        landmarks: recipients[0].landmarks,
        city: recipients[0].city,
        state: recipients[0].state,
        country: "India",
        pincode: recipients[0].pincode,
        addressType: null,
        orderNumber: on,
        orderDate: new Date(),
        itemTotal,
        deliveryFee: 0,
        gstCharges: embeddedGst(itemTotal),
        grandtotal: itemTotal,
        razorpayTransactionAmount: itemTotal,
        orderStatus: OrderStatus.PLACED,
        paymentMode: PaymentMode.RAZORPAY,
        paymentStatus: "Paid",
        paymentMethod: "Razorpay (test)",
        razorpayOrderId: `order_TEST${Date.now()}B`,
        razorpayPaymentId: `pay_TEST${Date.now()}B`,
        orderDetails: {
          create: recipients.map((r, i) => ({
            productId: vA.productId,
            variationId: vA.id,
            productName: vA.product.productName,
            sku: vA.sku,
            attributes: { personalization: null },
            quantity: 1,
            subOrderNumber: `SUB-${on}-S${i + 1}-1`,
            deliveryName: r.name,
            deliveryPhone: r.phone,
            deliveryStreet: r.street,
            deliveryLandmarks: r.landmarks,
            deliveryCity: r.city,
            deliveryState: r.state,
            deliveryPincode: r.pincode,
            unitPrice: round2(unit / 1.18),
            priceWithGst: unit,
            total: round2(unit * 1),
            deliveryFee: 0,
            gstCharges: embeddedGst(round2(unit * 1)),
            orderStatus: OrderStatus.PLACED,
          })),
        },
      },
    });
    console.log(
      `✅ Multi-address order ${on} (id ${o.id}) — ${vA.product.productName} ×2 split: Meera (Mumbai) + Ravi (Bengaluru)`,
    );
  }

  console.log("\n🎉 Done. Log in on the storefront with this email to see both orders under My Orders,");
  console.log("   and open them in the CRM → Orders to test the invoice + per-line 'Ship to' display.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
