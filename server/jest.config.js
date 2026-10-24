// e2e-тесты по API на настоящей PostgreSQL (TEST_DATABASE_URL, см. README)
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testRegex: "\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  globalSetup: "<rootDir>/test/global-setup.js",
  testTimeout: 30000,
};
