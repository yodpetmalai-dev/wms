import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { db } from './db';
import { computeProductionKPIs } from './kpiEngine';

export const apiRouter = Router();

// Store active Server-Sent Events (SSE) connections for multi-device live sync
interface SSEClient {
  id: string;
  res: Response;
  deviceType?: string;
  connectedAt: number;
}

let sseClients: SSEClient[] = [];

// Helper to broadcast event to all active SSE client streams (all devices)
export function broadcastSSE(event: string, data: unknown) {
  const namedPayload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const messagePayload = `data: ${JSON.stringify({ type: event, payload: data })}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(namedPayload);
      client.res.write(messagePayload);
    } catch (err) {
      console.error(`Error sending SSE to client ${client.id}:`, err);
    }
  });
}

const SYNC_ACTIONS_TOPIC = 'wms_c882910e_v3_actions';
const SHARED_STORAGE_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a0cdee70e47a7b';
const NTFY_BASE = 'https://ntfy.sh';

async function broadcastToGlobalRelay(action: string, payload: any) {
  try {
    const msg = {
      id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderDeviceId: 'server-authoritative',
      senderName: 'ระบบ WMS เซิร์ฟเวอร์กลาง',
      action,
      timestamp: Date.now(),
      payload,
    };
    await fetch(`${NTFY_BASE}/${SYNC_ACTIONS_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': `WMS_${action}`,
        'Tags': 'wms',
      },
      body: JSON.stringify(msg),
    });
  } catch {}
}

