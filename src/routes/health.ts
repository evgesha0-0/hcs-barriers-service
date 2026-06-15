import type { FastifyInstance } from 'fastify';

import { db } from '../services/db.js';

export async function healthRoutes(server: FastifyInstance): Promise<void> {
    server.get('/health', async () => {
        return {
            status: 'ok',
        };
    });

    server.get('/db-check', async () => {
        const result = await db.query('SELECT current_database()');

        return {
            database: result.rows[0].current_database,
        };
    });
}