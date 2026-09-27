import { act } from '@testing-library/react-native';

/** Feeds `data` to the currently mounted CameraView as if a barcode had been scanned. */
export const simulateScan = async (data: string, type = 'qr') => {
  const camera = (globalThis as any).__e2eCamera;
  if (!camera?.onBarcodeScanned) {
    throw new Error('No CameraView with onBarcodeScanned is mounted.');
  }
  await act(async () => {
    await camera.onBarcodeScanned({ type, data });
  });
};
