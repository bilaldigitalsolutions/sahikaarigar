import { z } from 'zod';

// Phone validation
export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
});

// OTP verification
export const otpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

// User registration
export const userRegistrationSchema = z.object({
  firebaseUid: z.string().min(1, 'Firebase UID is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  role: z.enum(['worker', 'employer']),
  location: z.object({
    area: z.string().min(1, 'Area is required'),
    city: z.string().default('Hyderabad'),
    coordinates: z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    }).optional(),
  }).optional(),
  address: z.string().optional(),
});

// Worker profile creation
export const workerProfileSchema = z.object({
  skills: z
    .array(z.enum([
      'electrician', 'plumber', 'painter', 'carpenter', 'ac repair',
      'cleaning', 'driver', 'mason', 'welder', 'mechanic', 'gardener', 'cook'
    ]))
    .min(1, 'At least one skill is required'),
  experience: z
    .number()
    .min(0, 'Experience cannot be negative')
    .max(50, 'Experience cannot exceed 50 years'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  hourlyRate: z
    .number()
    .min(50, 'Minimum rate is ₹50/hr')
    .max(10000, 'Maximum rate is ₹10,000/hr'),
  serviceAreas: z
    .array(z.string())
    .min(1, 'At least one service area is required'),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
});

// Worker profile update
export const workerProfileUpdateSchema = z.object({
  skills: z
    .array(z.enum([
      'electrician', 'plumber', 'painter', 'carpenter', 'ac repair',
      'cleaning', 'driver', 'mason', 'welder', 'mechanic', 'gardener', 'cook'
    ]))
    .optional(),
  experience: z
    .number()
    .min(0)
    .max(50)
    .optional(),
  description: z
    .string()
    .max(500)
    .optional(),
  hourlyRate: z
    .number()
    .min(50)
    .max(10000)
    .optional(),
  availability: z
    .enum(['available', 'busy', 'offline'])
    .optional(),
  serviceAreas: z
    .array(z.string())
    .optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }).optional(),
});

// Worker search filters
export const workerSearchSchema = z.object({
  skills: z
    .array(z.string())
    .optional(),
  area: z
    .string()
    .optional(),
  minRating: z
    .number()
    .min(1)
    .max(5)
    .optional(),
  maxRate: z
    .number()
    .positive()
    .optional(),
  lat: z
    .number()
    .min(-90)
    .max(90)
    .optional(),
  lng: z
    .number()
    .min(-180)
    .max(180)
    .optional(),
  maxDistance: z
    .number()
    .positive()
    .optional(), // in km
  page: z
    .number()
    .positive()
    .default(1),
  limit: z
    .number()
    .positive()
    .max(50)
    .default(20),
});

// Hire request creation
export const hireRequestSchema = z.object({
  workerId: z.string().min(1, 'Worker ID is required'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  location: z
    .string()
    .min(3, 'Location must be at least 3 characters')
    .max(200, 'Location must be less than 200 characters'),
  proposedRate: z
    .number()
    .positive('Rate must be positive'),
  scheduledDate: z
    .string()
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
});

// Review creation
export const reviewSchema = z.object({
  hireRequestId: z.string().min(1, 'Hire request ID is required'),
  rating: z
    .number()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: z
    .string()
    .max(500, 'Comment must be less than 500 characters')
    .optional(),
});

// Report creation
export const reportSchema = z.object({
  reportedUserId: z.string().min(1, 'Reported user ID is required'),
  reason: z.enum(['fake_profile', 'bad_behavior', 'spam', 'harassment', 'other']),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

// Admin approval
export const adminApprovalSchema = z.object({
  workerId: z.string().min(1, 'Worker ID is required'),
  isApproved: z.boolean(),
  adminNotes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});