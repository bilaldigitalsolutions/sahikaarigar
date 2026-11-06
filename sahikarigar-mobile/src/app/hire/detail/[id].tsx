import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SUPPORT_PHONE, areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getHire, getHireStartOtp, hireAction, type ApiHire } from '@/lib/api';
import { openDirections, openMapLocation } from '@/lib/directions';
import { canCall, canCancel } from '@/lib/hireRules';
import { getDeviceCoords } from '@/lib/location';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import type { HireAction, HireStatus } from '@/types';
import { calculateDistance, formatCurrency, formatDuration, formatRatingSummary } from '@/utils';

function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `Today, ${time}`
    : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

const DEMO_ACTIONS: { action: HireAction; label: string }[] = [
  { action: 'accept', label: 'Accept' },
  { action: 'en_route', label: 'On the way' },
  { action: 'arrived', label: 'Arrived' },
  { action: 'start', label: 'Start Work' },
  { action: 'complete', label: 'Complete' },
];

/** Demo mode only: the status each simulated action is valid from. Without
 *  this, the old demo panel showed "Start Work" while the worker was still
 *  On the way. The real server enforces the same order. */
const DEMO_ACTION_FROM: Partial<Record<HireAction, HireStatus>> = {
  accept: 'pending',
  en_route: 'accepted',
  arrived: 'en_route',
  start: 'arrived',
  complete: 'in_progress',
};

