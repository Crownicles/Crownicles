import {render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, ReactionCollectorData, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {SmallEventShopCollector} from "@/src/collectors/SmallEventShopCollector";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): string => "📦", getIcon: (path: string): string => `[${path}]`}}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})}));

/** Positions in Lib's ItemCategory enum. */
const ARMOR_CATEGORY = 1;
const OBJECT_CATEGORY = 3;

/** An armor as Core sends it: the merchant's item is never upgraded, and the player's level caps each stat. */
function zuluShield(maxValue: number): ItemWithDetails {
	return {
		id: 31,
		rarity: ItemRarity.UNCOMMON,
		itemCategory: ARMOR_CATEGORY,
		itemLevel: 0,
		attack: {baseValue: 0, upgradeValue: 0, maxValue},
		defense: {baseValue: 27, upgradeValue: 0, maxValue},
		speed: {baseValue: -5, upgradeValue: 0, maxValue}
	};
}

const SPEED_CHARM: ItemWithDetails = {
	id: 12,
	rarity: ItemRarity.RARE,
	itemCategory: OBJECT_CATEGORY,
	nature: ItemNature.SPEED,
	power: 30,
	maxPower: 30
};

function merchant(data: ReactionCollectorData): ReactionCollectorCreation {
	return {
		id: "merchant",
		endTime: Date.now() + 60_000,
		data,
		reactions: [
			{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
			{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
		]
	};
}

async function renderOffer(data: ReactionCollectorData): Promise<void> {
	await render(<SmallEventShopCollector collector={merchant(data)} onChoose={jest.fn()} submitting={false} />);
}

describe("travelling merchant offer", () => {
	it("captions the offered equipment like any item, its stats included, before it is bought", async () => {
		await renderOffer({type: SMALL_EVENT_DATA_KINDS.SHOP, data: {item: zuluShield(40), price: 28}});
		expect(screen.getByText(/^Peu commun · \[unitValues\.defense] 27 \[unitValues\.speed] -5$/)).toBeTruthy();
		expect(screen.queryByText(/\[unitValues\.attack]/)).toBeNull();
		expect(screen.queryByText("Niveau")).toBeNull();
		expect(screen.getByText("Prix")).toBeTruthy();
	});

	it("tells the full value of a stat the player's level still holds back", async () => {
		await renderOffer({type: SMALL_EVENT_DATA_KINDS.SHOP, data: {item: zuluShield(20), price: 28}});
		expect(screen.getByText(/^Peu commun · \[unitValues\.defense] 20 \[unitValues\.speed] -5$/)).toBeTruthy();
		expect(screen.getByTestId("item-details")).toBeTruthy();
		expect(screen.getByText("27")).toBeTruthy();
	});

	it("captions the effect of an object sold by the epic merchant before it is bought", async () => {
		await renderOffer({type: SMALL_EVENT_DATA_KINDS.EPIC_SHOP, data: {item: SPEED_CHARM, price: 500, tip: false}});
		expect(screen.getByText(/^Rare · .*30/)).toBeTruthy();
	});
});
