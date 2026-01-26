import React, { useState, useMemo } from 'react';
import { 
  Users, Building2, UserPlus, ShieldCheck, CreditCard, Calendar, 
  Trash2, Edit3, Key, ArrowRightLeft, Award, Plus, 
  Search, X, Save, RefreshCw, Briefcase, 
  TrendingUp, TrendingDown, Wallet, CheckCircle2, MapPin, 
  ShieldAlert, Info, Phone, Copy, 
  User as UserIcon, BadgeCheck, Activity, Clock, Receipt, Banknote, Coins, FileText, ArrowUpRight, ArrowRight, UserCheck, Smartphone, Star, Hash, Landmark, PieChart, DollarSign,
  ShoppingBag, AlertTriangle, ArrowLeft, History, ShoppingCart, ToggleRight, ToggleLeft, LayoutGrid, List, Eye, Settings, ChevronLeft, ChevronRight, FileSpreadsheet,
  Filter, Check, BadgePlus, Percent, Lock, UserX, Power, RotateCcw, HandCoins, CalendarRange, Layers, Calculator, DownloadCloud, BarChart3, PlusCircle, ArrowUpDown, ClipboardCopy, Cake
} from 'lucide-react';
import { User, Branch, StaffPayment, LeaveRequest, Invoice, SystemSettings, UserRole, StaffPaymentType, ProceduralAction, Product, Expense, ReturnRecord } from '../types';
import { AppRole } from '../hooks/useSystemSettings';
import { copyToClipboard } from './Layout';
import * as XLSX from 'xlsx';

