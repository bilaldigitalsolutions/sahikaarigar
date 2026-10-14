import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState, HireCard, ModeSwitch, Screen } from '@/components';
import {
  getWorkerDashboard,
  hireAction,
  setWorkerAvailability,
  type ApiHire,
  type ApiWorkerDashboard,
} from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils';

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
      setError(e instanceof Error ? e.message : 'Could not update the request.');
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

        <Section
          title="New requests"
          count={data.requests.length}
          empty="Abhi koi naya request nahi hai. Available raho — customers aapko dhundhenge."
        >
          {data.requests.map((hire) => (
            <View key={hire.id} style={styles.requestCard}>
              <RequestRow hire={hire} onPress={() => router.push({ pathname: '/hire/detail/[id]', params: { id: hire.id } })} />
              <View style={styles.actions}>
                <Button
                  label="Reject"
                  variant="secondary"
                  size="sm"
                  disabled={busy === hire.id}
                  onPress={() => onRequestAction(hire.id, 'reject')}
                  style={styles.actionBtn}
                />
                <Button
                  label="Accept"
                  size="sm"
                  loading={busy === hire.id}
                  onPress={() => onRequestAction(hire.id, 'accept')}
                  style={styles.actionBtn}
                />
              </View>
            </View>
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

/** A pending request: the worker is the headline here, so perspective="worker". */
function RequestRow({ hire, onPress }: { hire: ApiHire; onPress: () => void }) {
  return <HireCard hire={hire} perspective="worker" onPress={onPress} />;
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

  requestCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
});
