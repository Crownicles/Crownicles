import {fireEvent, render, screen, within} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, ITEM_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {ItemAcceptCollector, ItemChoiceCollector} from "@/src/collectors/ItemRewardCollector";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIconOrNull: (): null => null,
		getIcon: (): string => ""
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string, options?: {item?: string}): string => options?.item ? `${key}:${options.item}` : key,
		tArray: (): string[] => []
	}
}));

jest.mock("@/src/store/usePlayerProfile", () => ({
	usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})
}));

const stat = {baseValue: 1, upgradeValue: 0, maxValue: 5};

function weapon(id: number): {id: number; rarity: number; itemCategory: number; itemLevel: number; attack: typeof stat; defense: typeof stat; speed: typeof stat} {
	return {id, rarity: 1, itemCategory: 0, itemLevel: 0, attack: stat, defense: stat, speed: stat};
}

function choiceCollector(): ReactionCollectorCreation {
	return {
		id: "item-choice",
		endTime: Date.now() + 60_000,
		data: {type: ITEM_DATA_KINDS.CHOICE, data: {foundItem: weapon(9)}},
		reactions: [
			{type: ITEM_REACTION_KINDS.CHOICE_ITEM, data: {slot: 0, itemWithDetails: weapon(3)}},
			{type: ITEM_REACTION_KINDS.CHOICE_ITEM, data: {slot: 1, itemWithDetails: weapon(4)}},
			{type: ITEM_REACTION_KINDS.CHOICE_REFUSE, data: {}}
		]
	};
}

describe("ItemChoiceCollector", () => {
	it("shows the find and keeps it only after the in-place confirmation, saying which item is sold", async () => {
		const onChoose = jest.fn();
		await render(<ItemChoiceCollector collector={choiceCollector()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("commands:inventory.randomItemTitle")).toBeTruthy();
		expect(screen.getByText("app:collector.item.chooseToSell:models:weapons.9")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("models:weapons.4"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByTestId("item-details")).toBeTruthy();
		expect(screen.getByText("app:collector.item.sold:models:weapons.4")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:collector.item.keep:models:weapons.9"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("sells the find when the player keeps the inventory as it is", async () => {
		const onChoose = jest.fn();
		await render(<ItemChoiceCollector collector={choiceCollector()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:collector.item.sold:models:weapons.9")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.item.keepAll"));
		expect(onChoose).toHaveBeenCalledWith(2);
	});
});

describe("ItemAcceptCollector", () => {
	it("names both choices by the item kept, and what each one sells", async () => {
		const onChoose = jest.fn();
		await render(<ItemAcceptCollector
			collector={{
				id: "item-accept",
				endTime: Date.now() + 60_000,
				data: {type: ITEM_DATA_KINDS.ACCEPT, data: {itemWithDetails: weapon(3), foundItem: weapon(9)}},
				reactions: [{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]
			}}
			onChoose={onChoose}
			submitting={false}
		/>);

		expect(screen.getByText("app:collector.item.sold:models:weapons.3")).toBeTruthy();
		expect(screen.getByText("app:collector.item.sold:models:weapons.9")).toBeTruthy();
		// Each consequence sits inside the choice it belongs to, so it cannot be read as the next one's.
		within(screen.getByRole("button", {name: "app:collector.item.keep:models:weapons.9"})).getByText("app:collector.item.sold:models:weapons.3");
		within(screen.getByRole("button", {name: "app:collector.item.keep:models:weapons.3"})).getByText("app:collector.item.sold:models:weapons.9");
		await fireEvent.press(screen.getByText("app:collector.item.keep:models:weapons.3"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("throws a potion rather than selling it, and offers to drink the find", async () => {
		const onChoose = jest.fn();
		const potion = {id: 5, rarity: 1, itemCategory: 2, nature: 1, power: 10, maxPower: 10, maxUsages: 1};
		await render(<ItemAcceptCollector
			collector={{
				id: "item-accept",
				endTime: Date.now() + 60_000,
				data: {type: ITEM_DATA_KINDS.ACCEPT, data: {itemWithDetails: {...potion, id: 6}, foundItem: potion}},
				reactions: [
					{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
					{type: ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION, data: {}},
					{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
				]
			}}
			onChoose={onChoose}
			submitting={false}
		/>);

		expect(screen.getByText("app:collector.item.thrown:models:potions.5")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:collector.choices.drinkPotion"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});
