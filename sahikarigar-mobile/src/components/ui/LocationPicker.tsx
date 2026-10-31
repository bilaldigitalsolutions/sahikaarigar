import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HYDERABAD_AREAS } from '@/constants';
import { GOOGLE_MAPS_API_KEY } from '@/lib/config';
import { olaMapsAutosuggest, olaMapsEnabled, olaMapsGeocode } from '@/lib/olaMaps';
import { photonAutosuggest } from '@/lib/photon';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export interface PlaceResult {
  description: string;
  lat?: number;
  lng?: number;
}

interface Prediction {
  description: string;
  place_id: string;
}
interface AutocompleteResponse {
  predictions?: Prediction[];
}
interface DetailsResponse {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
}

/** A row shown in the picker list. */
type PickerItem = PlaceResult & { placeId?: string };

export interface LocationPickerProps {
  placeholder: string;
  value: string | null;
  onSelect: (place: PlaceResult) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Render a custom trigger instead of the default field. Receives `open()`. */
  trigger?: (open: () => void) => ReactNode;
}

const ERROR_MESSAGE = 'Location could not be loaded. Please check your internet connection.';
/** Subtle grey hint shown when the live search API fails / is too slow and only
 *  local results remain — this is a graceful fallback, NOT an error. */
const FALLBACK_HINT = 'Showing saved Hyderabad areas (Live search offline)';

const LOCATION_DEBUG =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_OLA_MAPS_DEBUG === '1';

function locationDebug(message: string, data?: unknown): void {
  if (!LOCATION_DEBUG) return;
  if (data === undefined) console.log(`[LocationPicker] ${message}`);
  else console.log(`[LocationPicker] ${message}`, data);
}

/**
 * Area / location picker.
 *
 * Provider priority:
 *   1. Ola Maps           — when EXPO_PUBLIC_OLA_MAPS_API_KEY is set (best for India)
 *   2. Google Places      — when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set
 *   3. Photon             — keyless OpenStreetMap fallback
 *   4. Built-in list of Hyderabad areas + free-text entry (always available)
 */
