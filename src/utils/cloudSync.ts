// Universal Cross-Device & Cross-Browser Synchronization Utility
// Connects any device, mobile phone, tablet, and PC across ais-dev and ais-pre into the exact same live database.

const APPLET_ID = 'c882910e';
export const SYNC_ACTIONS_TOPIC = `wms_${APPLET_ID}_v3_actions`;
export const SHARED_STORAGE_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a0cdee70e47a7b';
const NTFY_BASE = 'https://ntfy.sh';

// Generate or retrieve persistent unique Device ID for this browser tab/session
export function getDeviceId(): string {
  try {
    const key = 'wms_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'dev-' + Math.random().toString(36).slice(2, 8);
  }
}

export interface SyncMessage {
  id: string;
  senderDeviceId: string;
  senderName?: string;
  action: 'CREATE_REQUISITION' | 'CONFIRM_PICK' | 'APPROVE_REQUISITION' | 'DISPATCH_SHIPMENT' | 'RESET_STATE' | 'STATE_SYNC';
  timestamp: number;
  payload: any;
}

/**
 * Broadcast an operational action to all other devices in real-time via ntfy pub/sub
 */
export async function broadcastSyncAction(
  action: SyncMessage['action'],
  payload: any,
  senderName?: string
): Promise<boolean> {
  const deviceId = getDeviceId();
  const message: SyncMessage = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    senderDeviceId: deviceId,
    senderName: senderName || 'เพื่อนในระบบ',
    action,
    timestamp: Date.now(),
    payload,
  };

  try {
    const payloadStr = JSON.stringify(message);
    const res = await fetch(`${NTFY_BASE}/${SYNC_ACTIONS_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': `WMS_${action}`,
        'Tags': 'wms',
      },
      body: payloadStr,
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudSync] Broadcast error:', err);
    return false;
  }
}

/**
 * Upload the latest complete database state snapshot to universal cloud store
 */
let lastSnapshotUploadTime = 0;
let isUploading = false;
let pendingUploadState: any = null;

export async function uploadStateSnapshot(state: any): Promise<boolean> {
  if (!state) return false;
  pendingUploadState = state;

  const now = Date.now();
  if (isUploading || now - lastSnapshotUploadTime < 1000) {
    return true;
  }

  isUploading = true;
  lastSnapshotUploadTime = now;

  try {
    const dataToSave = pendingUploadState || state;
    // Extract only essential transactional data to keep payload fast and light
    const body = {
      name: `wms_shared_save_${APPLET_ID}`,
      data: {
        version: Date.now(),
        lastUpdatedMs: Date.now(),
        savedAtStr: new Date().toLocaleTimeString('th-TH'),
        requisitions: dataToSave.requisitions || [],
        pickingOrders: dataToSave.pickingOrders || [],
        shipments: dataToSave.shipments || [],
        products: (dataToSave.products || []).map((p: any) => ({
          sku: p.sku,
          currentStock: p.currentStock,
        })),
        employeeKPIs: dataToSave.employeeKPIs || [],
      },
    };

    const res = await fetch(SHARED_STORAGE_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    isUploading = false;
    return res.ok;
  } catch (err) {
    isUploading = false;
    console.warn('[CloudSync] Snapshot upload error:', err);
    return false;
  }
}

/**
 * Fetch latest state snapshot from universal cloud store
 */
export async function fetchLatestSnapshot(): Promise<any | null> {
  try {
    const res = await fetch(SHARED_STORAGE_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('[CloudSync] Fetch snapshot error:', err);
  }
  return null;
}

/**
 * Subscribe to real-time events from all connected browsers
 */
export function subscribeToSyncActions(onMessage: (msg: SyncMessage) => void): () => void {
  const myDeviceId = getDeviceId();
  let es: EventSource | null = null;
  let isClosed = false;

  const handleRawPayload = (rawStr: string) => {
    try {
      const raw = JSON.parse(rawStr);
      let targetPayload = raw.message || raw;
      if (typeof targetPayload === 'string') {
        try {
          targetPayload = JSON.parse(targetPayload);
        } catch {
          return;
        }
      }
      if (targetPayload && targetPayload.senderDeviceId && targetPayload.action) {
        if (targetPayload.senderDeviceId !== myDeviceId) {
          onMessage(targetPayload as SyncMessage);
        }
      }
    } catch {}
  };

  const connect = () => {
    if (isClosed) return;
    try {
      es = new EventSource(`${NTFY_BASE}/${SYNC_ACTIONS_TOPIC}/sse`);

      es.onmessage = (e) => {
        handleRawPayload(e.data);
      };

      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      console.warn('[CloudSync] SSE connection error:', err);
      if (!isClosed) {
        setTimeout(connect, 4000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (es) {
      es.close();
      es = null;
    }
  };
}
