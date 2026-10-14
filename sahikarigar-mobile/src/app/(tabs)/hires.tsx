import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState, HireCard, Screen } from '@/components';
import { listHires, type ApiHire } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface HireData {
  workerProfileId: string | null;
  asEmployer: ApiHire[];
  asWorker: ApiHire[];
}

/** Statuses where a booking is still live (everything else is history). */
const OPEN_STATUSES = ['pending', 'accepted', 'en_route', 'arrived'] as const;

type StatusFilter = 'all' | 'active' | 'history';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'history', label: 'History' },
];

export default function HiresScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'employer' | 'worker'>('employer');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [data, setData] = useState<HireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await listHires());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your bookings.');
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

  const isWorker = Boolean(data?.workerProfileId);
  const hires = tab === 'employer' ? (data?.asEmployer ?? []) : (data?.asWorker ?? []);

  const isOpen = (hire: ApiHire) => (OPEN_STATUSES as readonly string[]).includes(hire.status);
  const visible =
    filter === 'all'
      ? hires
      : filter === 'active'
        ? hires.filter(isOpen)
        : hires.filter((hire) => !isOpen(hire));

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Bookings</Text>
      </View>

      <View style={styles.segment}>
        <Segment label="As Employer" active={tab === 'employer'} onPress={() => setTab('employer')} />
        <Segment
          label="As Worker"
          active={tab === 'worker'}
          onPress={() => setTab('worker')}
          disabled={!isWorker}
        />
      </View>

      {/* Active bookings vs. the order history (completed / cancelled / rejected). */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.filter, filter === f.id && styles.filterActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.id }}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => (
            <HireCard
              hire={item}
              perspective={tab}
              onPress={() =>
                router.push({ pathname: '/hire/detail/[id]', params: { id: item.id } })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'cloud-offline-outline' : 'briefcase-outline'}
              title={
                error
                  ? 'Something went wrong'
                  : filter === 'history'
                    ? 'No history yet'
                    : 'No bookings yet'
              }
              subtitle={
                error ??
                (filter === 'history'
                  ? 'Completed aur cancelled orders yahan aayenge.'
                  : filter === 'active'
                    ? 'Abhi koi active booking nahi hai.'
                    : tab === 'employer'
                      ? 'Hire a worker to get started.'
                      : 'Bookings you receive will show up here.')
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function Segment({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.segmentItem, active && styles.segmentActive, disabled && styles.segmentDisabled]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  segment: {
    flexDirection: 'row',
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primaryDark },
  segmentDisabled: { opacity: 0.4 },
  segmentText: { fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.medium },
  segmentTextActive: { color: colors.white },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterActive: { backgroundColor: colors.primaryTint, borderColor: colors.primaryBorder },
  filterText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  filterTextActive: { color: colors.primaryDark, fontWeight: fontWeight.semibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
