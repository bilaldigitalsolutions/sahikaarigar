import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BrandLogo,
  Button,
  Header,
  Screen,
  WorkerProfileForm,
  type WorkerProfileFormValues,
} from '@/components';
import { AVAILABILITY_OPTIONS, LEGAL_URLS, SUPPORT_PHONE, VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { registerWorker } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { validateAadhaar } from '@/utils';

/**
 * "Join as Kaarigar" — the registration form.
 *
 * The FIELDS live in the shared <WorkerProfileForm /> component, which the
 * Edit Profile screen uses too — so a worker can change anything they gave
 * here, and both screens always look identical.
 */
export default function RegisterWorkerScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [values, setValues] = useState<WorkerProfileFormValues>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    skills: [],
    experience: '',
    area: user?.locationArea ?? null,
    areaLat: null,
    areaLng: null,
    aadhaar: '',
    aadhaarPhotoUri: null,
    aadhaarPhotoDataUrl: null,
    profilePhotoUri: null,
    profilePhotoDataUrl: null,
    profilePhotoUrl: null,
    newWorkPhotoUris: [],
    newWorkPhotoDataUrls: [],
    workPhotoUrls: [],
    availability: AVAILABILITY_OPTIONS[0].value,
    rate: '',
  });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<WorkerProfileFormValues>) =>
    setValues((prev) => ({ ...prev, ...p }));

  // Keep the button disabled until every required field is valid. Aadhaar is
  // mandatory for new worker registrations, including the card photo.
  const aadhaarDigits = values.aadhaar.replace(/\D/g, '');
  const aadhaarCheck = validateAadhaar(aadhaarDigits);
  const aadhaarValid = aadhaarDigits.length === 12 && aadhaarCheck.valid;
  const experienceValue = Number(values.experience);
  const experienceValid =
    Number.isFinite(experienceValue) &&
    experienceValue >= VALIDATION.MIN_EXPERIENCE &&
    experienceValue <= VALIDATION.MAX_EXPERIENCE;
  const rateValue = Number(values.rate);
  const rateValid =
    Number.isFinite(rateValue) &&
    rateValue >= VALIDATION.MIN_RATE &&
    rateValue <= VALIDATION.MAX_RATE;
  const submitDisabled =
    !user ||
    values.name.trim().length < VALIDATION.NAME_MIN_LENGTH ||
    values.skills.length === 0 ||
    !experienceValid ||
    !values.area ||
    !aadhaarValid ||
    !values.aadhaarPhotoUri ||
    !values.aadhaarPhotoDataUrl ||
    !rateValid ||
    !terms ||
    busy;

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Verify your number', 'Please verify your mobile number first, then submit.', [
        { text: 'Verify now', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (values.name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      setError('Enter your full name.');
      return;
    }
    if (values.skills.length === 0) {
      setError('Select at least one skill.');
      return;
    }
    if (!experienceValid) {
      setError(`Enter experience between ${VALIDATION.MIN_EXPERIENCE} and ${VALIDATION.MAX_EXPERIENCE} years.`);
      return;
    }
    if (!values.area) {
      setError('Select your area.');
      return;
    }
    // Aadhaar is mandatory: exactly 12 digits AND a valid UIDAI Verhoeff
    // checksum. An empty field is no longer accepted.
    if (!aadhaarDigits) {
      setError('Aadhaar number is required.');
      return;
    }
    if (!aadhaarValid) {
      setError(aadhaarCheck.error ?? 'Kripya valid 12-digit Aadhaar number daalein.');
      return;
    }
    if (!values.aadhaarPhotoUri || !values.aadhaarPhotoDataUrl) {
      setError('Aadhaar photo is required.');
      return;
    }
    if (!rateValid) {
      setError(`Enter a charge between ₹${VALIDATION.MIN_RATE} and ₹${VALIDATION.MAX_RATE}.`);
      return;
    }
    if (!terms) {
      setError('Please accept the Terms & Privacy Policy.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // NOTE: the API stores one hourly rate per worker; the form's charge is
      // sent as `hourlyRate`. Aadhaar number + photo are mandatory and are
      // only visible to admins during verification.
      await registerWorker({
        name: values.name.trim(),
        profile: {
          skills: values.skills,
          experience: experienceValue,
          hourlyRate: rateValue,
          serviceAreas: [values.area as string],
          lat: values.areaLat ?? undefined,
          lng: values.areaLng ?? undefined,
          aadhaarNumber: aadhaarDigits,
          aadhaarPhotoDataUrl: values.aadhaarPhotoDataUrl,
          profilePhotoDataUrl: values.profilePhotoDataUrl ?? undefined,
          workPhotoDataUrls: values.newWorkPhotoDataUrls.length
            ? values.newWorkPhotoDataUrls
            : undefined,
        },
      });
      await refreshUser();
      Alert.alert('Thank you!', 'Your application has been received. An admin will review it.', [
        // Land on the worker dashboard — refreshUser() already flipped the
        // backend role to 'worker' (the worker_profiles row just got written),
        // so the tabs guard lets it through and the dashboard shows
        // "Verification Pending" until the admin approves the profile.
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your application. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Registering as a Kaarigar requires a verified mobile number. The OTP comes
  // during LOGIN only ("registration ke time OTP") — so an unverified visitor is
  // auto-routed there and lands right back on this form after the OTP screen.
  if (!user) {
    router.replace({
      pathname: '/(auth)/login',
      params: { next: '/register-worker' },
    });
    return null;
  }

  return (
    <Screen
      padded={false}
      edges={['bottom']}
      header={<Header center={<BrandLogo size={28} />} showBack={false} />}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Join as Kaarigar</Text>
          <Text style={styles.subtitle}>
            Create your profile and start receiving jobs • 100% Free to register
          </Text>

          {user ? (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} />
              <Text style={styles.noticeText}>
                Mobile number verified{user.phone ? ` (+91 ${user.phone})` : ''}
              </Text>
            </View>
          ) : null}

          <WorkerProfileForm
            values={values}
            onChange={patch}
            error={error}
            requireAadhaarPhoto
          />

          <Pressable style={[styles.mt, styles.termsRow]} onPress={() => setTerms(!terms)}>
            <View style={[styles.termsBox, terms && styles.termsBoxChecked]}>
              {terms ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text
                style={styles.link}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(LEGAL_URLS.terms).catch(() => {});
                }}
              >
                Terms &amp; Conditions
              </Text>{' '}
              and{' '}
              <Text
                style={styles.link}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(LEGAL_URLS.privacy).catch(() => {});
                }}
              >
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          <Button
            label="Submit Application"
            onPress={onSubmit}
            loading={busy}
            disabled={submitDisabled}
            size="lg"
            style={styles.mt}
          />

          <Text style={styles.support}>Need help? Contact support • {SUPPORT_PHONE}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subtitle: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  noticeText: { flex: 1, fontSize: fontSize.caption, color: colors.textPrimary },
  mt: { marginTop: spacing.lg },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  termsBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  termsBoxChecked: { backgroundColor: colors.primaryDark },
  termsText: { flex: 1, fontSize: fontSize.caption, color: colors.textPrimary, lineHeight: 19 },
  link: { color: colors.primaryDark, fontWeight: fontWeight.semibold },
  support: {
    marginTop: spacing.xl,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
