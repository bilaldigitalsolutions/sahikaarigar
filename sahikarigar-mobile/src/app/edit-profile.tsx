import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Header, Input, LocationPicker, Screen, type PlaceResult } from '@/components';
import { VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/**
 * Edit the signed-in account — name, area (single LocationPicker), read-only
 * city, address/landmark. Phone number is identity and never editable here.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  // Pre-fill from the actual user — never a "User" default; empty stays empty.
  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [area, setArea] = useState(user?.locationArea ?? '');
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const clearErrors = () => {
    if (nameError) setNameError(null);
    if (areaError) setAreaError(null);
    if (error) setError(null);
    if (saved) setSaved(false);
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
    if (!valid) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        name: name.trim(),
        locationArea: area.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flexRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen edges={['bottom']} header={<Header title="Edit Profile" />}>
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
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.sm },
  savedText: { color: colors.success, fontSize: fontSize.caption, marginTop: spacing.md },
  saveBtn: { marginTop: spacing.xl },
});
