// =============================================================================
// Worker Profile Form — SHARED between "Join as Kaarigar" and "Edit Profile"
// =============================================================================
// Both screens must show the EXACT same fields so a worker can change
// anything they gave at registration: name, phone, skills, experience, area,
// Aadhaar, profile photo, work photos (portfolio), availability and rate.
//
// The form is dumb: it renders the fields and reports every change through
// `onChange`. The parent owns the state, the validation and the submit.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Input, LocationPicker, Select, type PlaceResult } from '@/components/ui';
import { AVAILABILITY_OPTIONS, SKILLS, VALIDATION, skillLabel } from '@/constants';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatAadhaar, validateAadhaar } from '@/utils';

/** Work photos are capped at 5 (same limit as the registration form). */
export const MAX_WORK_PHOTOS = 5;

export interface WorkerProfileFormValues {
  name: string;
  /** Read-only — the phone is the identity, it never changes here. */
  phone: string;
  skills: string[];
  experience: string;
  area: string | null;
  /** Coordinates of the picked area (when the provider gave them). */
  areaLat?: number | null;
  areaLng?: number | null;
  aadhaar: string;
  /** Local preview of the freshly picked Aadhaar photo. */
  aadhaarPhotoUri: string | null;
  /** Data URL of the freshly picked Aadhaar photo (upload payload). */
  aadhaarPhotoDataUrl: string | null;
  /** Local preview of a freshly picked profile photo (null = unchanged). */
  profilePhotoUri: string | null;
  /** Data URL of the freshly picked profile photo (upload payload). */
  profilePhotoDataUrl: string | null;
  /** Remote url of the stored profile photo. */
  profilePhotoUrl: string | null;
  /** Local previews of freshly picked work photos. */
  newWorkPhotoUris: string[];
  /** Data URLs of freshly picked work photos (upload payload). */
  newWorkPhotoDataUrls: string[];
  /** Remote urls of the stored work photos the worker kept. */
  workPhotoUrls: string[];
  availability: string | null;
  rate: string;
}

export interface WorkerProfileFormProps {
  values: WorkerProfileFormValues;
  onChange: (patch: Partial<WorkerProfileFormValues>) => void;
  /** Inline error for the whole form (server or validation failure). */
  error?: string | null;
  /** True when an Aadhaar is already on file → the field is read-only. */
  aadhaarLocked?: boolean;
  /** Masked Aadhaar shown when the field is locked. */
  aadhaarMasked?: string | null;
  /** Skill ids stored in the DB that are not part of the known SKILLS list. */
  extraSkills?: string[];
  /** Registration requires an Aadhaar photo; Edit Profile does not render it. */
  requireAadhaarPhoto?: boolean;
}

