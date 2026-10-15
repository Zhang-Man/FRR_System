export type UserRole = 'submitter' | 'handler' | 'admin';
export type TicketStatus = 'pending' | 'processing' | 'resolved';

export interface User {
  id: string;
  user_id?: string;
  name: string;
  role: UserRole;
  avatar: string;
  phone?: string;
  department?: string;
}

export interface Collaborator {
  user_id: string;
  user_name: string;
}

export interface Ticket {
  id: number;
  reporter_id: string;
  reporter_name: string;
  contact: string;
  location: string;
  category: string;
  description: string;
  assignee_id?: string;
  assignee_name?: string;
  status: TicketStatus;
  solution?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  collaborators?: Collaborator[];
}

export interface Category {
  id: number | string;
  name: string;
  ticket_count?: number;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Stats {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  today: number;
}

export interface RankingData {
  user_id: string;
  name: string;
  claimed_count: number;
  resolved_count: number;
  completion_rate: number;
  avg_process_time: number;
  collaboration_count: number;
}

export interface CategoryStatData {
  category: string;
  count: number;
  percentage: number;
  pending: number;
  processing: number;
  resolved: number;
}

export interface TrendData {
  period: string;
  total: number;
  resolved: number;
}

export type RankingSortKey = 'claimed_count' | 'resolved_count' | 'collaboration_count' | 'total_participation' | 'avg_process_time';
