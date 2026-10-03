import {ReactNode} from "react";
import {HOME_PURCHASES, HomePurchaseRes} from "ws-packets/src/fromServer/home/HomePurchaseRes";
import {CelebrationModal} from "@/src/components/UnlockCelebration";
import {ActionBanner} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

function purchaseIcon(outcome: HomePurchaseRes): string {
	return outcome.purchase === HOME_PURCHASES.APARTMENT ? "city.apartmentNotary.menu" : `city.home.${outcome.homeLevel}`;
}

function purchaseTitle(outcome: HomePurchaseRes): string {
	return outcome.purchase === HOME_PURCHASES.APARTMENT
		? i18n.t(`models:map_locations.${outcome.mapLocationId}.name`)
		: i18n.t("app:city.purchases.homeLevel", {level: outcome.homeLevel});
}

/** A new roof is a moment of its own, celebrated like a new class. */
export function HomePurchaseOutcome({outcome, onContinue}: {outcome: HomePurchaseRes; onContinue: () => void}): ReactNode {
	return <CelebrationModal
		onClose={onContinue}
		icon={purchaseIcon(outcome)}
		eyebrow={i18n.t(`app:city.purchases.${outcome.purchase}`)}
		title={purchaseTitle(outcome)}
		description={i18n.t("app:city.purchases.cost", {cost: formatMoney(outcome.cost)})}
		testID="home-purchased"
	>
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</CelebrationModal>;
}
