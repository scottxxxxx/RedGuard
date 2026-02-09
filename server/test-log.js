const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const log = await prisma.apiLog.create({
        data: {
            logType: 'llm_evaluate',
            method: 'POST',
            endpoint: 'http://test-endpoint.com',
            statusCode: 200,
            totalTokens: 1234,
            provider: 'test-provider',
            model: 'test-model'
        }
    });
    console.log('Created test log:', log);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
