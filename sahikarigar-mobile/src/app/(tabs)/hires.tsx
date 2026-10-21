import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, HireCard, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { listHires, type ApiHire } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface HireData {
  workerProfileId: string | null;
  asEmployer: ApiHire[];
  asWorker: ApiHire[];
}

/** Statuses where a booking is still live (everything else is history). */
const OPEN_STATUSES = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress'] as const;

/** Statuses that need the employer to DO something right now. */
const ACTION_STATUSES = ['arrived'] as const;

type Perspective = 'employer' | 'worker';

export default function HiresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Perspective>('employer');
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

  // Dual-role users (employer + kaarigar) can switch sides. Pure employers
  // never see this switcher — their screen stays a clean "Active / History" list.
  const isWorker = Boolean(data?.workerProfileId);
  const perspective: Perspective = tab === 'employer' || !isWorker ? 'employer' : 'worker';
  const hires = perspective === 'employer' ? (data?.asEmployer ?? []) : (data?.asWorker ?? []);

  const isOpen = (hire: ApiHire) => (OPEN_STATUSES as readonly string[]).includes(hire.status);
  const needsAction = (hire: ApiHire) =>
    (ACTION_STATUSES as readonly string[]).includes(hire.status);

  const activeHires = hires.filter(isOpen);
  const historyHires = hires.filter((hire) => !isOpen(hire));
  /** Jobs where the employer still has to share the start-work OTP. */
  const awaitingOtp = activeHires.filter(needsAction);

  const sections = useMemo(
    () => [
      { key: 'active', title: 'Active Jobs', data: activeHires },
      { key: 'history', title: 'Previous History', data: historyHires },
    ],
    [activeHires, historyHires],
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Hires</Text>
        <Text style={styles.subheading}>
          {activeHires.length} active • {historyHires.length} in history
        </Text>
      </View>

      {!user ? (
        <View style={styles.guestBox}>
          <Text style={styles.guestTitle}>Login karke apni bookings dekho</Text>
          <Text style={styles.guestText}>
            Guest mode me browse kar sakte ho — bookings dekhne ke liye login zaroori hai.
          </Text>
          <Button label="Login / Sign up" onPress={() => router.push('/(auth)/login')} />
        </View>
      ) : null}

      {isWorker ? (
        <View style={styles.segment}>
          <Segment
            label="As Employer"
            active={perspective === 'employer'}
            onPress={() => setTab('employer')}
          />
          <Segment
            label="As Kaarigar"
            active={perspective === 'worker'}
            onPress={() => setTab('worker')}
          />
        </View>
      ) : null}

      {/* Action banner — the kaarigar has arrived and the employer still has
          to share the 4-digit start-work OTP. */}
      {perspective === 'employer' && awaitingOtp.length > 0 ? (
        <Pressable
          style={styles.actionBanner}
          onPress={() =>
            router.push({
              pathname: '/hire/detail/[id]',
              params: { id: awaitingOtp[0].id },
            })
          }
        >
          <Ionicons name="key" size={18} color={colors.white} />
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>
              {awaitingOtp.length === 1
                ? 'Kaarigar pahunch gaya — OTP share karo'
                : `${awaitingOtp.length} kaarigar pahunch gaye — OTP share karo`}
            </Text>
            <Text style={styles.actionSub}>Tap karke OTP dekhein aur worker ko dijiye</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.white} />
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <HireCard
              hire={item}
              perspective={perspective}
              notice={
                perspective === 'employer' && needsAction(item)
                  ? { label: 'OTP Ready — tap to show' }
                  : undefined
              }
              onPress={() =>
                router.push({ pathname: '/hire/detail/[id]', params: { id: item.id } })
              }
            />
          )}
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Something went wrong"
                subtitle={error}
              />
            ) : (
              <EmptyState
                icon="briefcase-outline"
                title="No bookings yet"
                subtitle={
                  perspective === 'employer'
                    ? 'Hire a worker to get started.'
                    : 'Bookings you receive will show up here.'
                }
              />
            )
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentItem, active && styles.segmentActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subheading: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primaryDark },
  segmentText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  segmentTextActive: { color: colors.white },
  // Action banner — the employer must share the OTP once the worker arrives.
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.primaryDark,
  },
  actionTextWrap: { flex: 1 },
  actionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  actionSub: { fontSize: fontSize.caption - 1, color: colors.white, opacity: 0.85, marginTop: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionCount: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  guestBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
    gap: spacing.sm,
  },
  guestTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  guestText: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
});
