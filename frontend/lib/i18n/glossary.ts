import type { Locale } from "./types";
import { translate } from "./translate";

export function getGlossaryTerm(locale: Locale, term: string): string {
  return translate(locale, `glossary.${term}`);
}
