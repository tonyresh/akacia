export type Category = string;

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface TimeLog {
  in?: string; // ISO string
  out?: string; // ISO string
}

export interface Visitor {
  id: string;
  name: string;
  callsign?: string;
  category: Category;
  groupId: string;
  group: string; // Legacy string for groups
  locationId?: string;
  location?: string;
  status: 'in' | 'out';
  lastEntry?: string; // ISO string
  totalTimeMinutes: number;
  logs?: TimeLog[];
  color?: string;
  isSpecial?: boolean;
}

export interface SecurityShift {
  id: string;
  name: string;
  visitorIds: string[];
}

export interface Guard {
  id: string;
  name: string;
}

export interface RestPeriod {
  start: string; // ISO string
  end?: string;
}

export interface Shift {
  id: string;
  guardId: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  restPeriods: RestPeriod[];
}

export interface DirtySkyEvent {
  id: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
}
