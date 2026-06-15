import type { FastifyInstance } from 'fastify';

import { db } from '../services/db.js';

import { sendBarrierCommand } from '../services/barrierSocket.js';

export async function barrierRoutes(server: FastifyInstance): Promise<void> {
    server.get('/api/barriers', {
        schema: {
            tags: ['Barriers'],
            summary: 'Получение списка шлагбаумов',
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            address: { type: 'string' },
                            enabled: { type: 'boolean' },
                            currentState: { type: 'string' },
                            stateUntil: { type: 'string', nullable: true },
                        },
                    },
                },
            },
        },
    }, async () => {
        const result = await db.query(`
            SELECT
                barrier_id,
                name,
                address,
                is_enabled,
                current_state,
                state_until
            FROM barriers
            ORDER BY name
        `);

        return result.rows.map((row) => ({
            id: row.barrier_id,
            name: row.name,
            address: row.address,
            enabled: row.is_enabled,
            currentState: row.current_state,
            stateUntil: row.state_until,
        }));
    });
         server.get('/api/barriers/:barrierId', {
        schema: {
            tags: ['Barriers'],
            summary: 'Получение данных конкретного шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        enabled: { type: 'boolean' },
                        currentState: { type: 'string' },
                        stateUntil: { type: 'string', nullable: true },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { barrierId } = request.params as {
            barrierId: string;
        };

        const result = await db.query(
            `
                SELECT
                    barrier_id,
                    name,
                    address,
                    is_enabled,
                    current_state,
                    state_until
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        const row = result.rows[0];

        if (!row) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        return {
            id: row.barrier_id,
            name: row.name,
            address: row.address,
            enabled: row.is_enabled,
            currentState: row.current_state,
            stateUntil: row.state_until,
        };
    });
        server.get('/api/barriers/:barrierId/status', {
        schema: {
            tags: ['Barrier Status'],
            summary: 'Получение текущего состояния шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        currentState: { type: 'string' },
                        stateUntil: { type: 'string', nullable: true },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { barrierId } = request.params as {
            barrierId: string;
        };

        const result = await db.query(
            `
                SELECT
                    current_state,
                    state_until
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        const row = result.rows[0];

        if (!row) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        return {
            currentState: row.current_state,
            stateUntil: row.state_until,
        };
    });

               server.post('/api/barriers/:barrierId/commands', {
        schema: {
            tags: ['Barrier Commands'],
            summary: 'Отправка команды переключения состояния шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
            body: {
                type: 'object',
                properties: {
                    device_id: {
                        type: 'string',
                    },
                },
                required: ['device_id'],
            },
            response: {
                202: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        barrierId: { type: 'string' },
                        deviceId: { type: 'string' },
                        action: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { barrierId } = request.params as {
            barrierId: string;
        };

        const body = request.body as {
            device_id: string;
        };

        if (!body.device_id.trim()) {
            return reply.status(400).send({
                message: 'device_id is required.',
            });
        }

        const existingBarrier = await db.query(
            `
                SELECT barrier_id
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        if (!existingBarrier.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        const command = {
            deviceId: body.device_id,
            barrierId,
            action: 'toggle' as const,
        };

        sendBarrierCommand(command);

        return reply.status(202).send({
            message: 'Barrier toggle command has been sent.',
            barrierId,
            deviceId: body.device_id,
            action: command.action,
        });
    });

}