export default function HireDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isDemo } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);

  const [hire, setHire] = useState<ApiHire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isMountedRef = useRef(false);

  const fetchHire = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await getHire(id);
        if (!isMountedRef.current) return;
        if (result.hire) setHire(result.hire);
        setError(null);
      } catch (e) {
        if (!isMountedRef.current) return;
        setError(e instanceof Error ? e.message : t('common.error'));
      } finally {
        if (!silent && isMountedRef.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void fetchHire();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchHire();
    }, [fetchHire]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchHire(true);
    }, 3_000);
    return () => clearInterval(timer);
  }, [fetchHire]);

  const onHelp = () => Alert.alert(t('common.help'), `Support: ${SUPPORT_PHONE}`);

  const onCall = () => {
    // Defence in depth: even if a stale render leaves the button enabled,
    // never start a call once work has started or the booking is closed.
    if (!hire || !canCall(hire.status)) return;
    const workerViewer = hire?.worker?.userId != null && hire?.worker?.userId === user?.id;
    const phone = workerViewer ? hire?.employer?.phone : hire?.worker?.user?.phone;
    if (!phone) {
      Alert.alert(t('hireDetail.numberHidden'), t('hireDetail.numberRevealed'));
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const onCancel = () => {
    if (!hire || !canCancel(hire.status)) return;
    Alert.alert(t('hireDetail.cancelBooking'), t('hireDetail.cancelBookingSub'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const { hire: updated } = await hireAction(hire.id, 'cancel');
            setHire(updated);
          } catch (e) {
            Alert.alert(t('hireDetail.couldNotCancel'), e instanceof Error ? e.message : t('common.error'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const runAction = async (action: HireAction, otp?: string) => {
    if (!hire) return;
    setBusy(true);
    try {
      const coords =
        action === 'en_route' || action === 'arrived'
          ? await getDeviceCoords({ fresh: true })
          : null;
      const otpToSend = otp ?? (action === 'start' && isDemo ? hire?.startOtp ?? undefined : undefined);
      const { hire: updated } = await hireAction(hire.id, action, coords ?? undefined, otpToSend);
      setHire(updated);

      // "On the way" now immediately opens the route to the customer's
      // address; the detail screen also keeps a Get Directions button visible
      // while the worker is en_route / arrived.
      if (action === 'en_route' && updated.status === 'en_route') {
        void openDirections({ label: updated.location || updated.homeLocation });
      }
    } catch (e) {
      if (otp != null) throw e;
      Alert.alert(t('hireDetail.couldNotUpdate'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const workerUser = hire?.worker?.user ?? null;
  const workerName = workerUser?.name ?? t('common.worker');
  const isWorkerViewer = hire?.worker?.userId != null && hire?.worker?.userId === user?.id;

  // The booking distance is customer -> worker. Only show it on the customer's
  // screen; for the worker their own coordinates are the origin, not a
  // meaningful "distance away".
  const distance =
    !isWorkerViewer &&
    user?.lat != null &&
    user?.lng != null &&
    hire?.workerLat != null &&
    hire?.workerLng != null
      ? calculateDistance(user.lat, user.lng, hire.workerLat, hire.workerLng)
      : null;

  return (
    <>
      <Screen padded={false} edges={['bottom']} header={<Header center={<BrandLogo size={28} />} showBack={false} right={<Pressable onPress={onHelp} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.help')}><Ionicons name="help-circle-outline" size={24} color={colors.primaryDark} /></Pressable>} />}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : !hire ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
            <Text style={styles.errorText}>{t('common.error')}</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            <BookingBody
              hire={hire}
              workerName={workerName}
              workerAvatar={workerUser?.avatar}
              distance={distance}
              busy={busy}
              isDemo={isDemo}
              isWorkerViewer={isWorkerViewer}
              onCall={onCall}
              onCancel={onCancel}
              onAction={runAction}
              onFeedback={() => router.push({ pathname: '/hire/feedback/[id]', params: { id: hire.id } })}
              router={router}
              onHelp={onHelp}
            />
          </>
        )}
      </Screen>
    </>
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
  router,
  onHelp,
}: {
  hire: ApiHire;
  workerName: string;
  workerAvatar?: string | null;
  distance: number | null;
  busy: boolean;
  isDemo: boolean;
  isWorkerViewer: boolean;
  onCall: () => void;
  onCancel: () => void;
  onAction: (action: HireAction, otp?: string) => Promise<void>;
  onFeedback: () => void;
  router: ReturnType<typeof useRouter>;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const completed = hire.status === 'completed';
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Re-render the live duration while work is running. The screen already
  // polls the server every 3 seconds; this keeps the timer moving between
  // refreshes without re-rendering every second.
  useEffect(() => {
    if (hire.status !== 'in_progress') return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [hire.status, hire.startedAt]);

  // Start Work is a WORKER action and only exists after Arrived + customer OTP.
  // Keep this flag explicit so accepted/en_route can never show it again.
  const canStartWork = isWorkerViewer && hire.status === 'arrived';
  // The customer's OTP card is the mirror image of the worker's Start Work.
  const showStartOtp = !isWorkerViewer && hire.status === 'arrived';
  const [startOtp, setStartOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpEntry, setOtpEntry] = useState('');
  const [otpEntryVisible, setOtpEntryVisible] = useState(false);
  const [otpEntryError, setOtpEntryError] = useState<string | null>(null);

  const otpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [otpRevealed, setOtpRevealed] = useState(false);

  const fetchStartOtp = useCallback(async () => {
    if (!showStartOtp) return;
    try {
      const { otp } = await getHireStartOtp(hire.id);
      setStartOtp(otp);
      setOtpError(null);
      setOtpRevealed(true);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : t('hireDetail.otpLoadFailed'));
    }
  }, [hire.id, showStartOtp, t]);

  useEffect(() => {
    if (!showStartOtp) {
      setStartOtp(null);
      setOtpError(null);
      if (otpPollRef.current) {
        clearInterval(otpPollRef.current);
        otpPollRef.current = null;
      }
      return;
    }

    fetchStartOtp();

    if (!startOtp) {
      otpPollRef.current = setInterval(fetchStartOtp, 3000);
    } else if (otpPollRef.current) {
      clearInterval(otpPollRef.current);
      otpPollRef.current = null;
    }

    return () => {
      if (otpPollRef.current) {
        clearInterval(otpPollRef.current);
        otpPollRef.current = null;
      }
    };
  }, [showStartOtp, startOtp, fetchStartOtp]);

  const verifyStartOtp = async () => {
    if (!hire) return;
    setOtpEntryError(null);
    try {
      await onAction('start', otpEntry.trim());
      setOtpEntryVisible(false);
      setOtpEntry('');
    } catch (e) {
      setOtpEntryError(e instanceof Error ? e.message : t('hireDetail.otpWrong'));
    }
  };

  const accepted = ['accepted', 'en_route', 'arrived', 'in_progress', 'completed'].includes(hire.status);
  const enRoute = ['en_route', 'arrived', 'in_progress', 'completed'].includes(hire.status);
  const arrived = ['arrived', 'in_progress', 'completed'].includes(hire.status);
  const workStarted = hire.status === 'in_progress' || completed;
  const cancelled = hire.status === 'cancelled' || hire.status === 'rejected';
  const callEnabled = canCall(hire.status);
  const cancelEnabled = canCancel(hire.status);
  const showDirections = isWorkerViewer && ['en_route', 'arrived'].includes(hire.status);
  const showLiveWorker = !isWorkerViewer && ['en_route', 'arrived'].includes(hire.status);
  const workerArea = hire.worker?.user?.locationArea
    ? areaLabel(hire.worker.user.locationArea)
    : null;
  const customerName = hire.employer?.name ?? 'Customer';
  const customerRating = hire.customerRating ?? null;
  const workerRating = hire.worker
    ? {
        average: hire.worker.ratingAverage,
        count: hire.worker.ratingCount,
      }
    : null;
  const hasWorkerCoords = hire.workerLat != null && hire.workerLng != null;
  const demoActions = isDemo
    ? DEMO_ACTIONS.filter((item) => DEMO_ACTION_FROM[item.action] === hire.status)
    : [];

  // Final bill = actual work time × hourly rate. While work is in progress,
  // `completedAt` is absent so the current clock is the end time. When the job
  // is completed, the server's stored total is authoritative.
  const workerRate = Number(hire.worker?.hourlyRate);
  const hourlyRate =
    Number.isFinite(workerRate) && workerRate > 0 ? workerRate : Number(hire.proposedRate ?? 0);
  const startedAtMs = hire.startedAt ? new Date(hire.startedAt).getTime() : NaN;
  const completedAtMs = hire.completedAt ? new Date(hire.completedAt).getTime() : NaN;
  const endMs = completed && Number.isFinite(completedAtMs) ? completedAtMs : nowMs;
  const computedDurationMinutes =
    Number.isFinite(startedAtMs) && Number.isFinite(endMs)
      ? Math.max(0, (endMs - startedAtMs) / 60000)
      : NaN;
  const serverDurationMinutes =
    hire.durationMinutes != null ? Number(hire.durationMinutes) : NaN;
  const durationMinutes = Number.isFinite(serverDurationMinutes)
    ? serverDurationMinutes
    : computedDurationMinutes;
  const hasDuration = Number.isFinite(durationMinutes);
  const durationLabel = hasDuration ? formatDuration(durationMinutes) : '—';
  const computedTotal = hasDuration ? (durationMinutes / 60) * hourlyRate : 0;
  const storedTotal = hire.totalAmount != null ? Number(hire.totalAmount) : NaN;
  const totalAmount = Number.isFinite(storedTotal) ? storedTotal : computedTotal;
  const totalDisplay =
    Number.isFinite(storedTotal) || hasDuration ? formatCurrency(totalAmount) : '—';

  const onGetDirections = () => {
    void openDirections({ label: hire.location || hire.homeLocation });
  };

  const onTrackWorker = () => {
    void openMapLocation({
      lat: hire.workerLat,
      lng: hire.workerLng,
      label: workerArea ?? hire.location,
    });
  };

  const steps: TimelineStep[] = [
    { label: t('common.booked'), time: fmtTime(hire.createdAt), state: 'done' },
    {
      label: t('hireDetail.workerAssigned'),
      time: accepted ? t('hireDetail.confirmed') : t('common.pending'),
      state: accepted ? (enRoute ? 'done' : 'active') : 'pending',
    },
    {
      label: t('hireDetail.onTheWay'),
      time: enRoute ? fmtTime(hire.enRouteAt) : t('common.pending'),
      note: hire.status === 'en_route' ? t('hireDetail.expectedIn45') : undefined,
      state: enRoute ? (arrived ? 'done' : 'active') : 'pending',
    },
    {
      label: t('hireDetail.workStarted'),
      time: workStarted
        ? hire.startedAt
          ? fmtTime(hire.startedAt)
          : t('hireDetail.active')
        : hire.status === 'arrived'
          ? t('hireDetail.waitingForOTP')
          : t('common.pending'),
      note: hire.status === 'arrived' ? t('hireDetail.customerOTP') : undefined,
      state: workStarted ? (completed ? 'done' : 'active') : 'pending',
    },
  ];

  const eta =
    hire.status === 'en_route'
      ? t('hireDetail.arrivingIn45')
      : hire.status === 'arrived'
        ? t('hireDetail.workerHasArrived')
        : hire.status === 'in_progress'
          ? t('hireDetail.workInProgress')
          : hire.status === 'completed'
            ? t('hireDetail.workCompleted')
            : hire.status === 'accepted'
              ? t('hireDetail.arrivingSoon')
              : hire.status === 'pending'
                ? t('hireDetail.waitingForWorker')
                : t('hireDetail.bookingClosed');

  const heading = cancelled
    ? t('hireDetail.bookingCancelled')
    : completed
      ? t('hireDetail.workCompletedTitle')
      : workStarted
        ? t('hireDetail.workInProgressTitle')
        : hire.status === 'pending'
          ? isWorkerViewer
            ? t('hireDetail.newBookingRequest')
            : t('hireDetail.waitingForWorker')
          : t('hireDetail.bookingConfirmedTitle');

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusIcon, cancelled && styles.statusIconMuted]}>
          <Ionicons name={cancelled ? 'close' : 'checkmark'} size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.subtitle}>
          {cancelled
            ? t('hireDetail.bookingCancelledSub')
            : hire.status === 'pending'
              ? t('hireDetail.requestSent')
              : completed
                ? t('hireDetail.workCompletedMsg')
                : t('hireDetail.bookingConfirmedMsg')}
        </Text>

        {showStartOtp ? (
          <View style={styles.arrivedBanner}>
            <Ionicons name="location" size={20} color={colors.white} />
            <View style={styles.arrivedTextWrap}>
              <Text style={styles.arrivedTitle}>{t('hireDetail.arrivedTitle')}</Text>
              <Text style={styles.arrivedSub}>{t('hireDetail.arrivedSub')}</Text>
            </View>
          </View>
        ) : null}

        {accepted || cancelled ? (
          <View style={styles.workerCard}>
            <Avatar uri={workerAvatar} name={workerName} size={54} />
            <View style={styles.workerInfo}>
              <Text style={styles.workerTag}>{t('hireDetail.workerAssigned')}</Text>
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

        <Text style={styles.sectionTitle}>{t('hireDetail.trustTitle')}</Text>
        <View style={styles.trustCard}>
          <View style={styles.trustRow}>
            <View style={styles.trustIcon}>
              <Ionicons name="person-outline" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.trustInfo}>
              <Text style={styles.trustName} numberOfLines={1}>
                {t('hireDetail.customerLine', { name: customerName })}
              </Text>
              <Text style={styles.trustRating}>{formatRatingSummary(customerRating, t)}</Text>
            </View>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustRow}>
            <View style={styles.trustIcon}>
              <Ionicons name="construct-outline" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.trustInfo}>
              <Text style={styles.trustName} numberOfLines={1}>
                {t('hireDetail.workerLine', { name: workerName })}
              </Text>
              <Text style={styles.trustRating}>{formatRatingSummary(workerRating, t)}</Text>
            </View>
          </View>
        </View>

        {showDirections ? (
          <View style={styles.directionsCard}>
            <View style={styles.directionsHead}>
              <Ionicons name="navigate" size={18} color={colors.primaryDark} />
              <Text style={styles.directionsTitle}>{t('hireDetail.routeToCustomer')}</Text>
            </View>
            <Text style={styles.directionsAddress} numberOfLines={3}>
              {hire.location}
            </Text>
            {hire.homeLocation ? (
              <Text style={styles.directionsSub} numberOfLines={2}>
                {hire.homeLocation}
              </Text>
            ) : null}
            <Pressable
              style={styles.directionsBtn}
              onPress={onGetDirections}
              accessibilityRole="button"
              accessibilityLabel={t('hireDetail.getDirections')}
            >
              <Ionicons name="map-outline" size={17} color={colors.white} />
              <Text style={styles.directionsBtnText}>{t('hireDetail.getDirections')}</Text>
            </Pressable>
          </View>
        ) : null}

        {showLiveWorker ? (
          <View style={styles.liveCard}>
            <View style={styles.liveHead}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTitle}>{t('hireDetail.workerLiveLocation')}</Text>
            </View>
            <Text style={styles.liveSub}>
              {workerArea
                ? t('hireDetail.workerNearArea', { area: workerArea })
                : t('hireDetail.workerOnTheWay')}
            </Text>
            <Text style={styles.liveMeta}>{t('hireDetail.liveLocationUpdating')}</Text>
            {hasWorkerCoords || workerArea ? (
              <Pressable
                style={styles.liveBtn}
                onPress={onTrackWorker}
                accessibilityRole="button"
                accessibilityLabel={t('hireDetail.trackWorker')}
              >
                <Ionicons name="map-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.liveBtnText}>{t('hireDetail.trackWorker')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('hireDetail.liveTracking')}</Text>
        <Timeline steps={steps} />

        {showStartOtp ? (
          <View style={styles.otpCard}>
            <Ionicons name="key" size={16} color={colors.primaryDark} />
            <Text style={styles.otpLabel}>{t('hireDetail.startWorkOTP')}</Text>

            {otpError ? (
              <Text style={styles.otpErrorText}>{otpError}</Text>
            ) : startOtp && otpRevealed ? (
              <>
                <Text style={styles.otpValue}>{startOtp}</Text>
                <Text style={styles.otpHint}>
                  {t('hireDetail.otpHint')}
                </Text>
                <Pressable style={styles.otpHideBtn} onPress={() => setOtpRevealed(false)}>
                  <Ionicons name="eye-off-outline" size={14} color={colors.primaryDark} />
                  <Text style={styles.otpHideText}>{t('hireDetail.hideOTP')}</Text>
                </Pressable>
              </>
            ) : startOtp ? (
              <>
                <Pressable style={styles.otpShowBtn} onPress={() => setOtpRevealed(true)}>
                  <Ionicons name="key" size={18} color={colors.white} />
                  <Text style={styles.otpShowText}>{t('hireDetail.showOTP')}</Text>
                </Pressable>
                <Text style={styles.otpHint}>
                  {t('hireDetail.otpShowHint')}
                </Text>
              </>
            ) : (
              <View style={styles.otpLoadingRow}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.otpHint}>{t('hireDetail.otpLoading')}</Text>
              </View>
            )}
          </View>
        ) : null}
        {completed ? (
          <View style={[styles.otpCard, styles.otpCardDone]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.otpLabel, styles.otpLabelDone]}>
              {t('hireDetail.workCompletedTitle')}
            </Text>
            <Text style={styles.otpHint}>
              {t('hireDetail.workCompletedSub')}
            </Text>
          </View>
        ) : workStarted ? (
          <View style={[styles.otpCard, styles.otpCardDone]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.otpLabel, styles.otpLabelDone]}>
              {t('hireDetail.otpVerified')}
            </Text>
            <Text style={styles.otpHint}>
              {t('hireDetail.otpVerifiedSub')}
            </Text>
          </View>
        ) : null}

        {hire.status === 'in_progress' ? (
          <View style={styles.timerCard}>
            <Ionicons name="timer-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.timerText}>
              {t('hireDetail.liveWorkTimer', { duration: durationLabel })}
            </Text>
          </View>
        ) : null}

        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <View style={styles.feeCol}>
              <Text style={styles.feeLabel}>{t('hireDetail.rateLabel')}</Text>
              <Text style={styles.feeValue}>{formatCurrency(hourlyRate)}/hr</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeCol}>
              <Text style={styles.feeLabel}>{t('hireDetail.workDuration')}</Text>
              <Text style={styles.feeValue}>{durationLabel}</Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {completed ? t('hireDetail.total') : t('hireDetail.estimatedTotal')}
            </Text>
            <View style={styles.totalValueWrap}>
              <Text style={styles.totalValue}>{totalDisplay}</Text>
              {completed && hasDuration ? (
                <Text style={styles.totalDuration}>({durationLabel})</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.platformRow}>
            <Text style={styles.feeLabel}>{t('hireDetail.platformFee')}</Text>
            <Text style={styles.feeSmallValue}>{formatCurrency(0)}</Text>
          </View>
          <Text style={styles.totalHint}>
            {t('hireDetail.perHourRate')}
          </Text>
        </View>

        {isDemo && demoActions.length > 0 ? (
          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>{t('hireDetail.demoTitle')}</Text>
            <Text style={styles.demoSub}>{t('hireDetail.demoSub')}</Text>
            <View style={styles.demoRow}>
              {demoActions.map((item) => (
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

      {canStartWork && otpEntryVisible ? (
        <View style={styles.otpEntryCard}>
          <Text style={styles.otpEntryTitle}>{t('hireDetail.enterOTP')}</Text>
          <Text style={styles.otpEntrySub}>{t('hireDetail.enterOTPSub')}</Text>
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
              label={t('hireDetail.verifyStart')}
              onPress={verifyStartOtp}
              loading={busy}
              disabled={otpEntry.trim().length !== 4}
            />
          </View>
          <Pressable onPress={() => setOtpEntryVisible(false)} hitSlop={8}>
            <Text style={styles.otpEntryCancel}>{t('common.cancel')}</Text>
          </Pressable>
          {otpEntryError ? <Text style={styles.otpEntryError}>{otpEntryError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <View style={styles.bottomCol}>
          {/* Once the OTP is verified (in_progress) the booking is locked. */}
          {hire.status === 'in_progress' ? (
            <View style={styles.lockBanner}>
              <Ionicons name="lock-closed" size={16} color={colors.primaryDark} />
              <Text style={styles.lockBannerText}>{t('hireDetail.workStartedLock')}</Text>
            </View>
          ) : null}

          {/* Call and Cancel are always visible; their enabled state is driven
              only by the status rules in lib/hireRules.ts. */}
          <View style={styles.primaryActionsRow}>
            <Pressable
              style={[styles.callBtn, !callEnabled && styles.disabled]}
              onPress={onCall}
              disabled={!callEnabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !callEnabled }}
            >
              <Ionicons name="call" size={17} color={colors.primaryDark} />
              <Text style={styles.callText}>
                {isWorkerViewer ? t('hireDetail.callCustomer') : t('hireDetail.callWorker')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.cancelBtn, (!cancelEnabled || busy) && styles.disabled]}
              onPress={onCancel}
              disabled={!cancelEnabled || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !cancelEnabled || busy }}
            >
              <Ionicons name="close-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.cancelText}>{t('hireDetail.cancelJob')}</Text>
            </Pressable>
          </View>

          {hire.status === 'pending' ? (
            <Text style={styles.callHint}>
              {isWorkerViewer
                ? t('hireDetail.callWorkerDisabled')
                : t('hireDetail.callCustomerDisabled')}
            </Text>
          ) : null}

          <View style={styles.actionsRow}>
            {isWorkerViewer ? (
              hire.status === 'pending' ? (
                <>
                  <Pressable
                    style={[styles.outlineAction, busy && styles.disabled]}
                    onPress={() => onAction('reject')}
                    disabled={busy}
                  >
                    <Text style={styles.outlineActionText}>{t('hireDetail.reject')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryAction, busy && styles.disabled]}
                    onPress={() => onAction('accept')}
                    disabled={busy}
                  >
                    <Text style={styles.primaryActionText}>{t('hireDetail.accept')}</Text>
                  </Pressable>
                </>
              ) : hire.status === 'accepted' ? (
                <Pressable
                  style={[styles.primaryAction, busy && styles.disabled]}
                  onPress={() => onAction('en_route')}
                  disabled={busy}
                >
                  <Ionicons name="navigate-outline" size={17} color={colors.white} />
                  <Text style={styles.primaryActionText}>{t('hireDetail.onTheWay')}</Text>
                </Pressable>
              ) : hire.status === 'en_route' ? (
                <>
                  <Pressable
                    style={[styles.primaryAction, busy && styles.disabled]}
                    onPress={() => onAction('arrived')}
                    disabled={busy}
                  >
                    <Text style={styles.primaryActionText}>{t('hireDetail.arrived')}</Text>
                  </Pressable>
                  <Pressable style={styles.outlineAction} onPress={onGetDirections}>
                    <Ionicons name="map-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.outlineActionText}>{t('hireDetail.getDirections')}</Text>
                  </Pressable>
                </>
              ) : canStartWork ? (
                <Pressable
                  style={[styles.primaryAction, busy && styles.disabled]}
                  onPress={() => setOtpEntryVisible(true)}
                  disabled={busy}
                >
                  <Text style={styles.primaryActionText}>{t('hireDetail.startWork')}</Text>
                </Pressable>
              ) : completed ? (
                <>
                  <Pressable style={styles.primaryAction} onPress={onFeedback}>
                    <Text style={styles.primaryActionText}>{t('hireDetail.giveFeedback')}</Text>
                  </Pressable>
                  <Pressable style={styles.outlineAction} onPress={onHelp}>
                    <Text style={styles.outlineActionText}>{t('hireDetail.help')}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.outlineAction} onPress={onHelp}>
                  <Text style={styles.outlineActionText}>{t('hireDetail.help')}</Text>
                </Pressable>
              )
            ) : (
              <>
                {completed ? (
                  <Pressable style={styles.primaryAction} onPress={onFeedback}>
                    <Text style={styles.primaryActionText}>{t('hireDetail.giveFeedback')}</Text>
                  </Pressable>
                ) : workStarted && !completed ? (
                  <Pressable
                    style={[styles.primaryAction, busy && styles.disabled]}
                    onPress={() => onAction('complete')}
                    disabled={busy}
                  >
                    <Text style={styles.primaryActionText}>{t('hireDetail.workCompleted')}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.outlineAction} onPress={onHelp}>
                  <Text style={styles.outlineActionText}>{t('hireDetail.help')}</Text>
                </Pressable>
              </>
            )}
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
  brandName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  errorText: { marginTop: spacing.md, fontSize: fontSize.small, color: colors.textSecondary },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: colors.danger,
    alignSelf: 'stretch',
  },
  errorBannerText: { fontSize: fontSize.caption, color: colors.danger, flex: 1 },
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
  workerName: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 1,
  },
  workerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  workerMeta: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  trustCard: {
    alignSelf: 'stretch',
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  trustInfo: { flex: 1 },
  trustName: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  trustRating: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trustDivider: {
    height: 1,
    backgroundColor: colors.border,
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
    color: colors.primaryDark,
  },
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
  enRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.primaryDark,
  },
  enRouteTextWrap: { flex: 1 },
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
  enRouteTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  enRouteSub: {
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
  totalValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  totalValue: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  totalDuration: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  feeSmallValue: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  totalHint: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  timerCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  timerText: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  directionsCard: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  directionsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  directionsTitle: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },
  directionsAddress: {
    fontSize: fontSize.small,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  directionsSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    marginTop: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  directionsBtnText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  liveCard: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  liveTitle: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },
  liveSub: {
    fontSize: fontSize.small,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  liveMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    marginTop: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.white,
  },
  liveBtnText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  bottomBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  bottomCol: { alignSelf: 'stretch' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  lockBannerText: {
    flex: 1,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: '#92400E',
    lineHeight: 18,
  },
  primaryActionsRow: { flexDirection: 'row', gap: spacing.sm },
  callBtn: {
    flex: 1,
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
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.white,
  },
  cancelText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.danger },
  callHint: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    marginTop: 4,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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