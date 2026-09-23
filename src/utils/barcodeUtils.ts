/**
 * Barcode Scanner Utility for Mobile, Tablet & Physical HID Scanners
 * Includes Thai Kedmanee Keyboard layout converter, robust buffer parser,
 * and support for scanners without trailing ENTER.
 */

// Thai Kedmanee to English QWERTY keyboard map
const THAI_TO_ENG_MAP: Record<string, string> = {
  // Numbers & Symbols row
  'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0', 'ข': '-', 'ช': '=',
  '๑': '!', '๒': '@', '๓': '#', '๔': '$', 'ู': '^', '฿': '&', '๕': '*', '๖': '(', '๗': ')', '๘': '_', '๙': '+',

  // Top row
  'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't', 'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p', 'บ': '[', 'ล': ']', 'ฃ': '\\',
  '๐': 'Q', '"': 'W', 'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ํ': 'Y', '๊': 'U', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P', 'ฐ': '{',

  // Middle row
  'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g', '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': '\'',
  'ฤ': 'A', 'ฆ': 'S', 'ฏ': 'D', 'โ': 'F', 'ฌ': 'G', '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':',

  // Bottom row
  'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b', 'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
  'ฒ': 'Z', 'ฬ': 'X', 'ฦ': 'C', 'ฮ': 'V', 'ฺ': 'B', '์': 'N'
};

/**
 * Computes standard GS1 Modulo-10 checksum digit for 12 data digits of an EAN-13 barcode.
 */
export function calculateEan13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12.charAt(i), 10) || 0;
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Transforms any barcode or product code into a 100% valid 13-digit EAN-13 barcode
 * (with 885 Thailand GS1 country prefix and verified Modulo-10 check digit).
 */
export function toValidEan13(input: string, seedNumber?: number): string {
  const clean = (input || '').trim();
  const digitsOnly = clean.replace(/\D/g, '');

  // Case 1: Already 13 digits - verify and recalculate the check digit
  if (digitsOnly.length === 13) {
    const base12 = digitsOnly.substring(0, 12);
    const correctCheck = calculateEan13CheckDigit(base12);
    return `${base12}${correctCheck}`;
  }

  // Case 2: 12 digits - calculate and append the 13th check digit
  if (digitsOnly.length === 12) {
    const correctCheck = calculateEan13CheckDigit(digitsOnly);
    return `${digitsOnly}${correctCheck}`;
  }

  // Case 3: 1 to 11 digits - pad to 9 digits and prefix with Thailand 885
  if (digitsOnly.length > 0 && digitsOnly.length <= 11) {
    const padded = digitsOnly.padStart(9, '0');
    const base12 = `885${padded.slice(-9)}`;
    const correctCheck = calculateEan13CheckDigit(base12);
    return `${base12}${correctCheck}`;
  }

  // Case 4: Alphanumeric (e.g. "PEN-BL-001") - generate deterministic unique 13-digit EAN-13
  let hash = seedNumber !== undefined ? seedNumber : 0;
  if (!hash) {
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);
  }
  const paddedHash = String(hash % 1000000000).padStart(9, '0');
  const base12 = `885${paddedHash}`;
  const correctCheck = calculateEan13CheckDigit(base12);
  return `${base12}${correctCheck}`;
}

/**
 * Format 13-digit EAN-13 for human-readable label display: "8 850123 000010"
 */
export function formatEan13Display(ean13Value: string): string {
  const clean = toValidEan13(ean13Value);
  if (clean.length === 13) {
    return `${clean.charAt(0)} ${clean.substring(1, 7)} ${clean.substring(7, 13)}`;
  }
  return clean;
}

/**
 * Converts barcode text that was accidentally typed in Thai keyboard layout
 * back into English letters and numbers.
 * Example: "ยำน-ิส-001" -> "PEN-BL-001"
 */
