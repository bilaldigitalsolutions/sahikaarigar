import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  // The exact skill list we validate and submit. Trimming plus de-duping here
  // means every selected skill reaches the API, in the order it was picked.
  const selectedSkills = Array.from(
    new Set(values.skills.map((skill) => skill.trim()).filter(Boolean)),
  );

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
    selectedSkills.length === 0 ||
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
      Alert.alert(t('profile.verifyNumberTitle'), t('profile.verifyNumberMessage'), [
        { text: t('profile.verifyNow'), onPress: () => router.push('/(auth)/login') },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    if (values.name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      setError(t('profile.nameError'));
      return;
    }
    if (selectedSkills.length === 0) {
      setError(t('profile.skillsError'));
      return;
    }
    if (!experienceValid) {
      setError(t('profile.experienceError', { min: VALIDATION.MIN_EXPERIENCE, max: VALIDATION.MAX_EXPERIENCE }));
      return;
    }
    if (!values.area) {
      setError(t('profile.areaError'));
      return;
    }
    // Aadhaar is mandatory: exactly 12 digits AND a valid UIDAI Verhoeff
    // checksum. An empty field is no longer accepted.
    if (!aadhaarDigits) {
      setError(t('profile.aadhaarRequired'));
      return;
    }
    if (!aadhaarValid) {
      setError(t('profile.aadhaarInvalid'));
      return;
    }
    if (!values.aadhaarPhotoUri || !values.aadhaarPhotoDataUrl) {
      setError(t('profile.aadhaarPhotoRequired'));
      return;
    }
    if (!rateValid) {
      setError(t('profile.rateRangeError', { min: VALIDATION.MIN_RATE, max: VALIDATION.MAX_RATE }));
      return;
    }
    if (!terms) {
      setError(t('profile.termsRequired'));
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
          skills: selectedSkills,
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
      Alert.alert(t('profile.applicationThanks'), t('profile.applicationReceived'), [
        // Land on the worker dashboard — refreshUser() already flipped the
        // backend role to 'worker' (the worker_profiles row just got written),
        // so the tabs guard lets it through and the dashboard shows
        // "Verification Pending" until the admin approves the profile.
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.submitFailed'));
    } finally {
      setBusy(false);
    }
  };

  // An already-registered worker should never see the registration form again
  // (for example after returning from the OTP screen with next=/register-worker),
  // and a signed-out visitor is auto-routed to login and lands right back on
  // this form after the OTP screen. Both redirects live in an EFFECT — calling
  // router.replace() during render can corrupt the Android navigation stack.
  useEffect(() => {
    if (user?.role === 'worker') {
      router.replace('/(tabs)');
      return;
    }
    if (!user) {
      router.replace({
        pathname: '/(auth)/login',
        params: { next: '/register-worker' },
      });
    }
  }, [user, router]);

  if (user?.role === 'worker' || !user) return null;

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
          <Text style={styles.title}>{t('profile.joiningAs')}</Text>
          <Text style={styles.subtitle}>
            {t('profile.createProfile')}
          </Text>

          {user ? (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} />
              <Text style={styles.noticeText}>
                {t('profile.mobileVerified')}{user.phone ? ` (+91 ${user.phone})` : ''}
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
              {t('auth.consentAgreePrefix')}{' '}
              <Text
                style={styles.link}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(LEGAL_URLS.terms).catch(() => {});
                }}
              >
                {t('auth.termsConditions')}
              </Text>{' '}
              {t('auth.consentAnd')}{' '}
              <Text
                style={styles.link}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(LEGAL_URLS.privacy).catch(() => {});
                }}
              >
                {t('auth.privacyPolicy')}
              </Text>
            </Text>
          </Pressable>

          <Button
            label={t('profile.submitApplication')}
            onPress={onSubmit}
            loading={busy}
            disabled={submitDisabled}
            size="lg"
            style={styles.mt}
          />

          <Text style={styles.support}>{t('profile.needHelpPhone', { phone: SUPPORT_PHONE })}</Text>
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
