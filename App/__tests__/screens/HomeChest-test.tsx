import {act, fireEvent, render, renderHook, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactNode} from "react";
import {HomeChest} from "@/src/components/HomeChest";
import {useHomeActions} from "@/src/store/useHomeActions";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {HomeChestActionReq} from "ws-packets/src/fromClient/HomeReq";
import {HomeChestRes, HomePlantTransferRes} from "ws-packets/src/fromServer/home/HomeRes";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {count?: number; max?: number}): string => key === "app:equipment.capacity" ? `${options?.count}/${options?.max}` : key}}));

function fixture(): HomeChestRes {
	const potion = {id: 43, itemCategory: 2, rarity: 1, nature: ItemNature.ATTACK, power: 20, maxPower: 20};
	return Object.assign(new HomeChestRes(), {success: true, data: {
		chestItems: [{slot: 3, category: 2, details: potion}], depositableItems: [{slot: 2, category: 2, details: {...potion, id: 44}}],
		slotsPerCategory: {weapon: 2, armor: 2, potion: 3, object: 2}, inventoryCapacity: {weapon: 2, armor: 2, potion: 4, object: 2},
		plantStorage: [{plantId: 1, quantity: 2, maxCapacity: 5}], playerPlantSlots: [{slot: 2, plantId: 3}, {slot: 3, plantId: 0}], plantMaxCapacity: 5
	}});
}

function provider(packet: HomeChestRes): (props: {children: ReactNode}) => ReactNode {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity}}});
	client.setQueryData(gameKey(GAME_ENTITIES.HOME_CHEST), {kind: "answer", packet});
	return function Wrapper({children}: {children: ReactNode}): ReactNode {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe("home chest actions", () => {
	beforeEach(() => jest.clearAllMocks());

	it("withdraws the server chest slot and updates the inventory from the answer", async () => {
		const packet = fixture();
		const updated = fixture();
		updated.data.chestItems = [];
		updated.data.depositableItems.push({...packet.data.chestItems[0], slot: 4});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: updated});
		await render(<HomeChest />, {wrapper: provider(packet)});
		await fireEvent.press(screen.getByText("models:potions.43"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:homeChest.actions.withdraw"));
		await waitFor(() => expect(screen.getByText("app:homeChest.done.withdraw")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({action: "withdraw", slot: 3, itemCategory: 2, chestSlot: -1});
		expect(screen.getByText("app:homeChest.emptyChest")).toBeTruthy();
		expect(screen.getByText("models:potions.43")).toBeTruthy();
	});

	it("does not erase chest contents on a refused withdrawal", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new HomeChestRes(), {success: false, error: "inventoryFull", data: {chestItems: [], depositableItems: []}})});
		await render(<HomeChest />, {wrapper: provider(fixture())});
		await fireEvent.press(screen.getByText("models:potions.43"));
		await fireEvent.press(screen.getByText("app:homeChest.actions.withdraw"));
		await waitFor(() => expect(screen.getByText("app:homeChest.errors.inventoryFull")).toBeTruthy());
		expect(screen.getByText("models:potions.43")).toBeTruthy();
		expect(screen.queryByText("app:homeChest.emptyChest")).toBeNull();
	});

	it("keeps inventory and chest slot roles when exchanging from the chest", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: fixture()});
		await render(<HomeChest />, {wrapper: provider(fixture())});
		await fireEvent.press(screen.getByText("models:potions.43"));
		await fireEvent.press(screen.getByText("app:homeChest.actions.swap"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({action: "swap", slot: 2, chestSlot: 3, itemCategory: 2});
	});

	it("deposits a carried plant after confirmation and retains the other chest data", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new HomePlantTransferRes(), {success: true, plantStorage: [{plantId: 3, quantity: 3, maxCapacity: 5}], playerPlantSlots: [{slot: 2, plantId: 0}]})});
		await render(<HomeChest />, {wrapper: provider(fixture())});
		await fireEvent.press(screen.getByRole("tab", {name: "app:homeChest.views.plants"}));
		await fireEvent.press(screen.getByText(/models:plants.3/));
		await fireEvent.press(screen.getAllByText("app:homeChest.actions.plantDeposit").at(-1)!);
		await waitFor(() => expect(screen.getByText("3/5")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({action: "plantDeposit", plantId: 0, playerSlot: 2});
		await fireEvent.press(screen.getByRole("tab", {name: "app:homeChest.views.equipment"}));
		expect(screen.getByText("models:potions.43")).toBeTruthy();
	});

	it("allows only one in-flight mutation", async () => {
		let resolve!: (answer: GameAnswer<HomeChestRes>) => void;
		jest.mocked(GameClient.request).mockReturnValue(new Promise(answer => {resolve = answer;}));
		const {result} = await renderHook(useHomeActions, {wrapper: provider(fixture())});
		const mutation = {kind: "item" as const, request: makeFromClientPacket(HomeChestActionReq, {action: "withdraw", slot: 3, itemCategory: 2, chestSlot: -1})};
		let submitted!: Promise<void>;
		await act(async () => {
			submitted = result.current.submit(mutation);
			await result.current.submit(mutation);
		});
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		await act(async () => {
			resolve({kind: "answer", packet: fixture()});
			await submitted;
		});
		expect(result.current.pending).toBe(false);
	});
});