"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Home, MapPin, DollarSign, Bed, Bath, Square, 
  Calendar, Zap, User, Upload, CheckCircle, AlertCircle 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type PropertyFormData = {
  // Tipo de Negócio e Propriedade
  business_type: string;
  property_type: string;
  typology: string;
  
  // Localização
  locality: string;
  city: string;
  zone: string;
  parish: string;
  
  // Características
  bedrooms: number;
  bathrooms_count: number;
  gross_area: number;
  construction_year: string;
  energy_certificate: string;
  
  // Preço
  listing_price: number;
  
  // Detalhes
  description: string;
  equipment: string;
  
  // Consultor
  consultant_id: string;
  consultant_name: string;
  
  // Imagem
  main_image_url: string;
};

export function AddPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [consultants, setConsultants] = useState<any[]>([]);

  const [formData, setFormData] = useState<PropertyFormData>({
    business_type: 'Venda',
    property_type: 'Apartamento',
    typology: 'T2',
    locality: '',
    city: 'Lisboa',
    zone: '',
    parish: '',
    bedrooms: 2,
    bathrooms_count: 2,
    gross_area: 100,
    construction_year: new Date().getFullYear().toString(),
    energy_certificate: 'B',
    listing_price: 250000,
    description: '',
    equipment: '',
    consultant_id: '',
    consultant_name: '',
    main_image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  });

  // Fetch consultants from database
  useEffect(() => {
    async function fetchConsultants() {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('dev_users')
          .select('id, commercial_name, user_roles!user_roles_user_id_fkey!inner(roles!inner(name))')
          .in('user_roles.roles.name', ['Consultor', 'Team Leader', 'Broker/CEO'])
          .eq('is_active', true)
          .order('commercial_name');

        if (error) {
          console.error('Error fetching consultants:', error);
        } else {
          console.log('Consultants fetched:', data);
          setConsultants(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      }
    }

    fetchConsultants();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleConsultantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const consultantId = e.target.value;
    const selectedConsultant = consultants.find(c => c.id === consultantId);
    
    setFormData(prev => ({
      ...prev,
      consultant_id: consultantId,
      consultant_name: selectedConsultant?.commercial_name || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      // Prepare data for insertion
      const propertyData = {
        business_type: formData.business_type,
        property_type: formData.property_type,
        typology: formData.typology,
        locality: formData.locality,
        city: formData.city,
        zone: formData.zone,
        parish: formData.parish,
        bedrooms: formData.bedrooms,
        bathrooms_count: formData.bathrooms_count,
        gross_area: formData.gross_area,
        construction_year: parseInt(formData.construction_year),
        energy_certificate: formData.energy_certificate,
        listing_price: formData.listing_price,
        asking_price: formData.listing_price, // Same as listing_price
        description: formData.description,
        equipment: formData.equipment,
        consultant_id: formData.consultant_id || null,
        consultant_name: formData.consultant_name || null,
        main_image_url: formData.main_image_url,
        status: 'active',
      };

      console.log('Inserting property:', propertyData);

      const { data, error: insertError } = await supabase
        .from('dev_properties')
        .insert([propertyData])
        .select();

      if (insertError) {
        console.error('Error inserting property:', insertError);
        throw new Error(insertError.message);
      }

      console.log('Property inserted successfully:', data);
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/property');
      }, 2000);

    } catch (err: any) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Erro ao criar propriedade. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/property')}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Voltar às Propriedades</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Adicionar Novo Imóvel</h1>
          <p className="text-gray-600">Preencha os dados do imóvel para adicionar ao sistema</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <h3 className="font-medium text-green-900">Imóvel criado com sucesso!</h3>
              <p className="text-sm text-green-700">Redirecionando para a listagem...</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="text-red-500" size={24} />
            <div>
              <h3 className="font-medium text-red-900">Erro ao criar imóvel</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Tipo de Negócio e Propriedade */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <Home className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Tipo de Negócio e Propriedade</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Negócio
                </label>
                <select
                  name="business_type"
                  value={formData.business_type}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                >
                  <option value="Venda">Venda</option>
                  <option value="Arrendamento">Arrendamento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Propriedade
                </label>
                <select
                  name="property_type"
                  value={formData.property_type}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                >
                  <option value="Apartamento">Apartamento</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Terreno">Terreno</option>
                  <option value="Escritório">Escritório</option>
                  <option value="Loja">Loja</option>
                  <option value="Armazém">Armazém</option>
                  <option value="Garagem">Garagem</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipologia
                </label>
                <select
                  name="typology"
                  value={formData.typology}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                >
                  <option value="T0">T0</option>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                  <option value="T4">T4</option>
                  <option value="T5">T5</option>
                  <option value="T5+">T5+</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Localização */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <MapPin className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Localização</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Lisboa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Localidade
                </label>
                <input
                  type="text"
                  name="locality"
                  value={formData.locality}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Benfica"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zona
                </label>
                <input
                  type="text"
                  name="zone"
                  value={formData.zone}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Freguesia
                </label>
                <input
                  type="text"
                  name="parish"
                  value={formData.parish}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="São Domingos de Benfica"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Características */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <Bed className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Características</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quartos
                </label>
                <input
                  type="number"
                  name="bedrooms"
                  value={formData.bedrooms}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Casas de Banho
                </label>
                <input
                  type="number"
                  name="bathrooms_count"
                  value={formData.bathrooms_count}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área Bruta (m²)
                </label>
                <input
                  type="number"
                  name="gross_area"
                  value={formData.gross_area}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ano
                </label>
                <input
                  type="text"
                  name="construction_year"
                  value={formData.construction_year}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="2020"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Preço e Certificado */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <DollarSign className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Preço e Certificação</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preço {formData.business_type === 'Arrendamento' ? '(€/mês)' : '(€)'}
                </label>
                <input
                  type="number"
                  name="listing_price"
                  value={formData.listing_price}
                  onChange={handleNumberChange}
                  min="0"
                  step="1000"
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certificado Energético
                </label>
                <select
                  name="energy_certificate"
                  value={formData.energy_certificate}
                  onChange={handleInputChange}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="B-">B-</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="F">F</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Consultor */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <User className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Consultor Responsável</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Consultor
              </label>
              <select
                name="consultant_id"
                value={formData.consultant_id}
                onChange={handleConsultantChange}
                className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">Nenhum consultor selecionado</option>
                {consultants.map(consultant => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.commercial_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 6: Descrição e Equipamentos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Descrição e Equipamentos</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  placeholder="Descreva o imóvel em detalhes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equipamentos (separados por vírgula)
                </label>
                <textarea
                  name="equipment"
                  value={formData.equipment}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  placeholder="Ar Condicionado, Varanda, Garagem, Elevador, etc."
                />
              </div>
            </div>
          </div>

          {/* Section 7: Imagem */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <Upload className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-medium">Imagem Principal</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL da Imagem
              </label>
              <input
                type="url"
                name="main_image_url"
                value={formData.main_image_url}
                onChange={handleInputChange}
                className="w-full bg-white/60 border border-gray-300 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="https://images.unsplash.com/..."
                required
              />
              
              {/* Image Preview */}
              {formData.main_image_url && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Preview:</p>
                  <div className="w-full h-64 rounded-2xl overflow-hidden border border-gray-200">
                    <img
                      src={formData.main_image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/property')}
              className="flex-1 bg-white text-black border-2 border-black py-4 rounded-2xl hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-black text-white py-4 rounded-2xl hover:bg-gray-800 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={loading || success}
            >
              {loading ? 'Criando...' : 'Criar Imóvel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}