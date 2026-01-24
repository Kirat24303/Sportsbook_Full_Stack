const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function inspect() {
    try {
        const sport = await prisma.sport.findUnique({ where: { name: 'Badminton' } });
        console.log('--- Badminton Sport ---');
        console.log(JSON.stringify(sport, null, 2));

        const booking = await prisma.booking.findUnique({
            where: { id: '3dd77feb-91d0-4907-bd4b-8f5d7e23fda7' }
        });
        console.log('\n--- Expired Booking ---');
        console.log(JSON.stringify(booking, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
