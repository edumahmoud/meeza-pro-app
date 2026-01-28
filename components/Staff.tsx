import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Building2, UserPlus, Trash2, Key, Plus, Search, X, 
  TrendingUp, Wallet, MapPin, ArrowRight, UserCheck, Ban, 
  ShoppingCart, Copy, DownloadCloud, History, Save, 
  ArrowDownRight, Receipt, BadgeCheck, Lock, ShieldCheck, 
  Building, Phone, Landmark, FileText, PhoneCall, Info, UserCog, Award, ArrowRightLeft, Power
} from 'lucide-react';
import { User as UserType, Branch, StaffPayment, LeaveRequest, Invoice, SystemSettings, UserRole, StaffPaymentType, ProceduralAction, Product, Expense, ReturnRecord } from '../types';
import { AppRole } from '../hooks/useSystemSettings';
import { copyToClipboard } from './Layout';

interface StaffProps {
  currentUser: UserType;
  users: UserType[];
  branches: Branch[];
  staffPayments: StaffPayment[];
  leaveRequests: LeaveRequest[];
  invoices: Invoice[];
  expenses: Expense[];
  returns: ReturnRecord[];
  products: Product[];
  roles: AppRole[];
  settings: SystemSettings;
  onUpdateSettings: (s: Partial<SystemSettings>) => Promise<void>;
  onAddUser: (role: UserRole, fullName: string, phone: string, salary: number, branchId: string, hasPerformance: boolean, birthDate: string) => Promise<any>;
  onUpdateUser?: (userId: string, updates: any) => Promise<void>;
  onTransferEmployee: (userId: string, targetBranchId: string | null) => Promise<void>;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  onDeleteUser: (id: string, reason: string) => Promise<void>;
  onDeleteUserPermanent: (id: string) => Promise<void>;
  onDeleteBranch: (id: string, reason: string) => Promise<void>;
  onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  onAddStaffPayment: (staffId: string, amount: number, type: StaffPaymentType, notes?: string, creatorId?: string) => Promise<void>;
  onResetPassword: (userId: string) => Promise<string>;
  onUpdateLeaveStatus: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  onAddBranch: (payload: { name: string, location?: string, phone?: string, taxNumber?: string, commercialRegister?: string }) => Promise<any>;
  onAddRole: (key: string, name: string) => Promise<void>;
  onDeleteRole: (key: string) => Promise<void>;
  checkPermission: (user: { role: string, username: string }, action: ProceduralAction) => boolean;
}

