import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen } from '@/components';
import {
  getWorkerDashboard,
  setWorkerAvailability,
  type ApiAvailability,
  type ApiWorkerDashboard,
} from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<ApiWorkerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getWorkerDashboard()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : t('availability.couldNotLoadProfile'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    if (!data?.worker) return;
    setBusy(true);
    setError(null);
    try {
      const nextStatus: ApiAvailability = next ? 'available' : 'offline';
      const { worker } = await setWorkerAvailability(nextStatus);
      setData((prev) =>
        prev ? { ...prev, worker: worker ?? { ...prev.worker!, availability: nextStatus } } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('availability.updateFailed'));
    } finally {
      setBusy(false);
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

  if (!data?.isWorker || !data.worker) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>{t('common.availability')}</Text>
        <Card style={styles.card}>
          <Text style={styles.emptyText}>{t('availability.notWorkerEmpty')}</Text>
          <Button label={t('availability.registerAsKaarigar')} onPress={() => router.push('/register-worker')} style={styles.btn} />
        </Card>
      </Screen>
    );
  }

  const isAvailable = data.worker.availability === 'available';

  return (
    <Screen scroll>
      <Text style={styles.heading}>{t('common.availability')}</Text>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View
            style={[
              styles.iconBox,
              isAvailable ? styles.iconAvailable : styles.iconBusy,
            ]}
          >
            <Ionicons
              name={isAvailable ? 'checkmark-circle' : 'pause-circle'}
              size={28}
              color={isAvailable ? colors.success : colors.warning}
            />
          </View>
          <View style={styles.info}>
            <Text style={styles.title}>
              {isAvailable ? t('availability.availableTitle') : t('availability.notAvailableTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {isAvailable ? t('availability.availableSub') : t('availability.notAvailableSub')}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={onToggle}
            disabled={busy}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Card style={styles.card}>
        <Text style={styles.statsTitle}>{t('availability.quickStats')}</Text>
        <View style={styles.statsRow}>
          <Stat label={t('common.pending')} value={data.stats?.pending ?? 0} />
          <Stat label={t('common.active')} value={data.stats?.active ?? 0} />
          <Stat label={t('common.completed')} value={data.stats?.completed ?? 0} />
        </View>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.lg, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAvailable: { backgroundColor: colors.success + '20' },
  iconBusy: { backgroundColor: colors.warning + '20' },
  info: { flex: 1 },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginBottom: spacing.md },
  statsTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.primaryBg, borderRadius: 12 },
  statValue: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 20 },
  btn: { marginTop: spacing.md },
});
