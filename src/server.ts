import Fastify from 'fastify';
import dotenv from 'dotenv';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { registerRoutes } from './routes/index.js';

dotenv.config();

const server = Fastify({
    logger: true,
});

await server.register(swagger, {
    openapi: {
        info: {
            title: 'HCS Barriers Service',
            description: 'API сервиса шлагбаумов',
            version: '1.0.0',
        },
    },
});

await server.register(swaggerUi, {
    routePrefix: '/docs',
});

await registerRoutes(server);

const start = async (): Promise<void> => {
    try {
        await server.listen({
            port: Number(process.env.PORT),
            host: '0.0.0.0',
        });

        console.log(`Server started on port ${process.env.PORT}`);
    } catch (error) {
        server.log.error(error);
        process.exit(1);
    }
};

start();