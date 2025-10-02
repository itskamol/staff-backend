import 'dotenv/config';
import path from 'node:path';
import type { PrismaConfig } from 'prisma';

export default {
    schema: path.join(process.cwd(), 'shared', 'database', 'prisma', 'models'),
} satisfies PrismaConfig;
