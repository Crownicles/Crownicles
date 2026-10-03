import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {cityReactionAvailable} from "@/src/collectors/CityReactionAvailability";

const upgrade = {type: CITY_REACTION_KINDS.UPGRADE_HOME, data: {}} as ReactionCollectorReaction;

function notary(manage: object): CityMobileSnapshot {
	return {home: {manage: {currentMoney: 12_849, upgradePrice: 19_800, ...manage}}} as CityMobileSnapshot;
}

describe("home purchases at the notary", () => {
	it("cannot be pressed when Core does not grant them, as it only sends the eligibility it grants", () => {
		expect(cityReactionAvailable(upgrade, notary({}))).toBe(false);
	});

	it("can be pressed once Core grants them", () => {
		expect(cityReactionAvailable(upgrade, notary({canUpgrade: true}))).toBe(true);
	});
});
