import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
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

import { Avatar, Badge, Button, Card, EmptyState, HireCard, ModeSwitch, Screen } from '@/components';
import { skillIconName, skillLabel } from '@/constants';
import {
  getWorkerDashboard,
  hireAction,
  setWorkerAvailability,
  type ApiHire,
  type ApiWorkerDashboard,
} from '@/lib/api';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
import { formatCurrency, formatRelativeDate } from '@/utils';

/**
 * "My Work" — the kaarigar's own dashboard: availability switch, headline stats
 * and the three job buckets (new requests, in progress, recently completed).
 *
 * The tab is only added for users with `role === 'worker'` (see `(tabs)/_layout`),
 * but the screen guards itself too in case it is opened another way.
 */
export default function WorkerJobsScreen() {
  const router = useRouter();
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
      setError(e instanceof Error ? e.message : 'Could not load your work dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
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
      setError(e instanceof Error ? e.message : 'Could not update availability.');
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
      const message = e instanceof Error ? e.message : 'Could not update the request.';
      setError(message);
      // Edge case: the worker accepted another request from a second device
      // (or the dashboard JSON is a moment stale) — the server answers with
      // 400 "You already have an active job…". Show a clean alert and refresh
      // so the busy banner / disabled buttons line up again.
      if (/already have an active job/i.test(message)) {
        Alert.alert('Request accept nahi hui', 'Aapke paas pehle se ek active job hai.');
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
        <Text style={styles.heading}>My Work</Text>
        <EmptyState
          icon="briefcase-outline"
          title="Aap abhi kaarigar nahi ho"
          subtitle="Skills aur area add karo — phir yahan naye kaam ke requests aayenge."
        />
        <Button label="Join as Kaarigar" onPress={() => router.push('/register-worker')} />
      </Screen>
    );
  }

  const worker = data.worker;
  const stats = data.stats;
  const isAvailable = worker.availability === 'available';
  /** Business rule: a worker can hold exactly ONE active job at a time. */
  const isWorkerBusy = data.active.length > 0;

  return (
    <Screen
      scroll={false}
      padded={false}
      // Same Customer ⇄ Kaarigar switch as the home screen. Without it the
      // worker side would have no way back to customer mode (the Home tab is
      // hidden in worker mode).
      header={<ModeSwitch style={styles.modeSwitch} />}
    >
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
        <Text style={styles.heading}>My Work</Text>
        <Text style={styles.sub}>
          {formatCurrency(worker.hourlyRate)}/hr · {worker.experience} yrs experience
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
                {isAvailable ? 'Available for work' : 'Not taking work'}
              </Text>
              <Text style={styles.availSub}>
                {isAvailable
                  ? 'Customers can send you booking requests.'
                  : 'Aap naye booking requests nahi paoge.'}
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
              Aapka profile admin approval ka intezaar kar raha hai. Approve hone tak aap search
              results me nahi dikhoge.
            </Text>
          </Card>
        ) : null}

        {/* Headline stats */}
        <View style={styles.statsGrid}>
          <StatTile
            icon="mail-unread-outline"
            label="New requests"
            value={String(stats?.pending ?? 0)}
          />
          <StatTile icon="construct-outline" label="In progress" value={String(stats?.active ?? 0)} />
          <StatTile
            icon="checkmark-done-outline"
            label="Jobs done"
            value={String(stats?.lifetimeJobs ?? 0)}
          />
          <StatTile
            icon="cash-outline"
            label="Est. earnings"
            value={formatCurrency(stats?.estimatedEarnings ?? 0)}
          />
        </View>

        {stats && stats.ratingCount > 0 ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.ratingText}>
              {stats.ratingAverage.toFixed(1)} · {stats.ratingCount}{' '}
              {stats.ratingCount === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* One-active-job banner: Accept is disabled while a job is running. */}
        {isWorkerBusy ? (
          <View style={styles.busyBanner}>
            <Ionicons name="information-circle" size={20} color={colors.textPrimary} />
            <Text style={styles.busyBannerText}>
              Aap abhi ek kaam par hain. Naya kaam accept karne ke liye pehle use complete karein.
            </Text>
          </View>
        ) : null}

        <Section
          title="New requests"
          count={data.requests.length}
          empty="Abhi koi naya request nahi hai. Available raho — customers aapko dhundhenge."
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
          title="In progress"
          count={data.active.length}
          empty="Koi kaam chal raha ho to yahan dikhega."
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
          title="Recently completed"
          count={data.completed.length}
          empty="Complete hue kaam yahan aayenge."
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
 * Pending booking request card — matches the reference design:
 *   [SAHIKAARIGAR • BOOKING REQUEST]          (small caps label on green)
 *   ┌ white card ─────────────────────────────┐
 *   │ avatar  Name                (• Pending)  │
 *   │ ⚡  Skill - work description              │
 *   │ ₹ rate   📍 location   🕐 relative time  │
 *   └──────────────────────────────────────────┘
 *   [ ✕ Reject (red) ]   [ ✓ Accept (green) ]
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
  const employer = hire.employer;
  const primarySkill = hire.worker?.skills?.[0] ?? '';
  const serviceName = primarySkill
    ? `${skillLabel(primarySkill)} - ${hire.description}`
    : hire.description;

  return (
    <View style={styles.requestCard}>
      <Text style={styles.requestLabel}>SAHIKAARIGAR • BOOKING REQUEST</Text>

      {/* White inner card — pressable to open the full detail screen. */}
      <Pressable style={styles.requestInner} onPress={onPress}>
        <View style={styles.requestHeader}>
          <Avatar uri={employer?.avatar ?? null} name={employer?.name ?? 'User'} size={46} />
          <Text style={styles.requestName} numberOfLines={1}>
            {employer?.name ?? 'User'}
          </Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        <View style={styles.requestServiceRow}>
          <View style={styles.serviceIconBox}>
            <Ionicons
              name={skillIconName(primarySkill) as keyof typeof Ionicons.glyphMap}
              size={15}
              color={colors.primaryDark}
            />
          </View>
          <Text style={styles.requestService}>{serviceName}</Text>
        </View>

        <View style={styles.tagRow}>
          <RequestTag icon="cash-outline" text={formatCurrency(hire.proposedRate)} />
          <RequestTag icon="location" text={hire.location} />
          <RequestTag icon="time-outline" text={formatRelativeDate(hire.createdAt)} />
        </View>
      </Pressable>

      <RequestActions
        acceptDisabled={acceptDisabled}
        acceptBusy={acceptBusy}
        rejectDisabled={rejectDisabled}
        onAccept={onAccept}
        onReject={onReject}
      />
    </View>
  );
}

