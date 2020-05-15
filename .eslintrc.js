module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true
  },
  extends: ["standard"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly"
  },
  parserOptions: {
    ecmaVersion: 11
  },
  rules: {
    quotes: ["error", "double"],
    "comma-dangle": ["error", "never"],
    "handle-callback-err": "off",
    semi: ["error", "always"]
  },
  parser: "babel-eslint",
  plugins: ["babel"]
};
