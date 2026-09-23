import {ReactNode} from "react";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner, Effect, JournalEntry} from "@/src/design/Sections";
import {Story} from "@/src/design/Story";
import {BookOpen} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

/**
 * An entry of the player's journal, laid out the way Discord posts one: whose journal it is with the
 * event's emoji, what the event changed if anything, then the game's prose. Prompts and results
 * both use it, so an event keeps the same look from its question to its answer.
 */
export function EventJournal({emoji, story, effects = []}: {
	emoji?: string | undefined;
	story: string;
	effects?: Effect[];
}): ReactNode {
	const profile = usePlayerProfile();
	const pseudo = profile.status === "ready" ? profile.data.pseudo : "";
	return <JournalEntry
		{...emoji ? {emblem: <TwemojiIcon emoji={emoji} size={Theme.dimensions.headerIcon} />} : {}}
		title={i18n.t("commands:report.journal", {pseudo}).trim()}
		effects={effects}
	>
		<Story>{story}</Story>
	</JournalEntry>;
}

/** How every event of the journey ends: its journal entry, then a single way on. */
export function EventOutcomeScreen({emoji, story, effects, continueLabel, onContinue}: {
	emoji?: string | undefined;
	story: string;
	effects: Effect[];
	continueLabel: string;
	onContinue: () => void;
}): ReactNode {
	return <Screen>
		<EventJournal emoji={emoji} story={story} effects={effects} />
		<ActionBanner icon={BookOpen} label={continueLabel} onPress={onContinue} />
	</Screen>;
}
