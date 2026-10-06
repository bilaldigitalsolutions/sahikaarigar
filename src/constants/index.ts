// App Constants
export const APP_NAME = 'SahiKaarigar';
export const APP_DESCRIPTION = 'Find trusted workers in Hyderabad';

// Skills List
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

// Hire Status
export const HIRE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Availability Status
export const AVAILABILITY = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

// Rate Limiting
export const RATE_LIMITS = {
  OTP: { limit: 3, window: 3600 }, // 3 per hour
  API: { limit: 30, window: 60 }, // 30 per minute
  SEARCH: { limit: 30, window: 60 }, // 30 per minute
  REVIEW: { limit: 3, window: 60 }, // 3 per minute
  REPORT: { limit: 3, window: 60 }, // 3 per minute
} as const;

// SEO
export const SEO = {
  TITLE: `${APP_NAME} - Verified Electricians & Plumbers in Hyderabad`,
  DESCRIPTION: 'Find trusted, verified workers in Hyderabad. Electricians, plumbers, painters with ratings & reviews. Book now!',
  KEYWORDS: ['electrician hyderabad', 'plumber hyderabad', 'carpenter', 'painter', 'worker'],
} as const;

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
} as const;