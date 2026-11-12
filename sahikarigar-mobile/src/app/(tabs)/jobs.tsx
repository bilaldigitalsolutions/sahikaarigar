import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState, HireCard, Screen } from '@/components';
import {
  getWorkerDashboard,
  hireAction,
  setWorkerAvailability,
  type ApiHire,
  type ApiWorkerDashboard,
} from '@/lib/api';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
import {
  formatCurrency,
  formatRatingSummary,
  formatRelativeDate,
  getWorkerBadge,
  workerBadgeTone,
} from '@/utils';

/**
 * "My Work" — the kaarigar's own dashboard: availability switch, headline stats
 * and the three job buckets (new requests, in progress, recently completed).
 *
 * The tab is only added for users with `role === 'worker'` (see `(tabs)/_layout`),
 * but the screen guards itself too in case it is opened another way.
 */
export default function WorkerJobsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<ApiWorkerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** `'availability'` while the switch saves, otherwise the hire id in flight. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getWorkerDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.couldNotLoadJobs'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Keep the worker dashboard (new requests / active jobs) live while the
      // tab is open; otherwise a status change can look one step behind.
      const timer = setInterval(() => {
        void load();
      }, 5000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const onToggleAvailability = async (next: boolean) => {
    if (!data?.worker) return;
    setBusy('availability');
    setError(null);
    try {
      const { worker } = await setWorkerAvailability(next ? 'available' : 'offline');
      setData((prev) =>
        prev
          ? {
              ...prev,
              worker: worker ?? { ...prev.worker!, availability: next ? 'available' : 'offline' },
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.couldNotUpdateAvailability'));
    } finally {
      setBusy(null);
    }
  };

  const onRequestAction = async (hireId: string, action: 'accept' | 'reject') => {
    setBusy(hireId);
    setError(null);
    try {
      await hireAction(hireId, action);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : t('dashboard.couldNotUpdateRequest');
      setError(message);
      // Edge case: the worker accepted another request from a second device
      // (or the dashboard JSON is a moment stale) — the server answers with
      // 400 "You already have an active job…". Show a clean alert and refresh
      // so the busy banner / disabled buttons line up again.
      if (/already have an active job/i.test(message)) {
        Alert.alert(t('dashboard.duplicateActiveJobTitle'), t('dashboard.duplicateActiveJobMsg'));
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      </Screen>
    );
  }

  // Not registered as a kaarigar yet.
  if (!data?.isWorker || !data.worker) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>{t('dashboard.myWork')}</Text>
        <EmptyState
          icon="briefcase-outline"
          title={t('dashboard.notWorkerTitle')}
          subtitle={t('dashboard.notWorkerSub')}
        />
        <Button label={t('profile.joiningAs')} onPress={() => router.push('/register-worker')} />
      </Screen>
    );
  }

  const worker = data.worker;
  const stats = data.stats;
  const isAvailable = worker.availability === 'available';
  const workerBadge = getWorkerBadge(worker);
  const performanceScore = Math.round(
    Number(stats?.systemRatingScore ?? worker.systemRatingScore ?? 0),
  );
  /** Business rule: a worker can hold exactly ONE active job at a time. */
  const isWorkerBusy = data.active.length > 0;

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <Text style={styles.heading}>{t('dashboard.myWork')}</Text>
        <Text style={styles.sub}>
          {formatCurrency(worker.hourlyRate)}{t('hireDetail.ratePerHourShort')} · {t('workerScreen.experienceYears', { count: worker.experience })}
        </Text>

        {/* Availability switch */}
        <Card style={styles.card}>
          <View style={styles.availRow}>
            <View style={styles.availIcon}>
              <Ionicons
                name={isAvailable ? 'radio-button-on' : 'pause-circle-outline'}
                size={26}
                color={isAvailable ? colors.primaryDark : colors.textSecondary}
              />
            </View>
            <View style={styles.availText}>
              <Text style={styles.availTitle}>
                {isAvailable ? t('availability.availableTitle') : t('availability.notAvailableTitle')}
              </Text>
              <Text style={styles.availSub}>
                {isAvailable
                  ? t('availability.availableSub')
                  : t('availability.notAvailableSub')}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={onToggleAvailability}
              disabled={busy === 'availability'}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        {!worker.isApproved ? (
          <Card style={[styles.card, styles.approvalCard]}>
            <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
            <Text style={styles.approvalText}>
              {t('dashboard.adminApprovalPending')}
            </Text>
          </Card>
        ) : null}

        {/* Headline stats */}
        <View style={styles.statsGrid}>
          <StatTile
            icon="mail-unread-outline"
            label={t('dashboard.newRequests')}
            value={String(stats?.pending ?? 0)}
          />
          <StatTile icon="construct-outline" label={t('common.inProgress')} value={String(stats?.active ?? 0)} />
          <StatTile
            icon="checkmark-done-outline"
            label={t('dashboard.jobsDone')}
            value={String(stats?.lifetimeJobs ?? 0)}
          />
          <StatTile
            icon="cash-outline"
            label={t('dashboard.estEarnings')}
            value={formatCurrency(stats?.estimatedEarnings ?? 0)}
          />
        </View>

        {stats && stats.ratingCount > 0 ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.ratingText}>
              {stats.ratingAverage.toFixed(1)} · {t('dashboard.reviewCount', { count: stats.ratingCount })}
            </Text>
          </View>
        ) : null}

        <Card style={styles.performanceCard}>
          <View style={styles.performanceInfo}>
            <Text style={styles.performanceLabel}>{t('dashboard.performanceScore')}</Text>
            <Text style={styles.performanceValue}>{t('dashboard.performanceValue', { percent: performanceScore })}</Text>
            <Text style={styles.performanceMeta}>
              {stats && stats.totalJobsCompleted > 0
                ? t('dashboard.onTimeMeta', { onTime: stats.onTimeJobs, total: stats.totalJobsCompleted })
                : t('dashboard.noJobsScoreHint')}
            </Text>
          </View>
          <Badge label={t('dashboard.badgeWorker', { badge: workerBadge })} tone={workerBadgeTone(workerBadge)} />
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* One-active-job banner: Accept is disabled while a job is running. */}
        {isWorkerBusy ? (
          <View style={styles.busyBanner}>
            <Ionicons name="information-circle" size={20} color={colors.textPrimary} />
            <Text style={styles.busyBannerText}>{t('dashboard.busyOneJobBanner')}</Text>
          </View>
        ) : null}

        <Section
          title={t('dashboard.newRequests')}
          count={data.requests.length}
          empty={t('dashboard.noNewRequestsHint')}
        >
          {data.requests.map((hire) => (
            <RequestCard
              key={hire.id}
              hire={hire}
              onPress={() => router.push({ pathname: '/hire/detail/[id]', params: { id: hire.id } })}
              acceptDisabled={isWorkerBusy || busy === hire.id}
              acceptBusy={busy === hire.id}
              rejectDisabled={busy === hire.id}
              onAccept={() => onRequestAction(hire.id, 'accept')}
              onReject={() => onRequestAction(hire.id, 'reject')}
            />
          ))}
        </Section>

        <Section
          title={t('common.inProgress')}
          count={data.active.length}
          empty={t('dashboard.activeJobsEmptySub')}
        >
          {data.active.map((hire) => (
            <JobRow
              key={hire.id}
              hire={hire}
              onPress={() => router.push({ pathname: '/hire/detail/[id]', params: { id: hire.id } })}
            />
          ))}
        </Section>

        <Section
          title={t('dashboard.recentlyCompleted')}
          count={data.completed.length}
          empty={t('dashboard.completedEmptySub')}
        >
          {data.completed.map((hire) => (
            <JobRow
              key={hire.id}
              hire={hire}
              onPress={() => router.push({ pathname: '/hire/detail/[id]', params: { id: hire.id } })}
            />
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

/** One tile in the 2×2 headline-stats grid. */
function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Titled bucket with a count badge and an empty hint. */
function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count > 0 ? <Badge label={String(count)} tone="primary" /> : null}
      </View>
      {count > 0 ? children : <Text style={styles.sectionEmpty}>{empty}</Text>}
    </View>
  );
}

