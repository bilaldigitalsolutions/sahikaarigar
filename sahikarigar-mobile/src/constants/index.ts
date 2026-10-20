// App Constants
import type { HireStatus } from '@/types';

export const APP_NAME = 'Sahi Kaarigar';
export const APP_DESCRIPTION = 'Find the best workers in Hyderabad';

// Skills List (id matches the value stored in the database)
export const SKILLS = [
  { id: 'electrician', label: 'Electrician', icon: '⚡' },
  { id: 'plumber', label: 'Plumber', icon: '🔧' },
  { id: 'painter', label: 'Painter', icon: '🎨' },
  { id: 'carpenter', label: 'Carpenter', icon: '🪑' },
  { id: 'ac repair', label: 'AC Repair', icon: '❄️' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'driver', label: 'Driver', icon: '🚗' },
  { id: 'mason', label: 'Mason', icon: '🧱' },
  { id: 'welder', label: 'Welder', icon: '🔧' },
  { id: 'mechanic', label: 'Mechanic', icon: '🔩' },
  { id: 'gardener', label: 'Gardener', icon: '🌱' },
  { id: 'cook', label: 'Cook', icon: '🍳' },
] as const;

export type SkillId = (typeof SKILLS)[number]['id'];

/** Human label for a skill id (falls back to the raw id). */
export function skillLabel(id: string): string {
  return SKILLS.find((s) => s.id === id)?.label ?? id;
}

/** Emoji icon for a skill id (falls back to a generic wrench). */
export function skillIcon(id: string): string {
  return SKILLS.find((s) => s.id === id)?.icon ?? '🛠️';
}

// Hyderabad Areas
export const HYDERABAD_AREAS = [
  { id: 'ameerpet', label: 'Ameerpet' },
  { id: 'kukatpally', label: 'Kukatpally' },
  { id: 'gachibowli', label: 'Gachibowli' },
  { id: 'hitech-city', label: 'Hitech City' },
  { id: 'madhapur', label: 'Madhapur' },
  { id: 'jubilee-hills', label: 'Jubilee Hills' },
  { id: 'banjara-hills', label: 'Banjara Hills' },
  { id: 'secunderabad', label: 'Secunderabad' },
  { id: 'begumpet', label: 'Begumpet' },
  { id: 'lb-nagar', label: 'LB Nagar' },
  { id: 'dilsukhnagar', label: 'Dilsukhnagar' },
  { id: 'mehdipatnam', label: 'Mehdipatnam' },
  { id: 'tolichowki', label: 'Tolichowki' },
  { id: 'uppal', label: 'Uppal' },
  { id: 'malkajgiri', label: 'Malkajgiri' },
  { id: 'srinagar-colony', label: 'Srinagar Colony' },
  { id: 'somajiguda', label: 'Somajiguda' },
  { id: 'abids', label: 'Abids' },
  { id: 'attapur', label: 'Attapur' },
  { id: 'miyapur', label: 'Miyapur' },
] as const;

/** Human label for a Hyderabad area id (falls back to the raw id). */
export function areaLabel(id: string): string {
  return HYDERABAD_AREAS.find((a) => a.id === id)?.label ?? id;
}

// Hire Status
export const HIRE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
} as const;

/** User-facing label for a hire status. */
export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  en_route: 'On the way',
  arrived: 'Arrived',
  in_progress: 'In progress',
};

// Availability Status
export const AVAILABILITY = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const;

export const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
} as const;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

// Validation
export const VALIDATION = {
  PHONE_REGEX: /^[6-9]\d{9}$/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
  COMMENT_MAX_LENGTH: 500,
  MIN_RATING: 1,
  MAX_RATING: 5,
  MIN_RATE: 50,
  MAX_RATE: 10000,
  MIN_EXPERIENCE: 0,
  MAX_EXPERIENCE: 50,
  OTP_LENGTH: 6,
} as const;

// -----------------------------------------------------------------------------
// Ionicons names per skill (used by the redesigned Home / Search screens)
// -----------------------------------------------------------------------------
export const SKILL_IONICONS: Record<string, string> = {
  electrician: 'flash-outline',
  plumber: 'water-outline',
  painter: 'color-palette-outline',
  carpenter: 'hammer-outline',
  'ac repair': 'snow-outline',
  cleaning: 'sparkles-outline',
  driver: 'car-outline',
  mason: 'cube-outline',
  welder: 'flame-outline',
  mechanic: 'settings-outline',
  gardener: 'leaf-outline',
  cook: 'restaurant-outline',
};

