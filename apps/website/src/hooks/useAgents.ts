"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      setLoading(true);

      if (!supabase) {
        throw new Error('Supabase não está configurado. Por favor, configure as variáveis de ambiente.');
      }

      console.log('🔍 Fetching agents from dev_users + user_roles/roles + dev_consultant_profiles');

      const { data, error: fetchError } = await supabase
        .from('dev_users')
        .select(`
          id,
          commercial_name,
          professional_email,
          is_active,
          display_website,
          sub_role,
          user_roles!user_roles_user_id_fkey ( roles ( id, name ) ),
          dev_consultant_profiles (
            bio,
            profile_photo_url,
            profile_photo_nobg_url,
            phone_commercial,
            instagram_handle,
            linkedin_url,
            languages,
            specializations
          )
        `)
        .eq('is_active', true)
        .eq('display_website', true);

      if (fetchError) {
        console.error('❌ Error fetching agents:', fetchError);
        throw fetchError;
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} agents`);

      const mappedAgents = (data || []).map((row: any) => {
        const profile = Array.isArray(row.dev_consultant_profiles)
          ? row.dev_consultant_profiles[0] || {}
          : row.dev_consultant_profiles || {};

        const userRole = Array.isArray(row.user_roles) ? row.user_roles[0] : row.user_roles;
        const roleName = userRole?.roles?.name || null;

        const handle = profile.instagram_handle || '';
        const instagram = handle
          ? `https://www.instagram.com/${handle.replace('@', '')}`
          : '';

        const photo = profile.profile_photo_url || '';

        return {
          id: row.id,
          commercial_name: row.commercial_name,
          name: row.commercial_name || '',
          full_name: row.commercial_name || '',
          title: roleName || 'Consultor Imobiliário',
          role: roleName,
          sub_role: row.sub_role || '',
          email: row.professional_email || '',
          phone: profile.phone_commercial || '',
          instagram,
          image: photo,
          profile_photo_url: photo || null,
          profile_photo_nobg_url: profile.profile_photo_nobg_url || null,
          photo_url: null,
          bio: profile.bio || null,
          languages: profile.languages || null,
          specializations: profile.specializations || null,
          linkedin_url: profile.linkedin_url || null,
          is_active: row.is_active,
          display_website: row.display_website,
          rating: 4.8 + Math.random() * 0.2,
          properties: Math.floor(Math.random() * 30) + 10,
        };
      });

      const sortedAgents = mappedAgents.sort((a, b) => {
        const aName = (a.commercial_name || '').toLowerCase();
        const bName = (b.commercial_name || '').toLowerCase();

        const aIsFilipe = aName.includes('filipe') && aName.includes('pereira');
        const bIsFilipe = bName.includes('filipe') && bName.includes('pereira');
        const aIsIsabelle = aName.includes('isabelle') && aName.includes('antunes');
        const bIsIsabelle = bName.includes('isabelle') && bName.includes('antunes');

        if (aIsFilipe && !bIsFilipe) return -1;
        if (!aIsFilipe && bIsFilipe) return 1;
        if (aIsIsabelle && !bIsIsabelle) return -1;
        if (!aIsIsabelle && bIsIsabelle) return 1;

        return aName.localeCompare(bName);
      });

      setAgents(sortedAgents);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error fetching agents:', err);
      setError(err.message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  return { agents, loading, error, refetch: fetchAgents };
}
