
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, RotateCcw, Wallet, 
  BarChart3, Archive, Bell, ShieldCheck, AlertCircle, Mail,
  Trash2, Menu, LogOut, UserCog, Landmark, Terminal, Truck, Clock, X, UserCircle, History, Users, ChevronLeft, BellRing, Inbox, ClipboardCheck, Building2, Printer, Copy, PackageX, AlertTriangle, Eye, Barcode,
  CheckCircle2, Settings, UserPlus, ShieldAlert, Fingerprint
} from 'lucide-react';
import { ViewType, Product, User as UserType, SystemSettings, LeaveRequest, Correspondence } from '../types';

// @ts-ignore
declare var JsBarcode: any;

export const copyToClipboard = (text: string, onShowToast?: (message: string, type: 'success' | 'error') => void) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    onShowToast?.(`تم نسخ الكود: ${text}`, "success");
  }).catch(() => {
    onShowToast?.("فشل في نسخ الكود", "error");
  });
};

interface LayoutProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  products: Product[];
  leaveRequests?: LeaveRequest[];
  messages?: Correspondence[];
  onReset: () => void;
  onRestore: (data: any) => void;
  children?: React.ReactNode;
  toast: { message: string; type: 'success' | 'error' } | null;
  onCloseToast: () => void;
  user: UserType;
  onLogout: () => void;
  settings: SystemSettings;
  users?: UserType[]; 
  roles?: any[]; 
  branches?: any[];
  checkPermission: (user: any, action: any) => boolean;
}

