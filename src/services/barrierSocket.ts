import { io } from 'socket.io-client';

type BarrierCommandPayload = {
    deviceId: string;
    barrierId: string;
    action: 'toggle';
};

const socketUrl = process.env.BARRIER_COMMAND_SOCKET_URL;

if (!socketUrl) {
    throw new Error('BARRIER_COMMAND_SOCKET_URL is required.');
}

const socket = io(socketUrl, {
    autoConnect: true,
    reconnection: true,
    transports: ['websocket'],
});

socket.on('connect', () => {
    console.log(`Socket.IO connected: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
    console.log(`Socket.IO disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error.message);
});

export function sendBarrierCommand(payload: BarrierCommandPayload): void {
    console.log('Sending barrier command:', payload);

    socket.emit('barrier-command', payload);
}