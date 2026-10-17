import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  BrandLogo,
  HireCard,
  LocationPicker,
  ModeSwitch,
  Rating,
  Screen,
  type PlaceResult,
} from '@/components';
import { HOME_SERVICES, areaLabel, skillIconName, skillLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import {
  getWorkerDashboard,
  listHires,
  searchWorkers,
  updateProfile,
  type ApiWorker,
} from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { calculateDistance } from '@/utils';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { role } = useMode();
  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [hires, setHires] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const load = useCallback(async () => {
    try {
      // Guests browse workers without a session; hires need login (enforced at
      // Hire time + tabs). listHires throws without a session — tolerate it.
      const [hiresResult, workersResult] = await Promise.all([
        listHires().catch(() => ({ asWorker: [] as never[] })),
        searchWorkers({ limit: 6 }),
      ]);
      setHires((hiresResult as { asWorker?: never[] }).asWorker ?? []);
      setWorkers(workersResult.workers);
    } catch {
      setWorkers([]);
      setHires([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setDashboard(null);
      setLoadingExtra(false);
      return;
    }
    try {
      const result = await getWorkerDashboard();
      setDashboard(result);
    } catch {
      setDashboard(null);
    } finally {
      setLoadingExtra(false);
    }
  }, [user]);

  // Refetch on every tab focus so the worker dashboard stays live.
  useFocusEffect(
    useCallback(() => {
      load();
      loadDashboard();
    }, [load, loadDashboard]),
  );

  // How many workers each home tile has (e.g. "Electrician 55"). One cheap
  // `limit: 1` query per skill — only the pagination total is read, so the list
  // body is never fetched.
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        HOME_SERVICES.map(async (service) => {
          try {
            const result = await searchWorkers({ skill: service.id, limit: 1 });
            return [service.id, result.pagination.total] as const;
          } catch {
            return [service.id, 0] as const;
          }
        }),
      );
      if (active) setCounts(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, []);

  // Guest employer: hardware back goes to role-selection (onboarding), never to login.
  useEffect(() => {
    if (user) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/onboarding/role' as never);
      return true;
    });
    return () => sub.remove();
  }, [user, router]);

  // Home shows the recently registered kaarigar (Search has its own
  // "Top Rated" filter).
  /** Recently registered kaarigar — newest signups first. */
  const recentWorkers = [...workers]
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 4);
  const area = user?.locationArea ? areaLabel(user.locationArea) : null;
  const locationText = area ? `${area}, ${user?.locationCity ?? 'Hyderabad'}` : 'Hyderabad';
  const openSearch = () => router.push('/(tabs)/search');

  const onSelectArea = async (place: PlaceResult) => {
    if (!user) {
      // Guests pick areas locally — onboarding `user_location` already covers
      // browse; the profile area syncs after login.
      return;
    }
    try {
      await updateProfile({ locationArea: place.description });
      await refreshUser();
    } catch {
      // ignore — the picker still shows the selected label
    }
  };

  // Role decides the home content (the locally chosen role — see ModeContext):
  //   employer -> Browse by Category + Top Rated Workers
  //   worker   -> New Job Requests + My Active Jobs (kaarigar dashboard)
  if (role === 'worker') {
    return (
      <WorkerHomeScreen
        user={user}
        hires={hires}
        dashboard={dashboard}
        loadingExtra={loadingExtra}
      />
    );
  }

  return (
    <Screen scroll={false} padded={false} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            {!user ? (
              <Pressable onPress={() => router.replace('/onboarding/role' as never)} hitSlop={10} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
              </Pressable>
            ) : router.canGoBack() ? (
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
              </Pressable>
            ) : null}
            <BrandLogo size={30} />
          </View>
          <LocationPicker
            placeholder="Select area"
            value={locationText}
            onSelect={onSelectArea}
            trigger={(open) => (
              <Pressable style={styles.location} onPress={open}>
                <Ionicons name="location" size={14} color={colors.primaryDark} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationText}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.primaryDark} />
              </Pressable>
            )}
          />
        </View>

        <Pressable style={styles.searchBar} onPress={openSearch}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search for plumbers, electricians, cleaning...
          </Text>
        </Pressable>
      </View>

      {/* Uber-style mode switch — only visible to accounts with a worker profile. */}
      <ModeSwitch style={styles.modeSwitch} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Pressable style={styles.mapBar} onPress={() => router.push('/map')}>
          <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.mapBarText}>View service areas on the map</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>

        <Text style={styles.sectionTitle}>Services</Text>
        <View style={styles.servicesRow}>
          {HOME_SERVICES.map((s) => (
            <Pressable
              key={s.id}
              style={styles.serviceTile}
              onPress={() => router.push({ pathname: '/(tabs)/search', params: { skill: s.id } })}
            >
              <View style={styles.serviceIcon}>
                <Ionicons
                  name={skillIconName(s.id) as keyof typeof Ionicons.glyphMap}
                  size={26}
                  color={colors.primaryDark}
                />
              </View>
              <Text style={styles.serviceLabel}>{s.label}</Text>
              {counts[s.id] != null ? (
                <Text style={styles.serviceCount}>{counts[s.id]} workers</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Naye Kaarigar ✨</Text>
          <Pressable onPress={openSearch} hitSlop={8}>
            <Text style={styles.seeAll}>See all ›</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primaryDark} style={styles.loader} />
        ) : recentWorkers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No workers available right now.</Text>
          </View>
        ) : (
          recentWorkers.map((worker) => (
            <HomeWorkerCard
              key={worker.id}
              worker={worker}
              userLat={user?.lat ?? null}
              userLng={user?.lng ?? null}
              onPress={() => router.push({ pathname: '/worker/[id]', params: { id: worker.id } })}
              onBook={() =>
                router.push({ pathname: '/hire/[workerId]', params: { workerId: worker.id } })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function HomeWorkerCard({
  worker,
  userLat,
  userLng,
  onPress,
  onBook,
}: {
  worker: ApiWorker;
  userLat: number | null;
  userLng: number | null;
  onPress: () => void;
  onBook: () => void;
}) {
  const user = worker.user;
  const name = user?.name ?? 'Kaarigar';
  const primarySkill = worker.skills[0];
  const areaId = user?.locationArea ?? worker.serviceAreas[0];

  const distance =
    userLat != null && userLng != null && worker.lat != null && worker.lng != null
      ? calculateDistance(userLat, userLng, worker.lat, worker.lng)
      : null;

  return (
    <Pressable style={styles.workerCard} onPress={onPress}>
      <Avatar uri={user?.avatar} name={name} size={58} />
      <View style={styles.workerInfo}>
        <Text style={styles.workerName} numberOfLines={1}>
          {name}
        </Text>
        {primarySkill ? (
          <View style={styles.skillPill}>
            <Text style={styles.skillPillText}>
              {skillLabel(primarySkill)} • {worker.experience} yrs exp
            </Text>
          </View>
        ) : null}
        <View style={styles.ratingRow}>
          <Rating value={worker.ratingAverage} size={13} />
          <Text style={styles.reviewCount}>({worker.ratingCount} reviews)</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {distance != null ? `${distance} km away` : 'Hyderabad'}
            {areaId ? ` • ${areaLabel(areaId)}` : ''}
          </Text>
        </View>
      </View>
      <Pressable style={styles.bookBtn} onPress={onBook}>
        <Text style={styles.bookBtnText}>Hire</Text>
      </Pressable>
    </Pressable>
  );
}

function WorkerHomeScreen({
  user,
  hires,
  dashboard,
  loadingExtra,
}: {
  user: any;
  hires: any[];
  dashboard: any | null;
  loadingExtra: boolean;
}) {
  const router = useRouter();
  const isApproved = dashboard?.worker?.isApproved ?? false;
  const stats = dashboard?.stats;

  // Not approved yet — show verification pending message.
  if (!isApproved) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>Kaarigar Dashboard</Text>
        <View style={styles.pendingCard}>
          <View style={styles.pendingIcon}>
            <Ionicons name="hourglass-outline" size={32} color={colors.warning} />
          </View>
          <Text style={styles.pendingTitle}>Verification Pending</Text>
          <Text style={styles.pendingText}>
            Aapka profile verification ke under hai. Approve hone par aapko jobs milna shuru honge.
          </Text>
        </View>
      </Screen>
    );
  }

  // Approved — show the full dashboard.
  return (
    <Screen scroll>
      <Text style={styles.heading}>Kaarigar Dashboard</Text>

      {loadingExtra && !dashboard ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : (
        <>
          {/* Dashboard Cards */}
          <View style={styles.cardsRow}>
            <DashboardCard
              icon="paper-plane"
              label="New Requests"
              count={stats?.pending ?? 0}
              color={colors.primary}
              onPress={() => router.push('/(tabs)/jobs')}
            />
            <DashboardCard
              icon="briefcase"
              label="Active Jobs"
              count={stats?.active ?? 0}
              color={colors.warning}
              onPress={() => router.push('/(tabs)/my-jobs' as any)}
            />
            <DashboardCard
              icon="checkmark-circle"
              label="Completed"
              count={stats?.completed ?? 0}
              color={colors.success}
              onPress={() => router.push('/(tabs)/my-jobs' as any)}
            />
          </View>

          {/* New Job Requests */}
          <Text style={styles.sectionTitle}>New Job Requests</Text>
          {loadingExtra ? (
            <ActivityIndicator color={colors.primaryDark} style={styles.loader} />
          ) : hires.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="briefcase-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>No new job requests right now.</Text>
            </View>
          ) : (
            hires.map((hire) => (
              <HireCard key={hire.id} hire={hire} perspective="worker" onPress={() => {}} />
            ))
          )}

          {/* My Active Jobs */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>My Active Jobs</Text>
          {dashboard ? (
            (dashboard.active ?? []).length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyText}>No active jobs right now.</Text>
              </View>
            ) : (
              (dashboard.active ?? []).map((hire: any) => (
                <HireCard key={hire.id} hire={hire} perspective="worker" onPress={() => {}} />
              ))
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** A single dashboard stat card (New Requests / Active Jobs / Completed). */
function DashboardCard({
  icon,
  label,
  count,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dashCard} onPress={onPress}>
      <View style={[styles.dashIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.dashCount}>{count}</Text>
      <Text style={styles.dashLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heading: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  // Verification pending card
  pendingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    backgroundColor: colors.warning + '08',
  },
  pendingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pendingTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  pendingText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Dashboard cards row
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dashCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  dashIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dashCount: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  dashLabel: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  modeSwitch: { marginTop: spacing.md, marginHorizontal: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  location: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '48%' },
  locationText: { fontSize: fontSize.caption, color: colors.textPrimary, fontWeight: fontWeight.medium },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  searchPlaceholder: { flex: 1, fontSize: fontSize.small, color: colors.muted },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  mapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  mapBarText: { flex: 1, fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  seeAll: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    marginTop: spacing.md,
  },
  serviceTile: {
    width: '31%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  serviceCount: { fontSize: fontSize.caption - 1, color: colors.textSecondary },
  loader: { marginTop: spacing.xxl },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.small, color: colors.textSecondary },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  workerInfo: { flex: 1 },
  workerName: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  skillPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  skillPillText: { fontSize: fontSize.caption - 1, color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  reviewCount: { fontSize: fontSize.caption - 1, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  metaText: { fontSize: fontSize.caption - 1, color: colors.textSecondary, flexShrink: 1 },
  bookBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  bookBtnText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.white },
});


