export const PROFILE_FONT_OPTIONS = [
  { id: "georgia", label: "Georgia" },
  { id: "arial", label: "Arial" },
  { id: "trebuchet", label: "Trebuchet MS" },
  { id: "courier", label: "Courier New" },
] as const;

export type ProfileFont = (typeof PROFILE_FONT_OPTIONS)[number]["id"];

export const DEFAULT_PROFILE_FONT: ProfileFont = "georgia";
export const DEFAULT_PROFILE_COLOR = "#ead8ff";

export function normalizeProfileFont(value: unknown): ProfileFont {
  const candidate = String(value ?? "").trim().toLowerCase();
  return PROFILE_FONT_OPTIONS.some((font) => font.id === candidate)
    ? (candidate as ProfileFont)
    : DEFAULT_PROFILE_FONT;
}

export function normalizeProfileColor(value: unknown): string {
  const candidate = String(value ?? "");
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : DEFAULT_PROFILE_COLOR;
}
