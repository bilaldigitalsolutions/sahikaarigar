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
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { calculateDistance, formatCurrency, formatRelativeDate, generateStars } from '@/utils';

type Tab = 'about' | 'services';

const TABS: { id: Tab; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
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
    const phone = workerUser?.phone;
    if (!phone) {
      Alert.alert('Number hidden', 'The number is revealed once the booking is accepted.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const openGoogleReviews = () => {
    const query = encodeURIComponent(`${name} worker reviews Hyderabad`);
    Linking.openURL(`https://www.google.com/search?q=${query}`).catch(() => {});
  };

  const bookNow = () => {
    if (worker) router.push({ pathname: '/hire/[workerId]', params: { workerId: worker.id } });
  };

  return (
    <Screen padded={false} edges={['bottom']} header={<Header title="Worker Profile" />}>
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
          <View style={styles.profileHeader}>
            <Avatar uri={workerUser?.avatar} name={name} size={104} />
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
              {workerUser?.isVerified ? (
                <View style={styles.verified}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.white} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingValue}>{worker.ratingAverage.toFixed(1)}</Text>
              <Rating value={worker.ratingAverage} size={15} />
              <Text style={styles.ratingMeta}>
                {worker.experience} yrs experience
              </Text>
            </View>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <Pressable key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
                </Pressable>
              );
            })}
          </View>

            {tab === 'services' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Services & Pricing</Text>
                {worker.skills
                  .flatMap((s) => skillServices(s))
                  .slice(0, 6)
                  .map((svc, i) => (
                    <View key={`${svc.title}-${i}`} style={styles.serviceRow}>
                      <View style={styles.serviceIcon}>
                        <Ionicons name="construct" size={18} color={colors.white} />
                      </View>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceTitle}>{svc.title}</Text>
                        <Text style={styles.serviceDesc}>{svc.desc}</Text>
                      </View>
                      <Text style={styles.servicePrice}>{formatCurrency(worker.hourlyRate)}</Text>
                    </View>
                  ))}
              </View>
            ) : null}

            {tab === 'about' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.aboutText}>
                  {worker.description || 'This worker has not added a description yet.'}
                </Text>
                <Text style={[styles.sectionTitle, styles.mt]}>Skills</Text>
                <View style={styles.skillWrap}>
                  {worker.skills.map((s) => (
                    <View key={s} style={styles.skillChip}>
                      <Ionicons
                        name={skillIconName(s) as keyof typeof Ionicons.glyphMap}
                        size={14}
                        color={colors.primaryDark}
                      />
                      <Text style={styles.skillChipText}>{skillLabel(s)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={18} color={colors.primaryDark} />
                <Text style={styles.locationText}>
                  {workerUser?.locationArea ? areaLabel(workerUser.locationArea) : 'Hyderabad'}
                  {workerUser?.locationCity ? `, ${workerUser.locationCity}` : ''}
                  {distance != null ? ` • ${distance} km away` : ''}
                </Text>
              </View>
            </View>

            {/* Reviews — in-app list straight from the API (matches the design's
                "Recent reviews" cards), with Google kept as a secondary source. */}
            <View style={styles.section}>
              <View style={styles.reviewsHead}>
                <Text style={styles.sectionTitle}>
                  Reviews{worker.ratingCount > 0 ? ` (${worker.ratingCount})` : ''}
                </Text>
                {worker.ratingCount > 0 ? (
                  <View style={styles.reviewScore}>
                    <Text style={styles.reviewScoreValue}>{worker.ratingAverage.toFixed(1)}</Text>
                    <Ionicons name="star" size={13} color={colors.warning} />
                  </View>
                ) : (
                  <Pressable onPress={openGoogleReviews} hitSlop={8}>
                    <Text style={styles.recentLink}>See on Google</Text>
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
                        <Text style={styles.reviewer}>{review.reviewer?.name ?? 'User'}</Text>
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
                <Text style={styles.reviewEmpty}>
                  Abhi koi review nahi hai. Pehla kaam aap karwao! 😊
                </Text>
              )}

              <Pressable style={styles.googleBtn} onPress={openGoogleReviews}>
                <Ionicons name="logo-google" size={18} color={colors.primaryDark} />
                <Text style={styles.googleBtnText}>See reviews on Google</Text>
                <Ionicons name="open-outline" size={16} color={colors.primaryDark} />
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Pressable style={styles.callBtn} onPress={onCall}>
              <Ionicons name="call" size={18} color={colors.primaryDark} />
              <Text style={styles.callText}>Call</Text>
            </Pressable>
            <Pressable style={styles.bookNowBtn} onPress={bookNow}>
              <Ionicons name="calendar" size={18} color={colors.white} />
              <Text style={styles.bookNowText}>Hire</Text>
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
  profileHeader: { alignItems: 'center', marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  name: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  verifiedText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.white },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  ratingValue: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  ratingMeta: { fontSize: fontSize.caption, color: colors.textSecondary },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabText: { fontSize: fontSize.small, fontWeight: fontWeight.medium, color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
  tabUnderline: { height: 2, width: '55%', marginTop: spacing.sm, borderRadius: 1 },
  tabUnderlineActive: { backgroundColor: colors.primaryDark },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  mt: { marginTop: spacing.lg },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  serviceDesc: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  servicePrice: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.primaryDark },
  aboutText: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 },
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  locationText: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary },
  reviewsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentLink: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
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
  reviewCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  reviewBody: { flex: 1 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewer: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  reviewDate: { fontSize: fontSize.caption, color: colors.textSecondary },
  reviewComment: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 19 },
  reviewStars: { fontSize: fontSize.small, color: colors.warning, marginTop: 3, letterSpacing: 2 },
  reviewEmpty: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 19 },
  reviewScore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewScoreValue: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
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
  callText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  bookNowBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  bookNowText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.white },
});


