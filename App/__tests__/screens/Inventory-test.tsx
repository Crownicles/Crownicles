import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {GameClient} from "@/src/networking/GameClient";
import {EquipReq} from "ws-packets/src/fromClient/EquipReq";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {PlantId} from "ws-packets/src/objects/PlantId";

const mockTrack = jest.fn();
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {count?: number; max?: number; slot?: number; value?: number; details?: string}): string => {
	if (key === "app:profile.formats.progress") return `${options?.value} / ${options?.max}`;
	if (key === "app:equipment.slot") return `reserve ${options?.slot}`;
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
		await render(<Inventory inventoryData={inventory()} artifacts={{hasTalisman: true, hasCloneTalisman: false, hasRemoteHarvestTalisman: true}} />);
		expect(screen.getByText("models:weapons.7")).toBeTruthy();
		expect(screen.getAllByText("app:inventory.owned")).toHaveLength(2);
		expect(screen.getByText("app:inventory.absent")).toBeTruthy();
	});

	it("keeps the original reserve slot and excludes the equipped slot from capacity", async () => {
		await render(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.reserve"}));
		expect(screen.getByText("reserve 2")).toBeTruthy();
		expect(screen.getByText("1 / 2")).toBeTruthy();
		expect(screen.getAllByText("0 / 0")).toHaveLength(3);
	});
	it("formats large capped statistics only once", async () => {
		const data = inventory();
		data.weapon.attack = {baseValue: 1400, upgradeValue: 100, maxValue: 1250};
		await render(<Inventory inventoryData={data} />);
		expect(screen.getByText(/attack 1250/)).toBeTruthy();
		expect(screen.queryByText(/NaN/)).toBeNull();
	});

	it("switches between the material and plant payloads", async () => {
		await render(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.materials"}));
		expect(screen.getByText("models:materials.11")).toBeTruthy();
		expect(screen.getByText("42")).toBeTruthy();
		await fireEvent.press(screen.getByRole("tab", {name: "app:inventory.views.plants"}));
		expect(screen.getByText("app:inventory.seed")).toBeTruthy();
		expect(screen.getByText("1 / 3")).toBeTruthy();
	});

	it("opens equipment from its explicit action", async () => {
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "timeout"});
		await render(<Inventory inventoryData={inventory()} />);
		await fireEvent.press(screen.getByRole("button", {name: "app:inventory.actions.equip"}));
		await waitFor(() => expect(screen.getByText("app:common.connectionError")).toBeTruthy());
		expect(request.mock.calls[0][0]).toBeInstanceOf(EquipReq);
	});

	it("says the daily bonus is on cooldown instead of letting the player ask for it", async () => {
		await render(<Inventory inventoryData={inventory()} dailyBonusAvailableAt={Date.now() + 3_600_000} />);
		expect(screen.getByText("app:dailyBonus.locked")).toBeTruthy();
		expect(screen.queryByRole("button", {name: "app:inventory.actions.daily"})).toBeNull();
	});

	it("leaves the daily bonus open once its delay has run out", async () => {
		await render(<Inventory inventoryData={inventory()} dailyBonusAvailableAt={Date.now() - 1} />);
		expect(screen.queryByText("app:dailyBonus.locked")).toBeNull();
	});
});
