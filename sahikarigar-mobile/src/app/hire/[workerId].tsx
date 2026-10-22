import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Input, LocationPicker, RateInput, Screen, type PlaceResult } from '@/components';
import { VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { createHire, getWorker } from '@/lib/api';
import { trackEvent } from '@/lib/observability';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Phone numbers (India) are 10 digits; a rate field is max 5 digits. */

export default function CreateHireScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workerId: string }>();
  const workerId = String(params.workerId);
  const { user, isDemo } = useAuth();

  // Guest employers land here from browsing — require login before any hire
  // data is collected, and come straight back to THIS worker after OTP.
  if (!user && !isDemo) {
    router.replace({
      pathname: '/(auth)/login',
      params: { next: `/hire/${workerId}` },
    });
    return null;
  }

  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keyboard overlap guard: when the software keyboard shows, push the scroll
  // content down so "Confirm booking" never hides behind it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Funnel: opening the booking form is intent — fire before the form is
    // submitted so abandoned bookings are still measurable.
    trackEvent('booking_started', { workerId });

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardHeight(0);
    const show = Keyboard.addListener('keyboardWillShow', onShow);
    const hide = Keyboard.addListener('keyboardWillHide', onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [workerId]);

  /** Creates the hire request directly — the SuperTokens session already
   *  proves who the user is, so no extra phone OTP is needed here. */
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      // Client-side pre-check: make sure the worker is still available before
      // submitting the form. Catches the race condition where the worker
      // became busy between search results and form submission.
      try {
        const { worker } = await getWorker(workerId);
        if (worker.availability !== 'available') {
          Alert.alert(
            'Kaarigar available nahi hai',
            'Ye kaarigar abhi available nahi hai. Kripya kisi aur kaarigar ko try karein.',
            [{ text: 'OK', style: 'cancel' }],
          );
          setBusy(false);
          return;
        }
      } catch {
        // If we can't fetch the worker, still try submitting — the server
        // will give the final answer.
      }

      const { hire } = await createHire({
        workerId,
        description: description.trim(),
        location: location.trim(),
        proposedRate: Number(rate),
        name: user?.name,
      });
      router.replace({ pathname: '/hire/detail/[id]', params: { id: hire.id } });
    } catch (e) {
      // Form data (description, location, rate) is intentionally NOT cleared
      // so the user can fix and resubmit, or tap "View similar workers".
      setError(e instanceof Error ? e.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (description.trim().length < 10) {
      setError('Describe the work in at least 10 characters.');
      return;
    }
    if (location.trim().length < 3) {
      setError('Enter the work location.');
      return;
    }
    const proposedRate = Number(rate);
    if (
      !Number.isFinite(proposedRate) ||
      proposedRate < VALIDATION.MIN_RATE ||
      proposedRate > VALIDATION.MAX_RATE
    ) {
      setError(`Enter a rate between ₹${VALIDATION.MIN_RATE} and ₹${VALIDATION.MAX_RATE}.`);
      return;
    }
    await send();
  };

  return (
    // Keyboard wrapper sits OUTSIDE the scrollable Screen: nesting it inside the
    // ScrollView makes the offset fight the keyboard and jerks the focused input
    // (e.g. the OTP phone field) around the amount field.
    <KeyboardAvoidingView
      style={styles.flexRoot}
      behavior={
        Platform.OS === 'android' ? 'height' : Platform.OS === 'ios' ? 'padding' : undefined
      }
      keyboardVerticalOffset={Platform.OS === 'ios' ? HEADER_HEIGHT : 0}
    >
      <Screen scroll contentStyle={{ paddingBottom: spacing.lg + keyboardHeight }}>
        <Text style={styles.heading}>Booking details</Text>
        <Text style={styles.sub}>
          Send it to the worker — their number is revealed once they accept.</Text>

        <Input
          label="What work is needed?"
          placeholder="e.g. The kitchen pipe is leaking, about 2 hours of work."
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (error) setError(null);
          }}
          multiline
          numberOfLines={4}
          maxLength={VALIDATION.DESCRIPTION_MAX_LENGTH}
          style={styles.textarea}
          containerStyle={styles.mt}
        />

        <View style={styles.locationWrap}>
          <Text style={styles.label}>Location / Area</Text>
          <LocationPicker
            placeholder="Search your area — e.g. Madhapur, LB Nagar"
            value={location}
            onSelect={(place: PlaceResult) => {
              setLocation(place.description);
              if (error) setError(null);
            }}
            icon="location-outline"
          />
        </View>

        <RateInput
          label="Your rate (₹ per hour)"
          placeholder="e.g. 300"
          value={rate}
          onChangeText={(text) => {
            setRate(text);
            if (error) setError(null);
          }}
          hint={`${VALIDATION.MIN_RATE} to ${VALIDATION.MAX_RATE}`}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button label="Confirm booking" onPress={onSubmit} loading={busy} size="lg" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Native stack header height — used to offset the iOS keyboard padding. */
const HEADER_HEIGHT = 56;

const styles = StyleSheet.create({
  flexRoot: { flex: 1 },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.xs },
  mt: { marginTop: spacing.xl },
  textarea: { height: 110, textAlignVertical: 'top', paddingTop: spacing.md },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  locationWrap: { marginBottom: spacing.lg },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginBottom: spacing.md },
});
