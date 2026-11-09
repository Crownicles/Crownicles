import { ReactNode } from "react";
import { DefenseOutcome as Outcome } from "@/src/store/useDefenseOutcome";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import {
	defenseStyleIcon, defenseStyleName
} from "@/src/display/DefenseStyles";
import { i18n } from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;

/** The new defense style, said in passing: the player just picked it and stays where they were. */
export function DefenseOutcome({
	outcome, onContinue
}: {
	outcome: Outcome; onContinue: () => void;
}): ReactNode {
	const icon = defenseStyleIcon(outcome.personality);
	return <Toast
		{...icon ? { emblem: <TwemojiIcon emoji={icon} size={EMBLEM_SIZE} /> } : {}}
		title={i18n.t("app:defense.changed")}
		subtitle={outcome.personality
			? i18n.t("app:defense.changedTo", { name: defenseStyleName(outcome.personality) })
			: i18n.t("app:defense.changedToRandom")}
		onDismiss={onContinue}
	/>;
}
