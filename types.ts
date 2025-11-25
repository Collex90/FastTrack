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

export interface Task {
  id: string;
  userId: string; // ID utente proprietario
  projectId: string;
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
}

export type ViewMode = 'LIST' | 'KANBAN';