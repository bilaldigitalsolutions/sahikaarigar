import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar, BrandLogo, Button, Header, Screen, Timeline, type TimelineStep } from '@/components';
import { SUPPORT_PHONE } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getHire, getHireStartOtp, hireAction, type ApiHire } from '@/lib/api';
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
  { action: 'start', label: 'Start Work' },
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

  // Fetch the booking — runs on mount, on every screen focus, AND every 10s
  // while the screen stays open. The live poll is what lets the employer see
  // the kaarigar's status change (accepted → on the way → arrived) without
  // leaving the screen, so the Start Work OTP appears the moment the worker
  // marks "Arrived". A silent refresh never flashes the loading spinner.
  const fetchHire = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await getHire(id);
        setHire(result.hire);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the booking.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchHire();
    }, [fetchHire]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchHire(true);
    }, 10_000);
    return () => clearInterval(timer);
  }, [fetchHire]);

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

  /** Advance the booking (accept / en_route / arrived / start / complete / cancel). */
  const runAction = async (action: HireAction, otp?: string) => {
    if (!hire) return;
    setBusy(true);
    try {
      // On the way / arrived — attach live GPS so the customer's tracking
      // card shows where the kaarigar is. Best-effort; action still works
      // when permission is denied.
      const coords =
        action === 'en_route' || action === 'arrived' ? await getDeviceCoords() : null;
      // Demo: the demo employer "shares" the OTP automatically so the
      // simulated Start Work verifies without typing anything.
      const otpToSend = otp ?? (action === 'start' && isDemo ? hire?.startOtp ?? undefined : undefined);
      const { hire: updated } = await hireAction(hire.id, action, coords ?? undefined, otpToSend);
      setHire(updated);
    } catch (e) {
      // The inline OTP entry passes a code and wants to show the error next
      // to its own field — let it bubble. Everything else surfaces an Alert.
      if (otp != null) throw e;
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
          showBack={false}
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
  /** Runs a hire action; it rethrows (instead of alerting) when an `otp` is
   *  given, so the inline OTP entry can show the error next to the field. */
  onAction: (action: HireAction, otp?: string) => Promise<void>;
  onFeedback: () => void;
}) {
  const completed = hire.status === 'completed';
  const [startOtp, setStartOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpEntry, setOtpEntry] = useState('');
  const [otpEntryVisible, setOtpEntryVisible] = useState(false);
  const [otpEntryError, setOtpEntryError] = useState<string | null>(null);

  const otpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The employer taps "Show OTP to Worker" to reveal the code. Auto-revealed
   *  the moment it arrives so the code is never missed. */
  const [otpRevealed, setOtpRevealed] = useState(false);

  // Fetch the start-work OTP once. Used both on first render and by the poller.
  const fetchStartOtp = useCallback(async () => {
    if (isWorkerViewer || hire.status !== 'arrived') return;
    let active = true;
    console.log('[HireDetail] fetching start OTP for hire', hire.id, 'status:', hire.status);
    try {
      const { otp } = await getHireStartOtp(hire.id);
      console.log('[HireDetail] start OTP received:', otp);
      if (active) {
        setStartOtp(otp);
        setOtpError(null);
        // Reveal it right away — the employer's whole job here is to read it
        // out to the worker.
        setOtpRevealed(true);
      }
    } catch (e) {
      if (active) setOtpError(e instanceof Error ? e.message : 'OTP load nahi hua');
    }
    return () => {
      active = false;
    };
  }, [hire.id, hire.status, isWorkerViewer]);

  // Poll every 5 seconds while the worker is 'arrived' and we still don't
  // have the OTP. This guarantees the employer's screen never stays stuck on
  // `----` if the first fetch races with the worker's status update.
  useEffect(() => {
    fetchStartOtp();

    if (hire.status === 'arrived' && !startOtp && !otpError) {
      otpPollRef.current = setInterval(fetchStartOtp, 5000);
    } else {
      if (otpPollRef.current) {
        clearInterval(otpPollRef.current);
        otpPollRef.current = null;
      }
    }

    return () => {
      if (otpPollRef.current) {
        clearInterval(otpPollRef.current);
        otpPollRef.current = null;
      }
    };
  }, [hire.status, startOtp, otpError, fetchStartOtp]);

  /** Worker: verify the OTP shared by the customer and start the job.
   *  Errors surface inline — `onAction` rethrows when an `otp` is passed. */
  const verifyStartOtp = async () => {
    setOtpEntryError(null);
    try {
      await onAction('start', otpEntry.trim());
      setOtpEntryVisible(false);
      setOtpEntry('');
    } catch (e) {
      setOtpEntryError(e instanceof Error ? e.message : 'OTP galat hai — dobara try karo');
    }
  };

  const accepted = ['accepted', 'en_route', 'arrived', 'in_progress', 'completed'].includes(hire.status);
  const enRoute = ['en_route', 'arrived', 'in_progress', 'completed'].includes(hire.status);
  const arrived = ['arrived', 'in_progress', 'completed'].includes(hire.status);
  /** OTP verified — the kaarigar is actually working now. */
  const workStarted = hire.status === 'in_progress' || completed;
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
      time: workStarted
        ? hire.startedAt
          ? fmtTime(hire.startedAt)
          : 'Active'
        : hire.status === 'arrived'
          ? 'Waiting for OTP'
          : 'Pending',
      note: hire.status === 'arrived' ? 'Customer ke screen ka OTP darj karain' : undefined,
      state: workStarted ? (completed ? 'done' : 'active') : 'pending',
    },
  ];

  const eta =
    hire.status === 'en_route'
      ? 'Arriving in 45 mins'
      : hire.status === 'arrived'
        ? 'Worker has arrived'
        : hire.status === 'in_progress'
          ? 'Work in progress'
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
      : workStarted
        ? 'Work in Progress'
        : hire.status === 'pending'
          ? isWorkerViewer
            ? 'New Booking Request'
            : 'Waiting for worker to accept your request'
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
            : hire.status === 'pending'
              ? 'Request kaarigar ko bhej di gayi hai — accept karte hi aapko notification milega.'
              : 'Your booking is confirmed. We’ll keep you updated.'}
        </Text>

        {/* EMPLOYER ACTION BANNER — the kaarigar has arrived and the OTP is
            waiting to be shared. This is the one moment that needs the
            customer's attention, so it is impossible to miss. */}
        {!isWorkerViewer && hire.status === 'arrived' ? (
          <View style={styles.arrivedBanner}>
            <Ionicons name="location" size={20} color={colors.white} />
            <View style={styles.arrivedTextWrap}>
              <Text style={styles.arrivedTitle}>Kaarigar pahunch gaya hai!</Text>
              <Text style={styles.arrivedSub}>
                Neeche OTP dekhein aur worker ko de dijiye — wahi kaam shuru kar sakega.
              </Text>
            </View>
          </View>
        ) : null}

        {accepted || cancelled ? (
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
        ) : null}

        <Text style={styles.sectionTitle}>Live Tracking</Text>
        <Timeline steps={steps} />

        {/* "Start work" OTP — shown to the EMPLOYER only, and only from the
            moment the kaarigar has arrived. The code is revealed with a
            prominent button so the customer can read it out to the worker. */}
        {!isWorkerViewer && hire.status === 'arrived' ? (
          <View style={styles.otpCard}>
            <Ionicons name="key" size={16} color={colors.primaryDark} />
            <Text style={styles.otpLabel}>Start Work OTP</Text>

            {otpError ? (
              <Text style={styles.otpErrorText}>{otpError}</Text>
            ) : startOtp && otpRevealed ? (
              <>
                <Text style={styles.otpValue}>{startOtp}</Text>
                <Text style={styles.otpHint}>
                  Ye 4-digit code worker ko dijiye — wahi enter karke kaam shuru hoga.
                </Text>
                <Pressable style={styles.otpHideBtn} onPress={() => setOtpRevealed(false)}>
                  <Ionicons name="eye-off-outline" size={14} color={colors.primaryDark} />
                  <Text style={styles.otpHideText}>Hide OTP</Text>
                </Pressable>
              </>
            ) : startOtp ? (
              <>
                <Pressable style={styles.otpShowBtn} onPress={() => setOtpRevealed(true)}>
                  <Ionicons name="key" size={18} color={colors.white} />
                  <Text style={styles.otpShowText}>Show OTP to Worker</Text>
                </Pressable>
                <Text style={styles.otpHint}>
                  OTP mil gaya hai — worker ko share karne ke liye upar wala button dabao.
                </Text>
              </>
            ) : (
              <View style={styles.otpLoadingRow}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.otpHint}>OTP load ho raha hai…</Text>
              </View>
            )}
          </View>
        ) : null}
        {workStarted ? (
          <View style={[styles.otpCard, styles.otpCardDone]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.otpLabel, styles.otpLabelDone]}>
              OTP verified — kaam shuru ho gaya
            </Text>
            <Text style={styles.otpHint}>
              Kaarigar aapke diye OTP se kaam shuru kar chuka hai.
            </Text>
          </View>
        ) : null}

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

      {/* Worker-entered OTP gate: "Start Work" only verifies with the code
          the customer sees on their tracking screen. */}
      {isWorkerViewer && hire.status === 'arrived' && otpEntryVisible ? (
        <View style={styles.otpEntryCard}>
          <Text style={styles.otpEntryTitle}>Enter OTP from customer</Text>
          <Text style={styles.otpEntrySub}>
            Customer ke screen par OTP check karain aur yahan darj karain.
          </Text>
          <View style={styles.otpEntryRow}>
            <TextInput
              style={styles.otpEntryInput}
              value={otpEntry}
              onChangeText={(text) => {
                setOtpEntry(text.replace(/\D/g, '').slice(0, 4));
                if (otpEntryError) setOtpEntryError(null);
              }}
              placeholder="‒ ‒ ‒ ‒"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
            <Button
              label="Verify & start"
              onPress={verifyStartOtp}
              loading={busy}
              disabled={otpEntry.trim().length !== 4}
            />
          </View>
          <Pressable onPress={() => setOtpEntryVisible(false)} hitSlop={8}>
            <Text style={styles.otpEntryCancel}>Cancel</Text>
          </Pressable>
          {otpEntryError ? <Text style={styles.otpEntryError}>{otpEntryError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <View style={styles.bottomCol}>
          {/* Call button spans its own line so long hints never squeeze the
              action buttons — the old single row cramped them on small
              screens and left uneven margins. */}
          <View style={styles.callWrap}>
            <Pressable
              style={[styles.callBtn, !accepted && styles.disabled]}
              onPress={onCall}
              disabled={!accepted}
            >
              <Ionicons name="call" size={17} color={colors.primaryDark} />
              <Text style={styles.callText}>{isWorkerViewer ? 'Call Customer' : 'Call Worker'}</Text>
            </Pressable>
            {!accepted ? (
              <Text style={styles.callHint}>
                {isWorkerViewer
                  ? 'Number revealed once you accept the request'
                  : 'Number revealed once worker accepts'}
              </Text>
            ) : null}
          </View>
          <View style={styles.actionsRow}>
            {isWorkerViewer ? (
              // Kaarigar's own actions — mirrors what the auth-server allows:
              // accept / reject (pending) → on the way → arrived → start (OTP) →
              // the CUSTOMER completes the job. Sirf customer review deta hai
              // (server rejects anyone else), so the kaarigar gets NO feedback
              // button here — after completion only Help remains.
              completed ? null : hire.status === 'pending' ? (
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
            <>
              {/* Kaarigar ka cancel — allowed only until the work has actually
                  started (server rejects it after the OTP / start). */}
              <Pressable
                style={[styles.outlineAction, busy && styles.disabled]}
                onPress={onCancel}
                disabled={busy}
              >
                <Text style={styles.outlineActionText}>Cancel Job</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryAction, busy && styles.disabled]}
                onPress={() => onAction('en_route')}
                disabled={busy}
              >
                <Text style={styles.primaryActionText}>On the way</Text>
              </Pressable>
            </>
          ) : hire.status === 'en_route' ? (
            <>
              <Pressable
                style={[styles.outlineAction, busy && styles.disabled]}
                onPress={onCancel}
                disabled={busy}
              >
                <Text style={styles.outlineActionText}>Cancel Job</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryAction, busy && styles.disabled]}
                onPress={() => onAction('arrived')}
                disabled={busy}
              >
                <Text style={styles.primaryActionText}>Arrived</Text>
              </Pressable>
            </>
          ) : hire.status === 'arrived' ? (
            <Pressable
              style={[styles.primaryAction, busy && styles.disabled]}
              onPress={() => setOtpEntryVisible(true)}
              disabled={busy}
            >
              <Text style={styles.primaryActionText}>Start Work</Text>
            </Pressable>
          ) : null
        ) : (
          // Customer's actions — cancel while the job is live (even mid-job,
          // the kaarigar has already reached), feedback once done.
          <>
            {completed ? (
              <Pressable style={styles.primaryAction} onPress={onFeedback}>
                <Text style={styles.primaryActionText}>Give Feedback</Text>
              </Pressable>
            ) : (
              <>
                {arrived ? (
                  <Pressable
                    style={[styles.primaryAction, busy && styles.disabled]}
                    onPress={() => onAction('complete')}
                    disabled={busy}
                  >
                    <Text style={styles.primaryActionText}>Mark Complete</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.outlineAction, busy && styles.disabled]}
                  onPress={onCancel}
                  disabled={busy}
                >
                  <Text style={styles.outlineActionText}>Cancel Job</Text>
                </Pressable>
              </>
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
        </View>
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
  workerMeta: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
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
  otpCardDone: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  otpLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark, marginTop: spacing.xs },
  otpLabelDone: { color: '#16A34A' },
  otpValue: { fontSize: 40, fontWeight: fontWeight.bold, color: colors.primaryDark, letterSpacing: 6, marginVertical: spacing.xs },
  otpHint: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'center' },
  otpErrorText: {
    fontSize: fontSize.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  otpLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  otpShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  otpShowText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.white },
  otpHideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  otpHideText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.primaryDark,
  },
  // Employer action banner — the kaarigar has arrived.
  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.primaryDark,
  },
  arrivedTextWrap: { flex: 1 },
  arrivedTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  arrivedSub: {
    fontSize: fontSize.caption,
    color: colors.white,
    opacity: 0.9,
    marginTop: 2,
    lineHeight: 17,
  },
  otpEntryCard: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  otpEntryTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  otpEntrySub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  otpEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  otpEntryInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 8,
    color: colors.textPrimary,
  },
  otpEntryCancel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  otpEntryError: {
    fontSize: fontSize.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
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
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  bottomCol: { alignSelf: 'stretch' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  callWrap: {
    alignItems: 'stretch',
  },
  callBtn: {
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
  callHint: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    marginTop: 4,
  },
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


