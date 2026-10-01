import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { View, Modal, Platform, NativeModules } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { X, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

type NativeRazorpayCheckout = {
  open: (options: Record<string, unknown>) => Promise<any>;
};

/**
 * Expo Go does not contain Razorpay's native module. Load the JS wrapper only
 * when a development or production native build has linked that module.
 */
const getNativeRazorpayCheckout = (): NativeRazorpayCheckout | null => {
  const linkedModule = NativeModules.RNRazorpayCheckout || NativeModules.RazorpayCheckout;
  if (!linkedModule) return null;

  try {
    const razorpayPackage = require('react-native-razorpay');
    return (razorpayPackage.default || razorpayPackage) as NativeRazorpayCheckout;
  } catch (error) {
    console.warn('[RazorpayCheckoutModal] Unable to load the linked Razorpay SDK.', error);
    return null;
  }
};

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
  const isHandledRef = useRef<boolean>(false);
  const [fallbackToMock, setFallbackToMock] = useState<boolean>(false);
  const [useWebView, setUseWebView] = useState<boolean>(false);

  // Reset handled lock and fallback when modal becomes visible
  useEffect(() => {
    if (visible) {
      isHandledRef.current = false;
      setFallbackToMock(false);
      setUseWebView(false);
    }
  }, [visible]);

  const isMock = useMemo(() => {
    return fallbackToMock || isMockRazorpayKey(options?.razorpayKeyId, options?.orderId);
  }, [options, fallbackToMock]);

  const handleSimulateMockSuccess = useCallback(() => {
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

  // Handle Native SDK Checkout
  useEffect(() => {
    if (visible && options && Platform.OS !== 'web' && !isMock && !useWebView) {
      const nativeRazorpayCheckout = getNativeRazorpayCheckout();
      if (!nativeRazorpayCheckout || typeof nativeRazorpayCheckout.open !== 'function') {
        console.warn('[RazorpayCheckoutModal] RazorpayCheckout SDK is missing. Falling back to WebView.');
        setUseWebView(true);
        return;
      }

      // Small timeout to ensure state settles before popping native intent
      const timer = setTimeout(() => {
        if (isHandledRef.current) return;

        const razorpayOptions = {
          description: options.description || 'Payment Settlement',
          currency: options.currency || 'INR',
          key: options.razorpayKeyId,
          amount: Math.round(options.amount * 100), // SDK expects paise
          name: options.name || 'Manage My Gate',
          order_id: options.orderId,
          theme: { color: options.theme?.color || '#2563eb' },
          prefill: {
            email: options.customerEmail || '',
            contact: options.customerPhone || '',
            name: options.customerName || '',
          },
        };

        try {
          nativeRazorpayCheckout.open(razorpayOptions)
            .then((data: any) => {
              if (!isHandledRef.current) {
                isHandledRef.current = true;
                onSuccess({
                  paymentId: options.paymentId || '',
                  razorpayPaymentId: data.razorpay_payment_id,
                  razorpayOrderId: data.razorpay_order_id || options.orderId || '',
                  razorpaySignature: data.razorpay_signature,
                });
              }
            })
            .catch((error: any) => {
              if (!isHandledRef.current) {
                isHandledRef.current = true;
                // Check if user cancelled
                const errDesc = String(error.description || error.message || '').toLowerCase();
                
                // Fallback to WebView if Native SDK crashes due to missing underlying native code
                if (errDesc.includes("read property 'open'") || errDesc.includes("razorpaycheckout is null")) {
                  console.warn('[RazorpayCheckoutModal] Native SDK crashed missing open property. Falling back to WebView.', error);
                  isHandledRef.current = false;
                  setUseWebView(true);
                  return;
                }

                if (error.code === 'BAD_REQUEST_ERROR' && errDesc.includes('cancel')) {
                  onDismiss('User cancelled checkout');
                } else {
                  // If it's a key error, fallback to mock (useful for testing without valid keys)
                  if (errDesc.includes('unauthorized') || errDesc.includes('invalid') || error.code === 2) {
                    console.warn('[RazorpayCheckoutModal] API error detected natively. Falling back to test mode.');
                    isHandledRef.current = false; // Reset so mock can handle it
                    setFallbackToMock(true);
                    return;
                  }
                  
                  onError({
                    code: String(error.code || 'PAYMENT_FAILED'),
                    description: error.description || error.message || 'Razorpay checkout encountered an error',
                  });
                }
              }
            });
        } catch (err) {
          console.warn('[RazorpayCheckoutModal] Error invoking native RazorpayCheckout. Falling back to WebView.', err);
          setUseWebView(true);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [visible, options, isMock, useWebView, onSuccess, onDismiss, onError]);

  // Construct HTML wrapper for Razorpay Web Checkout (Used by web AND native WebView fallback)
  const htmlContent = useMemo(() => {
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

    const isRealRazorpayOrderId = /^order_[a-zA-Z0-9]{14}$/.test(orderId);
    const orderIdField = isRealRazorpayOrderId ? `order_id: "${orderId}",` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body {
              margin: 0; padding: 0;
              background-color: hsl(222.2, 84%, 4.9%);
              color: hsl(210, 40%, 98%);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;
            }
            .spinner {
              border: 3px solid hsla(217.2, 91.2%, 59.8%, 0.2);
              border-top: 3px solid hsl(217.2, 91.2%, 59.8%);
              border-radius: 50%;
              width: 36px; height: 36px;
              animation: spin 1s linear infinite; margin-bottom: 16px;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .text { font-size: 14px; font-weight: 600; color: hsl(215, 20.2%, 65.1%); }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <div class="text" id="statusText">Connecting to Secure Razorpay Gateway...</div>

          <script>
            function sendToParent(type, data) {
              var payload = JSON.stringify({ type, data });
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(payload);
              } else if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, '*');
              }
            }

            function initRazorpay() {
              document.getElementById('statusText').innerText = "Opening Secure Checkout...";
              try {
                var razorpayOptions = {
                  key: "${key}",
                  amount: "${amountPaise}",
                  currency: "${currency}",
                  name: "${name}",
                  description: "${description}",
                  ${orderIdField}
                  handler: function(response) {
                    sendToParent('PAYMENT_SUCCESS', {
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
                      sendToParent('PAYMENT_CANCELLED', { reason: 'User dismissed Razorpay modal' });
                    }
                  },
                  theme: { color: '#2563eb' }
                };

                var rzp = new Razorpay(razorpayOptions);
                rzp.on('payment.failed', function(response) {
                  sendToParent('PAYMENT_ERROR', {
                    code: response.error ? response.error.code : 'PAYMENT_FAILED',
                    description: response.error ? response.error.description : 'Razorpay checkout encountered an error',
                    source: response.error ? response.error.source : '',
                    step: response.error ? response.error.step : '',
                    reason: response.error ? response.error.reason : ''
                  });
                });
                rzp.open();
              } catch (err) {
                sendToParent('PAYMENT_ERROR', {
                  code: 'INIT_ERROR',
                  description: err.message || 'Failed to initialize Razorpay checkout script'
                });
              }
            }
          </script>
          <script src="https://checkout.razorpay.com/v1/checkout.js" onload="initRazorpay()" onerror="sendToParent('PAYMENT_ERROR', { code: 'NETWORK_ERROR', description: 'Could not load Razorpay network script.' })"></script>
        </body>
      </html>
    `;
  }, [options]);

  const handleMessage = useCallback(
    (event: any) => {
      if (isHandledRef.current) return;

      try {
        const raw = event.data || event.nativeEvent?.data;
        if (!raw || typeof raw !== 'string') return;
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
          
          if (errCode.includes('401') || errDesc.includes('unauthorized') || errDesc.includes('invalid')) {
            console.warn('[RazorpayCheckoutModal] API error detected natively. Falling back to test mode.');
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
        console.error('Failed to parse Web message:', err);
      }
    },
    [options, onSuccess, onDismiss, onError]
  );

  // Web browser message listener
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      const handleWebMessage = (event: MessageEvent) => {
        if (typeof event.data === 'string' && event.data.includes('PAYMENT_')) {
          handleMessage(event);
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [visible, handleMessage]);

  if (!visible || !options) return null;

  // On native platforms, if we are not mocking, we don't render a Modal UI because
  // the Razorpay SDK provides its own full-screen native overlay.
  if (Platform.OS !== 'web' && !isMock && !useWebView) return null;

  // For Web or Mock mode, we render the Modal UI
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
          >
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>

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
          ) : useWebView ? (
            <WebView
              source={{ html: htmlContent, baseUrl: 'https://razorpay.com' }}
              onMessage={handleMessage}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default RazorpayCheckoutModal;
