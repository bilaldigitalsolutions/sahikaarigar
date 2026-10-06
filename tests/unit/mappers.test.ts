import {
  mapUser,
  mapPublicUser,
  mapWorkerProfile,
  mapWorkerSearchRow,
  mapHireRequest,
  mapReview,
  userUpdateToRow,
  workerUpdateToRow,
} from '@/lib/mappers';

describe('Supabase row mappers', () => {
  describe('mapUser', () => {
    it('should convert snake_case columns to camelCase fields', () => {
      const user = mapUser({
        id: 'u1',
        firebase_uid: 'fb-1',
        phone: '9876543210',
        name: 'Raj Kumar',
        role: 'worker',
        avatar: null,
        location_area: 'Ameerpet',
        location_city: 'Hyderabad',
        lat: '17.4374',
        lng: 78.4485,
        is_active: true,
        is_verified: false,
        address: null,
        trust_score: 10,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      });

      expect(user.id).toBe('u1');
      expect(user.firebaseUid).toBe('fb-1');
      expect(user.locationArea).toBe('Ameerpet');
      expect(user.locationCity).toBe('Hyderabad');
      // numeric columns may arrive as strings
      expect(user.lat).toBe(17.4374);
      expect(user.lng).toBe(78.4485);
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
      expect(user.trustScore).toBe(10);
    });
  });

  describe('mapPublicUser', () => {
    it('should omit phone when it was not selected', () => {
      const user = mapPublicUser({ id: 'u1', name: 'Raj' });
      expect(user.phone).toBeUndefined();
    });

    it('should include phone when present', () => {
      const user = mapPublicUser({ id: 'u1', name: 'Raj', phone: '9876543210' });
      expect(user.phone).toBe('9876543210');
    });
  });

  describe('mapWorkerProfile', () => {
    it('should map rating columns and arrays', () => {
      const profile = mapWorkerProfile({
        id: 'w1',
        user_id: 'u1',
        skills: ['electrician'],
        experience: 5,
        hourly_rate: 300,
        availability: 'available',
        portfolio: [],
        rating_average: '4.80',
        rating_count: 12,
        completed_jobs: 30,
        service_areas: ['ameerpet'],
        lat: null,
        lng: null,
        is_approved: true,
      });

      expect(profile.id).toBe('w1');
      expect(profile.userId).toBe('u1');
      expect(profile.skills).toEqual(['electrician']);
      expect(profile.ratingAverage).toBe(4.8);
      expect(profile.ratingCount).toBe(12);
      expect(profile.completedJobs).toBe(30);
      expect(profile.serviceAreas).toEqual(['ameerpet']);
      expect(profile.isApproved).toBe(true);
      expect(profile.lat).toBeNull();
    });
  });

  describe('mapWorkerSearchRow', () => {
    it('should build a nested user from the flattened RPC row', () => {
      const worker = mapWorkerSearchRow({
        id: 'w1',
        user_id: 'u1',
        skills: ['plumber'],
        experience: 3,
        hourly_rate: 250,
        availability: 'available',
        rating_average: 4.5,
        rating_count: 2,
        completed_jobs: 7,
        service_areas: ['kukatpally'],
        is_approved: true,
        user_name: 'Ahmed Ali',
        user_avatar: null,
        user_area: 'Kukatpally',
        user_city: 'Hyderabad',
        distance_km: '1.2',
      });

      expect(worker.user).toEqual({
        id: 'u1',
        name: 'Ahmed Ali',
        avatar: null,
        locationArea: 'Kukatpally',
        locationCity: 'Hyderabad',
      });
      expect(worker.distanceKm).toBe(1.2);
    });
  });

  describe('mapHireRequest', () => {
    it('should map status and phone reveal flag', () => {
      const hire = mapHireRequest({
        id: 'h1',
        employer_id: 'u1',
        worker_id: 'w1',
        description: 'Fix the wiring',
        location: 'Ameerpet',
        proposed_rate: 500,
        status: 'accepted',
        scheduled_date: null,
        completed_at: null,
        phone_revealed: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      });

      expect(hire.id).toBe('h1');
      expect(hire.employerId).toBe('u1');
      expect(hire.workerId).toBe('w1');
      expect(hire.proposedRate).toBe(500);
      expect(hire.status).toBe('accepted');
      expect(hire.phoneRevealed).toBe(true);
    });
  });

  describe('mapReview', () => {
    it('should map review fields', () => {
      const review = mapReview({
        id: 'r1',
        hire_request_id: 'h1',
        reviewer_id: 'u1',
        worker_id: 'w1',
        rating: 5,
        comment: 'Great work',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      });

      expect(review.hireRequestId).toBe('h1');
      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Great work');
    });
  });

  describe('update payload builders', () => {
    it('userUpdateToRow should only include provided fields', () => {
      expect(userUpdateToRow({ name: 'New Name', locationArea: 'Uppal' })).toEqual({
        name: 'New Name',
        location_area: 'Uppal',
      });
    });

    it('workerUpdateToRow should convert keys to snake_case', () => {
      expect(workerUpdateToRow({ hourlyRate: 400, availability: 'busy' })).toEqual({
        hourly_rate: 400,
        availability: 'busy',
      });
    });
  });
});
