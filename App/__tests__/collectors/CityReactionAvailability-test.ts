import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {cityReactionAvailable} from "@/src/collectors/CityReactionAvailability";
import {cityReactionLock} from "@/src/collectors/CityReactionLocks";

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

describe("apartment rent", () => {
	const claim = {type: CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT, data: {apartmentId: 7}} as ReactionCollectorReaction;
	const owning = (isRented: boolean): CityMobileSnapshot => ({
		apartmentNotary: {ownedApartments: [{apartmentId: 7, mapLocationId: 23, accumulatedRent: 40, isRented, canClaim: false}], ownedCount: 1, accumulatedRent: 40}
	});

	it("tells a foothold earns nothing rather than asking to wait", () => {
		expect(cityReactionLock(claim, owning(false))?.reason).toMatch(/pied-à-terre tant que votre maison est ailleurs/);
	});

	it("tells a let apartment how much rent it still needs", () => {
		expect(cityReactionLock(claim, owning(true))?.reason).toMatch(/^40 .* il en faut 100 /);
	});
});
