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
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Statuses where a booking is still live (everything else is history). */
const OPEN_STATUSES = ['pending', 'accepted', 'en_route', 'arrived'] as const;

type StatusFilter = 'all' | 'active' | 'history';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'history', label: 'History' },
];

export default function MyJobsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [jobs, setJobs] = useState<ApiHire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listHires();
      setJobs(data.asWorker ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your jobs.');
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

  const isOpen = (hire: ApiHire) => (OPEN_STATUSES as readonly string[]).includes(hire.status);
  const visible =
    filter === 'all'
      ? jobs
      : filter === 'active'
        ? jobs.filter(isOpen)
        : jobs.filter((hire) => !isOpen(hire));

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Jobs</Text>
      </View>

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
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HireCard
              hire={item}
              perspective="worker"
              onPress={() =>
                router.push({ pathname: '/hire/detail/[id]', params: { id: item.id } })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'cloud-offline-outline' : 'briefcase-outline'}
              title={error ? 'Something went wrong' : 'No jobs yet'}
              subtitle={
                error ??
                (filter === 'history'
                  ? 'Completed aur cancelled jobs yahan aayenge.'
                  : filter === 'active'
                    ? 'Abhi koi active job nahi hai.'
                    : 'Aapke accept kiye hue jobs yahan dikhenge.')
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterActive: { backgroundColor: colors.primaryTint, borderColor: colors.primaryBorder },
  filterText: { fontSize: fontSize.caption, color: colors.textSecondary },
  filterTextActive: { color: colors.primaryDark, fontWeight: fontWeight.semibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
