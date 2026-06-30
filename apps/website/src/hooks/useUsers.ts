"use client";

import { useEffect, useState } from 'react';
import { Profile, supabase } from '../lib/supabase';

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      
      // Check if Supabase is configured
      if (!supabase) {
        throw new Error('Supabase não está configurado. Por favor, configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
      }
      
      console.log('🔍 Fetching all users from Supabase');

      // First, fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*');

      if (rolesError) {
        console.error('❌ Error fetching roles:', rolesError);
      }

      // Create a map of roles by id for easy lookup
      const rolesMap = new Map();
      if (rolesData) {
        rolesData.forEach(role => {
          rolesMap.set(role.id, role);
        });
      }

      console.log(`✅ Fetched ${rolesData?.length || 0} roles from database`);

      // Fetch all users
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });

      if (fetchError) {
        console.error('❌ Error fetching users:', fetchError);
        throw fetchError;
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} users from Supabase`);

      // Manually attach role information to each user
      const usersWithRoles = data?.map(user => ({
        ...user,
        roles: user.role_id ? rolesMap.get(user.role_id) : null
      })) || [];

      setUsers(usersWithRoles);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error fetching users:', err);
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function createUser(userData: Partial<Profile> & { password?: string }) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      const { password, ...profileData } = userData;
      
      console.log('📝 Creating new user:', profileData.full_name);

      // Insert into Supabase users table
      const { data, error: insertError } = await supabase
        .from('users')
        .insert([{
          ...profileData,
          is_active: profileData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ Error creating user:', insertError);
        throw insertError;
      }

      console.log('✅ User created successfully:', data.id);

      await fetchUsers();
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Error creating user:', err);
      return { success: false, error: err.message };
    }
  }

  async function updateUser(id: string, userData: Partial<Profile>) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      console.log('📝 Updating user:', id);

      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          ...userData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        throw updateError;
      }

      console.log('✅ User updated successfully:', id);

      await fetchUsers();
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Error updating user:', err);
      return { success: false, error: err.message };
    }
  }

  async function deleteUser(id: string) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      console.log('🗑️ Deleting user:', id);

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ Error deleting user:', deleteError);
        throw deleteError;
      }

      console.log('✅ User deleted successfully:', id);

      await fetchUsers();
      return { success: true };
    } catch (err: any) {
      console.error('❌ Error deleting user:', err);
      return { success: false, error: err.message };
    }
  }

  return { users, loading, error, refetch: fetchUsers, createUser, updateUser, deleteUser };
}
