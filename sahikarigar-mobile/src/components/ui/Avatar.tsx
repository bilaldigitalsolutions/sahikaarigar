import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeight } from '@/theme';
import { getInitials } from '@/utils';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={dimension} contentFit="cover" transition={150} />;
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name || '?')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.white, fontWeight: fontWeight.bold },
});
