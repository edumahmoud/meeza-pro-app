import React, { useState, useMemo } from 'react';
import { 
  UserCircle, Phone, TrendingUp, Save, History, Calendar, Settings, Building2, Key, ShoppingBag, CreditCard, ChevronRight, ChevronLeft, Image as ImageIcon, RefreshCw, ShieldCheck, BadgeCheck, DollarSign, Activity, Send, X, Clock, FileSpreadsheet
} from 'lucide-react';
import { User, StaffPayment, Invoice, Branch, LeaveRequest, ProceduralAction } from '../types';
import { supabase } from '../supabaseClient';
import { AppRole } from '../hooks/useSystemSettings';
import * as XLSX from 'xlsx';

interface UserProfileProps {
  user: User;
  staffPayments: StaffPayment[];
  invoices: Invoice[];
  branches: Branch[];
  roles: AppRole[];
  onShowToast: (m: string, t: 'success' | 'error') => void;
  onUpdateCurrentUser: (updates: Partial<User>) => void;
  onAddLeaveRequest?: (req: Omit<LeaveRequest, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  checkPermission: (user: { role: string, username: string }, action: ProceduralAction) => boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, staffPayments, invoices, branches, roles, onShowToast, onUpdateCurrentUser, onAddLeaveRequest, checkPermission }) => {
  const [newPhone, setNewPhone] = useState(user.phoneNumber || '');
  const [newImage, setNewImage] = useState(user.imageUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statPeriod, setStatPeriod] = useState('month' as 'day' | 'month' | 'year');

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ 
    startDate: '', 
    endDate: '', 
    reason: '', 
    type: 'normal' 
  } as { startDate: string; endDate: string; reason: string; type: 'normal' | 'emergency' });

  const userRoleName = useMemo(() => {
    return roles.find(r => r.role_key === user.role)?.role_name || user.role;
  }, [roles, user.role]);

  const personalStats = useMemo(() => {
    const userInvoices = invoices.filter(i => i.createdBy === user.id && !i.isDeleted);
    const now = new Date();
    const today = now.toLocaleDateString('ar-EG');
    
    const filtered = userInvoices.filter(i => {
       const d = new Date(i.timestamp);
       if (statPeriod === 'day') return i.date === today;
       if (statPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
       if (statPeriod === 'year') return d.getFullYear() === now.getFullYear();
       return true;
    });
    
    const totalSales = filtered.reduce((a, b) => a + b.netTotal, 0);
    
    return {
      count: filtered.length,
      totalSales,
      avgInvoice: filtered.length > 0 ? (totalSales / filtered.length) : 0,
      estimatedCommission: totalSales * 0.01,
      filteredInvoices: filtered
    };
  }, [invoices, user.id, statPeriod]);

  const handleUpdateAccount = async () => {
    setIsUpdating(true);
    try {
      const updates: any = { phone_number: newPhone, image_url: newImage };
      if (newPassword.trim()) {
        updates.password = newPassword;
      }

      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw error;

      onUpdateCurrentUser({ phoneNumber: newPhone, imageUrl: newImage });
      onShowToast("تم تحديث بيانات الحساب بنجاح", "success");
      setNewPassword('');
    } catch (err: any) {
      onShowToast("فشل تحديث البيانات", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
       <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden relative">
          <div className="h-40 bg-indigo-600 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <UserCircle size={400} className="text-white absolute -bottom-20 -right-20" />
             </div>
          </div>
          <div className="px-10 pb-10 flex flex-col md:flex-row items-end gap-8 -mt-16 relative z-10">
             <div className="w-40 h-40 bg-white rounded-[2.5rem] p-1.5 shadow-2xl overflow-hidden border-4 border-white">
                {user.imageUrl ? (
                  <img src={user.imageUrl} className="w-full h-full object-cover rounded-[2.2rem]" alt="Profile" />
                ) : (
                  <div className="w-full h-full bg-indigo-50 rounded-[2.2rem] flex items-center justify-center text-indigo-600 text-6xl font-black">{(user.fullName || '?')[0]}</div>
                )}
             </div>
             <div className="flex-1 pb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-black text-slate-800">{user.fullName || '---'}</h3>
                  <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">{userRoleName}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                   <span className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> كود المستخدم: {user.username}</span>
                   <span className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-widest"><Building2 size={14}/> الفرع: {branches.find(b => b.id === user.branchId)?.name || 'مقر الإدارة'}</span>
                </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
             <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-indigo-600" size={20} /><h4 className="font-black text-sm text-slate-800">إعدادات الحساب</h4></div>
             <div className="space-y-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رابط الصورة</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs" value={newImage} onChange={e => setNewImage(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم الهاتف</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">كلمة السر الجديدة</label><input type="password" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="اتركه فارغاً للحفاظ على الحالية" /></div>
                <button onClick={handleUpdateAccount} disabled={isUpdating} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-xs">{isUpdating ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18} />}حفظ التعديلات</button>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex justify-between items-center relative overflow-hidden">
                <CreditCard size={120} className="absolute -bottom-6 -left-6 text-white/5 rotate-12" />
                <div className="relative z-10">
                   <p className="text-[10px] font-black text-indigo-300 uppercase mb-2">الراتب الشهري</p>
                   <h4 className="text-3xl font-black">{user.salary.toLocaleString()} <span className="text-sm opacity-50">ج.م</span></h4>
                </div>
                <div className="text-left relative z-10">
                   <p className="text-[10px] font-black text-indigo-300 uppercase mb-2">أيام العمل</p>
                   <h4 className="text-3xl font-black">{user.daysWorkedAccumulated || 0} يوم</h4>
                </div>
             </div>
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[300px]">
                <div className="p-6 border-b bg-slate-50/50 flex items-center gap-3"><History size={18} className="text-indigo-600"/><h4 className="font-black text-sm text-slate-800">آخر العمليات المالية الشخصية</h4></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                   {staffPayments.filter(p => p.staffId === user.id).length > 0 ? (
                      staffPayments.filter(p => p.staffId === user.id).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                           <div><p className="text-xs font-black text-slate-800">{p.paymentType}</p><p className="text-[9px] text-slate-400">{new Date(p.paymentDate).toLocaleDateString('ar-EG')}</p></div>
                           <p className={`text-sm font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.amount.toLocaleString()} ج.م</p>
                        </div>
                      ))
                   ) : (
                     <p className="text-center py-10 text-slate-300 text-xs font-bold uppercase">لا توجد عمليات مسجلة</p>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default UserProfile;