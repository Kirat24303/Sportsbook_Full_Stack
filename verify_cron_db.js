const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createExpiredBooking() {
    try {
        // 1. Get a user
        const user = await prisma.user.findFirst();
        if (!user) {
            console.error('No user found to assign booking to.');
            process.exit(1);
        }

        // 2. Get Badminton sport
        const sport = await prisma.sport.findUnique({ where: { name: 'Badminton' } });
        if (!sport) {
            console.error('Badminton sport not found.');
            process.exit(1);
        }

        // 3. Create a booking that expired 10 minutes ago
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const dateStr = tenMinsAgo.toLocaleDateString('en-CA');
        const timeStr = tenMinsAgo.toTimeString().split(' ')[0];

        const booking = await prisma.booking.create({
            data: {
                userId: user.id,
                sportName: sport.name,
                courtNo: '1',
                numberOfPlayers: 2,
                issuedEquipments: ['Racket:2'],
                startTime: '00:00:00',
                endTime: timeStr,
                date: dateStr,
                status: 'active',
                scanned: true
            }
        });

        // 4. Update sport to reflect the booking
        // (Simulate an active booking state)
        let newEqInUse = sport.equipmentsInUse || [];
        // Update Racket count
        let found = false;
        newEqInUse = newEqInUse.map(eq => {
            if (eq.startsWith('Racket:')) {
                const count = parseInt(eq.split(':')[1]);
                found = true;
                return `Racket:${count + 2}`;
            }
            return eq;
        });
        if (!found) newEqInUse.push('Racket:2');

        await prisma.sport.update({
            where: { id: sport.id },
            data: {
                courtsInUse: { increment: 1 },
                numPlayers: { increment: 2 },
                equipmentsInUse: newEqInUse
            }
        });

        console.log(`Created expired booking ${booking.id} for user ${user.name}`);
        process.exit(0);
    } catch (err) {
        console.error('Failed to create expired booking:', err);
        process.exit(1);
    }
}

createExpiredBooking();
