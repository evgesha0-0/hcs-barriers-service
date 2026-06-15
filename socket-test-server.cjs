const { Server } = require('socket.io');

const io = new Server(4000, {
    cors: {
        origin: '*',
    },
});

console.log('Socket.IO test server started on http://localhost:4000');

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('barrier-command', (payload) => {
        console.log('Received barrier-command:');
        console.log(payload);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});