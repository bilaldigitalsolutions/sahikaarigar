import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo, Button, Card, LocationPicker, Rating, Screen, Select } from '@/components';
import { SKILLS } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

const TRUST = [
  { icon: 'shield-checkmark-outline', label: 'Verified Workers' },
  { icon: 'leaf-outline', label: 'Eco-Friendly' },
  { icon: 'time-outline', label: 'On-Time' },
  { icon: 'lock-closed-outline', label: 'Secure Payment' },
] as const;

const HOW = [
  { step: '1', title: 'Search Workers', desc: 'Pick the skill and area you need' },
  { step: '2', title: 'View Profile', desc: 'See the worker profile, ratings and experience' },
  { step: '3', title: 'Hire Now', desc: 'Send a hire request in one tap' },
] as const;

const REVIEWS = [
  {
    name: 'Rahul Verma',
    area: 'Ameerpet',
    rating: 5,
    text: 'The electrician arrived in 30 minutes and did a clean job. The rate was fair too.',
  },
  {
    name: 'Sneha Reddy',
    area: 'Kukatpally',
    rating: 5,
    text: 'The plumber fixed the leak right away. Being a verified worker, I felt completely safe.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [service, setService] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);

  const goRegister = () => router.push('/register-worker');

  // Guest browse — browsing is free, so the category cards and "Hire a
  // Worker" open the search screen instead of a login wall. Same split as the
  // Search card below: signed-in users stay inside the tabs, guests get the
  // public results route (categories pass their skill as the filter).
  const goBrowse = (skill?: string) => {
    const params: { skill?: string } = {};
    if (skill) params.skill = skill;

    if (user) {
      router.push({ pathname: '/(tabs)/search', params });
    } else {
      router.push({ pathname: '/search', params });
    }
  };

  const onSearch = () => {
    // Browsing is free — never ask for verification here. Signed-in users stay
    // inside the tabs; everyone else gets the public results route.
    const params: { skill?: string; area?: string } = {};
    if (service) params.skill = service;
    if (area) params.area = area;

    if (user) {
      router.push({ pathname: '/(tabs)/search', params });
    } else {
      router.push({ pathname: '/search', params });
    }
  };

  return (
    <Screen scroll padded={false} contentStyle={styles.content}>
      {/* Brand header */}
      <View style={styles.header}>
        <BrandLogo size={34} />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <Ionicons name="leaf" size={13} color={colors.primaryDark} />
          <Text style={styles.badgeText}>Trusted • Eco-Friendly • On-Demand</Text>
        </View>
        <Text style={styles.h1}>Find Skilled Workers You Can Trust</Text>
        <Text style={styles.heroSub}>
          Hire verified plumbers, electricians, carpenters & more — on-demand, eco-friendly services
          for your home. Safe, reliable, and sustainable.
        </Text>

        {/* Search card: 2 fields (services dropdown + area) */}
        <Card style={styles.searchCard}>
          <Select
            placeholder="Select service"
            icon="construct-outline"
            value={service}
            options={SKILLS.map((s) => ({ value: s.id, label: `${s.icon}  ${s.label}` }))}
            onChange={setService}
          />
          <LocationPicker
            placeholder="Select area"
            icon="location-outline"
            value={area}
            onSelect={(place) => setArea(place.description)}
          />
          <Button label="Search" icon={<Ionicons name="search" size={18} color={colors.white} />} onPress={onSearch} />
        </Card>

        {/* Trust badges */}
        <View style={styles.trustRow}>
          {TRUST.map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Ionicons name={t.icon} size={15} color={colors.primaryDark} />
              <Text style={styles.trustText}>{t.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Browse by Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <Text style={styles.sectionSub}>Choose from our most popular service categories</Text>
        <View style={styles.categoryGrid}>
          {SKILLS.map((s) => (
            <Pressable key={s.id} style={styles.categoryCard} onPress={() => goBrowse(s.id)}>
              <Text style={styles.categoryIcon}>{s.icon}</Text>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryLabel}>{s.label}</Text>
                <Text style={styles.categorySub}>Verified workers</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* How It Works (only section with a gray background) */}
      <View style={styles.howSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.howRow}>
          {HOW.map((h) => (
            <View key={h.step} style={styles.howItem}>
              <View style={styles.howStep}>
                <Text style={styles.howStepText}>{h.step}</Text>
              </View>
              <Text style={styles.howTitle}>{h.title}</Text>
              <Text style={styles.howDesc}>{h.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Testimonials */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.mt]}>Sample Reviews</Text>
        {REVIEWS.map((r) => (
          <Card key={r.name} style={styles.reviewCard}>
            <Rating value={r.rating} size={14} />
            <Text style={styles.reviewText}>{r.text}</Text>
            <Text style={styles.reviewAuthor}>
              — {r.name}, {r.area}
            </Text>
          </Card>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Text style={styles.ctaTitle}>Ready to get started?</Text>
        <Text style={styles.ctaSub}>Something for workers and employers alike</Text>
        <Button label="Kaarigar Registration" onPress={goRegister} style={styles.ctaBtn} />
        <Button label="Hire a Worker" variant="secondary" onPress={() => goBrowse()} style={styles.ctaBtn} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  badgeText: { fontSize: fontSize.caption - 1, color: colors.primaryDark, fontWeight: fontWeight.medium },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: fontWeight.bold, color: colors.textPrimary },
  heroSub: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 },
  searchCard: { marginTop: spacing.lg, gap: spacing.md },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: fontSize.caption - 1, color: colors.textSecondary },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  sectionTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  categoryIcon: { fontSize: 22 },
  categoryInfo: { flex: 1 },
  categoryLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  categorySub: { fontSize: fontSize.caption - 2, color: colors.textSecondary },
  howSection: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    marginTop: spacing.xxl,
  },
  howRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  howItem: { flex: 1, alignItems: 'center' },
  howStep: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  howStepText: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.primaryDark },
  howTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  howDesc: {
    fontSize: fontSize.caption - 2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  workerCard: { marginTop: spacing.md },
  workerRow: { flexDirection: 'row', alignItems: 'center' },
  workerAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitials: { color: colors.white, fontSize: fontSize.title, fontWeight: fontWeight.bold },
  workerInfo: { flex: 1, marginLeft: spacing.md },
  workerName: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  workerMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 4 },
  workerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  workerRate: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  mt: { marginTop: spacing.xxl, marginBottom: spacing.md },
  reviewCard: { marginTop: spacing.md },
  reviewText: {
    fontSize: fontSize.small,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  reviewAuthor: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.sm },
  cta: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.white, textAlign: 'center' },
  ctaSub: {
    fontSize: fontSize.caption,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  ctaBtn: { width: '100%' },
});
