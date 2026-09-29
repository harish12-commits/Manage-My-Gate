import React, { useEffect, useRef, useState, memo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScannerError } from './ScannerStates.jsx';

const ScannerCamera = memo(({ onScan }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let html5QrcodeScanner;

    const startScanner = async () => {
      try {
        html5QrcodeScanner = new Html5Qrcode("reader");
        
        // Ensure element exists before starting
        if (document.getElementById("reader")) {
          await html5QrcodeScanner.start(
            { facingMode: "environment" },
            { 
              fps: 10, 
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.85;
                return { width: Math.max(300, size), height: Math.max(300, size) };
              },
              formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
            },
            (decodedText, decodedResult) => {
              // Successfully decoded
              onScan(decodedText);
            },
            (errorMessage) => {
              // parse errors are normal (no qr code found in frame), ignore them
            }
          );
          setIsScanning(true);
        }
      } catch (err) {
        console.error("Camera startup error:", err);
        setError("Failed to access camera. Please ensure you have granted camera permissions.");
      }
    };

    startScanner();

    return () => {
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
      }
    };
  }, [onScan]);

  if (error) {
    return <ScannerError message={error} />;
  }

  return (
    <div className="position-relative bg-dark rounded overflow-hidden shadow-sm" style={{ aspectRatio: '1/1', maxHeight: '500px', margin: '0 auto' }}>
      <div id="reader" style={{ width: '100%', height: '100%' }}></div>
      
      {/* Target Overlay (CSS-based viewfinder) */}
      {isScanning && (
        <div className="position-absolute top-50 left-50 translate-middle" style={{ width: '85%', height: '85%', maxWidth: '400px', maxHeight: '400px', border: '3px solid rgba(255,255,255,0.5)', borderRadius: '12px', pointerEvents: 'none', zIndex: 10 }}>
          <div className="position-absolute" style={{ top: '-3px', left: '-3px', width: '30px', height: '30px', borderTop: '4px solid #321fdb', borderLeft: '4px solid #321fdb' }}></div>
          <div className="position-absolute" style={{ top: '-3px', right: '-3px', width: '30px', height: '30px', borderTop: '4px solid #321fdb', borderRight: '4px solid #321fdb' }}></div>
          <div className="position-absolute" style={{ bottom: '-3px', left: '-3px', width: '30px', height: '30px', borderBottom: '4px solid #321fdb', borderLeft: '4px solid #321fdb' }}></div>
          <div className="position-absolute" style={{ bottom: '-3px', right: '-3px', width: '30px', height: '30px', borderBottom: '4px solid #321fdb', borderRight: '4px solid #321fdb' }}></div>
        </div>
      )}
    </div>
  );
});

export default ScannerCamera;
