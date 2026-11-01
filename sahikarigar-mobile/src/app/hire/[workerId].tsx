import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Input, LocationPicker, Screen, type PlaceResult } from '@/components';
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
  /** Customer's home area — auto-filled from onboarding, read-only on this screen. */
  const [homeLocation, setHomeLocation] = useState(user?.locationArea ?? '');
  /** Work location — editable, defaults to home area. */
  const [workLocation, setWorkLocation] = useState(user?.locationArea ?? '');
  /** Worker's hourly rate — pre-filled, read-only, set by the worker. */
  const [workerRate, setWorkerRate] = useState<number | null>(null);
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

  // Keep homeLocation in sync with the user's onboarding area in case it loads
  // asynchronously after the screen mounts.
  useEffect(() => {
    setHomeLocation(user?.locationArea ?? '');
  }, [user?.locationArea]);

  // Fetch worker data on mount to get their hourly rate for the booking form.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { worker } = await getWorker(workerId);
        if (active) {
          setWorkerRate(worker.hourlyRate);
        }
      } catch {
        // Best-effort: if we can't fetch the worker, the rate field will be empty
        // and the server will validate the proposedRate.
      }
    })();
    return () => {
      active = false;
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
        if (!worker || worker.availability !== 'available') {
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
        location: (workLocation ?? '').trim(),
        homeLocation: (homeLocation ?? '').trim(),
        proposedRate: workerRate ?? 0,
        name: user?.name,
      });
      if (!hire || !hire.id) throw new Error('Invalid hire response: missing hire id');
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
    if (workLocation.trim().length < 3) {
      setError('Enter the work location.');
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
          <Text style={styles.label}>Aapki Location</Text>
          <Text style={styles.sub}>
            Customer's home area — set during onboarding.
          </Text>
          <Input
            label="Home area"
            value={homeLocation}
            editable={false}
            style={styles.inputReadOnly}
            containerStyle={styles.mt}
          />
        </View>

        <View style={styles.locationWrap}>
          <Text style={styles.label}>Kaam ki Location</Text>
          <LocationPicker
            placeholder="Search work area — e.g. Madhapur, LB Nagar"
            value={workLocation}
            onSelect={(place: PlaceResult) => {
              setWorkLocation(place.description);
              if (error) setError(null);
            }}
            icon="location-outline"
          />
        </View>

        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Rate</Text>
          <Text style={styles.rateValue}>
            ₹{workerRate ?? 0}/hr (set by worker)
          </Text>
        </View>

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
  inputReadOnly: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.button,
  },
  rateLabel: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  rateValue: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginBottom: spacing.md },
});
