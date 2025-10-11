export interface Prompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
