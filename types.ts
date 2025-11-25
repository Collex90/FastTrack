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
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export type ViewMode = 'LIST' | 'KANBAN';