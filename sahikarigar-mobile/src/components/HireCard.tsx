import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { HIRE_STATUS_LABELS, skillLabel } from '@/constants';
import type { ApiHire } from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { formatCurrency, formatRelativeDate } from '@/utils';

export interface HireCardProps {
  hire: ApiHire;
  /** Whose side of the hire to show (the other party is the headline). */
  perspective: 'employer' | 'worker';
  onPress?: () => void;
}

const TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary'> = {
  pending: 'warning',
  accepted: 'primary',
  en_route: 'primary',
  arrived: 'primary',
  completed: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
};

export function HireCard({ hire, perspective, onPress }: HireCardProps) {
  const counterparty =
    perspective === 'employer' ? hire.worker?.user?.name : hire.employer?.name;
  const title = counterparty ?? 'Booking';
  const skills = hire.worker?.skills?.map(skillLabel).join(' • ');

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Badge label={HIRE_STATUS_LABELS[hire.status]} tone={TONE[hire.status] ?? 'neutral'} />
      </View>

      {skills ? <Text style={styles.skills}>{skills}</Text> : null}
      <Text style={styles.description} numberOfLines={2}>
        {hire.description}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.meta}>{formatCurrency(hire.proposedRate)}</Text>
        <Text style={styles.meta}>{hire.location}</Text>
        <Text style={styles.meta}>{formatRelativeDate(hire.createdAt)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  skills: { fontSize: fontSize.caption, color: colors.primaryDark, marginTop: 2 },
  description: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
});
