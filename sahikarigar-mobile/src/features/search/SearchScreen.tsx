import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar, Header, LocationPicker, Screen, Select, Slider } from '@/components';
import {
  POPULAR_FILTERS,
  SKILLS,
  areaLabel,
  skillIconName,
  skillLabel,
  type PopularFilterId,
} from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { searchWorkers, type ApiWorker } from '@/lib/api';
import { DEMO_MODE } from '@/lib/config';
import { DEMO_WORKERS } from '@/lib/demoData';
import { getDeviceCoords, type DeviceCoords } from '@/lib/location';
import { trackEvent } from '@/lib/observability';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { calculateDistance, formatCurrency } from '@/utils';

const PRICE_MAX = 1000;
/** Select option id shown as "All skills" (maps back to no skill filter). */
const ALL_SKILLS = '__all__';

/**
 * Sample profiles shown when the API has no approved workers yet, so the
 * screen never looks empty while the marketplace fills up.
 */

/**
 * Lenient area match — the picker can return a long label such as
 * "Gachibowli, Hyderabad, Telangana" while workers store an area id.
 */
function matchesArea(worker: ApiWorker, area: string): boolean {
  const needle = area.toLowerCase();
  const candidates = [
    ...worker.serviceAreas.map((id) => areaLabel(id)),
    worker.user?.locationArea ? areaLabel(worker.user.locationArea) : '',
  ]
    .filter(Boolean)
    .map((label) => label.toLowerCase());

  return candidates.some((label) => needle.includes(label) || label.includes(needle));
}

