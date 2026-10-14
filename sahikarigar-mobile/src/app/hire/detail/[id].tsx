import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar, BrandLogo, Header, Screen, Timeline, type TimelineStep } from '@/components';
import { SUPPORT_PHONE } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getHire, hireAction, type ApiHire } from '@/lib/api';
import { getDeviceCoords } from '@/lib/location';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import type { HireAction } from '@/types';
import { calculateDistance, formatCurrency } from '@/utils';

function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `Today, ${time}`
    : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Demo-mode shortcuts that stand in for the worker's app. */
const DEMO_ACTIONS: { action: HireAction; label: string }[] = [
  { action: 'accept', label: 'Accept' },
  { action: 'en_route', label: 'On the way' },
  { action: 'arrived', label: 'Arrived' },
  { action: 'complete', label: 'Complete' },
];

export default function HireDetailScreen() {
  const router = useRouter();
  const { user, isDemo } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);

  const [hire, setHire] = useState<ApiHire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getHire(id)
      .then((result) => {
        if (active) {
          setHire(result.hire);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the booking.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const onHelp = () => Alert.alert('Madad chahiye?', `Support: ${SUPPORT_PHONE}`);

  const onCall = () => {
    // Whose number to dial depends on which side of the booking you are on: the
    // customer calls the kaarigar, the kaarigar calls the customer.
    const workerViewer = hire?.worker?.userId != null && hire.worker.userId === user?.id;
    const phone = workerViewer ? hire?.employer?.phone : hire?.worker?.user?.phone;
    if (!phone) {
      Alert.alert('Number hidden', 'The number is revealed once the worker accepts the booking.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const onCancel = () => {
    if (!hire) return;
    Alert.alert('Cancel this booking?', 'This booking will be cancelled.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const { hire: updated } = await hireAction(hire.id, 'cancel');
            setHire(updated);
          } catch (e) {
            Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /** Advance the booking (accept / en_route / arrived / complete / cancel). */
  const runAction = async (action: HireAction) => {
    if (!hire) return;
    setBusy(true);
    try {
      // On the way / arrived — attach live GPS so the customer's tracking
      // card shows where the kaarigar is. Best-effort; action still works
      // when permission is denied.
      const coords =
        action === 'en_route' || action === 'arrived' ? await getDeviceCoords() : null;
      const { hire: updated } = await hireAction(hire.id, action, coords ?? undefined);
      setHire(updated);
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const workerUser = hire?.worker?.user ?? null;
  const workerName = workerUser?.name ?? 'Kaarigar';

  const distance =
    user?.lat != null && user?.lng != null && hire?.workerLat != null && hire?.workerLng != null
      ? calculateDistance(user.lat, user.lng, hire.workerLat, hire.workerLng)
      : null;

  return (
    <Screen
      padded={false}
      edges={['bottom']}
      header={
        <Header
          center={<BrandLogo size={28} />}
          right={
            <Pressable onPress={onHelp} hitSlop={10}>
              <Ionicons name="help-circle-outline" size={24} color={colors.primaryDark} />
            </Pressable>
          }
        />
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : error || !hire ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.errorText}>{error ?? 'Booking not found.'}</Text>
        </View>
      ) : (
        <BookingBody
          hire={hire}
          workerName={workerName}
          workerAvatar={workerUser?.avatar}
          distance={distance}
          busy={busy}
          isDemo={isDemo}
          isWorkerViewer={hire?.worker?.userId != null && hire.worker.userId === user?.id}
          onCall={onCall}
          onCancel={onCancel}
          onAction={runAction}
          onFeedback={() =>
            router.push({ pathname: '/hire/feedback/[id]', params: { id: hire.id } })
          }
        />
      )}
    </Screen>
  );
}

function BookingBody({
  hire,
  workerName,
  workerAvatar,
  distance,
  busy,
  isDemo,
  isWorkerViewer,
  onCall,
  onCancel,
  onAction,
  onFeedback,
}: {
  hire: ApiHire;
  workerName: string;
  workerAvatar?: string | null;
  distance: number | null;
  busy: boolean;
  isDemo: boolean;
  /** True when the signed-in user IS the kaarigar for this booking. */
  isWorkerViewer: boolean;
  onCall: () => void;
  onCancel: () => void;
  onAction: (action: HireAction) => void;
  onFeedback: () => void;
}) {
  const accepted = ['accepted', 'en_route', 'arrived', 'completed'].includes(hire.status);
  const enRoute = ['en_route', 'arrived', 'completed'].includes(hire.status);
  const arrived = ['arrived', 'completed'].includes(hire.status);
  const completed = hire.status === 'completed';
  const cancelled = hire.status === 'cancelled' || hire.status === 'rejected';

  const steps: TimelineStep[] = [
    { label: 'Booked', time: fmtTime(hire.createdAt), state: 'done' },
    {
      label: 'Worker Assigned',
      time: accepted ? 'Confirmed' : 'Pending',
      state: accepted ? (enRoute ? 'done' : 'active') : 'pending',
    },
    {
      label: 'On the Way',
      time: enRoute ? fmtTime(hire.enRouteAt) : 'Pending',
      note: hire.status === 'en_route' ? 'Expected in 45 mins' : undefined,
      state: enRoute ? (arrived ? 'done' : 'active') : 'pending',
    },
    {
      label: 'Work Started',
      time: arrived ? fmtTime(hire.arrivedAt) : 'Pending',
      state: arrived ? (completed ? 'done' : 'active') : 'pending',
    },
  ];

  const eta =
    hire.status === 'en_route'
      ? 'Arriving in 45 mins'
      : hire.status === 'arrived'
        ? 'Worker has arrived'
        : hire.status === 'completed'
          ? 'Work completed'
          : hire.status === 'accepted'
            ? 'Arriving soon'
            : hire.status === 'pending'
              ? 'Waiting for worker'
              : 'Booking closed';

  const heading = cancelled
    ? 'Booking Cancelled'
    : completed
      ? 'Work Completed!'
      : hire.status === 'pending'
        ? isWorkerViewer
          ? 'New Booking Request'
          : 'Waiting for Kaarigar'
        : 'Booking Confirmed!';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusIcon, cancelled && styles.statusIconMuted]}>
          <Ionicons name={cancelled ? 'close' : 'checkmark'} size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.subtitle}>
          {cancelled
            ? 'Ye booking cancel ho gayi hai.'
            : 'Your booking is confirmed. We’ll keep you updated.'}
        </Text>

        <View style={styles.workerCard}>
          <Avatar uri={workerAvatar} name={workerName} size={54} />
          <View style={styles.workerInfo}>
            <Text style={styles.workerTag}>Worker assigned</Text>
            <Text style={styles.workerName}>{workerName}</Text>
            <View style={styles.workerMetaRow}>
              <Ionicons name="time-outline" size={13} color={colors.primaryDark} />
              <Text style={styles.workerMeta}>{eta}</Text>
              {distance != null ? (
                <>
                  <Ionicons name="location-outline" size={13} color={colors.primaryDark} />
                  <Text style={styles.workerMeta}>• ~{distance} km away</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Live Tracking</Text>
        <Timeline steps={steps} />

        <View style={styles.otpCard}>
          <Ionicons name="lock-closed" size={16} color={colors.primaryDark} />
          <Text style={styles.otpLabel}>OTP for start work</Text>
          <Text style={styles.otpValue}>{hire.startOtp ?? '----'}</Text>
          <Text style={styles.otpHint}>
            Share this OTP with the worker once they arrive to start the work
          </Text>
        </View>

        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <View style={styles.feeCol}>
              <Text style={styles.feeLabel}>Rate (per hour)</Text>
              <Text style={styles.feeValue}>{formatCurrency(hire.proposedRate)}/hr</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeCol}>
              <Text style={styles.feeLabel}>Platform Fee</Text>
              <Text style={styles.feeValue}>{formatCurrency(0)}</Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Est. total (1 hr)</Text>
            <Text style={styles.totalValue}>{formatCurrency(hire.proposedRate)}</Text>
          </View>
          <Text style={styles.totalHint}>
            Per-hour rate — badhta hai jyada kaam hone par. Pay after service • Cash / UPI
          </Text>
        </View>

        {isDemo ? (
          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>Demo mode — simulate the worker</Text>
            <Text style={styles.demoSub}>
              No backend is reachable right now, so use these buttons to walk the booking through
              every stage.
            </Text>
            <View style={styles.demoRow}>
              {DEMO_ACTIONS.map((item) => (
                <Pressable
                  key={item.action}
                  style={[styles.demoBtn, busy && styles.disabled]}
                  onPress={() => onAction(item.action)}
                  disabled={busy}
                >
                  <Text style={styles.demoBtnText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.callBtn, !accepted && styles.disabled]}
          onPress={onCall}
          disabled={!accepted}
        >
          <Ionicons name="call" size={17} color={colors.primaryDark} />
          <Text style={styles.callText}>{isWorkerViewer ? 'Call Customer' : 'Call Worker'}</Text>
        </Pressable>
        {isWorkerViewer ? (
          // Kaarigar's own actions — mirrors what the auth-server allows:
          // accept / reject (pending) → on the way → arrived → complete.
          completed ? (
            <Pressable style={styles.primaryAction} onPress={onFeedback}>
              <Text style={styles.primaryActionText}>Give Feedback</Text>
            </Pressable>
          ) : hire.status === 'pending' ? (
            <>
              <Pressable
                style={[styles.outlineAction, busy && styles.disabled]}
                onPress={() => onAction('reject')}
                disabled={busy}
              >
                <Text style={styles.outlineActionText}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryAction, busy && styles.disabled]}
                onPress={() => onAction('accept')}
                disabled={busy}
              >
                <Text style={styles.primaryActionText}>Accept</Text>
              </Pressable>
            </>
          ) : hire.status === 'accepted' ? (
            <Pressable
              style={[styles.primaryAction, busy && styles.disabled]}
              onPress={() => onAction('en_route')}
              disabled={busy}
            >
              <Text style={styles.primaryActionText}>On the way</Text>
            </Pressable>
          ) : hire.status === 'en_route' ? (
            <Pressable
              style={[styles.primaryAction, busy && styles.disabled]}
              onPress={() => onAction('arrived')}
              disabled={busy}
            >
              <Text style={styles.primaryActionText}>Arrived</Text>
            </Pressable>
          ) : arrived ? (
            <Pressable
              style={[styles.primaryAction, busy && styles.disabled]}
              onPress={() => onAction('complete')}
              disabled={busy}
            >
              <Text style={styles.primaryActionText}>Mark Complete</Text>
            </Pressable>
          ) : null
        ) : (
          // Customer's actions — cancel while it is live, feedback once done.
          <>
            {completed ? (
              <Pressable style={styles.primaryAction} onPress={onFeedback}>
                <Text style={styles.primaryActionText}>Give Feedback</Text>
              </Pressable>
            ) : arrived ? (
              <Pressable
                style={[styles.primaryAction, busy && styles.disabled]}
                onPress={() => onAction('complete')}
                disabled={busy}
              >
                <Text style={styles.primaryActionText}>Mark Complete</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.outlineAction, busy && styles.disabled]}
                onPress={onCancel}
                disabled={busy}
              >
                <Text style={styles.outlineActionText}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}
        <Pressable
          style={styles.outlineAction}
          onPress={() => Alert.alert('Madad chahiye?', `Support: ${SUPPORT_PHONE}`)}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.outlineActionText}>Help</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  brandCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  errorText: { marginTop: spacing.md, fontSize: fontSize.small, color: colors.textSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  statusIconMuted: { backgroundColor: colors.muted },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  workerInfo: { flex: 1 },
  workerTag: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  workerName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: 1 },
  workerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  workerMeta: { fontSize: fontSize.caption, color: colors.textSecondary },
  sectionTitle: {
    alignSelf: 'stretch',
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  otpCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  otpLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark, marginTop: spacing.xs },
  otpValue: { fontSize: 40, fontWeight: fontWeight.bold, color: colors.primaryDark, letterSpacing: 6, marginVertical: spacing.xs },
  otpHint: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'center' },
  feeCard: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  feeRow: { flexDirection: 'row', alignItems: 'center' },
  feeCol: { flex: 1, alignItems: 'center' },
  feeDivider: { width: 1, height: 32, backgroundColor: colors.border },
  feeLabel: { fontSize: fontSize.caption, color: colors.textSecondary },
  feeValue: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginTop: 2 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  totalLabel: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  totalValue: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  totalHint: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  callBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    backgroundColor: colors.white,
  },
  callText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  primaryAction: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  primaryActionText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.white },
  outlineAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  outlineActionText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.textPrimary },
  disabled: { opacity: 0.5 },
  demoCard: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryTint,
  },
  demoTitle: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primaryDark },
  demoSub: { fontSize: fontSize.caption - 1, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  demoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  demoBtnText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.white },
});


