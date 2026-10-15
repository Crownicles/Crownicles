import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import {
	CITY_BLACKSMITH_LIMITS, CityMobileBeyondReachItem
} from "ws-packets/src/fromServer/collectors";
import {
	ITEM_UPGRADE_ARTISANS, ItemUpgradeRes
} from "ws-packets/src/fromServer/report/ItemUpgradeRes";
import { ItemUpgradeOutcome } from "@/src/collectors/ItemUpgradeOutcome";
import { BeyondReachStory } from "@/src/collectors/CityItemStories";

function outcome(overrides: Partial<ItemUpgradeRes>): ItemUpgradeRes {
	return {
		artisan: ITEM_UPGRADE_ARTISANS.BLACKSMITH, itemId: 10, itemCategory: 0, itemLevel: 3, moneySpent: 5_775, ...overrides
	} as ItemUpgradeRes;
}

describe("item upgrade celebration", () => {
	it("celebrates the item, the level reached and what it cost", async () => {
		const onContinue = jest.fn();
		await render(<ItemUpgradeOutcome outcome={outcome({})} onContinue={onContinue} />);

		expect(screen.getByText("Le forgeron a fait son œuvre")).toBeTruthy();
		expect(screen.getByText(/^Niveau 3 atteint pour 5\s775/u)).toBeTruthy();
		fireEvent.press(screen.getByText("Continuer"));
		expect(onContinue).toHaveBeenCalled();
	});

	it("names the gems the royal blacksmith asked for, and no price at home", async () => {
		const { rerender } = await render(<ItemUpgradeOutcome outcome={outcome({
			artisan: ITEM_UPGRADE_ARTISANS.ROYAL_BLACKSMITH, itemLevel: 5, moneySpent: 8_000, gemsSpent: 3
		})} onContinue={jest.fn()} />);
		expect(screen.getByText(/^Niveau 5 atteint pour 8\s000 .* et 3 /u)).toBeTruthy();

		await rerender(<ItemUpgradeOutcome outcome={outcome({
			artisan: ITEM_UPGRADE_ARTISANS.HOME, moneySpent: 0
		})} onContinue={jest.fn()} />);
		expect(screen.getByText("Niveau 3 atteint")).toBeTruthy();
	});
});

describe("item beyond the blacksmith", () => {
	const item = (limit: CityMobileBeyondReachItem["limit"], itemLevel: number): CityMobileBeyondReachItem => ({
		slot: 0, itemId: 10, itemCategory: 1, itemLevel, limit
	});

	it("sends the player to the royal blacksmith for the next level", async () => {
		await render(<BeyondReachStory item={item(CITY_BLACKSMITH_LIMITS.ROYAL_ONLY, 4)} />);

		expect(screen.getByText("Au-delà du savoir du forgeron")).toBeTruthy();
		expect(screen.getByText(/forgeron royal, au château, sait le porter au niveau 5/u)).toBeTruthy();
	});

	it("tells an item at its peak that no one can go further", async () => {
		await render(<BeyondReachStory item={item(CITY_BLACKSMITH_LIMITS.MAXED, 5)} />);

		expect(screen.getByText("Un équipement à son apogée")).toBeTruthy();
	});
});
