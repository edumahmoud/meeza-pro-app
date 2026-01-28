
import { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types';
import { supabase } from '../supabaseClient';

export const useCustomerData = () => {
  const [customers, setCustomers] = useState([] as Customer[]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (data) {
        setCustomers(data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          notes: c.notes,
          category: c.category,
          createdAt: new Date(c.created_at).getTime(),
          isDeleted: c.is_deleted
        })));
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt' | 'isDeleted'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert([{
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
        category: customer.category || 'potential'
      }])
      .select()
      .single();

    if (error) throw error;
    await fetchCustomers();
    return data;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_deleted: true })
      .eq('id', id);
    
    if (error) throw error;
    await fetchCustomers();
  };

  return { customers, loading, addCustomer, deleteCustomer, refresh: fetchCustomers };
};
