import { useState, useEffect, useCallback } from 'react';
import { ActivityLog } from '../types';
import { supabase } from '../supabaseClient';

export const useActivityLogs = () => {
  const [logs, setLogs] = useState([] as ActivityLog[]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // جلب البيانات من 6 جداول مختلفة لتغطية كافة العمليات المالية والحركات المخزنية
      const [invRes, expRes, retRes, payRes, purRes, supPayRes] = await Promise.all([
        supabase.from('sales_invoices').select('id, net_total, creator_username, timestamp').order('timestamp', { ascending: false }).limit(30),
        supabase.from('expenses').select('id, description, amount, timestamp, users:created_by(username)').order('timestamp', { ascending: false }).limit(15),
        supabase.from('returns').select('id, total_refund, timestamp, users:created_by(username)').order('timestamp', { ascending: false }).limit(10),
        supabase.from('staff_payments').select('id, payment_type, amount, payment_date, users:created_by(username)').order('payment_date', { ascending: false }).limit(15),
        supabase.from('purchase_records').select('id, supplier_name, total_amount, timestamp, users:created_by(username)').order('timestamp', { ascending: false }).limit(15),
        supabase.from('supplier_payments').select('*, suppliers(name), users:created_by(username)').order('timestamp', { ascending: false }).limit(15)
      ]);

      const combined: ActivityLog[] = [];

      // 1. المبيعات
      invRes.data?.forEach(i => {
        combined.push({
          id: i.id,
          type: 'sale',
          user: i.creator_username || 'admin',
          details: `فاتورة مبيعات (#${i.id.slice(-6)})`,
          amount: Number(i.net_total || 0),
          timestamp: i.timestamp,
          time: new Date(i.timestamp).toLocaleTimeString('ar-EG'),
          date: new Date(i.timestamp).toLocaleDateString('ar-EG')
        });
      });

      // 2. المصاريف
      expRes.data?.forEach((e: any) => {
        combined.push({
          id: e.id,
          type: 'expense',
          user: e.users?.username || 'admin',
          details: `مصروف: ${e.description} (#${e.id.slice(0,6)})`,
          amount: Number(e.amount || 0),
          timestamp: e.timestamp,
          time: new Date(e.timestamp).toLocaleTimeString('ar-EG'),
          date: new Date(e.timestamp).toLocaleDateString('ar-EG')
        });
      });

      // 3. المرتجعات
      retRes.data?.forEach((r: any) => {
        combined.push({
          id: r.id,
          type: 'return',
          user: r.users?.username || 'admin',
          details: `مرتجع مبيعات (#${r.id.slice(-6)})`,
          amount: Number(r.total_refund || 0),
          timestamp: r.timestamp,
          time: new Date(r.timestamp).toLocaleTimeString('ar-EG'),
          date: new Date(r.timestamp).toLocaleDateString('ar-EG')
        });
      });

      // 4. مدفوعات الموظفين
      payRes.data?.forEach((p: any) => {
        const ts = new Date(p.payment_date).getTime();
        combined.push({
          id: p.id.slice(0, 8),
          type: 'payment',
          user: p.users?.username || 'admin',
          details: `${p.payment_type} لموظف (#${p.id.slice(0,6)})`,
          amount: Number(p.amount || 0),
          timestamp: ts,
          time: new Date(ts).toLocaleTimeString('ar-EG'),
          date: new Date(ts).toLocaleDateString('ar-EG')
        });
      });

      // 5. التوريدات (الفواتير الجديدة)
      purRes.data?.forEach((pu: any) => {
        combined.push({
          id: pu.id,
          type: 'purchase',
          user: pu.users?.username || 'admin',
          details: `فاتورة توريد: ${pu.supplier_name} (#${pu.id.slice(-6)})`,
          amount: Number(pu.total_amount || 0),
          timestamp: pu.timestamp,
          time: new Date(pu.timestamp).toLocaleTimeString('ar-EG'),
          date: new Date(pu.timestamp).toLocaleDateString('ar-EG')
        });
      });

      // 6. مدفوعات الموردين (سداد المديونية) - الإضافة الجديدة المطلوبة
      supPayRes.data?.forEach((sp: any) => {
        combined.push({
          id: sp.id,
          type: 'supplier_payment',
          user: sp.users?.username || 'admin',
          details: `سداد للمورد: ${sp.suppliers?.name || 'مورد'} (#${sp.id.slice(0,6)})`,
          amount: Number(sp.amount || 0),
          timestamp: sp.timestamp,
          time: new Date(sp.timestamp).toLocaleTimeString('ar-EG'),
          date: new Date(sp.timestamp).toLocaleDateString('ar-EG')
        });
      });

      // ترتيب السجلات تنازلياً حسب الوقت
      setLogs(combined.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error("Logs Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, refresh: fetchLogs };
};