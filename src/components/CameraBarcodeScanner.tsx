import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Flashlight,
  SwitchCamera,
  ShieldAlert,
  Info,
  ExternalLink,
  Barcode,
  Layers,
} from 'lucide-react';
import { soundManager } from '../utils/soundUtils';
import {
  checkCameraSecurity,
  SUPPORTED_BARCODE_FORMATS,
  NATIVE_BARCODE_DETECTOR_FORMATS,
} from '../utils/scannerEngine';
import {
  formatBarcodeTypeName,
  detectBarcodeFormatFromValue,
} from '../utils/barcodeUtils';
import { Html5Qrcode } from 'html5-qrcode';

interface CameraBarcodeScannerProps {
  onScan: (barcode: string, format?: string) => void;
  isActive?: boolean;
  expectedSku?: string;
  className?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  isActive = true,
  expectedSku,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const isHaltingRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const [cameraState, setCameraState] = useState<
    'idle' | 'requesting' | 'streaming' | 'denied' | 'not-found' | 'insecure' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastDetected, setLastDetected] = useState<{ value: string; format: string } | null>(null);
  const [scanFlash, setScanFlash] = useState(false);
  const [isHalted, setIsHalted] = useState(false);

  // Security check on mount
  const securityCheck = checkCameraSecurity();

  // Enumerate available video input devices
  const updateCameraList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        // Prefer back/environment camera if identifiable
        const backCam = videoDevices.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err) {
      console.warn('Enumerate devices warning:', err);
    }
  }, [selectedCameraId]);

  // Stop current active camera stream
  const stopStream = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleBarcodeDetected = useCallback(
    (code: string, rawFormat?: string) => {
      // 500-1000ms halt cooldown: ignore scans while halting
      if (isHaltingRef.current) {
        return;
      }

      const clean = code.trim().toUpperCase();
      if (!clean) return;

      const detectedFormat = rawFormat
        ? formatBarcodeTypeName(rawFormat)
        : detectBarcodeFormatFromValue(clean);

      // Set halt lock immediately for 800ms (between 500ms and 1000ms)
      isHaltingRef.current = true;
      setIsHalted(true);
      lastScannedCodeRef.current = clean;
      setLastDetected({ value: clean, format: detectedFormat });

      // Trigger visual flash
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 450);

      // Play sound feedback
      if (expectedSku) {
        if (clean === expectedSku.trim().toUpperCase()) {
          soundManager.playSuccessBeep();
        } else {
          soundManager.playErrorBuzz();
        }
      } else {
        soundManager.playSuccessBeep();
      }

      // Notify parent listener with both value and detected format
      onScan(clean, detectedFormat);

      // Release halt after 800 ms to prevent duplicate reads
      setTimeout(() => {
        isHaltingRef.current = false;
        setIsHalted(false);
      }, 800);
    },
    [expectedSku, onScan]
  );

  // Barcode decoding loop: Native BarcodeDetector (Multi-Format) with Html5Qrcode fallback
  const startDetectionLoop = useCallback(async () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        // Query supported formats if browser supports BarcodeDetector.getSupportedFormats()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detectorClass = (window as any).BarcodeDetector;
        let formatsToUse = NATIVE_BARCODE_DETECTOR_FORMATS;
        if (typeof detectorClass.getSupportedFormats === 'function') {
          try {
            const supported = await detectorClass.getSupportedFormats();
            if (Array.isArray(supported) && supported.length > 0) {
              formatsToUse = NATIVE_BARCODE_DETECTOR_FORMATS.filter((f) => supported.includes(f));
            }
          } catch {}
        }
        detector = new detectorClass({ formats: formatsToUse });
      } catch (e) {
        console.warn('Native BarcodeDetector initialization warning:', e);
      }
    }

    // Interval scanning loop (checks every 200ms)
    scanIntervalRef.current = window.setInterval(async () => {
      // If currently halted in 500-1000ms cooldown, skip frame processing
      if (isHaltingRef.current) {
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) {
        return;
      }

      // 1. Primary path: Native BarcodeDetector (Zero overhead, multi-format)
      if (detector) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const item = barcodes[0];
            if (item && item.rawValue) {
              handleBarcodeDetected(item.rawValue, item.format);
              return;
            }
          }
        } catch {
          // Frame glitch, continue
        }
      }

      // 2. Fallback path if BarcodeDetector is not available: Canvas + Html5Qrcode
      if (!detector && canvasRef.current) {
        try {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = Math.min(640, video.videoWidth);
            canvas.height = Math.min(480, video.videoHeight);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Lazy initialize Html5Qrcode instance
            if (!html5QrCodeRef.current) {
              const dummyId = 'html5-qr-hidden-decoder';
              let el = document.getElementById(dummyId);
              if (!el) {
                el = document.createElement('div');
                el.id = dummyId;
                el.style.display = 'none';
                document.body.appendChild(el);
              }
              html5QrCodeRef.current = new Html5Qrcode(dummyId, {
                formatsToSupport: SUPPORTED_BARCODE_FORMATS,
                verbose: false,
              });
            }

            canvas.toBlob((blob) => {
              if (blob && html5QrCodeRef.current && !isHaltingRef.current) {
                const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
                html5QrCodeRef.current
                  .scanFile(file, false)
                  .then((decodedText) => {
                    if (decodedText) {
                      handleBarcodeDetected(decodedText);
                    }
                  })
                  .catch(() => {
                    // No barcode in this frame
                  });
              }
            }, 'image/jpeg', 0.85);
          }
        } catch {
          // frame parse error
        }
      }
    }, 200);
  }, [handleBarcodeDetected]);

  // Start camera with getUserMedia
  const startCamera = useCallback(async () => {
    if (!isActive) return;

    // 1. Check protocol security
    if (!securityCheck.isSecure) {
      setCameraState('insecure');
      setErrorMessage(
        `เบราว์เซอร์บล็อกการเปิดกล้องผ่านโปรโตคอล ${window.location.protocol}// ต้องเปิดผ่าน https:// หรือ localhost เท่านั้น`
      );
      return;
    }

    // 2. Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setErrorMessage('เบราว์เซอร์หรืออุปกรณ์นี้ไม่มี navigator.mediaDevices.getUserMedia');
      return;
    }

    stopStream();
    setCameraState('requesting');
    setErrorMessage(null);

    try {
      // Build constraints with environment facingMode first
      const videoConstraints: MediaTrackConstraints = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (firstErr: unknown) {
        const firstError = firstErr as { name?: string; message?: string };
        const isPermissionIssue =
          firstError?.name === 'NotAllowedError' ||
          firstError?.name === 'PermissionDeniedError' ||
          firstError?.name === 'SecurityError' ||
          (firstError?.message && /not allowed|denied|permission/i.test(firstError.message));

        if (!isPermissionIssue) {
          console.warn('Initial camera constraint failed, retrying with fallback { video: true }:', firstErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      // Bind to video element
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;

        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() deferred until metadata loaded:', playErr);
        }
      }

      setCameraState('streaming');
      await updateCameraList();
      await startDetectionLoop();
    } catch (err: unknown) {
      stopStream();

      const error = err as { name?: string; message?: string };
      console.warn('Camera access unavailable (fallback active):', error.message || error.name || err);

      const isPermissionDenied =
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError' ||
        (error.message && /not allowed|denied|permission/i.test(error.message));

      if (isPermissionDenied) {
        setCameraState('denied');
        setErrorMessage(
          'เบราว์เซอร์หรือสภาพแวดล้อม iFrame ไม่อนุญาตให้ใช้กล้อง (Permission Denied) — ท่านสามารถสแกนบาร์โค้ดผ่านเครื่องอ่านบาร์โค้ด USB/Bluetooth, คีย์บอร์ด หรือปุ่มจำลองการยิงรหัสได้ทันที'
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraState('not-found');
        setErrorMessage('ไม่พบอุปกรณ์กล้องบนเครื่องนี้ (Camera Not Found): โปรดเชื่อมต่อเว็บแคมหรือสลับไปใช้อุปกรณ์อื่น');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraState('error');
        setErrorMessage('กล้องกำลังถูกใช้งานโดยแอปอื่น (Camera in use): โปรดปิดโปรแกรมอื่นที่เปิดกล้องค้างไว้');
      } else if (error.name === 'SecurityError') {
        setCameraState('insecure');
        setErrorMessage('ความปลอดภัยไม่อนุญาตให้เปิดกล้อง (Security Error): หน้าเว็บต้องรันบน HTTPS หรือ localhost');
      } else {
        setCameraState('error');
        setErrorMessage(error.message || 'เกิดข้อผิดพลาดในการเปิดกล้อง โปรดตรวจสอบการเชื่อมต่อ');
      }
    }
  }, [isActive, securityCheck.isSecure, selectedCameraId, stopStream, updateCameraList, startDetectionLoop]);

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Switch between front and back camera
  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    if (nextCamera) {
      setSelectedCameraId(nextCamera.deviceId);
    }
  };

  // Start camera when component mounts and isActive is true
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopStream();
      setCameraState('idle');
    }

    return () => {
      stopStream();
    };
  }, [isActive, selectedCameraId]);

  return (
    <div className={`relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 text-white ${className}`}>
      {/* Hidden canvas for fallback decoding */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Viewport: ALWAYS render <video> so ref is never null */}
      <div className="relative aspect-16/10 sm:aspect-16/9 w-full bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === 'streaming' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Laser Sight & Barcode Target Frame (visible when streaming) */}
        {cameraState === 'streaming' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Viewfinder Target Box */}
            <div
              className={`w-64 sm:w-80 h-36 sm:h-44 border-2 rounded-xl relative transition-all duration-200 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] ${
                scanFlash
                  ? 'border-emerald-400 bg-emerald-500/20 scale-102 ring-4 ring-emerald-400/40'
                  : isHalted
                  ? 'border-emerald-500/90 bg-emerald-950/20'
                  : 'border-emerald-500/80'
              }`}
            >
              {/* Four Corner Accents */}
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-sm" />

              {/* Animated Laser Scan Line */}
              <div
                className={`w-full h-0.5 shadow-[0_0_12px] absolute top-1/2 -translate-y-1/2 transition-colors ${
                  isHalted
                    ? 'bg-emerald-400 shadow-emerald-400'
                    : 'bg-red-500 shadow-[#ef4444] animate-pulse'
                }`}
              />

              {/* Target Status Label */}
              <div className="absolute bottom-2 inset-x-0 text-center px-2">
                <span className="text-[10px] sm:text-xs uppercase font-mono tracking-wider bg-slate-900/90 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 inline-flex items-center gap-1.5 shadow-sm">
                  {lastDetected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{lastDetected.value}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">
                        {lastDetected.format}
                      </span>
                    </>
                  ) : (
                    'ALIGN BARCODE IN FRAME'
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State Overlays when camera is NOT streaming */}
        {cameraState !== 'streaming' && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
            {cameraState === 'requesting' ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                <div className="text-sm font-semibold text-slate-200">กำลังขออนุญาตและเปิดใช้งานกล้อง...</div>
                <p className="text-xs text-slate-400 max-w-xs">
                  กรุณากด "Allow" หรือ "อนุญาต" บนหน้าต่างของเบราว์เซอร์เพื่อเปิดวิดีโอ
                </p>
              </div>
            ) : cameraState === 'denied' ? (
              <div className="flex flex-col items-center gap-2.5 max-w-sm px-4">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-amber-300">กล้องไม่พร้อมใช้งาน (Camera Permission)</h4>
                <p className="text-xs text-slate-300 leading-relaxed text-center">
                  {errorMessage || 'เบราว์เซอร์หรือสภาพแวดล้อม iFrame ไม่อนุญาตให้เปิดกล้อง'}
                </p>
                <div className="p-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-[11px] text-slate-300 text-left w-full mt-1">
                  <div className="font-bold text-emerald-400 mb-1">✓ ระบบพร้อมใช้งานผ่านช่องทางอื่น:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                    <li>เครื่องอ่านบาร์โค้ด USB/Bluetooth ยิงได้ทันที</li>
                    <li>ป้อนรหัสบาร์โค้ด / SKU ด้วยคีย์บอร์ด</li>
                    <li>ปุ่มลัดจำลองการสแกนด้านบน</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> ลองเปิดกล้องอีกครั้ง
                  </button>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> เปิดในแท็บใหม่
                  </a>
                </div>
              </div>
            ) : cameraState === 'not-found' ? (
              <div className="flex flex-col items-center gap-2.5 max-w-sm">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-amber-300">ไม่พบอุปกรณ์กล้องบนเครื่องนี้</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  เครื่องของคุณอาจไม่มีกล้องเว็บแคมเชื่อมต่ออยู่ คุณสามารถใช้ <b>เครื่องสแกนบาร์โค้ดฮาร์ดแวร์ หรือ กล่องค้นหา SKU</b> ด้านล่างเพื่อตรวจสอบระบบได้ทันที
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> ตรวจสอบกล้องใหม่
                </button>
              </div>
            ) : cameraState === 'insecure' ? (
              <div className="flex flex-col items-center gap-2.5 max-w-sm">
                <div className="p-3 bg-rose-500/20 text-rose-400 rounded-full">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-rose-300">ข้อจำกัดความปลอดภัยของเบราว์เซอร์</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Web Camera API อนุญาตให้ทำงานได้เฉพาะบนโปรโตคอล <b>HTTPS</b> หรือ <b>localhost</b> เท่านั้น
                </p>
                <div className="text-[11px] font-mono bg-slate-900 px-3 py-1.5 rounded text-amber-400">
                  Current: {window.location.protocol}//{window.location.hostname}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 max-w-sm">
                <div className="p-3 bg-slate-800 text-slate-400 rounded-full">
                  <Camera className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-slate-200">ระบบกล้องสแกนบาร์โค้ดพร้อมใช้งาน</h4>
                <p className="text-xs text-slate-400">
                  กดปุ่มด้านล่างเพื่อเปิดการทำงานของกล้องวิดีโอแบบสด
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Camera className="w-4 h-4" /> เปิดกล้องวิดีโอ (Start Camera)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Top Control Overlay bar */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold backdrop-blur-md ${
                cameraState === 'streaming'
                  ? isHalted
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cameraState === 'streaming'
                    ? isHalted
                      ? 'bg-amber-400'
                      : 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              {cameraState === 'streaming'
                ? isHalted
                  ? 'COOLDOWN (800ms)'
                  : 'MULTI-FORMAT LIVE'
                : 'CAMERA OFF'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            {hasTorch && cameraState === 'streaming' && (
              <button
                type="button"
                onClick={toggleTorch}
                title={torchOn ? 'ปิดไฟแฟลช' : 'เปิดไฟแฟลช'}
                className={`p-2 rounded-lg backdrop-blur-md border text-xs font-semibold transition-all cursor-pointer ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            {cameras.length > 1 && cameraState === 'streaming' && (
              <button
                type="button"
                onClick={switchCamera}
                title="สลับกล้องหน้า/หลัง"
                className="p-2 rounded-lg backdrop-blur-md bg-slate-900/80 text-white border border-slate-700 hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {cameraState === 'streaming' ? (
              <button
                type="button"
                onClick={stopStream}
                className="px-2.5 py-1 rounded-lg backdrop-blur-md bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-semibold border border-rose-500/40 transition-all cursor-pointer"
              >
                ปิดกล้อง
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="px-2.5 py-1 rounded-lg backdrop-blur-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-semibold border border-emerald-500/40 flex items-center gap-1 transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> เปิดกล้อง
              </button>
            )}
          </div>
        </div>

        {/* Bottom Multi-Format Support Indicators */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex items-center justify-between text-[10px] text-slate-400 z-10 px-2 py-1 bg-slate-950/80 rounded-lg backdrop-blur-xs border border-slate-800/80">
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <Layers className="w-3 h-3 text-emerald-400" /> Multi-Format Engine:
          </span>
          <span className="font-mono text-emerald-400 truncate">
            Code 128 • Code 39 • EAN-13 • EAN-8 • UPC-A • UPC-E • QR
          </span>
        </div>
      </div>
    </div>
  );
};

