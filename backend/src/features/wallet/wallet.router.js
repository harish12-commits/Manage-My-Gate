import express from 'express';
import { getMyWallet, addMoney, payInvoice, createOrder, verifyPayment } from './wallet.controller.js';
import { isAuthenticated } from '../../middlewares/auth.middleware.js';
import { authorizeAnyPermission } from '../../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(isAuthenticated);

// Resident & Admin routes for wallet
router.get('/', authorizeAnyPermission(['billing:action_center', 'billing:wallet', 'amenities:wallet', 'wallet:read', 'wallet:manage']), getMyWallet);
router.post('/add-money', authorizeAnyPermission(['billing:action_center', 'billing:wallet', 'amenities:wallet', 'wallet:create', 'wallet:manage']), addMoney);
router.post('/pay-invoice', authorizeAnyPermission(['billing:action_center', 'billing:wallet', 'amenities:wallet', 'wallet:create']), payInvoice);
router.post('/create-order', authorizeAnyPermission(['billing:action_center', 'billing:wallet', 'amenities:wallet', 'wallet:create', 'wallet:manage']), createOrder);
router.post('/verify-payment', authorizeAnyPermission(['billing:action_center', 'billing:wallet', 'amenities:wallet', 'wallet:create', 'wallet:manage']), verifyPayment);

export default router;
