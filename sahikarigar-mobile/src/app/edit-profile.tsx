import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Header,
  Input,
  LocationPicker,
  Screen,
  WorkerProfileForm,
  type PlaceResult,
  type WorkerProfileFormValues,
} from '@/components';
import { AVAILABILITY_OPTIONS, VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkerProfile, updateProfile, updateWorkerProfile } from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { validateAadhaar } from '@/utils';

/**
 * Edit Profile.
 *
 * Workers get the EXACT SAME form as the registration screen (shared
 * <WorkerProfileForm />) — pre-filled with everything they submitted, so any
 * registration detail can be changed here too. The Aadhaar number is locked
 * once it is on file (changing it would defeat the verification).
 *
 * Employers keep the simpler account form (name / phone / area / address).
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const isWorker = user?.role === 'worker';

  // ---- Account details (`users` table) -------------------------------------
  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [area, setArea] = useState(user?.locationArea ?? '');
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Worker registration details (`worker_profiles` table) ----------------
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [values, setValues] = useState<WorkerProfileFormValues>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    skills: [],
    experience: '',
    area: user?.locationArea ?? null,
    areaLat: null,
    areaLng: null,
    aadhaar: '',
    profilePhotoUri: null,
    profilePhotoDataUrl: null,
    profilePhotoUrl: null,
    newWorkPhotoUris: [],
    newWorkPhotoDataUrls: [],
    workPhotoUrls: [],
    availability: AVAILABILITY_OPTIONS[0].value,
    rate: '',
  });
  /** Skills stored in the DB that are outside the known SKILLS list. */
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  /** True when the worker already submitted an Aadhaar → field is read-only. */
  const [aadhaarLocked, setAadhaarLocked] = useState(false);
  const [aadhaarMasked, setAadhaarMasked] = useState<string | null>(null);
  /** The photo/area as they were loaded — lets us detect deletions & changes. */
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [originalArea, setOriginalArea] = useState<string | null>(null);

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
        aadhaar: worker.aadhaarOnFile ? (worker.aadhaarMasked ?? '') : '',
        profilePhotoUrl: worker.user?.avatar ?? null,
        workPhotoUrls: worker.portfolio ?? [],
        rate: worker.hourlyRate ? String(worker.hourlyRate) : '',
      }));
      setExtraSkills(worker.skills ?? []);
      setAadhaarLocked(Boolean(worker.aadhaarOnFile));
      setAadhaarMasked(worker.aadhaarMasked ?? null);
      setOriginalPhotoUrl(worker.user?.avatar ?? null);
      setOriginalArea(workerArea);
      if (!user?.locationArea && workerArea) setArea(workerArea);
    } catch {
      Alert.alert(
        'Worker profile details load nahi ho payi',
        'Please refresh the screen to try again.',
      );
    } finally {
      setLoadingProfile(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isWorker) return;
    void loadProfile();
  }, [isWorker, loadProfile]);

  const clearErrors = () => {
    if (nameError) setNameError(null);
    if (areaError) setAreaError(null);
    if (workerError) setWorkerError(null);
    if (error) setError(null);
  };

  const onSave = async () => {
    let valid = true;
    // Workers edit the shared form (values.*); employers edit the simple
    // account fields (name / area state).
    const finalName = (isWorker ? values.name : name).trim();
    const finalArea = ((isWorker ? values.area : area) ?? '').trim();

    if (finalName.length < VALIDATION.NAME_MIN_LENGTH) {
      setNameError('Enter your full name.');
      valid = false;
    }
    if (finalArea.length < 3) {
      setAreaError('Select your area from the picker below.');
      valid = false;
    }

    // Worker registration details must be valid before both tables are written.
    let exp = 0;
    let rateValue = 0;
    if (isWorker) {
      if (loadingProfile) {
        setWorkerError('Aapke kaarigar details abhi load ho rahe hain — thodi der me phir save karo.');
        valid = false;
      } else if (values.skills.length === 0) {
        setWorkerError('Select at least one skill.');
        valid = false;
      } else {
        exp = Math.round(Number(values.experience));
        if (
          !Number.isFinite(exp) ||
          exp < VALIDATION.MIN_EXPERIENCE ||
          exp > VALIDATION.MAX_EXPERIENCE
        ) {
          setWorkerError(
            `Enter experience between ${VALIDATION.MIN_EXPERIENCE} and ${VALIDATION.MAX_EXPERIENCE} years.`,
          );
          valid = false;
        }
      }
      if (valid) {
        rateValue = Number(values.rate);
        if (
          !Number.isFinite(rateValue) ||
          rateValue < VALIDATION.MIN_RATE ||
          rateValue > VALIDATION.MAX_RATE
        ) {
          setWorkerError(
            `Enter a charge between ₹${VALIDATION.MIN_RATE} and ₹${VALIDATION.MAX_RATE}.`,
          );
          valid = false;
        }
      }
      // Aadhaar — editable only while none is on file.
      if (valid && !aadhaarLocked) {
        const digits = values.aadhaar.replace(/\D/g, '');
        if (digits) {
          const check = validateAadhaar(digits);
          if (!check.valid) {
            setWorkerError(check.error ?? 'Kripya valid 12-digit Aadhaar number daalein.');
            valid = false;
          }
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
      if (isWorker) {
        const digits = aadhaarLocked ? '' : values.aadhaar.replace(/\D/g, '');
        const removedPhoto = Boolean(originalPhotoUrl) && !values.profilePhotoUrl;
        await updateWorkerProfile({
          skills: values.skills,
          experience: exp,
          hourlyRate: rateValue,
          // The service area is only sent when the worker picked a NEW one in
          // this session, so untouched edits never overwrite the stored lat/lng.
          ...(finalArea && finalArea !== originalArea ? { serviceAreas: [finalArea] } : {}),
          ...(digits ? { aadhaarNumber: digits } : {}),
          ...(values.profilePhotoDataUrl
            ? { profilePhotoDataUrl: values.profilePhotoDataUrl }
            : {}),
          ...(removedPhoto ? { removeProfilePhoto: true } : {}),
          ...(values.newWorkPhotoDataUrls.length
            ? { workPhotoDataUrls: values.newWorkPhotoDataUrls }
            : {}),
          // The work photos the worker kept (the deleted ones are simply gone).
          portfolioToKeep: values.workPhotoUrls,
        });
      }
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
      <KeyboardAvoidingView
        style={styles.flexRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen edges={['bottom']} header={<Header title="Edit Profile" showBack={false} />}>
          <Text style={styles.heading}>Update your details</Text>
          <Text style={styles.sub}>
            Registration ki sabhi details yahan badal sakte ho. Number khud nahi badalta.
          </Text>

          {loadingProfile && !values.skills.length ? (
            <Text style={styles.hint}>Aapke kaarigar details load ho rahe hain…</Text>
          ) : (
            <WorkerProfileForm
              values={values}
              onChange={(p) => {
                patch(p);
                clearErrors();
              }}
              error={workerError ?? nameError ?? areaError ?? error}
              aadhaarLocked={aadhaarLocked}
              aadhaarMasked={aadhaarMasked}
              extraSkills={extraSkills}
            />
          )}

          <View style={styles.mt}>
            <Text style={styles.label}>Address / landmark</Text>
            <Input
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
          </View>

          <Button
            label="Update Profile"
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.saveBtn}
          />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={busy} />
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  // -------------------------------------------------------------- employer --
  return (
    <KeyboardAvoidingView
      style={styles.flexRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen edges={['bottom']} header={<Header title="Edit Profile" showBack={false} />}>
        <Text style={styles.heading}>Update your details</Text>
        <Text style={styles.sub}>
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
          value={user.phone}
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
          label="City"
          value="Hyderabad"
          editable={false}
          hint="Abhi hum sirf Hyderabad me hain"
          containerStyle={styles.mt}
        />

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
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexRoot: { flex: 1 },
  heading: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  mt: { marginTop: spacing.lg },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.sm },
  saveBtn: { marginTop: spacing.xl },
});
