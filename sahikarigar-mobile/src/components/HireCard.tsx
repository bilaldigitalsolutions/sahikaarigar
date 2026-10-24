import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { HIRE_STATUS_LABELS } from '@/constants';
import type { ApiHire } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import {
  formatCurrency,
  formatRelativeDate,
  getWorkerBadge,
  workerBadgeTone,
} from '@/utils';

export interface HireCardProps {
  hire: ApiHire;
  /** Whose side of the hire to show (the other party is the headline). */
  perspective: 'employer' | 'worker';
  onPress?: () => void;
  /** Optional callout — e.g. "OTP Ready" when the kaarigar has arrived and
   *  the employer still has to share the start-work code. */
  notice?: { label: string; tone?: 'primary' | 'warning' | 'success' | 'danger' };
}

const TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary'> = {
  pending: 'warning',
  accepted: 'primary',
  en_route: 'primary',
  arrived: 'primary',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
};

export function HireCard({ hire, perspective, onPress, notice }: HireCardProps) {
  const counterparty =
    perspective === 'employer' ? hire.worker?.user?.name : hire.employer?.name;
  const title = counterparty ?? 'Booking';
  const workerBadge = hire.worker ? getWorkerBadge(hire.worker) : null;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {workerBadge ? (
            <Badge label={`${workerBadge} Worker`} tone={workerBadgeTone(workerBadge)} />
          ) : null}
        </View>
        <Badge label={HIRE_STATUS_LABELS[hire.status]} tone={TONE[hire.status] ?? 'neutral'} />
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Ionicons name="key" size={13} color={colors.primaryDark} />
          <Text style={styles.noticeText}>{notice.label}</Text>
        </View>
      ) : null}

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  noticeText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  description: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
});
