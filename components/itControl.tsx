import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, ShieldAlert, Save, RefreshCw, Eye, EyeOff, LayoutGrid,
  Trash2, AlertTriangle, Settings2, Lock, ShieldX, Check, Zap, Tag, X,
  ShieldCheck, ToggleLeft, ToggleRight, ChevronDown, Percent, Sparkles,
  DownloadCloud, UploadCloud, FileJson, Database, Server, DatabaseZap,
  ShoppingCart, Box, Wallet
} from 'lucide-react';
import { SystemSettings, PermissionOverride, User as UserType, ProceduralAction, ViewType } from '../types';
import { AppRole } from '../hooks/useSystemSettings';
import { supabase } from '../supabaseClient';
import { useInventory } from '../hooks/useInventory';

interface ITControlProps {
  settings: SystemSettings;
  overrides: PermissionOverride[];
  roles: AppRole[];
  onUpdateSettings: (s: Partial<SystemSettings>) => Promise<void>;
  onAddOverride: (o: Omit<PermissionOverride, 'id'>) => Promise<void>;
  onRemoveOverride: (id: string) => Promise<void>;
  onAddRole: (key: string, name: string) => Promise<void>;
  onDeleteRole: (key: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
}

const ITControl: React.FC<ITControlProps> = ({ 
  settings, overrides, roles, onUpdateSettings, onAddRole, onDeleteRole, onShowToast, user, onRemoveOverride
}) => {
  const isMasterAdmin = user.username === 'admin';
  const { applyGlobalDiscount, clearAllOffers } = useInventory();
  const [formData, setFormData] = useState({...settings} as SystemSettings);
  const [activeTab, setActiveTab] = useState('roles' as 'general' | 'permissions' | 'roles' | 'infrastructure' | 'offers' | 'sovereignty');
  const [restrictionType, setRestrictionType] = useState('role' as 'role' | 'user');
  const [targetId, setTargetId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [systemUsers, setSystemUsers] = useState<UserType[]>([]);
  const [resetConfirmation, setResetConfirmation] = useState(0);
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0 as number);
  const [newRole, setNewRole] = useState({ key: '', name: '' });

  const sectionOptions: Array<{ id: ViewType; label: string }> = [
    { id: 'dashboard', label: 'الرئيسية' },
    { id: 'sales', label: 'نقطة البيع' },
    { id: 'inventory', label: 'المخزن' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'purchases', label: 'المشتريات' },
    { id: 'suppliers', label: 'الموردين' },
    { id: 'customers', label: 'العملاء' },
    { id: 'expenses', label: 'المصاريف' },
    { id: 'treasury', label: 'الخزنة' },
    { id: 'staff', label: 'الموارد البشرية' },
    { id: 'reports', label: 'التقارير' },
    { id: 'dailyLogs', label: 'سجلات النشاط' },
    { id: 'securityAudit', label: 'الرقابة الأمنية' },
    { id: 'archive', label: 'الأرشيف' },
    { id: 'correspondence', label: 'المراسلات' },
    { id: 'itControl', label: 'لوحة IT' },
    { id: 'recycleBin', label: 'المحذوفات' }
  ];

  const actionOptions: Array<{ id: ProceduralAction; label: string }> = [
    { id: 'sell', label: 'تنفيذ عمليات البيع' },
    { id: 'delete_product', label: 'أرشفة/حذف المنتجات' },
    { id: 'delete_invoice', label: 'إلغاء فواتير المبيعات' },
    { id: 'process_return', label: 'تنفيذ مرتجعات المبيعات' },
    { id: 'manage_staff', label: 'إدارة شؤون الموظفين' },
    { id: 'staff_finance_adjust', label: 'تعديل السجلات المالية للموظفين' },
    { id: 'manage_suppliers', label: 'إدارة الموردين' },
    { id: 'view_reports', label: 'الوصول للتقارير المتقدمة' },
    { id: 'approve_leaves', label: 'الموافقة على الإجازات' },
    { id: 'edit_branch', label: 'تعديل بيانات الفروع' },
    { id: 'reset_passwords', label: 'تصفير كلمات السر' }
  ];

  useEffect(() => {
    setFormData({...settings});
  }, [settings]);

  useEffect(() => {
    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('*').eq('is_deleted', false);
        if (data) setSystemUsers(data as any);
    };
    if (activeTab === 'permissions') fetchUsers();
  }, [activeTab]);

  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const tables = [
        'system_settings', 'app_roles', 'branches', 'users',
        'products', 'suppliers', 'purchase_records', 'supplier_payments',
        'sales_invoices', 'returns', 'expenses', 'staff_payments',
        'permission_overrides', 'unified_archive', 'treasury_logs',
        'correspondence', 'leave_requests', 'shifts', 'audit_logs'
      ];
      const backupData: Record<string, any> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backupData[table] = data || [];
      }
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meeza_POS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      onShowToast("تم تصدير النسخة الاحتياطية بنجاح", "success");
    } catch (e) {
      onShowToast("فشل تصدير النسخة الاحتياطية", "error");
    } finally { setIsLoading(false); }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      onShowToast("جاري تهيئة السحابة للاستعادة...", "success");
      
      // استخدام RPC المحدث مع WHERE
      const { error: rpcError } = await supabase.rpc('reset_entire_system');
      if (rpcError) throw rpcError;
      
      const tablesOrder = [
        'system_settings', 'app_roles', 'branches', 'users',
        'products', 'suppliers', 'purchase_records', 'supplier_payments',
        'sales_invoices', 'returns', 'expenses', 'staff_payments',
        'permission_overrides', 'unified_archive', 'treasury_logs',
        'correspondence', 'leave_requests', 'shifts', 'audit_logs'
      ];

      for (const table of tablesOrder) {
        if (data[table] && data[table].length > 0) {
          await supabase.from(table).insert(data[table]);
        }
      }
      onShowToast("تمت استعادة البيانات بنجاح. سيتم إعادة التشغيل.", "success");
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      onShowToast("فشل الاستعادة: " + (e.message || "الملف غير متوافق"), "error");
    } finally { setIsLoading(false); }
  };

  const handleToggleMatrix = (matrixKey: 'roleHiddenSections' | 'roleHiddenActions' | 'userHiddenSections' | 'userHiddenActions', optionId: string) => {
    if (!targetId) {
        onShowToast("يرجى اختيار الرتبة أو المستخدم أولاً", "error");
        return;
    }
    setFormData(prev => {
      const currentMatrix = { ...(prev[matrixKey] as Record<string, string[]>) || {} };
      const list = [...(currentMatrix[targetId] || [])];
      if (list.includes(optionId)) {
        currentMatrix[targetId] = list.filter(id => id !== optionId);
      } else {
        currentMatrix[targetId] = [...list, optionId];
      }
      return { ...prev, [matrixKey]: currentMatrix };
    });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings(formData);
      onShowToast("تم حفظ الإعدادات بنجاح", "success");
    } catch (e) { 
        onShowToast("فشل حفظ التغييرات", "error"); 
    } finally { setIsSaving(false); }
  };

  const handleFullReset = async () => {
    if (resetConfirmation < 2) {
        setResetConfirmation(prev => prev + 1);
        return;
    }
    setIsSaving(true);
    try {
      // محاولة استدعاء الدالة السحابية المحدثة
      const { error } = await supabase.rpc('reset_entire_system');
      
      if (error) {
        // إذا كان الخطأ متعلق بـ WHERE clause، فهذا يعني أن المستخدم لم يقم بتحديث الـ SQL
        if (error.message.includes('WHERE clause')) {
           throw new Error("خطأ أمني: يرجى تحديث دالة reset_entire_system في Supabase SQL Editor أولاً لتتضمن شرط WHERE id IS NOT NULL.");
        }
        throw error;
      }

      localStorage.clear();
      onShowToast("تم تنفيذ بروتوكول التطهير بنجاح", "success");
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      console.error(e);
      onShowToast(e.message || "حدث خطأ أثناء التصفير", "error");
      setResetConfirmation(0);
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-[#0f172a] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg border-2 border-indigo-400"><ShieldAlert size={32}/></div>
             <div><h3 className="text-2xl font-black mb-1">وحدة التحكم السيادي</h3><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">IT SOVEREIGN CONTROL</p></div>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-md overflow-x-auto scrollbar-hide border border-white/10">
             <button onClick={() => setActiveTab('roles')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'roles' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>الوظائف</button>
             <button onClick={() => setActiveTab('offers')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'offers' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>العروض</button>
             <button onClick={() => setActiveTab('permissions')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'permissions' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>المصفوفة</button>
             <button onClick={() => setActiveTab('general')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'general' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>إعدادات</button>
             <button onClick={() => setActiveTab('infrastructure')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'infrastructure' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>البنية التحتية</button>
             <button onClick={() => setActiveTab('sovereignty')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'sovereignty' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}>التطهير</button>
          </div>
        </div>
      </div>

      {activeTab === 'infrastructure' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                 <div className="flex items-center gap-4 border-b pb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><DownloadCloud size={24}/></div>
                    <div><h4 className="font-black text-sm text-slate-800">تصدير البيانات (JSON)</h4><p className="text-[10px] text-slate-400 font-bold uppercase">Cloud Backup Service</p></div>
                 </div>
                 <p className="text-[11px] text-slate-500 leading-relaxed font-bold">قم بتحميل نسخة مشفرة من كافة سجلات النظام (موظفين، مخزن، مبيعات، موردين) للرجوع إليها في أي وقت.</p>
                 <button onClick={handleBackup} disabled={isLoading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                    {isLoading ? <RefreshCw className="animate-spin" size={18}/> : <FileJson size={18}/>}
                    بدء تصدير ملف النسخة الاحتياطية
                 </button>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                 <div className="flex items-center gap-4 border-b pb-6">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><UploadCloud size={24}/></div>
                    <div><h4 className="font-black text-sm text-slate-800">استعادة النظام</h4><p className="text-[10px] text-slate-400 font-bold uppercase">Infrastructure Recovery</p></div>
                 </div>
                 <p className="text-[11px] text-slate-500 leading-relaxed font-bold">تحذير: سيتم مسح كافة البيانات الحالية واستبدالها بمحتويات ملف النسخة الاحتياطية المختار.</p>
                 <input type="file" accept=".json" ref={fileInputRef} onChange={handleRestore} className="hidden" />
                 <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                    {isLoading ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                    رفع واستعادة ملف البيانات
                 </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="max-w-4xl mx-auto bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم التطبيق التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={formData.appName} onChange={e=>setFormData({...formData, appName: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">العملة النظامية</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none text-center" value={formData.currency} onChange={e=>setFormData({...formData, currency: e.target.value})} /></div>
           </div>
           
           <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className={`p-3 rounded-xl ${formData.globalSystemLock ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white shadow-lg'}`}>{formData.globalSystemLock ? <Lock size={20}/> : <ShieldCheck size={20}/>}</div>
                 <div><p className="text-xs font-black text-slate-800">الإغلاق السيادي للنظام</p><p className="text-[9px] text-slate-400 font-bold uppercase">Global Infrastructure Lock</p></div>
              </div>
              <button onClick={()=>setFormData({...formData, globalSystemLock: !formData.globalSystemLock})} className={`w-14 h-8 rounded-full relative transition-all ${formData.globalSystemLock ? 'bg-rose-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.globalSystemLock ? 'left-1' : 'left-7'}`}></div></button>
           </div>

           <div className="flex justify-center pt-4"><button onClick={handleSaveSettings} disabled={isSaving} className="px-20 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">{isSaving ? <RefreshCw className="animate-spin" size={24}/> : <Save size={24}/>} اعتماد الإعدادات العامة</button></div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                 <button onClick={()=>{setRestrictionType('role'); setTargetId('');}} className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'role' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>حسب الرتبة</button>
                 <button onClick={()=>{setRestrictionType('user'); setTargetId('');}} className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>حسب الموظف</button>
              </div>
              <div className="flex-1 w-full relative">
                 <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none appearance-none cursor-pointer" value={targetId} onChange={e=>setTargetId(e.target.value)}>
                    <option value="">{restrictionType === 'role' ? '-- اختر الرتبة الوظيفية --' : '-- اختر الموظف --'}</option>
                    {restrictionType === 'role' 
                        ? roles.map(r=><option key={r.id} value={r.role_key}>{r.role_name}</option>) 
                        : systemUsers.map(u=><option key={u.id} value={u.username}>{u.fullName}</option>)
                    }
                 </select>
                 <ChevronDown size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
           </div>

           {targetId && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                   <h4 className="font-black text-sm flex items-center gap-2 text-indigo-600 border-b pb-4"><LayoutGrid size={18}/> إخفاء الأقسام (المصفوفة)</h4>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sectionOptions.map(opt => {
                         const matrixKey = restrictionType === 'role' ? 'roleHiddenSections' : 'userHiddenSections';
                         const isHidden = (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                         return (
                            <button key={opt.id} onClick={()=>handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-2xl text-[10px] font-black transition-all flex flex-col items-center gap-3 border-2 ${isHidden ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'}`}>
                               {isHidden ? <EyeOff size={18}/> : <Eye size={18}/>} {opt.label}
                            </button>
                         );
                      })}
                   </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                   <h4 className="font-black text-sm flex items-center gap-2 text-rose-600 border-b pb-4"><Zap size={18}/> تقييد الصلاحيات الحساسة</h4>
                   <div className="space-y-3">
                      {actionOptions.map(opt => {
                         const matrixKey = restrictionType === 'role' ? 'roleHiddenActions' : 'userHiddenActions';
                         const isForbidden = (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                         return (
                            <div key={opt.id} onClick={()=>handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${isForbidden ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-100'}`}>
                               <div className="flex items-center gap-3">{isForbidden ? <Lock size={16}/> : <Check size={16} className="text-emerald-500"/>}<span className="text-[11px] font-black">{opt.label}</span></div>
                               {isForbidden ? <ToggleRight className="text-rose-600" size={24}/> : <ToggleLeft className="text-slate-300" size={24}/>}
                            </div>
                         );
                      })}
                   </div>
                </div>
                <div className="lg:col-span-2 flex justify-center"><button onClick={handleSaveSettings} disabled={isSaving} className="px-20 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">{isSaving ? <RefreshCw className="animate-spin" size={24}/> : <Save size={24}/>} اعتماد مصفوفة الوصول</button></div>
             </div>
           )}
        </div>
      )}

      {activeTab === 'sovereignty' && isMasterAdmin && (
        <div className="max-w-xl mx-auto bg-white p-10 rounded-[3rem] border border-rose-100 shadow-2xl text-center space-y-8 animate-in zoom-in-95">
           <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner animate-pulse"><AlertTriangle size={48}/></div>
           <h3 className="text-2xl font-black text-slate-800">بروتوكول التطهير السيادي</h3>
           <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase">هذا الإجراء سيقوم بمسح كافة السجلات السحابية نهائياً (الفروع، الموظفين، المنتجات، المبيعات) وإعادة النظام لحالة المصنع.</p>
           <button onClick={handleFullReset} disabled={isSaving} className={`w-full py-5 rounded-[2rem] font-black text-white transition-all shadow-xl ${resetConfirmation === 0 ? 'bg-slate-800' : resetConfirmation === 1 ? 'bg-orange-600' : 'bg-rose-600 animate-bounce'}`}>
              {isSaving ? <RefreshCw className="animate-spin mx-auto" size={24}/> : resetConfirmation === 0 ? 'بدء التطهير الشامل' : resetConfirmation === 1 ? 'هل أنت متأكد تماماً؟' : 'اضغط للتأكيد النهائي القاطع'}
           </button>
           {resetConfirmation > 0 && <button onClick={()=>setResetConfirmation(0)} className="text-xs font-black text-slate-400 hover:text-indigo-600 underline">إلغاء البروتوكول</button>}
        </div>
      )}
    </div>
  );
};

export default ITControl;