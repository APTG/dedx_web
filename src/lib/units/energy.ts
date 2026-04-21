export function parseEnergyInput(text: string, _unit?: string): number[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const energies: number[] = [];

  for (const line of lines) {
    const value = parseFloat(line.trim());
    if (!isNaN(value) && value > 0) {
      energies.push(value);
    }
  }

  return energies;
}

export function convertEnergy(value: number, fromUnit: string, toUnit: string, massNumber: number): number {
  if (fromUnit === toUnit) return value;

  const toMeVPerNucl = {
    'MeV': (v: number) => v,
    'MeV/nucl': (v: number) => v,
    'MeV/u': (v: number) => v * massNumber
  };

  const fromMeVPerNucl = {
    'MeV': (v: number) => v,
    'MeV/nucl': (v: number) => v,
    'MeV/u': (v: number) => v / massNumber
  };

  const mevPerNucl = toMeVPerNucl[fromUnit as keyof typeof toMeVPerNucl](value);
  return fromMeVPerNucl[toUnit as keyof typeof fromMeVPerNucl](mevPerNucl);
}
