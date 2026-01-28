
import { useState, useEffect, useCallback } from 'react';
import { PurchaseRecord, Supplier, SupplierPayment, User, PurchaseReturnRecord } from '../types';
import { supabase } from '../supabaseClient';

const isUUID = (id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const usePurchaseData = () => {
  const [suppliers, setSuppliers] = useState([] as Supplier[]);
  const [purchases, setPurchases] = useState([] as PurchaseRecord[]);
  const [payments, setPayments] = useState([] as SupplierPayment[]);
  const [purchaseReturns, setPurchaseReturns] = useState([] as PurchaseReturnRecord[]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, purRes, payRes, retRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('is_deleted', false).order('name'),
        supabase.from('purchase_records').select('*').order('timestamp', { ascending: false }),
        supabase.from('supplier_payments').select('*').order('timestamp', { ascending: false }),
        supabase.from('purchase_returns').select('*').order('timestamp', { ascending: false })
      ]);

      if (supRes.data) setSuppliers(supRes.data.map(s => ({ 
        id: s.id, name: s.name, phone: s.phone, taxNumber: s.tax_number, 
        commercialRegister: s.commercial_register, totalDebt: Number(s.total_debt || 0),
        totalPaid: Number(s.total_paid || 0), totalSupplied: Number(s.total_supplied || 0),
        isDeleted: s.is_deleted
      })));
      
      if (purRes.data) setPurchases(purRes.data.map(p => ({ 
        id: p.id, supplierId: p.supplier_id, supplierName: p.supplier_name,
        supplierInvoiceNo: p.supplier_invoice_no, 
        items: Array.isArray(p.items) ? p.items.map((it: any) => ({
          productId: it.productId || it.product_id,
          name: it.name,
          quantity: Number(it.quantity || 0),
          costPrice: Number(it.costPrice || it.cost_price || 0),
          retailPrice: Number(it.retailPrice || it.retail_price || 0),
          subtotal: Number(it.subtotal || 0)
        })) : [],
        totalAmount: Number(p.total_amount),
        paidAmount: Number(p.paid_amount), remainingAmount: Number(p.remaining_amount),
        paymentStatus: p.payment_status, timestamp: p.timestamp, date: p.date, time: p.time,
        createdBy: p.created_by, branchId: p.branch_id, isDeleted: p.is_deleted, notes: p.notes
      })));

      if (payRes.data) setPayments(payRes.data.map(p => ({ 
        id: p.id, supplierId: p.supplier_id, purchaseId: p.purchase_id,
        amount: Number(p.amount), notes: p.notes, timestamp: p.timestamp, 
        date: p.date || new Date(p.timestamp).toLocaleDateString('ar-EG'), 
        time: p.time || new Date(p.timestamp).toLocaleTimeString('ar-EG'),
        branchId: p.branch_id, createdBy: p.created_by
      })));

      if (retRes.data) setPurchaseReturns(retRes.data.map(r => ({
        id: r.id, originalPurchaseId: r.original_purchase_id, supplierId: r.supplier_id,
        items: Array.isArray(r.items) ? r.items.map((it: any) => ({
          productId: it.productId || it.product_id,
          name: it.name,
          quantity: Number(it.quantity || 0),
          costPrice: Number(it.costPrice || 0),
          retailPrice: Number(it.retailPrice || 0),
          subtotal: Number(it.subtotal || 0),
          refundAmount: Number(it.subtotal || 0)
        })) : [],
        totalRefund: Number(r.total_refund), refundMethod: r.refund_method,
        isMoneyReceived: r.is_money_received, date: r.date, time: r.time, timestamp: r.timestamp,
        createdBy: r.created_by, branchId: r.branch_id, notes: r.notes
      })));

    } catch (err) {
      console.error("Error fetching purchase data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addSupplier = async (name: string, phone?: string, tax?: string, comm?: string) => {
    const { data, error } = await supabase.from('suppliers').insert([{
      name, phone, tax_number: tax, commercial_register: comm,
      total_debt: 0, total_paid: 0, total_supplied: 0
    }]).select().single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const addPurchase = async (record: PurchaseRecord) => {
    const dbItems = record.items.map(it => ({
      product_id: it.productId,
      name: it.name,
      quantity: Number(it.quantity || 0),
      cost_price: Number(it.costPrice || 0),
      retail_price: Number(it.retailPrice || 0),
      subtotal: Number(it.subtotal || 0)
    }));

    const safeCreatedBy = isUUID(record.createdBy) ? record.createdBy : null;
    const safeBranchId = isUUID(record.branchId) ? record.branchId : null;
    const safeSupplierId = isUUID(record.supplierId) ? record.supplierId : null;

    if (!safeSupplierId) throw new Error("معرف المورد غير صالح أو مفقود");
    if (!safeCreatedBy) throw new Error("فشل التحقق من هوية المسؤول عن العملية");

    const { error } = await supabase.rpc('process_purchase_transaction', {
      p_id: record.id,
      p_supplier_id: safeSupplierId,
      p_supplier_name: String(record.supplierName),
      p_supplier_invoice_no: record.supplierInvoiceNo ? String(record.supplierInvoiceNo) : null,
      p_items: dbItems,
      p_total: Number(record.totalAmount || 0),
      p_paid: Number(record.paidAmount || 0),
      p_remaining: Number(record.remainingAmount || 0),
      p_status: String(record.paymentStatus),
      p_timestamp: Number(record.timestamp || Date.now()),
      p_created_by: safeCreatedBy, 
      p_branch_id: safeBranchId,
      p_notes: record.notes ? String(record.notes) : null
    });

    if (error) throw error;
    await fetchData();
  };

  const addSupplierPayment = async (sId: string, amt: number, pId: string | null, notes: string, user: User) => {
    const safeSupplierId = isUUID(sId) ? sId : null;
    const safePurchaseId = (pId && isUUID(pId)) ? pId : null;
    const safeBranchId = isUUID(user.branchId) ? user.branchId : null;
    const safeUserId = isUUID(user.id) ? user.id : null;

    if (!safeSupplierId) throw new Error("معرف المورد غير صالح");
    
    const { error } = await supabase.rpc('process_supplier_payment_v2', {
      p_supplier_id: safeSupplierId,
      p_amount: Number(amt),
      p_purchase_id: safePurchaseId,
      p_notes: notes || null,
      p_branch_id: safeBranchId,
      p_created_by: safeUserId
    });
    
    if (error) throw error;
    await fetchData();
  };

  const quickSettlePurchase = async (pId: string, supplierId: string, amount: number, user: User) => {
    await addSupplierPayment(supplierId, amount, pId, "تسوية سريعة للفاتورة", user);
  };

  const addPurchaseReturn = async (record: PurchaseReturnRecord, user: User) => {
    const dbItems = record.items.map(it => ({
        product_id: it.productId,
        name: it.name,
        quantity: Number(it.quantity || 0),
        cost_price: Number(it.costPrice || 0),
        retail_price: Number(it.retailPrice || 0),
        subtotal: Number(it.subtotal || 0),
        refundAmount: Number(it.subtotal || 0)
    }));

    const safeId = isUUID(record.id) ? record.id : crypto.randomUUID();
    const safePurchaseId = isUUID(record.originalPurchaseId) ? record.originalPurchaseId : null;
    const safeSupplierId = isUUID(record.supplierId) ? record.supplierId : null;
    const safeUserId = isUUID(user.id) ? user.id : null;
    const safeBranchId = isUUID(user.branchId) ? user.branchId : null;

    const { error } = await supabase.rpc('process_purchase_return_v2', {
      p_id: safeId,
      p_original_purchase_id: safePurchaseId,
      p_supplier_id: safeSupplierId,
      p_items: dbItems,
      p_total_refund: Number(record.totalRefund),
      p_refund_method: record.refundMethod,
      p_is_money_received: record.isMoneyReceived,
      p_created_by: safeUserId,
      p_branch_id: safeBranchId,
      p_notes: record.notes || null
    });

    if (error) throw error;
    await fetchData();
  };

  const deleteSupplier = async (id: string, reason: string, user: User) => {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier && supplier.totalDebt !== 0) {
       throw new Error(`لا يمكن حذف المورد لوجود مديونية معلقة (${supplier.totalDebt}). يرجى تصفية الحساب أولاً.`);
    }
    await supabase.from('suppliers').update({ is_deleted: true }).eq('id', id);
    await fetchData();
  };

  return { 
    suppliers, purchases, payments, purchaseReturns, loading, 
    addSupplier, deleteSupplier, addPurchase, addSupplierPayment, addPurchaseReturn, quickSettlePurchase,
    refresh: fetchData 
  };
};
