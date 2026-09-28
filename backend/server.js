import http from 'http';
import app from './index.js';
import config from './src/config/config.js';


import './src/features/user/user.listeners.js';
import './src/features/securityLog/securityLog.listeners.js';
import './src/features/complaint/complaint.listeners.js';
import './src/features/technician/technician.listeners.js';
import './src/features/auth/auth.listeners.js';
import './src/features/workspace/workspace.listeners.js';
import './src/features/poll/poll.listeners.js';
import './src/features/noticeBoard/noticeBoard.listeners.js';
import './src/features/issueReport/issueReport.listeners.js';
import connectToDb from './src/config/db/mongodbConnectToDb.config.js';
import { initSocket } from './src/config/socket.js';
import initializePassport from './src/features/auth/passport/passport.init.js';
import logger from './src/utils/logger.utils.js';
import { syncPermissions } from './src/utils/permissionSync.util.js';
import complaintCron from './src/features/complaint/complaint.cron.js';
import assessmentCron from './src/features/assessment/utils/assessmentCron.js';
import userCron from './src/features/user/user.cron.js';
import communityEngagementCron from './src/features/communityEngagement/communityEngagement.cron.js';
import outboxWorker from './src/workers/outbox.worker.js';
import {
  amenityHoldExpirationWorker,
  amenityOutboxWorker,
  amenityReservationLifecycleWorker,
} from './src/features/amenityManagement/index.js';

const initCronJobs = () => {
  if (config.nodeEnv !== 'test') {
    complaintCron.init();
    assessmentCron.init();
    userCron.init();
    communityEngagementCron.init();
    logger.info('Background Cron Jobs Initialized');
  }
};

const startServer = async () => {
  try {
    initCronJobs();
    outboxWorker.init();

    // Unit/integration tests drive the workers directly; the E2E suite opts in so the
    // real in-process workers (and their socket/notification emits) run.
    if (config.nodeEnv !== 'test' || process.env.AMENITY_WORKERS_ENABLED === 'true') {
      amenityHoldExpirationWorker.initWorker();
      amenityOutboxWorker.initWorker();
      amenityReservationLifecycleWorker.initWorker();
      logger.info('Amenity Management Background Workers Initialized');
    }

    // 1. Connect the database FIRST
    await connectToDb();

    // Run permission synchronization & Super Admin bootstrapping
    try {
      await syncPermissions();
    } catch (syncError) {
      logger.error('Permission sync or Super Admin bootstrap failed. Server will continue to start. Error:', syncError.message);
    }

    // 2. Initialize Passport/SSO
    initializePassport(app);

    // 3. Create HTTP Server wrapping the express app
    const server = http.createServer(app);

    // 4. Initialize Socket.io server
    await initSocket(server);

    // 5. Start the app on the designated port
    const port = config.port;
    const host = config.host;
    server.listen(port, () => {
      logger.info(`🚀 Server is running on http://${host}:${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is already in use. An active backend instance is already running on http://${host}:${port}.`);
        process.exit(0);
      } else {
        logger.error('HTTP Server Error:', err);
      }
    });

    const shutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down server...`);
      try {
        amenityHoldExpirationWorker.stopWorker();
        amenityOutboxWorker.stopWorker();
        amenityReservationLifecycleWorker.stopWorker();
      } catch (err) {
        logger.error('Error stopping amenity workers during shutdown:', err);
      }
      server.close(() => {
        logger.info('HTTP server closed successfully.');
        if (signal === 'SIGUSR2') {
          process.kill(process.pid, 'SIGUSR2');
        } else {
          process.exit(0);
        }
      });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason: reason?.stack || reason });
    });
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception thrown:', { error: error?.stack || error });
    });
  } catch (error) {
    logger.error('Server startup FAILED: ', error);
    process.exit(1);
  }
};

startServer();

// trigger restart

// trigger restart 2

// trigger restart 34

// trigger restart 4

// trigger restart 6

