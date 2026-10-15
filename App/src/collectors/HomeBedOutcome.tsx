import { ReactNode } from "react";
import {
	HOME_BED_OUTCOMES, HomeBedRes
} from "ws-packets/src/fromServer/home/HomeBedRes";
import { AppIcons } from "@/src/AppIcons";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { formatNumber } from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;

/** A night in the player's own bed, told like a room at the inn: what it gave back, for free. */
export function HomeBedOutcome({
	outcome, onContinue
}: {
	outcome: HomeBedRes; onContinue: () => void;
}): ReactNode {
	const rested = outcome.outcome.type === HOME_BED_OUTCOMES.RESTED;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("city.homeUpgrades.bed")} size={EMBLEM_SIZE} />}
		title={i18n.t(rested ? "app:city.bed.rested" : "app:city.bed.alreadyFull")}
		subtitle={i18n.t(rested ? "app:city.bed.restedDetails" : "app:city.bed.alreadyFullDetails")}
		{...outcome.outcome.type === HOME_BED_OUTCOMES.RESTED
			? { value: {
				amount: i18n.t("app:inventoryActions.gain", { amount: formatNumber(outcome.outcome.health) }), unit: "health"
			} }
			: {}}
		onDismiss={onContinue}
	/>;
}
