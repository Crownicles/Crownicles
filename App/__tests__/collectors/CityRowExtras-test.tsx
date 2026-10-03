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
		expect(screen.getAllByTestId("home-upgrade-change")).toHaveLength(2);
		expect(screen.getByText("Un coffre")).toBeTruthy();
		expect(screen.getByText("Un meilleur lit")).toBeTruthy();
	});

	it("stay out of the other notary rows", () => {
		expect(details(CITY_REACTION_KINDS.MOVE_HOME)).toBeNull();
	});
});
