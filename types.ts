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
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  deletedAt?: number; // Soft delete timestamp
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  deletedAt?: number; // Soft delete timestamp
}

export type ViewMode = 'LIST' | 'KANBAN';