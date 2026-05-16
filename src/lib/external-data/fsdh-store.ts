/**
 * A zarrita-compatible readable store backed by the browser File System Access
 * API (FileSystemDirectoryHandle). Enables loading local .webdedx directories
 * without serving them over HTTP.
 *
 * Browser support: Chrome/Edge 86+, Safari 15.2+. Firefox does not support
 * FileSystemDirectoryHandle at the time of writing (2026). Feature-detect with
 * `typeof FileSystemDirectoryHandle !== "undefined"`.
 */

export type AbsolutePath = `/${string}`;

export interface GetOptions {
  signal?: AbortSignal;
}

export interface RangeQuery {
  offset: number;
  length: number;
}

export class FileSystemDirectoryHandleStore {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  private static isAbortError(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError";
  }

  private static isNotFoundError(err: unknown): boolean {
    return err instanceof DOMException && err.name === "NotFoundError";
  }

  private async resolveFile(
    key: AbsolutePath,
    opts?: GetOptions,
  ): Promise<File | undefined> {
    opts?.signal?.throwIfAborted();
    const parts = key.slice(1).split("/").filter(Boolean);
    if (parts.length === 0) return undefined;
    try {
      let dir: FileSystemDirectoryHandle = this.root;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]!);
        opts?.signal?.throwIfAborted();
      }
      const fileHandle = await dir.getFileHandle(parts[parts.length - 1]!);
      opts?.signal?.throwIfAborted();
      const file = await fileHandle.getFile();
      opts?.signal?.throwIfAborted();
      return file;
    } catch (err) {
      if (FileSystemDirectoryHandleStore.isAbortError(err)) {
        throw err;
      }
      if (FileSystemDirectoryHandleStore.isNotFoundError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  async get(key: AbsolutePath, opts?: GetOptions): Promise<Uint8Array | undefined> {
    const file = await this.resolveFile(key, opts);
    if (!file) return undefined;
    return new Uint8Array(await file.arrayBuffer());
  }

  async getRange(
    key: AbsolutePath,
    range: RangeQuery | { suffixLength: number },
    opts?: GetOptions,
  ): Promise<Uint8Array | undefined> {
    const file = await this.resolveFile(key, opts);
    if (!file) return undefined;
    const size = file.size;
    let start: number;
    let end = size;
    if ("suffixLength" in range) {
      start = Math.max(0, size - Math.max(0, range.suffixLength));
    } else {
      start = Math.max(0, range.offset);
      end = Math.min(size, start + Math.max(0, range.length));
    }
    const slice = file.slice(start, end);
    return new Uint8Array(await slice.arrayBuffer());
  }
}
