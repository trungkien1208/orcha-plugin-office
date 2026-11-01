export type QuestionChoice = { label: string; keys: string[] };

const NUMBERED = /^[ \t]*(?:[❯›>]\s*)?(\d+)\.\s+(.+?)\s*$/gm;

/** Buttons for a Question. Numbered options send that digit; `(y/n)` sends y or n. Enter and Esc are always there. */
export function questionChoices(text: string): QuestionChoice[] {
  const numbered = [...text.matchAll(NUMBERED)].map((match) => ({
    label: match[2] ?? match[1] ?? "",
    keys: [match[1] ?? ""],
  }));
  const choices = numbered.length
    ? numbered
    : /\(y\/n\)/i.test(text)
      ? [
          { label: "Yes", keys: ["y"] },
          { label: "No", keys: ["n"] },
        ]
      : [];
  return [...choices, { label: "Enter", keys: ["enter"] }, { label: "Esc", keys: ["esc"] }];
}

/** A Question as data (Orcha protocol 24 `agent.question`): answered by option key, several keys, or free text. */
export type StructuredQuestion = {
  text: string;
  options: Array<{ label: string; key?: string; description?: string }>;
  multiSelect: boolean;
  freeText: boolean;
};
