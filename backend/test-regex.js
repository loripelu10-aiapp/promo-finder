/**
 * Test regex pattern on actual price strings
 */

const testStrings = [
  "$80.97$115",
  "$93.97$125",
  "$119.97$170",
  "$56.97$80",
  "$101.97$135"
];

console.log('🧪 Testing regex pattern:\n');

testStrings.forEach(str => {
  const matches = str.match(/\$\s*(\d+(?:\.\d{2})?)/g);
  console.log(`Input: "${str}"`);
  console.log(`Matches: ${JSON.stringify(matches)}`);
  console.log('');
});
