// =============================================================================
// Worker Profile — premium detail screen (occupies the "reference design")
// =============================================================================
//  * Hero header: large circular photo, name, green Verified badge, star
//    rating + review count, experience stat.
//  * Location card: map pin, area + city, distance from the user.
//  * 3 in-profile tabs: About | Services | Reviews.
//  * Sticky bottom bar: Call (outlined) + Book Now (solid green).
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar, Header, Rating, Screen } from '@/components';
import { areaLabel, skillIconName, skillLabel, skillServices } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getWorker, type ApiReview, type ApiWorker } from '@/lib/api';
import { trackEvent } from '@/lib/observability';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
import { calculateDistance, formatCurrency, formatRelativeDate, generateStars } from '@/utils';

type Tab = 'about' | 'services' | 'reviews';

const TABS: { id: Tab; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'reviews', label: 'Reviews' },
];

export default function WorkerDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);

  const [worker, setWorker] = useState<ApiWorker | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('services');

  useEffect(() => {
    let active = true;
    getWorker(id)
      .then((result) => {
        if (active) {
          setWorker(result.worker);
          setReviews(result.reviews ?? []);
          setError(null);
          trackEvent('worker_viewed', {
            workerId: result.worker.id,
            skill: result.worker.skills?.[0] ?? null,
          });
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load this worker.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const name = worker?.user?.name ?? 'Kaarigar';
  const workerUser = worker?.user;

  const distance =
    user?.lat != null && user?.lng != null && worker?.lat != null && worker?.lng != null
      ? calculateDistance(user.lat, user.lng, worker.lat, worker.lng)
      : null;

  const onCall = () => {
    // Public profile par number kabhi nahi aata (server strips it — phone sirf
    // GET /hires/:id se milta hai, booking accept hone ke baad). Sirf yahi
    // prompt dikhao: number chahiye toh login karke hire karo.
    Alert.alert(
      'Number hire ke baad milega',
      'Login karo aur kaarigar ko hire karo — number sirf booking accept hone ke baad dikhta hai.',
    );
  };

  const openGoogleReviews = () => {
    const query = encodeURIComponent(`${name} worker reviews Hyderabad`);
    Linking.openURL(`https://www.google.com/search?q=${query}`).catch(() => {});
  };

  const bookNow = () => {
    if (worker) router.push({ pathname: '/hire/[workerId]', params: { workerId: worker.id } });
  };

  return (
    <Screen padded={false} edges={['bottom']} header={<Header title="Worker Profile" showBack={false} />}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : error || !worker ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.errorText}>{error ?? 'Worker not found.'}</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* ---------------- Hero header ---------------- */}
            <View style={styles.hero}>
              <View style={styles.avatarRing}>
                <Avatar uri={workerUser?.avatar} name={name} size={108} />
                {workerUser?.isVerified ? (
                  <View style={styles.verifiedDot}>
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  </View>
                ) : null}
              </View>

              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {workerUser?.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={colors.star} />
                <Text style={styles.ratingValue}>{(worker.ratingAverage ?? 0).toFixed(1)}</Text>
                <Text style={styles.ratingMeta}>
                  ({worker.ratingCount} {worker.ratingCount === 1 ? 'review' : 'reviews'})
                </Text>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statPill}>
                  <Ionicons name="briefcase-outline" size={14} color={colors.primaryDark} />
                  <Text style={styles.statPillText}>
                    {worker.experience} {worker.experience === 1 ? 'yr' : 'yrs'} experience
                  </Text>
                </View>
                <View style={styles.statPill}>
                  <Ionicons name="checkmark-done-outline" size={14} color={colors.primaryDark} />
                  <Text style={styles.statPillText}>
                    {worker.completedJobs} jobs done
                  </Text>
                </View>
              </View>
            </View>

            {/* ---------------- Location ---------------- */}
            <View style={styles.locationCard}>
              <View style={styles.locationIconBox}>
                <Ionicons name="location" size={18} color={colors.primaryDark} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>
                  {workerUser?.locationArea
                    ? areaLabel(workerUser.locationArea)
                    : worker.serviceAreas?.[0]
                      ? areaLabel(worker.serviceAreas[0])
                      : 'Hyderabad'}
                  {workerUser?.locationCity ? `, ${workerUser.locationCity}` : ''}
                </Text>
                <Text style={styles.locationMeta}>
                  {distance != null ? `${distance} km from you` : 'Serves all Hyderabad areas'}
                </Text>
              </View>
            </View>

            {/* ---------------- Tabs ---------------- */}
            <View style={styles.tabTrack}>
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    style={[styles.tabPill, active && styles.tabPillActive]}
                    onPress={() => setTab(t.id)}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ---------------- About ---------------- */}
            {tab === 'about' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.aboutText}>
                  {worker.description || 'This worker has not added a description yet.'}
                </Text>

                <Text style={[styles.sectionTitle, styles.sectionGap]}>Skills</Text>
                <View style={styles.skillWrap}>
                  {(worker.skills?.length ?? 0) > 0 ? (
                    worker.skills.map((s) => (
                      <View key={s} style={styles.skillChip}>
                        <Ionicons
                          name={skillIconName(s) as keyof typeof Ionicons.glyphMap}
                          size={14}
                          color={colors.primaryDark}
                        />
                        <Text style={styles.skillChipText}>{skillLabel(s)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No skills added yet.</Text>
                  )}
                </View>

                <Text style={[styles.sectionTitle, styles.sectionGap]}>Availability</Text>
                <View style={styles.availabilityRow}>
                  <View
                    style={[
                      styles.availabilityDot,
                      worker.availability === 'available' && styles.availabilityDotOn,
                    ]}
                  />
                  <Text style={styles.availabilityText}>
                    {worker.availability === 'available'
                      ? 'Available for new work'
                      : worker.availability === 'busy'
                        ? 'Currently busy'
                        : 'Currently offline'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ---------------- Services ---------------- */}
            {tab === 'services' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Services &amp; Pricing</Text>
                {worker.skills.flatMap((s) => skillServices(s)).slice(0, 6).length > 0 ? (
                  worker.skills
                    .flatMap((s) => skillServices(s))
                    .slice(0, 6)
                    .map((svc, i) => (
                      <View key={`${svc.title}-${i}`} style={styles.serviceRow}>
                        <View style={styles.serviceIcon}>
                          <Ionicons
                            name={skillIconName(worker.skills[0] ?? '') as keyof typeof Ionicons.glyphMap}
                            size={16}
                            color={colors.primaryDark}
                          />
                        </View>
                        <View style={styles.serviceInfo}>
                          <Text style={styles.serviceTitle}>{svc.title}</Text>
                          <Text style={styles.serviceDesc}>{svc.desc}</Text>
                        </View>
                        <Text style={styles.servicePrice}>{formatCurrency(worker.hourlyRate)}</Text>
                      </View>
                    ))
                ) : (
                  <Text style={styles.emptyText}>
                    No service list yet — rate is {formatCurrency(worker.hourlyRate)} per hour.
                  </Text>
                )}
              </View>
            ) : null}

            {/* ---------------- Reviews ---------------- */}
            {tab === 'reviews' ? (
              <View style={styles.sectionCard}>
                <View style={styles.reviewsHead}>
                  <Text style={styles.sectionTitle}>
                    Reviews{worker.ratingCount > 0 ? ` (${worker.ratingCount})` : ''}
                  </Text>
                  {worker.ratingCount > 0 ? (
                    <Rating value={worker.ratingAverage} size={14} />
                  ) : (
                    <Pressable onPress={openGoogleReviews} hitSlop={8}>
                      <Text style={styles.googleLink}>See on Google ›</Text>
                    </Pressable>
                  )}
                </View>

                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <View key={review.id} style={styles.reviewCard}>
                      <Avatar
                        uri={review.reviewer?.avatar ?? null}
                        name={review.reviewer?.name ?? 'User'}
                        size={40}
                      />
                      <View style={styles.reviewBody}>
                        <View style={styles.reviewTop}>
                          <Text style={styles.reviewer} numberOfLines={1}>
                            {review.reviewer?.name ?? 'User'}
                          </Text>
                          <Text style={styles.reviewDate}>
                            {formatRelativeDate(review.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.reviewStars}>{generateStars(review.rating)}</Text>
                        {review.comment ? (
                          <Text style={styles.reviewComment}>{review.comment}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    Abhi koi review nahi hai. Pehla kaam aap karwao! 😊
                  </Text>
                )}

                {reviews.length > 0 ? (
                  <Pressable style={styles.googleBtn} onPress={openGoogleReviews}>
                    <Ionicons name="logo-google" size={18} color={colors.primaryDark} />
                    <Text style={styles.googleBtnText}>See reviews on Google</Text>
                    <Ionicons name="open-outline" size={16} color={colors.primaryDark} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* ---------------- Sticky bottom bar ---------------- */}
          <View style={styles.bottomBar}>
            <Pressable style={styles.callBtn} onPress={onCall}>
              <Ionicons name="call" size={18} color={colors.primaryDark} />
              <Text style={styles.callText}>Call</Text>
            </Pressable>
            <Pressable style={styles.bookNowBtn} onPress={bookNow}>
              <Ionicons name="calendar" size={18} color={colors.white} />
              <Text style={styles.bookNowText}>Book Now</Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  errorText: { marginTop: spacing.md, fontSize: fontSize.small, color: colors.textSecondary },

  // ---- Hero header ----
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  avatarRing: {
    padding: 5,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.white,
  },
  verifiedDot: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    maxWidth: '100%',
  },
  name: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  verifiedBadgeText: {
    fontSize: fontSize.caption - 2,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  ratingValue: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  ratingMeta: { fontSize: fontSize.caption, color: colors.textSecondary },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
  },
  statPillText: {
    fontSize: fontSize.caption - 2,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },

  // ---- Location card ----
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  locationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: { flex: 1 },
  locationText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  locationMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },

  // ---- Tabs (segmented control) ----
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.pill },
  tabPillActive: { backgroundColor: colors.primaryDark },
  tabText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  tabTextActive: { color: colors.white },

  // ---- Section cards ----
  sectionCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionGap: { marginTop: spacing.lg },
  emptyText: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },

  // ---- About ----
  aboutText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
  },
  skillChipText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.primaryDark },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  availabilityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.muted },
  availabilityDotOn: { backgroundColor: colors.success },
  availabilityText: { fontSize: fontSize.caption, color: colors.textPrimary, fontWeight: fontWeight.medium },

  // ---- Services ----
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  serviceDesc: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  /** Service price — green, right-aligned like the reference design. */
  servicePrice: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },

  // ---- Reviews ----
  reviewsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  googleLink: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  reviewCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  reviewBody: { flex: 1 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewer: { flex: 1, fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  reviewDate: { fontSize: fontSize.caption - 2, color: colors.muted },
  reviewComment: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  reviewStars: { fontSize: fontSize.small, color: colors.star, marginTop: 3, letterSpacing: 2 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  googleBtnText: { flex: 1, fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.primaryDark },

  // ---- Sticky bottom bar ----
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    backgroundColor: colors.white,
  },
  callText: { fontSize: fontSize.small, fontWeight: fontWeight.bold, color: colors.primaryDark },
  bookNowBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
    ...shadows.button,
  },
  bookNowText: { fontSize: fontSize.small, fontWeight: fontWeight.bold, color: colors.white },
});
