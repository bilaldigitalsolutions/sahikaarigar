// Utility Functions

/** Format a 10-digit Indian phone number for display. */
export function formatPhone(phone: string): string {
  if (phone.length === 10) {
    return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
}

/** Mask a phone number for privacy (before a hire is accepted). */
export function maskPhone(phone: string): string {
  if (phone.length === 10) {
    return `+91 XXXXX ${phone.slice(5)}`;
  }
  return '***';
}

/** Format currency in Indian Rupees. */
export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Format a date relative to now (e.g. "3 hr ago"). */
export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hr ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return past.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Calculate distance between two coordinates (Haversine, km, 1 decimal). */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Truncate text with an ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

/** Validate an Indian mobile number (10 digits starting 6-9). */
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/**
 * Known fake/test sequences we refuse anywhere a phone is entered:
 *   0000000000, 1111111111 … 9999999999 (all-same-digit),
 *   0123456789 / 1234567890 / 9876543210 (straight runs).
 */
export function isFakePhoneSequence(phone: string): boolean {
  if (!/^\d{10}$/.test(phone)) return false;
  if (/^(\d)\1{9}$/.test(phone)) return true; // 0000000000 … 9999999999
  const chars = [...phone].map(Number);
  // Cyclic runs — 0123456789 / 1234567890 / 9876543210 / 9012345678 …
  const ascending = chars.every((d, i) => i === 0 || d === (chars[i - 1] + 1) % 10);
  const descending = chars.every((d, i) => i === 0 || d === (chars[i - 1] + 9) % 10);
  return ascending || descending;
}

/**
 * Normalise a phone number to the 10-digit Indian mobile format stored in the
 * database. Firebase returns "+919876543210" while the DB stores "9876543210".
 */
export function normalizeIndianPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/** Get up to two initials from a name. */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Star string for a rating, e.g. "★★★★☆". */
export function generateStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;
  return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { AadhaarValidation } from './aadhaar';
export { formatAadhaar, isValidAadhaar, validateAadhaar, verhoeffPasses } from './aadhaar';

/** Debounce a function. */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
