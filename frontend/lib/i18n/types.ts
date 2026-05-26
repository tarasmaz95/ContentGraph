export type Locale = "en" | "uk";

export type TranslationTree = {
  [key: string]: string | TranslationTree;
};
