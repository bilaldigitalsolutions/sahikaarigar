import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar, Button, Checkbox, Screen, StarInput } from '@/components';
import { CUSTOMER_LIKES, WORKER_LIKES, skillLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  ApiError,
  createCustomerReview,
  createReview,
  getHire,
  sendPlatformFeedback,
  type ApiHire,
} from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatCurrency, formatDuration } from '@/utils';

function fmtCompleted(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

type FeedbackDestination = '/(tabs)/hires' | '/(tabs)/jobs';

export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);

  const [hire, setHire] = useState<ApiHire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ratings start at 0 on purpose: both are required, so the submit button
  // cannot be pressed until the user actually chooses a score.
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState('');
  const [appRating, setAppRating] = useState(0);
  const [likes, setLikes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    let active = true;
    getHire(id)
      .then((result) => {
        if (!active) return;
        const viewerIsWorker =
          result.hire.worker?.userId != null && result.hire.worker.userId === user?.id;

        setHire(result.hire);
        setError(
          result.hire.status === 'completed'
            ? null
            : 'This job is not completed yet. Feedback opens after the work is marked completed.',
        );

        // Each side has its own review: customer -> worker (`review`) and
        // worker -> customer (`customerReview`).
        const existing = viewerIsWorker ? result.customerReview : result.review;
        if (existing) {
          setRating(existing.rating);
          setComment(existing.comment ?? '');
          setAlreadyReviewed(true);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the feedback.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id]);

  const isWorkerViewer = hire?.worker?.userId != null && hire.worker.userId === user?.id;

  // Feedback is mandatory: after completion, both sides must submit before
  // leaving this screen. Back / gesture navigation is blocked until then.
  const mustSubmit = Boolean(
    hire && hire.status === 'completed' && !alreadyReviewed && !loading && !error,
  );

  usePreventRemove(mustSubmit, () => {
    Alert.alert(
      'Feedback zaroori hai',
      'Kaam complete hone ke baad feedback dena zaroori hai. Dono ratings choose karke submit karein.',
    );
  });

  const destination: FeedbackDestination = isWorkerViewer ? '/(tabs)/jobs' : '/(tabs)/hires';
  const goToRoleHome = () => {
    // Drop the hire detail/feedback screens so Android Back cannot reopen a
    // completed job after the mandatory feedback has been submitted.
    if (router.canDismiss()) router.dismissAll();
    router.replace(destination);
  };

  const toggleLike = (label: string) =>
    setLikes((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const onSubmit = async () => {
    if (submitting || alreadyReviewed || !hire) return;
    if (hire.status !== 'completed') {
      Alert.alert('Feedback not open yet', 'Feedback opens after the work is completed.');
      return;
    }
    if (rating < 1) {
      Alert.alert(
        isWorkerViewer ? 'Rate the customer' : 'Add a rating',
        isWorkerViewer
          ? 'Give the customer a rating from 1 to 5 stars.'
          : 'Give the worker a rating from 1 to 5 stars.',
      );
      return;
    }
    if (appRating < 1) {
      Alert.alert('Rate the app', 'Give SahiKaarigar a rating from 1 to 5 stars.');
      return;
    }

    let tipAmount = 0;
    if (!isWorkerViewer) {
      tipAmount = tip.trim() ? Number(tip.trim()) : 0;
      if (tip.trim() && Number.isNaN(tipAmount)) {
        Alert.alert('Invalid tip amount', 'Please enter a valid amount.');
        return;
      }
      if (tipAmount < 0) {
        Alert.alert('Invalid tip amount', 'Tip cannot be negative.');
        return;
      }
    }

    setSubmitting(true);
    console.log('[Feedback] submitting', {
      hireId: id,
      side: isWorkerViewer ? 'worker' : 'customer',
      rating,
      hasComment: comment.trim().length > 0,
      tip: tipAmount,
      likes,
      appRating,
    });

    try {
      if (isWorkerViewer) {
        const { customerReview } = await createCustomerReview({
          hireRequestId: id,
          rating,
          comment: comment.trim() || undefined,
        });
        console.log('[Feedback] customer review saved', {
          hireId: id,
          reviewId: customerReview.id,
        });
      } else {
        const { review } = await createReview({
          hireRequestId: id,
          rating,
          comment: comment.trim() || undefined,
          tip: Number.isFinite(tipAmount) ? tipAmount : 0,
          likes,
        });
        console.log('[Feedback] worker review saved', { hireId: id, reviewId: review.id });
      }

      if (appRating > 0) {
        try {
          await sendPlatformFeedback({
            hireRequestId: id,
            rating: appRating,
            comment: likes.length ? likes.join(', ') : undefined,
          });
          console.log('[Feedback] platform feedback saved', { hireId: id, appRating });
        } catch (e) {
          // The counterparty feedback is already saved and is the important
          // part. Do not tell the user the whole submission failed because the
          // optional platform part had a problem.
          console.warn('[Feedback] platform feedback failed after review saved', {
            hireId: id,
            status: e instanceof ApiError ? e.status : undefined,
            code: e instanceof ApiError ? e.code : undefined,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      setAlreadyReviewed(true);
      Alert.alert(
        'Thank you!',
        isWorkerViewer
          ? 'Customer feedback submitted successfully.'
          : 'Your feedback has been submitted successfully.',
        [{ text: 'OK', onPress: goToRoleHome }],
        { cancelable: false },
      );
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined;
      const code = e instanceof ApiError ? e.code : undefined;
      console.warn('[Feedback] review failed', {
        hireId: id,
        side: isWorkerViewer ? 'worker' : 'customer',
        name: e instanceof Error ? e.name : typeof e,
        status,
        code,
        message: e instanceof Error ? e.message : String(e),
      });
      if (e instanceof ApiError && /already|pehle hi/i.test(e.message)) {
        setAlreadyReviewed(true);
      }
      Alert.alert(
        'Could not submit feedback',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const counterparty = isWorkerViewer ? hire?.employer : hire?.worker?.user;
  const counterpartyName = counterparty?.name ?? (isWorkerViewer ? 'Customer' : 'Kaarigar');
  const primarySkill = hire?.worker?.skills?.[0];

  // The final bill comes from the API after completion. Older rows may not
  // have it, so derive the same value from the timestamps as a fallback.
  const workerRate = Number(hire?.worker?.hourlyRate);
  const hourlyRate =
    Number.isFinite(workerRate) && workerRate > 0 ? workerRate : Number(hire?.proposedRate ?? 0);
  const startedAtMs = hire?.startedAt ? new Date(hire.startedAt).getTime() : NaN;
  const completedAtMs = hire?.completedAt ? new Date(hire.completedAt).getTime() : NaN;
  const fallbackDurationMinutes =
    Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs
      ? (completedAtMs - startedAtMs) / 60000
      : NaN;
  const serverDurationMinutes =
    hire?.durationMinutes != null ? Number(hire.durationMinutes) : NaN;
  const durationMinutes = Number.isFinite(serverDurationMinutes)
    ? serverDurationMinutes
    : fallbackDurationMinutes;
  const hasDuration = Number.isFinite(durationMinutes);
  const computedTotal = hasDuration ? (durationMinutes / 60) * hourlyRate : 0;
  const storedTotal = hire?.totalAmount != null ? Number(hire.totalAmount) : NaN;
  const totalAmount = Number.isFinite(storedTotal) ? storedTotal : computedTotal;
  const amountKnown = Number.isFinite(storedTotal) || hasDuration;

  const tipTrimmed = tip.trim();
  const tipDisplay =
    tipTrimmed && Number.isFinite(Number(tipTrimmed)) && Number(tipTrimmed) > 0
      ? `₹${Number(tipTrimmed)}`
      : '₹0';

  const canSubmit =
    Boolean(hire) &&
    hire?.status === 'completed' &&
    !alreadyReviewed &&
    !submitting &&
    rating > 0 &&
    appRating > 0;

  return (
    <Screen padded={false} edges={['bottom']}>
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name="checkmark" size={26} color={colors.white} />
              </View>
              <Text style={styles.bannerTitle}>
                {isWorkerViewer ? 'Kaam complete ho gaya!' : 'Work Completed!'}
              </Text>
              <Text style={styles.bannerText}>
                {isWorkerViewer
                  ? 'Customer ne kaam complete mark kar diya. Please rate the customer and the app.'
                  : 'Your kaarigar has finished the work. Please share your feedback.'}
              </Text>
            </View>

            <View style={styles.amountCard}>
              <View style={styles.amountInfo}>
                <Text style={styles.amountLabel}>Work total</Text>
                <Text style={styles.amountMeta}>
                  {`${formatCurrency(hourlyRate)}/hr${
                    hasDuration ? ` • ${formatDuration(durationMinutes)}` : ''
                  }`}
                </Text>
              </View>
              <Text style={styles.amountValue}>
                {amountKnown ? formatCurrency(totalAmount) : '—'}
              </Text>
            </View>

            {alreadyReviewed ? (
              <View style={[styles.card, styles.alreadyCard]}>
                <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                <Text style={styles.alreadyTitle}>Feedback already submitted</Text>
                <Text style={styles.alreadyText}>
                  {isWorkerViewer
                    ? 'Aap is job ka customer feedback de chuke hain.'
                    : 'Aap is job ka feedback de chuke hain.'}
                </Text>
                <Button
                  label={isWorkerViewer ? 'Go to My Work' : 'Go to My Hires'}
                  onPress={goToRoleHome}
                  style={styles.alreadyBtn}
                />
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.workerRow}>
                <Avatar uri={counterparty?.avatar} name={counterpartyName} size={64} />
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{counterpartyName}</Text>
                  <Text style={styles.workerMeta}>
                    {isWorkerViewer
                      ? 'Customer'
                      : primarySkill
                        ? skillLabel(primarySkill)
                        : 'Kaarigar'}{' '}
                    • Completed on {fmtCompleted(hire.completedAt ?? hire.updatedAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.question}>
                {isWorkerViewer ? 'How was the customer?' : 'How was your experience?'}
              </Text>
              <StarInput value={rating} onChange={setRating} size={30} />
              {rating < 1 ? (
                <Text style={styles.requiredHint}>Tap a star to rate (required)</Text>
              ) : null}
            </View>

            {!isWorkerViewer ? (
              <View style={styles.card}>
                <View style={styles.tipsHead}>
                  <Text style={styles.cardTitle}>Tips for kaarigar</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                </View>
                <View style={styles.tipRow}>
                  <TextInput
                    style={styles.tipInput}
                    placeholder="Add a tip amount (optional)..."
                    placeholderTextColor={colors.muted}
                    value={tip}
                    onChangeText={setTip}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.tipCurrency}>{tipDisplay}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.reviewLabel}>Review (optional)</Text>
            <TextInput
              style={styles.textarea}
              placeholder={
                isWorkerViewer
                  ? 'Share your experience with this customer...'
                  : 'Share your experience...\ne.g., work quality, behavior, communication'
              }
              placeholderTextColor={colors.muted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rate SahiKaarigar App</Text>
              <Text style={styles.cardSub}>How was your overall app experience?</Text>
              <StarInput value={appRating} onChange={setAppRating} size={26} />
              {appRating < 1 ? (
                <Text style={styles.requiredHint}>App rating is required</Text>
              ) : null}
              <Text style={[styles.cardTitle, styles.likesTitle]}>What did you like?</Text>
              {/* Role-specific feedback chips: customer rates worker, worker rates customer */}
              {(
                isWorkerViewer ? WORKER_LIKES : CUSTOMER_LIKES
              ).map((label) => (
                <Checkbox
                  key={label}
                  label={label}
                  checked={likes.includes(label)}
                  onToggle={() => toggleLike(label)}
                />
              ))}
            </View>

            {!alreadyReviewed ? (
              <View style={styles.mandatoryNote}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.mandatoryText}>
                  Feedback zaroori hai — dono ratings ke bina submit nahi hoga.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={alreadyReviewed ? 'Feedback already submitted' : 'Submit Feedback'}
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit || alreadyReviewed}
              size="lg"
            />
            {!alreadyReviewed && (rating < 1 || appRating < 1) ? (
              <Text style={styles.footerHint}>
                Rate {isWorkerViewer ? 'the customer' : 'the worker'} and the app to continue.
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  errorText: { marginTop: spacing.md, fontSize: fontSize.small, color: colors.textSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  banner: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primaryBg,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
    marginTop: spacing.md,
  },
  bannerText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  amountInfo: { flex: 1 },
  amountLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  amountMeta: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  amountValue: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  alreadyCard: {
    alignItems: 'center',
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  alreadyTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: '#166534',
    marginTop: spacing.sm,
  },
  alreadyText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  alreadyBtn: { marginTop: spacing.md },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  workerInfo: { flex: 1 },
  workerName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
  workerMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  question: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  requiredHint: {
    fontSize: fontSize.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  optionalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  optionalText: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.white },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
  },
  tipInput: { flex: 1, fontSize: fontSize.small, color: colors.textPrimary, paddingVertical: 0 },
  tipCurrency: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  reviewLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  textarea: {
    minHeight: 96,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    fontSize: fontSize.small,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  cardSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  likesTitle: { marginTop: spacing.lg },
  mandatoryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryTint,
  },
  mandatoryText: {
    flex: 1,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  footerHint: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
