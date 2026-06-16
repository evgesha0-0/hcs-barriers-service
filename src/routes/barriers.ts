import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import { db } from '../services/db.js';
import { sendBarrierCommand } from '../services/barrierSocket.js';

export async function barrierRoutes(server: FastifyInstance): Promise<void> {
    //шлагбаумы
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
                is_enabled
            FROM barriers
            ORDER BY name
        `);

        return result.rows.map((row) => ({
            id: row.barrier_id,
            name: row.name,
            address: row.address,
            enabled: row.is_enabled,
        }));
    });

    server.post('/api/barriers', {
        schema: {
            tags: ['Barriers'],
            summary: 'Создание нового шлагбаума',
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    address: { type: 'string' },
                },
                required: ['name', 'address'],
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        enabled: { type: 'boolean' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const body = request.body as {
            name: string;
            address: string;
        };

        const name = body.name.trim();
        const address = body.address.trim();

        if (!name || !address) {
            return reply.status(400).send({
                message: 'name and address are required.',
            });
        }

        const barrierId = randomUUID();

        const result = await db.query(
            `
                INSERT INTO barriers (
                    barrier_id,
                    name,
                    address,
                    is_enabled
                )
                VALUES ($1, $2, $3, TRUE)
                RETURNING
                    barrier_id,
                    name,
                    address,
                    is_enabled
            `,
            [barrierId, name, address]
        );

        const row = result.rows[0];

        return reply.status(201).send({
            id: row.barrier_id,
            name: row.name,
            address: row.address,
            enabled: row.is_enabled,
        });
    });

    server.patch('/api/barriers/:barrierId', {
        schema: {
            tags: ['Barriers'],
            summary: 'Редактирование шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: {
                        type: 'string',
                    },
                },
                required: ['barrierId'],
            },
            body: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                    },
                    address: {
                        type: 'string',
                    },
                    enabled: {
                        type: 'boolean',
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        enabled: { type: 'boolean' },
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
            name?: string;
            address?: string;
            enabled?: boolean;
        };

        const result = await db.query(
            `
                UPDATE barriers
                SET
                    name = COALESCE($1, name),
                    address = COALESCE($2, address),
                    is_enabled = COALESCE($3, is_enabled),
                    updated_at = CURRENT_TIMESTAMP
                WHERE barrier_id = $4
                RETURNING
                    barrier_id,
                    name,
                    address,
                    is_enabled
            `,
            [
                body.name ?? null,
                body.address ?? null,
                body.enabled ?? null,
                barrierId,
            ]
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
        };
    });

    server.delete('/api/barriers/:barrierId', {
        schema: {
            tags: ['Barriers'],
            summary: 'Удаление шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: {
                        type: 'string',
                    },
                },
                required: ['barrierId'],
            },
            response: {
                204: {
                    type: 'null',
                },
                404: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                        },
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
                DELETE FROM barriers
                WHERE barrier_id = $1
                RETURNING barrier_id
            `,
            [barrierId]
        );

        if (!result.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        return reply.status(204).send();
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
                    is_enabled
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
            response: {
                202: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        barrierId: { type: 'string' },
                        action: { type: 'string' },
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
            barrierId,
            action: 'toggle' as const,
        };

        sendBarrierCommand(command);

        return reply.status(202).send({
            message: 'Barrier toggle command has been sent.',
            barrierId,
            action: command.action,
        });
    });

    //номера
    server.get('/api/allowed-numbers', {
        schema: {
            tags: ['Allowed Numbers'],
            summary: 'Получение всех активных разрешённых номеров по всем шлагбаумам',
        },
    }, async () => {
        const result = await db.query(`
            SELECT
                p.permit_id,
                p.plate_number,
                p.owner_name,
                p.comment,
                bp.valid_from,
                bp.valid_until,
                b.barrier_id,
                b.name AS barrier_name
            FROM barrier_permits bp
            JOIN vehicle_access_permits p
                ON p.permit_id = bp.permit_id
            JOIN barriers b
                ON b.barrier_id = bp.access_point_id
            WHERE bp.valid_from <= CURRENT_DATE
              AND bp.valid_until >= CURRENT_DATE
            ORDER BY b.name, p.plate_number
        `);

        return result.rows.map((row) => ({
            id: row.permit_id,
            plateNumber: row.plate_number,
            owner: row.owner_name,
            comment: row.comment,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
            barrierId: row.barrier_id,
            barrierName: row.barrier_name,
        }));
    });

    server.get('/api/barriers/:barrierId/allowed-numbers', {
        schema: {
            tags: ['Allowed Numbers'],
            summary: 'Получение активных разрешённых номеров конкретного шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
        },
    }, async (request, reply) => {
        const { barrierId } = request.params as {
            barrierId: string;
        };

        const barrier = await db.query(
            `
                SELECT barrier_id
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        if (!barrier.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        const result = await db.query(
            `
                SELECT
                    p.permit_id,
                    p.plate_number,
                    p.owner_name,
                    p.comment,
                    bp.valid_from,
                    bp.valid_until
                FROM barrier_permits bp
                JOIN vehicle_access_permits p
                    ON p.permit_id = bp.permit_id
                WHERE bp.access_point_id = $1
                  AND bp.valid_from <= CURRENT_DATE
                  AND bp.valid_until >= CURRENT_DATE
                ORDER BY p.plate_number
            `,
            [barrierId]
        );

        return result.rows.map((row) => ({
            id: row.permit_id,
            plateNumber: row.plate_number,
            owner: row.owner_name,
            comment: row.comment,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
        }));
    });

    server.post('/api/barriers/:barrierId/allowed-numbers', {
        schema: {
            tags: ['Allowed Numbers'],
            summary: 'Добавление разрешённого номера к конкретному шлагбауму',
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
                    allowedNumberId: {
                        type: 'string',
                    },
                    plateNumber: {
                        type: 'string',
                    },
                    ownerName: {
                        type: 'string',
                    },
                    comment: {
                        type: 'string',
                    },
                    validFrom: {
                        type: 'string',
                        format: 'date',
                    },
                    validUntil: {
                        type: 'string',
                        format: 'date',
                    },
                },
                required: [
                    'allowedNumberId',
                    'plateNumber',
                    'ownerName',
                    'validFrom',
                    'validUntil',
                ],
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        barrierId: { type: 'string' },
                        plateNumber: { type: 'string' },
                        ownerName: { type: 'string' },
                        comment: { type: 'string', nullable: true },
                        validFrom: { type: 'string' },
                        validUntil: { type: 'string' },
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
            allowedNumberId: string;
            plateNumber: string;
            ownerName: string;
            comment?: string;
            validFrom: string;
            validUntil: string;
        };

        if (!body.allowedNumberId.trim()) {
            return reply.status(400).send({
                message: 'allowedNumberId is required.',
            });
        }

        if (!body.plateNumber.trim()) {
            return reply.status(400).send({
                message: 'plateNumber is required.',
            });
        }

        if (!body.ownerName.trim()) {
            return reply.status(400).send({
                message: 'ownerName is required.',
            });
        }

        if (body.validUntil < body.validFrom) {
            return reply.status(400).send({
                message: 'validUntil must be greater than or equal to validFrom.',
            });
        }

        const barrier = await db.query(
            `
                SELECT barrier_id
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        if (!barrier.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        const result = await db.query(
            `
                WITH upserted_permit AS (
                    INSERT INTO vehicle_access_permits (
                        permit_id,
                        plate_number,
                        owner_name,
                        comment
                    )
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (plate_number)
                    DO UPDATE SET
                        owner_name = EXCLUDED.owner_name,
                        comment = EXCLUDED.comment,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING
                        permit_id,
                        plate_number,
                        owner_name,
                        comment
                )
                INSERT INTO barrier_permits (
                    access_point_id,
                    permit_id,
                    valid_from,
                    valid_until
                )
                SELECT
                    $5,
                    permit_id,
                    $6,
                    $7
                FROM upserted_permit
                ON CONFLICT (access_point_id, permit_id, valid_from)
                DO UPDATE SET
                    valid_until = EXCLUDED.valid_until
                RETURNING
                    access_point_id,
                    permit_id,
                    valid_from,
                    valid_until
            `,
            [
                body.allowedNumberId,
                body.plateNumber,
                body.ownerName,
                body.comment ?? null,
                barrierId,
                body.validFrom,
                body.validUntil,
            ]
        );

        const row = result.rows[0];

        return reply.status(201).send({
            id: row.permit_id,
            barrierId: row.access_point_id,
            plateNumber: body.plateNumber,
            ownerName: body.ownerName,
            comment: body.comment ?? null,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
        });
    });

    server.delete('/api/allowed-numbers/:allowedNumberId', {
        schema: {
            tags: ['Allowed Numbers'],
            summary: 'Удаление разрешённого номера',
            params: {
                type: 'object',
                properties: {
                    allowedNumberId: { type: 'string' },
                },
                required: ['allowedNumberId'],
            },
            response: {
                204: {
                    type: 'null',
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
        const { allowedNumberId } = request.params as {
            allowedNumberId: string;
        };

        const result = await db.query(
            `
                DELETE FROM vehicle_access_permits
                WHERE permit_id = $1
                RETURNING permit_id
            `,
            [allowedNumberId]
        );

        if (!result.rows[0]) {
            return reply.status(404).send({
                message: 'Allowed number not found.',
            });
        }

        return reply.status(204).send();
    });

    //камеры
    server.get('/api/barriers/:barrierId/cameras', {
        schema: {
            tags: ['Barrier Cameras'],
            summary: 'Получение камер конкретного шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            direction: { type: 'string' },
                            imageId: { type: 'string', nullable: true },
                            enabled: { type: 'boolean' },
                            markup: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                    id: { type: 'string' },
                                    x: { type: 'number' },
                                    y: { type: 'number' },
                                    width: { type: 'number' },
                                    height: { type: 'number' },
                                },
                            },
                        },
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

        const barrier = await db.query(
            `
                SELECT barrier_id
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        if (!barrier.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        const result = await db.query(
            `
                SELECT
                    c.camera_id,
                    c.name,
                    c.direction,
                    c.image_id,
                    c.is_enabled,
                    m.markup_id,
                    m.x,
                    m.y,
                    m.width,
                    m.height
                FROM barrier_cameras c
                LEFT JOIN barrier_camera_markups m
                    ON m.camera_id = c.camera_id
                WHERE c.access_point_id = $1
                ORDER BY c.direction, c.name
            `,
            [barrierId]
        );

        return result.rows.map((row) => ({
            id: row.camera_id,
            name: row.name,
            direction: row.direction,
            imageId: row.image_id,
            enabled: row.is_enabled,
            markup: row.markup_id
                ? {
                    id: row.markup_id,
                    x: row.x,
                    y: row.y,
                    width: row.width,
                    height: row.height,
                }
                : null,
        }));
    });

    server.patch('/api/barriers/:barrierId/cameras/:cameraId/markup', {
        schema: {
            tags: ['Barrier Cameras'],
            summary: 'Сохранение разметки области распознавания для камеры',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                    cameraId: { type: 'string' },
                },
                required: ['barrierId', 'cameraId'],
            },
            body: {
                type: 'object',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                },
                required: ['x', 'y', 'width', 'height'],
            },
        },
    }, async (request, reply) => {
        const { barrierId, cameraId } = request.params as {
            barrierId: string;
            cameraId: string;
        };

        const body = request.body as {
            x: number;
            y: number;
            width: number;
            height: number;
        };

        if (body.width <= 0 || body.height <= 0) {
            return reply.status(400).send({
                message: 'width and height must be greater than 0.',
            });
        }

        const camera = await db.query(
            `
                SELECT camera_id
                FROM barrier_cameras
                WHERE camera_id = $1
                  AND access_point_id = $2
            `,
            [cameraId, barrierId]
        );

        if (!camera.rows[0]) {
            return reply.status(404).send({
                message: 'Camera not found for this barrier.',
            });
        }

        const result = await db.query(
            `
                INSERT INTO barrier_camera_markups (
                    markup_id,
                    camera_id,
                    x,
                    y,
                    width,
                    height
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (camera_id)
                DO UPDATE SET
                    x = EXCLUDED.x,
                    y = EXCLUDED.y,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING
                    markup_id,
                    camera_id,
                    x,
                    y,
                    width,
                    height
            `,
            [
                randomUUID(),
                cameraId,
                body.x,
                body.y,
                body.width,
                body.height,
            ]
        );

        const row = result.rows[0];

        return {
            id: row.markup_id,
            cameraId: row.camera_id,
            x: row.x,
            y: row.y,
            width: row.width,
            height: row.height,
        };
    });

    server.delete('/api/barriers/:barrierId/cameras/:cameraId/markup', {
        schema: {
            tags: ['Barrier Cameras'],
            summary: 'Удаление разметки области распознавания для камеры',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                    cameraId: { type: 'string' },
                },
                required: ['barrierId', 'cameraId'],
            },
            response: {
                204: { type: 'null' },
                404: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { barrierId, cameraId } = request.params as {
            barrierId: string;
            cameraId: string;
        };

        const result = await db.query(
            `
                DELETE FROM barrier_camera_markups m
                USING barrier_cameras c
                WHERE m.camera_id = c.camera_id
                  AND c.camera_id = $1
                  AND c.access_point_id = $2
                RETURNING m.markup_id
            `,
            [cameraId, barrierId]
        );

        if (!result.rows[0]) {
            return reply.status(404).send({
                message: 'Camera markup not found.',
            });
        }

        return reply.status(204).send();
    });

    //распознования
    server.get('/api/barrier-recognitions', {
        schema: {
            tags: ['Barrier Recognitions'],
            summary: 'Получение истории распознаваний по всем шлагбаумам',
            querystring: {
                type: 'object',
                properties: {
                    result: {
                        type: 'string',
                        enum: ['allowed', 'denied'],
                    },
                    plateNumber: {
                        type: 'string',
                    },
                },
            },
        },
    }, async (request) => {
        const query = request.query as {
            result?: string;
            plateNumber?: string;
        };

        const conditions: string[] = [];
        const values: unknown[] = [];

        if (query.result) {
            values.push(query.result);
            conditions.push(`e.result = $${values.length}`);
        }

        if (query.plateNumber) {
            values.push(`%${query.plateNumber}%`);
            conditions.push(`e.plate_number ILIKE $${values.length}`);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const result = await db.query(
            `
                SELECT
                    e.recognition_event_id,
                    e.access_point_id AS barrier_id,
                    b.name AS barrier_name,
                    e.camera_id,
                    c.name AS camera_name,
                    e.permit_id,
                    e.plate_number,
                    e.result,
                    e.image_url,
                    e.occurred_at
                FROM vehicle_recognition_events e
                JOIN barriers b
                    ON b.barrier_id = e.access_point_id
                JOIN barrier_cameras c
                    ON c.camera_id = e.camera_id
                ${whereClause}
                ORDER BY e.occurred_at DESC
            `,
            values
        );

        return result.rows.map((row) => ({
            id: row.recognition_event_id,
            barrierId: row.barrier_id,
            barrierName: row.barrier_name,
            cameraId: row.camera_id,
            cameraName: row.camera_name,
            permitId: row.permit_id,
            plateNumber: row.plate_number,
            result: row.result,
            imageUrl: row.image_url,
            occurredAt: row.occurred_at,
        }));
    });

    server.get('/api/barriers/:barrierId/recognitions', {
        schema: {
            tags: ['Barrier Recognitions'],
            summary: 'Получение истории распознаваний конкретного шлагбаума',
            params: {
                type: 'object',
                properties: {
                    barrierId: { type: 'string' },
                },
                required: ['barrierId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    result: {
                        type: 'string',
                        enum: ['allowed', 'denied'],
                    },
                    plateNumber: {
                        type: 'string',
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { barrierId } = request.params as {
            barrierId: string;
        };

        const query = request.query as {
            result?: string;
            plateNumber?: string;
        };

        const barrier = await db.query(
            `
                SELECT barrier_id
                FROM barriers
                WHERE barrier_id = $1
            `,
            [barrierId]
        );

        if (!barrier.rows[0]) {
            return reply.status(404).send({
                message: 'Barrier not found.',
            });
        }

        const conditions: string[] = ['e.access_point_id = $1'];
        const values: unknown[] = [barrierId];

        if (query.result) {
            values.push(query.result);
            conditions.push(`e.result = $${values.length}`);
        }

        if (query.plateNumber) {
            values.push(`%${query.plateNumber}%`);
            conditions.push(`e.plate_number ILIKE $${values.length}`);
        }

        const result = await db.query(
            `
                SELECT
                    e.recognition_event_id,
                    e.camera_id,
                    c.name AS camera_name,
                    e.permit_id,
                    e.plate_number,
                    e.result,
                    e.image_url,
                    e.occurred_at
                FROM vehicle_recognition_events e
                JOIN barrier_cameras c
                    ON c.camera_id = e.camera_id
                WHERE ${conditions.join(' AND ')}
                ORDER BY e.occurred_at DESC
            `,
            values
        );

        return result.rows.map((row) => ({
            id: row.recognition_event_id,
            cameraId: row.camera_id,
            cameraName: row.camera_name,
            permitId: row.permit_id,
            plateNumber: row.plate_number,
            result: row.result,
            imageUrl: row.image_url,
            occurredAt: row.occurred_at,
        }));
    });
}