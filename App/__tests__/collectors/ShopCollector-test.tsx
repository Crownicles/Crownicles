import {fireEvent, render, screen} from "@testing-library/react-native";
import {Platform} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {BuyCategorySlotCollector, ShopCollector, SkipMissionCollector} from "@/src/collectors/ShopCollector";
import {ShopResultScreen} from "@/src/collectors/ShopResultScreen";
import {missionDescription} from "@/src/display/Missions";
import {plainStory} from "@/src/display/Markdown";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): string => "📦", getIcon: (): string => "📦"}}));

/** Positions in Lib's ShopItemType enum. */
const SHOP_ITEMS = {DAILY_POTION: 0, RANDOM_ITEM: 1, WOOD_COMMON_BUNDLE: 25} as const;
const RANDOM_ITEM_PRICE = 2_500;

type ShelfItem = {shopItemId: number; shopCategoryId: string; amount: number; price: number};

function shop(availableCurrency: number, items: ShelfItem[], additionalShopData = {}): ReactionCollectorCreation {
	return {
		id: "shop",
		endTime: Date.now() + 60_000,
		data: {type: SHOP_DATA_KINDS.COLLECTOR, data: {currency: "money", availableCurrency, shopId: "generalShop", additionalShopData}},
		reactions: [
			...items.map(data => ({type: SHOP_REACTION_KINDS.ITEM, data})),
			{type: SHOP_REACTION_KINDS.CLOSE, data: {}}
		]
	};
}

const RANDOM_ITEM: ShelfItem = {shopItemId: SHOP_ITEMS.RANDOM_ITEM, shopCategoryId: "permanentItem", amount: 1, price: RANDOM_ITEM_PRICE};
const DAILY_POTION: ShelfItem = {shopItemId: SHOP_ITEMS.DAILY_POTION, shopCategoryId: "dailyPotion", amount: 1, price: 517};

async function renderShop(collector: ReactionCollectorCreation): Promise<jest.Mock> {
	const onChoose = jest.fn();
	await render(<ShopCollector collector={collector} onChoose={onChoose} submitting={false} />);
	return onChoose;
}

