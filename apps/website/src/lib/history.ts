// Activity History / Audit Log System

export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO format
  actor_user_id: string; // Who did the action
  actor_name: string; // Name of who did the action
  action_type: 'create' | 'edit' | 'delete' | 'status_change' | 'document_upload' | 'comment' | 'assignment' | 'other';
  target_type: 'user' | 'property' | 'buyer' | 'lead' | 'task' | 'document' | 'campaign' | 'candidate' | 'other';
  target_id: string; // ID of the affected item
  target_name: string; // Name of the affected item
  description: string; // Human-readable description
  metadata?: Record<string, any>; // Additional data (changes, etc.)
}

// Mock history data - In production this would be in a database
let mockHistory: HistoryEntry[] = [
  {
    id: '1',
    timestamp: '2025-01-23T21:00:00Z',
    actor_user_id: '1',
    actor_name: 'Admin User',
    action_type: 'edit',
    target_type: 'user',
    target_id: '2',
    target_name: 'João Silva',
    description: 'Editou o perfil do utilizador João Silva',
    metadata: {
      fields_changed: ['phone_primary', 'department']
    }
  },
  {
    id: '2',
    timestamp: '2025-01-23T22:00:00Z',
    actor_user_id: '1',
    actor_name: 'Admin User',
    action_type: 'create',
    target_type: 'property',
    target_id: 'prop-1',
    target_name: 'Apartamento T2 em Lisboa',
    description: 'Criou novo imóvel: Apartamento T2 em Lisboa',
  },
  {
    id: '3',
    timestamp: '2025-01-22T15:30:00Z',
    actor_user_id: '2',
    actor_name: 'João Silva',
    action_type: 'status_change',
    target_type: 'property',
    target_id: 'prop-2',
    target_name: 'Moradia V3 no Porto',
    description: 'Alterou o estado do imóvel para "Reservado"',
    metadata: {
      old_status: 'Ativo',
      new_status: 'Reservado'
    }
  },
  {
    id: '4',
    timestamp: '2025-01-22T10:15:00Z',
    actor_user_id: '1',
    actor_name: 'Admin User',
    action_type: 'create',
    target_type: 'user',
    target_id: '3',
    target_name: 'Maria Santos',
    description: 'Criou novo utilizador: Maria Santos',
  },
  {
    id: '5',
    timestamp: '2025-01-21T16:45:00Z',
    actor_user_id: '3',
    actor_name: 'Maria Santos',
    action_type: 'document_upload',
    target_type: 'user',
    target_id: '3',
    target_name: 'Maria Santos',
    description: 'Fez upload do documento: Cartão de Cidadão',
    metadata: {
      document_type: 'id_card'
    }
  },
  {
    id: '6',
    timestamp: '2025-01-21T14:20:00Z',
    actor_user_id: '2',
    actor_name: 'João Silva',
    action_type: 'edit',
    target_type: 'buyer',
    target_id: 'buyer-1',
    target_name: 'Carlos Pereira',
    description: 'Atualizou os dados do comprador Carlos Pereira',
    metadata: {
      fields_changed: ['email', 'budget']
    }
  },
  {
    id: '7',
    timestamp: '2025-01-20T11:00:00Z',
    actor_user_id: '1',
    actor_name: 'Admin User',
    action_type: 'assignment',
    target_type: 'task',
    target_id: 'task-1',
    target_name: 'Agendar visita ao imóvel',
    description: 'Atribuiu a tarefa "Agendar visita ao imóvel" a João Silva',
    metadata: {
      assigned_to: 'João Silva'
    }
  },
  {
    id: '8',
    timestamp: '2025-01-20T09:30:00Z',
    actor_user_id: '2',
    actor_name: 'João Silva',
    action_type: 'create',
    target_type: 'lead',
    target_id: 'lead-5',
    target_name: 'Ana Costa',
    description: 'Criou novo lead: Ana Costa',
  },
  {
    id: '9',
    timestamp: '2025-01-19T17:00:00Z',
    actor_user_id: '1',
    actor_name: 'Admin User',
    action_type: 'edit',
    target_type: 'user',
    target_id: '2',
    target_name: 'João Silva',
    description: 'Atualizou os dados de faturação do utilizador',
    metadata: {
      fields_changed: ['commission_value', 'iban']
    }
  },
  {
    id: '10',
    timestamp: '2025-01-19T13:15:00Z',
    actor_user_id: '3',
    actor_name: 'Maria Santos',
    action_type: 'status_change',
    target_type: 'property',
    target_id: 'prop-3',
    target_name: 'Loja Comercial em Braga',
    description: 'Mudou o estado do imóvel para "Vendido"',
    metadata: {
      old_status: 'Reservado',
      new_status: 'Vendido'
    }
  },
];

// Helper function to add a new history entry
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const newEntry: HistoryEntry = {
    ...entry,
    id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  
  mockHistory.unshift(newEntry); // Add to beginning of array
  return newEntry;
}

// Get history entries where user was the actor (did the action)
export function getHistoryByActor(userId: string): HistoryEntry[] {
  return mockHistory.filter(entry => entry.actor_user_id === userId);
}

// Get history entries where something was done TO this target
export function getHistoryByTarget(targetType: string, targetId: string): HistoryEntry[] {
  return mockHistory.filter(entry => 
    entry.target_type === targetType && entry.target_id === targetId
  );
}

// Get all history (for admin view)
export function getAllHistory(): HistoryEntry[] {
  return mockHistory;
}

// Format action type for display
export function formatActionType(actionType: string): string {
  const labels: Record<string, string> = {
    create: 'Criou',
    edit: 'Editou',
    delete: 'Eliminou',
    status_change: 'Alterou Estado',
    document_upload: 'Upload de Documento',
    comment: 'Comentou',
    assignment: 'Atribuiu',
    other: 'Outra Ação',
  };
  return labels[actionType] || actionType;
}

// Format target type for display
export function formatTargetType(targetType: string): string {
  const labels: Record<string, string> = {
    user: 'Utilizador',
    property: 'Imóvel',
    buyer: 'Comprador',
    lead: 'Lead',
    task: 'Tarefa',
    document: 'Documento',
    campaign: 'Campanha',
    candidate: 'Candidato',
    other: 'Outro',
  };
  return labels[targetType] || targetType;
}

// Format timestamp for display
export function formatHistoryDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
