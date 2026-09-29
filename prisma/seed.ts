import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // TEMP (local dev convenience): admin login. Also reset on re-seed so local
  // login always works. Do NOT run this seed against production — it would reset
  // the admin password. Rotate this before go-live.
  const hashedPassword = await bcrypt.hash("admin@123", 12);

  await prisma.user.upsert({
    where: { email: "admin@crm.com" },
    update: { password: hashedPassword },
    create: {
      name: "Super Admin",
      email: "admin@crm.com",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email: "admin@crm.com",
      deliveryFee: 50,
      defaultDeliveryFee: 50,
    },
  });

  const cancellationReasons = [
    "Changed my mind",
    "Found a better price elsewhere",
    "Ordered by mistake",
    "Delivery time too long",
    "Product no longer needed",
  ];

  for (const reason of cancellationReasons) {
    await prisma.cancellationReason.create({
      data: { reason, status: true },
    });
  }

  const returnReasons = [
    "Defective product",
    "Wrong item delivered",
    "Product not as described",
    "Damaged during shipping",
    "Changed my mind",
  ];

  for (const reason of returnReasons) {
    await prisma.returnReason.create({
      data: { reason, status: true },
    });
  }

  console.log("✅ Seed complete");
  console.log("   Admin: admin@crm.com / admin@123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());