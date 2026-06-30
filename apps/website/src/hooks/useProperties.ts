"use client";

import { useEffect, useState } from 'react';
import { Property, supabase } from '../lib/supabase';

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties() {
    try {
      setLoading(true);
      
      // Check if Supabase is configured
      if (!supabase) {
        throw new Error('Supabase não está configurado. Por favor, configure as variáveis de ambiente.');
      }
      
      console.log('🔍 Fetching properties from Supabase (dev_properties table)');

      // Try to fetch property types (using singular 'property_type')
      const typesMap = new Map();
      try {
        const { data: typesData, error: typesError } = await supabase
          .from('property_type')
          .select('*');

        if (!typesError && typesData) {
          typesData.forEach(type => {
            typesMap.set(type.id, type);
          });
          console.log(`✅ Fetched ${typesData.length} property types from database`);
        }
      } catch (err) {
        console.warn('⚠️ property_type table not found - will use default values');
      }

      // Try to fetch property statuses
      const statusesMap = new Map();
      try {
        const { data: statusesData, error: statusesError } = await supabase
          .from('property_status')
          .select('*');

        if (!statusesError && statusesData) {
          statusesData.forEach(status => {
            statusesMap.set(status.id, status);
          });
          console.log(`✅ Fetched ${statusesData.length} property statuses from database`);
        }
      } catch (err) {
        console.warn('⚠️ property_status table not found - will use default values');
      }

      // Fetch properties with media nested via PostgREST embed.
      // Embedding avoids the top-level 1000-row cap that silently dropped
      // ~225 of the 1225 media rows when fetched as a flat list.
      const { data, error: fetchError } = await supabase
        .from('dev_properties')
        .select('*, dev_property_media(*)')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('❌ Error fetching properties:', fetchError);
        throw fetchError;
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} properties from Supabase`);

      // Fetch property specifications
      const specsMap = new Map();
      try {
        const { data: specsData, error: specsError } = await supabase
          .from('dev_property_specifications')
          .select('*');

        if (!specsError && specsData) {
          specsData.forEach(spec => {
            specsMap.set(spec.property_id, spec);
          });
          console.log(`✅ Fetched ${specsData.length} property specifications from database`);
        }
      } catch (err) {
        console.warn('⚠️ dev_property_specifications table not found - will use default values');
      }

      const sortMedia = (mediaArray: any[]) =>
        [...mediaArray].sort((a, b) => {
          if (a.order_index != null && b.order_index != null) {
            return a.order_index - b.order_index;
          }
          if (a.is_cover && !b.is_cover) return -1;
          if (!a.is_cover && b.is_cover) return 1;
          if (a.created_at && b.created_at) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return 0;
        });

      // Manually attach property type, status, specifications to each property.
      // Media now arrives nested under `dev_property_media`.
      const propertiesWithRelations = data?.map(property => {
        const propertyType = property.property_type_id && typesMap.has(property.property_type_id)
          ? typesMap.get(property.property_type_id)
          : property.property_type_id
            ? { id: property.property_type_id, name: 'Apartamento', description: null, created_at: null }
            : null;

        const propertyStatus = property.status_id && statusesMap.has(property.status_id)
          ? statusesMap.get(property.status_id)
          : property.status_id
            ? { id: property.status_id, name: 'ativa', description: null, color: '#10B981', display_order: 1, created_at: null }
            : null;

        const specifications = specsMap.get(property.id) || {};
        const media = sortMedia(property.dev_property_media || []);

        return {
          ...property,
          ...specifications,
          area: property.area || property.gross_area || specifications.gross_area,
          price: property.price || property.asking_price,
          property_types: propertyType,
          property_status: propertyStatus,
          media,
        };
      }) || [];

      // Filter out properties with no media
      const propertiesWithMedia = propertiesWithRelations.filter(property => {
        const hasMedia = property.media && property.media.length > 0;
        if (!hasMedia) {
          console.log(`⏭️ Skipping property without media: ${property.reference_code} - ${property.title}`);
        }
        return hasMedia;
      });

      console.log(`📊 Properties stats: ${propertiesWithRelations.length} total, ${propertiesWithMedia.length} with media`);

      if (propertiesWithMedia.length > 0) {
        console.log('📋 Sample property data:', {
          id: propertiesWithMedia[0].id,
          reference_code: propertiesWithMedia[0].reference_code,
          title: propertiesWithMedia[0].title,
          city: propertiesWithMedia[0].city,
          asking_price: propertiesWithMedia[0].asking_price,
          property_type: propertiesWithMedia[0].property_types?.name,
          status: propertiesWithMedia[0].property_status?.name,
          show_on_website: propertiesWithMedia[0].show_on_website,
          media_count: propertiesWithMedia[0].media?.length || 0,
          has_media: !!propertiesWithMedia[0].media && propertiesWithMedia[0].media.length > 0,
          first_media_url: propertiesWithMedia[0].media?.[0]?.url,
          is_cover: propertiesWithMedia[0].media?.[0]?.is_cover,
          main_image_url: propertiesWithMedia[0].main_image_url,
        });
      }

      setProperties(propertiesWithMedia);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error fetching properties:', err);
      setError(err.message);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProperty(propertyData: Partial<Property>) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      console.log('📝 Creating new property:', propertyData.title);

      // Insert into Supabase dev_properties table
      const { data, error: insertError } = await supabase
        .from('dev_properties')
        .insert([{
          ...propertyData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ Error creating property:', insertError);
        throw insertError;
      }

      console.log('✅ Property created successfully:', data.id);

      await fetchProperties();
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Error creating property:', err);
      return { success: false, error: err.message };
    }
  }

  async function updateProperty(id: string, propertyData: Partial<Property>) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      console.log('📝 Updating property:', id);

      const { data, error: updateError } = await supabase
        .from('dev_properties')
        .update({
          ...propertyData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('❌ Error updating property:', updateError);
        throw updateError;
      }

      console.log('✅ Property updated successfully:', id);

      await fetchProperties();
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Error updating property:', err);
      return { success: false, error: err.message };
    }
  }

  async function deleteProperty(id: string) {
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      console.log('🗑️ Deleting property:', id);

      const { error: deleteError } = await supabase
        .from('dev_properties')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ Error deleting property:', deleteError);
        throw deleteError;
      }

      console.log('✅ Property deleted successfully:', id);

      await fetchProperties();
      return { success: true };
    } catch (err: any) {
      console.error('❌ Error deleting property:', err);
      return { success: false, error: err.message };
    }
  }

  return { properties, loading, error, refetch: fetchProperties, createProperty, updateProperty, deleteProperty };
}