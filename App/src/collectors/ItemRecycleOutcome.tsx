import { ReactNode } from "react";
import { ItemRecycleRes } from "ws-packets/src/fromServer/report/ItemRecycleRes";
import { cityItemName } from "@/src/collectors/CityItemPresentation";
import {
	materialUnits, recoveredEffects
} from "@/src/collectors/CityRecycleDetails";
import { CelebrationModal } from "@/src/components/UnlockCelebration";
import {
	ActionBanner, Effects
} from "@/src/design/Sections";
import { Check } from "@/src/design/FightIcons";
import { i18n } from "@/src/translations/i18n";

/** The scraps of a dismantled item, popping in one material at a time like the gains of an expedition. */
export function ItemRecycleOutcome({
	outcome, onContinue
}: {
	outcome: ItemRecycleRes; onContinue: () => void;
}): ReactNode {
	return <CelebrationModal
		onClose={onContinue}
		icon="city.services.scrapDealer"
		eyebrow={i18n.t("app:city.scrap.recycled.eyebrow")}
		title={cityItemName(outcome)}
		description={i18n.t("app:city.scrap.recycled.description", { count: materialUnits(outcome.materials) })}
		testID="item-recycled"
	>
		<Effects items={recoveredEffects(outcome.materials, outcome.moneyGained)} />
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</CelebrationModal>;
}
