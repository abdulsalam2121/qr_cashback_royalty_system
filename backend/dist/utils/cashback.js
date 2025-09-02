export async function calculateCashback(amountCents, category, customerTier, tenantId, tx) {
    // Get base cashback rate for category
    const cashbackRule = await tx.cashbackRule.findFirst({
        where: {
            tenantId,
            category,
            isActive: true,
            OR: [
                { startAt: null, endAt: null },
                {
                    AND: [
                        { OR: [{ startAt: null }, { startAt: { lte: new Date() } }] },
                        { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }
                    ]
                }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });
    if (!cashbackRule) {
        return 0;
    }
    // Get tier multiplier
    const tierRule = await tx.tierRule.findFirst({
        where: {
            tenantId,
            tier: customerTier,
            isActive: true,
        }
    });
    const baseRateBps = cashbackRule.baseRateBps;
    const tierMultiplierBps = tierRule?.baseRateBps || 0;
    // Calculate total rate (base + tier, capped at 20%)
    const totalRateBps = Math.min(baseRateBps + tierMultiplierBps, 2000);
    // Check for active offers
    const activeOffers = await tx.offer.findMany({
        where: {
            tenantId,
            isActive: true,
            startAt: { lte: new Date() },
            endAt: { gte: new Date() },
        }
    });
    let offerMultiplierBps = 0;
    for (const offer of activeOffers) {
        offerMultiplierBps += offer.rateMultiplierBps;
    }
    // Apply offer multipliers (capped at total 50%)
    const finalRateBps = Math.min(totalRateBps + offerMultiplierBps, 5000);
    // Calculate cashback in cents
    const cashbackCents = Math.floor((amountCents * finalRateBps) / 10000);
    return Math.max(0, cashbackCents);
}
//# sourceMappingURL=cashback.js.map