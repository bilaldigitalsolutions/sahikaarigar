import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, Rating } from '@/components/ui';
import { areaLabel, skillLabel } from '@/constants';
import type { ApiWorker } from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { formatCurrency } from '@/utils';

export interface WorkerCardProps {
  worker: ApiWorker;
  onPress?: () => void;
}

export function WorkerCard({ worker, onPress }: WorkerCardProps) {
  const user = worker.user;
  const name = user?.name ?? 'Kaarigar';
  const area = user?.locationArea ?? worker.serviceAreas[0];

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={user?.avatar} name={name} size={56} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {user?.isVerified ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            ) : null}
          </View>
          <Text style={styles.skills} numberOfLines={1}>
            {worker.skills.map(skillLabel).join(' • ') || 'Kaarigar'}
          </Text>
          <Rating value={worker.ratingAverage} count={worker.ratingCount} />
        </View>
      </View>

      <View style={styles.footer}>
        <Badge label={`${formatCurrency(worker.hourlyRate)}/hr`} tone="primary" />
        {area ? <Text style={styles.area}>{areaLabel(area)}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary, flexShrink: 1 },
  skills: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, marginBottom: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  area: { fontSize: fontSize.caption, color: colors.textSecondary },
});
