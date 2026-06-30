"use client";

import { Mail, Phone, Instagram } from 'lucide-react';
const filipeImage = '/assets/8c7936a264ed5a45509e728e26f77eef2c4467a9.png';

interface Agent {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  image?: string;
  instagram?: string;
}

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer border border-gray-100"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-200">
        {agent.image ? (
          <img
            src={agent.image}
            alt={agent.name}
            onError={(e) => {
              e.currentTarget.src = filipeImage;
            }}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl mb-1">{agent.name}</h3>
        <p className="text-gray-600 text-sm mb-4">{agent.title}</p>

        {/* Contact Info */}
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

        {/* Contact Button */}
        <button className="w-full bg-black text-white py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
          Ver Perfil
        </button>
      </div>
    </div>
  );
}
