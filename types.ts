
export enum TaskStatus {
  TODO = 'TO DO',
  TEST = 'DA TESTARE',
  DONE = 'COMPLETATO'
}

export enum TaskPriority {
  LOW = 'BASSA',
  MEDIUM = 'MEDIA',
  HIGH = 'ALTA'
}

export interface Section {
  id: string;
  name: string;
  order: number;
}

export interface Task {
  id: string;
  userId: string; // ID utente proprietario
  projectId: string;
  sectionId?: string | null; // Riferimento alla sezione (Container). Null o undefined = Senza sezione
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  deletedAt?: number; // Timestamp per soft delete
}

export interface Project {
  id: string;
  userId: string; // ID utente proprietario
  name: string;
  description?: string;
  createdAt: number;
  order?: number; // Ordine personalizzato per la sidebar
  sections?: Section[]; // Lista dei container/sottoprogetti
}

export type ViewMode = 'LIST' | 'KANBAN';
