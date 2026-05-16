// src/components/assistant/types.ts

export type AssistantActionType = 'CREATE' | 'EDIT' | 'MOVE' | 'DELETE';

export interface CreateAction {
  type: 'CREATE';
  event: {
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    description?: string;
    location?: string;
    calendarId: string;
    recurrence?: string;
    color?: string;
  };
}

export interface EditAction {
  type: 'EDIT';
  eventId: string;
  calendarId: string;
  changes: {
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    location?: string;
  };
}

export interface MoveAction {
  type: 'MOVE';
  eventId: string;
  calendarId: string;
  newStart: string;
  newEnd: string;
}

export interface DeleteAction {
  type: 'DELETE';
  eventId: string;
  calendarId: string;
  title: string;
}

export type AssistantAction = CreateAction | EditAction | MoveAction | DeleteAction;

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AssistantAction[];
  confirmed?: boolean;
  timestamp: string;
}
