module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/web-admin/", "/tests/e2e/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ],
  collectCoverageFrom: [
    "App.tsx",
    "shared/**/*.ts",
    "src/**/*.{ts,tsx}",
    "supabase/functions/_shared/**/*.ts",
    "supabase/functions/*/core.ts"
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  }
};
