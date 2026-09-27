import { Server } from 'socket.io';
import logger from '../utils/logger.utils.js';
import { canJoinRoom } from './socketRoomPolicy.js';
import { initRoleSocket } from '../features/role/role.socket.js';
import { initUserSocket } from '../features/user/user.socket.js';
import { setupPaymentSocketListeners } from '../features/payment/payment.socket.js';
import { setupWalletSocketListeners } from '../features/wallet/wallet.socket.js';
import { initComplaintSockets } from '../features/complaint/complaint.socket.js';
import { initAmenitySockets } from '../features/amenity/amenity.socket.js';
import { initAmenityBookingSockets } from '../features/amenityBooking/amenityBooking.socket.js';
import { initCommunityNoteSockets } from '../features/communityNote/communityNote.socket.js';
import { initDirectoryMessageSockets } from '../features/directoryMessage/directoryMessage.socket.js';
import { initOrganizationSocket } from '../features/organization/organization.socket.js';

let io = null;

/**
 * Initializes the Socket.io server.
 * @param {import('http').Server} httpServer - The HTTP/HTTPS server instance
 * @returns {Server} The initialized Socket.io Server instance
 */
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export const initSocket = async (httpServer) => {
  if (io) {
    logger.warn('Socket.io server already initialized.');
    return io;
  }

  // Parse ALLOWED_ORIGINS or CLIENT_URL for CORS. Defaults to frontend/mobile default ports.
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '';
  const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3004', 'http://localhost:8081', 'http://localhost:8082', 'http://127.0.0.1:8081'];
  const allowedOrigins = [...new Set([...envOrigins.split(',').map((url) => url.trim()).filter(Boolean), ...defaultOrigins])];

  logger.info(`Initializing Socket.io with allowed origins: ${allowedOrigins.join(', ')}`);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin) || 
                          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
        if (isAllowed || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    // Production-ready timeouts and transports
    pingTimeout: 60000,   // 60 seconds
    pingInterval: 25000,   // 25 seconds
    transports: ['websocket', 'polling']
  });

  // Production Redis Adapter for cluster support
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter enabled and connected successfully');
    } catch (error) {
      logger.error('Failed to initialize Socket.io Redis adapter. Falling back to in-memory adapter.', error);
    }
  }

  io.on('connection', (socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    // Join room event boilerplate
    socket.on('join_room', async (room) => {
      if (!room) {
        logger.warn(`Socket ${socket.id} attempted to join empty room.`);
        return;
      }
      try {
        if (!(await canJoinRoom(socket, String(room)))) {
          logger.warn(`Socket ${socket.id} was refused room: ${room}`);
          return;
        }
        logger.info(`Socket ${socket.id} is joining room: ${room}`);
        socket.join(room);
      } catch (error) {
        logger.error(`Failed to authorise socket ${socket.id} for room ${room}:`, error);
      }
    });

    // Disconnect event boilerplate
    socket.on('disconnect', (reason) => {
      logger.info(`Socket client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // Initialize feature-level socket dispatchers
  initRoleSocket();
  initUserSocket();
  initOrganizationSocket();
  initComplaintSockets();
  initAmenitySockets();
  initAmenityBookingSockets();
  initCommunityNoteSockets();
  initDirectoryMessageSockets();
  setupPaymentSocketListeners().catch((err) => logger.error('Failed to init payment socket listeners', err));
  setupWalletSocketListeners().catch((err) => logger.error('Failed to init wallet socket listeners', err));

  return io;
};

/**
 * Retrieves the initialized Socket.io server singleton.
 * @returns {Server} The active Socket.io Server instance
 * @throws {Error} If initSocket has not been called yet
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized. Call initSocket(server) first.');
  }
  return io;
};

export default {
  initSocket,
  getIO,
};
