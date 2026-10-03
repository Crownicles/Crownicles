import {render, screen} from "@testing-library/react-native";
import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {cityRowDetails} from "@/src/collectors/CityRowExtras";

const notary = {home: {manage: {currentMoney: 99_999, upgradePrice: 19_800, upgradeChanges: ["chest", "betterBed"]}}} as CityMobileSnapshot;

function details(type: string): ReturnType<typeof cityRowDetails> {
	return cityRowDetails({type, data: {}} as ReactionCollectorReaction, notary);
}

describe("home upgrade details", () => {
	it("list every advantage of the upgrade before confirming", async () => {
		await render(<>{details(CITY_REACTION_KINDS.UPGRADE_HOME)}</>);
		expect(screen.getAllByTestId("benefit")).toHaveLength(2);
		expect(screen.getByText("Un coffre")).toBeTruthy();
		expect(screen.getByText("Un meilleur lit")).toBeTruthy();
	});

	it("stay out of the other notary rows", () => {
		expect(details(CITY_REACTION_KINDS.MOVE_HOME)).toBeNull();
	});
});

describe("apartment details", () => {
	const buy = {type: CITY_REACTION_KINDS.APARTMENT_BUY, data: {}} as ReactionCollectorReaction;
	const forSale = {price: 12_000, canAfford: true};

	it("shows a rent and when it pays back, where the home stands", async () => {
		const homeCity = {home: {owned: {level: 3}}, apartmentNotary: {forSale, ownedApartments: [], ownedCount: 0, accumulatedRent: 0}} as unknown as CityMobileSnapshot;
		await render(<>{cityRowDetails(buy, homeCity)}</>);
		expect(screen.getByText(/Une rente de/)).toBeTruthy();
		expect(screen.getByText("Remboursé en 57 jours")).toBeTruthy();
		expect(screen.queryByText("Le coffre de votre maison")).toBeNull();
	});

	it("shows the home's services elsewhere, with the bed capped and the kitchen only when the home has one", async () => {
		const otherCity = {home: {elsewhere: {mapLocationId: 23, level: 1, hasCooking: false}}, apartmentNotary: {forSale, ownedApartments: [], ownedCount: 0, accumulatedRent: 0}} as CityMobileSnapshot;
		await render(<>{cityRowDetails(buy, otherCity)}</>);
		expect(screen.getByText("Le coffre de votre maison")).toBeTruthy();
		expect(screen.queryByText("Votre fourneau")).toBeNull();
		expect(screen.getByText("Aussi reposant que celui d'une maison de niveau 1 au plus")).toBeTruthy();
		expect(screen.getByText("Une rente si vous emménagez ici")).toBeTruthy();
	});
});
