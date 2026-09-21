import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {Linking} from "react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {BadgesContent, Blessing, BlessingContent, Guide, RarityContent} from "@/src/components/CharacterReference";
import {BlessingRes} from "ws-packets/src/fromServer/character/BlessingRes";
import {GameClient} from "@/src/networking/GameClient";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "fr", t: (key: string, options?: Record<string, unknown>): string => {
	if (key === "app:reference.percentage") return `${options?.value} %`;
	if (key === "app:profile.formats.progress") return `${options?.value} / ${options?.max}`;
	return key;
}}}));

describe("character reference screens", () => {
	afterEach(() => {jest.useRealTimers(); jest.clearAllMocks();});

	it("displays the server probability for every rarity including a very rare result", async () => {
		await render(<RarityContent rarities={[0, 43.768, 25, 15, 10, 5, 1, 0.22, 0.012]} />);
		expect(screen.getByText("43.768 %")).toBeTruthy();
		expect(screen.getByText("0.012 %")).toBeTruthy();
		expect(screen.getByText("commands:rarity.earlyAvailable")).toBeTruthy();
	});

	it("shows a collecting pool and its contributors", async () => {
		const data = Object.assign(new BlessingRes(), {activeBlessingType: 0, poolAmount: 41, poolThreshold: 100, poolExpiresAt: 1_900_000_000_000, topContributor: "Aventurier", topContributorAmount: 40, totalContributors: 2});
		await render(<BlessingContent data={data} />);
		expect(screen.getByText("41 / 100")).toBeTruthy();
		expect(screen.getByText("Aventurier")).toBeTruthy();
		expect(screen.getByText("app:reference.blessing.expiresAt")).toBeTruthy();
	});

	it("shows the active blessing instead of presenting its pool as available", async () => {
		const data = Object.assign(new BlessingRes(), {activeBlessingType: 4, blessingEndAt: 1_900_000_000_000, poolAmount: 0, poolThreshold: 100, poolExpiresAt: 0, lastTriggeredBy: "Aventurier", totalContributors: 2});
		await render(<BlessingContent data={data} />);
		expect(screen.getByText("app:reference.blessing.endsAt")).toBeTruthy();
		expect(screen.queryByText("app:reference.blessing.pool")).toBeNull();
	});

	it("marks owned badges without displaying donation or voting badges", async () => {
		await render(<BadgesContent badges={["donor", "voter", "technical_team"]} />);
		expect(screen.getByText("app:inventory.owned")).toBeTruthy();
		expect(screen.getByText("app:reference.badges.names.technical_team")).toBeTruthy();
		expect(screen.queryByText("app:reference.badges.names.donor")).toBeNull();
		expect(screen.queryByText("app:reference.badges.names.voter")).toBeNull();
	});

	it("brings the earned badges to the top and dims the missing ones", async () => {
		await render(<BadgesContent badges={["top_week"]} />);
		const names = screen.getAllByText(/app:reference\.badges\.names\./);
		expect(names[0]).toHaveTextContent("app:reference.badges.names.top_week");
		expect(screen.getAllByText(/app:inventory\./)[0]).toHaveTextContent("app:inventory.owned");
	});

	it("gathers the badges and the rarities behind one way out to the online guide", async () => {
		const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: {badges: ["technical_team"], rarities: [0, 43.768]}} as never);
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Guide /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:reference.badges.names.technical_team")).toBeTruthy());
		expect(screen.getByText("43.768 %")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:reference.guide"));
		expect(openURL).toHaveBeenCalledWith("https://guide.crownicles.com");
	});

	it("replaces an expired blessing with the new server pool", async () => {
		jest.useFakeTimers();
		const common = {poolAmount: 0, poolThreshold: 100, totalContributors: 0};
		const active = Object.assign(new BlessingRes(), {...common, activeBlessingType: 4, blessingEndAt: Date.now() + 60_000, poolExpiresAt: 0});
		const collecting = Object.assign(new BlessingRes(), {...common, activeBlessingType: 0, poolExpiresAt: Date.now() + 120_000});
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "answer", packet: active}).mockResolvedValue({kind: "answer", packet: collecting});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Blessing /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:reference.blessing.endsAt")).toBeTruthy());
		await act(async () => {jest.advanceTimersByTime(60_000);});
		await waitFor(() => expect(screen.getByText("app:reference.blessing.pool")).toBeTruthy());
		expect(screen.queryByText("app:reference.blessing.endsAt")).toBeNull();
	});
});