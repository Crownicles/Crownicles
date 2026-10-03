import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {Benefit} from "@/src/components/Benefits";
import {formatMoney} from "@/src/display/Amounts";
import {gameRules} from "@/src/rules/GameRules";
import {i18n} from "@/src/translations/i18n";

type RemoteHome = {level: number; hasCooking: boolean};

/** An apartment in the city of the player's home is let out; anywhere else it is a foothold. */
export function apartmentRentedHere(snapshot: CityMobileSnapshot | undefined): boolean {
	const owned = snapshot?.home?.owned;
	return Boolean(owned && !owned.isApartment);
}

function benefit(key: string, iconPath: string, values: Record<string, unknown> = {}): Benefit {
	return {
		key,
		iconPath,
		title: i18n.t(`app:city.apartmentBenefits.${key}.title`, values),
		description: i18n.t(`app:city.apartmentBenefits.${key}.description`, values)
	};
}

function rentedBenefits(price: number | undefined): Benefit[] {
	const {dailyRent, minRentToClaim} = gameRules().apartment;
	const rent = benefit("rent", "city.apartmentNotary.claimRent", {rent: formatMoney(dailyRent), min: formatMoney(minRentToClaim)});
	return price === undefined ? [rent] : [rent, benefit("payback", "city.apartmentNotary.buy", {days: Math.ceil(price / dailyRent)})];
}

function footholdBenefits(home: RemoteHome | undefined): Benefit[] {
	const {dailyRent, bedLevelCap} = gameRules().apartment;
	return [
		benefit("chest", "city.homeUpgrades.chest"),
		...home?.hasCooking ? [benefit("cooking", "city.homeUpgrades.cooking")] : [],
		benefit("bed", "city.homeUpgrades.bed", {level: Math.min(bedLevelCap, home?.level ?? bedLevelCap)}),
		benefit("laterRent", "city.apartmentNotary.claimRent", {rent: formatMoney(dailyRent)})
	];
}

/** What an apartment brings, told by the role it takes: a rent where the home stands, the home's services elsewhere. */
export function apartmentBenefits(rented: boolean, {price, home}: {price?: number; home?: RemoteHome}): Benefit[] {
	return rented ? rentedBenefits(price) : footholdBenefits(home);
}