describe("city shop", () => {
	afterEach(() => jest.restoreAllMocks());

	it("opens on the commerce and the purse, every price on its row and no button to aim for", async () => {
		await renderShop(shop(16_156, [RANDOM_ITEM, DAILY_POTION], {remainingPotions: 4}));
		expect(screen.getByText("Boutique générale")).toBeTruthy();
		expect(screen.getByText("Votre argent")).toBeTruthy();
		expect(screen.getByText(/^16\s156$/)).toBeTruthy();
		expect(screen.getByText("Un équipement aléatoire")).toBeTruthy();
		expect(screen.getByText(/^2\s500$/)).toBeTruthy();
		expect(screen.getByText("4 en stock")).toBeTruthy();
		expect(screen.queryByText("Acheter")).toBeNull();
	});

	it("opens an article on what it does, and buys it once its sheet is put away", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChoose = await renderShop(shop(16_156, [RANDOM_ITEM]));
		await fireEvent.press(screen.getByText("Un équipement aléatoire"));
		expect(screen.getByText(/Vous recevrez un équipement aléatoire/)).toBeTruthy();
		expect(screen.getByText("Après l'achat")).toBeTruthy();
		expect(screen.getByText(/^13\s656$/)).toBeTruthy();
		expect(onChoose).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText(/^Acheter pour 2\s500/));
		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("holds the purchase while the sheet is still leaving, so the server's answer is not lost behind it", async () => {
		const onChoose = await renderShop(shop(16_156, [RANDOM_ITEM]));
		await fireEvent.press(screen.getByText("Un équipement aléatoire"));
		await fireEvent.press(screen.getByText(/^Acheter pour/));
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("says on the row that the daily potions are sold out, and does not sell one", async () => {
		const onChoose = await renderShop(shop(16_156, [DAILY_POTION], {remainingPotions: 0}));
		expect(screen.getByText("Épuisé")).toBeTruthy();
		expect(screen.getByText("Épuisé pour aujourd'hui, revenez demain.")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("Potion du jour"));
		expect(screen.getByRole("button", {name: /^Acheter pour/, disabled: true})).toBeTruthy();
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("says on the row how much is missing for an article out of reach, and does not buy it", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChoose = await renderShop(shop(100, [RANDOM_ITEM]));
		expect(screen.getByText(/^Il vous manque 2\s400/)).toBeTruthy();

		await fireEvent.press(screen.getByText("Un équipement aléatoire"));
		expect(screen.queryByText("Après l'achat")).toBeNull();
		// The heading the sheet repeats already says why: the button only greys out.
		expect(screen.getByRole("button", {name: /^Acheter pour/, disabled: true})).toBeTruthy();
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("sells a bundle at the quantity picked in its sheet", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChoose = await renderShop(shop(16_156, [
			{shopItemId: SHOP_ITEMS.WOOD_COMMON_BUNDLE, shopCategoryId: "woodBundles", amount: 10, price: 100},
			{shopItemId: SHOP_ITEMS.WOOD_COMMON_BUNDLE, shopCategoryId: "woodBundles", amount: 50, price: 500}
		]));
		expect(screen.getByText("Par lots : ×10 · ×50")).toBeTruthy();
		expect(screen.getByText("l'unité")).toBeTruthy();

		await fireEvent.press(screen.getByText("Bois de chauffage"));
		await fireEvent.press(screen.getByText("×50"));
		expect(screen.getByText("Prix du lot")).toBeTruthy();
		await fireEvent.press(screen.getByText(/^Acheter pour 500/));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});

const MISSION: Mission = {missionId: "fightAttacks", missionObjective: 5, missionVariant: 0, numberDone: 2, missionType: MISSION_TYPES.NORMAL};

describe("what a commerce asks once an item is paid for", () => {
	afterEach(() => jest.restoreAllMocks());

	it("confirms the mission to change in its own row before changing it", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChoose = jest.fn();
		await render(<SkipMissionCollector
			collector={{id: "skip", endTime: Date.now() + 60_000, data: {type: SHOP_DATA_KINDS.SKIP_MISSION, data: {}}, reactions: [
				{type: SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY, data: {missionIndex: 0, mission: MISSION}},
				{type: SHOP_REACTION_KINDS.CLOSE, data: {}}
			]}}
			onChoose={onChoose}
			submitting={false}
		/>);
		expect(screen.getByText("Quelle mission changer ?")).toBeTruthy();
		expect(screen.getByText("2 / 5")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText(plainStory(missionDescription(MISSION, Date.now()))));
		expect(screen.getByText(/Sa progression sera perdue/)).toBeTruthy();
		expect(onChoose).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText("Changer cette mission"));
		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("confirms the inventory category before adding the slot to it", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChoose = jest.fn();
		await render(<BuyCategorySlotCollector
			collector={{id: "slot", endTime: Date.now() + 60_000, data: {type: SHOP_DATA_KINDS.BUY_SLOT, data: {}}, reactions: [
				{type: SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY, data: {categoryId: 0, maxSlots: 4, remaining: 2}},
				{type: SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY, data: {categoryId: 2, maxSlots: 4, remaining: 1}},
				{type: SHOP_REACTION_KINDS.CLOSE, data: {}}
			]}}
			onChoose={onChoose}
			submitting={false}
		/>);
		expect(screen.getByText("Encore 2 emplacements disponibles sur 4")).toBeTruthy();

		await fireEvent.press(screen.getByText("Potion"));
		expect(onChoose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("Ajouter l'emplacement ici"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("tells a refusal at the counter, then lets the player go on", async () => {
		const onContinue = jest.fn();
		await render(<ShopResultScreen result={{kind: "outcome", outcome: {kind: "tooManyDailyPotions"}}} onContinue={onContinue} />);
		expect(screen.getByText("Transaction refusée")).toBeTruthy();
		expect(screen.getByText(/plus aucune potion du jour/)).toBeTruthy();
		await fireEvent.press(screen.getByText("Continuer"));
		expect(onContinue).toHaveBeenCalled();
	});
});
