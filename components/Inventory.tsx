
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Eye, X, Package, Boxes, Edit3, Trash2, 
  Landmark, Layers, PackageX, Barcode as BarcodeIcon, Building2, Copy, AlignRight, LayoutList, LayoutGrid, Info, Tag, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Save, RefreshCw, Printer, Coins, Wallet, FileSpreadsheet, PlusCircle, Percent, CheckCircle2
} from 'lucide-react';
import { Product, User as UserType, Branch } from '../types';
import { copyToClipboard } from './Layout';
import * as XLSX from 'xlsx';

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

const Inventory: React.FC<InventoryProps> = ({ products, branches = [], onUpdateProduct, onDeleteProduct, onShowToast, user, canDelete, askConfirmation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | 'totalValue', direction: 'asc' | 'desc' } | null>({ key: 'stock', direction: 'asc' });
  const [visibleCount, setVisibleCount] = useState(50); 
  
  const isHQAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);
  const [branchFilter, setBranchFilter] = useState(isHQAdmin ? '' : (user.branchId || 'main_store'));

  const handleSort = (key: keyof Product | 'totalValue') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setVisibleCount(50);
  };

  const filteredProducts = useMemo(() => {
    let list = products.filter(p => !p.isDeleted);
    
    if (!isHQAdmin) {
      list = list.filter(p => p.branchId === user.branchId);
    } else if (branchFilter) {
      if (branchFilter === 'hq_unified_logic') {
         const aggregated: Record<string, Product> = {};
         list.forEach(p => {
            if (!aggregated[p.code]) {
               aggregated[p.code] = { ...p, branchId: undefined };
            } else {
               aggregated[p.code].stock += p.stock;
            }
         });
         list = Object.values(aggregated);
      } else {
         list = list.filter(p => p.branchId === branchFilter);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(term) || p.code.includes(term)
      );
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof Product];
        let valB: any = b[sortConfig.key as keyof Product];

        if (sortConfig.key === 'totalValue') {
             valA = a.stock * a.wholesalePrice;
             valB = b.stock * b.wholesalePrice;
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [products, searchTerm, branchFilter, isHQAdmin, user.branchId, sortConfig]);

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

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isDeleting, setIsDeleting] = useState<{id: string, reason: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New state for Offer management
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState<string>('');

  useEffect(() => {
    if (selectedProduct && !isEditMode) {
      setTimeout(() => {
        const svg = document.getElementById('barcode-svg');
        if (svg && typeof JsBarcode !== 'undefined') {
          JsBarcode(svg, selectedProduct.code, {
            format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, font: "Cairo", margin: 10
          });
        }
      }, 100);
    }
  }, [selectedProduct, isEditMode]);

  const handlePrintBarcode = () => {
    const svg = document.getElementById('barcode-svg');
    const printArea = document.getElementById('barcode-print-area');
    if (svg && printArea) {
        printArea.innerHTML = '';
        const clonedSvg = svg.cloneNode(true) as HTMLElement;
        clonedSvg.setAttribute('width', '100%');
        clonedSvg.setAttribute('height', '100%');
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.height = '100vh';
        container.style.padding = '20px';
        const label = document.createElement('h2');
        label.innerText = selectedProduct?.name || '';
        label.style.fontFamily = 'Cairo, sans-serif';
        label.style.marginBottom = '10px';
        const priceValue = selectedProduct?.offerPrice || selectedProduct?.retailPrice || 0;
        const priceText = document.createElement('p');
        priceText.innerText = `${priceValue} EGP`;
        priceText.style.fontFamily = 'Cairo, sans-serif';
        priceText.style.fontSize = '18px';
        priceText.style.fontWeight = 'bold';
        container.appendChild(label);
        container.appendChild(clonedSvg);
        container.appendChild(priceText);
        printArea.appendChild(container);
        window.print();
        setTimeout(() => { printArea.innerHTML = ''; }, 1000);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProduct || isSaving) return;
    setIsSaving(true);
    try {
      await onUpdateProduct(selectedProduct.id, editForm, user);
      onShowToast("تم تحديث بيانات الصنف بنجاح", "success");
      setIsEditMode(false);
      setSelectedProduct({...selectedProduct, ...editForm});
    } catch (e) {
      onShowToast("فشل تحديث البيانات", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetOffer = async () => {
    if (!selectedProduct || isSaving) return;
    setIsSaving(true);
    try {
      const price = offerPrice === '' ? null : Number(offerPrice);
      await onUpdateProduct(selectedProduct.id, { offerPrice: price as any }, user);
      onShowToast(price ? "تم تفعيل العرض بنجاح" : "تم إلغاء العرض بنجاح", "success");
      setSelectedProduct({...selectedProduct, offerPrice: price as any});
      setIsOfferModalOpen(false);
    } catch (e) {
      onShowToast("فشل تحديث العرض", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!isDeleting || isSaving) return;
    setIsSaving(true);
    try {
      await onDeleteProduct(isDeleting.id, isDeleting.reason, user);
      onShowToast("تمت أرشفة الصنف بنجاح", "success");
      setIsDeleting(null);
      setSelectedProduct(null);
    } catch (e) {
      onShowToast("فشل الحذف", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportInventory = () => {
    const data = filteredProducts.map(p => ({
      "كود الصنف": p.code,
      "اسم الصنف": p.name,
      "الوصف": p.description || '',
      "الرصيد المتاح": p.stock,
      "سعر التكلفة (WAC)": p.wholesalePrice,
      "سعر البيع الأصلي": p.retailPrice,
      "سعر العرض": p.offerPrice || 'لا يوجد',
      "إجمالي القيمة المخزنية": p.stock * p.wholesalePrice,
      "الفرع": branchFilter === 'hq_unified_logic' ? 'موحد' : (branches.find(b => b.id === p.branchId)?.name || 'المركز الرئيسي'),
      "حد الطلب": p.lowStockThreshold
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "المخزون");
    XLSX.writeFile(wb, `Inventory_Report_${new Date().toLocaleDateString('en-CA')}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      
      {/* لوحة الإحصائيات الذكية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Wallet size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي التكلفة</p>
          <h3 className="text-lg font-black text-slate-800">{inventoryStats.totalCost.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-800 transition-all group">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl w-fit mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors"><Layers size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">عدد الأصناف</p>
          <h3 className="text-lg font-black text-slate-800">{filteredProducts.length} <span className="text-[10px] opacity-40">صنف</span></h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-600 transition-all group">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Boxes size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي القطع</p>
          <h3 className="text-lg font-black text-slate-800">{inventoryStats.totalPieces.toLocaleString()} <span className="text-[10px] opacity-40">قطعة</span></h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-rose-600 transition-all group">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors"><PackageX size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">أصناف نفذت</p>
          <h3 className="text-lg font-black text-rose-600">{inventoryStats.outOfStock} <span className="text-[10px] opacity-40">صنف</span></h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-amber-600 transition-all group">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors"><AlertTriangle size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">أوشك على النفاذ</p>
          <h3 className="text-lg font-black text-amber-600">{inventoryStats.nearEmpty} <span className="text-[10px] opacity-40">صنف</span></h3>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="ابحث بالاسم أو الكود في المخزن..." 
            className="w-full pr-14 pl-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm shadow-inner" 
            value={searchTerm} 
            onChange={e => { setSearchTerm(e.target.value); setVisibleCount(50); }} 
          />
        </div>
        
        {isHQAdmin && (
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-indigo-50 px-5 py-3 rounded-xl border border-indigo-100 shadow-inner">
                <Building2 size={16} className="text-indigo-600"/>
                <select 
                  className="bg-transparent border-none outline-none font-black text-[11px] text-indigo-700 cursor-pointer" 
                  value={branchFilter} 
                  onChange={e => { setBranchFilter(e.target.value); setVisibleCount(50); }}
                >
                  <option value="">كل المخازن (قائمة مفصلة)</option>
                  <option value="hq_unified_logic">المخزن الموحد (إجمالي الكميات)</option>
                  {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
             </div>
          </div>
        )}
        <button onClick={handleExportInventory} className="px-6 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-700 flex items-center gap-2 transition-all shrink-0">
           <FileSpreadsheet size={18}/> تنزيل الجرد (Excel)
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
         <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <LayoutList size={20} className="text-indigo-600"/> سجل الأصناف - {filteredProducts.length} صنف
            </h4>
         </div>
         <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-[11px] font-bold">
               <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                  <tr>
                     <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('name')}>الصنف <ArrowUpDown size={10} className="inline"/></th>
                     <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('code')}>الباركود <ArrowUpDown size={10} className="inline"/></th>
                     <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('stock')}>الرصيد المتاح <ArrowUpDown size={10} className="inline"/></th>
                     <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('retailPrice')}>سعر البيع <ArrowUpDown size={10} className="inline"/></th>
                     <th className="px-8 py-5 text-center">التبعية</th>
                     <th className="px-8 py-5 text-left">إدارة</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {displayList.map(p => (
                     <tr key={p.id} className="hover:bg-indigo-50/20 transition-all group">
                        <td className="px-8 py-4 flex items-center gap-4">
                           <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                              {p.offerPrice ? <Percent size={18} className="text-rose-600 animate-pulse" /> : <Package size={20}/>}
                           </div>
                           <div>
                              <p className="text-slate-800 text-xs font-black">{p.name}</p>
                              {p.offerPrice && <span className="text-[8px] px-2 py-0.5 bg-rose-100 text-rose-600 rounded font-black uppercase tracking-tighter animate-pulse">SALE ACTIVE</span>}
                           </div>
                        </td>
                        <td className="px-8 py-4 text-center text-slate-400 font-mono cursor-pointer hover:text-indigo-600" onClick={() => copyToClipboard(p.code, onShowToast)}>#{p.code}</td>
                        <td className="px-8 py-4 text-center">
                           <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${p.stock <= p.lowStockThreshold ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {p.stock} وحدة
                           </span>
                        </td>
                        <td className="px-8 py-4 text-center">
                           {p.offerPrice ? (
                              <div className="flex flex-col">
                                 <span className="text-rose-600 font-black text-xs">{p.offerPrice.toLocaleString()}</span>
                                 <span className="text-[8px] text-slate-400 line-through">{p.retailPrice.toLocaleString()}</span>
                              </div>
                           ) : (
                              <span className="text-indigo-600 font-black text-xs">{p.retailPrice.toLocaleString()}</span>
                           )}
                        </td>
                        <td className="px-8 py-4 text-center text-slate-400 text-[10px]">
                           {branchFilter === 'hq_unified_logic' ? 'إجمالي فروع الشركة' : (p.branchId ? (branches.find(b=>b.id===p.branchId)?.name) : 'المركز الرئيسي')}
                        </td>
                        <td className="px-8 py-4 text-left">
                           <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => { setOfferPrice(p.offerPrice?.toString() || ''); setSelectedProduct(p); setIsOfferModalOpen(true); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><Tag size={14}/></button>
                              <button onClick={() => setSelectedProduct(p)} className="p-2 bg-white border rounded-lg text-slate-400 hover:text-indigo-600"><Eye size={14}/></button>
                              {canDelete && branchFilter !== 'hq_unified_logic' && <button onClick={() => setIsDeleting({id: p.id, reason: ''})} className="p-2 bg-white border rounded-lg text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button>}
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         {visibleCount < filteredProducts.length && (
            <div className="p-6 bg-slate-50 flex justify-center border-t">
               <button 
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="px-10 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
               >
                  <PlusCircle size={18}/> عرض 50 صنفاً إضافياً
               </button>
            </div>
         )}

         {filteredProducts.length === 0 && (
           <div className="py-20 text-center text-slate-300 italic">المخزن لا يحتوي على أصناف تطابق البحث في هذا النطاق</div>
         )}
      </div>

      {/* Offer Management Modal */}
      {isOfferModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-2"><Tag size={18}/> إدارة العرض للصنف</h3>
                 <button onClick={() => setIsOfferModalOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-10 space-y-6">
                 <div className="text-center space-y-1">
                    <h4 className="text-lg font-black text-slate-800">{selectedProduct.name}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase">السعر الأصلي: {selectedProduct.retailPrice} ج.م</p>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">سعر العرض الجديد (اتركه فارغاً للإلغاء)</label>
                    <input 
                      type="number" 
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-2xl text-center outline-none focus:ring-4 focus:ring-rose-500/5 transition-all text-rose-600" 
                      value={offerPrice} 
                      onChange={e=>setOfferPrice(e.target.value)} 
                      placeholder="0.00" 
                    />
                 </div>
                 <div className="pt-4 flex flex-col gap-3">
                    <button 
                      onClick={handleSetOffer} 
                      disabled={isSaving} 
                      className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                    >
                      {/* Fix: Added missing CheckCircle2 import */}
                      {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} اعتماد سعر العرض
                    </button>
                    <button 
                      onClick={() => { setOfferPrice(''); handleSetOffer(); }} 
                      disabled={isSaving || !selectedProduct.offerPrice} 
                      className="w-full py-3 text-slate-400 font-black text-xs hover:text-rose-600 transition-all uppercase"
                    >
                      إلغاء العرض الحالي والعودة للسعر الأصلي
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {selectedProduct && !isOfferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">بطاقة تعريف الصنف</h3>
                 <button onClick={() => setSelectedProduct(null)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-slate-800">{selectedProduct.name}</h2>
                    <p className="text-xs text-slate-400 font-bold">#{selectedProduct.code}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner"><p className="text-[9px] font-black text-slate-400 uppercase">الرصيد الكلي</p><p className="text-xl font-black">{selectedProduct.stock}</p></div>
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner">
                       <p className="text-[9px] font-black text-slate-400 uppercase">سعر البيع</p>
                       <p className="text-xl font-black text-indigo-600">{selectedProduct.offerPrice || selectedProduct.retailPrice} ج.م</p>
                    </div>
                 </div>
                 <div className="text-center bg-white p-6 border rounded-3xl shadow-lg border-dashed relative group">
                    <svg id="barcode-svg" className="mx-auto"></svg>
                 </div>
                 <button onClick={handlePrintBarcode} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                    <Printer size={18}/> طباعة ملصق الباركود
                 </button>
              </div>
           </div>
        </div>
      )}

      {isDeleting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 text-center space-y-6 animate-in">
              <AlertTriangle size={48} className="text-rose-600 mx-auto animate-pulse" />
              <h3 className="text-xl font-black text-slate-800">أرشفة المنتج؟</h3>
              <textarea className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none resize-none h-24" placeholder="سبب الأرشفة..." value={isDeleting.reason} onChange={e=>setIsDeleting({...isDeleting, reason:e.target.value})} />
              <div className="flex gap-3">
                 <button onClick={()=>setIsDeleting(null)} className="flex-1 py-4 bg-slate-50 rounded-xl text-xs font-black text-slate-500">تراجع</button>
                 <button onClick={handleDeleteSubmit} disabled={!isDeleting.reason || isSaving} className="flex-[1.5] py-4 bg-rose-600 text-white rounded-xl text-xs font-black shadow-xl disabled:opacity-50">
                   {isSaving ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'تأكيد الأرشفة'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
