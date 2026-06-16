import type { Server as HttpServer } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

type BarrierCommandPayload = {
    barrierId: string;
    action: 'toggle';
};

let io: SocketIOServer | null = null;

export function initBarrierSocketServer(httpServer: HttpServer): void {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
        },
    });

    io.on('connection', (socket) => {
        console.log(`Socket.IO client connected: ${socket.id}`);

        socket.on('disconnect', (reason) => {
            console.log(
                `Socket.IO client disconnected: ${socket.id}. Reason: ${reason}`
            );
        });
    });

    console.log('Socket.IO server initialized');
}

export function sendBarrierCommand(payload: BarrierCommandPayload): void {
    if (!io) {
        throw new Error('Socket.IO server is not initialized.');
    }

    console.log('Sending barrier command to connected clients:', payload);

    io.emit('barrier-command', payload);
}