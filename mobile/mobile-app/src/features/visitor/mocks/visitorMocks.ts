import { VisitorPass } from '../store/visitorPassSlice';

export type PassTypeKey = 'GUEST' | 'GROUP' | 'CAB' | 'DELIVERY' | 'SERVICE';

export interface ExtendedVisitorPass extends VisitorPass {
  passType: PassTypeKey;
  vehicleNo?: string;
  provider?: string;
  guestCount?: number;
  guestList?: Array<{ name: string; phone: string }>;
  deliveryInstructions?: string;
  orderId?: string;
  packageCount?: number;
  deliveryAction?: string;
  serviceNotes?: string;
  allowedWeekdays?: string[];
  timeWindow?: { startTime: string; endTime: string };
  entryGate?: string;
  approvedBy?: string;
  photoUrl?: string;
  rawPass?: any;
}

export interface WalkInApprovalItem {
  id: string;
  visitorName: string;
  phone: string;
  purpose: string;
  passType: PassTypeKey;
  gateName: string;
  waitingDurationMinutes: number;
  requestTimestamp: string;
  vehicleNo?: string;
  photoUrl?: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** When the host approved or denied the request (resolved requests only). */
  resolvedAt?: string;
  rawLog?: any;
}

export const MOCK_CAB_PROVIDERS = [
  { id: 'uber', label: 'Uber', icon: 'Car' },
  { id: 'ola', label: 'Ola', icon: 'Car' },
  { id: 'rapido', label: 'Rapido', icon: 'Bike' },
  { id: 'namma_yatri', label: 'Namma Yatri', icon: 'Car' },
  { id: 'other', label: 'Other Taxi', icon: 'Car' },
];

export const MOCK_DELIVERY_PARTNERS = [
  { id: 'amazon', label: 'Amazon', color: '#ff9900' },
  { id: 'flipkart', label: 'Flipkart', color: '#2874f0' },
  { id: 'swiggy', label: 'Swiggy Instamart', color: '#fc8019' },
  { id: 'zomato', label: 'Zomato / Blinkit', color: '#cb202d' },
  { id: 'dunzo', label: 'Dunzo', color: '#00d290' },
  { id: 'bluedart', label: 'BlueDart / Courier', color: '#003399' },
  { id: 'other', label: 'Other Express', color: '#6b7280' },
];

export const MOCK_SERVICE_TYPES = [
  { id: 'maid', label: 'House Maid / Help', icon: 'Sparkles' },
  { id: 'driver', label: 'Personal Driver', icon: 'Car' },
  { id: 'electrician', label: 'Electrician', icon: 'Zap' },
  { id: 'plumber', label: 'Plumber', icon: 'Wrench' },
  { id: 'cook', label: 'Chef / Cook', icon: 'Utensils' },
  { id: 'gardener', label: 'Gardener', icon: 'Flower2' },
  { id: 'carpenter', label: 'Carpenter', icon: 'Hammer' },
  { id: 'laundry', label: 'Laundry / Dry Clean', icon: 'Shirt' },
  { id: 'other', label: 'General Service', icon: 'Briefcase' },
];

export const MOCK_WEEKDAYS = [
  { id: 'MON', label: 'Mon', fullLabel: 'Monday' },
  { id: 'TUE', label: 'Tue', fullLabel: 'Tuesday' },
  { id: 'WED', label: 'Wed', fullLabel: 'Wednesday' },
  { id: 'THU', label: 'Thu', fullLabel: 'Thursday' },
  { id: 'FRI', label: 'Fri', fullLabel: 'Friday' },
  { id: 'SAT', label: 'Sat', fullLabel: 'Saturday' },
  { id: 'SUN', label: 'Sun', fullLabel: 'Sunday' },
];

export const DEFAULT_MOCK_VISITOR_PASSES: ExtendedVisitorPass[] = [];