/** Ionicons name for a skill id (falls back to a wrench). */
export function skillIconName(id: string): string {
  return SKILL_IONICONS[id] ?? 'construct-outline';
}

/** The six headline service tiles on the Home screen (with live counts). */
export const HOME_SERVICES = [
  { id: 'electrician', label: 'Electrician' },
  { id: 'plumber', label: 'Plumber' },
  { id: 'painter', label: 'Painter' },
  { id: 'carpenter', label: 'Carpenter' },
  { id: 'ac repair', label: 'AC Repair' },
  { id: 'cleaning', label: 'Cleaning' },
] as const;

/** Quick filter pills on the Search screen. */
export const POPULAR_FILTERS = [
  { id: 'near', label: 'Near Me', icon: 'location-outline' },
  { id: 'top', label: 'Top Rated', icon: 'star-outline' },
  { id: 'under300', label: 'Under ₹300', icon: 'pricetag-outline' },
  { id: 'available', label: 'Available Now', icon: 'time-outline' },
] as const;

export type PopularFilterId = (typeof POPULAR_FILTERS)[number]['id'];

/** Seeded recent searches shown before the user types anything. */
export const RECENT_SEARCHES = [
  'ac repair in Hyderabad',
  'electrician near me',
  'plumber in Banjara Hills',
] as const;

/** Chips in the feedback screen's "What did you like?" list. */
export const FEEDBACK_LIKES = ['On-time', 'Professional', 'Clean Work', 'Pricing'] as const;

/** Availability choices on the Join as Kaarigar form. */
export const AVAILABILITY_OPTIONS = [
  { value: 'full-time', label: 'Full-time • Mon to Sat, 9am–6pm' },
  { value: 'part-time', label: 'Part-time • Flexible hours' },
  { value: 'weekends', label: 'Weekends only' },
] as const;

/** Live legal pages (served by the website) — opened in the phone's browser. */
export const LEGAL_URLS = {
  terms: 'https://sahi-kaarigar.web.app/terms',
  privacy: 'https://sahi-kaarigar.web.app/privacy',
} as const;

/** SahiKaarigar support number (call / WhatsApp) — used on the Join as Kaarigar
 *  footer, the hire help button and the profile screen. */
export const SUPPORT_PHONE = '+91 9949363310';

/**
 * Sample service catalogue per skill, used to render the "Services & Pricing"
 * list on the worker profile. The API only exposes an hourly rate, so the price
 * shown for each service is the worker's `hourlyRate`.
 */
export const SKILL_SERVICES: Record<string, { title: string; desc: string }[]> = {
  plumber: [
    { title: 'Tap Repair', desc: 'General tap repair & replacement' },
    { title: 'Pipe Leakage', desc: 'Fixing pipe leaks & sealing' },
    { title: 'Drain Cleaning', desc: 'Blocked drain & sink cleaning' },
  ],
  electrician: [
    { title: 'Wiring & Fittings', desc: 'Switch, socket & fan installation' },
    { title: 'Fault Finding', desc: 'Short circuit & fault repair' },
    { title: 'Appliance Repair', desc: 'Basic appliance wiring repair' },
  ],
  cleaning: [
    { title: 'Deep Cleaning', desc: 'Full home deep cleaning' },
    { title: 'Sofa & Carpet', desc: 'Sofa, carpet & mattress cleaning' },
  ],
  carpenter: [
    { title: 'Furniture Repair', desc: 'Door, window & furniture repair' },
    { title: 'Custom Work', desc: 'Made-to-order carpentry' },
  ],
  'ac repair': [
    { title: 'AC Service', desc: 'General service & gas check' },
    { title: 'AC Installation', desc: 'Split / window AC installation' },
  ],
  painter: [
    { title: 'Wall Painting', desc: 'Interior & exterior painting' },
    { title: 'Touch-up', desc: 'Patch & touch-up work' },
  ],
};

/** Services shown for a skill id (falls back to a single generic entry). */
export function skillServices(id: string): { title: string; desc: string }[] {
  return SKILL_SERVICES[id] ?? [{ title: skillLabel(id), desc: 'General work & repair' }];
}
