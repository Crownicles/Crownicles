import {useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GameAnswer} from "@/src/networking/GameClient";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {reportEventStore} from "@/src/collectors/ReportEventStore";

/** The confirmation a button already answers by naming its cost: which collector, and which of its reactions. */
export type SilentAnswer = {collectorId: string; reactionIndex: number};

/** Tells the caller Core's outcome; the caller says when the button may rest again, after its own animation. */
export type ShortcutOutcomeHandler<Outcome> = (outcome: Outcome, done: () => void) => void;

type ReportShortcut<Outcome> = {
	request: () => Promise<GameAnswer<ReactionCollectorCreation>>;
	confirm: (answer: GameAnswer<ReactionCollectorCreation>) => SilentAnswer | null;
	outcome: () => Outcome | null;
};

/**
 * A report action whose confirmation is answered without being shown, then waited for through the
 * report event store, so the button stays busy from the press until Core has spoken.
 */
export function useReportShortcut<Outcome>(shortcut: ReportShortcut<Outcome>): {pending: boolean; run: (onOutcome: ShortcutOutcomeHandler<Outcome>) => void} {
	const {answerWithoutShowing} = useCollectors();
	const [pending, setPending] = useState(false);
	const done = (): void => setPending(false);

	const awaitOutcome = (onOutcome: ShortcutOutcomeHandler<Outcome>): void => {
		const unsubscribe = reportEventStore.subscribe(() => {
			const outcome = shortcut.outcome();
			if (!outcome) return;
			unsubscribe();
			onOutcome(outcome, done);
		});
	};

	const run = (onOutcome: ShortcutOutcomeHandler<Outcome>): void => {
		if (pending) return;
		setPending(true);
		shortcut.request()
			.then(answer => {
				const confirmation = shortcut.confirm(answer);
				if (!confirmation) {
					done();
					return;
				}
				awaitOutcome(onOutcome);
				answerWithoutShowing(confirmation.collectorId, confirmation.reactionIndex);
			})
			.catch(done);
	};

	return {pending, run};
}
