import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { Avatar, Button, Checkbox, Header, Screen, StarInput } from '@/components';
import { FEEDBACK_LIKES, skillLabel } from '@/constants';
import { createReview, getHire, sendPlatformFeedback, type ApiHire } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

function fmtCompleted(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);

  const [hire, setHire] = useState<ApiHire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
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
        if (active) {
          setHire(result.hire);
          setError(null);
          if (result.review) {
            setRating(result.review.rating);
            setComment(result.review.comment ?? '');
            setAlreadyReviewed(true);
          }
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
  }, [id]);

  const toggleLike = (label: string) =>
    setLikes((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const onSubmit = async () => {
    if (rating < 1) {
      Alert.alert('Add a rating', 'Give the worker a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    try {
      const tipAmount = tip.trim() ? Number(tip.trim()) : 0;
      await createReview({
        hireRequestId: id,
        rating,
        comment: comment.trim() || undefined,
        tip: Number.isFinite(tipAmount) ? tipAmount : 0,
        likes,
      });
      if (appRating > 0) {
        await sendPlatformFeedback({
          hireRequestId: id,
          rating: appRating,
          comment: likes.length ? likes.join(', ') : undefined,
        });
      }
      Alert.alert('Thank you!', 'Your feedback has been submitted.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/hires') },
      ]);
    } catch (e) {
      Alert.alert(
        'Could not submit feedback',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const workerUser = hire?.worker?.user ?? null;
  const workerName = workerUser?.name ?? 'Kaarigar';
  const primarySkill = hire?.worker?.skills?.[0];

  return (
    <Screen
      padded={false}
      edges={['bottom']}
      header={<Header title="Feedback" />}
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name="checkmark" size={26} color={colors.white} />
              </View>
              <Text style={styles.bannerTitle}>Work Completed!</Text>
              <Text style={styles.bannerText}>
                Your kaarigar has finished the work. Please share your feedback.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.workerRow}>
                <Avatar uri={workerUser?.avatar} name={workerName} size={64} />
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{workerName}</Text>
                  <Text style={styles.workerMeta}>
                    {primarySkill ? skillLabel(primarySkill) : 'Kaarigar'} • Completed on{' '}
                    {fmtCompleted(hire.completedAt ?? hire.updatedAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.question}>How was your experience?</Text>
              <StarInput value={rating} onChange={setRating} size={30} />
            </View>

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
                  placeholder="Add a tip amount or note (optional)..."
                  placeholderTextColor={colors.muted}
                  value={tip}
                  onChangeText={setTip}
                  keyboardType="default"
                />
                <Text style={styles.tipCurrency}>₹0</Text>
              </View>
            </View>

            <Text style={styles.reviewLabel}>Review</Text>
            <TextInput
              style={styles.textarea}
              placeholder={'Share your experience...\ne.g., work quality, behavior, communication'}
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
              <Text style={[styles.cardTitle, styles.likesTitle]}>What did you like?</Text>
              {FEEDBACK_LIKES.map((label) => (
                <Checkbox
                  key={label}
                  label={label}
                  checked={likes.includes(label)}
                  onToggle={() => toggleLike(label)}
                />
              ))}
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={alreadyReviewed ? 'Update Feedback' : 'Submit Feedback'}
              onPress={onSubmit}
              loading={submitting}
              size="lg"
            />
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
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
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
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});