const Layout = ({ 
  currentView, setView, products, leaveRequests = [], messages = [], children, toast, onCloseToast, 
  user, onLogout, settings, users = [], roles = [], branches = [], checkPermission
}: LayoutProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedNotifProduct, setSelectedNotifProduct] = useState(null as Product | null);
  
  const notifRef = useRef(null as HTMLDivElement | null);

  const lowStockItems = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.filter(p => !p.isDeleted && p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock);
  }, [products]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedNotifProduct) {
      setTimeout(() => {
        const svg = document.getElementById('notif-barcode-svg');
        if (svg && typeof JsBarcode !== 'undefined') {
          JsBarcode(svg, selectedNotifProduct.code, {
            format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, font: "Cairo", margin: 10
          });
        }
      }, 100);
    }
  }, [selectedNotifProduct]);

  const unreadMessagesCount = useMemo(() => {
    if (!messages) return 0;
    return messages.filter(m => 
      !m.isRead && m.senderId !== user.id && !m.isDeleted && !m.isArchived &&
      (m.receiverId === user.id || m.receiverRole === user.role || m.isBroadcast)
    ).length;
  }, [messages, user]);

  const pendingLeavesCount = useMemo(() => {
    if (!checkPermission(user, 'approve_leaves')) return 0;
    return leaveRequests.filter(l => {
      const isPending = l.status === 'pending' && !l.isArchived && !l.isDeleted && l.userId !== user.id;
      if (!isPending) return false;
      if (user.branchId) {
        const requester = users?.find(u => u.id === l.userId);
        return requester?.branchId === user.branchId;
      }
      return true;
    }).length;
  }, [leaveRequests, user, checkPermission, users]);

  const correspondenceCount = unreadMessagesCount + pendingLeavesCount;

  const displayBranchName = useMemo(() => {
    const branch = (branches || []).find(b => b.id === user.branchId);
    return branch ? branch.name : (user.role === 'admin' ? 'الإدارة السيادية' : 'فرع غير محدد');
  }, [user, branches]);

  const navItems: Array<{ id: ViewType; label: string; icon: any }> = [
    { id: 'userProfile', label: 'صفحتي الشخصية', icon: UserCircle },
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'sales', label: 'نقطة البيع', icon: ShoppingCart },
    { id: 'correspondence', label: 'المراسلات والطلبات', icon: Mail },
    { id: 'inventory', label: 'المخزن', icon: Package },
    { id: 'purchases', label: 'المشتريات', icon: Truck }, 
    { id: 'suppliers', label: 'الموردين', icon: UserPlus },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'expenses', label: 'المصاريف', icon: Wallet },
    { id: 'treasury', label: 'الخزنة', icon: Landmark },
    { id: 'staff', label: 'الموارد البشرية', icon: UserCog },
    { id: 'reports', label: 'التقارير الإحصائية', icon: BarChart3 },
    { id: 'dailyLogs', label: 'سجلات النشاط', icon: History },
    { id: 'securityAudit', label: 'الرقابة الأمنية', icon: Fingerprint },
    { id: 'archive', label: 'أرشيف المبيعات', icon: Archive },
    { id: 'itControl', label: 'لوحة IT والضبط', icon: Terminal },
    { id: 'recycleBin', label: 'المحذوفات', icon: Trash2 },
  ];

  const filteredNav = navItems.filter(item => {
    if (user.username === 'admin') return true;
    if (item.id === 'userProfile') return true;
    return checkPermission(user, item.id as any);
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-['Cairo']" dir="rtl">
      {toast && (
        <div className={`fixed top-5 left-5 z-[10000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-left duration-300 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
           {toast.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
           <span className="text-xs font-black">{toast.message}</span>
           <button onClick={onCloseToast} className="mr-4 hover:opacity-50"><X size={16}/></button>
        </div>
      )}

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] lg:hidden transition-opacity animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 right-0 h-screen bg-white border-l border-slate-200 flex flex-col z-[60] transform transition-all duration-300 w-64 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">M</div>
          <div><h1 className="font-black text-slate-800 text-sm">{settings.appName}</h1><p className="text-[8px] font-bold text-slate-400 uppercase">IT INFRASTRUCTURE</p></div>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto scrollbar-hide space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const badgeCount = item.id === 'correspondence' ? correspondenceCount : 0;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all justify-between ${isActive ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                <div className="flex items-center gap-3"><Icon size={18} /><span className="font-bold text-[11px]">{item.label}</span></div>
                {badgeCount > 0 && <span className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white">{badgeCount}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t"><button onClick={onLogout} className="flex items-center justify-center gap-2 w-full py-3 text-rose-600 font-black text-[10px] border border-slate-200 rounded-xl hover:bg-rose-50 transition-all"><LogOut size={14} /><span>تسجيل الخروج</span></button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-100 rounded-xl"><Menu size={20} /></button>
            <div className="flex flex-col">
               <h2 className="text-lg font-black text-slate-800">{navItems.find(i => i.id === currentView)?.label}</h2>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><Building2 size={12}/> {displayBranchName}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className={`p-3 rounded-2xl transition-all relative ${isNotifOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                >
                   <Bell size={20} className={lowStockItems.length > 0 ? 'animate-swing' : ''} />
                   {lowStockItems.length > 0 && (
                     <span className="absolute -top-1 -left-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {lowStockItems.length}
                     </span>
                   )}
                </button>

                {isNotifOpen && (
                  <div className="absolute top-full left-0 mt-3 w-[320px] md:w-[380px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                     <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                        <h4 className="font-black text-xs flex items-center gap-2"><Package size={16} className="text-indigo-400"/> تنبيهات المخزون ({lowStockItems.length})</h4>
                        <button onClick={() => setIsNotifOpen(false)}><X size={16}/></button>
                     </div>
                     <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                        {lowStockItems.length > 0 ? (
                          lowStockItems.map(p => (
                            <div key={p.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-all flex items-center justify-between group">
                               <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedNotifProduct(p); setIsNotifOpen(false); }}>
                                  <h5 className="text-[11px] font-black text-slate-800 truncate">{p.name}</h5>
                                  <div className="flex items-center gap-2 mt-1">
                                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.stock === 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {p.stock === 0 ? 'نافذ تماماً' : `رصيد منخفض: ${p.stock}`}
                                     </span>
                                     <span className="text-[9px] text-slate-300 font-mono">#{p.code}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <button onClick={() => copyToClipboard(p.code)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="نسخ الكود">
                                     <Copy size={12}/>
                                  </button>
                                  <button onClick={() => { setSelectedNotifProduct(p); setIsNotifOpen(false); }} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                     <ChevronLeft size={14}/>
                                  </button>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-12 text-center text-slate-300 flex flex-col items-center gap-3">
                             <ShieldCheck size={48} className="opacity-20"/>
                             <p className="text-xs font-black uppercase tracking-widest">المخزون آمن تماماً</p>
                          </div>
                        )}
                     </div>
                     {lowStockItems.length > 0 && (
                        <div className="p-3 bg-slate-50 text-center border-t">
                           <button onClick={() => { setView('inventory'); setIsNotifOpen(false); }} className="text-[10px] font-black text-indigo-600 hover:underline">انتقل لإدارة المخزن</button>
                        </div>
                     )}
                  </div>
                )}
             </div>

             <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl">
                <Clock size={16} />
                <p className="text-xs font-black">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
             </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">{children}</div>
      </main>

      {selectedNotifProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Package size={24}/></div>
                    <div>
                      <h3 className="font-black text-sm">معاينة سريعة للصنف</h3>
                      <p className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">Inventory Quick Preview</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedNotifProduct(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="text-center space-y-1">
                    <h2 className="text-2xl font-black text-slate-800">{selectedNotifProduct.name}</h2>
                    <p className="text-xs text-slate-400 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                       كود الصنف: <span className="text-indigo-600">#{selectedNotifProduct.code}</span>
                       <button onClick={() => copyToClipboard(selectedNotifProduct.code)} className="hover:text-indigo-700"><Copy size={12}/></button>
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center shadow-inner relative overflow-hidden group">
                       <PackageX className="absolute -bottom-2 -left-2 text-slate-100 size-16" />
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-2">الرصيد المتاح</p>
                       <p className={`text-3xl font-black ${selectedNotifProduct.stock === 0 ? 'text-rose-600' : 'text-amber-600'}`}>{selectedNotifProduct.stock}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center shadow-inner relative overflow-hidden">
                       <Landmark className="absolute -bottom-2 -left-2 text-slate-100 size-16" />
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-2">سعر البيع الرسمي</p>
                       <p className="text-3xl font-black text-indigo-600">{selectedNotifProduct.offerPrice || selectedNotifProduct.retailPrice} <span className="text-sm">ج.م</span></p>
                    </div>
                 </div>

                 <div className="bg-white p-6 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><Barcode size={14}/> نظام الباركود الموحد</div>
                    <svg id="notif-barcode-svg" className="mx-auto"></svg>
                 </div>

                 <div className="flex gap-4">
                    <button onClick={() => setSelectedNotifProduct(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 font-black rounded-2xl text-xs hover:bg-slate-100 transition-all">إغلاق</button>
                    <button 
                      onClick={() => { setView('inventory'); setSelectedNotifProduct(null); }} 
                      className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Settings size={16}/> التوجه للمخزن للتعديل
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes swing {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(10deg); }
          30% { transform: rotate(-10deg); }
          50% { transform: rotate(5deg); }
          70% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-swing {
          animation: swing 2s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
    </div>
  );
};

export default Layout;
