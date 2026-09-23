import {fireEvent, screen, waitFor} from "@testing-library/react-native";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {GameClient} from "@/src/networking/GameClient";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {SellReq} from "ws-packets/src/fromClient/SellReq";
import {EquipActionRes} from "ws-packets/src/fromServer/equip/EquipActionRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, SELL_DATA_KINDS, SELL_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS} from "ws-packets/src/objects/EquipCategoryData";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {PlantId} from "ws-packets/src/objects/PlantId";
import {renderWithGameQuery} from "@/src/testing/testUtils";

const mockTrack = jest.fn();
const mockAnswer = jest.fn();
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack, answerWithoutShowing: mockAnswer})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {count?: number; max?: number; slot?: number; value?: number; details?: string}): string => {
	if (key === "app:profile.formats.progress") return `${options?.value} / ${options?.max}`;
	if (key === "items:attack") return `attack ${Number(options?.value)}`;
	if (key === "app:inventory.itemSummary") return options?.details ?? key;
	return key;
}}}));

function inventory(): InventoryData {
	const weapon = {id: 7, rarity: 1, itemCategory: 0, itemLevel: 2, attack: {baseValue: 5, upgradeValue: 1, maxValue: 10}, defense: {baseValue: 0, upgradeValue: 0, maxValue: 0}, speed: {baseValue: 0, upgradeValue: 0, maxValue: 0}};
	return {
		weapon,
		armor: {...weapon, id: 9, itemCategory: 1},
		potion: {id: 43, itemCategory: 2, rarity: 1, nature: ItemNature.ATTACK, power: 20, maxPower: 20},
		object: {id: 2, itemCategory: 3, rarity: 3, nature: ItemNature.MONEY, power: 60, maxPower: 60},
		backupWeapons: [{display: weapon, slot: 2}], backupArmors: [], backupPotions: [], backupObjects: [],
		slots: {weapons: 3, armors: 1, potions: 1, objects: 1},
		materials: [{materialId: 11, quantity: 42}],
		plants: {seed: PlantId.COMMON_HERB, plantSlots: [{plantId: PlantId.COMMON_HERB, slot: 2}], maxPlantSlots: 3}
	};
}

describe("inventory views", () => {
	afterEach(() => jest.restoreAllMocks());
	it("shows the server artifact ownership alongside equipped items", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} artifacts={{hasTalisman: true, hasCloneTalisman: false, hasRemoteHarvestTalisman: true}} />);
		expect(screen.getByText("models:weapons.7")).toBeTruthy();
		expect(screen.getAllByText("app:inventory.owned")).toHaveLength(2);
		expect(screen.getByText("app:inventory.absent")).toBeTruthy();
		expect(screen.getByText("20")).toBeTruthy();
		expect(screen.getByText("60")).toBeTruthy();
	});

	it("heads each reserve row with the value the item is worn for and excludes the equipped slot from capacity", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.reserve"}));
		expect(screen.getByText("6")).toBeTruthy();
		expect(screen.queryByText("app:equipment.slot")).toBeNull();
		expect(screen.getByText("1 / 2")).toBeTruthy();
		expect(screen.getAllByText("0 / 0")).toHaveLength(3);
	});
	it("formats large capped statistics only once", async () => {
		const data = inventory();
		data.weapon.attack = {baseValue: 1400, upgradeValue: 100, maxValue: 1250};
		await renderWithGameQuery(<Inventory inventoryData={data} />);
		expect(screen.getByText((1250).toLocaleString())).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "models:weapons.7"}));
		expect(screen.getAllByText((1250).toLocaleString())).toHaveLength(2);
		expect(screen.queryByText(/NaN/)).toBeNull();
	});

	it("switches between the material and plant payloads", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.materials"}));
		expect(screen.getByText("models:materials.11")).toBeTruthy();
		expect(screen.getByText("42")).toBeTruthy();
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.plants"}));
		expect(screen.getByText("app:inventory.seed")).toBeTruthy();
		expect(screen.getByText("1 / 3")).toBeTruthy();
	});

	it("equips a reserve item from its own row", async () => {
		const packet = Object.assign(new EquipActionRes(), {success: true, categories: []});
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet});
		await renderWithGameQuery(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.reserve"}));
		await fireEvent.press(screen.getByRole("button", {name: "models:weapons.7"}));
		await fireEvent.press(screen.getByRole("button", {name: "app:inventory.actions.equip"}));

		await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
		const sent = request.mock.calls[0][0];
		expect(sent).toBeInstanceOf(EquipActionReq);
		expect(sent).toMatchObject({action: EQUIP_ACTIONS.EQUIP, itemCategory: 0, slot: 2});
	});

	it("sells the tapped item only after a second tap, answering the server menu with it", async () => {
		const packet = Object.assign(new ReactionCollectorCreation(), {
			id: "sell",
			endTime: Date.now() + 60_000,
			data: {type: SELL_DATA_KINDS.COLLECTOR, data: {}},
			reactions: [
				{type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 9, category: 1}, slot: 1, price: 30}},
				{type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 7, category: 0}, slot: 2, price: 50}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		});
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet});
		await renderWithGameQuery(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.reserve"}));
		await fireEvent.press(screen.getByRole("button", {name: "models:weapons.7"}));
		await fireEvent.press(screen.getByRole("button", {name: "app:inventory.actions.sell"}));
		expect(screen.getByText("app:sale.confirmSell")).toBeTruthy();
		expect(request).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("button", {name: "app:inventory.actions.confirm"}));
		await waitFor(() => expect(mockAnswer).toHaveBeenCalledWith("sell", 1));
		expect(request.mock.calls[0][0]).toBeInstanceOf(SellReq);
		expect(mockTrack).not.toHaveBeenCalled();
	});

	it("offers no drink for a fight potion, only to put it away", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("button", {name: "models:potions.43"}));
		expect(screen.queryByRole("button", {name: "app:inventory.actions.drink"})).toBeNull();
		expect(screen.getByRole("button", {name: "app:inventory.actions.deposit"})).toBeTruthy();
	});

	it("says on the worn object that the daily bonus is on cooldown, folded or not", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} dailyBonusAvailableAt={Date.now() + 3_600_000} />);
		expect(screen.getByText("app:dailyBonus.locked")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "models:objects.2"}));
		expect(screen.getByText("app:dailyBonus.locked")).toBeTruthy();
		expect(screen.getByRole("button", {name: "app:inventory.actions.daily"})).toBeDisabled();
	});

	it("leaves the daily bonus open once its delay has run out", async () => {
		await renderWithGameQuery(<Inventory inventoryData={inventory()} dailyBonusAvailableAt={Date.now() - 1} />);
		await fireEvent.press(screen.getByRole("button", {name: "models:objects.2"}));
		expect(screen.queryByText("app:dailyBonus.locked")).toBeNull();
		expect(screen.getByRole("button", {name: "app:inventory.actions.daily"})).toBeEnabled();
	});
});
