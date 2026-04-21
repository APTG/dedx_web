export interface CsvOptions {
  includeHeader?: boolean;
  includeMetadata?: boolean;
  program?: string;
  particle?: string;
  material?: string;
}

export function generateCsv(
  energies: number[],
  stoppingPowers: number[],
  csdaRanges: number[],
  options?: CsvOptions
): string {
  const lines: string[] = [];

  if (options?.includeMetadata && options.program) {
    lines.push(`# Program: ${options.program}`);
    lines.push(`# Particle: ${options.particle || 'N/A'}`);
    lines.push(`# Material: ${options.material || 'N/A'}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('');
  }

  if (options?.includeHeader !== false) {
    lines.push('Energy (MeV/nucl),Stopping Power (MeV·cm²/g),CSDA Range (g/cm²)');
  }

  for (let i = 0; i < energies.length; i++) {
    const e = energies[i];
    const s = stoppingPowers[i];
    const r = csdaRanges[i];
    if (e !== undefined && s !== undefined && r !== undefined) {
      lines.push(`${e.toPrecision(4)},${s.toPrecision(4)},${r.toPrecision(4)}`);
    }
  }

  return lines.join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
