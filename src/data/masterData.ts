import { Product, WarehouseLocation, User, Requisition, PickingOrder, Shipment, StockTransaction, EmployeeKPI, ProductBarcode } from '../types/wms';

export const INITIAL_PRODUCTS: Product[] = [
  // ZONE A - Fast Moving (PEN-BL-001 - PAP-A4-010)
  { no: 1, sku: 'PEN-BL-001', name: 'ปากกาลูกลื่นสีน้ำเงิน', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 500, currentStock: 500, dailyOrder: 80, abc: 'A', location: 'A-01-01', zone: 'A', barcode: '8850123000010', barcodeType: 'EAN-13', minStock: 100, maxStock: 800, unitPrice: 12, lotBatch: 'LOT-2026-A01', receivedDate: '01/09/2026', expiryDate: '31/12/2028', status: 'Available' },
  { no: 2, sku: 'PEN-RD-002', name: 'ปากกาลูกลื่นสีแดง', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 300, currentStock: 300, dailyOrder: 65, abc: 'A', location: 'A-01-02', zone: 'A', barcode: '8850123000027', barcodeType: 'EAN-13', minStock: 80, maxStock: 600, unitPrice: 12, lotBatch: 'LOT-2026-A02', receivedDate: '01/09/2026', expiryDate: '31/12/2028', status: 'Available' },
  { no: 3, sku: 'PEN-BK-003', name: 'ปากกาลูกลื่นสีดำ', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 450, currentStock: 450, dailyOrder: 75, abc: 'A', location: 'A-01-03', zone: 'A', barcode: '8850123000034', barcodeType: 'EAN-13', minStock: 100, maxStock: 750, unitPrice: 12, lotBatch: 'LOT-2026-A03', receivedDate: '01/09/2026', expiryDate: '31/12/2028', status: 'Available' },
  { no: 4, sku: 'PEN-GR-004', name: 'ปากกาเจลสีเขียว', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 250, currentStock: 250, dailyOrder: 40, abc: 'A', location: 'A-02-01', zone: 'A', barcode: '8850123000041', barcodeType: 'EAN-13', minStock: 60, maxStock: 500, unitPrice: 18, lotBatch: 'LOT-2026-A04', receivedDate: '02/09/2026', expiryDate: '30/11/2028', status: 'Available' },
  { no: 5, sku: 'PEN-BL-005', name: 'ปากกาเจลสีน้ำเงิน', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 350, currentStock: 350, dailyOrder: 55, abc: 'A', location: 'A-02-02', zone: 'A', barcode: '8850123000058', barcodeType: 'EAN-13', minStock: 80, maxStock: 600, unitPrice: 18, lotBatch: 'LOT-2026-A05', receivedDate: '02/09/2026', expiryDate: '30/11/2028', status: 'Available' },
  { no: 6, sku: 'PEN-BK-006', name: 'ปากกาเจลดำ', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 300, currentStock: 300, dailyOrder: 50, abc: 'A', location: 'A-02-03', zone: 'A', barcode: '8850123000065', barcodeType: 'EAN-13', minStock: 70, maxStock: 550, unitPrice: 18, lotBatch: 'LOT-2026-A06', receivedDate: '02/09/2026', expiryDate: '30/11/2028', status: 'Available' },
  { no: 7, sku: 'PEN-MK-007', name: 'ปากกา Marker สีดำ', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 200, currentStock: 200, dailyOrder: 35, abc: 'A', location: 'A-03-01', zone: 'A', barcode: '8850123000072', barcodeType: 'EAN-13', minStock: 50, maxStock: 400, unitPrice: 25, lotBatch: 'LOT-2026-A07', receivedDate: '03/09/2026', expiryDate: '31/10/2028', status: 'Available' },
  { no: 8, sku: 'PEN-MK-008', name: 'ปากกา Marker สีแดง', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 180, currentStock: 180, dailyOrder: 30, abc: 'A', location: 'A-03-02', zone: 'A', barcode: '8850123000089', barcodeType: 'EAN-13', minStock: 40, maxStock: 350, unitPrice: 25, lotBatch: 'LOT-2026-A08', receivedDate: '03/09/2026', expiryDate: '31/10/2028', status: 'Available' },
  { no: 9, sku: 'PEN-MK-009', name: 'ปากกา Marker สีน้ำเงิน', category: 'ปากกาและเครื่องเขียน', unit: 'ด้าม', initialStock: 200, currentStock: 200, dailyOrder: 28, abc: 'A', location: 'A-03-03', zone: 'A', barcode: '8850123000096', barcodeType: 'EAN-13', minStock: 40, maxStock: 350, unitPrice: 25, lotBatch: 'LOT-2026-A09', receivedDate: '03/09/2026', expiryDate: '31/10/2028', status: 'Available' },
  { no: 10, sku: 'PAP-A4-010', name: 'กระดาษ A4 80 แกรม', category: 'กระดาษและสิ่งพิมพ์', unit: 'รีม', initialStock: 100, currentStock: 100, dailyOrder: 25, abc: 'A', location: 'A-04-01', zone: 'A', barcode: '8850123000102', barcodeType: 'EAN-13', minStock: 25, maxStock: 250, unitPrice: 135, lotBatch: 'LOT-2026-P01', receivedDate: '04/09/2026', expiryDate: '31/12/2029', status: 'Available' },

  // ZONE B - Medium Moving (PAP-A4-011 - BOX-S-020)
  { no: 11, sku: 'PAP-A4-011', name: 'กระดาษ A4 70 แกรม', category: 'กระดาษและสิ่งพิมพ์', unit: 'รีม', initialStock: 80, currentStock: 80, dailyOrder: 20, abc: 'B', location: 'B-01-01', zone: 'B', barcode: '8850123000119', barcodeType: 'EAN-13', minStock: 20, maxStock: 200, unitPrice: 115, lotBatch: 'LOT-2026-P02', receivedDate: '04/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 12, sku: 'PAP-A3-012', name: 'กระดาษ A3 80 แกรม', category: 'กระดาษและสิ่งพิมพ์', unit: 'รีม', initialStock: 60, currentStock: 60, dailyOrder: 15, abc: 'B', location: 'B-01-02', zone: 'B', barcode: '8850123000126', barcodeType: 'EAN-13', minStock: 15, maxStock: 150, unitPrice: 260, lotBatch: 'LOT-2026-P03', receivedDate: '04/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 13, sku: 'PAP-A5-013', name: 'กระดาษ A5 80 แกรม', category: 'กระดาษและสิ่งพิมพ์', unit: 'รีม', initialStock: 70, currentStock: 70, dailyOrder: 12, abc: 'B', location: 'B-01-03', zone: 'B', barcode: '8850123000133', barcodeType: 'EAN-13', minStock: 15, maxStock: 160, unitPrice: 75, lotBatch: 'LOT-2026-P04', receivedDate: '04/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 14, sku: 'NOT-A4-014', name: 'สมุดโน้ต A4', category: 'สมุดและบันทึก', unit: 'เล่ม', initialStock: 100, currentStock: 100, dailyOrder: 18, abc: 'B', location: 'B-02-01', zone: 'B', barcode: '8850123000140', barcodeType: 'EAN-13', minStock: 25, maxStock: 220, unitPrice: 45, lotBatch: 'LOT-2026-N01', receivedDate: '05/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 15, sku: 'NOT-A5-015', name: 'สมุดโน้ต A5', category: 'สมุดและบันทึก', unit: 'เล่ม', initialStock: 200, currentStock: 200, dailyOrder: 22, abc: 'B', location: 'B-02-02', zone: 'B', barcode: '8850123000157', barcodeType: 'EAN-13', minStock: 40, maxStock: 400, unitPrice: 30, lotBatch: 'LOT-2026-N02', receivedDate: '05/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 16, sku: 'NOT-A6-016', name: 'สมุดโน้ต A6', category: 'สมุดและบันทึก', unit: 'เล่ม', initialStock: 150, currentStock: 150, dailyOrder: 10, abc: 'B', location: 'B-02-03', zone: 'B', barcode: '8850123000164', barcodeType: 'EAN-13', minStock: 30, maxStock: 300, unitPrice: 20, lotBatch: 'LOT-2026-N03', receivedDate: '05/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 17, sku: 'FIL-A4-017', name: 'แฟ้มเอกสาร A4', category: 'แฟ้มและจัดเก็บเอกสาร', unit: 'อัน', initialStock: 150, currentStock: 150, dailyOrder: 16, abc: 'B', location: 'B-03-01', zone: 'B', barcode: '8850123000171', barcodeType: 'EAN-13', minStock: 30, maxStock: 300, unitPrice: 35, lotBatch: 'LOT-2026-F01', receivedDate: '06/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 18, sku: 'FIL-A4-018', name: 'แฟ้มสันกว้าง A4', category: 'แฟ้มและจัดเก็บเอกสาร', unit: 'อัน', initialStock: 100, currentStock: 100, dailyOrder: 14, abc: 'B', location: 'B-03-02', zone: 'B', barcode: '8850123000188', barcodeType: 'EAN-13', minStock: 20, maxStock: 200, unitPrice: 65, lotBatch: 'LOT-2026-F02', receivedDate: '06/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 19, sku: 'FIL-A5-019', name: 'แฟ้มเอกสาร A5', category: 'แฟ้มและจัดเก็บเอกสาร', unit: 'อัน', initialStock: 80, currentStock: 80, dailyOrder: 9, abc: 'B', location: 'B-03-03', zone: 'B', barcode: '8850123000195', barcodeType: 'EAN-13', minStock: 15, maxStock: 180, unitPrice: 28, lotBatch: 'LOT-2026-F03', receivedDate: '06/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 20, sku: 'BOX-S-020', name: 'กล่องเอกสารขนาดเล็ก', category: 'กล่องและบรรจุภัณฑ์', unit: 'ใบ', initialStock: 100, currentStock: 100, dailyOrder: 8, abc: 'B', location: 'B-04-01', zone: 'B', barcode: '8850123000201', barcodeType: 'EAN-13', minStock: 20, maxStock: 250, unitPrice: 45, lotBatch: 'LOT-2026-B01', receivedDate: '07/09/2026', expiryDate: '31/12/2030', status: 'Available' },

  // ZONE C - Slow Moving (BOX-M-021 - CLP-L-030)
  { no: 21, sku: 'BOX-M-021', name: 'กล่องเอกสารขนาดกลาง', category: 'กล่องและบรรจุภัณฑ์', unit: 'ใบ', initialStock: 80, currentStock: 80, dailyOrder: 6, abc: 'C', location: 'C-01-01', zone: 'C', barcode: '8850123000218', barcodeType: 'EAN-13', minStock: 15, maxStock: 200, unitPrice: 60, lotBatch: 'LOT-2026-B02', receivedDate: '07/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 22, sku: 'BOX-L-022', name: 'กล่องเอกสารขนาดใหญ่', category: 'กล่องและบรรจุภัณฑ์', unit: 'ใบ', initialStock: 60, currentStock: 60, dailyOrder: 5, abc: 'C', location: 'C-01-02', zone: 'C', barcode: '8850123000225', barcodeType: 'EAN-13', minStock: 12, maxStock: 150, unitPrice: 85, lotBatch: 'LOT-2026-B03', receivedDate: '07/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 23, sku: 'TAP-CLR-023', name: 'เทปใส 18 มม.', category: 'เทปและอุปกรณ์แพ็ค', unit: 'ม้วน', initialStock: 250, currentStock: 250, dailyOrder: 7, abc: 'C', location: 'C-01-03', zone: 'C', barcode: '8850123000232', barcodeType: 'EAN-13', minStock: 40, maxStock: 450, unitPrice: 18, lotBatch: 'LOT-2026-T01', receivedDate: '08/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 24, sku: 'TAP-CLR-024', name: 'เทปใส 24 มม.', category: 'เทปและอุปกรณ์แพ็ค', unit: 'ม้วน', initialStock: 200, currentStock: 200, dailyOrder: 6, abc: 'C', location: 'C-02-01', zone: 'C', barcode: '8850123000249', barcodeType: 'EAN-13', minStock: 30, maxStock: 380, unitPrice: 24, lotBatch: 'LOT-2026-T02', receivedDate: '08/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 25, sku: 'TAP-DCT-025', name: 'เทปกาว 2 หน้า', category: 'เทปและอุปกรณ์แพ็ค', unit: 'ม้วน', initialStock: 150, currentStock: 150, dailyOrder: 5, abc: 'C', location: 'C-02-02', zone: 'C', barcode: '8850123000256', barcodeType: 'EAN-13', minStock: 25, maxStock: 300, unitPrice: 32, lotBatch: 'LOT-2026-T03', receivedDate: '08/09/2026', expiryDate: '31/12/2029', status: 'Available' },
  { no: 26, sku: 'STP-S-026', name: 'ลวดเย็บกระดาษ No.10', category: 'อุปกรณ์สำนักงานเบ็ดเตล็ด', unit: 'กล่อง', initialStock: 100, currentStock: 100, dailyOrder: 4, abc: 'C', location: 'C-02-03', zone: 'C', barcode: '8850123000263', barcodeType: 'EAN-13', minStock: 20, maxStock: 220, unitPrice: 15, lotBatch: 'LOT-2026-S01', receivedDate: '09/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 27, sku: 'STP-L-027', name: 'ลวดเย็บกระดาษ No.35', category: 'อุปกรณ์สำนักงานเบ็ดเตล็ด', unit: 'กล่อง', initialStock: 80, currentStock: 80, dailyOrder: 3, abc: 'C', location: 'C-03-01', zone: 'C', barcode: '8850123000270', barcodeType: 'EAN-13', minStock: 15, maxStock: 180, unitPrice: 22, lotBatch: 'LOT-2026-S02', receivedDate: '09/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 28, sku: 'CLP-S-028', name: 'คลิปหนีบกระดาษเล็ก', category: 'อุปกรณ์สำนักงานเบ็ดเตล็ด', unit: 'กล่อง', initialStock: 120, currentStock: 120, dailyOrder: 4, abc: 'C', location: 'C-03-02', zone: 'C', barcode: '8850123000287', barcodeType: 'EAN-13', minStock: 25, maxStock: 250, unitPrice: 14, lotBatch: 'LOT-2026-C01', receivedDate: '10/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 29, sku: 'CLP-M-029', name: 'คลิปหนีบกระดาษกลาง', category: 'อุปกรณ์สำนักงานเบ็ดเตล็ด', unit: 'กล่อง', initialStock: 100, currentStock: 100, dailyOrder: 3, abc: 'C', location: 'C-03-03', zone: 'C', barcode: '8850123000294', barcodeType: 'EAN-13', minStock: 20, maxStock: 220, unitPrice: 18, lotBatch: 'LOT-2026-C02', receivedDate: '10/09/2026', expiryDate: '31/12/2030', status: 'Available' },
  { no: 30, sku: 'CLP-L-030', name: 'คลิปหนีบกระดาษใหญ่', category: 'อุปกรณ์สำนักงานเบ็ดเตล็ด', unit: 'กล่อง', initialStock: 80, currentStock: 80, dailyOrder: 2, abc: 'C', location: 'C-04-01', zone: 'C', barcode: '8850123000300', barcodeType: 'EAN-13', minStock: 15, maxStock: 180, unitPrice: 25, lotBatch: 'LOT-2026-C03', receivedDate: '10/09/2026', expiryDate: '31/12/2030', status: 'Available' },

  // MULTI-FORMAT TEST PRODUCTS (Section 3, 10, 14 Acceptance Criteria - Standardized to EAN-13)
  { no: 31, sku: 'FRU-001', name: 'Thai Coconut (มะพร้าวน้ำหอม)', category: 'ผลไม้และของสด', unit: 'ลูก', initialStock: 120, currentStock: 120, dailyOrder: 25, abc: 'A', location: 'A-01-01', zone: 'A', barcode: '8851234567890', barcodeType: 'EAN-13', minStock: 30, maxStock: 300, unitPrice: 45, lotBatch: 'LOT-2026-F01', receivedDate: '10/09/2026', expiryDate: '30/09/2026', status: 'Available' },
  { no: 32, sku: 'FRU-002', name: 'Mango (มะม่วงน้ำดอกไม้)', category: 'ผลไม้และของสด', unit: 'กก.', initialStock: 85, currentStock: 85, dailyOrder: 15, abc: 'A', location: 'A-01-02', zone: 'A', barcode: '8850123000324', barcodeType: 'EAN-13', minStock: 20, maxStock: 200, unitPrice: 60, lotBatch: 'LOT-2026-F02', receivedDate: '10/09/2026', expiryDate: '25/09/2026', status: 'Available' },
  { no: 33, sku: 'FRU-003', name: 'Durian (ทุเรียนหมอนทอง)', category: 'ผลไม้และของสด', unit: 'ลูก', initialStock: 45, currentStock: 45, dailyOrder: 10, abc: 'B', location: 'B-02-01', zone: 'B', barcode: '8850123000331', barcodeType: 'EAN-13', minStock: 10, maxStock: 100, unitPrice: 350, lotBatch: 'LOT-2026-F03', receivedDate: '10/09/2026', expiryDate: '20/09/2026', status: 'Available' },
  { no: 34, sku: 'FRU-004', name: 'Longan (ลำไยพันธุ์อีดอ)', category: 'ผลไม้และของสด', unit: 'กก.', initialStock: 150, currentStock: 150, dailyOrder: 20, abc: 'B', location: 'B-02-02', zone: 'B', barcode: '8850123000348', barcodeType: 'EAN-13', minStock: 30, maxStock: 250, unitPrice: 50, lotBatch: 'LOT-2026-F04', receivedDate: '10/09/2026', expiryDate: '28/09/2026', status: 'Available' },
  { no: 35, sku: 'FRU-005', name: 'Mangosteen (มังคุดคัดเกรด)', category: 'ผลไม้และของสด', unit: 'กก.', initialStock: 90, currentStock: 90, dailyOrder: 18, abc: 'C', location: 'C-01-01', zone: 'C', barcode: '8850123000355', barcodeType: 'EAN-13', minStock: 20, maxStock: 180, unitPrice: 80, lotBatch: 'LOT-2026-F05', receivedDate: '10/09/2026', expiryDate: '24/09/2026', status: 'Available' },
  { no: 36, sku: 'FRU-006', name: 'Rose Apple (ชมพู่ทับทิมจันทร์)', category: 'ผลไม้และของสด', unit: 'กก.', initialStock: 110, currentStock: 110, dailyOrder: 22, abc: 'A', location: 'A-02-01', zone: 'A', barcode: '8850123000362', barcodeType: 'EAN-13', minStock: 25, maxStock: 220, unitPrice: 70, lotBatch: 'LOT-2026-F06', receivedDate: '10/09/2026', expiryDate: '26/09/2026', status: 'Available' },
  { no: 37, sku: 'FRU-007', name: 'Dragon Fruit (แก้วมังกรแดง)', category: 'ผลไม้และของสด', unit: 'กก.', initialStock: 75, currentStock: 75, dailyOrder: 12, abc: 'B', location: 'B-03-01', zone: 'B', barcode: '8850123000379', barcodeType: 'EAN-13', minStock: 15, maxStock: 150, unitPrice: 55, lotBatch: 'LOT-2026-F07', receivedDate: '10/09/2026', expiryDate: '27/09/2026', status: 'Available' },
];

export const INITIAL_LOCATIONS: WarehouseLocation[] = [
  // Zone A (Fast Moving - Nearest to Packing / Dispatch)
  { code: 'A-01-01', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '01', rack: '01', shelf: '01', assignedSku: 'PEN-BL-001', maxCapacity: 1000, distanceFromPacking: 8, posX: 20, posY: 25 },
  { code: 'A-01-02', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '01', rack: '01', shelf: '02', assignedSku: 'PEN-RD-002', maxCapacity: 1000, distanceFromPacking: 10, posX: 20, posY: 35 },
  { code: 'A-01-03', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '01', rack: '01', shelf: '03', assignedSku: 'PEN-BK-003', maxCapacity: 1000, distanceFromPacking: 12, posX: 20, posY: 45 },
  { code: 'A-02-01', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '02', rack: '02', shelf: '01', assignedSku: 'PEN-GR-004', maxCapacity: 1000, distanceFromPacking: 15, posX: 28, posY: 25 },
  { code: 'A-02-02', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '02', rack: '02', shelf: '02', assignedSku: 'PEN-BL-005', maxCapacity: 1000, distanceFromPacking: 17, posX: 28, posY: 35 },
  { code: 'A-02-03', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '02', rack: '02', shelf: '03', assignedSku: 'PEN-BK-006', maxCapacity: 1000, distanceFromPacking: 19, posX: 28, posY: 45 },
  { code: 'A-03-01', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '03', rack: '03', shelf: '01', assignedSku: 'PEN-MK-007', maxCapacity: 800, distanceFromPacking: 22, posX: 36, posY: 25 },
  { code: 'A-03-02', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '03', rack: '03', shelf: '02', assignedSku: 'PEN-MK-008', maxCapacity: 800, distanceFromPacking: 24, posX: 36, posY: 35 },
  { code: 'A-03-03', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '03', rack: '03', shelf: '03', assignedSku: 'PEN-MK-009', maxCapacity: 800, distanceFromPacking: 26, posX: 36, posY: 45 },
  { code: 'A-04-01', zone: 'A', zoneName: 'Zone A (Fast Moving)', aisle: '04', rack: '04', shelf: '01', assignedSku: 'PAP-A4-010', maxCapacity: 500, distanceFromPacking: 30, posX: 44, posY: 30 },

  // Zone B (Medium Moving - Central Area)
  { code: 'B-01-01', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '01', rack: '01', shelf: '01', assignedSku: 'PAP-A4-011', maxCapacity: 400, distanceFromPacking: 38, posX: 54, posY: 25 },
  { code: 'B-01-02', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '01', rack: '01', shelf: '02', assignedSku: 'PAP-A3-012', maxCapacity: 300, distanceFromPacking: 40, posX: 54, posY: 35 },
  { code: 'B-01-03', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '01', rack: '01', shelf: '03', assignedSku: 'PAP-A5-013', maxCapacity: 400, distanceFromPacking: 42, posX: 54, posY: 45 },
  { code: 'B-02-01', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '02', rack: '02', shelf: '01', assignedSku: 'NOT-A4-014', maxCapacity: 500, distanceFromPacking: 45, posX: 62, posY: 25 },
  { code: 'B-02-02', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '02', rack: '02', shelf: '02', assignedSku: 'NOT-A5-015', maxCapacity: 600, distanceFromPacking: 47, posX: 62, posY: 35 },
  { code: 'B-02-03', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '02', rack: '02', shelf: '03', assignedSku: 'NOT-A6-016', maxCapacity: 600, distanceFromPacking: 49, posX: 62, posY: 45 },
  { code: 'B-03-01', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '03', rack: '03', shelf: '01', assignedSku: 'FIL-A4-017', maxCapacity: 500, distanceFromPacking: 52, posX: 70, posY: 25 },
  { code: 'B-03-02', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '03', rack: '03', shelf: '02', assignedSku: 'FIL-A4-018', maxCapacity: 400, distanceFromPacking: 54, posX: 70, posY: 35 },
  { code: 'B-03-03', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '03', rack: '03', shelf: '03', assignedSku: 'FIL-A5-019', maxCapacity: 400, distanceFromPacking: 56, posX: 70, posY: 45 },
  { code: 'B-04-01', zone: 'B', zoneName: 'Zone B (Medium Moving)', aisle: '04', rack: '04', shelf: '01', assignedSku: 'BOX-S-020', maxCapacity: 300, distanceFromPacking: 60, posX: 76, posY: 30 },

  // Zone C (Slow Moving - Deep Warehouse)
  { code: 'C-01-01', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '01', rack: '01', shelf: '01', assignedSku: 'BOX-M-021', maxCapacity: 250, distanceFromPacking: 68, posX: 84, posY: 20 },
  { code: 'C-01-02', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '01', rack: '01', shelf: '02', assignedSku: 'BOX-L-022', maxCapacity: 200, distanceFromPacking: 70, posX: 84, posY: 30 },
  { code: 'C-01-03', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '01', rack: '01', shelf: '03', assignedSku: 'TAP-CLR-023', maxCapacity: 600, distanceFromPacking: 72, posX: 84, posY: 40 },
  { code: 'C-02-01', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '02', rack: '02', shelf: '01', assignedSku: 'TAP-CLR-024', maxCapacity: 500, distanceFromPacking: 75, posX: 88, posY: 20 },
  { code: 'C-02-02', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '02', rack: '02', shelf: '02', assignedSku: 'TAP-DCT-025', maxCapacity: 400, distanceFromPacking: 77, posX: 88, posY: 30 },
  { code: 'C-02-03', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '02', rack: '02', shelf: '03', assignedSku: 'STP-S-026', maxCapacity: 400, distanceFromPacking: 79, posX: 88, posY: 40 },
  { code: 'C-03-01', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '03', rack: '03', shelf: '01', assignedSku: 'STP-L-027', maxCapacity: 300, distanceFromPacking: 82, posX: 92, posY: 20 },
  { code: 'C-03-02', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '03', rack: '03', shelf: '02', assignedSku: 'CLP-S-028', maxCapacity: 400, distanceFromPacking: 84, posX: 92, posY: 30 },
  { code: 'C-03-03', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '03', rack: '03', shelf: '03', assignedSku: 'CLP-M-029', maxCapacity: 350, distanceFromPacking: 86, posX: 92, posY: 40 },
  { code: 'C-04-01', zone: 'C', zoneName: 'Zone C (Slow Moving)', aisle: '04', rack: '04', shelf: '01', assignedSku: 'CLP-L-030', maxCapacity: 300, distanceFromPacking: 90, posX: 94, posY: 50 },
];

export const INITIAL_USERS: User[] = [
  { id: 'USR-01', name: 'นาย A', role: 'Requester', department: 'ฝ่ายการตลาด', avatarColor: '#3B82F6' },
  { id: 'USR-02', name: 'นาย B', role: 'Requester', department: 'ฝ่ายบัญชีและการเงิน', avatarColor: '#10B981' },
  { id: 'USR-03', name: 'นาย C', role: 'Requester', department: 'ฝ่ายทรัพยากรบุคคล', avatarColor: '#8B5CF6' },
  { id: 'USR-04', name: 'นาย D', role: 'Requester', department: 'ฝ่ายขายและการบริการ', avatarColor: '#EC4899' },
  { id: 'USR-05', name: 'นาย E', role: 'Warehouse Staff', department: 'คลังสินค้าส่วนหน้า', avatarColor: '#F59E0B' },
  { id: 'USR-06', name: 'นาย F', role: 'Warehouse Staff', department: 'คลังสินค้าส่วนหน้า', avatarColor: '#6366F1' },
  { id: 'USR-07', name: 'นาย G', role: 'Warehouse Staff', department: 'ทีม Picking Zone A', avatarColor: '#14B8A6' },
  { id: 'USR-08', name: 'นาย H', role: 'Warehouse Staff', department: 'ทีม Picking Zone B', avatarColor: '#06B6D4' },
  { id: 'USR-09', name: 'นาย I', role: 'Warehouse Staff', department: 'ทีม Picking Zone C', avatarColor: '#84CC16' },
  { id: 'USR-10', name: 'นาย J', role: 'Warehouse Staff', department: 'ทีม Picking สำรอง', avatarColor: '#EAB308' },
  { id: 'USR-11', name: 'นาย K', role: 'Warehouse Staff', department: 'จุดตรวจสอบและบรรจุภัณฑ์', avatarColor: '#F97316' },
  { id: 'USR-12', name: 'นาย L', role: 'Warehouse Staff', department: 'จุดตรวจสอบและบรรจุภัณฑ์', avatarColor: '#EF4444' },
  { id: 'USR-13', name: 'นาย M', role: 'Warehouse Manager', department: 'บริหารคลังสินค้า', avatarColor: '#6D28D9' },
  { id: 'USR-14', name: 'นาย N', role: 'Warehouse Manager', department: 'ควบคุมคุณภาพคลังสินค้า', avatarColor: '#4338CA' },
  { id: 'USR-15', name: 'นาย O', role: 'Admin', department: 'ศูนย์ควบคุมระบบ IT & WMS', avatarColor: '#1E293B' },
];

export const INITIAL_EMPLOYEE_KPIS: EmployeeKPI[] = [
  { employeeId: 'USR-07', name: 'นาย G', employeeName: 'นาย G', role: 'Picker', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-08', name: 'นาย H', employeeName: 'นาย H', role: 'Picker', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-09', name: 'นาย I', employeeName: 'นาย I', role: 'Picker', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-10', name: 'นาย J', employeeName: 'นาย J', role: 'Picker', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-05', name: 'นาย E', employeeName: 'นาย E', role: 'Warehouse Operator', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-06', name: 'นาย F', employeeName: 'นาย F', role: 'Warehouse Operator', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-11', name: 'นาย K', employeeName: 'นาย K', role: 'Packing', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
  { employeeId: 'USR-12', name: 'นาย L', employeeName: 'นาย L', role: 'Packing', ordersPicked: 0, pickingAccuracy: 100, accuracy: 100, productivity: 0, avgPickingTimeMinutes: 0, avgTimeMinutes: 0, travelDistanceMeters: 0 },
];

// Operational History (Requisitions, Picking Orders, Shipments, Transactions) - Cleared, Ready for fresh operations
export const INITIAL_REQUISITIONS: Requisition[] = [];
export const INITIAL_PICKING_ORDERS: PickingOrder[] = [];
export const INITIAL_SHIPMENTS: Shipment[] = [];
export const INITIAL_TRANSACTIONS: StockTransaction[] = [];

export const INITIAL_BARCODES: ProductBarcode[] = [
  // FRU-001 (Thai Coconut - Multiple Barcodes & Formats)
  { id: 'BC-FRU-001-1', productId: 'FRU-001', sku: 'FRU-001', barcodeValue: '8851234567890', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-FRU-001-2', productId: 'FRU-001', sku: 'FRU-001', barcodeValue: 'FRU001', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },
  { id: 'BC-FRU-001-3', productId: 'FRU-001', sku: 'FRU-001', barcodeValue: 'FRU-001-QR', barcodeFormat: 'QR Code', isPrimary: false, createdAt: '01/09/2026' },

  // FRU-002 (Mango)
  { id: 'BC-FRU-002-1', productId: 'FRU-002', sku: 'FRU-002', barcodeValue: 'ABC123456', barcodeFormat: 'Code 128', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-FRU-002-2', productId: 'FRU-002', sku: 'FRU-002', barcodeValue: 'FRU002', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // FRU-003 (Durian)
  { id: 'BC-FRU-003-1', productId: 'FRU-003', sku: 'FRU-003', barcodeValue: 'PROD001', barcodeFormat: 'Code 39', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-FRU-003-2', productId: 'FRU-003', sku: 'FRU-003', barcodeValue: 'FRU003', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // FRU-004 (Longan)
  { id: 'BC-FRU-004-1', productId: 'FRU-004', sku: 'FRU-004', barcodeValue: '123456789012', barcodeFormat: 'UPC-A', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-FRU-004-2', productId: 'FRU-004', sku: 'FRU-004', barcodeValue: 'FRU004', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // FRU-005 (Mangosteen)
  { id: 'BC-FRU-005-1', productId: 'FRU-005', sku: 'FRU-005', barcodeValue: 'SKU001-QR', barcodeFormat: 'QR Code', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-FRU-005-2', productId: 'FRU-005', sku: 'FRU-005', barcodeValue: 'FRU005', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // FRU-006 (Rose Apple - EAN-8)
  { id: 'BC-FRU-006-1', productId: 'FRU-006', sku: 'FRU-006', barcodeValue: '88512349', barcodeFormat: 'EAN-8', isPrimary: true, createdAt: '01/09/2026' },

  // FRU-007 (Dragon Fruit - UPC-E)
  { id: 'BC-FRU-007-1', productId: 'FRU-007', sku: 'FRU-007', barcodeValue: '01234565', barcodeFormat: 'UPC-E', isPrimary: true, createdAt: '01/09/2026' },

  // PEN-BL-001 (Multi-Format Test Suite & System Barcode)
  { id: 'BC-PEN-001-1', productId: 'PEN-BL-001', sku: 'PEN-BL-001', barcodeValue: '8850123000010', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-PEN-001-2', productId: 'PEN-BL-001', sku: 'PEN-BL-001', barcodeValue: 'WMS-SYS-10001', barcodeFormat: 'Internal', isPrimary: false, createdAt: '01/09/2026' },
  { id: 'BC-PEN-001-3', productId: 'PEN-BL-001', sku: 'PEN-BL-001', barcodeValue: 'PENBL001', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },
  { id: 'BC-PEN-001-4', productId: 'PEN-BL-001', sku: 'PEN-BL-001', barcodeValue: 'PEN-BL-001', barcodeFormat: 'Code 39', isPrimary: false, createdAt: '01/09/2026' },
  { id: 'BC-PEN-001-5', productId: 'PEN-BL-001', sku: 'PEN-BL-001', barcodeValue: 'PEN001-QR', barcodeFormat: 'QR Code', isPrimary: false, createdAt: '01/09/2026' },

  // PEN-RD-002
  { id: 'BC-PEN-002-1', productId: 'PEN-RD-002', sku: 'PEN-RD-002', barcodeValue: '8850123000027', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-PEN-002-2', productId: 'PEN-RD-002', sku: 'PEN-RD-002', barcodeValue: 'PENRD002', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // PEN-BK-003
  { id: 'BC-PEN-003-1', productId: 'PEN-BK-003', sku: 'PEN-BK-003', barcodeValue: '8850123000034', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '01/09/2026' },
  { id: 'BC-PEN-003-2', productId: 'PEN-BK-003', sku: 'PEN-BK-003', barcodeValue: 'PENBK003', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '01/09/2026' },

  // PAP-A4-010
  { id: 'BC-PAP-010-1', productId: 'PAP-A4-010', sku: 'PAP-A4-010', barcodeValue: '8850123000102', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '04/09/2026' },
  { id: 'BC-PAP-010-2', productId: 'PAP-A4-010', sku: 'PAP-A4-010', barcodeValue: 'PAP010', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '04/09/2026' },
  { id: 'BC-PAP-010-3', productId: 'PAP-A4-010', sku: 'PAP-A4-010', barcodeValue: 'PAP-A4-010-QR', barcodeFormat: 'QR Code', isPrimary: false, createdAt: '04/09/2026' },

  // NOT-A4-014 (Code 39 test)
  { id: 'BC-NOT-014-1', productId: 'NOT-A4-014', sku: 'NOT-A4-014', barcodeValue: '8850123000140', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '05/09/2026' },
  { id: 'BC-NOT-014-2', productId: 'NOT-A4-014', sku: 'NOT-A4-014', barcodeValue: 'NOTA4014', barcodeFormat: 'Code 128', isPrimary: false, createdAt: '05/09/2026' },

  // NOT-A5-015
  { id: 'BC-NOT-015-1', productId: 'NOT-A5-015', sku: 'NOT-A5-015', barcodeValue: '8850123000157', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '05/09/2026' },

  // FIL-A4-017
  { id: 'BC-FIL-017-1', productId: 'FIL-A4-017', sku: 'FIL-A4-017', barcodeValue: '8850123000171', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '06/09/2026' },

  // BOX-S-020 (QR Code)
  { id: 'BC-BOX-020-1', productId: 'BOX-S-020', sku: 'BOX-S-020', barcodeValue: '8850123000201', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '07/09/2026' },

  // BOX-M-021 (QR Code)
  { id: 'BC-BOX-021-1', productId: 'BOX-M-021', sku: 'BOX-M-021', barcodeValue: '8850123000218', barcodeFormat: 'EAN-13', isPrimary: true, createdAt: '07/09/2026' },
];