/** One soft-green icon + label tag under the service line. */
function RequestTag({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.requestTag}>
      <View style={styles.tagIconBox}>
        <Ionicons name={icon} size={12} color={colors.primaryDark} />
      </View>
      <Text style={styles.tagText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The two prominent per-request actions (matched to the reference):
 *   Accept — solid green (#10B981) + checkmark
 *   Reject — solid red (#EF4444) + cross
 * When the worker is busy, Accept greys out and does nothing.
 */
function RequestActions({
  acceptDisabled,
  acceptBusy,
  rejectDisabled,
  onAccept,
  onReject,
}: {
  acceptDisabled: boolean;
  acceptBusy: boolean;
  rejectDisabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.rejectBtn, rejectDisabled && styles.actionBtnDisabled]}
        disabled={rejectDisabled}
        onPress={onReject}
        accessibilityLabel="Reject this request"
      >
        <Ionicons name="close" size={16} color={colors.white} />
        <Text style={[styles.rejectText, rejectDisabled && styles.actionTextDisabled]}>Reject</Text>
      </Pressable>
      <Pressable
        style={[styles.acceptBtn, acceptDisabled && styles.actionBtnDisabled]}
        disabled={acceptDisabled}
        onPress={onAccept}
        accessibilityLabel="Accept this request"
      >
        {acceptBusy ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="checkmark" size={16} color={colors.white} />
        )}
        <Text style={[styles.acceptText, acceptDisabled && styles.actionTextDisabled]}>
          Accept
        </Text>
      </Pressable>
    </View>
  );
}

/** An accepted / completed job row. */
function JobRow({ hire, onPress }: { hire: ApiHire; onPress: () => void }) {
  return <HireCard hire={hire} perspective="worker" onPress={onPress} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  modeSwitch: { marginTop: spacing.lg, marginHorizontal: spacing.lg },
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

  // ---- Request card (reference design) ----
  // Soft green container; a white inner card holds the details; the two big
  // action buttons sit below the white card, on the green background.
  requestCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  requestLabel: {
    fontSize: fontSize.caption - 4,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  requestInner: {
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: spacing.md,
    ...shadows.card,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  requestName: {
    flex: 1,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning + '26',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  statusText: {
    fontSize: fontSize.caption - 2,
    fontWeight: fontWeight.semibold,
    color: '#A16207',
  },
  requestServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  serviceIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestService: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  requestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  tagIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: fontSize.caption - 2,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

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

  // Accept (green + check) / Reject (red + X) — big and bold like the reference
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radius.button,
    backgroundColor: '#10B981',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radius.button,
    backgroundColor: '#EF4444',
  },
  actionBtnDisabled: { backgroundColor: colors.border },
  acceptText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  rejectText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  actionTextDisabled: { color: colors.muted },
});
