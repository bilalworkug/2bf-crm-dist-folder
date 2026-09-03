export type ShiftType = 'morning' | 'afternoon' | 'night';

export type DepartmentType = 'production' | 'warehouse' | 'dispatch' | 'quality' | 'accounts';

export interface ShiftHandoverNote {
  id: string;
  department: DepartmentType;
  shift: ShiftType;
  date: string; // YYYY-MM-DD
  machineStatus: string;
  boxesCompleted: number;
  issues: string;
  pendingTasks: string;
  nextShiftInstructions: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

const STORAGE_KEY = '2bf_shift_handovers_store';

// Default initial sample notes for demo/production testing
const DEFAULT_NOTES: ShiftHandoverNote[] = [
  {
    id: 'note-001',
    department: 'production',
    shift: 'morning',
    date: new Date().toISOString().split('T')[0],
    machineStatus: 'Line 1 & 2 fully operational. Packaging sealer checked and calibrated.',
    boxesCompleted: 340,
    issues: 'Tape applicator on Machine 2 needed roll change at 10:15.',
    pendingTasks: 'Clean conveyor belt rollers before evening shift begins.',
    nextShiftInstructions: 'Prioritize Cappuccino boxes to meet sales order SO-1054.',
    authorName: 'Abebe Kebede',
    authorRole: 'production_manager',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'note-002',
    department: 'warehouse',
    shift: 'morning',
    date: new Date().toISOString().split('T')[0],
    machineStatus: 'Forklift 1 charged. Hand scanners synced.',
    boxesCompleted: 280,
    issues: 'Bay 3 pallet rack space limited. Moved older lots forward.',
    pendingTasks: 'Verify physical count of finished goods in WH-01.',
    nextShiftInstructions: 'Inspect incoming dispatch vehicle scheduled for 15:00.',
    authorName: 'Mulugeta Tadesse',
    authorRole: 'warehouse_manager',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

/**
 * Dedicated Shift Handover Storage Service
 * Keeps shift notes isolated from audit_logs and easily searchable.
 */
export function getShiftHandoverNotes(): ShiftHandoverNote[] {
  if (typeof window === 'undefined') return DEFAULT_NOTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTES));
      return DEFAULT_NOTES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load shift handover notes:', e);
    return DEFAULT_NOTES;
  }
}

export function saveShiftHandoverNote(note: Omit<ShiftHandoverNote, 'id' | 'createdAt'>): ShiftHandoverNote {
  const current = getShiftHandoverNotes();
  const newNote: ShiftHandoverNote = {
    ...note,
    id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newNote, ...current];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist shift handover note:', e);
    }
  }

  return newNote;
}
