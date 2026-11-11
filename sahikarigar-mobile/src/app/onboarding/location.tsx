// Location Step — automatically resolves the current GPS position, reverse
// geocodes it to a readable address and shows it before the user moves on.
// The user can refresh the fix or retry after a permission/GPS failure; a
// "Skip" link keeps the old Madhapur fallback so nobody gets trapped here.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, Card, Screen } from '@/components';
import { setLocation } from '@/lib/storage';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/** Fallback area when GPS is unavailable or permission is denied. */
const DEFAULT_AREA = 'Madhapur';

/** Give the GPS fix this long before falling back to the last known fix. */
const GPS_TIMEOUT_MS = 15_000;
/** Reverse geocoding should never hold the screen hostage. */
const GEOCODE_TIMEOUT_MS = 8_000;

type LocationState =
  | { kind: 'locating' }
  | {
      kind: 'ready';
      area: string;
      address: string;
      lat: number;
      lng: number;
      approximate: boolean;
    }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error' };

/** Reject a slow native promise so the UI can offer Retry instead of hanging. */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Best-effort readable address from the reverse-geocode result. */
function describePlace(place: Location.LocationGeocodedAddress | undefined) {
  if (!place) return null;

  const area =
    place.name ||
    place.subregion ||
    place.district ||
    place.city ||
    place.region ||
    'Current location';

  const parts = [
    place.name,
    place.street,
    place.district,
    place.subregion,
    place.city,
    place.region,
    place.postalCode,
  ].filter((part): part is string => Boolean(part?.trim()));

  const address =
    place.formattedAddress?.trim() ||
    parts.filter((part, index, all) => all.indexOf(part) === index).join(', ') ||
    area;

  return { area, address };
}

