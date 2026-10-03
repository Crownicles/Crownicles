import {render, screen} from "@testing-library/react-native";
import {ItemDetails} from "@/src/components/ItemDetails";
import {inventoryItemDetails} from "@/src/components/InventoryItemRow";
import {SmallEventShopCollector} from "@/src/collectors/SmallEventShopCollector";
import {ItemAcceptCollector} from "@/src/collectors/ItemRewardCollector";
import {ShopCollector} from "@/src/collectors/ShopCollector";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, SHOP_DATA_KINDS, SHOP_REACTION_KINDS, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})}));

const WEAPON: MainItem = {
	id: 1, rarity: 1, itemCategory: 0, itemLevel: 2,
	attack: {baseValue: 20, upgradeValue: 10, maxValue: 25},
	defense: {baseValue: 2, upgradeValue: 1, maxValue: 5},
	speed: {baseValue: 1, upgradeValue: 0, maxValue: 5}
};
const POTION: SupportItem = {id: 7, rarity: 1, itemCategory: 2, nature: ItemNature.HEALTH, power: 20, maxPower: 20};
const OBJECT_OFFER = {item: {...POTION, itemCategory: 3, nature: ItemNature.MONEY}, price: 120};
const DAILY_POTION_ITEM_ID = 0;

describe("item details before a decision", () => {
	it.each([
		{item: POTION, effect: "Vie + 20"},
		{item: {...POTION, itemCategory: 3}, effect: "Vie + 20 par jour"},
		{item: {...POTION, nature: ItemNature.ATTACK}, effect: "Attaque + 20 pendant le prochain combat"},
		{item: {...POTION, itemCategory: 3, nature: ItemNature.ATTACK}, effect: "Attaque + 20 pendant les combats"},
		{item: {...POTION, itemCategory: 3, nature: ItemNature.MONEY}, effect: "Argent + 20 par jour"}
	])("states the actual usage of the support item: $effect", async ({item, effect}): Promise<void> => {
		expect(inventoryItemDetails(item)).toContain(effect);
		await render(<ItemDetails item={item} />);
		expect(screen.queryByTestId("item-details")).toBeNull();
	});

	it("shows only the statistics the item gives, the capped value struck out as Discord does", async (): Promise<void> => {
		await render(<ItemDetails item={{...WEAPON, speed: {baseValue: 0, upgradeValue: 0, maxValue: 5}}} />);
		expect(screen.getByText("Attaque")).toBeTruthy();
		expect(screen.queryByText("Vitesse")).toBeNull();
		expect(screen.getByText("25")).toBeTruthy();
		expect(screen.getByText("30")).toHaveStyle({textDecorationLine: "line-through"});
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("says what each statistic wins or loses against the item it would replace", async (): Promise<void> => {
		const worn = {...WEAPON, attack: {baseValue: 20, upgradeValue: 0, maxValue: 25}, speed: {baseValue: 0, upgradeValue: 0, maxValue: 5}};
		await render(<ItemDetails item={{...WEAPON, defense: {baseValue: 0, upgradeValue: 0, maxValue: 5}}} reference={worn} />);
		expect(screen.getByText("+5")).toBeTruthy();
		expect(screen.getByText("Défense")).toBeTruthy();
		expect(screen.getByText("-3")).toBeTruthy();
		expect(screen.getByText("Vitesse")).toBeTruthy();
	});

	it("heads each column with the item whose values it holds, the compared item first", async (): Promise<void> => {
		const worn = {...WEAPON, id: 2, attack: {baseValue: 20, upgradeValue: 0, maxValue: 25}};
		await render(<ItemDetails item={WEAPON} reference={worn} />);
		const [wornColumn, foundColumn] = screen.getAllByLabelText(/.+/).filter(element => element.props.accessible);
		expect(wornColumn.props.accessibilityLabel).toBe(itemDisplayName(worn));
		expect(foundColumn.props.accessibilityLabel).toBe(itemDisplayName(WEAPON));
		expect(screen.getByText("20")).toBeTruthy();
		expect(screen.getByText("25")).toBeTruthy();
	});

	it("shows remaining uses alongside the potion's effect", (): void => {
		expect(inventoryItemDetails({...POTION, usages: 2, maxUsages: 3})).toMatch(/Vie \+ 20 · 2\/3 utilisations$/);
	});

	it("repeats nothing the caption already says", async (): Promise<void> => {
		await render(<ItemDetails item={{...WEAPON, attack: {baseValue: 20, upgradeValue: 0, maxValue: 25}}} />);
		expect(screen.queryByTestId("item-details")).toBeNull();
	});

	it.each([
		{id: SMALL_EVENT_DATA_KINDS.SHOP, data: {type: SMALL_EVENT_DATA_KINDS.SHOP, data: OBJECT_OFFER}},
		{id: SMALL_EVENT_DATA_KINDS.EPIC_SHOP, data: {type: SMALL_EVENT_DATA_KINDS.EPIC_SHOP, data: {...OBJECT_OFFER, tip: false}}}
	])("shows the offered object's effect before buying from $id", async ({id, data}): Promise<void> => {
		const choose = jest.fn();
		await render(<SmallEventShopCollector
			collector={{id, endTime: Date.now() + 60_000, data, reactions: [
				{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]}}
			onChoose={choose}
			submitting={false}
		/>);
		expect(screen.getByText(/Argent \+ 20 par jour/)).toBeTruthy();
		expect(choose).not.toHaveBeenCalled();
	});

	it("shows a found object's effect before choosing whether to keep it", async (): Promise<void> => {
		const choose = jest.fn();
		await render(<ItemAcceptCollector
			collector={{id: "found-object", endTime: Date.now() + 60_000, data: {type: ITEM_DATA_KINDS.ACCEPT, data: {
				foundItem: {...POTION, itemCategory: 3, nature: ItemNature.MONEY}, itemWithDetails: {...POTION, itemCategory: 3}
			}}, reactions: [{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]}}
			onChoose={choose}
			submitting={false}
		/>);
		expect(screen.getByText(/Argent \+ 20 par jour/)).toBeTruthy();
		expect(choose).not.toHaveBeenCalled();
	});

	it("shows the daily potion's effect while its shop row is still closed", async (): Promise<void> => {
		const choose = jest.fn();
		await render(<ShopCollector
			collector={{id: "daily-potion-shop", endTime: Date.now() + 60_000, data: {type: SHOP_DATA_KINDS.COLLECTOR, data: {
				currency: "money", availableCurrency: 200, additionalShopData: {dailyPotion: POTION}
			}}, reactions: [
				{type: SHOP_REACTION_KINDS.ITEM, data: {shopItemId: DAILY_POTION_ITEM_ID, shopCategoryId: "dailyPotion", amount: 1, price: 120}},
				{type: SHOP_REACTION_KINDS.CLOSE, data: {}}
			]}}
			onChoose={choose}
			submitting={false}
		/>);
		expect(screen.getByText(/Vie \+ 20/)).toBeTruthy();
		expect(choose).not.toHaveBeenCalled();
	});
});