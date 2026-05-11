import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import CsvExportModal from "$lib/components/CsvExportModal.svelte";

describe("CsvExportModal", () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  async function cleanupDialogTimers() {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  beforeEach(async () => {
    await cleanupDialogTimers();
    // Clear localStorage between tests
    localStorage.clear();
    // Reset mocks between tests
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
  });

  afterEach(async () => {
    await cleanupDialogTimers();
  });

  describe("modal visibility", () => {
    it("modal renders when open=true", () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      expect(getByTestId("csv-export-modal")).toBeInTheDocument();
    });

    it("modal does not render when open=false", () => {
      const { queryByTestId } = render(CsvExportModal, {
        props: {
          open: false,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      expect(queryByTestId("csv-export-modal")).not.toBeInTheDocument();
    });
  });

  describe("separator radio group", () => {
    it("comma radio is checked by default", () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      expect(getByTestId("csv-separator-comma")).toBeChecked();
      expect(getByTestId("csv-separator-semicolon")).not.toBeChecked();
      expect(getByTestId("csv-separator-tab")).not.toBeChecked();
    });

    it("semicolon radio can be selected", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const semicolonRadio = getByTestId("csv-separator-semicolon");
      await fireEvent.click(semicolonRadio);
      expect(semicolonRadio).toBeChecked();
      expect(getByTestId("csv-separator-comma")).not.toBeChecked();
    });

    it("tab radio can be selected", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const tabRadio = getByTestId("csv-separator-tab");
      await fireEvent.click(tabRadio);
      expect(tabRadio).toBeChecked();
      expect(getByTestId("csv-separator-comma")).not.toBeChecked();
    });
  });

  describe("line endings radio group", () => {
    it("crlf radio is checked by default", () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      expect(getByTestId("csv-line-endings-crlf")).toBeChecked();
      expect(getByTestId("csv-line-endings-lf")).not.toBeChecked();
    });

    it("lf radio can be selected", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const lfRadio = getByTestId("csv-line-endings-lf");
      await fireEvent.click(lfRadio);
      expect(lfRadio).toBeChecked();
      expect(getByTestId("csv-line-endings-crlf")).not.toBeChecked();
    });
  });

  describe("filename input", () => {
    it("filename input is pre-filled with defaultFilename", () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "my_data.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      expect((getByTestId("csv-filename-input") as HTMLInputElement).value).toBe("my_data.csv");
    });

    it("filename input can be edited", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const input = getByTestId("csv-filename-input") as HTMLInputElement;
      await fireEvent.change(input, { target: { value: "custom_name.csv" } });
      expect(input.value).toBe("custom_name.csv");
    });
  });

  describe("confirm button", () => {
    it("calls onConfirm with correct options and filename when clicked", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const confirmBtn = getByTestId("csv-export-confirm");
      await fireEvent.click(confirmBtn);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      const [options, filename] = mockOnConfirm.mock.calls[0] ?? [];
      expect(options).toEqual({ separator: "comma", lineEndings: "crlf" });
      expect(filename).toBe("test.csv");
    });

    it("appends .csv extension if user omits it", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const confirmBtn = getByTestId("csv-export-confirm");
      await fireEvent.click(confirmBtn);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      const [, filename] = mockOnConfirm.mock.calls[0] ?? [];
      expect(filename).toBe("test.csv");
    });
  });

  describe("cancel button", () => {
    it("calls onCancel when clicked", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const cancelBtn = getByTestId("csv-export-cancel");
      await fireEvent.click(cancelBtn);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("close icon", () => {
    it("calls onCancel when close icon is clicked", async () => {
      const { getByLabelText } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const closeBtn = getByLabelText("Close modal");
      await fireEvent.click(closeBtn);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("localStorage persistence", () => {
    it("reads saved preferences from localStorage on mount", () => {
      localStorage.setItem("csvExportSeparator", "semicolon");
      localStorage.setItem("csvExportLineEndings", "lf");

      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });

      expect(getByTestId("csv-separator-semicolon")).toBeChecked();
      expect(getByTestId("csv-line-endings-lf")).toBeChecked();
    });

    it("ignores invalid localStorage values and falls back to defaults", () => {
      localStorage.setItem("csvExportSeparator", "invalid_separator");
      localStorage.setItem("csvExportLineEndings", "invalid_ending");

      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });

      expect(getByTestId("csv-separator-comma")).toBeChecked();
      expect(getByTestId("csv-line-endings-crlf")).toBeChecked();
    });

    it("writes preferences to localStorage on confirm", async () => {
      const { getByTestId } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });

      // Change to non-default values
      await fireEvent.click(getByTestId("csv-separator-tab"));
      await fireEvent.click(getByTestId("csv-line-endings-lf"));

      const confirmBtn = getByTestId("csv-export-confirm");
      await fireEvent.click(confirmBtn);

      expect(localStorage.getItem("csvExportSeparator")).toBe("tab");
      expect(localStorage.getItem("csvExportLineEndings")).toBe("lf");
    });
  });

  describe("accessibility", () => {
    it("has role dialog and aria-modal", () => {
      const { getByRole } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const dialog = getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby pointing to the heading", () => {
      const { getByRole, getByText } = render(CsvExportModal, {
        props: {
          open: true,
          defaultFilename: "test.csv",
          onConfirm: mockOnConfirm,
          onCancel: mockOnCancel,
        },
      });
      const dialog = getByRole("dialog");
      const heading = getByText("Export CSV");
      expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    });
  });
});
