import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useState } from "react";
import type { ReactNode } from "react";
import "./choice.css";

export type Choice = { value: string; label: string; description?: string; detail?: string };

/**
 * A select with optional search. Radix Popover places it and handles Esc, outside clicks and focus (and works inside
 * a Radix dialog); cmdk does the filtering, ranking and arrow-key/Enter navigation.
 */
export function ChoicePicker({
  label,
  value,
  options,
  placeholder,
  disabled,
  searchable,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  options: Choice[];
  placeholder: string;
  disabled?: boolean;
  searchable?: boolean;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const choose = (next: string) => {
    setOpen(false);
    onChange(next);
  };
  return (
    <Popover.Root open={open} onOpenChange={(next) => setOpen(next && !disabled)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-disabled={disabled || undefined}
          className={`choice-trigger${open ? " is-open" : ""}`}
          onKeyDown={(event) => {
            if (!disabled && ["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {icon}
          <span className="choice-value">{selected?.label ?? placeholder}</span>
          <span className="choice-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="choice-panel"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // As wide as the field (never narrower than 220 px), and short enough to open below it inside a dialog.
          style={{ width: "min(max(var(--radix-popover-trigger-width), 220px), calc(100vw - 24px))", maxHeight: "min(320px, var(--radix-popover-content-available-height))" }}
        >
          <Command
            label={label}
            defaultValue={value}
            filter={(itemValue, search, keywords) => {
              const text = `${itemValue} ${(keywords ?? []).join(" ")}`.toLowerCase();
              return text.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            {searchable ? (
              <div className="choice-search">
                <span aria-hidden="true">⌕</span>
                <Command.Input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Find ${label.toLowerCase()}…`} />
              </div>
            ) : (
              // Without a search box cmdk still needs focus inside it for the arrow keys.
              <Command.Input className="sr-only" aria-label={label} />
            )}
            <Command.List className="choice-list" aria-label={label}>
              <Command.Empty className="choice-empty">No models match.</Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? ""]}
                  className="choice-option"
                  aria-label={option.label}
                  data-chosen={option.value === value || undefined}
                  onSelect={() => choose(option.value)}
                >
                  <span className="choice-option-copy">
                    <span className="choice-option-title">{option.label}</span>
                    {option.description ? <span className="choice-description">{option.description}</span> : null}
                  </span>
                  <span className="choice-check" aria-hidden="true">
                    {option.value === value ? "✓" : ""}
                  </span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
