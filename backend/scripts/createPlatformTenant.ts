import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let platformTenant = await prisma.tenant.findUnique({ where: { slug: "platform" } });

  if (platformTenant) {
    return;
  }

  platformTenant = await prisma.tenant.create({
    data: {
      name: "Platform",
      slug: "platform",
      subscriptionStatus: "ACTIVE",
      freeTrialActivations: 0,
      freeTrialLimit: 0,
      trialExpiredNotified: false,
    },
  });

}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
