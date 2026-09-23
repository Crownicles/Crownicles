import {fireEvent, render, screen} from "@testing-library/react-native";
import {
	SmallEventChoiceResult, SmallEventChoiceResultRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {SmallEventChoiceOutcome} from "@/src/collectors/SmallEventChoiceOutcome";

jest.mock("@/src/translations/i18n", () => ({
	i18n: {t: (key: string): string => key, tArray: (): string[] => []}
}));

jest.mock("@/src/store/usePlayerProfile", () => ({
	usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})
}));

/** Every result, with the Discord translation its story must be told with. */
const RESULTS: [SmallEventChoiceResult, string][] = [
	[{event: "altar", outcome: "notContributed", amount: 100, current: 20, threshold: 500, canAfford: false}, "smallEvents:altar.notEnoughMoney"],
	[{event: "altar", outcome: "contributed", amount: 100, current: 120, threshold: 500, blessingTriggered: false, blessingType: 0, bonusGems: 0, bonusItemGiven: false, badgeAwarded: false}, "smallEvents:altar.contributed"],
	[{event: "badPet", outcome: "resolved", loveLost: 2, actionId: "flee", petId: 4, sex: "m"}, "smallEvents:badPet.outcomes.flee.fail"],
	[{event: "cart", outcome: "resolved", accepted: true, canAfford: true, isScam: false, isDisplayed: false, pointsWon: 20}, "smallEvents:cart.unknownDestinationTravelDone"],
	[{event: "fightPet", outcome: "success", actionId: "attack", isFemale: false}, "smallEvents:fightPet.fightPetActions.attack.success"],
	[{event: "gardener", outcome: "resolved", interactionName: "seed", conditionKey: "paidAccepted", plantId: 1, materialId: 0, cost: 10}, "smallEvents:gardener.rewards.seed.paidAccepted"],
	[{event: "pveIsland", outcome: "accepted", alone: true, pointsWon: 30}, "smallEvents:goToPVEIsland.endStoryAccept"],
	[{event: "pveIsland", outcome: "notEnoughGems"}, "smallEvents:goToPVEIsland.notEnoughGems"],
	[{event: "goblets", outcome: "resolved", malus: "time", goblet: "metal", value: 15}, "smallEvents:gobletsGame.results.time"],
	[{event: "interactPoor", outcome: "donated"}, "smallEvents:interactOtherPlayers.poor_give_money"],
	[{event: "limoges", outcome: "success", shouldHaveAccepted: true, reward: {experience: 10, score: 20}}, "smallEvents:limoges.recap.success.accept"],
	[{event: "petFood", outcome: "found_by_pet", foodType: "soup", petSex: "f", loveChange: 4}, "smallEvents:petFood.outcomes.found_by_pet_soup"],
	[{event: "recipeShop", outcome: "accepted", source: "farmer", recipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"}, recipeCost: 300}, "commands:report.city.homes.cooking.recipeDiscovered"],
	[{event: "shop", outcome: "purchased"}, "smallEvents:shop.purchased"],
	[{event: "epicShop", outcome: "cannotBuy"}, "smallEvents:epicItemShop.notEnoughMoney"]
];

describe("SmallEventChoiceOutcome", () => {
	it.each(RESULTS)("result %# is told with the Discord text", async (result, storyKey) => {
		const onContinue = jest.fn();
		await render(<SmallEventChoiceOutcome outcome={{result} as SmallEventChoiceResultRes} onContinue={onContinue} />);

		expect(screen.getByText(new RegExp(storyKey.replace(/\./g, "\\.")))).toBeTruthy();
		expect(screen.getByText("commands:report.journal")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("adds the score to the cart story only once the trip was paid", async () => {
		await render(<SmallEventChoiceOutcome outcome={{result: {
			event: "cart", outcome: "resolved", accepted: true, canAfford: true, isScam: false, isDisplayed: true, pointsWon: 20
		}} as SmallEventChoiceResultRes} onContinue={jest.fn()} />);

		expect(screen.getByText("smallEvents:cart.normalTravelDonesmallEvents:cart.confirmedScore")).toBeTruthy();
	});

	it("shows every reward granted when an altar blessing is triggered", async () => {
		await render(<SmallEventChoiceOutcome outcome={{result: {
			event: "altar",
			outcome: "contributed",
			amount: 100,
			current: 500,
			threshold: 500,
			blessingTriggered: true,
			blessingType: 4,
			bonusGems: 2,
			bonusItemGiven: true,
			badgeAwarded: true
		}} as SmallEventChoiceResultRes} onContinue={jest.fn()} />);

		expect(screen.getByText("app:adventure.choiceResults.fields.blessing")).toBeTruthy();
		expect(screen.getByText("app:adventure.choiceResults.fields.bonusItem")).toBeTruthy();
		expect(screen.getByText("app:adventure.choiceResults.fields.badge")).toBeTruthy();
	});
});
