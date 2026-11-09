module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.ts$": "@swc/jest" },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  globalSetup: "<rootDir>/tests/global-setup.ts",
  globalTeardown: "<rootDir>/tests/global-teardown.ts",
  setupFiles: ["<rootDir>/tests/env.ts"],
};
