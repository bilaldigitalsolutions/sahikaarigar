import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Button, Card, Screen } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

const EMPLOYER_FAQS: { q: string; a: string }[] = [
  {
    q: 'SahiKaarigar kaise kaam karta hai?',
    a:
      'App par apni requirement post karo — nearby verified workers milegi. Profile dekho, hire karo, aur kaam complete hone par in-app payment karo.',
  },
  {
    q: 'Kya worker verified hota hai?',
    a:
      'Haan, sabhi workers ka phone number aur ID verify hoti hai. Kaam complete hone ke baad rating aur review bhi milti hai, jo trust banati hai.',
  },
  {
    q: 'Payment kaise karni hai?',
    a:
      'Payment app ke through hi hoti hai — UPI, card ya wallet se. Paise kaam complete hone ke baad release hote hai, taaki dono pakde safe rahein.',
  },
  {
    q: 'Mera phone number safe hai?',
    a:
      'Haan, aapka phone number kabhi worker ko directly nahi dikhaya jata. Sabhi communication app ke through hota hai jab tak hire confirm nahi ho jata.',
  },
];

const WORKER_FAQS: { q: string; a: string }[] = [
  {
    q: 'Registration kaise karoon?',
    a:
      'App download karke "Join as Kaarigar" par tap karo. Apna naam, phone, skill aur area bharo — OTP verify karke account chalu kar lo.',
  },
  {
    q: 'Mujhe paise kaise milenge (Commission)?',
    a:
      'Kaam complete hone ke baad client app se payment karta hai. Platform commission kaat kar baaki amount aapke wallet/bank mein aata hai.',
  },
  {
    q: 'Zyada jobs kaise milengi?',
    a:
      'Apni profile complete rakho, rating aur review achhe rakho, aur availability "Available" set karo — nearby employers ko aapki profile zyada dikhegi.',
  },
  {
    q: 'Verification me kitna time lagta hai?',
    a:
      'OTP verification instant hai. ID proof aur skill verification mein aam taur par 24-48 ghante lagte hain — uske baad aap hire ho sakte hain.',
  },
];

type Tab = 'employer' | 'worker';

export default function FAQScreen() {
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
        <Text style={styles.header}>Frequently Asked Questions</Text>
      </View>

      {/* Segmented control — two equal pill buttons inside one rounded track. */}
      <View style={styles.tabTrack}>
        {[
          { value: 'employer' as Tab, label: 'For Employers' },
          { value: 'worker' as Tab, label: 'For Workers' },
        ].map((t) => {
          const active = tab === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => setTab(t.value)}
              style={[styles.tabItem, active && styles.tabActive]}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {faqs.map((faq, i) => (
          <Card key={i} style={styles.faqCard}>
            <Pressable onPress={() => toggle(i)} style={styles.faqRow}>
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              <Ionicons
                name={isOpen(i) ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={colors.primaryDark}
                style={styles.faqChevron}
              />
            </Pressable>
            {isOpen(i) && (
              <View style={styles.faqAnswerWrap}>
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              </View>
            )}
          </Card>
        ))}
      </View>

      <View style={styles.contactWrap}>
        <Button
          label="Still need help? Contact WhatsApp Support"
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
