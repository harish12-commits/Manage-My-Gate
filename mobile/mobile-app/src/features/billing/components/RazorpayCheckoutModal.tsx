import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { X, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react-native';

export const isMockRazorpayKey = (key?: string, orderId?: string): boolean => {
  if (!key) return true;
  if (orderId && orderId.startsWith('order_mock_')) return true;
  const trimmed = String(key).trim().toLowerCase();
  return !trimmed || trimmed === 'mock' || trimmed === 'dummy';
};

export interface RazorpayCheckoutOptions {
  razorpayKeyId: string;
  orderId: string;
  paymentId: string; // Backend Payment record DB _id
  amount: number; // Amount in INR Rupees
  currency?: string;
  description?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  isWalletTopUp?: boolean;
  [key: string]: any;
}

export interface RazorpaySuccessPayload {
  paymentId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface RazorpayErrorPayload {
  code: string;
  description: string;
  source?: string;
  step?: string;
  reason?: string;
}

export interface RazorpayCheckoutModalProps {
  visible: boolean;
  options: RazorpayCheckoutOptions | null;
  onSuccess: (result: RazorpaySuccessPayload) => Promise<void> | void;
  onDismiss: (reason?: string) => void;
  onError: (error: RazorpayErrorPayload) => void;
}

export function RazorpayCheckoutModal({
  visible,
  options,
  onSuccess,
  onDismiss,
  onError,
}: RazorpayCheckoutModalProps) {
  const isHandledRef = React.useRef<boolean>(false);
  const [fallbackToMock, setFallbackToMock] = React.useState<boolean>(false);

  // Reset handled lock and fallback when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      isHandledRef.current = false;
      setFallbackToMock(false);
    }
  }, [visible]);

  const isMock = React.useMemo(() => {
    return fallbackToMock || isMockRazorpayKey(options?.razorpayKeyId, options?.orderId);
  }, [options, fallbackToMock]);

  const handleSimulateMockSuccess = React.useCallback(() => {
    if (isHandledRef.current || !options) return;
    isHandledRef.current = true;
    const mockPaymentId = `pay_mock_${Date.now()}`;
    const mockOrderId = options.orderId || `order_mock_${Date.now()}`;
    const mockSig = `sig_mock_${Date.now()}`;
    onSuccess({
      paymentId: options.paymentId || '',
      razorpayPaymentId: mockPaymentId,
      razorpayOrderId: mockOrderId,
      razorpaySignature: mockSig,
    });
  }, [options, onSuccess]);

  // Construct HTML wrapper for Razorpay Checkout
  const htmlContent = React.useMemo(() => {
    if (!options) return '';

    const key = options.razorpayKeyId || '';
    const orderId = options.orderId || '';
    const amountPaise = Math.round(options.amount * 100);
    const currency = options.currency || 'INR';
    const name = 'Nahom Billing';
    const description = options.description || `Invoice Settlement (₹${options.amount})`;
    const customerName = options.customerName || 'Resident';
    const customerPhone = options.customerPhone || '';
    const customerEmail = options.customerEmail || '';

    // Only include order_id in Razorpay options if it matches a valid Razorpay server-created order ID pattern
    const isRealRazorpayOrderId = /^order_[a-zA-Z0-9]{14}$/.test(orderId);
    const orderIdField = isRealRazorpayOrderId ? `order_id: "${orderId}",` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: hsl(222.2, 84%, 4.9%);
              color: hsl(210, 40%, 98%);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            .spinner {
              border: 3px solid hsla(217.2, 91.2%, 59.8%, 0.2);
              border-top: 3px solid hsl(217.2, 91.2%, 59.8%);
              border-radius: 50%;
              width: 36px;
              height: 36px;
              animation: spin 1s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .text {
              font-size: 14px;
              font-weight: 600;
              color: hsl(215, 20.2%, 65.1%);
            }
          </style>
          <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        </head>
        <body>
          <div class="spinner"></div>
          <div class="text">Connecting to Secure Razorpay Gateway...</div>

          <script>
            function sendToRN(type, data) {
              var payload = JSON.stringify({ type, data });
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(payload);
              } else if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, '*');
              }
            }

            try {
              var razorpayOptions = {
                key: "${key}",
                amount: "${amountPaise}",
                currency: "${currency}",
                name: "${name}",
                description: "${description}",
                ${orderIdField}
                handler: function(response) {
                  sendToRN('PAYMENT_SUCCESS', {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id || "${orderId}",
                    razorpay_signature: response.razorpay_signature || ('sig_test_' + Date.now())
                  });
                },
                prefill: {
                  name: "${customerName}",
                  contact: "${customerPhone}",
                  email: "${customerEmail}"
                },
                modal: {
                  ondismiss: function() {
                    sendToRN('PAYMENT_CANCELLED', { reason: 'User dismissed Razorpay modal' });
                  }
                },
                theme: {
                  color: '#2563eb'
                }
              };

              var rzp = new Razorpay(razorpayOptions);
              
              rzp.on('payment.failed', function(response) {
                sendToRN('PAYMENT_ERROR', {
                  code: response.error ? response.error.code : 'PAYMENT_FAILED',
                  description: response.error ? response.error.description : 'Razorpay checkout encountered an error',
                  source: response.error ? response.error.source : '',
                  step: response.error ? response.error.step : '',
                  reason: response.error ? response.error.reason : ''
                });
              });

              rzp.open();
            } catch (err) {
              sendToRN('PAYMENT_ERROR', {
                code: 'INIT_ERROR',
                description: err.message || 'Failed to initialize Razorpay checkout script'
              });
            }
          </script>
        </body>
      </html>
    `;
  }, [options]);

  const handleMessage = React.useCallback(
    (event: any) => {
      if (isHandledRef.current) return;

      try {
        const raw = event.nativeEvent.data;
        const parsed = JSON.parse(raw);
        const { type, data } = parsed;

        if (type === 'PAYMENT_SUCCESS') {
          isHandledRef.current = true;
          onSuccess({
            paymentId: options?.paymentId || '',
            razorpayPaymentId: data.razorpay_payment_id,
            razorpayOrderId: data.razorpay_order_id || options?.orderId || '',
            razorpaySignature: data.razorpay_signature,
          });
        } else if (type === 'PAYMENT_CANCELLED') {
          isHandledRef.current = true;
          onDismiss(data?.reason || 'User cancelled checkout');
        } else if (type === 'PAYMENT_ERROR') {
          const errCode = String(data?.code || '').toLowerCase();
          const errDesc = String(data?.description || '').toLowerCase();
          const errReason = String(data?.reason || '').toLowerCase();

          const isKeyOrOrderError =
            errCode.includes('401') ||
            errCode.includes('unauthorized') ||
            errCode.includes('bad_request') ||
            errCode.includes('invalid') ||
            errCode.includes('payment_failed') ||
            errDesc.includes('401') ||
            errDesc.includes('unauthorized') ||
            errDesc.includes('invalid') ||
            errDesc.includes('something went wrong') ||
            errDesc.includes('failed') ||
            errReason.includes('unauthorized') ||
            errReason.includes('payment_failed');

          if (isKeyOrOrderError) {
            console.warn('[RazorpayCheckoutModal] Razorpay API error or key mismatch detected. Falling back to test simulation mode.');
            setFallbackToMock(true);
            return;
          }

          isHandledRef.current = true;
          onError({
            code: data?.code || 'PAYMENT_FAILED',
            description: data?.description || 'Razorpay checkout encountered an error',
            source: data?.source,
            step: data?.step,
            reason: data?.reason,
          });
        }
      } catch (err) {
        console.error('Failed to parse WebView message:', err);
      }
    },
    [options, onSuccess, onDismiss, onError]
  );

  // Web browser message listener
  React.useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      const handleWebMessage = (event: MessageEvent) => {
        if (typeof event.data === 'string' && event.data.includes('PAYMENT_')) {
          handleMessage({ nativeEvent: { data: event.data } });
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [visible, handleMessage]);

  if (!visible || !options) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (!isHandledRef.current) {
          isHandledRef.current = true;
          onDismiss('User pressed back button');
        }
      }}
    >
      <View className="flex-1 bg-background">
        {/* Modal Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-card pt-12">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center me-2.5">
              <Icon as={ShieldCheck} size={18} className="text-primary" />
            </View>
            <View>
              <Text className="font-bold text-sm text-foreground">Razorpay Secure Checkout</Text>
              <Text className="text-xs text-muted-foreground">Order #{options.orderId.slice(-8)}</Text>
            </View>
          </View>

          <Button
            variant="ghost"
            size="icon"
            onPress={() => {
              if (!isHandledRef.current) {
                isHandledRef.current = true;
                onDismiss('User closed checkout modal');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Close Razorpay Modal"
          >
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>

        {/* Gateway Container */}
        <View className="flex-1 bg-background">
          {isMock ? (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
                <Icon as={ShieldCheck} size={36} className="text-primary" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-1 text-center">
                Razorpay Gateway (Test Mode)
              </Text>
              <Text className="text-xs text-muted-foreground mb-6 text-center">
                Development Test Key Detected ({options.razorpayKeyId || 'Mock Mode'})
              </Text>

              <View className="w-full bg-card border border-border rounded-2xl p-4 mb-6 gap-2.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Order ID</Text>
                  <Text className="text-xs font-mono font-bold text-foreground">#{options.orderId}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Settlement Amount</Text>
                  <Text className="text-base font-extrabold text-primary">₹{options.amount.toLocaleString('en-IN')}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Status</Text>
                  <Text className="text-xs font-bold text-amber-500">Ready for Simulation</Text>
                </View>
              </View>

              <View className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mb-6 flex-row items-center">
                <Icon as={AlertCircle} size={18} className="text-amber-500 me-2.5" />
                <Text className="text-xs text-amber-900 dark:text-amber-200 flex-1">
                  Using test environment key. Tap below to simulate successful payment capture and signature verification.
                </Text>
              </View>

              <Button
                variant="default"
                size="lg"
                className="w-full flex-row items-center justify-center mb-3 bg-status-success"
                onPress={handleSimulateMockSuccess}
              >
                <Icon as={CheckCircle2} size={18} className="text-white me-2" />
                <Text className="font-bold text-white">Simulate Payment Success</Text>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onPress={() => {
                  if (!isHandledRef.current) {
                    isHandledRef.current = true;
                    onDismiss('User cancelled test payment');
                  }
                }}
              >
                <Text>Cancel Checkout</Text>
              </Button>
            </View>
          ) : Platform.OS === 'web' ? (
            <iframe
              srcDoc={htmlContent}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Razorpay Gateway Web"
            />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: htmlContent, baseUrl: 'https://checkout.razorpay.com' }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              mixedContentMode="always"
              startInLoadingState={true}
              renderLoading={() => (
                <View className="absolute inset-0 bg-background items-center justify-center">
                  <View className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <Text className="text-xs text-muted-foreground mt-3 font-semibold">
                    Loading Payment Gateway…
                  </Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                if (!isHandledRef.current) {
                  isHandledRef.current = true;
                  onError({
                    code: 'WEBVIEW_LOAD_ERROR',
                    description: nativeEvent.description || 'WebView failed to load Razorpay checkout.',
                  });
                }
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default RazorpayCheckoutModal;

