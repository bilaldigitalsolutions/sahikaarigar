// App Constants
import i18n from '@/lib/i18n';

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
  { id: 'flooring', label: 'Flooring', icon: '🪵' },
  { id: 'others', label: 'Others', icon: '🛠️' },
] as const;

export type SkillId = (typeof SKILLS)[number]['id'];

/** i18n key (common.*) for every skill id — labels follow the app language. */
const SKILL_I18N_KEYS: Record<string, string> = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  painter: 'Painter',
  carpenter: 'Carpenter',
  'ac repair': 'ACRepair',
  cleaning: 'Cleaning',
  driver: 'Driver',
  mason: 'Mason',
  welder: 'Welder',
  mechanic: 'Mechanic',
  gardener: 'Gardener',
  cook: 'Cook',
  flooring: 'Flooring',
  others: 'Others',
};

/** Translated human label for a skill id (falls back to the raw id). */
export function skillLabel(id: string): string {
  const key = SKILL_I18N_KEYS[id];
  if (!key) return id;
  return i18n.t(`common.${key}`) as string;
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

/** i18n keys (common.*) for each hire status — translate at render with t(). */
export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  pending: 'common.pending',
  accepted: 'common.accepted',
  rejected: 'common.rejected',
  completed: 'common.completed',
  cancelled: 'common.cancelled',
  en_route: 'common.enRoute',
  arrived: 'common.arrived',
  in_progress: 'common.inProgress',
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
  flooring: 'floor-outline',
  others: 'construct-outline',
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

/** Quick filter pills on the Search screen. `key` is the i18n key to render. */
export const POPULAR_FILTERS = [
  { id: 'near', label: 'Near Me', icon: 'location-outline', key: 'home.nearMe' },
  { id: 'top', label: 'Top Rated', icon: 'star-outline', key: 'home.topRated' },
  { id: 'under300', label: 'Under ₹300', icon: 'pricetag-outline', key: 'home.under300' },
  { id: 'available', label: 'Available Now', icon: 'time-outline', key: 'home.availableNow' },
] as const;

export type PopularFilterId = (typeof POPULAR_FILTERS)[number]['id'];

/** Seeded recent searches shown before the user types anything. */
export const RECENT_SEARCHES = [
  'ac repair in Hyderabad',
  'electrician near me',
  'plumber in Banjara Hills',
] as const;

/** i18n keys (feedback.*) for the "What did you like?" chips — customer rating the worker. */
export const CUSTOMER_LIKES = [
  'feedback.likeOnTime',
  'feedback.likeProfessional',
  'feedback.likeCleanWork',
  'feedback.likeFairPricing',
] as const;

/** i18n keys (feedback.*) for the like chips — worker rating the customer. */
export const WORKER_LIKES = [
  'feedback.likePaidOnTime',
  'feedback.likePoliteBehaviour',
  'feedback.likeClearInstructions',
  'feedback.likeEasyToWorkWith',
] as const;

/** Availability choices on the Join as Kaarigar form. `key` is the i18n key to render. */
export const AVAILABILITY_OPTIONS = [
  { value: 'full-time', label: 'Full-time • Mon to Sat, 9am–6pm', key: 'profile.availFullTime' },
  { value: 'part-time', label: 'Part-time • Flexible hours', key: 'profile.availPartTime' },
  { value: 'weekends', label: 'Weekends only', key: 'profile.availWeekends' },
] as const;

/** Live legal pages (served by the Vercel website) — opened in the phone's
 *  browser. Must match the URLs submitted in the Play Console listings. */
export const LEGAL_URLS = {
  terms: 'https://sahikaarigar.vercel.app/terms',
  privacy: 'https://sahikaarigar.vercel.app/privacy',
} as const;

/** SahiKaarigar support number (call / WhatsApp) — used on the Join as Kaarigar
 *  footer, the hire help button and the profile screen. */
export const SUPPORT_PHONE = '+91 9949363310';

/**
 * Sample service catalogue per skill, used to render the "Services & Pricing"
 * list on the worker profile. The API only exposes an hourly rate, so the price
 * shown for each service is the worker's `hourlyRate`.
 *
 * Entries store i18n KEYS, not copy — skillServices() translates at call time
 * (same pattern as skillLabel above), so Telugu users never see raw English.
 */
const SKILL_SERVICE_KEYS: Record<string, { titleKey: string; descKey: string }[]> = {
  plumber: [
    { titleKey: 'services.plumberTapTitle', descKey: 'services.plumberTapDesc' },
    { titleKey: 'services.plumberPipeTitle', descKey: 'services.plumberPipeDesc' },
    { titleKey: 'services.plumberDrainTitle', descKey: 'services.plumberDrainDesc' },
  ],
  electrician: [
    { titleKey: 'services.electricianWiringTitle', descKey: 'services.electricianWiringDesc' },
    { titleKey: 'services.electricianFaultTitle', descKey: 'services.electricianFaultDesc' },
    { titleKey: 'services.electricianApplianceTitle', descKey: 'services.electricianApplianceDesc' },
  ],
  cleaning: [
    { titleKey: 'services.cleaningDeepTitle', descKey: 'services.cleaningDeepDesc' },
    { titleKey: 'services.cleaningSofaTitle', descKey: 'services.cleaningSofaDesc' },
  ],
  carpenter: [
    { titleKey: 'services.carpenterFurnitureTitle', descKey: 'services.carpenterFurnitureDesc' },
    { titleKey: 'services.carpenterCustomTitle', descKey: 'services.carpenterCustomDesc' },
  ],
  'ac repair': [
    { titleKey: 'services.acServiceTitle', descKey: 'services.acServiceDesc' },
    { titleKey: 'services.acInstallTitle', descKey: 'services.acInstallDesc' },
  ],
  painter: [
    { titleKey: 'services.painterWallTitle', descKey: 'services.painterWallDesc' },
    { titleKey: 'services.painterTouchupTitle', descKey: 'services.painterTouchupDesc' },
  ],
};

/** Services shown for a skill id (falls back to a single generic entry). */
export function skillServices(id: string): { title: string; desc: string }[] {
  const entries = SKILL_SERVICE_KEYS[id];
  if (entries) {
    return entries.map((entry) => ({
      title: i18n.t(entry.titleKey) as string,
      desc: i18n.t(entry.descKey) as string,
    }));
  }
  return [{ title: skillLabel(id), desc: i18n.t('services.genericDesc') as string }];
}
