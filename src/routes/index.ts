import type { FastifyInstance } from 'fastify';

import { healthRoutes } from './health.js';
import { barrierRoutes } from './barriers.js';

export async function registerRoutes(server: FastifyInstance): Promise<void> {
    await server.register(healthRoutes);
    await server.register(barrierRoutes);
}