import pl from "../locales/pl.json";
import en from "../locales/en.json";

export const translations = {
  pl,
  en,
};

export type Lang = "pl" | "en";

export const availableLanguages: Lang[] = ["pl", "en"];

export const t = (lang: Lang, key: string) => {
  const dict = translations[lang] as Record<string, string>;
  return dict[key] || key;
};
