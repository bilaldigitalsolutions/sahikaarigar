import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BrandLogo,
  Button,
  Header,
  Input,
  LocationPicker,
  Screen,
  WorkerProfileForm,
  type PlaceResult,
  type WorkerProfileFormValues,
} from '@/components';
import { AVAILABILITY_OPTIONS, LEGAL_URLS, SUPPORT_PHONE, VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkerProfile, updateProfile, updateWorkerProfile } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { validateAadhaar } from '@/utils';

/**
 * Edit Profile (Worker).
 *
 * 100% identical UI to the registration screen (register-worker.tsx): the same
 * shared <WorkerProfileForm /> provides every field — Full Name, Phone
 * (read-only/locked), Skills (multi-select dropdown), Experience, Location,
 * Aadhaar (masked, read-only/locked once on file), Profile Photo, Work Photos
 * (up to 5), Availability, Expected Charge — plus the Terms & Conditions row
 * and an "Update Profile" button with a loading state.
 *
 * All fields are pre-filled from the worker's existing registration so nothing
 * is blank. Aadhaar and Phone are locked (already verified on file).
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const isWorker = user?.role === 'worker';

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
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  /** Skill ids stored in the DB that are not part of the known SKILLS list. */
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  /** True when an Aadhaar is already on file → field is read-only/locked. */
  const [aadhaarLocked, setAadhaarLocked] = useState(false);
  /** Masked Aadhaar shown when the field is locked. */
  const [aadhaarMasked, setAadhaarMasked] = useState<string | null>(null);
  /** The photo/area as they were loaded — lets us detect deletions & changes. */
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [originalArea, setOriginalArea] = useState<string | null>(null);
  // Employer-only account fields (not part of WorkerProfileFormValues).
  const [nameError, setNameError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [area, setArea] = useState(user?.locationArea ?? '');
  const clearErrors = () => {
    if (nameError) setNameError(null);
    if (areaError) setAreaError(null);
    if (error) setError(null);
  };

  const patch = (p: Partial<WorkerProfileFormValues>) =>
    setValues((prev) => ({ ...prev, ...p }));

  // Load the worker's registration details and pre-fill every field.
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const worker = await getWorkerProfile();
      if (!worker) return;
      const workerArea = worker.serviceAreas?.[0] ?? null;
      setValues((prev) => ({
        ...prev,
        name: worker.user?.name ?? prev.name,
        phone: worker.user?.phone ?? prev.phone,
        skills: worker.skills?.length ? worker.skills : [],
        experience: String(worker.experience ?? 0),
        area: workerArea ?? prev.area,
        areaLat: worker.lat ?? null,
        areaLng: worker.lng ?? null,
        aadhaar: worker.aadhaarOnFile ? (worker.aadhaarMasked ?? '') : '',
        profilePhotoUrl: worker.user?.avatar ?? null,
        workPhotoUrls: worker.portfolio ?? [],
        rate: worker.hourlyRate ? String(worker.hourlyRate) : '',
        availability: worker.availability ?? prev.availability,
      }));
      setExtraSkills(worker.skills ?? []);
      setAadhaarLocked(Boolean(worker.aadhaarOnFile));
      setAadhaarMasked(worker.aadhaarMasked ?? null);
      setOriginalPhotoUrl(worker.user?.avatar ?? null);
      setOriginalArea(workerArea);
    } catch {
      Alert.alert(
        t('profile.loadFailedTitle'),
        t('profile.loadFailedMessage'),
      );
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!isWorker) return;
    void loadProfile();
  }, [isWorker, loadProfile]);

  const onSave = async () => {
    let valid = true;
    const finalName = values.name.trim();
    const finalArea = (values.area ?? '').trim();

    if (finalName.length < VALIDATION.NAME_MIN_LENGTH) {
      setError(t('profile.nameError'));
      valid = false;
    }
    if (finalArea.length < 3) {
      setError(t('profile.areaError'));
      valid = false;
    }

    if (loadingProfile) {
      setError(t('profile.stillLoading'));
      valid = false;
    } else if (values.skills.length === 0) {
      setError(t('profile.skillsError'));
      valid = false;
    } else {
      const exp = Math.round(Number(values.experience));
      if (!Number.isFinite(exp) || exp < VALIDATION.MIN_EXPERIENCE || exp > VALIDATION.MAX_EXPERIENCE) {
        setError(t('profile.experienceError', { min: VALIDATION.MIN_EXPERIENCE, max: VALIDATION.MAX_EXPERIENCE }));
        valid = false;
      }
    }
    if (valid) {
      const rateValue = Number(values.rate);
      if (!Number.isFinite(rateValue) || rateValue < VALIDATION.MIN_RATE || rateValue > VALIDATION.MAX_RATE) {
        setError(t('profile.rateRangeError', { min: VALIDATION.MIN_RATE, max: VALIDATION.MAX_RATE }));
        valid = false;
      }
    }
    // Aadhaar — editable only while none is on file (locked otherwise).
    if (valid && !aadhaarLocked) {
      const digits = values.aadhaar.replace(/\D/g, '');
      if (digits) {
        const check = validateAadhaar(digits);
        if (!check.valid) {
          setError(t('profile.aadhaarInvalid'));
          valid = false;
        }
      }
    }

    if (!valid) return;

    setBusy(true);
    setError(null);
    try {
      // 1) The base account (name + area + address — `users` table).
      await updateProfile({
        name: finalName,
        locationArea: finalArea,
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      // 2) The worker registration details (`worker_profiles` table) — the same
      // fields the registration form captured.
      const digits = aadhaarLocked ? '' : values.aadhaar.replace(/\D/g, '');
      const removedPhoto = Boolean(originalPhotoUrl) && !values.profilePhotoUrl;
      await updateWorkerProfile({
        skills: values.skills,
        experience: Math.round(Number(values.experience)),
        hourlyRate: Number(values.rate),
        ...(finalArea && finalArea !== originalArea ? { serviceAreas: [finalArea] } : {}),
        ...(digits ? { aadhaarNumber: digits } : {}),
        ...(values.profilePhotoDataUrl ? { profilePhotoDataUrl: values.profilePhotoDataUrl } : {}),
        ...(removedPhoto ? { removeProfilePhoto: true } : {}),
        ...(values.newWorkPhotoDataUrls.length ? { workPhotoDataUrls: values.newWorkPhotoDataUrls } : {}),
        portfolioToKeep: values.workPhotoUrls,
      });
      await refreshUser();
      await loadProfile();
      setShowSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** Close the success popup and return to Home. */
  const dismissSuccess = () => {
    setShowSuccess(false);
    router.replace('/(tabs)');
  };

  if (!user) return null;

  // ---------------------------------------------------------------- worker --
  if (isWorker) {
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
            <Text style={styles.title}>{t('profile.updateDetails')}</Text>
            <Text style={styles.subtitle}>
              {t('profile.updateSub')}
            </Text>

            {loadingProfile && (
              <View style={styles.loaderRow}>
                <ActivityIndicator size="large" color={colors.primaryDark} />
                <Text style={styles.noticeText}>{t('profile.loadingDetails')}</Text>
              </View>
            )}

            <WorkerProfileForm
              values={values}
              onChange={patch}
              error={error}
              aadhaarLocked={aadhaarLocked}
              aadhaarMasked={aadhaarMasked}
              extraSkills={extraSkills}
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
              label={t('profile.updateProfile')}
              onPress={onSave}
              loading={busy || loadingProfile}
              disabled={busy || loadingProfile}
              size="lg"
              style={styles.mt}
            />

            <Text style={styles.support}>{t('profile.needHelpPhone', { phone: SUPPORT_PHONE })}</Text>
          </ScrollView>

          {/* Modern success popup — shown after profile is saved. */}
          {showSuccess && (
            <View style={styles.successOverlay}>
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>{t('profile.savedTitle')}</Text>
                <Text style={styles.successMessage}>
                  {t('profile.savedMessage')}
                </Text>
                <Pressable style={styles.successBtn} onPress={dismissSuccess}>
                  <Text style={styles.successBtnText}>{t('common.ok')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // -------------------------------------------------------------- employer --
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
          <Text style={styles.title}>{t('profile.updateDetails')}</Text>
          <Text style={styles.subtitle}>
            {t('profile.updateSubEmployer')}
          </Text>

          <Input
            label={t('profile.fullName')}
            placeholder={t('profile.fullNamePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearErrors();
            }}
            error={nameError ?? undefined}
            containerStyle={styles.mt}
          />

          <Input
            label={t('profile.phoneNumber')}
            value={user?.phone}
            editable={false}
            hint={t('profile.phoneVerified')}
            containerStyle={styles.mt}
          />

          <View style={styles.mt}>
            <Text style={styles.label}>{t('profile.areaLabel')}</Text>
            <LocationPicker
              placeholder={t('profile.areaSearchPlaceholder')}
              value={area}
              onSelect={(place: PlaceResult) => {
                setArea(place.description);
                clearErrors();
              }}
              icon="location-outline"
            />
            {areaError ? <Text style={styles.errorText}>{areaError}</Text> : null}
          </View>

          <Input
            label={t('profile.address')}
            placeholder={t('profile.addressPlaceholder')}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              clearErrors();
            }}
            multiline
            numberOfLines={3}
            containerStyle={styles.mt}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label={t('profile.updateProfile')}
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.saveBtn}
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
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.sm },
  saveBtn: { marginTop: spacing.xl },
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
  // Success popup styles
  successOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  successCard: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '85%',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  successMessage: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  successBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
  },
  successBtnText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
});
