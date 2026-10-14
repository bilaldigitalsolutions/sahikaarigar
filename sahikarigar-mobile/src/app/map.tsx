import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Header, Screen } from '@/components';
import { areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';

/** Fallback centre — Hyderabad. Mappls uses [longitude, latitude]. */
const HYDERABAD_CENTER: [number, number] = [78.4867, 17.385];

/**
 * The Mappls native map only exists in a native build — Expo Go and the browser
 * cannot load custom native modules, so we never even require the SDK there.
 */
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const NATIVE_MAP_AVAILABLE = Platform.OS === 'android' && !IS_EXPO_GO;

type MapplsMapModule = {
  MapView: React.ComponentType<{
    style?: unknown;
    onMapError?: (error: { code?: string; message?: string }) => void;
    children?: React.ReactNode;
  }>;
  Camera: React.ComponentType<{
    zoomLevel?: number;
    minZoomLevel?: number;
    maxZoomLevel?: number;
    centerCoordinate?: [number, number];
  }>;
};

let mappls: MapplsMapModule | null = null;
if (NATIVE_MAP_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mappls = require('mappls-map-react-native') as MapplsMapModule;
  } catch {
    mappls = null;
  }
}

export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const area = user?.locationArea ? areaLabel(user.locationArea) : null;
  const center: [number, number] =
    user?.lng != null && user?.lat != null ? [user.lng, user.lat] : HYDERABAD_CENTER;

  const MapView = mappls?.MapView;
  const Camera = mappls?.Camera;
  const canRenderMap = NATIVE_MAP_AVAILABLE && Boolean(MapView) && Boolean(Camera);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Screen padded={false} edges={['bottom']} header={<Header title="Map" />}>
      {canRenderMap && MapView && Camera ? (
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            onMapError={(error: { code?: string; message?: string }) =>
              console.warn('Mappls map error:', error?.code, error?.message)
            }
          >
            <Camera zoomLevel={12} minZoomLevel={4} maxZoomLevel={22} centerCoordinate={center} />
          </MapView>

          <View style={styles.overlay}>
            <Ionicons name="location" size={16} color={colors.primaryDark} />
            <View style={styles.overlayText}>
              <Text style={styles.overlayLabel}>Showing</Text>
              <Text style={styles.overlayValue} numberOfLines={1}>
                {area ?? 'Hyderabad'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.fallback}>
          <Card style={styles.fallbackCard}>
            <View style={styles.fallbackIcon}>
              <Ionicons name="map-outline" size={30} color={colors.primaryDark} />
            </View>
            <Text style={styles.fallbackTitle}>Map needs a development build</Text>
            <Text style={styles.fallbackText}>
              The Mappls native map can’t run inside Expo Go or the browser. Build the app once to
              see the live map:
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.code}>npx expo prebuild --platform android</Text>
              <Text style={styles.code}>npx expo run:android</Text>
            </View>
            <Text style={styles.fallbackText}>
              The area search picker works everywhere and is unaffected.
            </Text>
            <Button
              label="Go back"
              variant="secondary"
              onPress={goBack}
              style={styles.backBtn}
            />
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  overlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  overlayText: { flex: 1 },
  overlayLabel: { fontSize: fontSize.caption - 1, color: colors.textSecondary },
  overlayValue: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  fallback: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  fallbackCard: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  fallbackIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
  fallbackText: { fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
  codeBox: {
    alignSelf: 'stretch',
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: { fontSize: fontSize.caption, color: colors.primaryDark, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  backBtn: { marginTop: spacing.sm },
});
