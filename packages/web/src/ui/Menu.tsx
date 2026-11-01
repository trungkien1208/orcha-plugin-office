import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/**
 * A ⋯ menu. Radix gives arrow keys, typeahead, Esc, outside click and focus return; items close the menu when chosen.
 * The trigger keeps the `.menu-anchor.open` hook the rail uses to show and raise the row while a menu is open.
 */
export function Menu({ label, className, triggerClass = "row-more", children }: { label: string; className?: string; triggerClass?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <span className={`menu-anchor${className ? ` ${className}` : ""}${open ? " open" : ""}`}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className={triggerClass} aria-label={label} onClick={(event) => event.stopPropagation()}>
            <Icon name="more" />
          </button>
        </DropdownMenu.Trigger>
      </span>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="pop-menu" align="end" sideOffset={4} collisionPadding={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <DropdownMenu.Item className={danger ? "menu-item danger" : "menu-item"} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}

export const MenuSeparator = () => <DropdownMenu.Separator className="menu-sep" />;
