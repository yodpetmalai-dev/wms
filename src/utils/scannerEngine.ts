import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface CameraSecurityCheck {
  isSecure: boolean;
  protocol: string;
  hostname: string;
  hasMediaDevices: boolean;
  message?: string;
}

export function checkCameraSecurity(): CameraSecurityCheck {
  if (typeof window === 'undefined') {
    return { isSecure: false, protocol: '', hostname: '', hasMediaDevices: false };
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isHttps = protocol === 'https:';
  const isSecure = isHttps || isLocalhost;
  const hasMediaDevices = Boolean(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  let message = '';
  if (!isSecure) {
    message = `เบราว์เซอร์ไม่อนุญาตให้เปิดกล้องผ่านโปรโตคอล ${protocol}// ต้องใช้งานผ่าน https:// หรือ localhost เท่านั้น`;
  } else if (!hasMediaDevices) {
    message = 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ API สำหรับเข้าถึงกล้อง (navigator.mediaDevices.getUserMedia)';
  }

  return {
    isSecure,
    protocol,
    hostname,
    hasMediaDevices,
    message: message || undefined,
  };
}

export const SUPPORTED_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.AZTEC,
];

// Native browser BarcodeDetector formats
export const NATIVE_BARCODE_DETECTOR_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'qr_code',
  'upc_a',
  'upc_e',
  'aztec',
];

