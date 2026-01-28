
import { useState, useEffect, useCallback } from 'react';
import { Shift, User } from '../types';
import { supabase } from '../supabaseClient';

export const useShiftData = (user: User | null) => {
  const [activeShift, setActiveShift] = useState(null as Shift | null);
  const [loading, setLoading] = useState(true);

  const checkActiveShift = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();
    
    if (data) {
      setActiveShift({
        id: data.id,
        userId: data.user_id,
        branchId: data.branch_id,
        startTimestamp: data.start_timestamp,
        openingBalance: Number(data.opening_balance),
        expectedClosingBalance: Number(data.expected_closing_balance),
        actualClosingBalance: Number(data.actual_closing_balance),
        difference: Number(data.difference),
        status: data.status,
      });
    } else {
      setActiveShift(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkActiveShift();
  }, [checkActiveShift]);

  const openShift = async (balance: number) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('shifts')
      .insert([{
        user_id: user.id,
        branch_id: user.branchId,
        opening_balance: balance,
        status: 'open',
        start_timestamp: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    await checkActiveShift();
    return data;
  };

  const closeShift = async (actualBalance: number, notes: string) => {
    if (!activeShift) return;
    
    // 1. حساب إجمالي المبيعات
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select('net_total')
      .eq('shift_id', activeShift.id)
      .eq('is_deleted', false);
    
    // 2. حساب إجمالي المرتجعات (بناءً على التوقيت لأنها قد لا ترتبط بـ shift_id مباشرة)
    const { data: returnsData } = await supabase
      .from('returns')
      .select('total_refund')
      .eq('branch_id', activeShift.branchId)
      .gte('timestamp', new Date(activeShift.startTimestamp).getTime());

    // 3. حساب المصاريف المسحوبة خلال الوردية
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')
      .eq('branch_id', activeShift.branchId)
      .gte('timestamp', new Date(activeShift.startTimestamp).getTime());
    
    const totalSales = (salesData || []).reduce((a, b) => a + Number(b.net_total), 0);
    const totalReturns = (returnsData || []).reduce((a, b) => a + Number(b.total_refund), 0);
    const totalExpenses = (expensesData || []).reduce((a, b) => a + Number(b.amount), 0);

    // المعادلة المالية الصحيحة: (افتتاحي + مبيعات) - (مرتجعات + مصاريف)
    const expected = (activeShift.openingBalance + totalSales) - (totalReturns + totalExpenses);
    const diff = actualBalance - expected;

    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        end_timestamp: new Date().toISOString(),
        expected_closing_balance: expected,
        actual_closing_balance: actualBalance,
        difference: diff,
        notes: notes
      })
      .eq('id', activeShift.id);
    
    if (error) throw error;
    setActiveShift(null);
  };

  return { activeShift, loading, openShift, closeShift, refresh: checkActiveShift };
};
