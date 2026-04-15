#!/usr/bin/env bash
# Stage 2.6 Phase 2: Build libdedx WASM without --preload-file or --embed-file.
#
# The resulting libdedx.{mjs,wasm} pair relies entirely on the static C arrays
# compiled into dedx_embedded_data.c — no .data sidecar, no virtual filesystem.
#
# Usage:
#   ./build.sh          # build (incremental if output/ already exists)
#   ./build.sh --clean  # wipe output/ before building
#
# Output: output/libdedx.{mjs,wasm}
# Requires: Docker, emscripten/emsdk:5.0.5 image
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

if [[ "${1:-}" == "--clean" ]]; then
    echo "Cleaning $OUTPUT_DIR ..."
    rm -rf "$OUTPUT_DIR"
fi
mkdir -p "$OUTPUT_DIR"

# Write the inner Docker build script to a temp file.
# Using a mounted script avoids all shell-quoting issues when passing JSON
# arrays to emcc -s flags inside docker run.
INNER_SCRIPT=$(mktemp /tmp/libdedx-phase2-build-XXXXXX.sh)
# Single-quote the heredoc delimiter → no variable expansion inside
cat > "$INNER_SCRIPT" << 'INNEREOF'
#!/usr/bin/env bash
set -euo pipefail

echo "--- [1/3] cmake configure ---"
emcmake cmake /src/libdedx \
    -B /build \
    -DDEDX_BUILD_EXAMPLES=OFF \
    -DDEDX_BUILD_TESTS=OFF \
    -DCMAKE_BUILD_TYPE=Release

echo ""
echo "--- [2/3] cmake build ---"
emmake cmake --build /build --parallel

# Find the static library (cmake may name it differently under WASM toolchain)
LIBDEDX_A=$(find /build -name "libdedx.a" | head -1)
echo ""
echo "Static library: $LIBDEDX_A  ($(wc -c < "$LIBDEDX_A") bytes)"

echo ""
echo "--- [3/3] emcc link (no --preload-file, no --embed-file) ---"
# Emscripten 5.x requires JSON format for EXPORTED_FUNCTIONS array.
emcc "$LIBDEDX_A" \
    -o /src/output/libdedx.mjs \
    -s EXPORT_ES6=1 \
    -s MODULARIZE=1 \
    -s WASM=1 \
    -s ENVIRONMENT=node \
    -s 'EXPORTED_FUNCTIONS=["_dedx_get_program_list","_dedx_get_material_list","_dedx_get_ion_list","_dedx_get_program_name","_dedx_get_ion_name","_dedx_get_material_name","_dedx_get_version_string","_dedx_get_min_energy","_dedx_get_max_energy","_dedx_get_stp_table_size","_dedx_get_simple_stp_for_program","_malloc","_free"]' \
    -s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString","HEAP32","HEAPF32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -O2

echo ""
echo "--- output ---"
ls -lh /src/output/
chmod 644 /src/output/*
INNEREOF
chmod +x "$INNER_SCRIPT"

echo "=== Stage 2.6 Phase 2 — WASM build (no --preload-file) ==="
echo "Repo root : $REPO_ROOT"
echo "Output    : $OUTPUT_DIR"
echo "Image     : emscripten/emsdk:5.0.5"
echo ""

docker run --rm \
    -v "$REPO_ROOT/libdedx:/src/libdedx:ro" \
    -v "$OUTPUT_DIR:/src/output" \
    -v "$INNER_SCRIPT:/build-inner.sh:ro" \
    emscripten/emsdk:5.0.5 \
    bash /build-inner.sh

rm -f "$INNER_SCRIPT"

echo ""
echo "=== Build complete ==="
ls -lh "$OUTPUT_DIR"
