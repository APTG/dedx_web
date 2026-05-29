/**
 * Ambient declaration for `*.peggy` grammars compiled by the Vite Peggy loader
 * (see vite.config.ts). At type-check time the import resolves to this shape;
 * at build/test time the loader supplies the generated parser.
 */
declare module "*.peggy" {
  import type { QueryNode } from "./url-ast";

  export interface PeggyLocation {
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  }

  export interface PeggyExpectation {
    type: string;
    description?: string;
    text?: string;
  }

  export class SyntaxError extends Error {
    location: PeggyLocation;
    expected: PeggyExpectation[] | null;
    found: string | null;
    format(sources: { source: unknown; text: string }[]): string;
  }

  export function parse(input: string, options?: Record<string, unknown>): QueryNode;
}
