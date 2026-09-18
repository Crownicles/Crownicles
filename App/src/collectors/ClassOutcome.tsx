import {ReactNode} from "react";
import {ClassOutcome as Outcome} from "@/src/store/useClassOutcome";
import {Button, ButtonRow, Confirmation} from "@/src/design/Primitives";
import {missionDate} from "@/src/display/Missions";
import {className} from "@/src/display/Classes";
import {i18n} from "@/src/translations/i18n";

function outcomeMessage(outcome: Outcome): string {
	if (outcome.kind === "success") return className(outcome.classId);
	if (outcome.kind === "cooldown") return i18n.t("app:classes.availableAt", {date: missionDate(outcome.timestamp)});
	return i18n.t("app:classes.unchanged");
}

export function ClassOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t(`app:classes.outcomes.${outcome.kind}`)} message={outcomeMessage(outcome)} onRequestClose={onContinue}>
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}