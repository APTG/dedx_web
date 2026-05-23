import { describe, it, expect, vi } from "vitest";
import { FileSystemDirectoryHandleStore } from "$lib/external-data/fsdh-store";

function makeFile(bytes: number[]): File {
  return new File([Uint8Array.from(bytes)], "chunk.bin");
}

describe("FileSystemDirectoryHandleStore", () => {
  it("uses File.slice for range reads", async () => {
    const file = makeFile([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const sliceSpy = vi.spyOn(file, "slice");
    const arrayBufferSpy = vi.spyOn(file, "arrayBuffer");
    const fileHandle = { getFile: vi.fn().mockResolvedValue(file) };
    const root = {
      getFileHandle: vi.fn().mockResolvedValue(fileHandle),
    } as unknown as FileSystemDirectoryHandle;
    const store = new FileSystemDirectoryHandleStore(root);

    const range = await store.getRange("/data.bin", { offset: 2, length: 4 });
    expect(Array.from(range ?? [])).toEqual([2, 3, 4, 5]);
    expect(sliceSpy).toHaveBeenCalledWith(2, 6);
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it("rethrows abort errors instead of treating them as missing files", async () => {
    const root = {
      getDirectoryHandle: vi
        .fn()
        .mockRejectedValue(new DOMException("Aborted", "AbortError")),
    } as unknown as FileSystemDirectoryHandle;
    const store = new FileSystemDirectoryHandleStore(root);

    await expect(store.get("/nested/file.bin")).rejects.toThrow(/Aborted/);
  });

  it("returns undefined for not-found paths", async () => {
    const root = {
      getFileHandle: vi.fn().mockRejectedValue(new DOMException("Missing", "NotFoundError")),
    } as unknown as FileSystemDirectoryHandle;
    const store = new FileSystemDirectoryHandleStore(root);

    await expect(store.get("/missing.bin")).resolves.toBeUndefined();
  });
});