export function WorkerProfileForm({
  values,
  onChange,
  error,
  aadhaarLocked = false,
  aadhaarMasked = null,
  extraSkills = [],
  requireAadhaarPhoto = false,
}: WorkerProfileFormProps) {
  const aadhaarDigits = (values.aadhaar ?? '').replace(/\D/g, '');
  const aadhaarCheck = validateAadhaar(aadhaarDigits);
  // Empty is NOT valid: Aadhaar is mandatory during worker registration.
  const aadhaarValid = aadhaarDigits.length === 12 && aadhaarCheck.valid;
  const aadhaarPhotoMissing =
    requireAadhaarPhoto && (!values.aadhaarPhotoUri || !values.aadhaarPhotoDataUrl);

  // Keep a synchronous mirror of the latest selection. Two chips tapped in the
  // same frame would otherwise both read the same `values.skills` prop and the
  // second patch would overwrite the first — making multi-select look broken.
  const skillsRef = useRef<string[]>(values.skills);
  useEffect(() => {
    skillsRef.current = values.skills;
  }, [values.skills]);

  const toggleSkill = (id: string) => {
    const current = skillsRef.current;
    const next = current.includes(id)
      ? current.filter((skill) => skill !== id)
      : [...current, id];
    skillsRef.current = next;
    onChange({ skills: next });
  };

  // ---- Photos --------------------------------------------------------------
  const pickProfilePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    // Reject photos larger than 5MB to avoid OOM from base64 encoding in state.
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Photo 5MB se badi hai', 'Kripya 5MB tak ki chhoti photo chunein.');
      return;
    }
    onChange({
      profilePhotoUri: asset.uri,
      profilePhotoDataUrl: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null,
    });
  };

  const removeProfilePhoto = () => {
    onChange({ profilePhotoUri: null, profilePhotoDataUrl: null, profilePhotoUrl: null });
  };

  const pickAadhaarPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    // Keep the same 5MB limit as the backend's decodeImageDataUrl().
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Photo 5MB se badi hai', 'Kripya 5MB tak ki chhoti photo chunein.');
      return;
    }
    onChange({
      aadhaarPhotoUri: asset.uri,
      aadhaarPhotoDataUrl: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null,
    });
  };

  const removeAadhaarPhoto = () => {
    onChange({ aadhaarPhotoUri: null, aadhaarPhotoDataUrl: null });
  };

  const pickWorkPhotos = async () => {
    const room = MAX_WORK_PHOTOS - (values.workPhotoUrls.length + values.newWorkPhotoUris.length);
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.length) return;

    const oversized = res.assets.filter((a) => a.fileSize && a.fileSize > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      Alert.alert('Photo 5MB se badi hai', 'Kripya 5MB tak ki chhoti photos chunein.');
      return;
    }

    const uris = res.assets.map((a) => a.uri);
    const dataUrls = res.assets
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : null))
      .filter((v): v is string => Boolean(v));
    onChange({
      newWorkPhotoUris: [...values.newWorkPhotoUris, ...uris],
      newWorkPhotoDataUrls: [...values.newWorkPhotoDataUrls, ...dataUrls],
    });
  };

  const removeWorkPhoto = (index: number) => {
    const workPhotoUrls = [...values.workPhotoUrls];
    const newWorkPhotoUris = [...values.newWorkPhotoUris];
    const newWorkPhotoDataUrls = [...values.newWorkPhotoDataUrls];
    if (index < workPhotoUrls.length) {
      workPhotoUrls.splice(index, 1);
    } else {
      const localIndex = index - workPhotoUrls.length;
      newWorkPhotoUris.splice(localIndex, 1);
      newWorkPhotoDataUrls.splice(localIndex, 1);
    }
    onChange({ workPhotoUrls, newWorkPhotoUris, newWorkPhotoDataUrls });
  };

  const totalWorkPhotos = values.workPhotoUrls.length + values.newWorkPhotoUris.length;
  const profilePreview = values.profilePhotoUri ?? values.profilePhotoUrl;

  return (
    <View>
      {/* ---- Full Name ---- */}
      <Input
        label="Full Name"
        placeholder="Enter your full name"
        value={values.name}
        onChangeText={(text) => onChange({ name: text })}
        containerStyle={styles.mt}
      />

      {/* ---- Phone (read-only) ---- */}
      <View style={styles.mt}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneField}>
          <Text style={styles.phonePrefix}>+91 🇮🇳</Text>
          <TextInput
            style={styles.phoneInput}
            value={values.phone}
            // Login OTP isi number par jaata hai, aur backend isko session se
            // leta hai (form ka field waise bhi discard ho jaata) — read-only.
            editable={false}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="98765 43210"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      {/* ---- Skills ---- */}
      <View style={styles.mt}>
        <Text style={styles.label}>Skills</Text>
        <View style={styles.chipsRow}>
          {[
            ...SKILLS.map((s) => ({ id: s.id, label: s.label })),
            ...extraSkills
              .filter((id) => !SKILLS.some((s) => s.id === id))
              .map((id) => ({ id, label: skillLabel(id) })),
          ].map((chip) => {
            const selected = values.skills.includes(chip.id);
            return (
              <Pressable
                key={chip.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleSkill(chip.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {values.skills.length > 0
            ? `${values.skills.length} selected — ek se zyada skill chun sakte ho.`
            : 'Ek se zyada skill chun sakte ho.'}
        </Text>
      </View>

      {/* ---- Experience ---- */}
      <Input
        label="Experience (Years)"
        placeholder="e.g. 3 years"
        keyboardType="number-pad"
        maxLength={2}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        value={values.experience}
        onChangeText={(text) => onChange({ experience: text })}
        containerStyle={styles.mt}
      />

      {/* ---- Location ---- */}
      <View style={styles.mt}>
        <Text style={styles.label}>Location</Text>
        <LocationPicker
          placeholder="Search your area"
          value={values.area}
          onSelect={(place: PlaceResult) =>
            onChange({
              area: place.description,
              areaLat: place.lat ?? null,
              areaLng: place.lng ?? null,
            })
          }
          icon="location-outline"
        />
      </View>

      {/* ---- Aadhaar ---- */}
      <View style={styles.mt}>
        <Text style={styles.label}>Aadhaar Number (required)</Text>
        <View style={[styles.phoneField, aadhaarLocked && styles.fieldLocked]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.phoneInput}
            value={aadhaarLocked ? (aadhaarMasked ?? '') : values.aadhaar}
            editable={!aadhaarLocked}
            // Auto-format as the official XXXX XXXX XXXX layout while typing.
            onChangeText={(text) => onChange({ aadhaar: formatAadhaar(text) })}
            keyboardType="number-pad"
            maxLength={14}
            placeholder="XXXX XXXX XXXX"
            placeholderTextColor={colors.muted}
          />
        </View>
        {aadhaarLocked ? (
          <Text style={styles.hint}>
            Aadhaar number submit ho chuka hai — verification ke liye use change nahi hota sakta.
          </Text>
        ) : !aadhaarValid ? (
          <Text style={styles.fieldError}>
            {aadhaarDigits.length === 0
              ? 'Aadhaar number zaroori hai — 12 digits daalein.'
              : (aadhaarCheck.error ?? 'Kripya valid 12-digit Aadhaar number daalein.')}
          </Text>
        ) : (
          <Text style={styles.hint}>
            Aadhaar number admin verification ke liye zaroori hai. UIDAI checksum galat number pakad leta hai.
          </Text>
        )}
      </View>

      {/* ---- Aadhaar photo (registration only) ---- */}
      {requireAadhaarPhoto ? (
        <View style={styles.mt}>
          <Text style={styles.label}>Aadhaar Photo (required)</Text>
          <Pressable
            style={[styles.uploadBox, styles.aadhaarUploadBox]}
            onPress={pickAadhaarPhoto}
            accessibilityRole="button"
            accessibilityLabel="Upload Aadhaar photo"
          >
            {values.aadhaarPhotoUri ? (
              <Image
                source={{ uri: values.aadhaarPhotoUri }}
                style={styles.uploadPreview}
                contentFit="cover"
              />
            ) : (
              <>
                <Ionicons name="card-outline" size={24} color={colors.primaryDark} />
                <Text style={styles.uploadTitle}>Upload Aadhaar Photo</Text>
                <Text style={styles.uploadHint}>JPG/PNG, max 5MB</Text>
              </>
            )}
          </Pressable>
          {values.aadhaarPhotoUri ? (
            <Pressable style={styles.removeRow} onPress={removeAadhaarPhoto}>
              <Ionicons name="trash-outline" size={13} color={colors.danger} />
              <Text style={styles.removeText}>Remove Aadhaar photo</Text>
            </Pressable>
          ) : null}
          {aadhaarPhotoMissing ? (
            <Text style={styles.fieldError}>Aadhaar photo upload karna zaroori hai.</Text>
          ) : (
            <Text style={styles.hint}>
              Aadhaar card ki saaf photo upload karein — sirf admin verification ke liye.
            </Text>
          )}
        </View>
      ) : null}

      {/* ---- Photos ---- */}
      <View style={[styles.mt, styles.uploadRow]}>
        <View style={styles.uploadCol}>
          <Text style={styles.label}>Profile Photo</Text>
          <Pressable style={styles.uploadBox} onPress={pickProfilePhoto}>
            {profilePreview ? (
              <Image
                source={{ uri: profilePreview }}
                style={styles.uploadPreview}
                contentFit="cover"
              />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={22} color={colors.primaryDark} />
                <Text style={styles.uploadTitle}>Upload Profile Photo</Text>
                <Text style={styles.uploadHint}>JPG/PNG, max 2MB</Text>
              </>
            )}
          </Pressable>
          {profilePreview ? (
            <Pressable style={styles.removeRow} onPress={removeProfilePhoto}>
              <Ionicons name="trash-outline" size={13} color={colors.danger} />
              <Text style={styles.removeText}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.uploadCol}>
          <Text style={styles.label}>Work Photos</Text>
          <Pressable style={styles.uploadBox} onPress={pickWorkPhotos}>
            {totalWorkPhotos > 0 ? (
              <Text style={styles.uploadTitle}>
                {totalWorkPhotos} photo{totalWorkPhotos > 1 ? 's' : ''} selected
              </Text>
            ) : (
              <>
                <Ionicons name="images-outline" size={22} color={colors.primaryDark} />
                <Text style={styles.uploadTitle}>+ Add Photos (up to {MAX_WORK_PHOTOS})</Text>
                <Text style={styles.uploadHint}>Show your previous work</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.hint}>Ye photos isi application ke saath review ke liye dikhai jayengi.</Text>
        </View>
      </View>

      {/* Work-photo thumbnails with delete buttons */}
      {totalWorkPhotos > 0 ? (
        <View style={[styles.mt, styles.thumbRow]}>
          {(values.workPhotoUrls ?? []).map((url, index) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
              <Pressable
                style={styles.thumbRemove}
                onPress={() => removeWorkPhoto(index)}
                accessibilityLabel="Remove photo"
              >
                <Ionicons name="close" size={12} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {(values.newWorkPhotoUris ?? []).map((uri, index) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              <Pressable
                style={styles.thumbRemove}
                onPress={() => removeWorkPhoto(values.workPhotoUrls.length + index)}
                accessibilityLabel="Remove photo"
              >
                <Ionicons name="close" size={12} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* ---- Availability ---- */}
      <View style={styles.mt}>
        <Text style={styles.label}>Availability</Text>
        <Select
          placeholder="Select availability"
          value={values.availability}
          options={AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
          onChange={(v) => onChange({ availability: v })}
        />
      </View>

      {/* ---- Expected Charge ---- */}
      <Input
        label="Expected Charge (₹ per hour)"
        placeholder="300"
        keyboardType="number-pad"
        maxLength={5}
        // Disable Android autofill so the OS does not inject the user's phone
        // number into this money field.
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        value={values.rate}
        onChangeText={(text) => onChange({ rate: text })}
        hint={`Hourly rate — ₹${VALIDATION.MIN_RATE} se ₹${VALIDATION.MAX_RATE} tak.`}
        containerStyle={styles.mt}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mt: { marginTop: spacing.lg },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs },
  fieldError: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.md },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
  },
  fieldLocked: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder },
  phonePrefix: { fontSize: fontSize.small, color: colors.textPrimary, fontWeight: fontWeight.medium },
  phoneInput: { flex: 1, fontSize: fontSize.body, color: colors.textPrimary, paddingVertical: 0 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
  },
  chipSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  chipTextSelected: { color: colors.white },
  uploadRow: { flexDirection: 'row', gap: spacing.md },
  uploadCol: { flex: 1 },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 96,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    overflow: 'hidden',
  },
  aadhaarUploadBox: { height: 150 },
  uploadPreview: { width: '100%', height: '100%' },
  uploadTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  uploadHint: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  removeText: { fontSize: fontSize.caption - 2, fontWeight: fontWeight.medium, color: colors.danger },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryBg,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
});
