const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
    const log = await prisma.apiLog.findUnique({
        where: { id: '25fe19b1-6cd1-4bf7-8480-18cd4aa3d6ac' }
    });
    console.log('Log Details:');
    console.log('Log Type:', log.logType);
    console.log('Provider:', log.provider);
    console.log('Status Code:', log.statusCode);
    console.log('Total Tokens:', log.totalTokens);
    console.log('Response Body Length:', log.responseBody?.length);

    try {
        const body = JSON.parse(log.responseBody);
        console.log('Full Response Body:', JSON.stringify(body, null, 2));
    } catch (e) {
        console.log('Raw Response Body:', log.responseBody);
    }
}

inspect()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
