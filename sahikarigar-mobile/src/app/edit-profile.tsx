import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Header, Input, LocationPicker, Screen, type PlaceResult } from '@/components';
import { SKILLS, VALIDATION, skillLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkerProfile, updateProfile, updateWorkerProfile } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/**
 * Edit the signed-in account — name, area (single LocationPicker), read-only
 * city, address/landmark. Phone number is identity and never editable here.
 *
 * Workers additionally see + edit their registration details from the
 * `worker_profiles` table: Skills (multi-select chips), Experience, Expected
 * Rate and Service Area. "Save Changes" writes BOTH tables — `users` (name,
 * area, address) and `worker_profiles` (skills, experience, rate, service
 * areas) — without touching the admin approval flags.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const isWorker = user?.role === 'worker';

  // ---- Basic account details (`users` table) -------------------------------
  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [area, setArea] = useState(user?.locationArea ?? '');
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ---- Worker registration details (`worker_profiles` table) ---------------
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const /** Skills stored that are outside the known SKILLS list — kept intact. */
    [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [rate, setRate] = useState('');
  /** Only set when the worker picks a NEW service area in this session. */
  const [pickedServiceArea, setPickedServiceArea] = useState<string | null>(null);

  // Load the worker's registration details once for the `worker_profiles` form.
  useEffect(() => {
    if (!isWorker) return;
    let active = true;
    setLoadingProfile(true);
    (async () => {
      try {
        const worker = await getWorkerProfile();
        if (!active) return;
        setSkills(worker && worker.skills.length ? worker.skills : []);
        setExtraSkills(worker && worker.skills.length ? worker.skills : []);
        setExperience(worker ? String(worker.experience ?? 0) : '');
        setRate(worker && worker.hourlyRate ? String(worker.hourlyRate) : '');
        // Prefill the area picker from the registered service area when the
        // account-level area is empty.
        if (worker && !user?.locationArea && worker.serviceAreas[0]) {
          setArea(worker.serviceAreas[0]);
        }
      } catch {
        Alert.alert(
          'Worker profile details load nahi ho payi',
          'Please refresh the screen to try again.',
        );
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorker]);

  const clearErrors = () => {
    if (nameError) setNameError(null);
    if (areaError) setAreaError(null);
    if (workerError) setWorkerError(null);
    if (error) setError(null);
    if (saved) setSaved(false);
  };

  const toggleSkill = (id: string) => {
    setSkills((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    clearErrors();
  };

  const onSave = async () => {
    let valid = true;
    if (name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      setNameError('Enter your full name.');
      valid = false;
    }
    if (area.trim().length < 3) {
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
      } else if (skills.length === 0) {
        setWorkerError('Select at least one skill.');
        valid = false;
      } else {
        exp = Math.round(Number(experience));
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
        rateValue = Number(rate);
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
    }

    if (!valid) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // 1) The base account (name + area + address — `users` table).
      await updateProfile({
        name: name.trim(),
        locationArea: area.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      // 2) The worker registration details (`worker_profiles` table). The
      // service area is only sent when the worker picked a NEW one in this
      // session, so untouched edits never overwrite the stored lat/lng.
      if (isWorker) {
        await updateWorkerProfile({
          skills,
          experience: exp,
          hourlyRate: rateValue,
          ...(pickedServiceArea ? { serviceAreas: [pickedServiceArea] } : {}),
        });
      }
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const workerSection = isWorker ? (
    <>
      <Text style={[styles.heading, styles.workerHeading]}>Kaarigar details</Text>
      <Text style={styles.sub}>Aapki registration details — jobs isi ke hisaab se match hoti hain.</Text>

      {loadingProfile && !skills.length ? (
        <Text style={styles.hint}>Aapke kaarigar details load ho rahe hain…</Text>
      ) : (
        <>
          <View style={styles.mt}>
            <Text style={styles.label}>Skills</Text>
            <View style={styles.chipsRow}>
              {[
                ...SKILLS.map((s) => ({ id: s.id, label: s.label })),
                ...extraSkills
                  .filter((id) => !SKILLS.some((s) => s.id === id))
                  .map((id) => ({ id, label: skillLabel(id) })),
              ].map((chip) => {
                const selected = skills.includes(chip.id);
                return (
                  <Pressable
                    key={chip.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleSkill(chip.id)}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.caption,
                        fontWeight: fontWeight.medium,
                        color: selected ? colors.white : colors.textPrimary,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Experience (years)"
            placeholder="e.g. 3 years"
            keyboardType="number-pad"
            maxLength={2}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            value={experience}
            onChangeText={(text) => {
              setExperience(text);
              clearErrors();
            }}
            containerStyle={styles.mt}
          />

          <Input
            label="Expected charge (₹ per hour)"
            placeholder="300"
            keyboardType="number-pad"
            maxLength={5}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            value={rate}
            onChangeText={(text) => {
              setRate(text);
              clearErrors();
            }}
            hint={`₹${VALIDATION.MIN_RATE} se ₹${VALIDATION.MAX_RATE} tak — employers ko yahi rate dikhega.`}
            containerStyle={styles.mt}
          />
        </>
      )}
      {workerError ? <Text style={styles.errorText}>{workerError}</Text> : null}
    </>
  ) : null;

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

        {workerSection}

        <View style={styles.mt}>
          <Text style={styles.label}>{isWorker ? 'Service area' : 'Area'}</Text>
          <LocationPicker
            placeholder="Search area — Madhapur, Kukatpally…"
            value={area}
            onSelect={(place: PlaceResult) => {
              setArea(place.description);
              if (isWorker) setPickedServiceArea(place.description);
              clearErrors();
            }}
            icon="location-outline"
          />
          {isWorker ? (
            <Text style={styles.hint}>Yahin se aapko jobs ki talash hogi (service area).</Text>
          ) : null}
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
        {saved ? <Text style={styles.savedText}>Profile updated!</Text> : null}

        <Button
          label="Save Changes"
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
  workerHeading: { marginTop: spacing.xl, marginBottom: spacing.xs },
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
  savedText: { color: colors.success, fontSize: fontSize.caption, marginTop: spacing.md },
  saveBtn: { marginTop: spacing.xl },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
  },
  chipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
});
