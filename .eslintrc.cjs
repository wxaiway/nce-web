module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
