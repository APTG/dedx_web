import { test, expect } from 'vitest';

test('energy parser handles valid input', () => {
  const input = '1.0\n2.5\n10.0';
  const lines = input.split('\n').filter((line) => line.trim() !== '');
  const energies = lines.map((line) => parseFloat(line.trim())).filter((v) => !isNaN(v) && v > 0);

  expect(energies).toEqual([1.0, 2.5, 10.0]);
});

test('energy parser skips invalid lines', () => {
  const input = '1.0\ninvalid\n2.5\n-1.0\n10.0';
  const lines = input.split('\n').filter((line) => line.trim() !== '');
  const energies = lines.map((line) => parseFloat(line.trim())).filter((v) => !isNaN(v) && v > 0);

  expect(energies).toEqual([1.0, 2.5, 10.0]);
});

test('energy parser handles empty input', () => {
  const input = '';
  const lines = input.split('\n').filter((line) => line.trim() !== '');
  const energies = lines.map((line) => parseFloat(line.trim())).filter((v) => !isNaN(v) && v > 0);

  expect(energies).toEqual([]);
});
