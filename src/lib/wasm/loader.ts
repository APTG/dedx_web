import { base } from '$app/paths';
import type { LibdedxService } from './types';

let service: LibdedxService | null = null;

export async function getService(): Promise<LibdedxService> {
  if (service) return service;

  try {
    const factory = await import(`${base}/wasm/libdedx.mjs`);
    const module = await factory.default({
      locateFile: (f: string) => `${base}/wasm/${f}`
    });

    const { LibdedxServiceImpl } = await import('./libdedx');
    service = new LibdedxServiceImpl(module);
    await service.init();
    return service;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load WASM module: ${message}`);
  }
}