export function LocationPicker({
  placeholder,
  value,
  onSelect,
  icon = 'location-outline',
  trigger,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceBias, setDeviceBias] = useState<{ lat?: number; lng?: number } | undefined>(undefined);
  /** Always-current copy of the query — guards async callbacks against stale writes. */
  const queryRef = useRef(query);
  queryRef.current = query;

  // Synchronous local fallback — memoized so it only recomputes when the query
  // changes. Always available instantly, even with zero internet.
  const localResults: PickerItem[] = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    return HYDERABAD_AREAS.filter(
      (a) => a.label.toLowerCase().includes(qLower) || a.id.replace(/-/g, ' ').includes(qLower),
    ).map((a) => ({ description: a.label }));
  }, [query]);

  const googleEnabled = GOOGLE_MAPS_API_KEY.length > 0;

  // Runtime location permission request when opening picker
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (active && status === 'granted') {
          const last = await Location.getLastKnownPositionAsync();
          if (active && last?.coords) {
            setDeviceBias({ lat: last.coords.latitude, lng: last.coords.longitude });
          }
        }
      } catch {
        // Runtime permission request is best-effort
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    const hasQuery = q.length > 0;

    locationDebug('search start', {
      query: q,
      olaMapsEnabled,
      googleEnabled,
      localCount: localResults.length,
    });

    // Show local results IMMEDIATELY — no waiting for the remote API.
    // The user always has something to pick from, even with zero internet.
    setResults(localResults);
    setError(null);

    if (!hasQuery || q.length < 3) {
      setLoading(false);
      return;
    }

    // Remote fetch — debounced so we don't hit the API on every keystroke.
    const debounceId = setTimeout(() => {
      // Show spinner only if there are no local results to display yet.
      setLoading(localResults.length === 0);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      let active = true;
      (async () => {
        const remote: PickerItem[] = [];
        try {
          if (olaMapsEnabled) {
            const olaResults = await olaMapsAutosuggest(q, deviceBias, controller.signal);
            remote.push(...olaResults);
            locationDebug('Ola Maps results', { count: olaResults.length });
          } else if (googleEnabled) {
            const url =
              'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
              `?input=${encodeURIComponent(q)}&components=country:in&language=en&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url, { signal: controller.signal });
            const data = (await res.json()) as AutocompleteResponse;
            remote.push(...(data.predictions ?? []).map((p) => ({
              description: p.description,
              placeId: p.place_id,
            })));
            locationDebug('Google Places results', { count: remote.length });
          }

          if (remote.length === 0) {
            locationDebug('trying Photon fallback', {
              olaMapsEnabled,
              googleEnabled,
            });
            const photonResults = await photonAutosuggest(q, deviceBias, controller.signal);
            remote.push(...photonResults);
            locationDebug('Photon fallback results', { count: photonResults.length });
          }

          locationDebug('remote search complete', {
            olaMapsEnabled,
            googleEnabled,
            remoteCount: remote.length,
          });
        } catch (error) {
          // Slow/failing provider is silent — local list already visible.
          locationDebug('remote search failed', { error: String(error) });
        }

        if (!active) return;

        clearTimeout(timeoutId);
        setLoading(false);

        if (queryRef.current !== q) return;

        if (remote.length === 0) {
          // Remote failed or timed out — keep local results, show fallback hint
          // so the user knows they are seeing saved Hyderabad areas.
          setResults(localResults);
          setError(FALLBACK_HINT);
          return;
        }

        const merged: PickerItem[] = [...localResults];
        for (const r of remote) {
          if (!merged.some((m) => m.description === r.description)) merged.push(r);
        }
        setResults(merged);
        setError(null);
      })();
    }, 300);

    return () => {
      clearTimeout(debounceId);
    };
  }, [query, open, localResults, deviceBias, googleEnabled]);

  /** Close the sheet, dismiss the keyboard and reset for the next open. */
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setQuery('');
    setResults([]);
    setError(null);
  };

  const choose = async (item: PickerItem) => {
    let place: PlaceResult = { description: item.description, lat: item.lat, lng: item.lng };

    if (place.lat == null && place.lng == null) {
      if (olaMapsEnabled) {
        // Autocomplete normally includes geometry.location, but free-text rows
        // and occasional responses do not. Geocode only when coordinates are
        // missing; 3-second timeout so a slow request can't hang the picker.
        const geoController = new AbortController();
        const geoTimeout = setTimeout(() => geoController.abort(), 3000);
        try {
          place = {
            ...place,
            ...(await olaMapsGeocode(item.description, geoController.signal)),
          };
        } catch {
          // Geocode failed/timed out — keep the autocomplete description, lat/lng stay null.
        } finally {
          clearTimeout(geoTimeout);
        }
      } else if (googleEnabled && item.placeId) {
        try {
          const url =
            'https://maps.googleapis.com/maps/api/place/details/json' +
            `?place_id=${item.placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
          const res = await fetch(url);
          const data = (await res.json()) as DetailsResponse;
          const loc = data.result?.geometry?.location;
          place = {
            description: data.result?.formatted_address ?? item.description,
            lat: loc?.lat,
            lng: loc?.lng,
          };
        } catch {
          // keep the autocomplete description
        }
      }
    }

    onSelect(place);
    console.log('[LocationPicker] selected place:', JSON.stringify(place));
    close();
  };

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(ERROR_MESSAGE);
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (pos?.coords) {
        const rev = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const first = rev[0];
        const desc = first
          ? [first.name, first.district, first.city, first.region].filter(Boolean).join(', ')
          : `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        await choose({
          description: desc,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      }
    } catch {
      setError(ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Pressable style={styles.field} onPress={() => setOpen(true)}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
          <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
            {value ?? placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
          <Pressable style={styles.backdropTap} onPress={close}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{placeholder}</Text>
                <Pressable onPress={close} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search area or locality"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                  autoFocus
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
                {loading && query.trim().length > 0 && localResults.length === 0 ? (
                  <ActivityIndicator color={colors.primaryDark} />
                ) : null}
              </View>

              {loading && query.trim().length > 0 && localResults.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                  <Text style={styles.loadingText}>Loading locations...</Text>
                </View>
              ) : null}

              {error ? (
                // Neutral grey hint — never a scary red error box (offline
                // fallback is normal behaviour, not a failure).
                <View style={styles.hintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.hintText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={styles.currentLocationBtn}
                onPress={handleUseCurrentLocation}
                disabled={loading}
              >
                <Ionicons name="locate" size={18} color={colors.primaryDark} />
                <Text style={styles.currentLocationText}>Use current location</Text>
              </Pressable>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.list}
                contentContainerStyle={styles.listContent}
              >
                {query.trim().length > 0 ? (
                  <Pressable
                    style={styles.option}
                    onPress={() => choose({ description: query.trim() })}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primaryDark} />
                    <Text style={styles.optionText} numberOfLines={2}>
                      Use “{query.trim()}”
                    </Text>
                  </Pressable>
                ) : null}

                {results.map((item) => (
                  <Pressable
                    key={item.placeId ?? item.description}
                    style={styles.option}
                    onPress={() => choose(item)}
                  >
                    <Ionicons name="location-outline" size={18} color={colors.primaryDark} />
                    <Text style={styles.optionText} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </Pressable>
                ))}

                {!loading && query.trim().length === 0 ? (
                  <Text style={styles.emptyText}>Start typing to search for an area.</Text>
                ) : null}

                {!loading && !error && results.length === 0 && query.trim().length > 0 && localResults.length === 0 ? (
                  <Text style={styles.footNote}>
                    No results found. You can still type any area and tap “Use …”.
                  </Text>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
  },
  fieldText: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary },
  placeholder: { color: colors.muted },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  backdropTap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  sheetTitle: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary, paddingVertical: 0 },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  loadingText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  // Subtle grey hint row (offline fallback / GPS note) — deliberately NOT a
  // red bordered alarm box.
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  hintText: {
    flex: 1,
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currentLocationText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primaryDark,
  },
  list: { marginTop: spacing.sm, flex: 1, flexShrink: 1 },
  listContent: { paddingBottom: spacing.xs, flexGrow: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary },
  emptyText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  footNote: {
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
