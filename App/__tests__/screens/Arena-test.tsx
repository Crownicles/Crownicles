import {fireEvent, render, screen, waitFor, within} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {FightHistoryContent, LeaguesContent} from "@/src/components/ArenaReferences";
import {Rankings} from "@/src/components/Rankings";
import {GameClient} from "@/src/networking/GameClient";
import {TopReq, LeagueRewardReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopRes, LeagueInfoRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming, EloGameResult} from "ws-packets/src/objects/Rankings";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: jest.fn()})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const LEAGUES = Object.assign(new LeagueInfoRes(), {
	currentLeagueId: 0,
	glory: 123,
	rewardAvailability: null,
	leagues: [
		{id: 0, minGloryPoints: 0, maxGloryPoints: 299, money: 250, xp: 200, winMoney: 200},
		{id: 1, minGloryPoints: 300, maxGloryPoints: 599, money: 300, xp: 350, winMoney: 250}
	]
});

describe("arena references", () => {
	beforeEach(() => jest.clearAllMocks());
	it("uses the server page for navigation and resets it when switching rankings", async () => {
		const page = Object.assign(new TopRes(), {dataType: TopDataType.SCORE, timing: TopTiming.ALL_TIME, contextRank: 36, canBeRanked: true, totalElements: 60, elementsPerPage: 10, pageNumber: 4, elements: [{rank: 36, sameContext: true, name: "Aventurier", value: 150, level: 10}]});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: page});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Rankings /></QueryClientProvider>);
		await screen.findByText("app:arena.rankings.next");
		await fireEvent.press(screen.getByText("app:arena.rankings.next"));
		await waitFor(() => expect(GameClient.request).toHaveBeenLastCalledWith(expect.objectContaining({page: 5, dataType: TopDataType.SCORE}), TopRes, expect.any(Array)));
		await fireEvent.press(screen.getByText("app:arena.rankings.types.Guild"));
		await waitFor(() => expect(GameClient.request).toHaveBeenLastCalledWith(expect.objectContaining({dataType: TopDataType.GUILD, timing: TopTiming.ALL_TIME}), TopRes, expect.any(Array)));
		const request = jest.mocked(GameClient.request).mock.calls.at(-1)![0];
		expect(request).toBeInstanceOf(TopReq);
		expect(JSON.parse(JSON.stringify(request))).not.toHaveProperty("page");
	});
	it("distinguishes a defense from an attack and shows the glory swing at a glance", async () => {
		await render(<FightHistoryContent history={[{id: 42, initiator: false, opponentName: "Arsene", result: EloGameResult.LOSS, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: -10, opponent: 15}, leaguesChanges: {me: {oldLeague: 2, newLeague: 1}}}}]} />);
		expect(screen.getByText("Arsene")).toBeTruthy();
		expect(screen.getByText("app:arena.defeat")).toBeTruthy();
		expect(screen.getByText("-10")).toBeTruthy();
		expect(screen.getByText("models:leagues.1")).toBeTruthy();
	});
	it("signs a won fight and reports a promotion", async () => {
		await render(<FightHistoryContent history={[{id: 43, initiator: true, opponentName: "Yuno", result: EloGameResult.WIN, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: 42, opponent: -15}, leaguesChanges: {me: {oldLeague: 1, newLeague: 2}}}}]} />);
		expect(screen.getByText("Yuno")).toBeTruthy();
		expect(screen.getByText("+42")).toBeTruthy();
		expect(screen.getByText("models:leagues.2")).toBeTruthy();
	});
	it("selects another league without claiming a reward until explicitly requested", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "LeagueRewardRes"});
		await render(<LeaguesContent data={LEAGUES} />);
		expect(within(screen.getByTestId("league-standing")).getByLabelText("models:leagues.1")).toHaveProp("accessibilityValue", {now: 123, max: 300});
		expect(screen.getByTestId("league-rewards-0")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "models:leagues.1"}));
		expect(screen.getByRole("button", {name: "models:leagues.1", selected: true})).toBeTruthy();
		expect(screen.queryByTestId("league-rewards-0")).toBeNull();
		const rewards = within(screen.getByTestId("league-rewards-1"));
		expect(rewards.getByText("300")).toBeTruthy();
		expect(rewards.getByText("350")).toBeTruthy();
		expect(rewards.getByText("250")).toBeTruthy();
		const standing = within(screen.getByTestId("league-standing"));
		expect(standing.getByText("models:leagues.0")).toBeTruthy();
		expect(standing.getByText("123")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "models:leagues.1"}));
		expect(screen.queryByTestId("league-rewards-1")).toBeNull();
		expect(screen.getByRole("button", {name: "models:leagues.1", selected: false})).toHaveProp("accessibilityState", {selected: false, expanded: false});
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:arena.leagues.claim"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(1));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(LeagueRewardReq);
	});
	it("announces when the reward cannot be claimed yet instead of waiting for the tap", async () => {
		await render(<LeaguesContent data={{...LEAGUES, rewardAvailability: {type: "notSunday", nextSunday: 1_900_000_000_000}}} />);
		expect(screen.getByTestId("league-reward-unavailable")).toBeTruthy();
		expect(screen.getByText("app:arena.leagues.nextClaim")).toBeTruthy();
		const claim = screen.getByRole("button", {name: "app:arena.leagues.claim"});
		expect(claim).toHaveProp("accessibilityState", {disabled: true, busy: false});
		await fireEvent.press(claim);
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("keeps the highest league visible without inventing another threshold", async () => {
		await render(<LeaguesContent data={{...LEAGUES, currentLeagueId: 1, glory: 900}} />);
		const standing = within(screen.getByTestId("league-standing"));
		expect(standing.getByText("models:leagues.1")).toBeTruthy();
		expect(standing.getByText("900")).toBeTruthy();
		expect(standing.queryByTestId("fight-gauge-fill")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "models:leagues.0"}));
		expect(standing.getByText("models:leagues.1")).toBeTruthy();
		expect(screen.getByTestId("league-rewards-0")).toBeTruthy();
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("allows an explicit retry after a failed reward request", async () => {
		jest.mocked(GameClient.request).mockRejectedValueOnce(new Error("Offline"))
			.mockResolvedValueOnce({kind: "alternative", packetName: "LeagueRewardRes"});
		await render(<LeaguesContent data={LEAGUES} />);
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.leagues.claim"}));
		await screen.findByText("app:common.connectionError");
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.leagues.claim", disabled: false}));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
		expect(screen.queryByText("app:common.connectionError")).toBeNull();
		expect(screen.getByRole("button", {name: "app:arena.leagues.claim", disabled: false})).toBeTruthy();
	});
});
