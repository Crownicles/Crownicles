import { ReactNode } from "react";
import {
	ITEM_UPGRADE_ARTISANS, ItemUpgradeRes
} from "ws-packets/src/fromServer/report/ItemUpgradeRes";
import {
	cityItemIconPath, cityItemName
} from "@/src/collectors/CityItemPresentation";
import { CelebrationModal } from "@/src/components/UnlockCelebration";
import { ActionBanner } from "@/src/design/Sections";
import { Check } from "@/src/design/FightIcons";
import {
	AMOUNT_UNITS, formatAmount, formatMoney
} from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

function upgradeDescription(outcome: ItemUpgradeRes): string {
	if (outcome.artisan === ITEM_UPGRADE_ARTISANS.HOME) {
		return i18n.t("app:city.upgraded.level", { level: outcome.itemLevel });
	}
	const cost = formatMoney(outcome.moneySpent);
	return outcome.gemsSpent
		? i18n.t("app:city.upgraded.levelForCostAndGems", {
			level: outcome.itemLevel, cost, gems: formatAmount(outcome.gemsSpent, AMOUNT_UNITS.GEM)
		})
		: i18n.t("app:city.upgraded.levelForCost", {
			level: outcome.itemLevel, cost
		});
}

/** A level gained is celebrated like a new home: the item rises over its halo, then the player moves on. */
export function ItemUpgradeOutcome({
	outcome, onContinue
}: {
	outcome: ItemUpgradeRes; onContinue: () => void;
}): ReactNode {
	return <CelebrationModal
		onClose={onContinue}
		icon={cityItemIconPath(outcome)}
		eyebrow={i18n.t(`app:city.upgraded.${outcome.artisan}`)}
		title={cityItemName(outcome)}
		description={upgradeDescription(outcome)}
		testID="item-upgraded"
	>
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</CelebrationModal>;
}
