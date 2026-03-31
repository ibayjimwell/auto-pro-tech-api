import { Server } from 'socket.io';

let ioInstance = null;

export const initWebsocket = (httpServer) => {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('WebSocket connected:', socket.id);

    socket.on('joinRoom', ({ appointmentId }) => {
      if (!appointmentId) {
        socket.emit('error', { message: 'appointmentId is required to join room.' });
        return;
      }
      const roomName = `appointment:${appointmentId}`;
      socket.join(roomName);
      socket.emit('joinedRoom', { room: roomName });
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on('leaveRoom', ({ appointmentId }) => {
      if (!appointmentId) return;
      const roomName = `appointment:${appointmentId}`;
      socket.leave(roomName);
      socket.emit('leftRoom', { room: roomName });
      console.log(`Socket ${socket.id} left room ${roomName}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', socket.id, reason);
    });
  });

  ioInstance = io;
  return io;
};

export const getIo = () => {
  if (!ioInstance) {
    throw new Error('Socket.io instance is not initialized yet.');
  }
  return ioInstance;
};