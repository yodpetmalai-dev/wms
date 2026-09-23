// Firestore Cloud Sync Adapter for WMS
// Synchronizes all devices, browsers, and mobile phones to the same cloud Firestore database.
// Allows anyone with the link to view, pick, pack, and manage warehouse data freely without needing AI Studio login.

import { db, doc, setDoc, getDoc, onSnapshot } from '../firebase/config';
import { getDeviceId, SyncMessage, broadcastSyncAction } from './cloudSync';

const WMS_DOC_PATH = 'wms_cloud';
const WMS_DOC_ID = 'live_state';

export interface CloudWMSPayload {
  version: number;
  lastUpdatedMs: number;
  savedAtStr: string;
  senderDeviceId: string;
  senderName?: string;
  lastAction?: string;
  requisitions: any[];
  pickingOrders: any[];
  shipments: any[];
  products: { sku: string; currentStock: number }[];
  employeeKPIs: any[];
}

/**
 * Upload state directly to Firebase Cloud Firestore.
 * Fallbacks to universal relay if Firestore network error occurs.
 */
let isFirestoreWriting = false;
let lastFirestoreWriteTime = 0;
let pendingStateToSave: any = null;

export async function uploadToFirestoreCloud(state: any, actionName?: string, operatorName?: string): Promise<boolean> {
  if (!state) return false;
  pendingStateToSave = state;

  const now = Date.now();
  if (isFirestoreWriting || now - lastFirestoreWriteTime < 600) {
    return true;
  }

  isFirestoreWriting = true;
  lastFirestoreWriteTime = now;

  try {
    const dataToSave = pendingStateToSave || state;
    const deviceId = getDeviceId();

    const payload: CloudWMSPayload = {
      version: Date.now(),
      lastUpdatedMs: Date.now(),
      savedAtStr: new Date().toLocaleTimeString('th-TH'),
      senderDeviceId: deviceId,
      senderName: operatorName || 'เจ้าหน้าที่คลัง',
      lastAction: actionName || 'STATE_UPDATE',
      requisitions: dataToSave.requisitions || [],
      pickingOrders: dataToSave.pickingOrders || [],
      shipments: dataToSave.shipments || [],
      products: (dataToSave.products || []).map((p: any) => ({
        sku: p.sku,
        currentStock: p.currentStock,
      })),
      employeeKPIs: dataToSave.employeeKPIs || [],
    };

    const docRef = doc(db, WMS_DOC_PATH, WMS_DOC_ID);
    await setDoc(docRef, {
      updatedAt: new Date().toISOString(),
      lastOperator: payload.senderName,
      data: JSON.stringify(payload),
    }, { merge: true });

    isFirestoreWriting = false;
    return true;
  } catch (err) {
    isFirestoreWriting = false;
    console.warn('[Firestore] State upload failed, fallback to relay:', err);
    return false;
  }
}

/**
 * Fetch latest snapshot from Firebase Cloud Firestore
 */
export async function fetchFirestoreSnapshot(): Promise<CloudWMSPayload | null> {
  try {
    const docRef = doc(db, WMS_DOC_PATH, WMS_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.data) {
        return JSON.parse(data.data) as CloudWMSPayload;
      }
    }
  } catch (err) {
    console.warn('[Firestore] Fetch snapshot error:', err);
  }
  return null;
}

/**
 * Real-time listener for Firestore changes.
 * Automatically synchronizes changes across all devices.
 */
export function subscribeToFirestoreCloud(onUpdate: (payload: CloudWMSPayload) => void): () => void {
  const myDeviceId = getDeviceId();
  try {
    const docRef = doc(db, WMS_DOC_PATH, WMS_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        try {
          const raw = docSnap.data();
          if (raw && raw.data) {
            const parsed = JSON.parse(raw.data) as CloudWMSPayload;
            // Ignore echoes from self
            if (parsed.senderDeviceId !== myDeviceId) {
              onUpdate(parsed);
            }
          }
        } catch (e) {
          console.error('[Firestore] Parse error on snapshot:', e);
        }
      }
    }, (error) => {
      console.warn('[Firestore] Snapshot listener error:', error);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore] Failed to init onSnapshot:', err);
    return () => {};
  }
}