interface StaffProps {
  currentUser: User;
  users: User[];
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

const Staff: React.FC<StaffProps> = ({ 
  currentUser, users = [], branches = [], staffPayments = [], leaveRequests = [], invoices = [], expenses = [], returns = [], products = [], roles = [], settings,
  onAddUser, onTransferEmployee, onUpdateBranch, onDeleteUser, onDeleteUserPermanent, onDeleteBranch, 
  onUpdateUserRole, onAddStaffPayment, onResetPassword, onShowToast, askConfirmation, 
  onAddBranch, onAddRole, onDeleteRole, checkPermission 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'branches' | 'payments' | 'roles'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'add_user' | 'add_branch' | 'add_role'>('list');
  const [isPaymentOpen, setIsPaymentOpen] = useState<{ isOpen: boolean, user: User | null }>({ isOpen: false, user: null });
  
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<User | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  
  const [branchDetailTab, setBranchDetailTab] = useState<'data' | 'performance' | 'expenses' | 'returns' | 'config'>('data');
  const [branchPeriod, setBranchPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [performancePeriod, setPerformancePeriod] = useState<'day' | 'month' | 'year'>('month');

  const [roleFilter, setRoleFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branchEditForm, setBranchEditForm] = useState<Partial<Branch>>({});

  const [newUserForm, setNewUserForm] = useState({ fullName: '', phone: '', salary: 0, role: 'employee' as UserRole, branchId: '', hasPerformance: false, birthDate: '' });
  const [newBranchForm, setNewBranchForm] = useState({ name: '', location: '', phone: '', taxNumber: '', commercialRegister: '' });
  const [newRoleForm, setNewRoleForm] = useState({ key: '', name: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: 0, type: 'راتب' as StaffPaymentType, notes: '' });

  const isHQAdmin = ['admin', 'it_support', 'general_manager'].includes(currentUser.role);

  const filteredUsers = useMemo(() => {
    let list = Array.isArray(users) ? users : [];
    list = list.filter(u => !u.isDeleted);
    if (!isHQAdmin) list = list.filter(u => u.branchId === currentUser.branchId);
    else if (branchFilter) list = list.filter(u => u.branchId === branchFilter);
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    if (searchTerm) list = list.filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.username.toLowerCase().includes(searchTerm.toLowerCase()));
    return list;
  }, [users, currentUser.branchId, isHQAdmin, searchTerm, roleFilter, branchFilter]);

  const filteredBranches = useMemo(() => (Array.isArray(branches) ? branches : []).filter(b => !b.isDeleted && (isHQAdmin || b.id === currentUser.branchId)), [branches, isHQAdmin, currentUser.branchId]);

  const getPerformanceStats = (userId: string, period: 'day' | 'month' | 'year') => {
    const userInvoices = (invoices || []).filter(i => i.createdBy === userId && !i.isDeleted);
    const now = new Date();
    const todayStr = now.toLocaleDateString('ar-EG');
    
    const filteredInvoices = userInvoices.filter(i => {
        const d = new Date(i.timestamp);
        if (period === 'day') return i.date === todayStr;
        if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (period === 'year') return d.getFullYear() === now.getFullYear();
        return true;
    });
    const totalSales = filteredInvoices.reduce((a, b) => a + b.netTotal, 0);
    return { totalSales, estimatedCommission: totalSales * 0.01, invoicesCount: filteredInvoices.length, filteredInvoices };
  };

  const handleAddUser = async () => {
    if (!newUserForm.fullName || !newUserForm.role || isSubmitting) return onShowToast("أكمل البيانات المطلوبة", "error");
    setIsSubmitting(true);
    try {
      const result = await onAddUser(newUserForm.role, newUserForm.fullName, newUserForm.phone, newUserForm.salary, newUserForm.branchId, newUserForm.hasPerformance, newUserForm.birthDate);
      setTempPassword(result.temporaryPassword);
      setSelectedStaffProfile(result);
      setViewMode('list');
      setNewUserForm({ fullName: '', phone: '', salary: 0, role: 'employee', branchId: '', hasPerformance: false, birthDate: '' });
      onShowToast("تم إضافة الموظف بنجاح", "success");
    } catch (e) { onShowToast("فشل الإضافة", "error"); } finally { setIsSubmitting(false); }
  };

  const handleAddBranch = async () => {
    if (!newBranchForm.name || isSubmitting) return onShowToast("اسم الفرع مطلوب", "error");
    setIsSubmitting(true);
    try {
      await onAddBranch(newBranchForm);
      setViewMode('list');
      setNewBranchForm({ name: '', location: '', phone: '', taxNumber: '', commercialRegister: '' });
      onShowToast("تم تأسيس الفرع بنجاح", "success");
    } catch (e) { onShowToast("فشل التأسيس", "error"); } finally { setIsSubmitting(false); }
  };

  const handleUpdateBranchDetails = async () => {
    if (!selectedBranch || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUpdateBranch(selectedBranch.id, branchEditForm);
      onShowToast("تم تحديث بيانات الفرع", "success");
      setSelectedBranch({ ...selectedBranch, ...branchEditForm });
    } catch (e) { onShowToast("فشل التحديث", "error"); } finally { setIsSubmitting(false); }
  };

  const renderContent = () => {
    if (selectedStaffProfile) {
      const s = users.find(u => u.id === selectedStaffProfile.id) || selectedStaffProfile;
      const payments = (staffPayments || []).filter(p => p.staffId === s.id);
      const perf = s.hasPerformanceTracking ? getPerformanceStats(s.id, performancePeriod) : null;
      return (
        <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
          <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
             <div className="flex items-center gap-4">
                <button onClick={() => { setSelectedStaffProfile(null); setTempPassword(null); }} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-900 transition-all"><ArrowRight size={24}/></button>
                <div><h3 className="text-2xl font-black text-slate-800">{s.fullName}</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">إدارة الملف الرقمي</p></div>
             </div>
             <div className="flex gap-2">
                {checkPermission(currentUser, 'export_staff_performance') && (
                  <button onClick={() => {
                      const p = getPerformanceStats(s.id, performancePeriod);
                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.json_to_sheet([{ "الموظف": s.fullName, "الفترة": performancePeriod, "المبيعات": p.totalSales, "الفواتير": p.invoicesCount, "العمولة": p.estimatedCommission }]);
                      XLSX.utils.book_append_sheet(wb, ws, "الأداء");
                      XLSX.writeFile(wb, `Performance_${s.fullName}.xlsx`);
                  }} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"><FileSpreadsheet size={16}/> تصدير الأداء</button>
                )}
             </div>
          </div>

          {tempPassword && (
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner"><Key size={28}/></div>
                  <div>
                    <h4 className="text-lg font-black">كلمة المرور المؤقتة الجديدة</h4>
                    <p className="text-[10px] font-bold opacity-70 uppercase">Temporary Credential - Security Protocol</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="px-8 py-3 bg-white/10 border border-white/20 rounded-2xl font-mono text-2xl font-black tracking-widest backdrop-blur-md">
                    {tempPassword}
                  </div>
                  <button onClick={() => copyToClipboard(tempPassword, onShowToast)} className="p-4 bg-white text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2 font-black text-xs">
                    <ClipboardCopy size={20}/> نسخ
                  </button>
               </div>
            </div>
          )}

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
             <div className="flex items-center gap-3 border-b pb-4"><Info className="text-indigo-600" size={24}/><h4 className="font-black text-lg uppercase">بيانات الموظف التفصيلية (Profile Data)</h4></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Smartphone size={12}/> رقم الهاتف</p>
                   <p className="text-sm font-black text-slate-800">{s.phoneNumber || 'غير مسجل'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Cake size={12}/> تاريخ الميلاد</p>
                   <p className="text-sm font-black text-slate-800">{s.birthDate || 'غير مسجل'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Briefcase size={12}/> تاريخ التعيين</p>
                   <p className="text-sm font-black text-slate-800">{s.hiringDate ? new Date(s.hiringDate).toLocaleDateString('ar-EG') : 'غير مسجل'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Hash size={12}/> كود النظام</p>
                   <p className="text-sm font-black text-indigo-600 font-mono">#{s.username}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><CalendarRange size={12}/> إجمالي أيام العمل</p>
                   <p className="text-sm font-black text-slate-800">{s.totalDaysWorked || s.daysWorkedAccumulated || 0} يوم</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Clock size={12}/> آخر ظهور</p>
                   <p className="text-sm font-black text-slate-800">{s.lastLoginDate ? new Date(s.lastLoginDate).toLocaleDateString('ar-EG') : 'لم يسجل دخول'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Building2 size={12}/> الفرع الحالي</p>
                   <p className="text-sm font-black text-slate-800">{branches.find(b=>b.id===s.branchId)?.name || 'الإدارة السيادية'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Activity size={12}/> تتبع الأداء</p>
                   <p className={`text-sm font-black ${s.hasPerformanceTracking ? 'text-emerald-600' : 'text-slate-400'}`}>{s.hasPerformanceTracking ? 'نشط' : 'معطل'}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                      <div className="p-4 bg-slate-100 text-slate-600 rounded-2xl"><Landmark size={24}/></div>
                      <div><p className="text-[10px] font-black text-slate-400 uppercase">الراتب</p><h4 className="text-xl font-black">{s.salary.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h4></div>
                   </div>
                   <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                      <div className="p-4 bg-slate-100 text-slate-600 rounded-2xl"><Calendar size={24}/></div>
                      <div><p className="text-[10px] font-black text-slate-400 uppercase">أيام العمل (الدورة)</p><h4 className="text-xl font-black">{s.daysWorkedAccumulated || 0} يوم</h4></div>
                   </div>
                   <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                      <div className="p-4 bg-slate-100 text-slate-600 rounded-2xl"><BadgeCheck size={24}/></div>
                      <div><p className="text-[10px] font-black text-slate-400 uppercase">الوظيفة</p><h4 className="text-lg font-black truncate">{roles.find(r=>r.role_key===s.role)?.role_name || s.role}</h4></div>
                   </div>
                </div>

                {perf && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm space-y-6">
                       <div className="flex justify-between items-center border-b border-indigo-100 pb-4">
                          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Activity size={20}/></div><h4 className="font-black text-sm text-indigo-900 uppercase">مستوى أداء الموظف</h4></div>
                          <div className="flex bg-white p-1 rounded-xl shadow-sm border">
                             {['day', 'month', 'year'].map(p => (
                               <button key={p} onClick={() => setPerformancePeriod(p as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${performancePeriod === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}>
                                 {p === 'day' ? 'يومي' : p === 'month' ? 'شهري' : 'سنوي'}
                               </button>
                             ))}
                          </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white p-5 rounded-2xl border border-indigo-50 text-center shadow-sm">
                             <p className="text-[10px] font-bold text-slate-400 uppercase">المبيعات ({performancePeriod === 'day' ? 'اليوم' : performancePeriod === 'month' ? 'الشهر' : 'السنة'})</p>
                             <h3 className="text-2xl font-black text-slate-800">{perf.totalSales.toLocaleString()} ج.م</h3>
                          </div>
                          <div className="bg-white p-5 rounded-2xl border border-indigo-50 text-center shadow-sm">
                             <p className="text-[10px] font-bold text-slate-400 uppercase">عدد العمليات</p>
                             <h3 className="text-2xl font-black text-slate-800">{perf.invoicesCount}</h3>
                          </div>
                          <div className="bg-white p-5 rounded-2xl border border-indigo-100 text-center shadow-md">
                             <p className="text-[10px] font-bold text-indigo-400 uppercase">العمولة (1%)</p>
                             <h3 className="text-2xl font-black text-indigo-600">{perf.estimatedCommission.toLocaleString()} ج.م</h3>
                          </div>
                       </div>
                    </div>
                )}

                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                   <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <h4 className="font-black text-sm flex items-center gap-2"><History size={18}/> السجلات المالية</h4>
                      <button onClick={() => setIsPaymentOpen({ isOpen: true, user: s })} className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-lg"><BadgePlus size={20}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                      {payments.map(p => (
                         <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition-all">
                            <div><p className="text-xs font-black text-slate-800">{p.paymentType} {p.notes ? `(${p.notes})` : ''}</p><p className="text-[9px] text-slate-400 font-bold">{new Date(p.paymentDate).toLocaleString('ar-EG')}</p></div>
                            <p className={`text-sm font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.paymentType === 'خصم' ? '-' : '+'}{p.amount.toLocaleString()} ج.م</p>
                         </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                   <div className="flex items-center gap-3 border-b pb-4 text-slate-600"><Settings size={18}/><h4 className="font-black text-xs uppercase">إدارة العضوية والترقيات</h4></div>
                   <div className="space-y-4">
                      {/* ميزة الترقيات: تغيير المسمى الوظيفي */}
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase">تغيير المسمى الوظيفي (ترقية)</label>
                         <select 
                            className="w-full p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl font-black text-xs text-indigo-700" 
                            value={s.role} 
                            onChange={(e) => onUpdateUserRole(s.id, e.target.value as UserRole)}
                          >
                            {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase">نقل الموظف لفرع آخر</label>
                         <select className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={s.branchId || ''} onChange={(e) => onTransferEmployee(s.id, e.target.value || null)}>
                            <option value="">الإدارة المركزية</option>
                            {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                         </select>
                      </div>
                      <button onClick={async () => { const np = await onResetPassword(s.id); setTempPassword(np); onShowToast("تم تصفير كلمة المرور بنجاح", "success"); }} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-slate-200 border border-slate-200 transition-all"><Key size={14}/> تصفير الباسوورد</button>
                      <button onClick={() => { askConfirmation("إيقاف الموظف", "سيتم تعطيل حساب الموظف ومنعه من الدخول للنظام مؤقتاً.", () => onDeleteUser?.(s.id, "إيقاف إداري"), 'warning'); }} className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-amber-100 border border-amber-100 transition-all"><UserX size={14}/> إيقاف مؤقت</button>
                      
                      {isHQAdmin && (
                        <div className="pt-4 border-t border-rose-50">
                           <button onClick={() => { askConfirmation("حذف الموظف نهائياً", "سيتم مسح بيانات الموظف تماماً من النظام ولا يمكن استرجاعها.", () => { onDeleteUserPermanent(s.id); setSelectedStaffProfile(null); }, 'danger'); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-rose-700 shadow-lg transition-all"><Trash2 size={14}/> حذف الموظف نهائياً</button>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>
      );
    }

    if (selectedBranch) {
        const branchStaff = (users || []).filter(u => u.branchId === selectedBranch.id && !u.isDeleted);
        const branchInvoices = (invoices || []).filter(i => i.branchId === selectedBranch.id && !i.isDeleted);
        const branchExpenses = (expenses || []).filter(e => e.branchId === selectedBranch.id);
        const branchReturns = (returns || []).filter(r => r.branchId === selectedBranch.id && !r.isDeleted);
        
        const now = new Date();
        const todayStr = now.toLocaleDateString('ar-EG');
        
        const periodInvoices = branchInvoices.filter(i => {
           const d = new Date(i.timestamp);
           if (branchPeriod === 'day') return i.date === todayStr;
           if (branchPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
           if (branchPeriod === 'year') return d.getFullYear() === now.getFullYear();
           return true;
        });

        const periodExpenses = branchExpenses.filter(e => {
            const d = new Date(e.timestamp);
            if (branchPeriod === 'day') return e.date === todayStr;
            if (branchPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (branchPeriod === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        });

        const periodReturns = branchReturns.filter(r => {
            const d = new Date(r.timestamp);
            if (branchPeriod === 'day') return r.date === todayStr;
            if (branchPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (branchPeriod === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        });

        const totalSales = periodInvoices.reduce((a, b) => a + b.netTotal, 0);
        const totalExpValue = periodExpenses.reduce((a, b) => a + b.amount, 0);
        const totalRetValue = periodReturns.reduce((a, b) => a + b.totalRefund, 0);
        
        const linkedTreasuryBalance = totalSales - totalExpValue - totalRetValue;

        return (
          <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
            <div className="flex flex-col xl:flex-row items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6">
               <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedBranch(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-900 transition-all"><ArrowRight size={24}/></button>
                  <div><h3 className="text-2xl font-black text-slate-800">{selectedBranch.name}</h3><p className="text-xs text-slate-400 font-bold uppercase mt-1">لوحة تحكم الفرع الموحدة</p></div>
               </div>
               
               <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide shrink-0">
                  <button onClick={() => setBranchDetailTab('data')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${branchDetailTab === 'data' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>البيانات والنتائج</button>
                  <button onClick={() => setBranchDetailTab('performance')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${branchDetailTab === 'performance' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>الموظفين</button>
                  <button onClick={() => setBranchDetailTab('expenses')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${branchDetailTab === 'expenses' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-rose-600'}`}>المصروفات</button>
                  <button onClick={() => setBranchDetailTab('returns')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${branchDetailTab === 'returns' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-600'}`}>المرتجعات</button>
                  {isHQAdmin && <button onClick={() => { setBranchDetailTab('config'); setBranchEditForm({...selectedBranch}); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${branchDetailTab === 'config' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}>التحكم</button>}
               </div>

               <div className="flex bg-indigo-50 p-1 rounded-xl shadow-inner border border-indigo-100">
                  {['day', 'month', 'year'].map(p => (
                    <button key={p} onClick={() => setBranchPeriod(p as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${branchPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-400'}`}>
                      {p === 'day' ? 'يومي' : p === 'month' ? 'شهري' : 'سنوي'}
                    </button>
                  ))}
               </div>
            </div>

            {branchDetailTab === 'data' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-40">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner"><ShoppingCart size={20}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">إجمالي مبيعات الفترة</p><h4 className="text-xl font-black text-slate-800">{totalSales.toLocaleString()} ج.م</h4></div>
                 </div>
                 
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-40">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner"><Activity size={20}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">حالة النشاط</p><h4 className={`text-xl font-black ${selectedBranch.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedBranch.status === 'active' ? 'يعمل الآن' : 'متوقف'}</h4></div>
                 </div>

                 <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex flex-col justify-between h-40 overflow-hidden relative group">
                    <Landmark size={100} className="absolute -right-4 -bottom-4 text-white/5 rotate-12 transition-transform group-hover:scale-110"/>
                    <div className="relative z-10 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Wallet size={20}/></div>
                    <div className="relative z-10">
                       <p className="text-[10px] font-black text-slate-500 uppercase">خزينة الفرع الموحدة</p>
                       <h4 className={`text-xl font-black ${linkedTreasuryBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {linkedTreasuryBalance.toLocaleString()} <span className="text-[10px] opacity-50 uppercase">ج.م</span>
                       </h4>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-1 gap-6">
                    <button onClick={() => setBranchDetailTab('expenses')} className="bg-white p-6 rounded-[2rem] border border-rose-100 shadow-sm flex flex-col justify-between h-40 hover:bg-rose-50 transition-all text-right">
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-inner"><TrendingDown size={20}/></div>
                        <div><p className="text-[10px] font-black text-slate-400 uppercase">مصروفات ({periodExpenses.length})</p><h4 className="text-xl font-black text-rose-600">{totalExpValue.toLocaleString()} ج.م</h4></div>
                    </button>
                 </div>

                 <div className="bg-white p-6 rounded-[2rem] border border-orange-100 shadow-sm flex flex-col justify-between h-40 hover:bg-orange-50 transition-all text-right cursor-pointer" onClick={() => setBranchDetailTab('returns')}>
                    <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shadow-inner"><RotateCcw size={20}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">المرتجعات ({periodReturns.length})</p><h4 className="text-xl font-black text-orange-600">{totalRetValue.toLocaleString()} ج.م</h4></div>
                 </div>

                 <div className="md:col-span-4 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b pb-4"><Info size={20} className="text-indigo-600"/><h4 className="font-black text-sm uppercase">معلومات الفرع التأسيسية</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs font-bold">
                       <div className="space-y-1"><p className="text-slate-400">رقم التشغيل:</p><p className="text-indigo-600 font-mono">#{selectedBranch.operationalNumber}</p></div>
                       <div className="space-y-1"><p className="text-slate-400">الرقم الضريبي:</p><p>{selectedBranch.taxNumber || '---'}</p></div>
                       <div className="space-y-1"><p className="text-slate-400">السجل التجاري:</p><p>{selectedBranch.commercialRegister || '---'}</p></div>
                       <div className="space-y-1"><p className="text-slate-400">رقم الهاتف:</p><p>{selectedBranch.phone || '---'}</p></div>
                       <div className="space-y-1"><p className="text-slate-400">الموقع:</p><p>{selectedBranch.location || 'غير محدد'}</p></div>
                       <div className="space-y-1"><p className="text-slate-400">تاريخ الافتتاح:</p><p>{new Date(selectedBranch.createdAt).toLocaleDateString('ar-EG')}</p></div>
                    </div>
                 </div>
              </div>
            )}
            
            {branchDetailTab === 'performance' && (
               <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px] animate-in slide-in-from-bottom-2">
                  <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-black text-sm text-slate-800 flex items-center gap-2"><UserCheck size={20} className="text-indigo-600"/> قائمة الموظفين في {selectedBranch.name}</h4>
                    <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-xl border">الإجمالي: {branchStaff.length} موظف</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-[11px] font-bold">
                      <thead className="bg-slate-50 text-slate-400 border-b">
                         <tr><th className="px-8 py-4">الموظف</th><th className="px-8 py-4">الوظيفة</th><th className="px-8 py-4 text-center">أيام العمل</th><th className="px-8 py-4 text-center">مبيعات ({branchPeriod})</th><th className="px-8 py-4 text-left">الملف</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-bold">
                         {branchStaff.map(u => {
                            const uPerf = getPerformanceStats(u.id, branchPeriod);
                            return (
                             <tr key={u.id} className="hover:bg-slate-50 transition-all group">
                                <td className="px-8 py-4 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black">{u.fullName[0]}</div><span>{u.fullName}</span></td>
                                <td className="px-8 py-4 text-slate-400">{roles.find(r=>r.role_key===u.role)?.role_name || u.role}</td>
                                <td className="px-8 py-4 text-center text-slate-500 font-mono">{u.daysWorkedAccumulated || 0} يوم</td>
                                <td className="px-8 py-4 text-center text-indigo-600">{uPerf.totalSales.toLocaleString()} ج.م</td>
                                <td className="px-8 py-4 text-left"><button onClick={() => setSelectedStaffProfile(u)} className="p-2 text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"><Eye size={16}/></button></td>
                             </tr>
                          )})}
                      </tbody>
                    </table>
                  </div>
               </div>
            )}

            {branchDetailTab === 'expenses' && (
                <div className="bg-white rounded-[2.5rem] border border-rose-100 shadow-sm overflow-hidden min-h-[400px] animate-in slide-in-from-bottom-2">
                    <div className="p-6 border-b bg-rose-50/50 flex justify-between items-center">
                        <h4 className="font-black text-sm text-rose-800 flex items-center gap-2"><TrendingDown size={20} className="text-rose-600"/> سجل مصروفات الفرع المحددة</h4>
                    </div>
                    <table className="w-full text-right text-[11px] font-bold">
                        <thead className="bg-slate-50 text-slate-400 border-b">
                          <tr>
                            <th className="px-8 py-4">كود العملية</th>
                            <th className="px-8 py-4">البيان</th>
                            <th className="px-8 py-4">المنفذ</th>
                            <th className="px-8 py-4">الوقت والتاريخ</th>
                            <th className="px-8 py-4 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {periodExpenses.map(e => {
                                const executor = users.find(u => u.id === e.createdBy)?.username || '---';
                                return (
                                <tr key={e.id} className="hover:bg-rose-50/20">
                                    <td className="px-8 py-4 text-indigo-600 font-mono">#{e.id.slice(0, 8)}</td>
                                    <td className="px-8 py-4 text-slate-700">{e.description}</td>
                                    <td className="px-8 py-4 text-slate-500 font-black">{executor}</td>
                                    <td className="px-8 py-4 text-slate-400 font-mono text-[10px]">{e.date} | {e.time}</td>
                                    <td className="px-8 py-4 text-left text-rose-600 font-black">{e.amount.toLocaleString()} ج.م</td>
                                </tr>
                            )})}
                            {periodExpenses.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">لا توجد مصروفات لهذه الفترة</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {branchDetailTab === 'returns' && (
                <div className="bg-white rounded-[2.5rem] border border-orange-100 shadow-sm overflow-hidden min-h-[400px] animate-in slide-in-from-bottom-2">
                    <div className="p-6 border-b bg-orange-50/50 flex justify-between items-center">
                        <h4 className="font-black text-sm text-orange-800 flex items-center gap-2"><RotateCcw size={20} className="text-orange-600"/> سجل مرتجعات الفرع المحددة</h4>
                    </div>
                    <table className="w-full text-right text-[11px] font-bold">
                        <thead className="bg-slate-50 text-slate-400 border-b">
                          <tr>
                            <th className="px-8 py-4">كود العملية</th>
                            <th className="px-8 py-4">المنفذ</th>
                            <th className="px-8 py-4">الوقت والتاريخ</th>
                            <th className="px-8 py-4 text-left">المبلغ المسترد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {periodReturns.map(r => {
                                const executor = users.find(u => u.id === r.createdBy)?.username || '---';
                                return (
                                <tr key={r.id} className="hover:bg-orange-50/20">
                                    <td className="px-8 py-4 text-indigo-600 font-mono">#{r.id.slice(-6)}</td>
                                    <td className="px-8 py-4 text-slate-500 font-black">{executor}</td>
                                    <td className="px-8 py-4 text-slate-400 font-mono text-[10px]">{r.date} | {r.time}</td>
                                    <td className="px-8 py-4 text-left text-orange-600 font-black">{r.totalRefund.toLocaleString()} ج.م</td>
                                </tr>
                            )})}
                            {periodReturns.length === 0 && <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic">لا توجد مرتجعات لهذه الفترة</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {branchDetailTab === 'config' && (
               <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-2">
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                     <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-indigo-600" size={24}/><h4 className="font-black text-lg uppercase">تحديث بيانات الفرع</h4></div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">اسم الفرع</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={branchEditForm.name || ''} onChange={e=>setBranchEditForm({...branchEditForm, name: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الموقع الجغرافي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={branchEditForm.location || ''} onChange={e=>setBranchEditForm({...branchEditForm, location: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">رقم هاتف الفرع</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={branchEditForm.phone || ''} onChange={e=>setBranchEditForm({...branchEditForm, phone: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={branchEditForm.taxNumber || ''} onChange={e=>setBranchEditForm({...branchEditForm, taxNumber: e.target.value})} /></div>
                     </div>
                     <div className="pt-6 border-t flex justify-end gap-3">
                        <button onClick={handleUpdateBranchDetails} disabled={isSubmitting} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 hover:bg-black transition-all">
                           {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} حفظ التعديلات
                        </button>
                     </div>
                  </div>

                  <div className="bg-rose-50 p-10 rounded-[2.5rem] border border-rose-100 space-y-6">
                     <h4 className="font-black text-sm text-rose-900 flex items-center gap-2"><ShieldAlert size={20}/> منطقة التحكم السيادي</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={async () => { const next = selectedBranch.status === 'active' ? 'closed_temp' : 'active'; await onUpdateBranch(selectedBranch.id, { status: next }); setSelectedBranch({...selectedBranch, status: next}); onShowToast("تم تغيير حالة الفرع", "success"); }} className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between text-right ${selectedBranch.status === 'active' ? 'bg-white border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-500 text-emerald-600'}`}>
                           <div><p className="font-black text-xs">{selectedBranch.status === 'active' ? 'تعطيل الفرع مؤقتاً' : 'إعادة تشغيل الفرع'}</p><p className="text-[9px] opacity-60">سيؤدي التعطيل لمنع عمليات البيع في هذا الفرع</p></div>
                           <Power size={24}/>
                        </button>
                        <button onClick={() => { askConfirmation("حذف الفرع نهائياً", "سيتم مسح بيانات الفرع تماماً ولن يكون متاحاً في التقارير المستقبلية كفرع نشط.", () => { onDeleteBranch(selectedBranch.id, "طلب إداري"); setSelectedBranch(null); }, 'danger'); }} className="p-6 bg-white border-2 border-rose-100 rounded-3xl text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-between text-right group">
                           <div><p className="font-black text-xs">حذف الفرع نهائياً</p><p className="text-[9px] opacity-60 group-hover:text-white/80">هذا الإجراء سيقوم بأرشفة كافة بيانات الفرع</p></div>
                           <Trash2 size={24}/>
                        </button>
                     </div>
                  </div>
               </div>
            )}
          </div>
        );
    }

    if (viewMode === 'add_user') {
      return (
        <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
             <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><UserPlus size={24} className="text-indigo-600"/> تسجيل عضو جديد بالمنظمة</h3>
             <button onClick={() => setViewMode('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><X size={20}/></button>
          </div>
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm max-w-4xl mx-auto space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الاسم الكامل الرباعي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.fullName} onChange={e=>setNewUserForm({...newUserForm, fullName: e.target.value})} placeholder="الاسم..." /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">رقم الموبايل</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.phone} onChange={e=>setNewUserForm({...newUserForm, phone: e.target.value})} placeholder="01xxxxxxxxx" /></div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الراتب الأساسي</label><input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.salary || ''} onChange={e=>setNewUserForm({...newUserForm, salary: Number(e.target.value)})} placeholder="0.00" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الميلاد</label><input type="date" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.birthDate} onChange={e=>setNewUserForm({...newUserForm, birthDate: e.target.value})} /></div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الفرع التابع له</label><select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.branchId} onChange={e=>setNewUserForm({...newUserForm, branchId: e.target.value})}><option value="">الإدارة المركزية</option>{branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">المسمى الوظيفي</label><select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm, role: e.target.value as UserRole})}>{roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}</select></div>
             </div>
             <div className="flex items-center gap-4 bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                <input type="checkbox" className="w-6 h-6 rounded-lg text-indigo-600" checked={newUserForm.hasPerformance} onChange={e=>setNewUserForm({...newUserForm, hasPerformance: e.target.checked})} id="hasPerf" />
                <label htmlFor="hasPerf" className="text-xs font-black text-indigo-900 cursor-pointer">تفعيل تتبع الأداء والعمولات لهذا الموظف</label>
             </div>
             <div className="pt-6 border-t flex justify-end gap-3">
               <button onClick={() => setViewMode('list')} className="px-10 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-500 hover:bg-slate-50">إلغاء الإجراء</button>
               <button onClick={handleAddUser} disabled={isSubmitting} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">
                  {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <UserPlus size={18}/>} حفظ واعتماد الموظف
               </button>
             </div>
          </div>
        </div>
      );
    }

    if (viewMode === 'add_branch') {
      return (
        <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
             <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><Building2 size={24} className="text-emerald-600"/> تأسيس فرع جديد</h3>
             <button onClick={() => setViewMode('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><X size={20}/></button>
          </div>
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm max-w-4xl mx-auto space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">اسم الفرع التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newBranchForm.name} onChange={e=>setNewBranchForm({...newBranchForm, name: e.target.value})} placeholder="الاسم..." /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الموقع الجغرافي / العنوان</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newBranchForm.location} onChange={e=>setNewBranchForm({...newBranchForm, location: e.target.value})} placeholder="المدينة، الحي، الشارع..." /></div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">رقم هاتف الفرع</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newBranchForm.phone} onChange={e=>setNewBranchForm({...newBranchForm, phone: e.target.value})} placeholder="01xxxxxxxxx" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">الرقم الضريبي (إن وجد)</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newBranchForm.taxNumber} onChange={e=>setNewBranchForm({...newBranchForm, taxNumber: e.target.value})} placeholder="000-000-000" /></div>
             </div>
             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">السجل التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newBranchForm.commercialRegister} onChange={e=>setNewBranchForm({...newBranchForm, commercialRegister: e.target.value})} placeholder="رقم السجل التجاري..." /></div>
             <div className="pt-6 border-t flex justify-end gap-3">
               <button onClick={() => setViewMode('list')} className="px-10 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-500 hover:bg-slate-50">إلغاء</button>
               <button onClick={handleAddBranch} disabled={isSubmitting} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-3">
                  {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <Building2 size={18}/>} إتمام تأسيس الفرع
               </button>
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}><Users size={14}/> الموظفين</button>
            <button onClick={() => setActiveTab('branches')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'branches' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}><Building2 size={14}/> الفروع</button>
            <button onClick={() => setActiveTab('payments')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'payments' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}><Landmark size={14}/> سجل الرواتب</button>
            <button onClick={() => setActiveTab('roles')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'roles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}><ShieldCheck size={14}/> الرتب</button>
          </div>
          <div className="flex gap-3">
             {activeTab === 'users' && isHQAdmin && <button onClick={() => setViewMode('add_user')} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-black transition-all"><UserPlus size={16}/> إضافة موظف</button>}
             {activeTab === 'branches' && isHQAdmin && <button onClick={() => setViewMode('add_branch')} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"><Plus size={16}/> فرع جديد</button>}
          </div>
        </div>

        {activeTab === 'users' && (
          <div className="space-y-6">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex gap-4 flex-col lg:flex-row items-center">
                <div className="relative w-full lg:flex-1"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="بحث الموظفين..." className="w-full pr-14 pl-4 py-3.5 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                {isHQAdmin && (
                  <div className="flex gap-3">
                     <select className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs font-black" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="">كل الوظائف</option>{roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}</select>
                     <select className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs font-black" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}><option value="">كل الفروع</option>{branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </div>
                )}
             </div>
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-right text-[11px] font-bold">
                   <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b"><tr><th className="px-8 py-5">الموظف</th><th className="px-8 py-5">الوظيفة</th><th className="px-8 py-5 text-center">الفرع</th><th className="px-8 py-5 text-left">الملف</th></tr></thead>
                   <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => (
                         <tr key={u.id} className="hover:bg-indigo-50/10 group transition-all">
                            <td className="px-8 py-4 flex items-center gap-4"><div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black">{u.fullName[0]}</div><div><p className="text-slate-800 text-xs font-black">{u.fullName}</p><p className="text-[9px] text-slate-400 uppercase font-mono tracking-widest">#{u.username}</p></div></td>
                            <td className="px-8 py-4"><span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">{roles.find(r => r.role_key === u.role)?.role_name || u.role}</span></td>
                            <td className="px-8 py-4 text-center text-slate-400">{branches.find(b => b.id === u.branchId)?.name || 'الإدارة السيادية'}</td>
                            <td className="px-8 py-4 text-left"><button onClick={() => setSelectedStaffProfile(u)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Eye size={16}/></button></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBranches.map(b => (
               <div key={b.id} onClick={() => { setSelectedBranch(b); setBranchDetailTab('data'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-indigo-600 hover:shadow-lg transition-all cursor-pointer group relative">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-all group-hover:scale-110 ${b.status === 'active' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}><Building2 size={28}/></div>
                  <h3 className="text-xl font-black text-slate-800">{b.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{b.location || 'موقع غير مسجل'}</p>
                  <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-4">
                     <div className="flex items-center gap-2 text-slate-500"><Users size={16}/><span className="text-xs font-black">{users.filter(u=>u.branchId===b.id && !u.isDeleted).length} موظف</span></div>
                     <ChevronLeft size={18} className="text-slate-200 group-hover:text-indigo-600 transition-all"/>
                  </div>
               </div>
            ))}
          </div>
        )}

        {activeTab === 'roles' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map(r => (
                 <div 
                   key={r.id} 
                   onClick={() => { setRoleFilter(r.role_key); setActiveTab('users'); }}
                   className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-amber-600 hover:shadow-lg transition-all group cursor-pointer"
                 >
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:bg-amber-600 group-hover:text-white transition-all shadow-md"><ShieldCheck size={28}/></div>
                    <h3 className="text-xl font-black text-slate-800">{r.role_name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">المعرف: {r.role_key}</p>
                    <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-4">
                       <div className="flex items-center gap-2 text-slate-500"><Layers size={16}/><span className="text-xs font-black">{users.filter(u=>u.role===r.role_key && !u.isDeleted).length} موظف</span></div>
                       <ChevronLeft size={18} className="text-slate-200 group-hover:text-amber-600 transition-all"/>
                    </div>
                 </div>
              ))}
           </div>
        )}

        {activeTab === 'payments' && (
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
              <table className="w-full text-right text-[11px] font-bold">
                 <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                    <tr><th className="px-8 py-5">الموظف</th><th className="px-8 py-5">الفرع</th><th className="px-8 py-5">البيان</th><th className="px-8 py-5 text-center">المبلغ</th><th className="px-8 py-5 text-left">التاريخ</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 font-bold">
                    {staffPayments.map(p => {
                       const staff = users.find(u=>u.id===p.staffId);
                       return (
                       <tr key={p.id} className="hover:bg-slate-50 transition-all">
                          <td className="px-8 py-4">{staff?.fullName || '---'}</td>
                          <td className="px-8 py-4 text-slate-400 uppercase text-[9px]">{branches.find(b=>b.id===staff?.branchId)?.name || 'الإدارة'}</td>
                          <td className="px-8 py-4 text-xs font-black">{p.paymentType} <span className="text-[9px] text-slate-300 font-normal">({p.notes})</span></td>
                          <td className={`px-8 py-4 text-center font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.amount.toLocaleString()} ج.م</td>
                          <td className="px-8 py-4 text-left text-slate-400 font-mono text-[9px]">{new Date(p.paymentDate).toLocaleString('ar-EG')}</td>
                       </tr>
                    )})}
                 </tbody>
              </table>
           </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {isPaymentOpen.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تسجيل عملية مالية للموظف</h3>
                 <button onClick={() => setIsPaymentOpen({isOpen: false, user: null})}><X size={24}/></button>
              </div>
              <div className="p-10 space-y-6">
                 <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">الموظف المستهدف</p>
                    <h4 className="text-lg font-black text-indigo-600">{isPaymentOpen.user?.fullName}</h4>
                 </div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">المبلغ المطلوب (ج.م)</label><input type="number" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" value={paymentForm.amount || ''} onChange={e=>setPaymentForm({...paymentForm, amount: Number(e.target.value)})} placeholder="0.00" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">نوع العملية</label><select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={paymentForm.type} onChange={e=>setPaymentForm({...paymentForm, type: e.target.value as any})}><option value="راتب">صرف راتب</option><option value="حافز">مكافأة / حافز</option><option value="سلفة">سلفة مالية</option><option value="خصم">خصم / جزاء</option></select></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">ملاحظات / البيان</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="اكتب تفاصيل الصرف..." /></div>
                 <button onClick={async () => {
                    if (!isPaymentOpen.user || paymentForm.amount <= 0 || isSubmitting) return;
                    setIsSubmitting(true);
                    try {
                      await onAddStaffPayment(isPaymentOpen.user.id, paymentForm.amount, paymentForm.type, paymentForm.notes, currentUser.id);
                      onShowToast("تم تسجيل العملية بنجاح", "success");
                      setIsPaymentOpen({ isOpen: false, user: null });
                      setPaymentForm({ amount: 0, type: 'راتب', notes: '' });
                    } catch (e) { onShowToast("فشل تسجيل العملية", "error"); } finally { setIsSubmitting(false); }
                 }} disabled={isSubmitting || paymentForm.amount <= 0} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} تأكيد وصرف المبلغ
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default Staff;