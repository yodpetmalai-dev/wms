import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Code,
  FileCode,
  Save,
  RotateCcw,
  Copy,
  Check,
  Download,
  Search,
  Plus,
  Trash2,
  FolderTree,
  FileText,
  Terminal,
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Folder,
  Layers,
  Server,
  Settings,
  Database,
  Sliders,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface CodeFileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  category: string;
  lines: number;
  mtime: number;
}

export const CodeEditorView: React.FC = () => {
  const [files, setFiles] = useState<CodeFileInfo[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [activeFilePath, setActiveFilePath] = useState<string>('src/data/masterData.ts');
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [fontSize, setFontSize] = useState<number>(13);
  const [editorTheme, setEditorTheme] = useState<'dark' | 'light'>('dark');
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch File Tree
  const fetchFileTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch('/api/v1/code/tree');
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
        // If current active file not in files, pick first
        if (!data.files.some((f: CodeFileInfo) => f.path === activeFilePath) && data.files.length > 0) {
          setActiveFilePath(data.files[0].path);
        }
      }
    } catch (err) {
      console.error('Failed to load code files tree:', err);
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    fetchFileTree();
  }, []);

  // Fetch Active File Content
  const loadFileContent = async (filePath: string) => {
    setLoadingFile(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/v1/code/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setOriginalContent(data.content);
      } else {
        setSaveStatus({ type: 'error', message: data.message || 'ไม่สามารถเปิดไฟล์ได้' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'เกิดข้อผิดพลาดในการโหลดไฟล์' });
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (activeFilePath) {
      loadFileContent(activeFilePath);
    }
  }, [activeFilePath]);

  const hasUnsavedChanges = fileContent !== originalContent;

  // Handle Save
  const handleSaveFile = async () => {
    if (!activeFilePath) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/v1/code/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFilePath, content: fileContent }),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(fileContent);
        setSaveStatus({ type: 'success', message: `บันทึกไฟล์ "${activeFilePath}" สำเร็จเรียบร้อยแล้ว` });
        // Update tree info
        setFiles((prev) =>
          prev.map((f) =>
            f.path === activeFilePath
              ? { ...f, size: data.size, lines: data.lines, mtime: Date.now() }
              : f
          )
        );
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus({ type: 'error', message: data.message || 'บันทึกไฟล์ไม่สำเร็จ' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'เกิดข้อผิดพลาดในการบันทึกไฟล์' });
    } finally {
      setSaving(false);
    }
  };

  // Handle Tab key in Textarea (Indent instead of blurring)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveFile();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowFindBar(true);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const spaces = '  ';
      const newContent = fileContent.substring(0, start) + spaces + fileContent.substring(end);
      setFileContent(newContent);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + spaces.length;
      }, 0);
    }
  };

  // Update cursor line & column
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const textBefore = ta.value.substring(0, ta.selectionStart);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  // Copy code
  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fileContent);
      } else {
        const ta = document.createElement('textarea');
        ta.value = fileContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download Single File
  const handleDownloadActiveFile = () => {
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFilePath.split('/').pop() || 'code.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Create New File
  const handleCreateNewFile = async () => {
    if (!newFilePath.trim()) return;
    try {
      const res = await fetch('/api/v1/code/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newFilePath.trim(), content: '// New file created in Open Code Editor\n' }),
      });
      const data = await res.json();
      if (data.success) {
        setNewFileModalOpen(false);
        setNewFilePath('');
        await fetchFileTree();
        setActiveFilePath(data.path);
      } else {
        alert(data.message || 'ไม่สามารถสร้างไฟล์ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์');
    }
  };

  // Replace text
  const handleReplaceAll = () => {
    if (!findQuery) return;
    const count = fileContent.split(findQuery).length - 1;
    const newContent = fileContent.split(findQuery).join(replaceQuery);
    setFileContent(newContent);
    setSaveStatus({ type: 'success', message: `แทนที่คำค้นหา "${findQuery}" สำเร็จ ${count} ตำแหน่ง` });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch =
        f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'ALL' || f.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [files, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => set.add(f.category));
    return ['ALL', ...Array.from(set)];
  }, [files]);

  // Line numbers calculation
  const lineCount = useMemo(() => {
    return Math.max(1, fileContent.split('\n').length);
  }, [fileContent]);

  const activeFileInfo = files.find((f) => f.path === activeFilePath);

  // Quick Bookmarks to Key Files
  const keyFiles = [
    { label: 'Master Data (30 SKUs)', path: 'src/data/masterData.ts', icon: <Database className="w-3.5 h-3.5 text-amber-500" /> },
    { label: 'Server Routes (API)', path: 'server/routes.ts', icon: <Server className="w-3.5 h-3.5 text-indigo-500" /> },
    { label: 'WMS Context (Logic)', path: 'src/context/WMSContext.tsx', icon: <Layers className="w-3.5 h-3.5 text-blue-500" /> },
    { label: 'Types & Schema', path: 'src/types/wms.ts', icon: <FileCode className="w-3.5 h-3.5 text-emerald-500" /> },
    { label: 'Main App (Router)', path: 'src/App.tsx', icon: <Sliders className="w-3.5 h-3.5 text-rose-500" /> },
    { label: 'Database Engine', path: 'server/db.ts', icon: <Database className="w-3.5 h-3.5 text-purple-500" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                Open Code & Live Editor (เปิดดูและแก้ไขซอร์สโค้ดของระบบ)
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  แก้ไขได้จริง
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกไฟล์เพื่อดูโค้ด แก้ไข logic ข้อมูล Master Data, API Endpoints หรือการแสดงผล และกดบันทึกเพื่ออัปเดตระบบทันที
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setNewFileModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="สร้างไฟล์โค้ดใหม่"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>สร้างไฟล์ใหม่</span>
          </button>

          <a
            href="/api/v1/download-project-zip"
            download="wms-complete-source.zip"
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="ดาวน์โหลด Source Code ทั้งโปรเจกต์เป็นไฟล์ ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลดทั้งโปรเจกต์ (.ZIP)</span>
          </a>
        </div>
      </div>

      {/* Quick Bookmark Buttons */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
        <span className="text-slate-400 font-semibold px-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          ไฟล์หลักที่ใช้งานบ่อย:
        </span>
        {keyFiles.map((kf) => (
          <button
            key={kf.path}
            onClick={() => setActiveFilePath(kf.path)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              activeFilePath === kf.path
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {kf.icon}
            <span>{kf.label}</span>
          </button>
        ))}
      </div>

      {/* Main Workspace: File Tree (Left) + Code Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Project File Explorer */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-[700px] overflow-hidden">
          {/* Search and Category Filter */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-indigo-600" />
                โครงสร้างไฟล์ ({filteredFiles.length} ไฟล์)
              </span>
              <button
                onClick={fetchFileTree}
                disabled={loadingTree}
                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                title="รีเฟรชรายการไฟล์"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อไฟล์ หรือ path..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'หมวดหมู่: ทั้งหมด' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
            {loadingTree ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                <p>กำลังอ่านโครงสร้างไฟล์...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                ไม่พบไฟล์ที่ตรงกับคำค้นหา
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isActive = file.path === activeFilePath;
                return (
                  <button
                    key={file.path}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        if (!confirm(`ไฟล์ ${activeFilePath} มีการแก้ไขที่ยังไม่ได้บันทึก คุณต้องการสลับไฟล์หรือไม่?`)) {
                          return;
                        }
                      }
                      setActiveFilePath(file.path);
                    }}
                    className={`w-full p-2 rounded-lg text-left text-xs transition-colors flex items-start gap-2 cursor-pointer group ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <FileCode
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate block font-mono text-[11px] leading-tight">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {file.lines} lns
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block font-mono">
                        {file.path}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* File Tree Footer */}
          <div className="p-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex justify-between items-center">
            <span>รวม {files.length} ไฟล์</span>
            <span className="font-mono text-emerald-600 font-medium">Editable OK</span>
          </div>
        </div>

        {/* Right: Live Interactive Code Editor */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-[700px] overflow-hidden">
          
          {/* Editor Header Bar */}
          <div className="p-3 border-b border-slate-200 bg-slate-900 text-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-slate-800 rounded-lg text-indigo-400">
                <FileCode className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-white truncate">
                    {activeFilePath}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ยังไม่บันทึก (Modified)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{lineCount} บรรทัด</span>
                  <span>•</span>
                  <span>{activeFileInfo ? `${Math.round(activeFileInfo.size / 1024 * 10) / 10} KB` : 'Text'}</span>
                  <span>•</span>
                  <span>UTF-8</span>
                  <span>•</span>
                  <span className="uppercase">{activeFileInfo?.extension || 'txt'}</span>
                </div>
              </div>
            </div>

            {/* Editor Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Find in file */}
              <button
                onClick={() => setShowFindBar(!showFindBar)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showFindBar ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="ค้นหาและแทนที่ (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ค้นหา/แทนที่</span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setEditorTheme(editorTheme === 'dark' ? 'light' : 'dark')}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="เปลี่ยนธีม Editor (มืด / สว่าง)"
              >
                {editorTheme === 'dark' ? '☀️ แสง' : '🌙 มืด'}
              </button>

              {/* Font Size Selector */}
              <div className="hidden sm:flex items-center bg-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 gap-1">
                <span>ขนาด:</span>
                <button
                  onClick={() => setFontSize((s) => Math.max(11, s - 1))}
                  className="hover:text-white px-1 font-bold"
                >
                  -
                </button>
                <span className="font-mono font-bold">{fontSize}</span>
                <button
                  onClick={() => setFontSize((s) => Math.min(18, s + 1))}
                  className="hover:text-white px-1 font-bold"
                >
                  +
                </button>
              </div>

              {/* Copy */}
              <button
                onClick={handleCopyCode}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                title="คัดลอกโค้ดทั้งหมด"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Download this file */}
              <button
                onClick={handleDownloadActiveFile}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                title="ดาวน์โหลดไฟล์นี้ลงคอมพิวเตอร์"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Revert Changes */}
              {hasUnsavedChanges && (
                <button
                  onClick={() => {
                    if (confirm('คุณต้องการยกเลิกการเปลี่ยนแปลงทั้งหมดในไฟล์นี้ใช่หรือไม่?')) {
                      setFileContent(originalContent);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="ย้อนกลับสู่โค้ดเดิมก่อนแก้ไข"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ย้อนกลับ</span>
                </button>
              )}

              {/* SAVE BUTTON */}
              <button
                onClick={handleSaveFile}
                disabled={saving || !hasUnsavedChanges}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse ring-2 ring-emerald-400/40'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="บันทึกการแก้ไขลงไฟล์จริง (Ctrl+S)"
              >
                <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                <span>{saving ? 'กำลังบันทึก...' : 'บันทึกโค้ด'}</span>
              </button>
            </div>
          </div>

          {/* Search & Replace Floating Bar */}
          {showFindBar && (
            <div className="p-2.5 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center gap-2 text-xs text-white animate-in slide-in-from-top-2">
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700 flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="ค้นหาคำในโค้ด..."
                  className="bg-transparent text-white focus:outline-none w-full font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700 flex-1 min-w-[180px]">
                <span className="text-slate-400 text-[11px]">แทนที่:</span>
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="คำที่จะแทนที่..."
                  className="bg-transparent text-white focus:outline-none w-full font-mono text-xs"
                />
              </div>

              <button
                onClick={handleReplaceAll}
                disabled={!findQuery}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded text-xs transition-colors cursor-pointer"
              >
                แทนที่ทั้งหมด (Replace All)
              </button>

              <button
                onClick={() => setShowFindBar(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Save Status Toast Notice */}
          {saveStatus && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {saveStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{saveStatus.message}</span>
              </div>
              <button
                onClick={() => setSaveStatus(null)}
                className="text-white/80 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Editor Workspace with Line Numbers */}
          <div className="flex-1 flex overflow-hidden relative">
            {loadingFile ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-slate-900 text-slate-300">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs font-mono">กำลังเปิดไฟล์ {activeFilePath}...</p>
              </div>
            ) : (
              <>
                {/* Line Numbers Column */}
                <div
                  className={`select-none text-right pr-3 pl-2 py-3 font-mono overflow-hidden shrink-0 border-r ${
                    editorTheme === 'dark'
                      ? 'bg-slate-950 text-slate-600 border-slate-800'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.5rem', width: '50px' }}
                >
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i + 1} className={i + 1 === cursorPos.line ? 'text-indigo-400 font-bold' : ''}>
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Textarea Code Editor */}
                <textarea
                  ref={textareaRef}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onSelect={handleTextareaSelect}
                  onClick={handleTextareaSelect}
                  onKeyUp={handleTextareaSelect}
                  spellCheck={false}
                  wrap="off"
                  className={`flex-1 p-3 font-mono resize-none focus:outline-none leading-6 overflow-auto ${
                    editorTheme === 'dark'
                      ? 'bg-slate-900 text-slate-100 caret-indigo-400 selection:bg-indigo-900/70'
                      : 'bg-white text-slate-900 caret-indigo-600 selection:bg-indigo-100'
                  }`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.5rem' }}
                />
              </>
            )}
          </div>

          {/* Bottom Editor Status Bar */}
          <div
            className={`px-4 py-1.5 border-t text-[11px] font-mono flex flex-wrap items-center justify-between select-none ${
              editorTheme === 'dark'
                ? 'bg-slate-950 text-slate-400 border-slate-800'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span>
                บรรทัด {cursorPos.line}, คอลัมน์ {cursorPos.col}
              </span>
              <span>•</span>
              <span>รวม {lineCount} บรรทัด</span>
              <span>•</span>
              <span>{fileContent.length} ตัวอักษร</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline">กด Ctrl+S หรือ Cmd+S เพื่อบันทึกทันที</span>
              <span>•</span>
              <span className={hasUnsavedChanges ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {hasUnsavedChanges ? '● มีการแก้ไข' : '✓ บันทึกแล้ว'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* New File Modal */}
      {newFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              สร้างไฟล์โค้ดใหม่ในโปรเจกต์
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ระบุ Relative Path ของไฟล์ใหม่ (เช่น <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">src/data/customData.ts</code>)
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  File Path
                </label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="src/components/MyCustomWidget.tsx"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setNewFileModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleCreateNewFile}
                  disabled={!newFilePath.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  สร้างไฟล์
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
