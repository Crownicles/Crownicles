import {ReactNode} from "react";
import {ClassOutcome as Outcome} from "@/src/store/useClassOutcome";
import {Sheet} from "@/src/design/Sections";
import {missionDate} from "@/src/display/Missions";
import {className} from "@/src/display/Classes";
import {i18n} from "@/src/translations/i18n";

function outcomeMessage(outcome: Outcome): string {
	if (outcome.kind === "success") return className(outcome.classId);
	return i18n.t("app:classes.availableAt", {date: missionDate(outcome.timestamp)});
}

export function ClassOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:classes.change")}
		title={i18n.t(`app:classes.outcomes.${outcome.kind}`)}
		subtitle={outcomeMessage(outcome)}
		closeLabel={i18n.t("app:common.back")}
		onClose={onContinue}
	>{null}</Sheet>;
}