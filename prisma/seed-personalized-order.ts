/**
 * Insert ONE test order with a fully-filled personalisation, so the CRM order
 * detail page can be tested before the payment gateway is live.
 *
 * Run:  npx ts-node prisma/seed-personalized-order.ts
 * (Requires at least one product + variation in the DB, and the schema synced:
 *  `npx prisma db push` first if you hit a "column does not exist" error.)
 */
import * as dotenv from "dotenv";
import { PrismaClient, OrderStatus, PaymentMode } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function main() {
  const variation = await prisma.productVariation.findFirst({
    include: { product: true },
  });
  if (!variation) {
    console.error(
      "❌ No products found. Add a product in the CRM (or run `npm run db:seed:catalog`) first, then re-run.",
    );
    return;
  }

  const qty = 2;
  const unitInclusive = Number(variation.specialPrice ?? variation.price) || 999;
  const lineTotal = round2(unitInclusive * qty);
  const gst = round2(lineTotal - lineTotal / 1.18);
  const orderNumber = `ORD-TEST-${Date.now().toString(36).toUpperCase()}`;

  // A fully-filled personalisation — exactly the shape the storefront sends.
  const personalization = {
    text: "Ravi & Meera",
    font: "Great Vibes",
    image: "https://picsum.photos/seed/plattera-personalization/800/600",
    fee: 150,
  };

  const order = await prisma.orderMaster.create({
    data: {
      custName: "Ravi Sharma",
      custEmail: "ravi.test@example.com",
      custNumber: "9876543210",
      streetAddress: "12 MG Road, Fort",
      landmarks: "Near Flora Fountain",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400001",
      addressType: "Home",
      orderNumber,
      orderDate: new Date(),
      itemTotal: lineTotal,
      deliveryFee: 0,
      gstCharges: gst,
      grandtotal: lineTotal,
      razorpayTransactionAmount: lineTotal,
      orderStatus: OrderStatus.PLACED,
      paymentMode: PaymentMode.RAZORPAY,
      paymentStatus: "Paid",
      paymentMethod: "Razorpay (test)",
      razorpayOrderId: `order_TEST${Date.now()}`,
      razorpayPaymentId: `pay_TEST${Date.now()}`,
      orderDetails: {
        create: [
          {
            productId: variation.productId,
            variationId: variation.id,
            productName: variation.product.productName,
            sku: variation.sku,
            attributes: { personalization },
            quantity: qty,
            subOrderNumber: `SUB-${orderNumber}-1`,
            unitPrice: round2(unitInclusive / 1.18),
            priceWithGst: unitInclusive,
            total: lineTotal,
            deliveryFee: 0,
            gstCharges: gst,
            orderStatus: OrderStatus.PLACED,
            weight: variation.weight,
            weightUnit: variation.weightUnit,
            length: variation.length,
            width: variation.width,
            height: variation.height,
            dimensionUnit: variation.dimensionUnit,
          },
        ],
      },
    },
  });

  console.log(`✅ Test order created: ${orderNumber} (id ${order.id})`);
  console.log(`   Product: ${variation.product.productName} × ${qty}`);
  console.log(
    `   Personalisation → text: "${personalization.text}", font: ${personalization.font}, image: ${personalization.image}`,
  );
  console.log("   Open it in CRM → Orders to see the Personalisation block.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
