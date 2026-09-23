/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WMSProvider } from './context/WMSContext';
import { Sidebar, ViewType } from './components/Sidebar';
import { Header } from './components/Header';
import {
  LayoutDashboard,
  FileText,
  Plus,
  CheckSquare,
  Menu,
  Share2,
  Copy,
  Check,
  Globe,
  Cloud,
} from 'lucide-react';
import { getPublicSharedUrl } from './components/ShareLinkModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { InventoryView } from './components/views/InventoryView';
import { ProductsView } from './components/views/ProductsView';
import { ScannerView } from './components/views/ScannerView';
import { RequisitionView } from './components/views/RequisitionView';
import { PickingView } from './components/views/PickingView';
import { PackingView } from './components/views/PackingView';
import { ShippingView } from './components/views/ShippingView';
import { MovementView } from './components/views/MovementView';
import { LocationView } from './components/views/LocationView';
import { KPIView } from './components/views/KPIView';
import { UsersView } from './components/views/UsersView';
import { ReportsView } from './components/views/ReportsView';
import { CodeEditorView } from './components/views/CodeEditorView';

function WMSApp() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoOpenCreateReq, setAutoOpenCreateReq] = useState(false);
  const [selectedPickOrderId, setSelectedPickOrderId] = useState<string | undefined>(undefined);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | undefined>(undefined);
  const [copiedTopLink, setCopiedTopLink] = useState(false);
  const [showLineTip, setShowLineTip] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return /Line\//i.test(navigator.userAgent);
    }
    return false;
  });

  const isDevHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev-') ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1')
  );

  const [cloudUrl, setCloudUrl] = useState<string>('https://corner-jump-chapel-chemistry.trycloudflare.com');
  const [copiedCloudTopLink, setCopiedCloudTopLink] = useState(false);

  React.useEffect(() => {
    fetch('/api/v1/system/info')
      .then((res) => res.json())
      .then((data) => {
        if (data?.cloudTunnelUrl) {
          setCloudUrl(data.cloudTunnelUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyCloudTopLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cloudUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = cloudUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedCloudTopLink(true);
      setTimeout(() => setCopiedCloudTopLink(false), 3000);
    } catch {
      setCopiedCloudTopLink(true);
      setTimeout(() => setCopiedCloudTopLink(false), 3000);
    }
  };

  const handleCopyTopPublicLink = async () => {
    const url = getPublicSharedUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedTopLink(true);
      setTimeout(() => setCopiedTopLink(false), 3000);
    } catch {
      setCopiedTopLink(true);
      setTimeout(() => setCopiedTopLink(false), 3000);
    }
  };

  const handleTopShareLine = () => {
    const url = getPublicSharedUrl();
    const text = encodeURIComponent(
      `📦 ระบบจัดการคลังสินค้า WMS (Warehouse Management System)\nใครมีลิงก์นี้เปิดเข้าใช้งานได้ทุกคน ไม่ต้องมี AI Studio หรือบัญชี Google:\n👉 ${url}`
    );
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank');
  };

  const handleNavigateToPicking = (pickId: string) => {
    setSelectedPickOrderId(pickId);
    setCurrentView('picking');
    setSidebarOpen(false);
  };

  const handleNavigateToRequisitions = (reqId?: string) => {
    setSelectedRequisitionId(reqId);
    setCurrentView('requests');
    setSidebarOpen(false);
  };

  const handleQuickCreateRequisition = () => {
    setCurrentView('requests');
    setAutoOpenCreateReq(true);
    setSidebarOpen(false);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={(view) => setCurrentView(view)}
          />
        );
      case 'inventory':
        return <InventoryView />;
      case 'products':
        return <ProductsView />;
      case 'scanner':
        return (
          <ScannerView
            onNavigateToPicking={handleNavigateToPicking}
            onNavigateToRequisitions={handleNavigateToRequisitions}
          />
        );
      case 'requests':
        return (
          <RequisitionView
            initialReqId={selectedRequisitionId}
            onNavigateToPicking={handleNavigateToPicking}
            autoOpenCreate={autoOpenCreateReq}
            onCloseAutoCreate={() => setAutoOpenCreateReq(false)}
          />
        );
      case 'picking':
        return (
          <PickingView
            initialOrderId={selectedPickOrderId}
            onNavigateToPacking={() => setCurrentView('packing')}
            onNavigateToRequisitions={handleNavigateToRequisitions}
          />
        );
      case 'packing':
        return <PackingView />;
      case 'shipping':
        return <ShippingView />;
      case 'movement':
        return <MovementView />;
      case 'location':
        return <LocationView />;
      case 'kpi':
        return <KPIView />;
      case 'users':
        return <UsersView />;
      case 'reports':
        return <ReportsView />;
      case 'code-editor':
        return <CodeEditorView />;
      default:
        return <DashboardView onNavigate={(v) => setCurrentView(v)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setCurrentView(v);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Developer Warning & 1-Click Public Link Sharing Banner */}
        {isDevHost && (
          <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white px-3 sm:px-4 py-2 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs z-30">
            <div className="flex items-start sm:items-center gap-2">
              <span className="p-1 bg-black/20 rounded-md text-xs leading-none shrink-0 mt-0.5 sm:mt-0 font-mono font-bold">
                ⚠️ คำเตือน
              </span>
              <div>
                <p className="font-extrabold text-white text-xs leading-tight">
                  ต้องการให้เพื่อนหรือคนทั่วไป (ที่ไม่มี AI Studio) เข้าใช้งานได้:
                </p>
                <p className="text-amber-100 text-[11px] mt-0.5 leading-snug">
                  <strong>ห้ามคัดลอกจากแถบ URL ด้านบนเบราว์เซอร์</strong> เพราะคนอื่นจะติดสิทธิ์ AI Studio • ให้กดปุ่มนี้เพื่อส่ง <strong>"ลิงก์สาธารณะ"</strong> แทน:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleCopyCloudTopLink}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${
                  copiedCloudTopLink
                    ? 'bg-emerald-600 text-white ring-2 ring-white'
                    : 'bg-indigo-900 hover:bg-indigo-800 text-white ring-1 ring-white/30'
                }`}
                title="ลิงก์ Cloud ตรง 100% ไม่ผ่าน Google AI Studio"
              >
                {copiedCloudTopLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>คัดลอกลิงก์ Cloud แล้ว!</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-indigo-300" />
                    <span>คัดลอกลิงก์ Cloud สด (ไม่ติด AI Studio)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyTopPublicLink}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${
                  copiedTopLink
                    ? 'bg-emerald-600 text-white ring-2 ring-white'
                    : 'bg-slate-950 hover:bg-slate-900 text-white ring-1 ring-white/20'
                }`}
              >
                {copiedTopLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>คัดลอกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>ลิงก์สาธารณะ</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleTopShareLine}
                className="px-3 py-1.5 bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                title="ส่งลิงก์สาธารณะเข้า LINE ให้เพื่อนเปิดได้ทันที"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>ส่ง LINE</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onQuickCreateRequisition={handleQuickCreateRequisition}
          onOpenCodeEditor={() => setCurrentView('code-editor')}
        />

        {/* LINE In-App Browser Helper Tip */}
        {showLineTip && (
          <div className="bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span>💡</span>
              <span>
                กำลังเปิดในแอป LINE: หากต้องการใช้งานกล้องสแกนบาร์โค้ดได้เต็มประสิทธิภาพ แนะนำให้แตะจุด 3 จุด [⋮] มุมขวาบน แล้วเลือก <strong>"เปิดในเบราว์เซอร์อื่น" (Safari / Chrome)</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLineTip(false)}
              className="px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded text-xs font-bold cursor-pointer shrink-0"
              title="ปิดการแจ้งเตือน"
            >
              รับทราบ
            </button>
          </div>
        )}

        {/* Dynamic View Content with bottom spacing for mobile nav bar */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {renderCurrentView()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed for quick 1-touch mobile access) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => {
            setCurrentView('dashboard');
            setSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg cursor-pointer ${
            currentView === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">ภาพรวม</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentView('requests');
            setSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg cursor-pointer ${
            currentView === 'requests' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">ใบเบิก</span>
        </button>

        {/* Highlighted Center Mobile Action: Quick Requisition */}
        <button
          type="button"
          onClick={handleQuickCreateRequisition}
          className="flex flex-col items-center justify-center -mt-5 py-2 px-3.5 bg-gradient-to-tr from-indigo-600 to-blue-600 active:scale-95 text-white rounded-full shadow-lg border-2 border-white cursor-pointer"
          title="สร้างใบเบิกสินค้าใหม่ทันที"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-extrabold tracking-tight mt-0.5">สร้างเบิก</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentView('picking');
            setSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg cursor-pointer ${
            currentView === 'picking' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">หยิบสินค้า</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSidebarOpen(!sidebarOpen);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg cursor-pointer ${
            sidebarOpen ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">เมนู</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <WMSProvider>
      <WMSApp />
    </WMSProvider>
  );
}

