import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
  TextInput,
  View,
} from 'react-native';

import {
  BrandLogo,
  Button,
  Header,
  Input,
  LocationPicker,
  Screen,
  Select,
  type PlaceResult,
} from '@/components';
import { AVAILABILITY_OPTIONS, LEGAL_URLS, SKILLS, SUPPORT_PHONE, VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { registerWorker } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatAadhaar, validateAadhaar } from '@/utils';

export default function RegisterWorkerScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [skill, setSkill] = useState<string | null>(null);
  const [experience, setExperience] = useState('');
  const [area, setArea] = useState<string | null>(user?.locationArea ?? null);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number } | null>(null);
  const [aadhaar, setAadhaar] = useState('');
  const [availability, setAvailability] = useState<string | null>(AVAILABILITY_OPTIONS[0].value);
  const [rate, setRate] = useState('');
  const [terms, setTerms] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [workPhotos, setWorkPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strict Aadhaar gate (UIDAI Verhoeff checksum — see utils/aadhaar): empty
  // is fine (optional), but anything typed must checksum-pass before Submit.
  const aadhaarDigits = aadhaar.replace(/\D/g, '');
  const aadhaarCheck = aadhaarDigits ? validateAadhaar(aadhaarDigits) : null;
  const aadhaarValid = !aadhaarCheck || aadhaarCheck.valid;

  const pickProfilePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setProfilePhoto(res.assets[0].uri);
  };

  const pickWorkPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.7,
    });
    if (!res.canceled) setWorkPhotos(res.assets.slice(0, 5).map((a) => a.uri));
  };

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Verify your number', 'Please verify your mobile number first, then submit.', [
        { text: 'Verify now', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      setError('Enter your full name.');
      return;
    }
    if (!skill) {
      setError('Select your skill.');
      return;
    }
    const exp = Number(experience);
    if (!Number.isFinite(exp) || exp < VALIDATION.MIN_EXPERIENCE || exp > VALIDATION.MAX_EXPERIENCE) {
      setError(`Enter experience between ${VALIDATION.MIN_EXPERIENCE} and ${VALIDATION.MAX_EXPERIENCE} years.`);
      return;
    }
    if (!area) {
      setError('Select your area.');
      return;
    }
    // Strict Aadhaar gate — if the worker typed anything, it must pass the
    // UIDAI Verhoeff checksum, not just be 12 digits.
    const aadhaarDigits = aadhaar.replace(/\D/g, '');
    if (aadhaarDigits) {
      const aadhaarCheck = validateAadhaar(aadhaarDigits);
      if (!aadhaarCheck.valid) {
        setError(aadhaarCheck.error ?? 'Kripya valid 12-digit Aadhaar number daalein.');
        return;
      }
    }
    const rateValue = Number(rate);
    if (!Number.isFinite(rateValue) || rateValue < VALIDATION.MIN_RATE || rateValue > VALIDATION.MAX_RATE) {
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
      // NOTE: the API stores one hourly rate per worker; the form's "per day"
      // charge is sent as `hourlyRate`. The Aadhaar number is optional and only
      // visible to admins during verification.
      await registerWorker({
        name: name.trim(),
        profile: {
          skills: [skill],
          experience: exp,
          hourlyRate: rateValue,
          serviceAreas: [area],
          lat: coords?.lat,
          lng: coords?.lng,
          aadhaarNumber: aadhaar.replace(/\D/g, '') || undefined,
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
      header={<Header center={<BrandLogo size={28} />} />}
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

          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            containerStyle={styles.mt}
          />

          <View style={styles.mt}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneField}>
              <Text style={styles.phonePrefix}>+91 🇮🇳</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                // Login OTP isi number par jaata hai, aur backend isko session
                // se leta hai (form ka field waise bhi discard ho jaata) — isliye
                // yahan read-only.
                editable={false}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="98765 43210"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View style={styles.mt}>
            <Text style={styles.label}>Skills</Text>
            <Select
              placeholder="Select skill"
              value={skill}
              options={SKILLS.map((s) => ({ value: s.id, label: s.label }))}
              onChange={setSkill}
            />
            <Text style={styles.hint}>Select from: Plumber, Electrician</Text>
          </View>

          <Input
            label="Experience (Years)"
            placeholder="e.g. 3 years"
            keyboardType="number-pad"
            value={experience}
            onChangeText={setExperience}
            containerStyle={styles.mt}
          />

          <View style={styles.mt}>
            <Text style={styles.label}>Location</Text>
            <LocationPicker
              placeholder="Search your area"
              value={area}
              onSelect={(place: PlaceResult) => {
                setArea(place.description);
                setCoords({ lat: place.lat, lng: place.lng });
              }}
              icon="location-outline"
            />
          </View>

          <View style={styles.mt}>
            <Text style={styles.label}>Aadhaar Number (optional)</Text>
            <View style={styles.phoneField}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.phoneInput}
                value={aadhaar}
                // Auto-format as the official XXXX XXXX XXXX layout while typing.
                onChangeText={(text) => setAadhaar(formatAadhaar(text))}
                keyboardType="number-pad"
                maxLength={14}
                placeholder="XXXX XXXX XXXX"
                placeholderTextColor={colors.muted}
              />
            </View>
            {aadhaarDigits && !aadhaarValid ? (
              <Text style={styles.fieldError}>Kripya valid 12-digit Aadhaar number daalein.</Text>
            ) : (
              <Text style={styles.hint}>
                Optional — admin verification ke liye. UIDAI checksum galat number pakad leta hai, isliye dhyan se daalo.
              </Text>
            )}
          </View>

          <View style={[styles.mt, styles.uploadRow]}>
            <View style={styles.uploadCol}>
              <Text style={styles.label}>Photo Upload (optional)</Text>
              <Pressable style={styles.uploadBox} onPress={pickProfilePhoto}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.uploadPreview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={22} color={colors.primaryDark} />
                    <Text style={styles.uploadTitle}>Upload Profile Photo</Text>
                    <Text style={styles.uploadHint}>JPG/PNG, max 2MB</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.uploadCol}>
              <Text style={styles.label}>Upload Work Photos (optional)</Text>
              <Pressable style={styles.uploadBox} onPress={pickWorkPhotos}>
                {workPhotos.length > 0 ? (
                  <Text style={styles.uploadTitle}>{workPhotos.length} photo selected</Text>
                ) : (
                  <>
                    <Ionicons name="images-outline" size={22} color={colors.primaryDark} />
                    <Text style={styles.uploadTitle}>+ Add Photos (up to 5)</Text>
                    <Text style={styles.uploadHint}>Show your previous work</Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.hint}>Ye photos isi application ke saath review ke liye dikhai jayengi.</Text>
            </View>
          </View>

          <View style={styles.mt}>
            <Text style={styles.label}>Availability</Text>
            <Select
              placeholder="Select availability"
              value={availability}
              options={AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
              onChange={setAvailability}
            />
          </View>

          <Input
            label="Expected Charge (₹ per hour)"
            placeholder="300"
            keyboardType="number-pad"
            maxLength={5}
            // Disable Android autofill so the OS does not inject the user's phone
            // number into this money field (same bug seen on the hire/rate screen).
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            value={rate}
            onChangeText={setRate}
            hint={`Hourly rate — ₹${VALIDATION.MIN_RATE} se ₹${VALIDATION.MAX_RATE} tak. Jyada kaam hoga to final amount isi hisaab se badhega.`}
            error={error ?? undefined}
            containerStyle={styles.mt}
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
            size="lg"
            // Dead button until the Aadhaar digits (when typed) pass Verhoeff.
            disabled={!aadhaarValid}
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
  brandCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.xs },
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
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs },
  fieldError: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.danger, marginTop: spacing.xs },
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
  phonePrefix: { fontSize: fontSize.small, color: colors.textPrimary, fontWeight: fontWeight.medium },
  phoneInput: { flex: 1, fontSize: fontSize.body, color: colors.textPrimary, paddingVertical: 0 },
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
  uploadPreview: { width: '100%', height: '100%' },
  uploadTitle: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' },
  uploadHint: { fontSize: fontSize.caption - 2, color: colors.textSecondary, textAlign: 'center' },
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

