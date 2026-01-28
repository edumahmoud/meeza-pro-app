
import React, { useState, useEffect } from 'react';
import { 
  Terminal, ShieldAlert, Globe, Save, RefreshCw, Eye, EyeOff, Layout,
  Trash2, AlertTriangle, Database, Plus, Settings2, Activity,
  Lock, ShieldX, Key, Check, Zap, Coins, ImageIcon, Briefcase, 
  UserCog, User, Eraser, Info, Palette, Type, Smartphone, Loader2, ShieldPlus, ListChecks,
  PackageSearch, History, ShieldQuestion, RotateCcw, Sparkles, FileSpreadsheet, Percent, Tag, X
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
  onAddRole: (key: string, name: string) => Promise<void>;
  onDeleteRole: (key: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
  onRemoveOverride: (id: string) => Promise<void>;
}

const ITControl: React.FC<ITControlProps> = ({ 
  settings, overrides, roles, onUpdateSettings, onAddOverride, onRemoveOverride, onAddRole, onDeleteRole, onShowToast, user 
}) => {
  const { applyGlobalDiscount, clearAllOffers } = useInventory();
  const [formData, setFormData] = useState({...settings} as SystemSettings);
  const [activeTab, setActiveTab] = useState('roles' as 'general' | 'permissions' | 'roles' | 'sovereignty' | 'offers');
  const [restrictionType, setRestrictionType] = useState('role' as 'role' | 'user');
  const [targetId, setTargetId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [resetStatus, setResetStatus] = useState('idle' as 'idle' | 'processing' | 'success' | 'error');
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState(0);

  const [newRole, setNewRole] = useState({ key: '', name: '' });
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0 as number);

  const sectionOptions: Array<{ id: ViewType; label: string }> = [
    { id: 'dashboard', label: 'الرئيسية' },
    { id: 'sales', label: 'نقطة البيع' },
    { id: 'inventory', label: 'المخزن' },
    { id: 'purchases', label: 'المشتريات' },
    { id: 'suppliers', label: 'الموردين' },
    { id: 'customers', label: 'العملاء' },
    { id: 'expenses', label: 'المصاريف' },
    { id: 'treasury', label: 'الخزنة' },
    { id: 'staff', label: 'الموارد البشرية' },
    { id: 'reports', label: 'التقارير' },
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

  const handleApplyGlobalDiscount = async () => {
    if (!globalDiscountValue || isSaving) return;
    setIsSaving(true);
    try {
      await applyGlobalDiscount(globalDiscountValue, user);
      onShowToast(`تم تطبيق خصم ${globalDiscountValue}% على كافة الأصناف`, "success");
      setGlobalDiscountValue(0);
    } catch (e) { onShowToast("فشل تطبيق الخصم العام", "error"); } finally { setIsSaving(false); }
  };

  const handleClearOffers = async () => {
    setIsSaving(true);
    try {
      await clearAllOffers(user);
      onShowToast("تم تصفير كافة العروض والعودة للأسعار الرسمية", "success");
    } catch (e) { onShowToast("فشل إلغاء العروض", "error"); } finally { setIsSaving(false); }
  };

  const handleToggleMatrix = (matrixKey: keyof SystemSettings, optionId: string) => {
    if (!targetId) return;
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

  const handleSaveMatrix = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings(formData);
      onShowToast("تم حفظ مصفوفة الصلاحيات بنجاح", "success");
    } catch (e) { onShowToast("فشل حفظ التغييرات", "error"); } finally { setIsSaving(false); }
  };

  const isMasterAdmin = user.username === 'admin' || user.id === '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    setFormData({...settings});
  }, [settings]);

  const handleFullReset = async () => {
    if (!isMasterAdmin) return onShowToast("عفواً، لا يملك صلاحية هذا الإجراء إلا المستخدم الافتراضي", "error");
    
    if (resetConfirmation < 2) {
        setResetConfirmation(prev => prev + 1);
        return;
    }

    setResetStatus('processing');
    setErrorMessage('');
    setProgress(0);
    
    const tablesToWipe = [
      'audit_logs', 'unified_archive', 'permission_overrides', 'staff_payments', 
      'expenses', 'returns', 'sales_invoices', 'treasury_logs', 'purchase_returns', 
      'supplier_payments', 'purchase_records', 'suppliers', 'products', 
      'leave_requests', 'correspondence', 'shifts', 'users', 'branches'
    ];

    try {
      setCurrentStage("جاري استدعاء بروتوكول التصفير...");
      
      // الخطوة الأولى: محاولة RPC
      const { error: rpcError } = await supabase.rpc('reset_entire_system');
      
      if (rpcError) {
        console.warn("RPC Failed or Missing, using manual sequence with bypass...");
        let p = 0;
        for (const table of tablesToWipe) {
          p += (100 / tablesToWipe.length);
          setProgress(Math.floor(p));
          setCurrentStage(`تطهير جدول: ${table}...`);
          
          // الحل الجذري: إضافة .neq('id', 'some-random-uuid') لإجبار وجود شرط WHERE
          const { error: wipeError } = await supabase
            .from(table)
            .delete()
            .neq('id', 'ffffffff-ffff-ffff-ffff-ffffffffffff'); // شرط وهمي لتجاوز Safe Delete Mode
          
          if (wipeError && !wipeError.message.includes("does not exist")) {
             throw wipeError;
          }
        }
      }

      setProgress(100);
      setCurrentStage("اكتمل التطهير السيادي بنجاح.");
      setResetStatus('success');
      localStorage.clear();
      onShowToast("تم تصفير النظام بالكامل بنجاح", "success");
      setTimeout(() => window.location.reload(), 2000);

    } catch (e: any) {
      console.error("Nuclear Reset Failed:", e);
      setResetStatus('error');
      setErrorMessage(e.message || "DELETE requires a WHERE clause");
      setResetConfirmation(0);
    }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Sovereign Header */}
      <div className="bg-[#0f172a] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-[#3b82f6] rounded-[1.5rem] flex items-center justify-center shadow-lg border-2 border-indigo-400">
                <ShieldAlert size={32} className="text-white"/>
             </div>
             <div>
                <h3 className="text-2xl font-black mb-1">وحدة التحكم السيادي</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">IT SOVEREIGN INFRASTRUCTURE</p>
             </div>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-md overflow-x-auto scrollbar-hide border border-white/10">
             <button onClick={() => setActiveTab('roles')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'roles' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>الوظائف</button>
             <button onClick={() => setActiveTab('offers')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'offers' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>العروض</button>
             <button onClick={() => setActiveTab('permissions')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'permissions' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>المصفوفة</button>
             <button onClick={() => setActiveTab('general')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'general' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>إعدادات</button>
             {isMasterAdmin && <button onClick={() => setActiveTab('sovereignty')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'sovereignty' ? 'bg-[#f43f5e] text-white' : 'text-slate-400'}`}>التطهير</button>}
          </div>
        </div>
      </div>

      {activeTab === 'sovereignty' && isMasterAdmin && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-10">
           {resetStatus === 'processing' || resetStatus === 'success' ? (
              <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl space-y-10 text-center">
                 <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                       <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentStage}</p>
                       <p className="text-2xl font-black text-slate-900">{progress}%</p>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-1">
                       <div 
                         className="h-full bg-gradient-to-l from-indigo-600 to-indigo-400 rounded-full transition-all duration-500 ease-out shadow-lg" 
                         style={{ width: `${progress}%` }}
                       ></div>
                    </div>
                 </div>
                 <div className="flex flex-col items-center gap-4">
                    {resetStatus === 'success' ? (
                       <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center animate-bounce shadow-lg shadow-emerald-50">
                          <Check size={48}/>
                       </div>
                    ) : (
                       <Loader2 className="animate-spin text-indigo-600" size={48}/>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">بروتوكول تدمير البيانات قيد التنفيذ</p>
                 </div>
              </div>
           ) : (
              <div className="bg-[#fff1f2] border-2 border-rose-100 p-12 rounded-[3.5rem] text-center space-y-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-5">
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="absolute -top-10 -right-10 w-64 h-64">
                      <path fill="#f43f5e" d="M44.7,-76.4C58.1,-69.2,69.2,-58.1,76.4,-44.7C83.7,-31.3,87.1,-15.7,87.1,0C87.1,15.7,83.7,31.3,76.4,44.7C69.2,58.1,58.1,69.2,44.7,76.4C31.3,83.7,15.7,87.1,0,87.1C-15.7,87.1,-31.3,83.7,-44.7,76.4C-58.1,69.2,-69.2,58.1,-76.4,44.7C-83.7,31.3,-87.1,15.7,-87.1,0C-87.1,-15.7,-83.7,-31.3,-76.4,-44.7C-69.2,-58.1,-58.1,-69.2,-44.7,-76.4C-31.3,-83.7,-15.7,-87.1,0,-87.1C15.7,-87.1,31.3,-83.7,44.7,-76.4Z" transform="translate(100 100)" />
                    </svg>
                 </div>

                 <div className="w-24 h-24 bg-[#f43f5e] text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-rose-200 relative z-10">
                    <Database size={48}/>
                 </div>

                 <div className="relative z-10 space-y-2">
                    <h3 className="text-3xl font-black text-rose-900 uppercase">التطهير السيادي (FACTORY RESET)</h3>
                    <p className="text-sm font-bold text-rose-600/60 uppercase tracking-widest">NUCLEAR RESET PROTOCOL V2.0</p>
                 </div>

                 <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-lg mx-auto relative z-10">
                    سيتم مسح كافة البيانات السحابية (مبيعات، مخزون، موظفين، فروع) بضربة واحدة دقيقة. تأهب للإجراء.
                 </p>

                 <div className="pt-4 space-y-4 relative z-10">
                    <button 
                     onClick={handleFullReset} 
                     className="w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 bg-[#0f172a] text-white hover:bg-black"
                    >
                       {resetConfirmation === 0 ? "بدء إجراءات التصفير الشامل" : 
                        resetConfirmation === 1 ? "تأكيد بروتوكول المسح (1/2)" : 
                        "تأكيد نهائي: تنفيذ التدمير"}
                    </button>
                    
                    {resetStatus === 'error' && (
                       <div className="bg-white border-2 border-rose-200 p-6 rounded-[2rem] shadow-xl animate-in slide-in-from-top-4">
                          <div className="flex flex-col items-center gap-2">
                             <div className="flex items-center gap-2 text-rose-600">
                                <ShieldAlert size={24}/>
                                <span className="font-black text-lg">فشل تنفيذ البروتوكول</span>
                             </div>
                             <p className="text-rose-400 font-mono text-xs uppercase tracking-tight">{errorMessage}</p>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Other Tabs Rendering... */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
           <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4"><ShieldPlus className="text-indigo-600" size={20}/><h4 className="font-black text-sm uppercase">توليد مسمى وظيفي</h4></div>
              <div className="space-y-5">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">كود الوظيفة الفريد (EN)</label><input type="text" placeholder="e.g. branch_cashier" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl font-bold text-xs outline-none" value={newRole.key} onChange={e=>setNewRole({...newRole, key: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الاسم المعروض (AR)</label><input type="text" placeholder="مثال: كاشير الفرع" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl font-bold text-xs outline-none" value={newRole.name} onChange={e=>setNewRole({...newRole, name: e.target.value})} /></div>
                 <button onClick={() => onAddRole(newRole.key, newRole.name)} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                    {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Plus size={18}/>} اعتماد المسمى الوظيفي
                 </button>
              </div>
           </div>
           <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center"><h4 className="font-black text-sm text-slate-800">سجل الهيكل الوظيفي</h4><span className="text-[10px] font-bold text-slate-400">الإجمالي: {roles.length}</span></div>
              <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-50">
                 {roles.map(role => (
                    <div key={role.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center font-black text-xs uppercase shadow-inner"><UserCog size={20}/></div>
                          <div><p className="text-xs font-black text-slate-800">{role.role_name}</p><p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">ID: {role.role_key}</p></div>
                       </div>
                       {!role.is_system && role.role_key !== 'admin' && (
                          <button onClick={() => onDeleteRole(role.role_key)} className="p-2.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ITControl;
