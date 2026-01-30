import { useState, useEffect, useCallback } from 'react';
import { PurchaseRecord, Supplier, SupplierPayment, User, PurchaseReturnRecord } from '../types';
import { supabase } from '../supabaseClient';

const cleanUUID = (id: any): string | null => {
  if (!id || typeof id !== 'string' || id.trim() === '') return null;
  const cleaned = id.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(cleaned) ? cleaned : null;
};

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
        supabase.from('purchase_records').select('*').eq('is_deleted', false).order('timestamp', { ascending: false }),
        supabase.from('supplier_payments').select('*').order('timestamp', { ascending: false }),
        supabase.from('purchase_returns').select('*').order('timestamp', { ascending: false })
      ]);

      if (supRes.data) setSuppliers(supRes.data.map(s => ({ 
        id: s.id, name: s.name, phone: s.phone, taxNumber: s.tax_number, 
        commercialRegister: s.commercial_register, 
        totalDebt: Number(s.total_debt || 0),
        totalPaid: Number(s.total_paid || 0), 
        totalSupplied: Number(s.total_supplied || 0),
        isDeleted: s.is_deleted
      })));
      
      if (purRes.data) setPurchases(purRes.data.map(p => ({ 
        id: p.id, supplierId: p.supplier_id, supplierName: p.supplier_name,
        supplierInvoiceNo: p.supplier_invoice_no, 
        items: Array.isArray(p.items) ? p.items : [],
        totalAmount: Number(p.total_amount || 0),
        paidAmount: Number(p.paid_amount || 0), 
        remainingAmount: Number(p.remaining_amount || 0),
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
        items: Array.isArray(r.items) ? r.items : [],
        totalRefund: Number(r.total_refund || 0), refundMethod: r.refund_method,
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

  const addPurchase = async (record: PurchaseRecord) => {
    const finalId = cleanUUID(record.id);
    const finalSupplierId = cleanUUID(record.supplierId);
    const finalBranchId = cleanUUID(record.branchId);
    const finalCreatedBy = cleanUUID(record.createdBy);

    if (!finalId) throw new Error("فشل توليد معرف فريد للفاتورة");
    if (!finalSupplierId) throw new Error("المورد المختار غير صالح");

    const dbItems = record.items.map(it => ({
        product_id: cleanUUID(it.productId),
        quantity: Number(it.quantity),
        cost_price: Number(it.costPrice),
        retail_price: Number(it.retailPrice),
        name: it.name
    }));

    const { error } = await supabase.rpc('process_purchase_transaction', {
      p_id: finalId,
      p_supplier_id: finalSupplierId,
      p_supplier_name: record.supplierName,
      p_items: dbItems,
      p_total: Number(record.totalAmount),
      p_paid: Number(record.paidAmount),
      p_remaining: Number(record.remainingAmount),
      p_status: record.paymentStatus,
      p_timestamp: Number(record.timestamp),
      p_created_by: finalCreatedBy,
      p_branch_id: finalBranchId,
      p_notes: record.notes || ''
    });

    if (error) throw new Error(error.message);
    await fetchData();
  };

  const deletePurchase = async (id: string, reason: string, user: User) => {
    const { error } = await supabase
      .from('purchase_records')
      .update({ is_deleted: true, notes: `ملغاة بواسطة ${user.username}: ${reason}` })
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const addSupplierPayment = async (sId: string, amt: number, pId: string | null, notes: string, user: User) => {
    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: sId,
      amount: Number(amt),
      purchase_id: pId,
      notes: notes,
      branch_id: user.branchId,
      created_by: user.id,
      timestamp: Date.now()
    }]);
    if (error) throw error;
    await fetchData();
  };

  const addPurchaseReturn = async (record: PurchaseReturnRecord, user: User) => {
    const dbItems = record.items.map(it => ({
      product_id: it.productId,
      quantity: Number(it.quantity),
      cost_price: Number(it.costPrice),
      name: it.name
    }));

    const { error } = await supabase.rpc('process_purchase_return', {
      p_id: record.id,
      p_purchase_id: record.originalPurchaseId,
      p_supplier_id: record.supplierId,
      p_items: dbItems,
      p_total_refund: Number(record.totalRefund),
      p_method: record.refundMethod,
      p_money_received: record.isMoneyReceived,
      p_created_by: user.id,
      p_branch_id: user.branchId,
      p_timestamp: record.timestamp,
      p_notes: record.notes
    });

    if (error) throw error;
    await fetchData();
  };

  const quickSettlePurchase = async (pId: string, sId: string, amt: number, user: User) => {
    await addSupplierPayment(sId, amt, pId, `تسوية فاتورة توريد #${pId.slice(-6)}`, user);
  };

  const addSupplier = async (name: string, phone?: string, tax?: string, comm?: string) => {
    const { data, error } = await supabase.from('suppliers').insert([{
      name: name.trim(), 
      phone: phone?.trim() || null, 
      tax_number: tax?.trim() || null, 
      commercial_register: comm?.trim() || null
    }]).select().single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const deleteSupplier = async (id: string, reason: string, user: User) => {
    await supabase.from('suppliers').update({ is_deleted: true }).eq('id', id);
    await fetchData();
  };

  return { 
    suppliers, purchases, payments, purchaseReturns, loading, 
    addSupplier, deleteSupplier, addPurchase, deletePurchase, addSupplierPayment, 
    addPurchaseReturn, quickSettlePurchase, refresh: fetchData 
  };
};