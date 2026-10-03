import {ReactNode} from "react";
import {HOME_PURCHASES, HomePurchaseRes} from "ws-packets/src/fromServer/home/HomePurchaseRes";
import {apartmentBenefits} from "@/src/collectors/ApartmentBenefits";
import {Benefit, Benefits} from "@/src/components/Benefits";
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

/** A first home opens the apartments too: the moment to tell they exist, while the player looks at what they own. */
function firstHomeBenefits(): Benefit[] {
	return ["bed", "chest", "apartments"].map(key => ({
		key,
		iconPath: key === "apartments" ? "city.apartmentNotary.buy" : `city.homeUpgrades.${key}`,
		title: i18n.t(`app:city.firstHome.${key}.title`),
		description: i18n.t(`app:city.firstHome.${key}.description`)
	}));
}

function purchaseBenefits(outcome: HomePurchaseRes): Benefit[] {
	if (outcome.purchase === HOME_PURCHASES.APARTMENT) return apartmentBenefits(Boolean(outcome.isRented), {price: outcome.cost});
	return outcome.purchase === HOME_PURCHASES.HOME ? firstHomeBenefits() : [];
}

/** A new roof is a moment of its own, celebrated like a new class; an apartment shows the role it takes. */
export function HomePurchaseOutcome({outcome, onContinue}: {outcome: HomePurchaseRes; onContinue: () => void}): ReactNode {
	const apartment = outcome.purchase === HOME_PURCHASES.APARTMENT;
	const benefits = purchaseBenefits(outcome);
	return <CelebrationModal
		onClose={onContinue}
		icon={purchaseIcon(outcome)}
		eyebrow={i18n.t(`app:city.purchases.${apartment && outcome.isRented ? "apartmentRented" : outcome.purchase}`)}
		title={purchaseTitle(outcome)}
		description={i18n.t("app:city.purchases.cost", {cost: formatMoney(outcome.cost)})}
		testID="home-purchased"
	>
		{benefits.length > 0 ? <Benefits items={benefits} /> : null}
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</CelebrationModal>;
}
