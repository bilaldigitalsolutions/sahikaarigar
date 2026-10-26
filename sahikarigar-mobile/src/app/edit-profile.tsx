import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
 * (read-only/locked), Skills (multi-select chips), Experience, Location,
 * Aadhaar (masked, read-only/locked once on file), Profile Photo, Work Photos
 * (up to 5), Availability, Expected Charge — plus the Terms & Conditions row
 * and an "Update Profile" button with a loading state.
 *
 * All fields are pre-filled from the worker's existing registration so nothing
 * is blank. Aadhaar and Phone are locked (already verified on file).
 */
export default function EditProfileScreen() {
  const router = useRouter();
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
        'Worker profile details load nahi ho payi',
        'Please refresh the screen to try again.',
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
      setError('Enter your full name.');
      valid = false;
    }
    if (finalArea.length < 3) {
      setError('Select your area from the picker below.');
      valid = false;
    }

    if (loadingProfile) {
      setError('Aapke kaarigar details abhi load ho rahe hain — thodi der me phir save karo.');
      valid = false;
    } else if (values.skills.length === 0) {
      setError('Select at least one skill.');
      valid = false;
    } else {
      const exp = Math.round(Number(values.experience));
      if (!Number.isFinite(exp) || exp < VALIDATION.MIN_EXPERIENCE || exp > VALIDATION.MAX_EXPERIENCE) {
        setError(`Enter experience between ${VALIDATION.MIN_EXPERIENCE} and ${VALIDATION.MAX_EXPERIENCE} years.`);
        valid = false;
      }
    }
    if (valid) {
      const rateValue = Number(values.rate);
      if (!Number.isFinite(rateValue) || rateValue < VALIDATION.MIN_RATE || rateValue > VALIDATION.MAX_RATE) {
        setError(`Enter a charge between ₹${VALIDATION.MIN_RATE} and ₹${VALIDATION.MAX_RATE}.`);
        valid = false;
      }
    }
    // Aadhaar — editable only while none is on file (locked otherwise).
    if (valid && !aadhaarLocked) {
      const digits = values.aadhaar.replace(/\D/g, '');
      if (digits) {
        const check = validateAadhaar(digits);
        if (!check.valid) {
          setError(check.error ?? 'Kripya valid 12-digit Aadhaar number daalein.');
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
      Alert.alert('Profile updated!', 'Aapki details save ho gayi hain.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
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
            <Text style={styles.title}>Update your details</Text>
            <Text style={styles.subtitle}>
              Registration ki sabhi details yahan badal sakte ho. Number khud nahi badalta.
            </Text>

            {loadingProfile && (
              <View style={styles.loaderRow}>
                <ActivityIndicator size="large" color={colors.primaryDark} />
                <Text style={styles.noticeText}>Loading your details…</Text>
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
              label="Update Profile"
              onPress={onSave}
              loading={busy || loadingProfile}
              disabled={busy || loadingProfile}
              size="lg"
              style={styles.mt}
            />

            <Text style={styles.support}>Need help? Contact support • {SUPPORT_PHONE}</Text>
          </ScrollView>
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
          <Text style={styles.title}>Update your details</Text>
          <Text style={styles.subtitle}>
            Number ke saath yeh sab details badal sakte hain. Number khud nahi badalta.
          </Text>

          <Input
            label="Full name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearErrors();
            }}
            error={nameError ?? undefined}
            containerStyle={styles.mt}
          />

          <Input
            label="Phone number"
            value={user?.phone}
            editable={false}
            hint="Verified number — yahan nahi badal sakte"
            containerStyle={styles.mt}
          />

          <View style={styles.mt}>
            <Text style={styles.label}>Area</Text>
            <LocationPicker
              placeholder="Search area — Madhapur, Kukatpally…"
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
            label="Address / landmark"
            placeholder="House no., street, landmark"
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
            label="Update Profile"
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.saveBtn}
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
});
