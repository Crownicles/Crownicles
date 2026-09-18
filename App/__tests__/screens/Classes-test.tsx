import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ClassDetails} from "ws-packets/src/objects/ClassDetails";
import {ClassesInfoRes} from "ws-packets/src/fromServer/classes/ClassesInfoRes";
import {makeFromServerPacket} from "ws-packets/src/MakePackets";
import {Classes, ClassesContent} from "@/src/components/Classes";
import {GameClient} from "@/src/networking/GameClient";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: jest.fn()})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: () => ({status: "loading"})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: Record<string, unknown>): string => {
	if (key === "app:classes.name") return String(options?.name);
	if (key === "app:classes.breathCost") return `breath ${options?.cost}`;
	if (key === "app:classes.availableInDays") return `available in ${options?.count} days`;
	if (key === "app:requirements.level") return `required level ${options?.level}`;
	return key;
}}}));

const MILLISECONDS_PER_DAY = 86_400_000;

const DETAILS: ClassDetails = {id: 7, stats: {health: 99, attack: 50, defense: 30, speed: 20, fightPoint: 333, baseBreath: 5, maxBreath: 12, breathRegen: 3, classGroup: 1, classKind: "attack"}, attacks: [{id: "simpleAttack", cost: 4}]};

describe("classes screen", () => {
	it("opens on the player's own class and folds it away on demand", async () => {
		await render(<ClassesContent classes={[DETAILS]} currentClass={7} />);
		expect(screen.getByText("app:classes.current")).toBeTruthy();
		expect(screen.getByTestId("class-details-7")).toBeTruthy();
		expect(screen.getByText("99")).toBeTruthy();
		expect(screen.getByText("333")).toBeTruthy();
		expect(screen.getByText("models:fight_actions.simpleAttack.description")).toBeTruthy();
		expect(screen.getByText("breath 4")).toBeTruthy();
		await fireEvent.press(screen.getAllByText("models:classes.7").at(-1)!);
		expect(screen.queryByTestId("class-details-7")).toBeNull();
		expect(screen.getByText("app:classes.current")).toBeTruthy();
	});

	it("shows the required level returned by Core instead of a timeout", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "rejected", packet: {rejection: {type: "level", requiredLevel: 10}}});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Classes /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("required level 10")).toBeTruthy());
		expect(screen.queryByText("app:classes.change")).toBeNull();
	});

	it("announces the remaining cooldown on the button instead of behind a press", async () => {
		const nextChangeTimestamp = Date.now() + 3 * MILLISECONDS_PER_DAY;
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: makeFromServerPacket(ClassesInfoRes, {data: {classesStats: [DETAILS], nextChangeTimestamp}})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Classes /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("available in 3 days")).toBeTruthy());
		expect(screen.queryByText("app:classes.change")).toBeNull();
	});
});