import {useState} from "react";

export type ExpandedEntry<T> = {
	isExpanded: (key: T) => boolean;
	toggle: (key: T) => void;
	collapse: () => void;
};

/** At most one entry of an expandable list is unfolded: toggling the open one folds it back. */
export function useExpandedEntry<T>(): ExpandedEntry<T> {
	const [expanded, setExpanded] = useState<T | null>(null);
	return {
		isExpanded: (key: T): boolean => expanded === key,
		toggle: (key: T): void => setExpanded(previous => previous === key ? null : key),
		collapse: (): void => setExpanded(null)
	};
}
