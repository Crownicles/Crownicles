/** Typographic rather than linguistic: the same middle dot reads in every language the app ships. */
const FACT_SEPARATOR = " · ";

/** Short facts read on one line, in the order given; the missing ones are left out. */
export function joinFacts(facts: readonly (string | null | undefined | false)[]): string {
	return facts.filter((fact): fact is string => Boolean(fact)).join(FACT_SEPARATOR);
}
