export interface CsvOptions {
  includeHeader?: boolean;
  includeMetadata?: boolean;
  program?: string;
  particle?: string;
  material?: string;
  csdaUnitSuffix?: string;
}

function quoteCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatSignificant(value: number, significantFigures = 4): string {
  const precise = value.toPrecision(significantFigures);
  if (!/[eE]/.test(precise)) {
    return precise.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  const [mantissa = "0", exponentText = "0"] = precise.split(/[eE]/);
  const exponent = Number.parseInt(exponentText, 10);
  const isNegative = mantissa.startsWith("-");
  const sign = isNegative ? "-" : "";
  const absoluteMantissa = isNegative ? mantissa.slice(1) : mantissa;
  const decimalIndex = absoluteMantissa.indexOf(".");
  const digits = absoluteMantissa.replace(".", "");
  const pivot = decimalIndex + exponent;

  if (pivot <= 0) {
    return `${sign}0.${"0".repeat(-pivot)}${digits}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  if (pivot >= digits.length) {
    return `${sign}${digits}${"0".repeat(pivot - digits.length)}`;
  }

  return `${sign}${digits.slice(0, pivot)}.${digits.slice(pivot)}`
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

export function generateCsv(
  energies: number[],
  stoppingPowers: number[],
  csdaRanges: number[],
  options?: CsvOptions
): string {
  const lines: string[] = [];
  const csdaUnitSuffix = options?.csdaUnitSuffix ?? "g/cm²";

  if (options?.includeMetadata && options.program) {
    lines.push(quoteCsvCell(`# Program: ${options.program}`));
    lines.push(quoteCsvCell(`# Particle: ${options.particle || "N/A"}`));
    lines.push(quoteCsvCell(`# Material: ${options.material || "N/A"}`));
    lines.push(quoteCsvCell(`# Generated: ${new Date().toISOString()}`));
    lines.push("");
  }

  if (options?.includeHeader !== false) {
    lines.push(
      [
        quoteCsvCell("Energy (MeV/nucl)"),
        quoteCsvCell("Stopping Power (MeV·cm²/g)"),
        quoteCsvCell("CSDA Range")
      ].join(",")
    );
  }

  for (let i = 0; i < energies.length; i++) {
    const e = energies[i];
    const s = stoppingPowers[i];
    const r = csdaRanges[i];
    if (e !== undefined && s !== undefined && r !== undefined) {
      lines.push(
        [
          quoteCsvCell(formatSignificant(e)),
          quoteCsvCell(formatSignificant(s)),
          quoteCsvCell(`${formatSignificant(r)} ${csdaUnitSuffix}`)
        ].join(",")
      );
    }
  }

  return lines.join("\r\n");
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