export default function LocationStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [state, setState] = useState<LocationState>({ kind: 'locating' });
  const [syncing, setSyncing] = useState(false);

  // Incremented on every retry/unmount so a late GPS callback can't overwrite
  // the result of a newer request.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState({ kind: 'locating' });

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (requestRef.current !== requestId) return;

      if (permission.status !== 'granted') {
        setState({ kind: 'denied', canAskAgain: permission.canAskAgain });
        return;
      }

      let coords: Location.LocationObjectCoords;
      let approximate = false;

      try {
        const position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          GPS_TIMEOUT_MS,
        );
        coords = position.coords;
      } catch {
        // A slightly stale fix is much better than an empty screen.
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 10 * 60 * 1000,
          requiredAccuracy: 1000,
        }).catch(() => null);

        if (!lastKnown?.coords) {
          throw new Error('GPS timeout');
        }
        coords = lastKnown.coords;
        approximate = true;
      }

      if (requestRef.current !== requestId) return;

      const latitude = coords.latitude;
      const longitude = coords.longitude;
      const coordinateLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      let area = 'Current location';
      let address = coordinateLabel;

      try {
        const places = await withTimeout(
          Location.reverseGeocodeAsync({ latitude, longitude }),
          GEOCODE_TIMEOUT_MS,
        );
        const described = describePlace(places[0]);
        if (described) {
          area = described.area;
          address = described.address;
        }
      } catch {
        // Reverse geocoding needs a network connection; coordinates still count.
      }

      if (requestRef.current !== requestId) return;
      setState({ kind: 'ready', area, address, lat: latitude, lng: longitude, approximate });
    } catch {
      if (requestRef.current === requestId) {
        setState({ kind: 'error' });
      }
    }
  }, []);

  useEffect(() => {
    // Let the screen transition finish before the OS permission dialog opens.
    const timer = setTimeout(() => {
      void load();
    }, 250);

    return () => {
      clearTimeout(timer);
      // Invalidate any in-flight request when the screen unmounts.
      requestRef.current += 1;
    };
  }, [load]);

  // Persist as soon as the address is visible — the Continue button then only
  // navigates, so a storage hiccup can never block the onboarding step.
  useEffect(() => {
    if (state.kind === 'ready') {
      setSyncing(true);
      void setLocation(state.area).catch(() => {});
      // Sync the selected area to the backend so it persists across logins
      // and is available on the hire screen's home area field.
      void updateProfile({ locationArea: state.area })
        .then(() => {
          // Refresh the auth user so user.locationArea is immediately available
          // on subsequent screens (e.g. the hire screen's home area field).
          void refreshUser().catch(() => {});
        })
        .catch(() => {})
        .finally(() => {
          setSyncing(false);
        });
    }
  }, [state, refreshUser]);

  const goNext = () => {
    router.replace('/onboarding/role' as never);
  };

  const skip = async () => {
    try {
      await setLocation(DEFAULT_AREA);
    } catch {
      // Storage failure must not trap the user on this screen.
    }
    goNext();
  };

  const onPermissionAction = () => {
    if (state.kind !== 'denied') return;
    if (state.canAskAgain) {
      void load();
    } else {
      void Linking.openSettings().catch(() => {});
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>
          {state.kind === 'ready' ? t('onboarding.locationFoundTitle') : t('onboarding.locationTitle')}
        </Text>
        <Text style={styles.sub}>
          {t('onboarding.locationSub')}
        </Text>
      </View>

      {state.kind === 'locating' ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.stateTitle}>{t('onboarding.locating')}</Text>
          <Text style={styles.stateText}>
            {t('onboarding.locatingSub')}
          </Text>
        </Card>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <Card style={styles.addressCard}>
            <View style={styles.addressHead}>
              <View style={styles.pinWrap}>
                <Ionicons name="location" size={20} color={colors.primaryDark} />
              </View>
              <Text style={styles.addressLabel}>{t('onboarding.currentLocationLabel')}</Text>
            </View>
            <Text style={styles.area}>{state.area}</Text>
            <Text style={styles.address}>{state.address}</Text>
            <Text style={styles.coords}>
              {state.lat.toFixed(5)}, {state.lng.toFixed(5)}
            </Text>
            {state.approximate ? (
              <Text style={styles.note}>
                {t('onboarding.approximateNote')}
              </Text>
            ) : null}
          </Card>

          {syncing ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator color={colors.primaryDark} />
              <Text style={styles.stateTitle}>
                {t('onboarding.saving')}
              </Text>
            </Card>
          ) : null}

          <Button label={t('onboarding.continueButton')} onPress={goNext} size="lg" />
          <Button
            label={t('onboarding.refreshLocation')}
            variant="secondary"
            onPress={() => void load()}
            style={styles.secondaryBtn}
          />
        </>
      ) : null}

      {state.kind === 'denied' ? (
        <Card style={styles.stateCard}>
          <Ionicons name="location-outline" size={34} color={colors.primaryDark} />
          <Text style={styles.stateTitle}>{t('onboarding.permissionTitle')}</Text>
          <Text style={styles.stateText}>
            {state.canAskAgain
              ? t('onboarding.permissionAskSub')
              : t('onboarding.permissionSettingsSub')}
          </Text>
          <Button
            label={state.canAskAgain ? t('onboarding.grantPermission') : t('onboarding.openSettings')}
            onPress={onPermissionAction}
            style={styles.actionBtn}
          />
          {state.canAskAgain ? (
            <Button
              label={t('onboarding.openSettings')}
              variant="ghost"
              onPress={() => void Linking.openSettings().catch(() => {})}
            />
          ) : null}
          <Button label={t('onboarding.skipButton')} variant="ghost" onPress={() => void skip()} />
        </Card>
      ) : null}

      {state.kind === 'error' ? (
        <Card style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.textSecondary} />
          <Text style={styles.stateTitle}>{t('onboarding.errorTitle')}</Text>
          <Text style={styles.stateText}>
            {t('onboarding.errorSub')}
          </Text>
          <Button label={t('common.retry')} onPress={() => void load()} style={styles.actionBtn} />
          <Button label={t('onboarding.skipButton')} variant="ghost" onPress={() => void skip()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  title: {
    marginTop: spacing.lg,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  stateCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    marginTop: spacing.lg,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: { marginTop: spacing.xl },
  addressCard: { marginBottom: spacing.lg },
  addressHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pinWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  area: {
    marginTop: spacing.lg,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  address: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  coords: {
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  note: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  secondaryBtn: { marginTop: spacing.md },
});
