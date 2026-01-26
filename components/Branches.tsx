
import React, { useState } from 'react';
import { 
  Edit3, Trash2, Power, Users, Activity, ShieldCheck, FileText, 
  ShoppingCart, TrendingUp, Package, DownloadCloud, Building2, X, 
  Save, RefreshCw, ShieldAlert 
} from 'lucide-react';
import { Branch, User, Invoice, Product } from '../types';

interface BranchCardProps {
  b: Branch;
  users: User[];
  invoices: Invoice[];
  products: Product[];
  isHQAdmin: boolean;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  onDeleteBranch: (id: string, reason: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  onViewUsers?: (branchId: string) => void;
}

export const BranchCard: React.FC<BranchCardProps> = ({ 
  b, users, invoices, products, isHQAdmin, 
  onUpdateBranch, onDeleteBranch, onShowToast, onViewUsers 
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Branch>>({});
  const [isDeleting, setIsDeleting] = useState<{id: string, reason: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const branchUsers = users.filter(u => u.branchId === b.id);
  const today = new Date().toLocaleDateString('ar-EG');
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const branchInvoices = invoices.filter(i => i.branchId === b.id && !i.isDeleted);
  const todaySales = branchInvoices.filter(i => i.date === today).reduce((a, acc) => a + acc.netTotal, 0);
  const monthSales = branchInvoices.filter(i => {
    const d = new Date(i.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((a, acc) => a + acc.netTotal, 0);
  
  const branchStockCount = products.filter(p => !p.isDeleted && p.branchId === b.id).length;

  const handleOpenEditModal = (branch: Branch) => {
    setEditForm({
      name: branch.name,
      location: branch.location,
      phone: branch.phone,
      taxNumber: branch.taxNumber,
      commercialRegister: branch.commercialRegister
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    setIsSaving(true);
    try {
      await onUpdateBranch(b.id, editForm);
      onShowToast("تم تحديث بيانات الفرع", "success");
      setIsEditModalOpen(false);
    } catch (e) {
      onShowToast("فشل التحديث", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = b.status === 'active' ? 'closed_temp' : 'active';
    try {
      await onUpdateBranch(b.id, { status: newStatus });
      onShowToast(`تم تغيير حالة الفرع إلى ${newStatus === 'active' ? 'نشط' : 'مغلق مؤقتاً'}`, "success");
    } catch (e) {
      onShowToast("فشل تغيير الحالة", "error");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!isDeleting) return;
    try {
      await onDeleteBranch(isDeleting.id, isDeleting.reason);
      onShowToast("تم حذف الفرع", "success");
      setIsDeleting(null);
    } catch (e) {
      onShowToast("فشل الحذف", "error");
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
       <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
               <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-black shadow-lg ${b.status === 'active' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  <Building2 size={28}/>
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-800">{b.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{b.status === 'active' ? 'نشط - يعمل' : 'مغلق مؤقتاً'}</span>
                     <span className="text-[10px] text-slate-400 font-bold">{b.location || 'الموقع غير محدد'}</span>
                  </div>
               </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
               {isHQAdmin && (
                 <>
                   <button onClick={() => handleOpenEditModal(b)} className="px-5 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"><Edit3 size={16}/> تعديل البيانات</button>
                   <button onClick={() => handleStatusToggle()} className={`px-5 py-3 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all ${b.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}>
                     <Power size={16}/> {b.status === 'active' ? 'إيقاف النشاط' : 'تنشيط الفرع'}
                   </button>
                   <button onClick={() => setIsDeleting({id: b.id, reason: ''})} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={16}/> حذف نهائي</button>
                 </>
               )}
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
            <div className="lg:col-span-2 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-indigo-600 transition-all" onClick={() => onViewUsers?.(b.id)}>
                     <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Users size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase group-hover:text-indigo-600">عرض الموظفين</p><h4 className="text-xl font-black text-slate-800">{branchUsers.length} موظف</h4></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><Activity size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase">الأداء المالي</p><h4 className="text-xl font-black text-slate-800">مستقر</h4></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase">الرقابة</p><h4 className="text-xl font-black text-rose-600">فعالة</h4></div>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-8 space-y-8">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h4 className="font-black text-sm flex items-center gap-2"><FileText size={18} className="text-indigo-600"/> التقارير التشغيلية والبيانات الحية</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تحديث تلقائي فوري</span>
                  </div>

                  {/* لوحات رؤية الأداء الحية */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="p-5 bg-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                        <ShoppingCart className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">مبيعات اليوم</p>
                        <h4 className="text-xl font-black">{todaySales.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h4>
                     </div>
                     <div className="p-5 bg-emerald-600 rounded-3xl text-white shadow-lg shadow-emerald-100 relative overflow-hidden group">
                        <TrendingUp className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">مبيعات الشهر</p>
                        <h4 className="text-xl font-black">{monthSales.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h4>
                     </div>
                     <div className="p-5 bg-slate-800 rounded-3xl text-white shadow-lg shadow-slate-200 relative overflow-hidden group">
                        <Package className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">أصناف المخزن</p>
                        <h4 className="text-xl font-black">{branchStockCount} <span className="text-[10px] opacity-40">صنف</span></h4>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                     <button onClick={()=>onShowToast("جاري تحضير التقرير اليومي...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير يومي (Excel)</p>
                     </button>
                     <button onClick={()=>onShowToast("جاري تحضير التقرير الشهري...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير شهري (Excel)</p>
                     </button>
                     <button onClick={()=>onShowToast("جاري تحضير التقرير السنوي...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير سنوي (Excel)</p>
                     </button>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl">
               <h4 className="font-black text-sm flex items-center gap-2 border-b border-white/10 pb-4"><Building2 className="text-indigo-400" size={18}/> بيانات التأسيس</h4>
               <div className="space-y-4 text-xs font-bold">
                  <div className="flex justify-between p-2 border-b border-white/5"><span>كود الفرع:</span><span className="text-indigo-400 font-mono">#{b.operationalNumber}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>الرقم الضريبي:</span><span>{b.taxNumber || '---'}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>السجل التجاري:</span><span>{b.commercialRegister || '---'}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>رقم الهاتف:</span><span>{b.phone || '---'}</span></div>
                  <div className="flex justify-between p-2"><span>تاريخ الافتتاح:</span><span>{new Date(b.createdAt).toLocaleDateString('ar-EG')}</span></div>
               </div>
            </div>
         </div>

         {/* Edit Modal */}
         {isEditModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
                 <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                    <h3 className="font-black text-sm">تعديل بيانات {b.name}</h3>
                    <button onClick={() => setIsEditModalOpen(false)}><X size={24}/></button>
                 </div>
                 <div className="p-8 space-y-4 text-right">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">اسم الفرع</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.name || ''} onChange={e=>setEditForm({...editForm, name: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الموقع الجغرافي</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.location || ''} onChange={e=>setEditForm({...editForm, location: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">رقم هاتف الفرع</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.phone || ''} onChange={e=>setEditForm({...editForm, phone: e.target.value})} /></div>
                       <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">السجل التجاري</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.commercialRegister || ''} onChange={e=>setEditForm({...editForm, commercialRegister: e.target.value})} /></div>
                    </div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.taxNumber || ''} onChange={e=>setEditForm({...editForm, taxNumber: e.target.value})} /></div>
                 </div>
                 <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                    <button onClick={() => handleEditSubmit()} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2">
                      {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} حفظ التعديلات
                    </button>
                 </div>
              </div>
           </div>
         )}

         {/* Delete Confirmation */}
         {isDeleting && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-sm shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in">
                 <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner"><ShieldAlert size={40}/></div>
                 <h3 className="text-xl font-black text-slate-800">حذف الفرع نهائياً؟</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase">هذا الإجراء سيقوم بتعطيل الوصول للفرع وأرشفة كافة سجلاته. لا يمكن التراجع.</p>
                 <textarea className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold focus:ring-2 focus:ring-rose-500/10 outline-none" placeholder="اكتب سبب الحذف (إلزامي)..." value={isDeleting.reason} onChange={e=>setIsDeleting({...isDeleting, reason:e.target.value})} />
                 <div className="flex gap-3">
                    <button onClick={()=>setIsDeleting(null)} className="flex-1 py-4 bg-slate-100 rounded-xl text-xs font-black text-slate-500">تراجع</button>
                    <button onClick={() => handleDeleteSubmit()} disabled={!isDeleting.reason} className="flex-[2] py-4 bg-rose-600 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-200 disabled:opacity-50">تأكيد الحذف السيادي</button>
                 </div>
              </div>
           </div>
         )}
    </div>
  );
};
