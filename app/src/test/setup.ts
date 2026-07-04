import "@testing-library/jest-dom";

// Suppress framer-motion React.Fragment className warnings in jsdom
// This is a known compatibility issue in jsdom - framer-motion v12 internally
// renders as Fragment during testing, which triggers this harmless warning
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Invalid prop `className` supplied to `React.Fragment`")
  ) {
    return;
  }
  originalError(...args);
};