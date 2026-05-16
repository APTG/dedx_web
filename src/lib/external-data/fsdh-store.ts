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

  async get(key: AbsolutePath, opts?: GetOptions): Promise<Uint8Array | undefined> {
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
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  async getRange(
    key: AbsolutePath,
    range: RangeQuery | { suffixLength: number },
    opts?: GetOptions,
  ): Promise<Uint8Array | undefined> {
    const full = await this.get(key, opts);
    if (!full) return undefined;
    if ("suffixLength" in range) {
      return full.slice(full.length - range.suffixLength);
    }
    return full.slice(range.offset, range.offset + range.length);
  }
}
