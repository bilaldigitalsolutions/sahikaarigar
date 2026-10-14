import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, spacing } from '@/theme';

export type TimelineState = 'done' | 'active' | 'pending';

export interface TimelineStep {
  label: string;
  /** Right-aligned timestamp / status text. */
  time?: string;
  /** Small helper line under the label (e.g. "Expected in 45 mins"). */
  note?: string;
  state: TimelineState;
}

export interface TimelineProps {
  steps: TimelineStep[];
}

/** Vertical progress tracker (used by the live-tracking booking screen). */
export function Timeline({ steps }: TimelineProps) {
  return (
    <View style={styles.root}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const done = step.state === 'done';
        const active = step.state === 'active';

        return (
          <View key={step.label} style={styles.row}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : active ? (
                  <View style={styles.dotInner} />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.connector,
                    done ? styles.connectorDone : styles.connectorPending,
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.body, isLast && styles.bodyLast]}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    active && styles.labelActive,
                    step.state === 'pending' && styles.labelPending,
                  ]}
                >
                  {step.label}
                </Text>
                {step.time ? (
                  <Text style={[styles.time, step.state === 'pending' && styles.timePending]}>
                    {step.time}
                  </Text>
                ) : null}
              </View>
              {step.note ? <Text style={styles.note}>{step.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 26;

const styles = StyleSheet.create({
  // `flex: 1` rows collapse when a parent centers its children (e.g. the booking
  // screen's content container) — keep the tracker full width regardless.
  root: { alignSelf: 'stretch' },
  row: { flexDirection: 'row' },
  gutter: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  dotActive: { borderColor: colors.primaryDark, backgroundColor: colors.white },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryDark,
  },
  connector: { width: 2, flex: 1, marginVertical: 2 },
  connectorDone: { backgroundColor: colors.primaryDark },
  connectorPending: { backgroundColor: colors.border },
  body: { flex: 1, marginLeft: spacing.md, paddingBottom: spacing.xl },
  bodyLast: { paddingBottom: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  labelActive: { color: colors.primaryDark },
  labelPending: { color: colors.muted, fontWeight: fontWeight.medium },
  time: { fontSize: fontSize.caption, color: colors.textSecondary },
  timePending: { color: colors.muted },
  note: { fontSize: fontSize.caption, color: colors.primaryDark, marginTop: 2 },
});
