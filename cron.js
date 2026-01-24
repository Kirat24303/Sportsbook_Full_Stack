const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CHECK_INTERVAL = 60 * 1000;

async function expireProjectorBookings() {
    try {
        const now = new Date();
        const currentDate = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
        const currentTime = now.toTimeString().split(" ")[0];

        const activeBookings = await prisma.booking.findMany({
            where: {
                status: 'active',
                OR: [
                    { date: { lt: currentDate } },
                    {
                        AND: [
                            { date: currentDate },
                            { endTime: { lte: currentTime } }
                        ]
                    }
                ]
            }
        });

        if (activeBookings.length === 0) return;

        console.log(`[Cron] Found ${activeBookings.length} bookings to expire at ${now.toLocaleString()}`);

        for (const booking of activeBookings) {
            try {
                await prisma.$transaction(async (tx) => {
                    const sport = await tx.sport.findFirst({
                        where: { name: booking.sportName }
                    });
                    if (!sport) {
                        console.error(`[Cron] Associated sport ${booking.sportName} not found for booking ${booking.id}`);
                        return;
                    }
                    await tx.booking.update({
                        where: { id: booking.id },
                        data: { status: 'expired' }
                    });
                    const courtNo = booking.courtNo;
                    let newCourtData = Array.isArray(sport.courtData) ? [...sport.courtData] : [];

                    const targetIndex = parseInt(courtNo) - 1;
                    if (targetIndex >= 0 && targetIndex < newCourtData.length) {
                        const courtEntry = newCourtData[targetIndex];
                        const name = courtEntry.split(':')[0];
                        newCourtData[targetIndex] = `${name}:0`;
                        console.log(`[Cron] Releasing ${name} for ${sport.name}`);
                    }
                    const issuedEq = booking.issuedEquipments || [];
                    let currentEqInUse = Array.isArray(sport.equipmentsInUse) ? [...sport.equipmentsInUse] : [];

                    issuedEq.forEach(issued => {
                        const [name, countStr] = issued.split(':');
                        const issuedCount = parseInt(countStr);

                        const eqIndex = currentEqInUse.findIndex(eq => eq.startsWith(name + ':'));
                        if (eqIndex !== -1) {
                            const [eqName, eqCountStr] = currentEqInUse[eqIndex].split(':');
                            const currentUsed = parseInt(eqCountStr);
                            const updatedUsed = Math.max(0, currentUsed - issuedCount);
                            currentEqInUse[eqIndex] = `${eqName}:${updatedUsed}`;
                            console.log(`[Cron] Returning ${issuedCount} ${eqName}. (In use: ${currentUsed} -> ${updatedUsed})`);
                        }
                    });
                    await tx.sport.update({
                        where: { id: sport.id },
                        data: {
                            courtsInUse: Math.max(0, (sport.courtsInUse || 0) - 1),
                            numPlayers: Math.max(0, (sport.numPlayers || 0) - (booking.numberOfPlayers || 0)),
                            courtData: newCourtData,
                            equipmentsInUse: currentEqInUse
                        }
                    });
                    console.log(`[Cron] Finalized resource release for ${sport.name} booking ${booking.id}`);
                });
                if (global.io) {
                    global.io.emit('OCCUPANCY_UPDATE', {
                        timestamp: Date.now(),
                        source: 'cron-expiration'
                    });
                }
            } catch (err) {
                console.error(`[Cron] Failed to expire booking ${booking.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[Cron] Error in expiration task:', error);
    }
}

function initCron() {
    console.log('[Cron] Initializing booking expiration task...');
    setInterval(expireProjectorBookings, CHECK_INTERVAL);
    expireProjectorBookings();
}

module.exports = { initCron };
