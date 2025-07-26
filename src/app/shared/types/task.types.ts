export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  estimatedPomodoros: number;
  completedPomodoros: number;
  priority: TaskPriority;
  category?: string;
  pinned: boolean;
}

export interface TaskFormData {
  title: string;
  description: string;
  estimatedPomodoros: number;
  priority: TaskPriority;
  category: string;
}

export interface TaskStats {
  total: number;
  active: number;
  completed: number;
}