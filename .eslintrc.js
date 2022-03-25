module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: ['airbnb', 'prettier'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 12,
  },
  overrides: [
    {
      files: ['hardhat.config.js'],
      globals: { task: true },
    },
  ],
  globals: {
    artifacts: true,
  },
  rules: {
    'no-console': 'off',
    quotes: ['error', 'single'],
    'no-restricted-syntax': 0,
    'import/extensions': 0,
    'no-underscore-dangle': 0,
    'max-len': 0,
    camelcase: 0,
    'no-multi-str': 'off',
    eqeqeq: 0,
    'no-unused-expressions': 0,
    'comma-dangle': 'off',
  },
};
