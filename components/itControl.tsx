import React, { useState, useEffect } from 'react';
import { 
  Terminal, ShieldAlert, Globe, Save, RefreshCw, Eye, EyeOff, Layout,
  Trash2, AlertTriangle, Database, Plus, Settings2, Activity,
  Lock, ShieldX, Key, Check, Zap, Coins, ImageIcon, Briefcase, 
  UserCog, User, Eraser, Info, Palette, Type, Smartphone, Loader2, ShieldPlus, ListChecks,
  PackageSearch, History, ShieldQuestion, RotateCcw, Sparkles, FileSpreadsheet, Percent, Tag
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
  const [formData, setFormData] = useState<SystemSettings>({...settings});
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'roles' | 'sovereignty' | 'offers'>('roles');
  const [restrictionType, setRestrictionType] = useState<'role' | 'user'>('role');
  const [targetId, setTargetId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [resetStatus, setResetStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState(0);

  const [newRole, setNewRole] = useState({ key: '', name: '' });
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);

  // Security Check: Restricted to Master Admin
  const isMasterAdmin = user.username === 'admin' || user.id === '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    setFormData({...settings});
  }, [settings]);

  const handleClearCache = () => {
    try {
      localStorage.removeItem('meeza_pos_cache');
      onShowToast("تم تطهير الكاش وذاكرة التخزين المؤقت بنجاح", "success");
    } catch (e) {
      onShowToast("فشل في تطهير الكاش", "error");
    }
  };

  const handleFullReset = async () => {
    if (!isMasterAdmin) return onShowToast("عفواً، لا يملك صلاحية هذا الإجراء إلا المستخدم الافتراضي", "error");
    if (resetConfirmation < 2) {
        setResetConfirmation(prev => prev + 1);
        return;
    }

    setResetStatus('processing');
    setErrorMessage('');
    
    const stages = [
      { p: 10, m: "بدء بروتوكول التصفير الشامل..." },
      { p: 25, m: "الاتصال بقاعدة البيانات السحابية..." },
      { p: 40, m: "تحرير قيود المفاتيح الأجنبية..." },
      { p: 60, m: "تدمير السجلات المالية والتوريدات..." },
      { p: 75, m: "تصفير المخزون وقوائم الموظفين..." },
      { p: 90, m: "إعادة بناء هيكل النظام الافتراضي..." },
      { p: 100, m: "اكتمل التطهير السيادي بنجاح." }
    ];

    try {
      for (const stage of stages) {
        setProgress(stage.p);
        setCurrentStage(stage.m);
        if (stage.p === 90) {
           const { error } = await supabase.rpc('reset_entire_system');
           if (error) throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      setResetStatus('success');
      localStorage.clear();
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setResetStatus('error');
      setErrorMessage(e.message || "فشل الاتصال بالسحابة لتنفيذ الأمر");
      setResetConfirmation(0);
    }
  };

  const handleApplyGlobalDiscount = async () => {
    if (globalDiscountValue <= 0 || globalDiscountValue >= 100) return onShowToast("النسبة يجب أن تكون بين 1 و 99", "error");
    setIsSaving(true);
    try {
      await applyGlobalDiscount(globalDiscountValue, user);
      onShowToast(`تم تطبيق خصم ${globalDiscountValue}% على كافة المنتجات بنجاح`, "success");
      setGlobalDiscountValue(0);
    } catch (e) {
      onShowToast("فشل تطبيق الخصم الشامل", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOffers = async () => {
    setIsSaving(true);
    try {
      await clearAllOffers(user);
      onShowToast("تم إلغاء كافة العروض النشطة بنجاح", "success");
    } catch (e) {
      onShowToast("فشل إلغاء العروض", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMatrix = (matrixKey: keyof SystemSettings, itemId: string) => {
    if (!targetId) return onShowToast("اختر الوظيفة للبرمجة أولاً", "error");
    const currentMatrix = { ...(formData[matrixKey] as Record<string, string[]>) || {} };
    const currentList = [...(currentMatrix[targetId] || [])];
    if (currentList.includes(itemId)) {
      currentMatrix[targetId] = currentList.filter(id => id !== itemId);
    } else {
      currentMatrix[targetId] = [...currentList, itemId];
    }
    setFormData({ ...formData, [matrixKey]: currentMatrix });
  };

  const handleSaveMatrix = async () => {
    if (isSaving) return;
    if (!targetId) return onShowToast("يرجى اختيار رتبة أو موظف قبل الحفظ", "error");
    setIsSaving(true);
    try {
      await onUpdateSettings(formData);
      onShowToast("تم تثبيت مصفوفة الصلاحيات السيادية بنجاح", "success");
    } catch (e) {
      onShowToast("فشل في حفظ المصفوفة", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const sectionOptions: { id: ViewType; label: string }[] = [
    { id: 'dashboard', label: 'الرئيسية' },
    { id: 'sales', label: 'نقطة البيع' },
    { id: 'inventory', label: 'المخزن' },
    { id: 'purchases', label: 'التوريدات' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'archive', label: 'الأرشيف' },
    { id: 'customers', label: 'العملاء' },
    { id: 'staff', label: 'الموظفين والفروع' },
    { id: 'expenses', label: 'المصاريف' },
    { id: 'treasury', label: 'الخزنة' },
    { id: 'reports', label: 'التقارير' },
    { id: 'itControl', label: 'لوحة IT' },
    { id: 'correspondence', label: 'المراسلات' },
    { id: 'recycleBin', label: 'المحذوفات' }
  ];

  const actionOptions: { id: ProceduralAction; label: string }[] = [
    { id: 'sell', label: 'إتمام المبيعات' },
    { id: 'delete_product', label: 'حذف أصناف المخزن' },
    { id: 'delete_invoice', label: 'إلغاء فواتير البيع' },
    { id: 'process_return', label: 'تنفيذ المرتجعات' },
    { id: 'manage_staff', label: 'إدارة شؤون الموظفين' },
    { id: 'staff_finance_adjust', label: 'صرف الرواتب والحوافز' },
    { id: 'manage_suppliers', label: 'إدارة الموردين' },
    { id: 'view_reports', label: 'عرض التقارير المالية' },
    { id: 'approve_leaves', label: 'الموافقة على الإجازات' },
    { id: 'edit_branch', label: 'تعديل بيانات الفروع' },
    { id: 'reset_passwords', label: 'تصفير كلمات المرور' },
    { id: 'export_staff_performance', label: 'تصدير أداء الموظفين' }
  ];

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <Terminal className="absolute -bottom-10 -left-10 text-white/5 size-48 rotate-12" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg border-2 border-indigo-500"><ShieldAlert size={32}/></div>
             <div>
                <h3 className="text-2xl font-black mb-1">وحدة التحكم السيادي</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">IT SOVEREIGN INFRASTRUCTURE</p>
             </div>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-md overflow-x-auto scrollbar-hide">
             <button onClick={() => setActiveTab('roles')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'roles' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>الوظائف</button>
             <button onClick={() => setActiveTab('offers')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'offers' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>العروض</button>
             <button onClick={() => setActiveTab('permissions')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'permissions' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>المصفوفة</button>
             <button onClick={() => setActiveTab('general')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'general' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>إعدادات</button>
             {isMasterAdmin && <button onClick={() => setActiveTab('sovereignty')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'sovereignty' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>التطهير</button>}
          </div>
        </div>
      </div>

      {activeTab === 'offers' && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b pb-4"><Percent className="text-rose-600" size={24}/><h4 className="font-black text-lg uppercase">العروض الشاملة (Global Offers)</h4></div>
              <p className="text-slate-500 text-xs font-bold leading-relaxed">يمكنك هنا تطبيق خصم مئوي موحد على كافة المنتجات في النظام لمرة واحدة، أو تصفير كافة الأسعار والعودة للبيع بالتجزئة الأساسي.</p>
              
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase">نسبة الخصم المطلوبة (%)</label>
                       <input 
                         type="number" 
                         placeholder="10" 
                         className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-lg outline-none focus:ring-4 focus:ring-rose-500/5" 
                         value={globalDiscountValue || ''} 
                         onChange={e=>setGlobalDiscountValue(Number(e.target.value))} 
                       />
                    </div>
                    <button 
                      onClick={handleApplyGlobalDiscount} 
                      disabled={isSaving || !globalDiscountValue}
                      className="mt-6 px-10 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all disabled:opacity-50"
                    >
                       تطبيق الخصم العام
                    </button>
                 </div>
                 
                 <div className="pt-6 border-t border-dashed">
                    <button 
                      onClick={handleClearOffers} 
                      disabled={isSaving}
                      className="w-full py-4 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                       <Eraser size={18}/> إيقاف كافة العروض والعودة للأسعار الرسمية
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
           <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4"><ShieldPlus className="text-indigo-600" size={20}/><h4 className="font-black text-sm uppercase">توليد مسمى وظيفي</h4></div>
              <div className="space-y-5">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">كود الوظيفة الفريد (EN)</label><input type="text" placeholder="e.g. branch_cashier" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl font-bold text-xs outline-none" value={newRole.key} onChange={e=>setNewRole({...newRole, key: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الاسم المعروض (AR)</label><input type="text" placeholder="مثال: كاشير الفرع" className="w-full px-5 py-3.5 bg-slate-50 border rounded-2xl font-bold text-xs outline-none" value={newRole.name} onChange={e=>setNewRole({...newRole, name: e.target.value})} /></div>
                 <button onClick={() => onAddRole(newRole.key, newRole.name)} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs shadow-xl flex items-center gap-2 hover:bg-black transition-all">
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

      {activeTab === 'permissions' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
                 <button onClick={() => {setRestrictionType('role'); setTargetId('');}} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'role' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>برمجة الرتب</button>
                 <button onClick={() => {setRestrictionType('user'); setTargetId('');}} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>برمجة الأفراد</button>
              </div>
              <div className="flex-1 w-full">
                 {restrictionType === 'role' ? (
                   <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={targetId} onChange={e=>setTargetId(e.target.value)}>
                      <option value="">اختر المسمى الوظيفي المستهدف...</option>
                      {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                   </select>
                 ) : (
                   <input type="text" placeholder="أدخل كود الموظف (Username)..." className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={targetId} onChange={e=>setTargetId(e.target.value)} />
                 )}
              </div>
              <button onClick={handleSaveMatrix} disabled={isSaving || !targetId} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 shrink-0 hover:bg-black transition-all disabled:opacity-50">
                {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} حفظ المصفوفة
              </button>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4 text-indigo-600"><Layout size={20}/><h4 className="font-black text-sm uppercase">حظر الأقسام (Sections)</h4></div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sectionOptions.map(opt => {
                       const matrixKey: keyof SystemSettings = restrictionType === 'role' ? 'roleHiddenSections' : 'userHiddenSections';
                       const isHidden = targetId && (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                       return (
                         <button key={opt.id} onClick={() => handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-[10px] font-black ${isHidden ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'}`}>
                            {opt.label} {isHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                         </button>
                       );
                    })}
                 </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4 text-rose-600"><ShieldX size={20}/><h4 className="font-black text-sm uppercase">حظر الإجراءات (Actions)</h4></div>
                 <div className="grid grid-cols-1 gap-3">
                    {actionOptions.map(opt => {
                       const matrixKey: keyof SystemSettings = restrictionType === 'role' ? 'roleHiddenActions' : 'userHiddenActions';
                       const isLocked = targetId && (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                       return (
                         <button key={opt.id} onClick={() => handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-[10px] font-black ${isLocked ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'}`}>
                            {opt.label} {isLocked ? <Lock size={16}/> : <Check size={16}/>}
                         </button>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'sovereignty' && isMasterAdmin && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-10">
           {resetStatus === 'processing' || resetStatus === 'success' ? (
              <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl space-y-10 text-center animate-in zoom-in-95">
                 <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                       <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentStage}</p>
                       <p className="text-2xl font-black text-slate-900">{progress}%</p>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-1">
                       <div 
                         className="h-full bg-gradient-to-l from-indigo-600 to-indigo-400 rounded-full transition-all duration-500 ease-out shadow-lg shadow-indigo-200" 
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
              <div className="bg-rose-50 border-2 border-rose-100 p-10 rounded-[3rem] text-center space-y-6 relative overflow-hidden">
                 <Zap className="absolute -top-10 -right-10 text-rose-200/20 size-48 rotate-12" />
                 <div className="w-24 h-24 bg-rose-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-rose-200 relative z-10">
                    {resetConfirmation === 0 ? <Database size={48}/> : resetConfirmation === 1 ? <ShieldQuestion size={48} className="animate-bounce"/> : <AlertTriangle size={48} className="animate-pulse"/>}
                 </div>
                 <div className="relative z-10">
                    <h3 className="text-2xl font-black text-rose-900 uppercase">التطهير السيادي (Factory Reset)</h3>
                    <p className="text-sm font-bold text-rose-600/60 uppercase tracking-widest mt-2">Nuclear Reset Protocol v2.0</p>
                 </div>
                 <p className="text-slate-500 text-xs font-bold leading-relaxed max-w-md mx-auto relative z-10">
                    {resetConfirmation === 0 ? "سيتم مسح كافة البيانات السحابية (مبيعات، مخزون، موظفين، فروع) بضربة واحدة دقيقة. تأهب للإجراء." : 
                     resetConfirmation === 1 ? "تحذير: هل أنت متأكد؟ هذا الإجراء سيقوم بتدمير قاعدة البيانات بالكامل ولا يمكن التراجع عنه." : 
                     "التأكيد النهائي والأخير. اضغط أدناه لتنفيذ بروتوكول التدمير الذاتي وتصفير البنية التحتية."}
                 </p>
                 <div className="pt-4 flex flex-col gap-4 relative z-10">
                    <button 
                     onClick={handleFullReset} 
                     className={`px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-tighter shadow-2xl transition-all active:scale-95 ${
                       resetConfirmation === 0 ? 'bg-slate-900 text-white' : 
                       resetConfirmation === 1 ? 'bg-orange-600 text-white shadow-orange-200' : 
                       'bg-rose-600 text-white animate-pulse shadow-rose-200'
                     }`}
                    >
                       {resetConfirmation === 0 ? "بدء إجراءات التصفير الشامل" : 
                        resetConfirmation === 1 ? "نعم، أنا متأكد تماماً" : 
                        "تأكيد نهائي: تدمير شامل"}
                    </button>
                    {resetConfirmation > 0 && (
                       <button onClick={() => setResetConfirmation(0)} className="mx-auto text-[10px] font-black text-slate-400 uppercase hover:text-indigo-600 underline decoration-indigo-200 decoration-2 underline-offset-4">إلغاء البروتوكول والعودة</button>
                    )}
                 </div>
                 {resetStatus === 'error' && (
                    <div className="p-5 bg-white border-2 border-rose-200 rounded-3xl text-rose-600 text-center animate-in slide-in-from-top-4 mt-6">
                       <div className="flex items-center justify-center gap-2 mb-1">
                          <ShieldAlert size={18}/>
                          <span className="font-black text-xs uppercase">فشل تنفيذ البروتوكول</span>
                       </div>
                       <p className="text-[10px] font-bold opacity-80">{errorMessage}</p>
                    </div>
                 )}
              </div>
           )}
        </div>
      )}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4 text-indigo-600"><Settings2 size={20}/><h4 className="font-black text-sm uppercase">هوية البنية التحتية</h4></div>
              <div className="space-y-4">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">اسم المنصة</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" value={formData.appName} onChange={e=>setFormData({...formData, appName: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">العملة السيادية</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" value={formData.currency} onChange={e=>setFormData({...formData, currency: e.target.value})} /></div>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4 text-indigo-600"><Sparkles size={20}/><h4 className="font-black text-sm uppercase">صيانة وذاكرة النظام</h4></div>
              <div className="space-y-4">
                 <button onClick={handleClearCache} className="w-full p-5 bg-slate-50 border-2 border-transparent hover:border-indigo-600 rounded-2xl flex items-center justify-between group transition-all">
                    <div className="flex items-center gap-3 text-slate-600 group-hover:text-indigo-600 transition-colors"><Eraser size={20}/> <span className="text-xs font-black uppercase">تطهير الكاش (Clear Local Cache)</span></div>
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><History size={14}/></div>
                 </button>
                 <div className="pt-4 border-t border-slate-100">
                    <button onClick={() => setFormData({...formData, globalSystemLock: !formData.globalSystemLock})} className={`w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${formData.globalSystemLock ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                       <div className="flex items-center gap-3"><Lock size={20}/> <span className="text-xs font-black uppercase">إغلاق النظام (Security Lock)</span></div>
                       <div className={`w-12 h-6 rounded-full relative transition-all ${formData.globalSystemLock ? 'bg-rose-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.globalSystemLock ? 'left-1' : 'right-1'}`}></div></div>
                    </button>
                 </div>
                 <button onClick={async () => {setIsSaving(true); await onUpdateSettings(formData); setIsSaving(false); onShowToast("تم حفظ التغييرات", "success");}} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-2xl flex items-center justify-center gap-2 hover:bg-black mt-2">
                    {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} اعتماد وتثبيت التعديلات
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ITControl;