const Staff = ({ 
  currentUser, users = [], branches = [], invoices = [], returns = [], roles = [], products = [],
  onAddUser, onDeleteUser, onResetPassword, onShowToast, askConfirmation, onAddBranch, onUpdateUser, onUpdateBranch, 
  onDeleteUserPermanent, onDeleteBranch, onUpdateUserRole, onTransferEmployee
}: StaffProps) => {
  const [activeTab, setActiveTab] = useState('users' as 'users' | 'branches' | 'suspended');
  const [viewMode, setViewMode] = useState('list' as 'list' | 'add_user' | 'add_branch' | 'branch_detail');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedStaffProfile, setSelectedStaffProfile] = useState(null as UserType | null);
  const [selectedBranchId, setSelectedBranchId] = useState(null as string | null);
  
  const [statPeriod, setStatPeriod] = useState('month' as 'day' | 'month' | 'year');
  const [branchStatPeriod, setBranchStatPeriod] = useState('month' as 'day' | 'month' | 'year');

  const isAdmin = useMemo(() => ['admin', 'it_support', 'general_manager'].includes(currentUser.role), [currentUser.role]);

  useEffect(() => {
    if (selectedStaffProfile) {
      const updated = users.find(u => u.id === selectedStaffProfile.id);
      if (updated) {
        setSelectedStaffProfile(prev => ({ ...updated, password: prev?.password || updated.password }));
      }
    }
  }, [users]);

  const userStatsMap = useMemo(() => {
    const map: Record<string, { count: number, total: number }> = {};
    users.forEach(u => map[u.id] = { count: 0, total: 0 });
    invoices.filter(inv => !inv.isDeleted).forEach(inv => {
      if (map[inv.createdBy]) {
        map[inv.createdBy].count += 1;
        map[inv.createdBy].total += inv.netTotal;
      }
    });
    return map;
  }, [users, invoices]);

  const handleResetPass = async (userId: string) => {
    try {
      const newPass = await onResetPassword(userId);
      if (selectedStaffProfile && selectedStaffProfile.id === userId) {
        setSelectedStaffProfile({ ...selectedStaffProfile, password: newPass, isPasswordChanged: false });
      }
      onShowToast("تم تصفير كلمة السر وتحديث بطاقة الدخول", "success");
    } catch (e) { onShowToast("فشل تصفير كلمة السر", "error"); }
  };

  const handleToggleBranchStatus = async (branch: Branch) => {
    const newStatus = branch.status === 'active' ? 'closed_temp' : 'active';
    const actionName = newStatus === 'active' ? 'تنشيط' : 'إيقاف نشاط';
    askConfirmation(`${actionName} الفرع`, `هل تود ${actionName} فرع ${branch.name}؟`, async () => {
      try {
        await onUpdateBranch(branch.id, { status: newStatus });
        onShowToast(`تم ${actionName} الفرع بنجاح`, "success");
      } catch (e) { onShowToast("فشل تحديث الحالة", "error"); }
    }, newStatus === 'active' ? 'info' : 'warning');
  };

  if (selectedStaffProfile) {
    const uInvoices = invoices.filter(i => i.createdBy === selectedStaffProfile.id && !i.isDeleted);
    const personalStats = (() => {
       const now = new Date();
       const filtered = uInvoices.filter(i => {
          const d = new Date(i.timestamp);
          if (statPeriod === 'day') return i.date === now.toLocaleDateString('ar-EG');
          if (statPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (statPeriod === 'year') return d.getFullYear() === now.getFullYear();
          return i.date === now.toLocaleDateString('ar-EG');
       });
       return { count: filtered.length, totalSales: filtered.reduce((a, b) => a + b.netTotal, 0), filtered };
    })();

    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
        <div className="flex flex-col md:flex-row items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6">
           <div className="flex items-center gap-6">
              <button onClick={() => setSelectedStaffProfile(null)} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-900 group transition-all shadow-sm"><ArrowRight size={24} className="group-hover:text-white"/></button>
              <div className="flex items-center gap-4">
                 <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black shadow-xl">{(selectedStaffProfile.fullName || 'U')[0]}</div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-800">{selectedStaffProfile.fullName}</h2>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{roles.find(r=>r.role_key===selectedStaffProfile.role)?.role_name || selectedStaffProfile.role}</p>
                 </div>
              </div>
           </div>
           <div className="flex flex-wrap gap-2">
              <button onClick={()=>handleResetPass(selectedStaffProfile.id)} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] flex items-center gap-2 shadow-lg hover:bg-black transition-all"><Key size={16}/> تصفير الباسوورد</button>
              <button onClick={()=>askConfirmation("تجميد الموظف", "هل تود تعطيل الحساب مؤقتاً؟", () => onDeleteUser(selectedStaffProfile.id, "إيقاف إداري"))} className="px-5 py-3 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] flex items-center gap-2"><Ban size={16}/> تجميد</button>
              <button onClick={()=>askConfirmation("حذف نهائي", "لا يمكن التراجع عن هذا الإجراء.", () => onDeleteUserPermanent(selectedStaffProfile.id), 'danger')} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] flex items-center gap-2"><Trash2 size={16}/> حذف</button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
              <ShoppingCart size={80} className="absolute -bottom-4 -left-4 text-white/10 rotate-12"/>
              <p className="text-[10px] font-black opacity-60 uppercase mb-1">مبيعات الفترة</p>
              <h3 className="text-3xl font-black">{personalStats.totalSales.toLocaleString()} <span className="text-sm opacity-40">ج.م</span></h3>
              <div className="mt-4 flex gap-2 relative z-10">
                 {['day', 'month', 'year'].map(p => (
                    <button key={p} onClick={()=>setStatPeriod(p as any)} className={`px-3 py-1 rounded-lg text-[8px] font-black transition-all ${statPeriod === p ? 'bg-white text-indigo-600' : 'bg-white/10 text-white/60'}`}>
                       {p === 'day' ? 'اليوم' : p === 'month' ? 'الشهر' : 'السنة'}
                    </button>
                 ))}
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">عدد العمليات</p>
              <h3 className="text-3xl font-black text-slate-800">{personalStats.count} <span className="text-sm text-slate-300">فاتورة</span></h3>
           </div>
           <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl text-center flex flex-col justify-center">
              <p className="text-[10px] font-black text-indigo-300 uppercase mb-1">أيام العمل المتراكمة</p>
              <h3 className="text-3xl font-black text-white">{selectedStaffProfile.daysWorkedAccumulated || 0} <span className="text-sm opacity-40">يوم</span></h3>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <h4 className="font-black text-sm text-indigo-600 border-b pb-4 flex items-center gap-2"><UserCog size={18}/> الإدارة اللوجستية والترقيات</h4>
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1 flex items-center gap-1"><Award size={10}/> الرتبة الوظيفية</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-4 focus:ring-indigo-600/5 cursor-pointer"
                      value={selectedStaffProfile.role}
                      onChange={(e) => onUpdateUserRole(selectedStaffProfile.id, e.target.value)}
                    >
                       {roles.map(r => <option key={r.id} value={r.role_key}>{r.role_name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1 flex items-center gap-1"><ArrowRightLeft size={10}/> النقل لفرع آخر</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-4 focus:ring-indigo-600/5 cursor-pointer"
                      value={selectedStaffProfile.branchId || ''}
                      onChange={(e) => onTransferEmployee(selectedStaffProfile.id, e.target.value)}
                    >
                       <option value="">مقر الإدارة الرئيسي</option>
                       {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="p-6 bg-slate-900 rounded-[2rem] space-y-3 shadow-2xl relative overflow-hidden mt-6">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                       <Key size={150} className="text-white absolute -bottom-10 -right-10 rotate-12" />
                    </div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest relative z-10">بيانات الدخول النظامية</p>
                    <div className="flex justify-between items-center relative z-10">
                       <div className="flex flex-col">
                          <span className="text-slate-300 font-bold text-[9px] uppercase">اسم المستخدم</span>
                          <span className="text-white font-black text-xs">#{selectedStaffProfile.username}</span>
                       </div>
                       <div className="text-left">
                          <span className="text-slate-300 font-bold text-[9px] uppercase">كلمة المرور</span>
                          <div className="flex items-center gap-3">
                             {selectedStaffProfile.isPasswordChanged ? (
                                <span className="text-emerald-400 text-[10px] font-black flex items-center gap-1"><ShieldCheck size={14}/> حساب مؤمن</span>
                             ) : (
                                <>
                                   <span className="text-white font-mono text-xl tracking-[0.2em]">{selectedStaffProfile.password || '••••••••'}</span>
                                   <button onClick={()=>copyToClipboard(selectedStaffProfile.password || '', onShowToast)} className="p-2 bg-white/10 rounded-xl text-indigo-400 hover:text-white transition-all shadow-sm"><Copy size={16}/></button>
                                </>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
              <div className="p-6 border-b bg-slate-50/50 flex items-center gap-3"><History size={18} className="text-indigo-600"/><h4 className="font-black text-sm text-slate-800">آخر عمليات المبيعات</h4></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                 {personalStats.filtered.slice(0, 10).map(inv => (
                    <div key={inv.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition-colors">
                       <div><p className="text-[10px] font-black text-slate-700">فاتورة #{inv.id.slice(-6)}</p><p className="text-[8px] text-slate-400">{inv.date} | {inv.time}</p></div>
                       <p className="text-xs font-black text-indigo-600">{inv.netTotal.toLocaleString()} ج.م</p>
                    </div>
                 ))}
                 {personalStats.filtered.length === 0 && <p className="text-center py-20 text-slate-300 italic text-xs font-bold uppercase tracking-widest">لا توجد عمليات مبيعات حالياً</p>}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide shadow-inner">
          <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[100px] py-3 px-8 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}><Users size={14}/> الموظفين</button>
          <button onClick={() => setActiveTab('branches')} className={`flex-1 min-w-[100px] py-3 px-8 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'branches' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}><Building2 size={14}/> الفروع</button>
          <button onClick={() => setActiveTab('suspended')} className={`flex-1 min-w-[100px] py-3 px-8 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'suspended' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}><Ban size={14}/> الموقوفين</button>
        </div>
        
        <div className="flex gap-3 shrink-0">
          {activeTab === 'branches' && (
            <button onClick={() => setViewMode('add_branch')} className="px-8 py-3.5 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all active:scale-95 animate-in zoom-in">
              <Plus size={18}/> تأسيس فرع جديد
            </button>
          )}
          {activeTab === 'users' && (
            <button onClick={() => setViewMode('add_user')} className="px-8 py-3.5 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all active:scale-95 animate-in zoom-in">
              <UserPlus size={18}/> تعيين موظف جديد
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="بحث سريع..." className="w-full pr-14 pl-4 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm shadow-inner transition-all focus:ring-4 focus:ring-indigo-500/5" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {users.filter(u => !u.isDeleted && (u.fullName.includes(searchTerm) || u.username.includes(searchTerm))).map(u => {
              const stats = userStatsMap[u.id] || { count: 0, total: 0 };
              return (
                <div key={u.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full" onClick={()=>setSelectedStaffProfile(u)}>
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">{(u.fullName || 'U')[0]}</div>
                      <div className="flex gap-2">
                         <button onClick={(e) => { e.stopPropagation(); handleResetPass(u.id); }} className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm bg-white border border-slate-100" title="تصفير الباسوورد"><Key size={18}/></button>
                      </div>
                   </div>
                   <div className="flex-1">
                      <h3 className="text-xl font-black text-slate-800 mb-1">{u.fullName}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><BadgeCheck size={12} className="text-indigo-600"/> {roles.find(r=>r.role_key===u.role)?.role_name || u.role} - #{u.username}</p>
                   </div>
                   <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center group-hover:bg-indigo-50 transition-colors">
                         <div className="flex items-center justify-center gap-1.5 text-[8px] font-black text-slate-400 uppercase mb-1"><Receipt size={10}/> الفواتير</div>
                         <p className="text-xs font-black text-slate-800">{stats.count}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center group-hover:bg-emerald-50 transition-colors">
                         <div className="flex items-center justify-center gap-1.5 text-[8px] font-black text-slate-400 uppercase mb-1"><Wallet size={10}/> الإجمالي</div>
                         <p className="text-xs font-black text-emerald-600">{stats.total.toLocaleString()}</p>
                      </div>
                   </div>
                </div>
              );
           })}
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {branches.filter(b => !b.isDeleted && b.name.includes(searchTerm)).map(b => (
              <div key={b.id} onClick={() => { setSelectedBranchId(b.id); setViewMode('branch_detail'); }} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full">
                 <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black shadow-lg group-hover:bg-indigo-600 transition-all"><Building size={28}/></div>
                    <div className="flex gap-2">
                       {isAdmin && (
                         <>
                           <button onClick={(e) => { e.stopPropagation(); handleToggleBranchStatus(b); }} className={`p-3 rounded-2xl transition-all shadow-sm bg-white border border-slate-100 ${b.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`} title={b.status === 'active' ? 'إيقاف النشاط' : 'تنشيط'}><Power size={18}/></button>
                           <button onClick={(e)=>{e.stopPropagation(); askConfirmation("حذف الفرع", `هل تود حذف فرع ${b.name} نهائياً؟`, () => onDeleteBranch(b.id, "حذف إداري"), 'danger');}} className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm bg-white border border-slate-100"><Trash2 size={18}/></button>
                         </>
                       )}
                    </div>
                 </div>
                 <h3 className="text-2xl font-black text-slate-800 mb-2">{b.name}</h3>
                 <div className="flex items-center gap-2 mb-6">
                    <MapPin size={14} className="text-slate-400"/>
                    <p className="text-[11px] text-slate-500 font-bold">{b.location || 'لم يتم تحديد موقع'}</p>
                 </div>
              </div>
           ))}
        </div>
      )}

      {viewMode === 'add_user' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><UserPlus size={24}/></div><h3 className="font-black text-sm">تعيين موظف جديد</h3></div>
                 <button onClick={() => setViewMode('list')}><X size={24}/></button>
              </div>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const f = new FormData(e.currentTarget);
                 try {
                   const res = await onAddUser(
                     f.get('role') as UserRole,
                     f.get('fullName') as string,
                     f.get('phone') as string,
                     Number(f.get('salary')),
                     f.get('branchId') as string,
                     f.get('hasPerformance') === 'on',
                     f.get('birthDate') as string
                   );
                   onShowToast("تم التعيين بنجاح، الباسوورد متاح الآن في بطاقة الموظف", "success");
                   setSelectedStaffProfile(res);
                   setViewMode('list');
                 } catch (err) { onShowToast("فشل التعيين", "error"); }
              }} className="p-8 space-y-6 text-right">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الاسم الرباعي</label><input name="fullName" required type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none focus:bg-white transition-all shadow-inner" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">رقم الهاتف</label><input name="phone" required type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none focus:bg-white transition-all shadow-inner" /></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الوظيفة</label><select name="role" required className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none">{roles.map(r => <option key={r.id} value={r.role_key}>{r.role_name}</option>)}</select></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الفرع</label><select name="branchId" required className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none"><option value="">مقر الإدارة</option>{branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الراتب الأساسي</label><input name="salary" required type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الميلاد</label><input name="birthDate" required type="date" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" /></div>
                 </div>
                 <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all">اعتماد قرار التعيين</button>
              </form>
           </div>
        </div>
      )}

      {viewMode === 'add_branch' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Building2 size={24}/></div><h3 className="font-black text-sm">تأسيس فرع جديد</h3></div>
                 <button onClick={() => setViewMode('list')}><X size={24}/></button>
              </div>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const f = new FormData(e.currentTarget);
                 try {
                   await onAddBranch({
                     name: f.get('name') as string,
                     location: f.get('location') as string,
                     phone: f.get('phone') as string,
                     taxNumber: f.get('tax') as string,
                     commercialRegister: f.get('comm') as string
                   });
                   onShowToast("تم تأسيس الفرع بنجاح", "success");
                   setViewMode('list'); setActiveTab('branches');
                 } catch (err) { onShowToast("فشل التأسيس", "error"); }
              }} className="p-10 space-y-8 text-right">
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">المسمى التجاري</label><input name="name" required type="text" className="w-full p-4 bg-slate-50 border focus:border-indigo-600 rounded-2xl font-black text-sm outline-none shadow-inner" /></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الموقع</label><input name="location" required type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs shadow-inner" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الهاتف</label><input name="phone" required type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs shadow-inner" /></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">السجل التجاري</label><input name="comm" type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs shadow-inner" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input name="tax" type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs shadow-inner" /></div>
                 </div>
                 <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">اعتماد بيانات الفرع</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Staff;