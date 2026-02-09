const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const logs = await prisma.apiLog.findMany({
        where: { logType: 'llm_evaluate' },
        orderBy: { timestamp: 'desc' },
        take: 3
    });
    console.log('Recent llm_evaluate logs:');
    logs.forEach(l => {
        console.log(`ID: ${l.id}, Tokens: ${l.totalTokens}, Provider: ${l.provider}, Model: ${l.model}, Time: ${l.timestamp}`);
    });

    const stats = await prisma.apiLog.aggregate({
        _sum: { totalTokens: true }
    });
    console.log('\nTotal Tokens Sum:', stats._sum.totalTokens);
}

check()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
