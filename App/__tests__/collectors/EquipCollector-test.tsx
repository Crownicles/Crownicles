import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClientProvider} from "@tanstack/react-query";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EquipActionRes} from "ws-packets/src/fromServer/equip/EquipActionRes";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EquipCategoryData, EQUIP_ERRORS} from "ws-packets/src/objects/EquipCategoryData";
import {EquipCollector} from "@/src/collectors/EquipCollector";
import {GameClient} from "@/src/networking/GameClient";
import {createGameQueryClient} from "@/src/store/GameQueryProvider";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const CATEGORY: EquipCategoryData = {
	category: 0,
	equippedItem: null,
	reserveItems: [{slot: 3, details: {id: 7, itemCategory: 0, rarity: 1, itemLevel: 2, attack: {baseValue: 8, upgradeValue: 0, maxValue: 30}, defense: {baseValue: 0, upgradeValue: 0, maxValue: 0}, speed: {baseValue: 0, upgradeValue: 0, maxValue: 0}}}],
	maxReserveSlots: 4,
	canDeposit: true
};

function collector(): ReactionCollectorCreation & {data: {type: typeof EQUIP_DATA_KINDS.COLLECTOR; data: {categories: EquipCategoryData[]}}} {
	return {id: "equipment-menu", endTime: Date.now() + 60_000, data: {type: EQUIP_DATA_KINDS.COLLECTOR, data: {categories: [CATEGORY]}}, reactions: [{type: EQUIP_REACTION_KINDS.CLOSE, data: {}}]};
}

async function openMenu(): Promise<void> {
	await render(<QueryClientProvider client={createGameQueryClient()}><EquipCollector collector={collector()} onChoose={jest.fn()} submitting={false} /></QueryClientProvider>);
}

describe("equipment menu", () => {
	afterEach(() => jest.restoreAllMocks());

	it("does not send an action before confirmation or after cancelling", async () => {
		const request = jest.spyOn(GameClient, "request").mockImplementation();
		await openMenu();
		await fireEvent.press(screen.getByText("models:weapons.7"));
		expect(screen.getByText("app:equipment.confirm.equip")).toBeTruthy();
		expect(request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(screen.queryByText("app:equipment.confirm.equip")).toBeNull();
		expect(request).not.toHaveBeenCalled();
	});

	it("sends the reserve slot and renders the equipment returned by Core", async () => {
		const packet = Object.assign(new EquipActionRes(), {success: true, categories: [{...CATEGORY, equippedItem: {details: CATEGORY.reserveItems[0].details}, reserveItems: []}]});
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet});
		await openMenu();
		await fireEvent.press(screen.getByText("models:weapons.7"));
		await fireEvent.press(screen.getByText("app:collector.accept"));
		await waitFor(() => expect(screen.getByText("app:equipment.equipped")).toBeTruthy());
		expect(screen.getByText("app:equipment.emptyReserve")).toBeTruthy();
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toMatchObject({action: EQUIP_ACTIONS.EQUIP, itemCategory: 0, slot: 3});
	});

	it("preserves the menu and reports a rejected action", async () => {
		const packet = Object.assign(new EquipActionRes(), {success: false, error: EQUIP_ERRORS.RESERVE_FULL, categories: []});
		jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet});
		await openMenu();
		await fireEvent.press(screen.getByText("models:weapons.7"));
		await fireEvent.press(screen.getByText("app:collector.accept"));
		await waitFor(() => expect(screen.getByText("app:equipment.errors.reserveFull")).toBeTruthy());
		expect(screen.getByText("models:weapons.7")).toBeTruthy();
	});
});
