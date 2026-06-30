"use client";

import { Mail, Phone, Instagram } from 'lucide-react';
import { useState } from 'react';
import { AgentModal } from './AgentModal';
import { useAgents } from '../../hooks/useAgents';
import { AgentSection } from './AgentSection';

// Import figma:asset images as fallback
const filipeImage = '/assets/8c7936a264ed5a45509e728e26f77eef2c4467a9.png';

export function Agents() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { agents, loading, error } = useAgents();

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  // Separate leadership team from other agents
  const leadershipTeam = agents.filter(agent => {
    const displayName = (agent.name || '').toLowerCase();
    return (displayName.includes('filipe') && displayName.includes('pereira')) ||
           (displayName.includes('isabelle') && displayName.includes('antunes'));
  });

  // Filter consultores (those with role 'Consultor' or title containing 'consultor')
  const consultores = agents.filter(agent => {
    const displayName = (agent.name || '').toLowerCase();
    const isLeadership = (displayName.includes('filipe') && displayName.includes('pereira')) ||
                        (displayName.includes('isabelle') && displayName.includes('antunes'));
    const role = (agent.role || '').toLowerCase();
    const title = (agent.title || '').toLowerCase();
    const isConsultor = role === 'consultor' || title.includes('consultor');
    return !isLeadership && isConsultor;
  });

  // Filter marketing team (only show those with photos)
  const marketingTeam = agents.filter(agent => {
    const displayName = (agent.name || '').toLowerCase();
    const isLeadership = (displayName.includes('filipe') && displayName.includes('pereira')) ||
                        (displayName.includes('isabelle') && displayName.includes('antunes'));
    const role = (agent.role || '').toLowerCase();
    const title = (agent.title || '').toLowerCase();
    const isMarketing = role === 'marketing' || title.includes('marketing');
    const hasPhoto = Boolean(agent.profile_photo_url || agent.photo_url);
    return !isLeadership && isMarketing && hasPhoto;
  });

  // Filter staff (everyone else)
  const staffTeam = agents.filter(agent => {
    const displayName = (agent.name || '').toLowerCase();
    const isLeadership = (displayName.includes('filipe') && displayName.includes('pereira')) ||
                        (displayName.includes('isabelle') && displayName.includes('antunes'));
    const role = (agent.role || '').toLowerCase();
    const title = (agent.title || '').toLowerCase();
    const isConsultor = role === 'consultor' || title.includes('consultor');
    const isMarketing = role === 'marketing' || title.includes('marketing');
    return !isLeadership && !isConsultor && !isMarketing;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error loading agents: {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4">
              A Nossa Equipa
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A nossa equipa de profissionais experientes está dedicada a ajudá-lo a encontrar a sua propriedade perfeita
            </p>
          </div>

          {/* Leadership Team - Premium Cards - Desktop */}
          {leadershipTeam.length > 0 && (
            <div className="hidden md:block mb-16">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-light text-gray-800 dark:text-gray-200 mb-2">Liderança</h3>
                <div className="w-20 h-1 bg-black dark:bg-white mx-auto"></div>
              </div>
              
              <div className="flex justify-center gap-8 max-w-5xl mx-auto">
                {leadershipTeam.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className="relative group cursor-pointer w-full max-w-xs"
                  >
                    {/* Premium Card */}
                    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500 border-2 border-gray-100 hover:border-black">
                      {/* Image with Gradient Overlay */}
                      <div className="relative aspect-square overflow-hidden bg-gray-200">
                        {agent.image ? (
                          <img
                            src={agent.image}
                            alt={agent.name}
                            onError={(e) => {
                              e.currentTarget.src = filipeImage;
                            }}
                            className="w-full h-full object-cover object-[center_10%] group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center text-white">
                            <span className="text-6xl font-light">
                              {agent.name ? agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                            </span>
                          </div>
                        )}
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Instagram Badge */}
                        {agent.instagram && (
                          <a
                            href={agent.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-6 right-6 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full flex items-center gap-2 hover:bg-black hover:scale-110 transition-all duration-300 border border-white/20"
                          >
                            <Instagram size={18} className="text-white" />
                          </a>
                        )}
                        
                        {/* Sub Role Badge with Glassmorphism */}
                        {(agent as any).sub_role && (
                          <div className="absolute bottom-6 right-6 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
                            <span className="text-white text-sm font-medium">{(agent as any).sub_role}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <h3 className="text-xl font-light mb-4">{agent.name}</h3>

                        {/* Contact Info */}
                        <div className="space-y-1.5 mb-4">
                          <a
                            href={`mailto:${agent.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors group/link"
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover/link:bg-black group-hover/link:text-white transition-colors">
                              <Mail size={14} />
                            </div>
                            <span className="truncate text-xs">{agent.email}</span>
                          </a>
                          <a
                            href={`tel:${agent.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors group/link"
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover/link:bg-black group-hover/link:text-white transition-colors">
                              <Phone size={14} />
                            </div>
                            <span className="text-xs">{agent.phone}</span>
                          </a>
                        </div>

                        {/* CTA Button */}
                        <button className="w-full bg-black text-white py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-300 text-sm font-medium">
                          Ver Perfil
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leadership Team - Mobile */}
          {leadershipTeam.length > 0 && (
            <div className="md:hidden mb-12">
              <div className="text-center mb-6">
                <h3 className="text-xl font-light text-gray-800 dark:text-gray-200 mb-2">Liderança</h3>
                <div className="w-16 h-1 bg-black dark:bg-white mx-auto"></div>
              </div>
              
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                <div className="flex gap-4 pb-4">
                  {leadershipTeam.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className="relative group cursor-pointer flex-shrink-0 w-[85vw]"
                    >
                      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border-2 border-gray-100">
                        <div className="relative aspect-[4/5] overflow-hidden bg-gray-200">
                          {agent.image ? (
                            <img
                              src={agent.image}
                              alt={agent.name}
                              onError={(e) => {
                                e.currentTarget.src = filipeImage;
                              }}
                              className="w-full h-full object-cover object-[center_10%]"
                            />
                          ) : (
                            <img
                              src={filipeImage}
                              alt={agent.name}
                              className="w-full h-full object-cover object-[center_10%]"
                            />
                          )}
                          
                          {agent.instagram && (
                            <a
                              href={agent.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-2 border border-white/20"
                            >
                              <Instagram size={16} className="text-white" />
                            </a>
                          )}
                          
                          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full">
                            <span className="text-white text-xs font-semibold">LIDERANÇA</span>
                          </div>
                          
                          {/* Sub Role Badge - Bottom Right */}
                          {(agent as any).sub_role && (
                            <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                              <span className="text-white text-sm font-medium">{(agent as any).sub_role}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-6">
                          <h3 className="text-xl font-light mb-1">{agent.name}</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">{agent.title}</p>

                          <div className="space-y-2 mb-4">
                            <a
                              href={`mailto:${agent.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
                            >
                              <Mail size={16} />
                              <span className="truncate">{agent.email}</span>
                            </a>
                            <a
                              href={`tel:${agent.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
                            >
                              <Phone size={16} />
                              <span>{agent.phone}</span>
                            </a>
                          </div>

                          <button className="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium">
                            Ver Perfil Completo
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Consultores Section */}
          <AgentSection 
            title="Equipa de Consultores" 
            agents={consultores} 
            onAgentClick={setSelectedAgentId} 
          />

          {/* Staff Section */}
          <AgentSection 
            title="Staff" 
            agents={staffTeam} 
            onAgentClick={setSelectedAgentId} 
          />

          {/* Marketing Section */}
          <AgentSection 
            title="Marketing" 
            agents={marketingTeam} 
            onAgentClick={setSelectedAgentId}
            hideContacts={true}
          />
        </div>
      </section>

      {/* Agent Modal */}
      <AgentModal agent={selectedAgent} onClose={() => setSelectedAgentId(null)} />
    </>
  );
}