async function syncStateToSharedStorage() {
  try {
    const state = db.getState();
    const body = {
      name: 'wms_shared_save_c882910e',
      data: {
        version: state.version,
        lastUpdatedMs: state.lastUpdatedMs,
        savedAtStr: new Date().toLocaleTimeString('th-TH'),
        requisitions: state.requisitions,
        pickingOrders: state.pickingOrders,
        shipments: state.shipments,
        products: state.products.map((p) => ({ sku: p.sku, currentStock: p.currentStock })),
        employeeKPIs: state.employeeKPIs,
      },
    };
    await fetch(SHARED_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {}
}

// Broadcast full state & KPI update to all devices
export function broadcastStateAndKpis(alertMsg?: string) {
  const state = db.getState();
  const kpis = computeProductionKPIs();
  const fullPayload = {
    version: state.version,
    lastUpdatedMs: state.lastUpdatedMs,
    products: state.products,
    barcodes: state.barcodes,
    locations: state.locations,
    users: state.users,
    requisitions: state.requisitions,
    pickingOrders: state.pickingOrders,
    shipments: state.shipments,
    transactions: state.transactions,
    employeeKPIs: state.employeeKPIs,
    alerts: state.alerts,
    kpis,
    activeDevicesCount: sseClients.length,
    message: alertMsg,
  };
  broadcastSSE('state_update', fullPayload);
  broadcastSSE('kpi_update', kpis);
  syncStateToSharedStorage().catch(() => {});
}

// -----------------------------------------------------------------
// 1. Server-Sent Events (SSE) Real-Time Stream Endpoint for All Devices
// -----------------------------------------------------------------
apiRouter.get('/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const clientId = `DEVICE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const userAgent = req.headers['user-agent'] || 'Unknown Device';
  const newClient: SSEClient = {
    id: clientId,
    res,
    deviceType: userAgent.includes('Mobile') ? 'Mobile' : userAgent.includes('Tablet') ? 'Tablet' : 'Desktop',
    connectedAt: Date.now(),
  };
  sseClients.push(newClient);

  // Send initial handshake, full state, and KPI
  const currentState = db.getState();
  const initialKpi = computeProductionKPIs();

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now(), totalConnectedDevices: sseClients.length })}\n\n`);
  res.write(`event: state_update\ndata: ${JSON.stringify({ ...currentState, kpis: initialKpi, activeDevicesCount: sseClients.length })}\n\n`);
  res.write(`event: kpi_update\ndata: ${JSON.stringify(initialKpi)}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'kpi_update', payload: initialKpi })}\n\n`);

  // Inform other connected devices about the newly joined device
  broadcastSSE('device_connected', { clientId, totalConnectedDevices: sseClients.length });

  // Periodic heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
    broadcastSSE('device_disconnected', { clientId, totalConnectedDevices: sseClients.length });
  });
});

// -----------------------------------------------------------------
// 2. Full State Synchronization Endpoint (GET /api/v1/state)
// -----------------------------------------------------------------
apiRouter.get('/state', (req: Request, res: Response) => {
  try {
    const state = db.getState();
    const kpis = computeProductionKPIs();
    res.json({
      success: true,
      version: state.version,
      lastUpdatedMs: state.lastUpdatedMs,
      activeDevicesCount: sseClients.length,
      data: {
        products: state.products,
        barcodes: state.barcodes,
        locations: state.locations,
        users: state.users,
        requisitions: state.requisitions,
        pickingOrders: state.pickingOrders,
        shipments: state.shipments,
        transactions: state.transactions,
        employeeKPIs: state.employeeKPIs,
        scanLogs: state.scanLogs,
        cycleCountAudits: state.cycleCountAudits,
        alerts: state.alerts,
        kpis,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve database state',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 3. Production KPI Dashboard Data Endpoint (GET /api/v1/kpi/dashboard)
// -----------------------------------------------------------------
apiRouter.get('/kpi/dashboard', (req: Request, res: Response) => {
  try {
    const kpiData = computeProductionKPIs();
    res.json({
      success: true,
      data: kpiData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to compute production KPIs',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 4. Requisitions Management
// -----------------------------------------------------------------
apiRouter.get('/requisitions', (req: Request, res: Response) => {
  const reqs = db.getRequisitions();
  res.json({ success: true, count: reqs.length, data: reqs });
});

apiRouter.post('/requisitions/create', (req: Request, res: Response) => {
  try {
    const { requestor, department, items, notes, reason } = req.body;
    if (!requestor || !department || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุข้อมูลผู้ขอเบิก แผนก และรายการสินค้าให้ครบถ้วน' });
    }

    const result = db.createRequisition({ requestor, department, items, notes, reason });
    broadcastToGlobalRelay('CREATE_REQUISITION', {
      requisition: result.requisition,
      pickingOrder: result.pickingOrder,
    });
    broadcastStateAndKpis(`สร้างใบเบิก ${result.reqId} เรียบร้อย`);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างใบเบิก',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/requisitions/approve', (req: Request, res: Response) => {
  try {
    const { reqId, approverName } = req.body;
    if (!reqId) return res.status(400).json({ success: false, message: 'Missing reqId' });

    const result = db.approveRequisition(reqId, approverName);
    if (!result.success) return res.status(404).json(result);

    broadcastStateAndKpis(`อนุมัติใบเบิก ${reqId} เรียบร้อย`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอนุมัติใบเบิก',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/requisitions/reject', (req: Request, res: Response) => {
  try {
    const { reqId, reason } = req.body;
    if (!reqId) return res.status(400).json({ success: false, message: 'Missing reqId' });

    const ok = db.rejectRequisition(reqId, reason);
    if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบใบเบิก' });

    broadcastStateAndKpis(`ปฏิเสธใบเบิก ${reqId}`);
    return res.json({ success: true, message: `ปฏิเสธใบเบิก ${reqId} สำเร็จ` });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการปฏิเสธใบเบิก',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 5. Picking Orders & Real Pick Operations
// -----------------------------------------------------------------
apiRouter.get('/orders', (req: Request, res: Response) => {
  const orders = db.getPickingOrders();
  res.json({ success: true, count: orders.length, data: orders });
});

apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const order = db.getPickingOrderById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งหยิบ' });
  return res.json({ success: true, data: order });
});

apiRouter.post('/picking/start', (req: Request, res: Response) => {
  try {
    const { pickId, pickerName } = req.body;
    if (!pickId) return res.status(400).json({ success: false, message: 'Missing pickId' });

    const result = db.startPicking(pickId, pickerName);
    if (!result.success) return res.status(404).json(result);

    broadcastStateAndKpis(`เริ่มหยิบคำสั่ง ${pickId}`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเริ่มคำสั่งหยิบ',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Real-time Pick Item Confirmation & Stock Deduction
apiRouter.post('/picking/confirm-item', (req: Request, res: Response) => {
  try {
    const { pickId, itemId, scannedBarcode, pickedQty, operatorName, source = 'hid_hardware' } = req.body;

    if (!pickId || !scannedBarcode) {
      return res.status(400).json({
        success: false,
        message: 'Missing pickId or scannedBarcode',
      });
    }

    const result = db.confirmPickItemAndDeductStock({
      pickId,
      itemId,
      scannedBarcode,
      pickedQty: Number(pickedQty) || 1,
      operatorName,
      source,
    });

    const updatedKpis = computeProductionKPIs();

    // Broadcast scan event & state update to ALL devices
    broadcastToGlobalRelay('CONFIRM_PICK', {
      pickId,
      itemId,
      sku: result.log?.expectedSku || '',
      pickedQty: Number(pickedQty) || 1,
      isAllDone: result.allCompleted,
      stockAfter: result.details?.stockAfter,
    });
    broadcastSSE('scan_event', {
      scanLog: result.log,
      isMatch: result.isMatch,
      updatedOrder: result.updatedOrder,
      kpis: updatedKpis,
    });
    broadcastStateAndKpis(result.message);

    return res.json({
      ...result,
      kpis: updatedKpis,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการยืนยันหยิบสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Barcode Scan Verification Helper
apiRouter.post('/scan/verify', (req: Request, res: Response) => {
  try {
    const { scannedCode, expectedSku, orderId, itemId, operator, source = 'hid_hardware' } = req.body;

    if (!scannedCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing scannedCode parameter',
      });
    }

    const result = db.verifyAndRecordScan({
      scannedCode,
      expectedSku,
      orderId,
      itemId,
      operator,
      source: source as 'camera' | 'hid_hardware' | 'manual',
    });

    const updatedKpis = computeProductionKPIs();

    broadcastSSE('scan_event', {
      scanLog: result.log,
      isMatch: result.isMatch,
      kpiDashboard: updatedKpis,
    });
    broadcastStateAndKpis();

    return res.json({
      ...result,
      kpis: updatedKpis,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error processing barcode scan verification',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 6. Packing & Shipping Operations
// -----------------------------------------------------------------
apiRouter.get('/shipments', (req: Request, res: Response) => {
  const shipments = db.getShipments();
  res.json({ success: true, count: shipments.length, data: shipments });
});

apiRouter.post('/shipping/issue-goods', (req: Request, res: Response) => {
  try {
    const { reqId, operatorName } = req.body;
    if (!reqId) return res.status(400).json({ success: false, message: 'Missing reqId' });

    const result = db.verifyAndIssueGoods(reqId, operatorName);
    if (!result.success) return res.status(404).json(result);

    broadcastStateAndKpis(`จ่ายสินค้า ${reqId} สถานะ Ready to Ship`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการจ่ายสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/shipping/update-status', (req: Request, res: Response) => {
  try {
    const { shipmentId, status } = req.body;
    if (!shipmentId || !status) {
      return res.status(400).json({ success: false, message: 'Missing shipmentId or status' });
    }

    const result = db.updateShipmentStatus(shipmentId, status);
    if (!result.success) return res.status(404).json(result);

    broadcastStateAndKpis(`อัปเดตสถานะจัดส่ง ${shipmentId} เป็น ${status}`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะการจัดส่ง',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 7. Inventory Stock Adjustments & Transfers
// -----------------------------------------------------------------
apiRouter.post('/inventory/adjust', (req: Request, res: Response) => {
  try {
    const { sku, newStock, reason, operator } = req.body;
    if (!sku || newStock === undefined) {
      return res.status(400).json({ success: false, message: 'Missing sku or newStock' });
    }

    const ok = db.adjustStock(sku, Number(newStock), reason || 'ปรับปรุงยอดทางกายภาพ', operator);
    if (!ok) return res.status(404).json({ success: false, message: `ไม่พบสินค้า SKU ${sku}` });

    broadcastStateAndKpis(`ปรับยอดสต็อก ${sku} เป็น ${newStock}`);
    return res.json({ success: true, message: `ปรับยอดสต็อก ${sku} เรียบร้อย` });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการปรับยอดสต็อก',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/inventory/transfer', (req: Request, res: Response) => {
  try {
    const { sku, fromLoc, toLoc, quantity, operator } = req.body;
    if (!sku || !fromLoc || !toLoc) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const ok = db.transferStock(sku, fromLoc, toLoc, Number(quantity) || 1, operator);
    if (!ok) return res.status(404).json({ success: false, message: `ไม่พบสินค้า SKU ${sku}` });

    broadcastStateAndKpis(`ย้ายสินค้า ${sku} จาก ${fromLoc} ไป ${toLoc}`);
    return res.json({ success: true, message: `ย้ายตำแหน่งสินค้า ${sku} เรียบร้อย` });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการย้ายตำแหน่งสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 8. Products & Barcodes Master Data Endpoints
// -----------------------------------------------------------------
apiRouter.get('/products', (req: Request, res: Response) => {
  const products = db.getProducts();
  res.json({ success: true, count: products.length, data: products });
});

apiRouter.get('/products/:code', (req: Request, res: Response) => {
  const prod = db.getProductBySkuOrBarcode(req.params.code);
  if (!prod) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  return res.json({ success: true, data: prod });
});

apiRouter.post('/products/add', (req: Request, res: Response) => {
  try {
    const result = db.addProduct(req.body);
    if (!result.success) return res.status(400).json(result);

    broadcastStateAndKpis(`เพิ่มสินค้าใหม่ ${result.product?.name}`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/products/update', (req: Request, res: Response) => {
  try {
    const { sku, ...updates } = req.body;
    if (!sku) {
      return res.status(400).json({ success: false, message: 'Missing sku parameter' });
    }

    const result = db.updateProduct(sku, updates);
    if (!result.success) return res.status(400).json(result);

    broadcastStateAndKpis(`แก้ไขข้อมูลสินค้า ${result.product?.name} (${result.product?.sku})`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไขสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/products/delete', (req: Request, res: Response) => {
  try {
    const { sku } = req.body;
    if (!sku) {
      return res.status(400).json({ success: false, message: 'Missing sku parameter' });
    }

    const result = db.deleteProduct(sku);
    if (!result.success) return res.status(400).json(result);

    broadcastStateAndKpis(`ลบสินค้า SKU ${sku}`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบสินค้า',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.get('/barcodes', (req: Request, res: Response) => {
  res.json({ success: true, data: db.getBarcodes() });
});

apiRouter.post('/barcodes/add', (req: Request, res: Response) => {
  try {
    const { sku, barcodeValue, barcodeFormat } = req.body;
    const result = db.addBarcodeToProduct(sku, barcodeValue, barcodeFormat);
    if (!result.success) return res.status(400).json(result);

    broadcastStateAndKpis(`ผูก Barcode "${barcodeValue}" กับ ${sku}`);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการผูก Barcode',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

apiRouter.post('/barcodes/delete', (req: Request, res: Response) => {
  try {
    const { barcodeId } = req.body;
    const ok = db.deleteBarcode(barcodeId);
    if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบบาร์โค้ด' });

    broadcastStateAndKpis(`ลบบาร์โค้ดเรียบร้อย`);
    return res.json({ success: true, message: 'ลบบาร์โค้ดเรียบร้อย' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบบาร์โค้ด',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 9. Audit Logs & Cycle Counts
// -----------------------------------------------------------------
apiRouter.get('/audit/logs', (req: Request, res: Response) => {
  const scanLogs = db.getScanLogs();
  const audits = db.getCycleCountAudits();
  res.json({
    success: true,
    scanLogs,
    cycleCountAudits: audits,
  });
});

apiRouter.post('/audit/cycle-count', (req: Request, res: Response) => {
  const { totalSampled = 10, totalMatched = 10, auditor = 'QC Inspector', notes = 'Daily random cycle count' } = req.body;
  const audit = db.recordCycleCountAudit({
    totalSampled: Number(totalSampled),
    totalMatched: Number(totalMatched),
    auditor: String(auditor),
    notes: String(notes),
  });

  broadcastStateAndKpis(`บันทึกผลสุ่มตรวจสต็อก Cycle Count (${audit.accuracyRate}%)`);

  res.json({
    success: true,
    audit,
    kpis: computeProductionKPIs(),
  });
});

// -----------------------------------------------------------------
// 10. Reset Dashboard Data to Zero (POST /api/v1/reset & /api/v1/clear-history)
// -----------------------------------------------------------------
apiRouter.post('/clear-history', (req: Request, res: Response) => {
  db.clearTransactionsAndResetToZero();
  broadcastStateAndKpis('ล้างข้อมูลใบเบิก ประวัติการหยิบ และรีเซ็ตข้อมูลเป็น 0 เรียบร้อย');

  res.json({
    success: true,
    message: 'ล้างข้อมูลใบเบิกและประวัติการหยิบเรียบร้อยแล้ว โดยคงเหลือข้อมูลสินค้าครบถ้วน',
    kpis: computeProductionKPIs(),
    products: db.getProducts(),
  });
});

apiRouter.post('/reset', (req: Request, res: Response) => {
  db.clearTransactionsAndResetToZero();
  broadcastStateAndKpis('รีเซ็ตข้อมูลการดำเนินงานทั้งหมดเป็น 0');

  res.json({
    success: true,
    message: 'Dashboard and transaction records reset to zero successfully. Master data preserved.',
    kpis: computeProductionKPIs(),
  });
});

apiRouter.post('/restore-demo', (req: Request, res: Response) => {
  db.resetToDemo();
  broadcastStateAndKpis('กู้คืนชุดข้อมูลตัวอย่างเริ่มต้น');

  res.json({
    success: true,
    message: 'Demo dataset restored successfully.',
    kpis: computeProductionKPIs(),
  });
});

// -----------------------------------------------------------------
// 11. Gemini Vision AI Barcode Analyzer (Optical Fallback & Analysis)
// -----------------------------------------------------------------
apiRouter.post('/scan/analyze-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Missing imageBase64' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, message: 'GEMINI_API_KEY is not configured on server' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        'Extract any barcode or QR code value from this image (e.g., EAN-13, EAN-8, Code 128, Code 39, UPC-A, QR Code). Return ONLY the exact barcode characters/digits without markdown, spaces, or quotes.',
      ],
      config: {
        temperature: 0.0,
        systemInstruction: 'You are a precise barcode reading assistant. Extract only the exact barcode characters or digits.',
      },
    });

    const detectedCode = (response.text || '').trim();
    if (!detectedCode) {
      return res.json({ success: false, message: 'Could not detect barcode from image' });
    }

    const product = db.getProductBySkuOrBarcode(detectedCode);

    return res.json({
      success: true,
      barcode: detectedCode,
      product,
    });
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze barcode with Gemini Vision AI',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// -----------------------------------------------------------------
// 12. System Information & Public Access Link Details
// -----------------------------------------------------------------
apiRouter.get('/system/info', (req: Request, res: Response) => {
  const envAppUrl = process.env.APP_URL || '';
  const host = req.get('host') || '';

  // Convert any dev host to public preview host (ais-dev -> ais-pre)
  let publicUrl = envAppUrl;
  if (!publicUrl && host) {
    const publicHost = host.replace(/^ais-dev-/, 'ais-pre-');
    publicUrl = `https://${publicHost}`;
  } else if (publicUrl.includes('ais-dev-')) {
    publicUrl = publicUrl.replace('ais-dev-', 'ais-pre-');
  }

  // Known fallback for AI Studio public shared URL
  if (!publicUrl || publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1')) {
    publicUrl = 'https://ais-pre-y6fl23innfzumte4y4zyc4-186105453302.asia-southeast1.run.app';
  }

  // Check for dynamic live Cloudflare tunnel URL if active
  let cloudTunnelUrl = 'https://corner-jump-chapel-chemistry.trycloudflare.com';
  try {
    if (fs.existsSync('/tmp/tunnel_live.log')) {
      const content = fs.readFileSync('/tmp/tunnel_live.log', 'utf8');
      const matches = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
      if (matches && matches.length > 0) {
        cloudTunnelUrl = matches[matches.length - 1];
      }
    }
  } catch {}

  res.json({
    success: true,
    sharedAppUrl: publicUrl,
    cloudTunnelUrl,
    appUrl: envAppUrl,
    accessPermission: 'public_anyone_with_link',
    requiresLogin: false,
    message: 'ทุกคนที่มีลิงก์นี้สามารถเข้าถึงระบบได้ทันทีโดยไม่ต้องขอสิทธิ์หรือล็อกอิน',
  });
});

