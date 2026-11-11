import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/** Each entry holds an i18n key pair; the strings are translated at render time. */
const EMPLOYER_FAQS: { q: string; a: string }[] = [
  { q: 'faq.employerQ1', a: 'faq.employerA1' },
  { q: 'faq.employerQ2', a: 'faq.employerA2' },
  { q: 'faq.employerQ3', a: 'faq.employerA3' },
  { q: 'faq.employerQ4', a: 'faq.employerA4' },
];

const WORKER_FAQS: { q: string; a: string }[] = [
  { q: 'faq.workerQ1', a: 'faq.workerA1' },
  { q: 'faq.workerQ2', a: 'faq.workerA2' },
  { q: 'faq.workerQ3', a: 'faq.workerA3' },
  { q: 'faq.workerQ4', a: 'faq.workerA4' },
];

type Tab = 'employer' | 'worker';

export default function FAQScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('employer');
  const [open, setOpen] = useState<Set<number>>(new Set());

  const faqs = tab === 'employer' ? EMPLOYER_FAQS : WORKER_FAQS;

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isOpen = (i: number) => open.has(i);

  return (
    <Screen scroll>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>{t('faq.pageTitle')}</Text>
      </View>

      {/* Segmented control — two equal pill buttons inside one rounded track. */}
      <View style={styles.tabTrack}>
        {[
          { value: 'employer' as Tab, label: t('faq.tabEmployers') },
          { value: 'worker' as Tab, label: t('faq.tabWorkers') },
        ].map((item) => {
          const active = tab === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setTab(item.value)}
              style={[styles.tabItem, active && styles.tabActive]}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {faqs.map((faq, i) => (
          <Card key={i} style={styles.faqCard}>
            <Pressable onPress={() => toggle(i)} style={styles.faqRow}>
              <Text style={styles.faqQuestion}>{t(faq.q)}</Text>
              <Ionicons
                name={isOpen(i) ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={colors.primaryDark}
                style={styles.faqChevron}
              />
            </Pressable>
            {isOpen(i) && (
              <View style={styles.faqAnswerWrap}>
                <Text style={styles.faqAnswer}>{t(faq.a)}</Text>
              </View>
            )}
          </Card>
        ))}
      </View>

      <View style={styles.contactWrap}>
        <Button
          label={t('faq.contactWhatsApp')}
          variant="secondary"
          fullWidth
          onPress={() =>
            Linking.openURL('https://wa.me/919949363310').catch(() => {})
          }
          style={styles.contactBtn}
        />
      </View>
    </Screen>
  );
}

const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

const styles = StyleSheet.create({
  headerWrap: { marginBottom: spacing.lg },
  header: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  // Segmented control: one rounded grey track, two equal pills inside, the
  // active one filled green. Equal flex keeps both labels from overlapping.
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.primaryDark,
  },
  tabLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: { color: colors.white },
  list: { gap: spacing.sm },
  faqCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    ...shadows.card,
  },
  faqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  faqQuestion: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  faqChevron: { marginLeft: spacing.sm },
  faqAnswerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primaryTint,
  },
  faqAnswer: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contactWrap: { marginTop: spacing.xxl },
  contactBtn: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
  },
});