/**
 * Pending booking request card — Rapido/Porter reference design:
 *   ┌ white card, thick brand-green border ───────────────┐
 *   │ ₹240  Just now                                       │
 *   │  •  Worker's Area                        ← pickup    │
 *   │  |  (service location)                               │
 *   │  ↓  Customer's Address                   ← drop      │
 *   └──────────────────────────────────────────────────────┘
 *   [ (X) circle ]   [  Accept  — solid green pill  ]
 */
function RequestCard({
  hire,
  onPress,
  acceptDisabled,
  acceptBusy,
  rejectDisabled,
  onAccept,
  onReject,
}: {
  hire: ApiHire;
  onPress: () => void;
  acceptDisabled: boolean;
  acceptBusy: boolean;
  rejectDisabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const price = formatCurrency(hire.proposedRate);
  const time = formatRelativeDate(hire.createdAt, t);

  // Pickup = the kaarigar's own service area; drop = the customer's address.
  const workerUser = hire.worker?.user ?? null;
  const pickupMain = workerUser?.locationArea ?? t('dashboard.yourArea');
  const pickupSub = workerUser?.locationCity ?? t('dashboard.yourServiceLocation');

  const dropParts = hire.location.split(',').map((part) => part.trim()).filter(Boolean);
  const dropMain = dropParts[0] ?? t('dashboard.customerLocation');
  const dropSub = dropParts.slice(1).join(', ') || t('dashboard.tapFullAddress');

  return (
    <View style={styles.requestCard}>
      <Pressable onPress={onPress}>
        {/* Header — big bold price + relative time. */}
        <View style={styles.requestHeader}>
          <Text style={styles.requestPrice}>{price}</Text>
          <Text style={styles.requestTime}>{time}</Text>
        </View>

        <View style={styles.customerRow}>
          <Ionicons name="person-circle-outline" size={17} color={colors.textSecondary} />
          <View style={styles.customerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {hire.employer?.name ?? t('common.customer')}
            </Text>
            <Text style={styles.customerRating} numberOfLines={1}>
              {t('rating.customerLabel')}: {formatRatingSummary(hire.customerRating, t)}
            </Text>
          </View>
        </View>

        {/* Pickup → drop rail: dot on top, arrow at the bottom. */}
        <View style={styles.routeRow}>
          <View style={styles.routeRail}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <Ionicons name="arrow-down" size={13} color={colors.muted} />
          </View>
          <View style={styles.routePoints}>
            <View style={styles.routePoint}>
              <Text style={styles.routeMain} numberOfLines={1}>
                {pickupMain}
              </Text>
              <Text style={styles.routeSub} numberOfLines={1}>
                {pickupSub}
              </Text>
            </View>
            <View style={styles.routeSpacer} />
            <View style={styles.routePoint}>
              <Text style={styles.routeMain} numberOfLines={1}>
                {dropMain}
              </Text>
              <Text style={styles.routeSub} numberOfLines={2}>
                {dropSub}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Actions — circular grey Reject (X) + wide solid-green Accept pill. */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.rejectBtn, rejectDisabled && styles.rejectBtnDisabled]}
          disabled={rejectDisabled}
          onPress={onReject}
          accessibilityLabel={t('dashboard.rejectRequestA11y')}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          style={[styles.acceptBtn, acceptDisabled && styles.acceptBtnDisabled]}
          disabled={acceptDisabled}
          onPress={onAccept}
          accessibilityLabel={t('dashboard.acceptRequestA11y')}
        >
          {acceptBusy ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.acceptText, acceptDisabled && styles.acceptTextDisabled]}>
              {t('hireDetail.accept')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** An accepted / completed job row. */
function JobRow({ hire, onPress }: { hire: ApiHire; onPress: () => void }) {
  return <HireCard hire={hire} perspective="worker" onPress={onPress} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.xs },

  card: { marginTop: spacing.lg },

  availRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availText: { flex: 1 },
  availTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  availSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },

  approvalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderColor: colors.warning,
  },
  approvalText: { flex: 1, fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 19 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 2,
  },
  statValue: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.caption, color: colors.textSecondary },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  ratingText: { fontSize: fontSize.caption, color: colors.textSecondary },

  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  performanceInfo: { flex: 1 },
  performanceLabel: {
    fontSize: fontSize.caption - 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  performanceValue: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
    marginTop: 2,
  },
  performanceMeta: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },

  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.md },

  section: { marginTop: spacing.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  sectionEmpty: { fontSize: fontSize.caption, color: colors.textSecondary },

  // ---- Request card (Rapido/Porter reference) ----
  // White card with a prominent thick brand-green border: big price + time on
  // top, a vertical pickup→drop rail in the middle, then the circular grey
  // Reject (X) and the wide solid-green Accept pill at the bottom.
  requestCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  requestPrice: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  requestTime: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    paddingBottom: 3,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  customerRating: {
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
    marginTop: 1,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    minHeight: 96,
  },
  routeRail: {
    width: 18,
    alignItems: 'center',
    paddingVertical: 2,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.textPrimary,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  routePoints: { flex: 1 },
  routePoint: {},
  routeMain: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  routeSub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  routeSpacer: { flex: 1, minHeight: spacing.xl },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  rejectBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  rejectBtnDisabled: { opacity: 0.5 },
  acceptBtnDisabled: { backgroundColor: colors.border },
  acceptTextDisabled: { color: colors.muted },

  // One-active-job banner
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.warning,
  },
  busyBannerText: {
    flex: 1,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: 19,
  },
});