export function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ skill?: string; area?: string }>();

  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState<string | null>(params.skill ?? null);
  const [areaFilter, setAreaFilter] = useState<string | null>(params.area ?? null);
  const [filters, setFilters] = useState<PopularFilterId[]>([]);
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Device GPS — fallback for "near me" sorting when the profile has no
  // saved coordinates (permission is requested lazily, best-effort).
  const [deviceCoords, setDeviceCoords] = useState<DeviceCoords | null>(null);

  useEffect(() => {
    let active = true;
    void getDeviceCoords().then((coords) => {
      if (active && coords) setDeviceCoords(coords);
    });
    return () => {
      active = false;
    };
  }, []);

  const [prevParams, setPrevParams] = useState({ skill: params.skill, area: params.area });
  if (params.skill !== prevParams.skill || params.area !== prevParams.area) {
    setPrevParams({ skill: params.skill, area: params.area });
    if (params.skill) setSkill(params.skill);
    if (params.area) setAreaFilter(String(params.area));
  }

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await searchWorkers({ skill: skill ?? undefined, limit: 50 });
      setWorkers(result.workers);
      setError(null);
      trackEvent('search_performed', { skill: skill ?? undefined, resultCount: result.workers.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workers.');
      setWorkers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [skill]);

  useEffect(() => {
    load();
  }, [skill, load]);

  const toggleFilter = (id: PopularFilterId) =>
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Profile coordinates first; device GPS as fallback so "near me" works
    // even when the user never set a profile location.
    const lat = user?.lat ?? deviceCoords?.lat ?? null;
    const lng = user?.lng ?? deviceCoords?.lng ?? null;

    // Free text like "plumber in Hyderabad" → match the skill "plumber".
    const querySkills: string[] = q
      ? SKILLS.filter((s) => q.includes(s.label.toLowerCase()) || q.includes(s.id)).map((s) => s.id)
      : [];

    let list = workers.filter((w) => {
      if (skill && !w.skills.includes(skill)) return false;
      if (areaFilter && !matchesArea(w, areaFilter)) return false;
      if (q) {
        const name = (w.user?.name ?? '').toLowerCase();
        const matchesSkill = w.skills.some((s) => querySkills.includes(s) || q.includes(s));
        if (!name.includes(q) && !matchesSkill) return false;
      }
      if (filters.includes('under300') && w.hourlyRate > 300) return false;
      if (filters.includes('available') && w.availability !== 'available') return false;
      if (maxPrice < PRICE_MAX && w.hourlyRate > maxPrice) return false;
      return true;
    });

    const distance = (w: ApiWorker) =>
      lat != null && lng != null && w.lat != null && w.lng != null
        ? calculateDistance(lat, lng, w.lat, w.lng)
        : null;

    if (filters.includes('top')) {
      list = [...list].sort((a, b) => b.ratingAverage - a.ratingAverage);
    } else if (filters.includes('near')) {
      list = [...list].sort((a, b) => (distance(a) ?? Infinity) - (distance(b) ?? Infinity));
    }
    return list;
  }, [workers, query, skill, areaFilter, filters, maxPrice, user?.lat, user?.lng, deviceCoords]);

  /** Works both as a tab and as the standalone public route. */
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const resultLabel = skill ? skillLabel(skill).toLowerCase() : 'workers';
  // Only fall back to sample profiles when browsing with no criteria at all.
  const hasCriteria =
    Boolean(query.trim()) ||
    Boolean(skill) ||
    Boolean(areaFilter) ||
    filters.length > 0 ||
    maxPrice < PRICE_MAX;
  const usingDemo = DEMO_MODE && !loading && !error && results.length === 0 && !hasCriteria;
  const list = usingDemo ? DEMO_WORKERS : results;

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={[]}
      contentStyle={styles.content}
      header={
        <View>
          <Header title="SahiKaarigar" onBack={goBack} />
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={colors.primaryDark} />
              <TextInput
                style={styles.searchInput}
                placeholder="plumber in Hyderabad"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {/* Skills dropdown — kaunsa kaam karnewala chahiye. */}
            <View style={styles.skillsWrap}>
              <Select
                placeholder="All skills"
                value={skill ?? ALL_SKILLS}
                options={[
                  { value: ALL_SKILLS, label: 'All skills' },
                  ...SKILLS.map((s) => ({ value: s.id, label: s.label })),
                ]}
                onChange={(v) => setSkill(v === ALL_SKILLS ? null : v)}
              />
            </View>

            {/* Area search — kis area ke kaarigar dikhane hain. */}
            <View style={styles.areaWrap}>
              <LocationPicker
                placeholder="Search area — e.g. Madhapur, Kukatpally"
                value={areaFilter}
                onSelect={(p) => setAreaFilter(p.description)}
                icon="location-outline"
              />
            </View>
          </View>
        </View>
      }
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Popular filters" />
      <View style={styles.chipWrap}>
        {POPULAR_FILTERS.map((f) => {
          const active = filters.includes(f.id);
          return (
            <Pressable
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => toggleFilter(f.id)}
            >
              <Ionicons
                name={f.icon as keyof typeof Ionicons.glyphMap}
                size={15}
                color={active ? colors.white : colors.primaryDark}
              />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {areaFilter ? (
        <View style={styles.chipWrap}>
          <Pressable
            style={[styles.filterChip, styles.filterChipActive]}
            onPress={() => setAreaFilter(null)}
          >
            <Ionicons name="location" size={15} color={colors.white} />
            <Text style={[styles.filterText, styles.filterTextActive]} numberOfLines={1}>
              {areaFilter}
            </Text>
            <Ionicons name="close" size={15} color={colors.white} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Categories filter</Text>
        <Pressable onPress={() => setSkill(null)} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
      >
        {SKILLS.map((s) => {
          const active = skill === s.id;
          return (
            <Pressable
              key={s.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setSkill(active ? null : s.id)}
            >
              <Ionicons
                name={skillIconName(s.id) as keyof typeof Ionicons.glyphMap}
                size={16}
                color={active ? colors.white : colors.primaryDark}
              />
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.priceHeader}>
        <Text style={styles.sectionTitle}>Price range</Text>
        <Text style={styles.priceValue}>
          ₹0 — ₹{maxPrice}
          {maxPrice >= PRICE_MAX ? '+' : ''}
        </Text>
      </View>
      <Text style={styles.priceSort}>Sorted by: {filters.includes('top') ? 'Top Rated' : 'Best match'}</Text>
      <Slider min={0} max={PRICE_MAX} step={50} value={maxPrice} onChange={setMaxPrice} />

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          Results ({list.length} {resultLabel})
        </Text>
        <Pressable onPress={() => toggleFilter('top')} hitSlop={8}>
          <Ionicons name="options-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primaryDark} style={styles.loader} />
      ) : error ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyTitle}>No workers found</Text>
          <Text style={styles.emptyText}>Try another skill or price range.</Text>
        </View>
      ) : (
        <>
          {usingDemo ? (
            <Text style={styles.demoNote}>
              Showing sample profiles — new workers appear here once approved.
            </Text>
          ) : null}
          {list.map((w) => (
            <WorkerRow
              key={w.id}
              worker={w}
              userLat={user?.lat ?? null}
              userLng={user?.lng ?? null}
              onPress={() =>
                w.id.startsWith('demo-')
                  ? Alert.alert(
                      'Sample profile',
                      'Real worker profiles will appear here once approved.',
                    )
                  : router.push({ pathname: '/worker/[id]', params: { id: w.id } })
              }
            />
          ))}
        </>
      )}

      </ScrollView>
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={[styles.sectionTitle, styles.mt]}>{title}</Text>;
}

function WorkerRow({
  worker,
  userLat,
  userLng,
  onPress,
}: {
  worker: ApiWorker;
  userLat: number | null;
  userLng: number | null;
  onPress: () => void;
}) {
  const user = worker.user;
  const name = user?.name ?? 'Kaarigar';
  const areaId = user?.locationArea ?? worker.serviceAreas[0];
  const distance =
    userLat != null && userLng != null && worker.lat != null && worker.lng != null
      ? calculateDistance(userLat, userLng, worker.lat, worker.lng)
      : null;

  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      <Avatar uri={user?.avatar} name={name} size={52} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.resultSkill} numberOfLines={1}>
          {worker.skills.map(skillLabel).join(' • ') || 'Kaarigar'}
        </Text>
        <Text style={styles.resultMeta} numberOfLines={1}>
          ★ {worker.ratingAverage.toFixed(1)} ({worker.ratingCount})
          {distance != null ? ` • ${distance} km away` : ''}
          {areaId ? ` • ${areaLabel(areaId)}` : ''}
        </Text>
        {worker.availability === 'available' ? (
          <View style={styles.availablePill}>
            <Ionicons name="checkmark-circle" size={13} color={colors.primaryDark} />
            <Text style={styles.availableText}>Available Now</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.fromPill}>
        <Text style={styles.fromText}>From {formatCurrency(worker.hourlyRate)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary, paddingVertical: 0 },
  skillsWrap: { marginTop: spacing.md },
  areaWrap: { marginTop: spacing.md },
  sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  mt: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  seeAll: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.primaryDark },
  filterTextActive: { color: colors.white },
  hScroll: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  categoryChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  categoryText: { fontSize: fontSize.caption, color: colors.textPrimary },
  categoryTextActive: { color: colors.white, fontWeight: fontWeight.semibold },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  priceValue: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.primaryDark },
  priceSort: {
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  loader: { marginTop: spacing.xl },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  emptyText: { fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
  demoNote: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  resultSkill: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  resultMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 3 },
  availablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
  },
  availableText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  fromPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  fromText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.primaryDark },
});

