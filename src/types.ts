export type Category = string;

export interface Group {
  id: string;
  name: string;
  color: string;
  showInVisitors?: boolean; // Controls whether this group is displayed in the "Відвідувачі" tab
}

export interface Location {
  id: string;
  name: string;
  iconId?: string;
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
  customIconId?: string;
}

export interface CustomIcon {
  id: string;
  name: string;
  data: string; // base64
}

export interface SecurityShift {
  id: string;
  name: string;
  visitorIds: string[];
  status?: 'active' | 'inactive';
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

export interface DutyEvent {
  id: string;
  shiftId: string;
  shiftName: string;
  type: 'start' | 'end';
  timestamp: string; // ISO string
}
