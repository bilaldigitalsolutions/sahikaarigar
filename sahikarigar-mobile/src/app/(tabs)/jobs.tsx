import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState, HireCard, Screen } from '@/components';
import {
  getWorkerDashboard,
  hireAction,
  sendTestPush,
  setWorkerAvailability,
  type ApiHire,
  type ApiWorkerDashboard,
} from '@/lib/api';
import { onHirePush } from '@/lib/notifications';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
import {
  formatCurrency,
  formatRatingSummary,
  formatRelativeDate,
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
  /** Non-empty = the search filter is active (matches every job bucket). */
  const [query, setQuery] = useState('');

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
      // A hire push arrived (or a tray notification was tapped) — refresh
      // immediately so a new request shows up the moment it exists, without
      // waiting for the next poll tick or a manual pull-to-refresh.
      const offHirePush = onHirePush(() => {
        void load();
      });
      // App resumed from background — refresh right away. JS timers pause
      // while backgrounded, so the first poll tick would otherwise be up to
      // 5s late exactly when the worker is looking at the screen again.
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      // Keep the worker dashboard (new requests / active jobs) live while the
      // tab is open; otherwise a status change can look one step behind.
      const timer = setInterval(() => {
        void load();
      }, 5000);
      return () => {
        offHirePush();
        appStateSub.remove();
        clearInterval(timer);
      };
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

  const onTestPush = async () => {
    setBusy('test');
    try {
      const result = await sendTestPush();
      Alert.alert(
        t('dashboard.testPushTitle'),
        result.sent > 0 ? t('dashboard.testPushSentHint') : t('dashboard.testPushFailedHint'),
      );
    } catch (e) {
      // The server answers 400 with a direct Hinglish reason (no push token on
      // file / delivery failed) — show it as-is so the fix is obvious.
      const message = e instanceof Error ? e.message : '';
      Alert.alert(t('dashboard.testPushTitle'), message || t('dashboard.testPushFailedHint'));
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
  /** Business rule: a worker can hold exactly ONE active job at a time. */
  const isWorkerBusy = data.active.length > 0;

  // Search across ALL buckets (new requests, active, completed) by customer
  // name, address or work description — so a worker can settle a "kaun tha /
  // kya kaam tha" dispute by finding the exact job.
  const q = query.trim().toLowerCase();
  const matchesQuery = (hire: ApiHire): boolean => {
    if (!q) return true;
    return [hire.employer?.name, hire.location, hire.homeLocation, hire.description].some(
      (field) => typeof field === 'string' && field.toLowerCase().includes(q),
    );
  };
  const requests = data.requests.filter(matchesQuery);
  const activeJobs = data.active.filter(matchesQuery);
  // Completed rows arrive newest-first from the API; re-sort defensively so
  // "latest 5" really is the latest even if the server order ever changes.
  const completedSorted = [...data.completed].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  // Normal browsing keeps the list light (latest 5); an active search shows
  // ALL matches instead — that's the point of searching.
  const completed = q ? completedSorted.filter(matchesQuery) : completedSorted.slice(0, 5);
  const searchMissedEverything =
    q.length > 0 && requests.length === 0 && activeJobs.length === 0 && completed.length === 0;

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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

        {/* Headline stats — Rapido-style tinted tiles so each bucket reads at
            a glance: amber = waiting, blue = running, green = done, red = cancelled. */}
        <View style={styles.statsGrid}>
          <StatTile
            icon="mail-unread-outline"
            label={t('dashboard.newRequests')}
            value={String(stats?.pending ?? 0)}
            tint={TILE_TINTS.pending}
          />
          <StatTile
            icon="construct-outline"
            label={t('common.inProgress')}
            value={String(stats?.active ?? 0)}
            tint={TILE_TINTS.active}
          />
          <StatTile
            icon="checkmark-done-outline"
            label={t('dashboard.jobsDone')}
            value={String(stats?.lifetimeJobs ?? 0)}
            tint={TILE_TINTS.done}
          />
          <StatTile
            icon="close-circle-outline"
            label={t('dashboard.cancelledJobs')}
            value={String(stats?.cancelled ?? 0)}
            tint={TILE_TINTS.cancelled}
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

        {/* Search — customer / address / kaam; matches every bucket below. */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('dashboard.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('dashboard.clearSearch')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* One-tap push self-test: the server sends a REAL push to THIS device,
            so the whole chain (server → Expo → FCM V1 → phone) can be verified
            with a single tap — no second phone, no test booking needed. */}
        <Pressable
          style={styles.testPushBtn}
          onPress={onTestPush}
          disabled={busy === 'test'}
          accessibilityLabel={t('dashboard.testPushBtn')}
        >
          {busy === 'test' ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Ionicons name="notifications-outline" size={17} color={colors.primaryDark} />
          )}
          <Text style={styles.testPushText}>{t('dashboard.testPushBtn')}</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* One-active-job banner: Accept is disabled while a job is running. */}
        {isWorkerBusy ? (
          <View style={styles.busyBanner}>
            <Ionicons name="information-circle" size={20} color={colors.textPrimary} />
            <Text style={styles.busyBannerText}>{t('dashboard.busyOneJobBanner')}</Text>
          </View>
        ) : null}

        {searchMissedEverything ? (
          <EmptyState icon="search-outline" title={t('dashboard.noSearchResults')} />
        ) : null}

        <Section
          title={t('dashboard.newRequests')}
          count={requests.length}
          empty={t('dashboard.noNewRequestsHint')}
          hide={q.length > 0 && requests.length === 0}
        >
          {requests.map((hire) => (
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
          count={activeJobs.length}
          empty={t('dashboard.activeJobsEmptySub')}
          hide={q.length > 0 && activeJobs.length === 0}
        >
          {activeJobs.map((hire) => (
            <JobRow
              key={hire.id}
              hire={hire}
              onPress={() => router.push({ pathname: '/hire/detail/[id]', params: { id: hire.id } })}
            />
          ))}
        </Section>

        {/* Badge = lifetime completed count; the list itself shows the latest
            5 (all matches while searching). */}
        <Section
          title={t('dashboard.recentlyCompleted')}
          count={q ? completed.length : data.completed.length}
          empty={t('dashboard.completedEmptySub')}
          hide={q.length > 0 && completed.length === 0}
        >
          {completed.map((hire) => (
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

/** Rapido-style tint per stat bucket — colour says the state at a glance. */
const TILE_TINTS = {
  pending: { bg: '#FEF3C7', border: '#FDE68A', icon: '#B45309' }, // amber — waiting on the worker
  active: { bg: '#DBEAFE', border: '#BFDBFE', icon: '#1D4ED8' }, // blue — job running
  done: { bg: colors.primaryBg, border: colors.primaryBorder, icon: colors.primaryDark }, // green — finished
  cancelled: { bg: '#FEE2E2', border: '#FECACA', icon: '#B91C1C' }, // red — cancelled
} as const;

/** One tile in the 2×2 headline-stats grid (earnings tile stays neutral). */
function StatTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint?: { bg: string; border: string; icon: string };
}) {
  return (
    <View
      style={[
        styles.statTile,
        tint ? { backgroundColor: tint.bg, borderColor: tint.border } : null,
      ]}
    >
      <Ionicons name={icon} size={18} color={tint?.icon ?? colors.primaryDark} />
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
  hide,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  /** While searching, buckets without a match vanish instead of showing their empty hint. */
  hide?: boolean;
  children: ReactNode;
}) {
  if (hide) return null;
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
    flexBasis: '46%',
    minHeight: 104,
    padding: spacing.lg,
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

  // ---- Search bar ----
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 24,
  },

  // ---- Push self-test button ----
  testPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  testPushText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
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
