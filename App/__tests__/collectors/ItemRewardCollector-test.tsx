import {fireEvent, render, screen} from "@testing-library/react-native";
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
	it("shows the find with Discord's texts and replaces only after the in-place confirmation", async () => {
		const onChoose = jest.fn();
		await render(<ItemChoiceCollector collector={choiceCollector()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("commands:inventory.randomItemTitle")).toBeTruthy();
		expect(screen.getByText("commands:inventory.chooseItemToReplaceTitle")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("models:weapons.4"));
		expect(onChoose).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText("app:collector.item.replaceWith:models:weapons.9"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("sells the find when the player keeps the inventory as it is", async () => {
		const onChoose = jest.fn();
		await render(<ItemChoiceCollector collector={choiceCollector()} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByText("app:collector.item.sellFound"));
		expect(onChoose).toHaveBeenCalledWith(2);
	});
});

describe("ItemAcceptCollector", () => {
	it("asks Discord's question about the held potion and offers to drink the find", async () => {
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

		expect(screen.getByText("commands:inventory.randomItemAcceptTitlePotion")).toBeTruthy();
		expect(screen.getByText("app:collector.item.throwFound")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:collector.choices.drinkPotion"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});
