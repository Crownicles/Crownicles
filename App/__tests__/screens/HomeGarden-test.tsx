import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactNode} from "react";
import {HomeGarden} from "@/src/components/HomeGarden";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {GardenSnapshot, GardenOutcome} from "ws-packets/src/objects/Garden";
import {GardenRes} from "ws-packets/src/fromServer/home/GardenRes";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {slot?: number; plant?: string; count?: number}): string => {
	if (key === "app:city.garden.plot") return `plot ${options?.slot}`;
	if (key === "app:garden.planted") return `planted ${options?.plant} ${options?.slot}`;
	if (key === "app:garden.quantity") return `quantity ${options?.count}`;
	return key;
}}}));

function snapshot(): Extract<GardenOutcome, {kind: "snapshot"}> {
	return {kind: "snapshot", compostOffers: [{plantId: 1, quantity: 1}, {plantId: 1, quantity: 5}], garden: {
		plots: [{slot: 4, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0}], plantStorage: [{plantId: 1, quantity: 6, maxCapacity: 8}],
		hasSeed: true, seedPlantId: 3, totalPlots: 1, accessMode: "full", wateringAvailableAt: null,
		eligibility: {canHarvest: false, canPlantSeed: true, canWaterGarden: false, canCompost: true}
	}};
}
function answer(outcome: GardenOutcome): {kind: "answer"; packet: GardenRes} {
	return {kind: "answer", packet: Object.assign(new GardenRes(), {outcome})};
}
function provider(outcome: GardenOutcome): (props: {children: ReactNode}) => ReactNode {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity}}});
	client.setQueryData(gameKey(GAME_ENTITIES.GARDEN), answer(outcome));
	return function Wrapper({children}: {children: ReactNode}): ReactNode {return <QueryClientProvider client={client}>{children}</QueryClientProvider>;};
}

describe("garden screen", () => {
	beforeEach(() => jest.clearAllMocks());
	it("uses the exact empty plot index after confirmation and reloads garden state", async () => {
		const initial = snapshot();
		const updated = snapshot();
		updated.garden.plots[0].plantId = 3;
		updated.garden.hasSeed = false;
		updated.garden.eligibility.canPlantSeed = false;
		jest.mocked(GameClient.request).mockResolvedValueOnce(answer({kind: "plant", plantId: 3, gardenSlot: 4})).mockResolvedValueOnce(answer(updated));
		await render(<HomeGarden />, {wrapper: provider(initial)});
		await fireEvent.press(screen.getByText("plot 5"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:garden.plant"));
		await waitFor(() => expect(screen.getByText("planted models:plants.3 5")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({operation: {type: "plant", gardenSlot: 4}});
		expect(screen.queryByText("plot 5")).toBeNull();
	});
	it("does not permit planting, watering or composting on a remote snapshot", async () => {
		const remote = snapshot();
		remote.garden.accessMode = "readOnly";
		remote.garden.eligibility = {canHarvest: true, canPlantSeed: false, canWaterGarden: false, canCompost: false};
		remote.compostOffers = [];
		await render(<HomeGarden />, {wrapper: provider(remote)});
		await fireEvent.press(screen.getByText("plot 5"));
		expect(screen.queryByText("app:garden.water")).toBeNull();
		expect(screen.queryByText("app:garden.compost")).toBeNull();
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("submits only the selected compost offer and groups repeated material gains", async () => {
		jest.mocked(GameClient.request).mockResolvedValueOnce(answer({kind: "compost", plantId: 1, quantity: 5, materials: [7, 7, 7, 9, 9]})).mockResolvedValueOnce(answer(snapshot()));
		await render(<HomeGarden />, {wrapper: provider(snapshot())});
		await fireEvent.press(screen.getByText("quantity 5"));
		await fireEvent.press(screen.getAllByText("app:garden.compost").at(-1)!);
		await waitFor(() => expect(screen.getByText("quantity 3")).toBeTruthy());
		expect(screen.getByText("quantity 2")).toBeTruthy();
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({operation: {type: "compost", plantId: 1, quantity: 5}});
	});
	it("renders a server access refusal without a loading loop", async () => {
		await render(<HomeGarden />, {wrapper: provider({kind: "noAccess", reason: "noTalisman"})});
		expect(screen.getByText("app:garden.noAccess.noTalisman")).toBeTruthy();
		expect(screen.getByText("app:garden.refresh")).toBeTruthy();
	});
});