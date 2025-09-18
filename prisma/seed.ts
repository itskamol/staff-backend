/* eslint-disable no-console */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create a super admin user
    const hashedPassword = await bcrypt.hash('admin', 12);

    const superAdmin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: hashedPassword,
            role: Role.ADMIN,
            name: 'Super Administrator',
            isActive: true,
        },
    });

    console.log('✅ Created super admin user:', superAdmin.username);

    console.log('🎉 Database seed completed successfully!');
}

main()
    .catch(e => {
        console.error('❌ Error during database seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
