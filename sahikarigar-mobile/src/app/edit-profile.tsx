import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button, Header, Input, LocationPicker, Screen, type PlaceResult } from '@/components';
import { VALIDATION } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/api';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/**
 * Edit the signed-in account — the screen you land on after registering, so a
 * profile can be corrected later (name, address, area, city).
 *
 * Only the fields the auth-server's `POST /profile` accepts are editable here;
 * the phone number is identity and can never be changed from this form.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [area, setArea] = useState(user?.locationArea ?? '');
  const [city, setCity] = useState(user?.locationCity ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    if (error) setError(null);
  };

  const onSave = async () => {
    if (name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      setError('Enter your full name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Empty fields are skipped rather than sent, so a blank box never wipes a
      // value the server already has (the API ignores empty strings too).
      await updateProfile({
        name: name.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(area.trim() ? { locationArea: area.trim() } : {}),
        ...(city.trim() ? { locationCity: city.trim() } : {}),
      });
      await refreshUser();
      router.back();
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
            clearError();
          }}
          containerStyle={styles.mt}
        />

        <Input
          label="Phone number"
          value={user.phone}
          editable={false}
          hint="Verified number — yahan nahi badal sakte"
          containerStyle={styles.mt}
        />

        <Input
          label="Area"
          placeholder="e.g. Madhapur, LB Nagar"
          value={area}
          onChangeText={(text) => {
            setArea(text);
            clearError();
          }}
          containerStyle={styles.mt}
        />

        <LocationPicker
          placeholder="Search area — Madhapur, Kukatpally…"
          value={area}
          onSelect={(place: PlaceResult) => {
            setArea(place.description);
            clearError();
          }}
          icon="location-outline"
        />

        <Input
          label="City"
          placeholder="Hyderabad"
          value={city}
          onChangeText={(text) => {
            setCity(text);
            clearError();
          }}
          containerStyle={styles.mt}
        />

        <Input
          label="Address / landmark"
          placeholder="House no., street, landmark"
          value={address}
          onChangeText={(text) => {
            setAddress(text);
            clearError();
          }}
          multiline
          numberOfLines={3}
          containerStyle={styles.mt}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label="Save changes"
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
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.md },
  saveBtn: { marginTop: spacing.xl },
});
