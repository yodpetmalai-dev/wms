// Server-side Firebase Cloud Firestore + Universal Relay sync adapter.
// Lets the servers boot from the SAME persistent cloud database all devices share,
// so data & status survive Render free-tier restarts and stay linked across every device.

import fs from 'fs';
import path from 'path';
import { db } from './db';

const CONFIG_PATH = path.join(process.cwd(), 'firebase-applet-config.json');
const RELAY_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a0cdee70e47a7b';

interface FirestoreConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
}

function loadConfig(): FirestoreConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as FirestoreConfig;
  } catch {
    return {};
  }
}

function firestoreDocUrl(docPath: string, extraQuery = ''): string | null {
  const cfg = loadConfig();
  if (!cfg.projectId || !cfg.firestoreDatabaseId || !cfg.apiKey) return null;
  const base =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
    `/databases/${cfg.firestoreDatabaseId}/documents/${docPath}`;
  return `${base}?${extraQuery}key=${cfg.apiKey}`;
}

/**
 * Fetch the latest cloud snapshot from Firebase Cloud Firestore via REST.
 * Uses the exact same "wms_cloud/live_state" doc all devices read/write.
 */
export async function fetchFirestoreCloudSnapshot(): Promise<any | null> {
  try {
    const url = firestoreDocUrl('wms_cloud/live_state');
    if (!url) return null;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.fields && json.fields.data && json.fields.data.stringValue) {
      return JSON.parse(json.fields.data.stringValue);
    }
  } catch {}
  return null;
}

/**
 * Write the authoritative server state to Firestore so it survives restarts
 * and propagates to every connected browser even if SSE is interrupted.
 */
export async function writeFirestoreCloudSnapshot(state: any): Promise<boolean> {
  try {
    const docPath = 'wms_cloud/live_state';
    const cfg = loadConfig();
    const url = firestoreDocUrl(
      docPath,
      'updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=lastOperator&updateMask.fieldPaths=data&'
    );
    if (!url || !state) return false;

    const payload = {
      version: state.version || Date.now(),
      lastUpdatedMs: state.lastUpdatedMs || Date.now(),
      savedAtStr: new Date().toLocaleTimeString('th-TH'),
      senderDeviceId: 'server-authoritative',
      senderName: 'ระบบ WMS เซิร์ฟเวอร์กลาง',
      lastAction: 'SERVER_SYNC',
      requisitions: state.requisitions || [],
      pickingOrders: state.pickingOrders || [],
      shipments: state.shipments || [],
      products: (state.products || []).map((p: any) => ({
        sku: p.sku,
        currentStock: p.currentStock,
      })),
      employeeKPIs: state.employeeKPIs || [],
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          updatedAt: { stringValue: new Date().toISOString() },
          lastOperator: { stringValue: 'ระบบ WMS เซิร์ฟเวอร์กลาง' },
          data: { stringValue: JSON.stringify(payload) },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch the latest state snapshot from the universal relay (fallback store).
 */
export async function fetchRelaySnapshot(): Promise<any | null> {
  try {
    const res = await fetch(RELAY_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.data ? json.data : null;
  } catch {
    return null;
  }
}

function countReq(snapshot: any): number {
  return snapshot && Array.isArray(snapshot.requisitions) ? snapshot.requisitions.length : 0;
}

function pickNewer(a: any, b: any): any | null {
  if (!a) return b;
  if (!b) return a;
  const ca = countReq(a);
  const cb = countReq(b);
  if (ca === cb) {
    return (a.lastUpdatedMs || 0) >= (b.lastUpdatedMs || 0) ? a : b;
  }
  return ca > cb ? a : b;
}

/**
 * Bootstrap the server database from the persistent cloud store.
 * Safe to re-run: only missing requisitions/orders/shipments/stocks are restored.
 */
export async function bootstrapFromCloud(): Promise<any> {
  const [fsSnap, relaySnap] = await Promise.all([
    fetchFirestoreCloudSnapshot().catch(() => null),
    fetchRelaySnapshot().catch(() => null),
  ]);

  const best = pickNewer(fsSnap, relaySnap);
  if (!best) {
    console.log('[WMS-bootstrap] No cloud snapshot found, keeping current state.');
    return { restored: false, counts: {}, reason: 'no-cloud-data' };
  }

  const result = db.mergeCloudSnapshot(best);
  console.log('[WMS-bootstrap] Cloud restore result:', JSON.stringify(result));
  return result;
}