// -----------------------------------------------------------------
// 13. Project & Dist ZIP Downloads for Cloud Deployment (Vercel / Netlify / Self-host)
// -----------------------------------------------------------------
apiRouter.get('/download-dist-zip', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="wms-production-dist.zip"');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory('dist/', false);
  archive.finalize();
});

apiRouter.get('/download-project-zip', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="wms-complete-source.zip"');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.pipe(res);
  archive.glob('**/*', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', '.git/**', '/tmp/**', '*.log'],
    dot: true,
  });
  archive.finalize();
});

// -----------------------------------------------------------------
// 14. Open Code & Live Code Editor Endpoints (เเก้ไขและเปิดดูโค้ดได้)
// -----------------------------------------------------------------
const PROJECT_ROOT = process.cwd();

function getSafeFilePath(requestedPath: string): string | null {
  if (!requestedPath || typeof requestedPath !== 'string') return null;
  const clean = requestedPath.replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  const resolved = path.resolve(PROJECT_ROOT, clean);
  if (!resolved.startsWith(PROJECT_ROOT)) return null;

  // Block forbidden patterns
  const normalized = resolved.toLowerCase();
  if (
    normalized.includes(path.sep + 'node_modules' + path.sep) ||
    normalized.includes(path.sep + '.git' + path.sep) ||
    normalized.includes(path.sep + 'dist' + path.sep) ||
    normalized.endsWith('.env')
  ) {
    return null;
  }
  return resolved;
}

// 14.1 Get Project File Tree
apiRouter.get('/code/tree', (_req: Request, res: Response) => {
  try {
    interface CodeFileInfo {
      path: string;
      name: string;
      size: number;
      extension: string;
      category: string;
      lines: number;
      mtime: number;
    }

    const filesList: CodeFileInfo[] = [];
    const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', '.cache', 'tmp', 'coverage']);
    const EXCLUDED_FILES = new Set(['.wms_state_store.json', 'cookies.txt', 'bun.lock']);

    function crawlDir(dirPath: string) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            crawlDir(path.join(dirPath, entry.name));
          }
        } else if (entry.isFile()) {
          if (EXCLUDED_FILES.has(entry.name) || entry.name.endsWith('.log')) continue;

          const fullPath = path.join(dirPath, entry.name);
          const relPath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
          const ext = path.extname(entry.name).replace('.', '').toLowerCase();

          // Only text/code files
          const validExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'md', 'toml', 'example'];
          if (!validExts.includes(ext) && !entry.name.startsWith('.')) continue;

          let stat: fs.Stats;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            continue;
          }

          let lineCount = 0;
          try {
            const preview = fs.readFileSync(fullPath, 'utf8');
            lineCount = preview.split('\n').length;
          } catch {}

          let category = 'Config & Root';
          if (relPath.startsWith('src/components/views/')) category = 'Views (หน้าจอ)';
          else if (relPath.startsWith('src/components/')) category = 'Components (UI)';
          else if (relPath.startsWith('src/data/')) category = 'Master Data (ข้อมูลสินค้า & คลัง)';
          else if (relPath.startsWith('src/types/')) category = 'Types & Schema';
          else if (relPath.startsWith('src/context/')) category = 'State Context';
          else if (relPath.startsWith('src/utils/')) category = 'Utils & Engines';
          else if (relPath.startsWith('server/')) category = 'Backend & API';
          else if (relPath.startsWith('src/')) category = 'Frontend Core';

          filesList.push({
            path: relPath,
            name: entry.name,
            size: stat.size,
            extension: ext || 'txt',
            category,
            lines: lineCount,
            mtime: stat.mtimeMs,
          });
        }
      }
    }

    crawlDir(PROJECT_ROOT);

    // Sort: Views first, then Data, Types, Components, Server, Config
    const priorityOrder: Record<string, number> = {
      'Master Data (ข้อมูลสินค้า & คลัง)': 1,
      'Types & Schema': 2,
      'Views (หน้าจอ)': 3,
      'Components (UI)': 4,
      'State Context': 5,
      'Utils & Engines': 6,
      'Backend & API': 7,
      'Frontend Core': 8,
      'Config & Root': 9,
    };

    filesList.sort((a, b) => {
      const pA = priorityOrder[a.category] || 99;
      const pB = priorityOrder[b.category] || 99;
      if (pA !== pB) return pA - pB;
      return a.path.localeCompare(b.path);
    });

    res.json({
      success: true,
      totalFiles: filesList.length,
      files: filesList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to crawl file tree',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 14.2 Read a Specific Code File
apiRouter.get('/code/file', (req: Request, res: Response) => {
  try {
    const requestedPath = req.query.path as string;
    if (!requestedPath) {
      return res.status(400).json({ success: false, message: 'Missing path query parameter' });
    }

    const safePath = getSafeFilePath(requestedPath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: `File not found: ${requestedPath}` });
    }

    const content = fs.readFileSync(safePath, 'utf8');
    const stat = fs.statSync(safePath);
    const relPath = path.relative(PROJECT_ROOT, safePath).replace(/\\/g, '/');
    const ext = path.extname(safePath).replace('.', '').toLowerCase();

    res.json({
      success: true,
      path: relPath,
      name: path.basename(safePath),
      content,
      size: stat.size,
      lines: content.split('\n').length,
      extension: ext,
      modifiedAt: stat.mtimeMs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read file',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 14.3 Save Edited Code to Disk
apiRouter.post('/code/save', (req: Request, res: Response) => {
  try {
    const { path: requestedPath, content } = req.body;
    if (!requestedPath || typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing path or content in request body' });
    }

    const safePath = getSafeFilePath(requestedPath);
    if (!safePath) {
      return res.status(403).json({ success: false, message: 'Access denied: invalid or forbidden file path' });
    }

    // Ensure directory exists
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file directly to disk
    fs.writeFileSync(safePath, content, 'utf8');
    const stat = fs.statSync(safePath);
    const relPath = path.relative(PROJECT_ROOT, safePath).replace(/\\/g, '/');

    // Broadcast file change alert
    db.addAlert({
      type: 'INFO',
      title: 'บันทึกแก้ไขซอร์สโค้ดสำเร็จ',
      message: `แก้ไขไฟล์ ${relPath} (${content.split('\n').length} บรรทัด, ${stat.size} ไบต์)`,
      severity: 'info',
    });
    broadcastStateAndKpis(`แก้ไขไฟล์ซอร์สโค้ด ${relPath}`);

    res.json({
      success: true,
      message: `บันทึกไฟล์ "${relPath}" สำเร็จเรียบร้อยแล้ว`,
      path: relPath,
      size: stat.size,
      lines: content.split('\n').length,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save file',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 14.4 Create a New Code File
apiRouter.post('/code/create', (req: Request, res: Response) => {
  try {
    const { path: requestedPath, content = '' } = req.body;
    if (!requestedPath) {
      return res.status(400).json({ success: false, message: 'Missing path' });
    }

    const safePath = getSafeFilePath(requestedPath);
    if (!safePath) {
      return res.status(403).json({ success: false, message: 'Access denied: invalid file path' });
    }

    if (fs.existsSync(safePath)) {
      return res.status(400).json({ success: false, message: 'ไฟล์นี้มีอยู่แล้วในระบบ' });
    }

    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, content, 'utf8');
    const relPath = path.relative(PROJECT_ROOT, safePath).replace(/\\/g, '/');

    res.json({
      success: true,
      message: `สร้างไฟล์ "${relPath}" สำเร็จ`,
      path: relPath,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create file',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 14.5 Delete a Code File
apiRouter.post('/code/delete', (req: Request, res: Response) => {
  try {
    const { path: requestedPath } = req.body;
    if (!requestedPath) {
      return res.status(400).json({ success: false, message: 'Missing path' });
    }

    const safePath = getSafeFilePath(requestedPath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Do not allow deleting essential files
    const relPath = path.relative(PROJECT_ROOT, safePath).replace(/\\/g, '/');
    const protectedFiles = ['package.json', 'server.ts', 'src/App.tsx', 'src/main.tsx', 'vite.config.ts', 'tsconfig.json'];
    if (protectedFiles.includes(relPath)) {
      return res.status(403).json({ success: false, message: `ไม่อนุญาตให้ลบไฟล์สำคัญระดับระบบ (${relPath})` });
    }

    fs.unlinkSync(safePath);
    res.json({
      success: true,
      message: `ลบไฟล์ "${relPath}" สำเร็จ`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});


