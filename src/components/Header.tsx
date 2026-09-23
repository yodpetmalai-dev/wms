import React, { useState } from 'react';
import { useWMS } from '../context/WMSContext';
import {
  Bell,
  PlayCircle,
  RotateCcw,
  UserCheck,
  ChevronDown,
  ShieldCheck,
  AlertTriangle,
  PackageCheck,
  Truck,
  CheckCircle2,
  Wifi,
  Smartphone,
  RefreshCw,
  Share2,
  Globe,
  Menu,
  Plus,
  FileText,
  Code,
} from 'lucide-react';
import { ShareLinkModal } from './ShareLinkModal';

interface HeaderProps {
  onOpenDemoModal?: () => void;
  onToggleSidebar?: () => void;
  onQuickCreateRequisition?: () => void;
  onOpenCodeEditor?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onQuickCreateRequisition, onOpenCodeEditor }) => {
  const {
    activeUser,
    setActiveUser,
    users,
    alerts,
    dismissAlert,
    clearAllAlerts,
    kpis,
    resetToDemoData,
    isSyncConnected,
    connectedDevicesCount,
    syncWithCloudNow,
    lastSyncTime,
  } = useWMS();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncWithCloudNow();
    setTimeout(() => setIsSyncing(false), 600);
  };

  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile hamburger menu & Quick System Status Badges */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer active:scale-95"
            aria-label="Open navigation menu"
            title="เปิดเมนูนำทาง"
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>
        )}

        {/* Quick Requisition button on mobile header */}
        {onQuickCreateRequisition && (
          <button
            type="button"
            onClick={onQuickCreateRequisition}
            className="flex sm:hidden items-center gap-1 px-2.5 py-1.5 bg-indigo-600 active:scale-95 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            title="สร้างใบเบิกสินค้าใหม่ทันที"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>สร้างใบเบิก</span>
          </button>
        )}

        {/* Multi-Device Live Sync Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200 shadow-2xs">
          <span className={`w-2 h-2 rounded-full ${isSyncConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <Wifi className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
          <span>เซฟเดียวกันทุกเครื่อง (Real-time Cloud Sync)</span>
        </div>

        {/* Sync with Friends Manual Button */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          title="คลิกเพื่อซิงค์คำสั่งซื้อล่าสุดจากเครื่องเพื่อนทันที"
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : 'text-blue-500'}`} />
          <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์กับเพื่อน'}</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
            ใบเบิกรออนุมัติ: <strong className="font-mono">{kpis.pendingRequisitions}</strong>
          </span>
          <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200">
            กำลัง Picking: <strong className="font-mono">{kpis.activePicking}</strong>
          </span>
          <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
            พร้อมส่ง: <strong className="font-mono">{kpis.readyToShip}</strong>
          </span>
        </div>
      </div>

      {/* Right: Actions, Notifications, Role Switcher */}
      <div className="flex items-center gap-2.5">
        {/* Live Barcode Scanner Link */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Barcode & Hardware Ready</span>
        </div>

        {/* Full Operational Access Badge */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200 shadow-2xs"
          title="ทุกคนที่มีลิงก์ได้รับสิทธิ์ดำเนินงานเต็มรูปแบบ ไม่จำกัดสิทธิ์"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>สิทธิ์ดำเนินงาน: เต็มรูปแบบทุกคน</span>
        </div>

        {/* Public Share Link Button (Anyone with the link can access, including non-AI Studio users) */}
        <button
          onClick={() => setShareModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:opacity-95 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ring-2 ring-emerald-400/30"
          title="แชร์ลิงก์ให้บุคคลทั่วไป (คนไม่มี AI Studio ใช้งานได้ 100%)"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-100" />
          <span className="hidden sm:inline">แชร์ลิงก์ (คนไม่มี AI Studio ใช้ได้)</span>
          <span className="sm:hidden">แชร์คนทั่วไป</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse hidden md:inline-block" />
        </button>

        {/* Open Code Button */}
        {onOpenCodeEditor && (
          <button
            onClick={onOpenCodeEditor}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            title="เปิดหน้าต่างแก้ไขซอร์สโค้ดของระบบ (Open Code)"
          >
            <Code className="w-3.5 h-3.5 text-indigo-500" />
            <span>Open Code (เเก้ไขโค้ด)</span>
          </button>
        )}

        {/* Reset State Button */}
        <button
          onClick={() => {
            if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้นของระบบหรือไม่?')) {
              resetToDemoData();
            }
          }}
          title="รีเซ็ตข้อมูลเป็นค่าเริ่มต้น"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Alerts Notification Dropdown */}
        <div className="relative">
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  การแจ้งเตือนระบบ ({alerts.length})
                </span>
                {alerts.length > 0 && (
                  <button
                    onClick={clearAllAlerts}
                    className="text-[11px] text-slate-500 hover:text-rose-600 font-medium"
                  >
                    ล้างทั้งหมด
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    ไม่มีการแจ้งเตือนใหม่
                  </div>
                ) : (
                  alerts.slice(0, 10).map((alt) => (
                    <div
                      key={alt.id}
                      className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                    >
                      <div className="mt-0.5">
                        {alt.severity === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : alt.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <strong className="text-slate-800 font-semibold">{alt.title}</strong>
                          <span className="text-[10px] text-slate-400">{alt.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                          {alt.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Role Switcher Dropdown (นาย A - นาย O) */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors bg-white"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: activeUser.avatarColor }}
            >
              {activeUser.name.replace('นาย ', '')}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold text-slate-800 block leading-tight">
                {activeUser.name}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight font-medium">
                {activeUser.role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    สลับผู้ปฏิบัติงาน (15 Users)
                  </p>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    สิทธิ์เต็ม 100%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  ทุกคนที่มีลิงก์ได้รับสิทธิ์ดำเนินงานเต็มรูปแบบ (ออกใบเบิก, อนุมัติ, หยิบ, แพ็ค, ส่งของ) สามารถสลับชื่อเพื่อลงบันทึก KPI ได้ทันที
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setActiveUser(u);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${
                      u.id === activeUser.id ? 'bg-indigo-50/60 font-semibold' : ''
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.name.replace('นาย ', '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-900">{u.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {u.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {u.department}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Link Modal */}
      <ShareLinkModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </header>
  );
};
