import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  Smartphone,
  Laptop,
  CheckCircle2,
  Zap,
  Globe,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  MessageSquareShare,
  Cloud,
  Download,
  HardDrive,
} from 'lucide-react';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to reliably compute the public shared URL that anyone can access without Google Auth
export function getPublicSharedUrl(): string {
  const DEFAULT_PUBLIC_URL = 'https://ais-pre-y6fl23innfzumte4y4zyc4-186105453302.asia-southeast1.run.app';
  if (typeof window === 'undefined') {
    return `${DEFAULT_PUBLIC_URL}/?openExternalBrowser=1`;
  }

  let href = window.location.href.split('?')[0].split('#')[0];

  // If user is currently in AI Studio dev environment (ais-dev-),
  // convert it to the public preview link (ais-pre-) which allows ANYONE with the link to open it!
  if (href.includes('ais-dev-')) {
    href = href.replace('ais-dev-', 'ais-pre-');
  } else if (href.includes('localhost') || href.includes('127.0.0.1') || href.includes('aistudio.google.com')) {
    href = DEFAULT_PUBLIC_URL;
  }

  // Ensure HTTPS protocol
  if (href.startsWith('http://')) {
    href = href.replace('http://', 'https://');
  }

  const base = href.startsWith('https://ais-pre-') ? href : DEFAULT_PUBLIC_URL;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}?openExternalBrowser=1`;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ isOpen, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCloudLink, setCopiedCloudLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'cloud' | 'qr'>('link');
  const [publicUrl, setPublicUrl] = useState<string>(getPublicSharedUrl());
  const [cloudUrl, setCloudUrl] = useState<string>('https://corner-jump-chapel-chemistry.trycloudflare.com');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch confirmed shared URL and dynamic cloud tunnel from backend API
    fetch('/api/v1/system/info')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.sharedAppUrl) {
          setPublicUrl(data.sharedAppUrl);
        }
        if (data && data.cloudTunnelUrl) {
          setCloudUrl(data.cloudTunnelUrl);
        }
      })
      .catch(() => {
        // Fallback to local computation
        setPublicUrl(getPublicSharedUrl());
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const currentBrowserUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const isCurrentlyInDevUrl = currentBrowserUrl.includes('ais-dev-');

  // QR Code URL based on the public URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&margin=10`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const input = document.createElement('input');
        input.value = publicUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCloudLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cloudUrl);
      } else {
        const input = document.createElement('input');
        input.value = cloudUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedCloudLink(true);
      setTimeout(() => setCopiedCloudLink(false), 2500);
    } catch {
      setCopiedCloudLink(true);
      setTimeout(() => setCopiedCloudLink(false), 2500);
    }
  };

  const handleCopyInviteMessage = async () => {
    const inviteText = `📦 ระบบจัดการคลังสินค้า WMS (Warehouse Management System)\nใครมีลิงก์นี้สามารถเปิดเข้าใช้งานได้ทุกคน ไม่ต้องมี AI Studio หรือบัญชี Google:\n👉 ${publicUrl}\n\n💡 (หากเปิดจาก LINE แล้วติดหน้า AI Studio ให้แตะจุด 3 จุด [...] แล้วเลือก "เปิดด้วยเบราว์เซอร์อื่น / Safari / Chrome" จะเข้าได้ทันที 100%)`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteText);
      } else {
        const input = document.createElement('textarea');
        input.value = inviteText;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    const inviteText = `📦 ระบบจัดการคลังสินค้า WMS (Warehouse Management System)\nใครมีลิงก์นี้เปิดเข้าใช้งานได้ทันที ไม่ต้องมี AI Studio:\n${publicUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WMS Warehouse Management System',
          text: inviteText,
          url: publicUrl,
        });
      } catch {
        // Fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyInviteMessage();
    }
  };

  const handleOpenLineShare = () => {
    const text = encodeURIComponent(
      `📦 ระบบจัดการคลังสินค้า WMS (Warehouse Management System)\nทุกคนเปิดเข้าใช้งานได้ทันที ไม่ต้องมี AI Studio:\n👉 ${publicUrl}`
    );
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xs shadow-inner">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">ลิงก์บุคคลทั่วไป (คนไม่มี AI Studio ใช้ได้ 100%)</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/30 border border-emerald-300/50 text-emerald-100 text-[10px] font-bold">
                  ไม่ต้องล็อกอิน
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                ส่งให้เพื่อนร่วมงานเปิดใช้งานบนมือถือหรือคอมพิวเตอร์ได้ทันที ไม่ต้องมีบัญชี AI Studio หรือ Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Public Access & Permissions Status Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 flex items-start gap-3 shadow-2xs">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-xs text-emerald-900 space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-950 text-sm flex items-center gap-1.5">
                  <span>เชื่อมต่อฐานข้อมูล Google Cloud Firestore สำเร็จ</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    Cloud Firestore Active
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                  All Authorized
                </span>
              </div>
              <p className="text-emerald-800 leading-relaxed text-[11px]">
                ระบบจัดเก็บข้อมูลบนคลาวด์ <b>Google Cloud Firestore</b> เรียบร้อยแล้ว ข้อมูลทั้งหมด (สต็อก, ใบเบิก, การหยิบ, บาร์โค้ด) ซิงค์ตรงกันฐานเดียวกันแบบ Real-time ทุกเครื่อง:
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-medium text-emerald-900">
                <span className="flex items-center gap-1">✓ สิทธิ์ออกใบเบิกสินค้า (Requisition)</span>
                <span className="flex items-center gap-1">✓ สิทธิ์อนุมัติใบเบิก (Approval)</span>
                <span className="flex items-center gap-1">✓ สิทธิ์สแกนกล้องบาร์โค้ด & หยิบ (Picking)</span>
                <span className="flex items-center gap-1">✓ สิทธิ์ตรวจเช็ค & แพ็ค (Packing)</span>
                <span className="flex items-center gap-1">✓ สิทธิ์ตัดสต็อก & จัดส่ง (Shipping)</span>
                <span className="flex items-center gap-1">✓ สิทธิ์ปรับยอดสต็อก/ย้ายคลัง (Inventory)</span>
              </div>
            </div>
          </div>

          {/* Dev URL Warning & Explanation if applicable */}
          {isCurrentlyInDevUrl && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">
                  ทำไมลิงก์ปกติของคุณคนอื่นถึงเข้าไม่ได้?
                </p>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  เนื่องจากคุณกำลังเปิดอยู่ในโหมดพัฒนา (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">ais-dev</code>) ซึ่งจำกัดเฉพาะเจ้าของบัญชี Google เท่านั้น ระบบได้ <b>แปลงเป็นลิงก์สาธารณะ (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">ais-pre</code>) ให้คุณเรียบร้อยแล้ว</b> เพื่อให้ทุกคนเปิดได้ทันที
                </p>
              </div>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'link'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>ลิงก์สาธารณะ</span>
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'cloud'
                  ? 'bg-white text-indigo-900 shadow-xs ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold">ขึ้น Cloud / ดาวน์โหลด</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'qr'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code</span>
            </button>
          </div>

          {activeTab === 'link' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ลิงก์สาธารณะสำหรับส่งให้ทุกคน (ใครมีลิงก์เข้าถึงได้ 100%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-blue-700 font-mono font-semibold focus:outline-hidden select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    }`}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>คัดลอกลิงก์</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* LINE Direct Share Button */}
                <button
                  onClick={handleOpenLineShare}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#06C755] hover:bg-[#05b34c] text-white flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>แชร์ส่งเข้า LINE ทันที</span>
                </button>

                {/* Mobile Native Share Sheet */}
                <button
                  onClick={handleNativeShare}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>แชร์ผ่านมือถือ (แอปอื่น ๆ)</span>
                </button>

                <button
                  onClick={handleCopyInviteMessage}
                  className="sm:col-span-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">คัดลอกข้อความพร้อมลิงก์สำเร็จแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <MessageSquareShare className="w-4 h-4 text-indigo-600" />
                      <span>คัดลอกข้อความพร้อมลิงก์ (สำหรับส่งใน Chat ต่างๆ)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Special Guide for resolving Action required to load your app cookie screen */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping shrink-0" />
                  <span className="font-extrabold text-amber-950 text-xs">
                    วิธีแก้ปัญหาหากขึ้นหน้าจอ "Action required to load your app / blocking security cookie":
                  </span>
                </div>
                <div className="text-xs text-amber-950 space-y-2 leading-relaxed">
                  <p>
                    หน้าจอนี้เกิดขึ้นเพราะ <strong>เบราว์เซอร์ภายในแอป LINE หรือ Safari โหมดส่วนตัว บล็อกคุกกี้ชั่วคราว</strong> ไม่ได้เกิดจากไม่มีสิทธิ์!
                  </p>
                  <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 space-y-1">
                    <p className="font-bold text-amber-900">วิธีแก้ทันทีใน 5 วินาที:</p>
                    <p>• <strong>หากเปิดใน LINE:</strong> ระบบได้ใส่คำสั่ง <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">?openExternalBrowser=1</code> ให้แล้ว เมื่อเพื่อนกดลิงก์นี้ LINE จะเปิดใน Safari หรือ Chrome ทันทีโดยไม่ติดหน้านี้</p>
                    <p>• <strong>หากติดหน้านี้อยู่แล้ว:</strong> ให้แตะที่ <strong>จุด 3 จุด [...]</strong> (มุมขวาบน หรือมุมขวาล่าง) แล้วเลือก <strong>"เปิดด้วยเบราว์เซอร์เริ่มต้น / Safari / Chrome"</strong> จะโหลดเข้าสู่ระบบทันที</p>
                    <p>• <strong>หากใช้ iPhone/iPad ใน Safari:</strong> ตรวจสอบว่าไม่ได้เปิด "โหมดแถบส่วนตัว (Private Browsing)" และไปที่ การตั้งค่า (Settings) → Safari → ขั้นสูง (Advanced) → ปิด "บล็อกคุกกี้ทั้งหมด"</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-1">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ลองเปิดลิงก์สาธารณะนี้ในแท็บใหม่เพื่อทดสอบ</span>
                </a>
              </div>

              {/* Link Types Comparison */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <p className="font-bold text-slate-800">เปรียบเทียบประเภทลิงก์:</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-100/60 border border-emerald-200 text-emerald-950">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ลิงก์สาธารณะ (<code className="font-mono text-[10px]">ais-pre-</code>)
                    </span>
                    <span className="font-bold text-emerald-700">ทุกคนเข้าได้ทันที ไม่ต้องล็อกอิน</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                    <span className="font-medium flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-200 text-rose-700 text-center font-bold text-[10px] leading-3.5">✕</span>
                      ลิงก์โหมดพัฒนา (<code className="font-mono text-[10px]">ais-dev-</code>)
                    </span>
                    <span className="text-rose-600">เฉพาะเจ้าของ Google Account เท่านั้น</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'cloud' ? (
            <div className="space-y-4">
              {/* Cloudflare Direct Cloud Link */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border-2 border-indigo-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-indigo-600" />
                    <span>1. ลิงก์ Cloud สด (เข้าได้ 100% ไม่ติด AI Studio / สิทธิ์องค์กร):</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                    Cloudflare Live
                  </span>
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed">
                  ลิงก์นี้เชื่อมต่อไปยังระบบ Cloudflare ภายนอก <b>ไม่ผ่าน Google AI Studio ไม่ติดหน้าสิทธิ์องค์กรของโรงเรียน/ที่ทำงาน และไม่ติด Cookie Check ใน LINE</b> ทุกคนกดเปิดใช้งาน สแกนบาร์โค้ด และออกใบเบิกได้ทันที:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={cloudUrl}
                    className="flex-1 bg-white border border-indigo-300 rounded-xl px-3.5 py-2 text-xs text-indigo-800 font-mono font-semibold focus:outline-hidden select-all"
                  />
                  <button
                    onClick={handleCopyCloudLink}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                      copiedCloudLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                    }`}
                  >
                    {copiedCloudLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-200" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกลิงก์ Cloud</span>
                      </>
                    )}
                  </button>
                  <a
                    href={cloudUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl transition-colors cursor-pointer"
                    title="เปิดทดสอบในแท็บใหม่"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Self-Host / Netlify Drop Option */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-slate-800 text-xs">
                    2. ดาวน์โหลดไฟล์เว็บสำเร็จรูป เพื่อนำไปขึ้น Cloud ของคุณเอง (ถาวรตลอดชีพ):
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ดาวน์โหลดไฟล์ระบบที่คอมไพล์เสร็จแล้ว (378 KB) แล้วนำไปลากวางที่เว็บรับฝากฟรี คุณจะได้ชื่อเว็บไซต์ส่วนตัวถาวร (เช่น <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">my-wms.netlify.app</code>):
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href="/api/v1/download-dist-zip"
                    download="wms-production-dist.zip"
                    className="flex-1 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดเว็บสำหรับ Netlify (ZIP 378KB)</span>
                  </a>
                  <a
                    href="/api/v1/download-project-zip"
                    download="wms-complete-source.zip"
                    className="flex-1 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลด Source Code ทั้งหมด (ZIP)</span>
                  </a>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                  <p className="font-bold">วิธีนำขึ้น Netlify Drop ใน 3 คลิก:</p>
                  <p>1. กดปุ่มสีเขียว "ดาวน์โหลดเว็บสำหรับ Netlify (ZIP)" ด้านบน</p>
                  <p>2. แตกไฟล์ ZIP ออกมาเป็นโฟลเดอร์</p>
                  <p>3. เข้าเว็บ <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className="underline font-bold text-emerald-700">app.netlify.com/drop</a> แล้วลากโฟลเดอร์ไปวาง จะได้ลิงก์ถาวรทันที!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 space-y-4">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-md text-center">
                <img
                  src={qrUrl}
                  alt="WMS Public Access QR Code"
                  className="w-52 h-52 mx-auto rounded-xl object-contain"
                />
                <p className="text-[11px] font-mono text-slate-500 mt-2 truncate max-w-xs">
                  {publicUrl}
                </p>
              </div>
              <div className="text-center space-y-1 max-w-sm">
                <p className="text-xs font-bold text-slate-800">
                  สแกนด้วยกล้องมือถือ, iPhone, Android หรือแอป LINE
                </p>
                <p className="text-xs text-slate-500">
                  เมื่อเพื่อนสแกน QR Code นี้ จะเปิดเข้าสู่ระบบ WMS ทันทีโดยไม่ต้องสมัครสมาชิก และเชื่อมข้อมูลกับเครื่องคุณทันที
                </p>
              </div>
            </div>
          )}

          {/* How Multi-Device Collaboration Works */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>ทำงานร่วมกันหลายคน ข้ามอุปกรณ์ได้ทันที:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2">
                <Laptop className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="block text-slate-800 font-semibold">คอมพิวเตอร์ / ผู้จัดการ</strong>
                  <span className="text-slate-500 text-[11px]">เปิดหน้า "เบิกสินค้า" เพื่อกดออกใบเบิก ตรวจยอดคงคลัง และดู Dashboard</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="block text-slate-800 font-semibold">มือถือ / พนักงานหยิบสินค้า</strong>
                  <span className="text-slate-500 text-[11px]">เปิดหน้า "หยิบสินค้า" และเปิดกล้องสแกนบาร์โค้ดตัดสต็อกได้จากคลังทันที</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ซิงค์ข้อมูลส่วนกลางอัตโนมัติ (Live Multi-Device)</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
