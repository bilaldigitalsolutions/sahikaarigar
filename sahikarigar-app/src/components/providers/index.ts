// Export all providers.
//
// The app authenticates with SuperTokens (see auth-server/ + SUPERTOKENS_SETUP.md),
// so the SuperTokens provider IS the app provider. It is also exported under the
// generic names AuthProvider / useAuth so pages and layout stay unchanged.
export {
  SuperTokensAuthProvider,
  SuperTokensAuthProvider as AuthProvider,
  useSuperTokensAuth,
  useSuperTokensAuth as useAuth,
} from './SuperTokensAuthProvider';
