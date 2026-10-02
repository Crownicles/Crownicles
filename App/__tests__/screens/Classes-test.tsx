import {fireEvent, render, screen, waitFor, within} from "@testing-library/react-native";
import {Platform} from "react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ClassDetails} from "ws-packets/src/objects/ClassDetails";
import {ClassesInfoRes} from "ws-packets/src/fromServer/classes/ClassesInfoRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {makeFromServerPacket} from "ws-packets/src/MakePackets";
import {Classes, ClassesContent} from "@/src/components/Classes";
import {GameClient} from "@/src/networking/GameClient";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const mockTrack = jest.fn();
const mockAnswerWithoutShowing = jest.fn();

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack, answerWithoutShowing: mockAnswerWithoutShowing})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn(() => ({status: "loading"}))}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "en", t: (key: string, options?: Record<string, unknown>): string => {
	if (key === "app:classes.name") return String(options?.name);
	if (key === "app:classes.breathCost") return `breath ${options?.cost}`;
	if (key === "app:classes.availableInDays") return `available in ${options?.count} days`;
	if (key === "app:requirements.level") return `required level ${options?.level}`;
	if (key === "app:requirements.effect") return `busy for ${options?.duration}`;
	return key;
}}}));

const MILLISECONDS_PER_DAY = 86_400_000;

const DETAILS: ClassDetails = {id: 7, stats: {health: 99, attack: 50, defense: 30, speed: 20, fightPoint: 333, baseBreath: 5, maxBreath: 12, breathRegen: 3, classGroup: 1, classKind: "attack"}, attacks: [{id: "simpleAttack", cost: 4}]};
const TANK: ClassDetails = {id: 8, stats: {...DETAILS.stats, health: 140, attack: 35, classKind: "defense"}, attacks: [{id: "shieldAttack", cost: 3}]};

async function renderClasses(): Promise<void> {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
	await render(<QueryClientProvider client={client}><Classes /></QueryClientProvider>);
}

function infoAnswer(nextChangeTimestamp?: number): {kind: "answer"; packet: ClassesInfoRes} {
	return {kind: "answer", packet: makeFromServerPacket(ClassesInfoRes, {data: {classesStats: [DETAILS, TANK], ...nextChangeTimestamp === undefined ? {} : {nextChangeTimestamp}}})};
}

function rowOrder(): string[] {
	return screen.getAllByRole("button").map(button => button.props.accessibilityLabel).filter((label): label is string => typeof label === "string" && label.startsWith("models:classes."));
}

/** Opens the tank's sheet and presses its choice, the server offering the tank as the second reaction. */
async function chooseTank(): Promise<void> {
	const offer = Object.assign(new ReactionCollectorCreation(), {
		id: "classes", endTime: Date.now() + 60_000,
		data: {type: "classes", data: {cooldownSeconds: 604800, classesDetails: []}},
		reactions: [{type: "refuse", data: {}}, {type: "chooseClass", data: {classId: 8}}]
	});
	jest.mocked(GameClient.request).mockImplementation(packet => Promise.resolve(packet.constructor.name === "ClassesReq" ? {kind: "answer", packet: offer} : infoAnswer()));
	await renderClasses();
	await fireEvent.press(await screen.findByLabelText("models:classes.8"));
	await fireEvent.press(within(screen.getByTestId("class-details-8")).getByText("app:classes.choose"));
}

describe("classes screen", () => {
	afterEach(() => jest.restoreAllMocks());

	beforeEach(() => {
		jest.mocked(GameClient.request).mockReset();
		jest.mocked(usePlayerProfile).mockReturnValue({status: "loading"});
		mockTrack.mockReset();
		mockAnswerWithoutShowing.mockReset();
	});

	it("shows a class's details over the list on demand, and puts them away", async () => {
		await render(<ClassesContent classes={[DETAILS]} currentClass={7} />);
		expect(screen.getByText("app:classes.current")).toBeTruthy();
		expect(screen.queryByTestId("class-details-7")).toBeNull();
		await fireEvent.press(screen.getAllByText("models:classes.7").at(-1)!);
		const details = within(screen.getByTestId("class-details-7"));
		expect(details.getByText("333")).toBeTruthy();
		expect(details.getByText("models:fight_actions.simpleAttack.description")).toBeTruthy();
		expect(details.getByText("breath 4")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
		await waitFor(() => expect(screen.queryByTestId("class-details-7")).toBeNull());
	});

	it("ranks the classes on the chosen figure and tells each gap to the player's class", async () => {
		await render(<ClassesContent classes={[DETAILS, TANK]} currentClass={7} />);
		expect(rowOrder()).toEqual(["models:classes.8", "models:classes.7"]);
		expect(screen.getByText("+41")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("app:profile.fields.attack"));
		expect(rowOrder()).toEqual(["models:classes.7", "models:classes.8"]);
		expect(screen.getByText("-15")).toBeTruthy();
	});

	it("holds the choice back while the sheet is still leaving", async () => {
		await chooseTank();
		// On iOS, a celebration opened while the sheet is still leaving is lost and freezes every touch.
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		expect(mockAnswerWithoutShowing).not.toHaveBeenCalled();
	});

	it("sends the choice once the sheet is put away, where the platform reports no dismissal", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		await chooseTank();
		await waitFor(() => expect(mockAnswerWithoutShowing).toHaveBeenCalledWith("classes", 1));
		expect(mockTrack).not.toHaveBeenCalled();
		expect(screen.queryByTestId("class-details-8")).toBeNull();
	});

	it("shows the required level returned by Core instead of a timeout", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "rejected", packet: {rejection: {type: "level", requiredLevel: 10}}});
		await renderClasses();
		await waitFor(() => expect(screen.getByText("required level 10")).toBeTruthy());
	});

	it("announces the remaining cooldown before any press, and refuses the choice", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(infoAnswer(Date.now() + 3 * MILLISECONDS_PER_DAY));
		await renderClasses();
		await waitFor(() => expect(within(screen.getByTestId("class-change-lock")).getByText("available in 3 days")).toBeTruthy());
		await fireEvent.press(screen.getByLabelText("models:classes.8"));
		await fireEvent.press(within(screen.getByTestId("class-details-8")).getByText("app:classes.choose"));
		expect(GameClient.request).toHaveBeenCalledTimes(1);
	});

	it("says a running alteration blocks the change before the press", async () => {
		jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {classId: 7, effect: {effect: "occupied", hasTimeDisplay: true, healed: false, timeLeft: 120_000}}} as unknown as ReturnType<typeof usePlayerProfile>);
		jest.mocked(GameClient.request).mockResolvedValue(infoAnswer());
		await renderClasses();
		await waitFor(() => expect(within(screen.getByTestId("class-change-lock")).getByText(/busy for/)).toBeTruthy());
	});
});
