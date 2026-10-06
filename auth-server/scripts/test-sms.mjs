/**
 * Send ONE real OTP through the SMS provider the environment selects.
 *
 * This is the fastest way to prove a provider's credentials work — it isolates
 * SMS delivery from SuperTokens and Supabase, so a failure here means the
 * provider key/config is wrong, not the login flow.
 *
 * Usage:  cd auth-server && npm run test-sms -- 9876543210
 *
 * Override the provider inline for a dry run:
 *   PowerShell :  $env:SMS_PROVIDER='console'; npm run test-sms -- 9876543210
 *   bash       :  SMS_PROVIDER=console npm run test-sms -- 9876543210
 */
import 'dotenv/config';
import { sendOtpSms, resolveSmsProvider, SUPPORTED_SMS_PROVIDERS } from '../src/sms.js';

// Kept local so this script needs neither Supabase nor SuperTokens to run.
const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
};

const phone = normalizePhone(process.argv[2]);
if (!/^[6-9]\d{9}$/.test(phone)) {
  console.error('✗ Pass a 10-digit Indian mobile number, e.g.  npm run test-sms -- 9876543210');
  console.error(`  supported providers: ${SUPPORTED_SMS_PROVIDERS.join(', ')}`);
  process.exit(1);
}

const otp = String(Math.floor(100000 + Math.random() * 900000));
const provider = resolveSmsProvider();

console.log('\n📨 SMS provider test');
console.log(`   provider : ${provider}`);
console.log(`   to       : +91${phone}`);
console.log(`   otp      : ${otp}`);
console.log(
  provider === 'console'
    ? '   (console prints the OTP below — no real SMS, no cost)\n'
    : '   sending…\n',
);

try {
  await sendOtpSms({ phone, otp });
  console.log(`✅ ${provider} accepted the send — check the phone for the code.\n`);
} catch (error) {
  console.log(`❌ ${provider} failed: ${error.message}\n`);
  process.exitCode = 1;
}
