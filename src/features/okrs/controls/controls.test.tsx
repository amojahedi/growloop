// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeMaterial } from "@/lib/testing/fixtures";
import { CountStepper } from "./fields";
import { MaterialCombobox } from "./material-combobox";

afterEach(cleanup);

function Stepper({ initial = 3, onChange = () => {} }: { initial?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <CountStepper
      id="count"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("CountStepper", () => {
  it("lets the field be cleared while typing and settles on blur", () => {
    render(<Stepper />);
    const field = screen.getByRole("spinbutton", { name: "Number of items" });
    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveValue(null);
    fireEvent.change(field, { target: { value: "7" } });
    expect(field).toHaveValue(7);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(field).toHaveValue(7);
    fireEvent.change(field, { target: { value: "40" } });
    fireEvent.blur(field);
    expect(field).toHaveValue(10);
  });

  it("keeps its buttons focusable at the limits, where they do nothing", () => {
    const onChange = vi.fn();
    render(<Stepper initial={1} onChange={onChange} />);
    const fewer = screen.getByRole("button", { name: "Fewer items" });
    fewer.focus();
    expect(fewer).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(fewer);
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(fewer);
    fireEvent.click(screen.getByRole("button", { name: "More items" }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(fewer).not.toHaveAttribute("aria-disabled");
  });
});

describe("MaterialCombobox", () => {
  const materials = [makeMaterial({ id: "a", title: "Inspired" }), makeMaterial({ id: "b", title: "Empowered" })];

  it("filters as you type, picks with the keyboard and says when nothing matches", () => {
    const onChange = vi.fn();
    render(<MaterialCombobox id="m" label="Material" materials={materials} value={undefined} onChange={onChange} placeholder="Pick a material" />);
    const input = screen.getByRole("combobox", { name: "Material" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(2);

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No matches");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.change(input, { target: { value: "emp" } });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("-b"));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
