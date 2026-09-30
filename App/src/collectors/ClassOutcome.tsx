import {ReactNode} from "react";
import {Modal} from "react-native";
import {ClassOutcome as Outcome} from "@/src/store/useClassOutcome";
import {Celebration} from "@/src/components/UnlockCelebration";
import {ActionBanner, Toast} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

/**
 * A new class is a moment of its own. The cooldown is shown on the button before the player presses
 * it, so a refusal only reaches here from stale data and is told in passing.
 */
export function ClassOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	if (outcome.kind === "cooldown") {
		return <Toast
			title={i18n.t("app:classes.outcomes.cooldown")}
			subtitle={i18n.t("app:classes.availableAt", {date: missionDate(outcome.timestamp)})}
			onDismiss={onContinue}
		/>;
	}
	return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onContinue}>
		<Celebration icon={`classes.${outcome.classId}`} eyebrow={i18n.t("app:classes.outcomes.success")} title={i18n.t(`models:classes.${outcome.classId}`)} testID="class-changed">
			<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
		</Celebration>
	</Modal>;
}