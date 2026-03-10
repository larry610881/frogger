import { join } from 'node:path';
import { execa } from 'execa';
import type { BenchmarkTask } from '../types.js';

const UTILS_JS = `// utils.js — messy utility functions with code duplication

function formatUserName(first, last) {
  if (!first || typeof first !== 'string') return '';
  if (!last || typeof last !== 'string') return '';
  const f = first.trim().charAt(0).toUpperCase() + first.trim().slice(1).toLowerCase();
  const l = last.trim().charAt(0).toUpperCase() + last.trim().slice(1).toLowerCase();
  return f + ' ' + l;
}

function formatCityName(city) {
  if (!city || typeof city !== 'string') return '';
  const c = city.trim().charAt(0).toUpperCase() + city.trim().slice(1).toLowerCase();
  return c;
}

function formatCountryName(country) {
  if (!country || typeof country !== 'string') return '';
  const c = country.trim().charAt(0).toUpperCase() + country.trim().slice(1).toLowerCase();
  return c;
}

function filterActiveUsers(users) {
  const result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].active === true) {
      result.push(users[i]);
    }
  }
  return result;
}

function filterActiveProducts(products) {
  const result = [];
  for (let i = 0; i < products.length; i++) {
    if (products[i].active === true) {
      result.push(products[i]);
    }
  }
  return result;
}

function sumUserAges(users) {
  let total = 0;
  for (let i = 0; i < users.length; i++) {
    total = total + users[i].age;
  }
  return total;
}

function sumProductPrices(products) {
  let total = 0;
  for (let i = 0; i < products.length; i++) {
    total = total + products[i].price;
  }
  return total;
}

module.exports = {
  formatUserName,
  formatCityName,
  formatCountryName,
  filterActiveUsers,
  filterActiveProducts,
  sumUserAges,
  sumProductPrices,
};
`;

const UTILS_TEST_JS = `// utils.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  formatUserName,
  formatCityName,
  formatCountryName,
  filterActiveUsers,
  filterActiveProducts,
  sumUserAges,
  sumProductPrices,
} = require('./utils.js');

describe('formatUserName', () => {
  it('should capitalize first and last name', () => {
    assert.strictEqual(formatUserName('john', 'doe'), 'John Doe');
    assert.strictEqual(formatUserName('JANE', 'SMITH'), 'Jane Smith');
  });

  it('should handle invalid input', () => {
    assert.strictEqual(formatUserName('', 'doe'), '');
    assert.strictEqual(formatUserName(null, 'doe'), '');
  });
});

describe('formatCityName', () => {
  it('should capitalize city name', () => {
    assert.strictEqual(formatCityName('taipei'), 'Taipei');
    assert.strictEqual(formatCityName('NEW YORK'), 'New york');
  });

  it('should handle invalid input', () => {
    assert.strictEqual(formatCityName(''), '');
    assert.strictEqual(formatCityName(null), '');
  });
});

describe('formatCountryName', () => {
  it('should capitalize country name', () => {
    assert.strictEqual(formatCountryName('taiwan'), 'Taiwan');
  });

  it('should handle invalid input', () => {
    assert.strictEqual(formatCountryName(''), '');
  });
});

describe('filterActiveUsers', () => {
  it('should return only active users', () => {
    const users = [
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
      { name: 'Carol', active: true },
    ];
    const result = filterActiveUsers(users);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'Alice');
    assert.strictEqual(result[1].name, 'Carol');
  });
});

describe('filterActiveProducts', () => {
  it('should return only active products', () => {
    const products = [
      { name: 'Widget', active: true },
      { name: 'Gadget', active: false },
    ];
    const result = filterActiveProducts(products);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Widget');
  });
});

describe('sumUserAges', () => {
  it('should sum all user ages', () => {
    const users = [{ age: 25 }, { age: 30 }, { age: 45 }];
    assert.strictEqual(sumUserAges(users), 100);
  });
});

describe('sumProductPrices', () => {
  it('should sum all product prices', () => {
    const products = [{ price: 10 }, { price: 20 }, { price: 30 }];
    assert.strictEqual(sumProductPrices(products), 60);
  });
});
`;

export const refactorTask: BenchmarkTask = {
  name: 'refactor',
  difficulty: 'hard',
  description:
    'Refactor a utility module to remove code duplication while keeping all tests passing',
  prompt:
    'Refactor utils.js to remove code duplication and improve readability. Do not change the function signatures or behavior. All tests must still pass.',
  seedFiles: {
    'utils.js': UTILS_JS,
    'utils.test.js': UTILS_TEST_JS,
  },
  validate: async (dir: string) => {
    try {
      await execa('node', ['--test', join(dir, 'utils.test.js')]);
      return { pass: true, message: 'All utils tests pass after refactor' };
    } catch (err) {
      const msg = err instanceof Error ? (err as any).stderr || err.message : String(err);
      return { pass: false, message: `Tests failed: ${String(msg).slice(0, 500)}` };
    }
  },
};
