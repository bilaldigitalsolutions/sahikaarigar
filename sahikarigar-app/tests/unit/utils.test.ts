import { calculateDistance, formatCurrency, formatPhone, maskPhone, getInitials, normalizeIndianPhone } from '@/utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency in Indian Rupees', () => {
      expect(formatCurrency(300)).toBe('₹300');
      expect(formatCurrency(1500)).toBe('₹1,500');
      expect(formatCurrency(10000)).toBe('₹10,000');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('₹0');
    });
  });

  describe('formatPhone', () => {
    it('should format 10-digit phone number', () => {
      expect(formatPhone('9876543210')).toBe('+91 98765 43210');
    });

    it('should return original if not 10 digits', () => {
      expect(formatPhone('12345')).toBe('12345');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone number', () => {
      expect(maskPhone('9876543210')).toBe('+91 XXXXX 43210');
    });
  });

  describe('getInitials', () => {
    it('should get initials from name', () => {
      expect(getInitials('Raj Kumar')).toBe('RK');
      expect(getInitials('Ahmed Ali')).toBe('AA');
      expect(getInitials('Priya')).toBe('P');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Ameerpet to Kukatpally (approximately 8km)
      const distance = calculateDistance(
        17.4374, 78.4485, // Ameerpet
        17.4849, 78.4139  // Kukatpally
      );
      expect(distance).toBeGreaterThan(5);
      expect(distance).toBeLessThan(15);
    });

    it('should return 0 for same point', () => {
      const distance = calculateDistance(17.4374, 78.4485, 17.4374, 78.4485);
      expect(distance).toBe(0);
    });
  });

  describe('normalizeIndianPhone', () => {
    it('should strip the +91 country code returned by Firebase', () => {
      expect(normalizeIndianPhone('+919876543210')).toBe('9876543210');
    });

    it('should strip a leading 91 without the plus sign', () => {
      expect(normalizeIndianPhone('919876543210')).toBe('9876543210');
    });

    it('should strip a leading zero', () => {
      expect(normalizeIndianPhone('09876543210')).toBe('9876543210');
    });

    it('should leave an already normalised number untouched', () => {
      expect(normalizeIndianPhone('9876543210')).toBe('9876543210');
    });

    it('should handle empty input', () => {
      expect(normalizeIndianPhone('')).toBe('');
    });
  });
});