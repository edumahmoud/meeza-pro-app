import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Eye, X, Package, Boxes, Trash2, 
  Building2, PackageX, Tag, AlertTriangle, RefreshCw, Printer, Percent, CheckCircle2, ChevronLeft, Save
} from 'lucide-react';
import { Product, User as UserType, Branch } from '../types';
import { copyToClipboard } from './Layout';

// @ts-ignore
declare var JsBarcode: any;

interface InventoryProps {
  products: Product[];
  branches?: Branch[];
  onUpdateProduct: (id: string, updates: Partial<Product>, user: UserType) => Promise<void>;
  onDeleteProduct: (id: string, reason: string, user: UserType) => Promise<void>;
  onShowToast: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  canDelete: boolean;
  onProductClick: (product: Product) => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Inventory = ({ products, branches = [], onUpdateProduct, onDeleteProduct, onShowToast, user, canDelete, askConfirmation }: InventoryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'stock', direction: 'asc' } as { key: keyof Product | 'totalValue', direction: 'asc' | 'desc' } | null);
  const [visibleCount, setVisibleCount] = useState(50); 
  
  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);
  const [branchFilter, setBranchFilter] = useState(isAdmin ? '' : (user.branchId || ''));

  const filteredProducts = useMemo(() => {
    let list = products.filter(p => !p.isDeleted);
    if (!isAdmin) {
      list = list.filter(p => p.branchId === user.branchId);
    } else if (branchFilter) {
      list = list.filter(p => p.branchId === branchFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(term) || 
        (p.code || '').includes(term)
      );
    }
    if (sortConfig) {
      list.sort((a: any, b: any) => {
        let valA: any = a[sortConfig.key as keyof Product];
        let valB: any = b[sortConfig.key as keyof Product];
        if (sortConfig.key === 'totalValue') {
             valA = (a.stock || 0) * (a.wholesalePrice || 0);
             valB = (b.stock || 0) * (b.wholesalePrice || 0);
        }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [products, searchTerm, branchFilter, isAdmin, user.branchId, sortConfig]);

  const displayList = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  const inventoryStats = useMemo(() => {
    return filteredProducts.reduce((acc, p) => {
      acc.totalCost += (p.stock * p.wholesalePrice);
      acc.totalPieces += p.stock;
      if (p.stock <= 0) acc.outOfStock++;
      else if (p.stock <= p.lowStockThreshold) acc.nearEmpty++;
      return acc;
    }, { totalCost: 0, totalPieces: 0, outOfStock: 0, nearEmpty: 0 });
  }, [filteredProducts]);

  const [selectedProduct, setSelectedProduct] = useState(null as Product | null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedProduct) {
      setTimeout(() => {
        const svg = document.getElementById('barcode-svg');
        if (svg && typeof JsBarcode !== 'undefined') {
          JsBarcode(svg, selectedProduct.code, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, font: "Cairo", margin: 10 });
        }
      }, 100);
    }
  }, [selectedProduct]);

  const handleSetOffer = async () => {
    if (!selectedProduct || isSaving) return;
    setIsSaving(true);
    try {
      const price = offerPrice === '' ? null : Number(offerPrice);
      await onUpdateProduct(selectedProduct.id, { offerPrice: price as any }, user);
      onShowToast(price ? "تم تفعيل عرض السعر بنجاح" : "تم إلغاء العرض والعودة للرسمي", "success");
      setSelectedProduct({...selectedProduct, offerPrice: price as any});
      setIsOfferModalOpen(false);
    } catch (e) { onShowToast("فشل تحديث العرض", "error"); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Package size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي الأصناف</p><h3 className="text-xl font-black">{filteredProducts.length} صنف</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Boxes size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي القطع</p><h3 className="text-xl font-black">{inventoryStats.totalPieces.toLocaleString()}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><PackageX size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">نافذ تماماً</p><h3 className="text-xl font-black">{inventoryStats.outOfStock}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><AlertTriangle size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">أرصدة حرجة</p><h3 className="text-xl font-black">{inventoryStats.nearEmpty}</h3></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="ابحث باسم الصنف أو الباركود..." className="w-full pr-14 pl-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100">
             <Building2 size={16} className="text-indigo-600"/>
             <select className="bg-transparent border-none outline-none font-black text-[11px] text-indigo-700 cursor-pointer" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="">كافة الفروع</option>
                {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[450px]">
         <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] font-bold">
               <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                  <tr><th className="px-8 py-5">الصنف</th><th className="px-8 py-5 text-center">الباركود</th><th className="px-8 py-5 text-center">الرصيد المتاح</th><th className="px-8 py-5 text-center">سعر البيع</th><th className="px-8 py-5 text-center">الفرع</th><th className="px-8 py-5 text-left">إدارة</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {displayList.map(p => (
                     <tr key={p.id} className="hover:bg-indigo-50/20 transition-all group">
                        <td className="px-8 py-4 flex items-center gap-4">
                           <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">{p.offerPrice ? <Percent size={18} className="text-rose-600" /> : <Package size={20}/>}</div>
                           <p className="text-slate-800 text-xs font-black">{p.name}</p>
                        </td>
                        <td className="px-8 py-4 text-center text-slate-400 font-mono tracking-widest cursor-pointer hover:text-indigo-600" onClick={() => copyToClipboard(p.code, onShowToast)}>#{p.code}</td>
                        <td className="px-8 py-4 text-center"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${p.stock <= p.lowStockThreshold ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{p.stock} وحدة</span></td>
                        <td className="px-8 py-4 text-center font-black text-indigo-600 text-xs">{p.offerPrice || p.retailPrice} ج.م</td>
                        <td className="px-8 py-4 text-center text-slate-400 text-[10px]">{branches.find(b=>b.id===p.branchId)?.name || 'غير محدد'}</td>
                        <td className="px-8 py-4 text-left">
                           <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setSelectedProduct(p)} className="p-2 bg-white border rounded-lg text-slate-400 hover:text-indigo-600 shadow-sm" title="عرض التفاصيل"><Eye size={16}/></button>
                              {canDelete && <button onClick={() => askConfirmation("حذف الصنف", `هل تود أرشفة الصنف ${p.name}؟`, () => onDeleteProduct(p.id, "طلب إداري", user))} className="p-2 bg-white border rounded-lg text-rose-400 hover:text-rose-600 shadow-sm"><Trash2 size={16}/></button>}
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[6000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm text-white">بيانات الصنف التفصيلية</h3>
                 <button onClick={() => setSelectedProduct(null)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto max-h-[85vh] scrollbar-hide text-right">
                 <div className="text-center space-y-1"><h2 className="text-2xl font-black text-slate-800">{selectedProduct.name}</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">كود الصنف: #{selectedProduct.code}</p></div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner relative overflow-hidden group">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الرصيد المتاح (الفرع الحالي)</p>
                       <p className="text-2xl font-black text-slate-800">{selectedProduct.stock}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">سعر البيع المعتمد</p>
                       <p className="text-2xl font-black text-indigo-600">{selectedProduct.offerPrice || selectedProduct.retailPrice} ج.م</p>
                    </div>
                 </div>
                 
                 <div className="text-center bg-white p-6 border-2 border-dashed border-slate-100 rounded-3xl space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معاينة الباركود للملصقات</p>
                    <svg id="barcode-svg" className="mx-auto"></svg>
                 </div>
                 
                 <button onClick={() => { setOfferPrice(selectedProduct.offerPrice?.toString() || ''); setIsOfferModalOpen(true); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                    <Tag size={16}/> {selectedProduct.offerPrice ? 'تعديل أو إلغاء عرض السعر' : 'إضافة عرض سعر مؤقت'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* واجهة إضافة العرض السعري */}
      {isOfferModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[7000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">العروض السعرية (تخفيضات)</h3>
                 <button onClick={() => setIsOfferModalOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-5 text-right">
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">سعر البيع الرسمي الحالي</p>
                    <p className="text-xl font-black text-slate-800">{selectedProduct.retailPrice} ج.م</p>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">سعر العرض الجديد (المخفّض)</label>
                    <div className="relative">
                       <Tag size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                       <input 
                        type="number" 
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 rounded-2xl font-black text-2xl outline-none transition-all" 
                        value={offerPrice} 
                        onChange={e => setOfferPrice(e.target.value)} 
                        placeholder="0.00"
                       />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-2">سيتم استخدام هذا السعر في نقطة البيع بدلاً من السعر الرسمي.</p>
                 </div>
                 <div className="flex gap-3 pt-4">
                    <button onClick={() => { setOfferPrice(''); handleSetOffer(); }} className="flex-1 py-4 bg-slate-100 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-50 transition-all">إلغاء العرض</button>
                    <button onClick={handleSetOffer} disabled={isSaving} className="flex-[2] py-4 bg-rose-600 text-white rounded-xl font-black text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-rose-700 transition-all">
                       {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} تثبيت العرض
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;