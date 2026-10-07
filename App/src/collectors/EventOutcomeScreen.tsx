import {ReactNode} from "react";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner, Effect, JournalEntry} from "@/src/design/Sections";
import {Story} from "@/src/design/Story";
import {BookOpen} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

/** The name game texts greet the player with, empty until the profile has loaded. */
export function usePlayerPseudo(): string {
	const profile = usePlayerProfile();
	return profile.status === "ready" ? profile.data.pseudo : "";
}

/** Whose journal an entry belongs to; before the first report the profile cannot name the player yet. */
function journalTitle(pseudo: string): string {
	return pseudo ? i18n.t("commands:report.journal", {pseudo}) : i18n.t("app:adventure.ownJournal");
}

/**
 * An entry of the player's journal, laid out the way Discord posts one: whose journal it is with the
 * event's emoji, what the event changed if anything, then the game's prose. Prompts and results
 * both use it, so an event keeps the same look from its question to its answer. A commerce passes
 * its own name as the title.
 */
export function EventJournal({emoji, title, story, effects = []}: {
	emoji?: string | undefined;
	title?: string;
	story: string;
	effects?: Effect[];
}): ReactNode {
	const pseudo = usePlayerPseudo();
	return <JournalEntry
		{...emoji ? {emblem: <TwemojiIcon emoji={emoji} size={Theme.dimensions.headerIcon} />} : {}}
		title={title ?? journalTitle(pseudo)}
		effects={effects}
	>
		<Story>{story}</Story>
	</JournalEntry>;
}

/** How every event of the journey ends: its journal entry, then a single way on. */
export function EventOutcomeScreen({emoji, title, story, effects, continueLabel, onContinue, pending = false}: {
	emoji?: string | undefined;
	title?: string;
	story: string;
	effects: Effect[];
	continueLabel: string;
	onContinue: () => void;
	pending?: boolean;
}): ReactNode {
	return <Screen>
		<EventJournal emoji={emoji} {...title ? {title} : {}} story={story} effects={effects} />
		<ActionBanner icon={BookOpen} label={continueLabel} onPress={onContinue} pending={pending} />
	</Screen>;
}
