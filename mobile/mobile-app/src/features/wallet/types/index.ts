export interface WalletTransaction {
  _id: string;
  id?: string;
  transactionId?: string;
  type: 'CREDIT' | 'DEBIT' | 'Credit' | 'Debit';
  amount: number;
  description: string;
  referenceId?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface WalletPagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
}

export interface WalletState {
  balance: number;
  activePasses?: any[];
  transactionHistory?: any[];
  transactions?: any[];
  isPaymentGatewayConfigured?: boolean;
  loading?: boolean;
  pagination?: WalletPagination;
  isLoading: boolean;
  error: string | null;
}

export interface CreateWalletOrderResponse {
  orderId: string;
  id?: string;
  paymentId?: string;
  amount: number;
  currency: string;
  razorpayKeyId?: string;
  keyId?: string;
  key?: string;
}
