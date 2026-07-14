import data from '../src/data/countries.json' with { type: 'json' };

const assertions = [
  [data.countries.length >= 180, `Expected at least 180 countries; found ${data.countries.length}`],
  [data.countries.every((country) => country.code && Number.isFinite(country.foodWasteKg)), 'Every row needs a country code and food-waste value'],
  [data.countries.filter((country) => country.undernourishedPct !== null).length >= 120, 'Undernourishment coverage is unexpectedly low'],
  [data.countries.filter((country) => country.malnutritionDeathRate !== null).length >= 170, 'Mortality coverage is unexpectedly low'],
  [data.countries.some((country) => country.code === 'GBR'), 'United Kingdom record is missing'],
  [data.countries.some((country) => country.code === 'IND'), 'India record is missing']
];

for (const [condition, message] of assertions) {
  if (!condition) throw new Error(message);
}

console.log(`Validated ${data.countries.length} countries.`);
