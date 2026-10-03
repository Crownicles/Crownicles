import {useRef} from "react";

/**
 * iOS shows one window at a time: a choice made in a sheet is sent once the sheet is put away, so the
 * window the server answers with is not lost behind it.
 */
export function useAfterDismissal(): {defer: (action: () => void) => void; onDismissed: () => void} {
	const pending = useRef<(() => void) | null>(null);
	return {
		defer: (action): void => {
			pending.current = action;
		},
		onDismissed: (): void => {
			const action = pending.current;
			pending.current = null;
			action?.();
		}
	};
}
