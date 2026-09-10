import {fireEvent, render, screen} from "@testing-library/react-native";
import {
	SmallEventChoiceResult, SmallEventChoiceResultRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {SmallEventChoiceOutcome} from "@/src/collectors/SmallEventChoiceOutcome";

jest.mock("@/src/translations/i18n", () => ({
	i18n: {t: (key: string): string => key}
}));

const RESULTS: SmallEventChoiceResult[] = [
	{event: "altar", outcome: "notContributed", amount: 100, current: 20, threshold: 500, canAfford: false},
	{event: "altar", outcome: "contributed", amount: 100, current: 120, threshold: 500, blessingTriggered: false, blessingType: 0, bonusGems: 0, bonusItemGiven: false, badgeAwarded: false},
	{event: "badPet", outcome: "resolved", loveLost: 2, actionId: "flee", petId: 4, sex: "m"},
	{event: "cart", outcome: "resolved", accepted: true, canAfford: true, isScam: false, destinationWasKnown: true, pointsWon: 20},
	{event: "fightPet", outcome: "success", actionId: "attack", isFemale: false},
	{event: "gardener", outcome: "resolved", interactionName: "seed", plantId: 1, materialId: 0, cost: 10, conditionKey: "paid"},
	{event: "pveIsland", outcome: "accepted", alone: true, pointsWon: 30},
	{event: "pveIsland", outcome: "notEnoughGems"},
	{event: "goblets", outcome: "resolved", malus: "time", goblet: "metal", value: 15, strategy: "classic"},
	{event: "interactPoor", outcome: "donated"},
	{event: "limoges", outcome: "success", questionId: "q1", shouldHaveAccepted: true, reward: {experience: 10, score: 20}},
	{event: "petFood", outcome: "found_by_pet", foodType: "meat", loveChange: 4, petSex: "f"},
	{event: "recipeShop", outcome: "accepted", source: "farmer", recipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"}, recipeCost: 300},
	{event: "shop", outcome: "purchased"},
	{event: "epicShop", outcome: "cannotBuy"}
];

describe("SmallEventChoiceOutcome", () => {
	it.each(RESULTS)("renders and closes the $event/$outcome result", async result => {
		const onContinue = jest.fn();
		await render(<SmallEventChoiceOutcome outcome={{result} as SmallEventChoiceResultRes} onContinue={onContinue} />);

		expect(screen.getByText(`app:adventure.choiceResults.titles.${result.event}`)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
