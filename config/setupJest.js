// Fail tests on any error:
console.error = (message) => {
  throw new Error(message);
};
