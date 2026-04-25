/**
 * Centralised libdedx version metadata.
 *
 * The libdedx C library is vendored as a git submodule under `libdedx/` and
 * compiled to WebAssembly.  The user-facing version string is shown in several
 * places in the UI (electron unsupported message, combobox tooltips, result
 * table placeholder).  Update this constant on every libdedx upgrade so the
 * messages stay in sync automatically.
 */
export const LIBDEDX_VERSION = "1.4.0";

/** Pre-formatted "libdedx vX.Y.Z" string used in user-facing copy. */
export const LIBDEDX_VERSION_LABEL = `libdedx v${LIBDEDX_VERSION}`;

/** Standard message shown when the user picks the (unsupported) electron. */
export const ELECTRON_UNSUPPORTED_MESSAGE = `Electron (ESTAR) is not yet supported by ${LIBDEDX_VERSION_LABEL}.`;

/** Short form used as a tooltip / combobox description for the electron item. */
export const ELECTRON_UNSUPPORTED_SHORT = `Not available in ${LIBDEDX_VERSION_LABEL}`;

/** Tooltip on the electron combobox item (slightly different phrasing). */
export const ELECTRON_UNSUPPORTED_TITLE = `Electrons not supported in ${LIBDEDX_VERSION_LABEL}`;