export function convertThaiToEngBarcode(raw: string): string {
  if (!raw) return '';
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (THAI_TO_ENG_MAP[char]) {
      result += THAI_TO_ENG_MAP[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Cleans and normalizes a barcode string:
 * 1. Converts Thai keyboard text to English
 * 2. Trims leading/trailing whitespace and control chars
 * 3. Converts to uppercase
 */
export function normalizeBarcode(raw: string): string {
  if (!raw) return '';
  const converted = convertThaiToEngBarcode(raw);
  return converted.replace(/[\x00-\x1F\x7F]/g, '').trim().toUpperCase();
}

/**
 * Maps library or engine format name to clean display format name
 */
export function formatBarcodeTypeName(format: string | number | undefined): string {
  if (!format) return 'Auto Detected';
  const str = String(format).toUpperCase();
  if (str.includes('128') || str === '5') return 'Code 128';
  if (str.includes('39') || str === '3') return 'Code 39';
  if (str.includes('EAN_13') || str.includes('EAN-13') || str === '9') return 'EAN-13';
  if (str.includes('EAN_8') || str.includes('EAN-8') || str === '10') return 'EAN-8';
  if (str.includes('UPC_A') || str.includes('UPC-A') || str === '14') return 'UPC-A';
  if (str.includes('UPC_E') || str.includes('UPC-E') || str === '15') return 'UPC-E';
  if (str.includes('QR') || str === '0') return 'QR Code';
  if (str.includes('DATA_MATRIX') || str === '6') return 'Data Matrix';
  if (str.includes('ITF') || str === '8') return 'ITF';
  if (str.includes('INTERNAL') || str.includes('SYS') || str.includes('WMS-')) return 'Internal';
  return str.replace(/_/g, ' ');
}

/**
 * Intelligent Barcode Format Detector based on raw value characteristics
 * Used for USB/Bluetooth/Wireless Keyboard Wedge scanners and manual entry.
 */
export function detectBarcodeFormatFromValue(value: string): string {
  if (!value) return 'Unknown';
  const clean = value.trim();

  // Internal / System-generated Barcode prefix
  if (/^(WMS-|SYS-|INT-|REQ-|PICK-|SHIP-|DO-)/i.test(clean)) {
    return 'Internal';
  }

  // QR Code indicators (URLs, JSON, pipe-separated, or explicit -QR suffix)
  if (
    clean.includes('http://') ||
    clean.includes('https://') ||
    clean.startsWith('{') ||
    clean.endsWith('-QR') ||
    clean.includes('|')
  ) {
    return 'QR Code';
  }

  // Numeric checks
  if (/^\d+$/.test(clean)) {
    if (clean.length === 13) return 'EAN-13';
    if (clean.length === 12) return 'UPC-A';
    if (clean.length === 8) return 'EAN-8';
    if (clean.length === 6 || clean.length === 7) return 'UPC-E';
    if (clean.length === 14) return 'ITF';
  }

  // Code 39 allows uppercase letters, digits, and specific symbols: - . $ / + % SPACE
  // If short alphanumeric like PROD001 or NOT-A4-014
  if (/^[0-9A-Z\-.$/+% ]+$/.test(clean) && (clean.startsWith('PROD') || clean.includes('-A4-') || clean.includes('-A5-') || clean.includes('-A6-'))) {
    return 'Code 39';
  }

  // Default standard alphanumeric barcode in warehouse
  return 'Code 128';
}

/**
 * Highly robust barcode/SKU comparator supporting:
 * - Thai keyboard conversions (Kedmanee to English)
 * - Case-insensitivity and control character trimming
 * - Leading zero normalization (e.g. 12-digit UPC vs 13-digit EAN-13: 885012300001 vs 0885012300001)
 * - Punctuation / whitespace / hyphen stripping (e.g. PEN-BL-001 vs PENBL001)
 * - URL/QR code prefix stripping (e.g. https://.../PEN-BL-001 or SKU:PEN-BL-001)
 * - Additional barcode aliases lookup from ProductBarcode table
 * - Exact product name match fallback
 */
export function isBarcodeOrSkuMatch(
  input: string | undefined | null,
  target: { sku?: string; barcode?: string; name?: string } | undefined | null,
  additionalBarcodes: { sku: string; barcodeValue: string }[] = []
): boolean {
  if (!input || !target) return false;

  const rawInput = String(input).trim();
  if (!rawInput) return false;

  const normalizedInput = normalizeBarcode(rawInput);
  const targetSku = (target.sku || '').trim().toUpperCase();
  const targetBc = (target.barcode || '').trim().toUpperCase();
  const targetName = (target.name || '').trim().toLowerCase();

  // Extract possible payload if input is a URL or has prefix like "SKU:" or "ITEM:"
  let payload = normalizedInput;
  if (payload.includes('/')) {
    const parts = payload.split('/');
    payload = parts[parts.length - 1] || payload;
  }
  if (payload.includes(':')) {
    const parts = payload.split(':');
    payload = parts[parts.length - 1] || payload;
  }

  // Set of candidate representations of the input
  const inputVariants = new Set<string>([
    rawInput.toUpperCase(),
    normalizedInput,
    payload,
    rawInput.replace(/^0+/, '').toUpperCase(),
    normalizedInput.replace(/^0+/, ''),
    payload.replace(/^0+/, ''),
    rawInput.replace(/[-\s_]/g, '').toUpperCase(),
    normalizedInput.replace(/[-\s_]/g, ''),
    payload.replace(/[-\s_]/g, ''),
  ]);

  const inputDigits = normalizedInput.replace(/\D/g, '');
  if (inputDigits.length === 13) {
    inputVariants.add(inputDigits.substring(0, 12));
  } else if (inputDigits.length === 12) {
    inputVariants.add(toValidEan13(inputDigits));
  }

  // Set of candidate representations of the target
  const targetVariants = new Set<string>();
  if (targetSku) {
    targetVariants.add(targetSku);
    targetVariants.add(targetSku.replace(/^0+/, ''));
    targetVariants.add(targetSku.replace(/[-\s_]/g, ''));
    const eanVariant = toValidEan13(targetSku);
    targetVariants.add(eanVariant);
  }
  if (targetBc) {
    targetVariants.add(targetBc);
    targetVariants.add(targetBc.replace(/^0+/, ''));
    targetVariants.add(targetBc.replace(/[-\s_]/g, ''));
    const eanVariant = toValidEan13(targetBc);
    targetVariants.add(eanVariant);
    if (eanVariant.length === 13) {
      targetVariants.add(eanVariant.substring(0, 12));
    }
  }

  // Check direct intersection
  for (const iv of inputVariants) {
    if (!iv) continue;
    if (targetVariants.has(iv)) return true;
  }

  // Check additional barcodes table
  if (targetSku && additionalBarcodes.length > 0) {
    const targetBcAliases = additionalBarcodes
      .filter((b) => b.sku.trim().toUpperCase() === targetSku)
      .map((b) => b.barcodeValue.trim().toUpperCase());

    for (const alias of targetBcAliases) {
      const aliasVariants = [
        alias,
        alias.replace(/^0+/, ''),
        alias.replace(/[-\s_]/g, ''),
      ];
      for (const iv of inputVariants) {
        if (!iv) continue;
        if (aliasVariants.includes(iv)) return true;
      }
    }
  }

  // Check exact or partial product name if user typed or selected name
  if (targetName && (rawInput.toLowerCase() === targetName || normalizedInput.toLowerCase() === targetName)) {
    return true;
  }

  return false;
}
