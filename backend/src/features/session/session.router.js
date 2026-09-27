import express from 'express';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import * as sessionController from './session.controller.js';

const router = express.Router();

router.use(isAuthenticated);

router.get('/', sessionController.getUserSessions);
router.delete('/all', sessionController.revokeAllSessions);
router.delete('/:sessionId', sessionController.revokeSession);

// Note: Refresh token route is usually placed in auth.router.js since it's an auth flow, 
// but we define the controller method in session controller and can mount it here or in auth router.

export default router;
