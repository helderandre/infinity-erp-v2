"use client";

import { Mail, Phone, Instagram } from 'lucide-react';
const filipeImage = '/assets/8c7936a264ed5a45509e728e26f77eef2c4467a9.png';

interface Agent {
  id: string;
  name: string;
  title: string;
  sub_role?: string;
  email: string;
  phone: string;
  image?: string;
  instagram?: string;
}

interface AgentSectionProps {
  title: string;
  agents: Agent[];
  onAgentClick: (id: string) => void;
  hideContacts?: boolean;
}

export function AgentSection({ title, agents, onAgentClick, hideContacts = false }: AgentSectionProps) {
  if (agents.length === 0) return null;

  // Determine if we should center (less than 4 agents)
  const shouldCenter = agents.length < 4;

  return (
    <>
      <div className="text-center mb-8 mt-16">
        <h3 className="text-2xl font-light text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <div className="w-20 h-1 bg-gray-300 dark:bg-gray-600 mx-auto"></div>
      </div>

      {/* Desktop Grid */}
      {shouldCenter ? (
        // Less than 4 agents - use flexbox with centering
        <div className="hidden sm:flex sm:flex-wrap justify-center gap-6 md:gap-8">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => onAgentClick(agent.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer border border-gray-100 dark:border-gray-700 w-[calc(50%-12px)] lg:w-[calc(25%-18px)]"
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-200 dark:bg-gray-700">
                {agent.image ? (
                  <img
                    src={agent.image}
                    alt={agent.name}
                    onError={(e) => {
                      e.currentTarget.src = filipeImage;
                    }}
                    className="w-full h-full object-cover object-[center_10%] group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center text-white">
                    <span className="text-6xl font-light">
                      {agent.name ? agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                    </span>
                  </div>
                )}
                {agent.instagram && (
                  <a
                    href={agent.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2 hover:bg-black transition-colors"
                  >
                    <Instagram size={16} className="text-white" />
                  </a>
                )}
                {/* Sub Role Badge with Glassmorphism */}
                {agent.sub_role && (
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30">
                    <span className="text-white text-xs font-medium">{agent.sub_role}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl mb-4 dark:text-white">{agent.name}</h3>

                {/* Contact Info */}
                {!hideContacts && (
                  <div className="space-y-2 mb-4">
                    <a
                      href={`mailto:${agent.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Mail size={16} />
                      <span className="truncate">{agent.email}</span>
                    </a>
                    <a
                      href={`tel:${agent.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Phone size={16} />
                      <span>{agent.phone}</span>
                    </a>
                  </div>
                )}

                {/* Contact Button */}
                <button className="w-full bg-black text-white py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-300 text-sm font-medium">
                  Ver Perfil
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 4 or more agents - use original grid
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => onAgentClick(agent.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer border border-gray-100 dark:border-gray-700"
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-200 dark:bg-gray-700">
                {agent.image ? (
                  <img
                    src={agent.image}
                    alt={agent.name}
                    onError={(e) => {
                      e.currentTarget.src = filipeImage;
                    }}
                    className="w-full h-full object-cover object-[center_10%] group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center text-white">
                    <span className="text-6xl font-light">
                      {agent.name ? agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                    </span>
                  </div>
                )}
                {agent.instagram && (
                  <a
                    href={agent.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2 hover:bg-black transition-colors"
                  >
                    <Instagram size={16} className="text-white" />
                  </a>
                )}
                {/* Sub Role Badge with Glassmorphism */}
                {agent.sub_role && (
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30">
                    <span className="text-white text-xs font-medium">{agent.sub_role}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl mb-4 dark:text-white">{agent.name}</h3>

                {/* Contact Info */}
                {!hideContacts && (
                  <div className="space-y-2 mb-4">
                    <a
                      href={`mailto:${agent.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Mail size={16} />
                      <span className="truncate">{agent.email}</span>
                    </a>
                    <a
                      href={`tel:${agent.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Phone size={16} />
                      <span>{agent.phone}</span>
                    </a>
                  </div>
                )}

                {/* Contact Button */}
                <button className="w-full bg-black text-white py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-300 text-sm font-medium">
                  Ver Perfil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Horizontal Scroll - 15% larger images with top-focused viewport */}
      <div className="sm:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-4 pb-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => onAgentClick(agent.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow group cursor-pointer flex-shrink-0 w-[75vw] border border-gray-100 dark:border-gray-700"
            >
              {/* Image - 15% larger with top-focused viewport */}
              <div className="relative aspect-[4/3.5] overflow-hidden bg-gray-200 dark:bg-gray-700">
                {agent.image ? (
                  <img
                    src={agent.image}
                    alt={agent.name}
                    onError={(e) => {
                      e.currentTarget.src = filipeImage;
                    }}
                    className="w-full h-full object-cover object-[center_10%] group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <img
                    src={filipeImage}
                    alt={agent.name}
                    className="w-full h-full object-cover object-[center_10%] group-hover:scale-110 transition-transform duration-500"
                  />
                )}
                {agent.instagram && (
                  <a
                    href={agent.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2 hover:bg-black transition-colors"
                  >
                    <Instagram size={16} className="text-white" />
                  </a>
                )}
                {/* Sub Role Badge with Glassmorphism */}
                {agent.sub_role && (
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30">
                    <span className="text-white text-xs font-medium">{agent.sub_role}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-xl mb-1 dark:text-white">{agent.name}</h3>

                {/* Contact Info */}
                {!hideContacts && (
                  <div className="space-y-2 mb-3">
                    <a
                      href={`mailto:${agent.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Mail size={16} />
                      <span className="truncate">{agent.email}</span>
                    </a>
                    <a
                      href={`tel:${agent.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Phone size={16} />
                      <span>{agent.phone}</span>
                    </a>
                  </div>
                )}

                {/* Contact Button */}
                <button className="w-full bg-black text-white py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-300 text-sm font-medium">
                  Ver Perfil
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}