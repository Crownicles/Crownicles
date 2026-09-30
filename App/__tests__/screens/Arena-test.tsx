import {fireEvent, render, screen, waitFor, within} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {FightHistoryContent, LeaguesContent} from "@/src/components/ArenaReferences";
import {GloryRankings, GuildRankings, Rankings, RankingsContent} from "@/src/components/Rankings";
import {GameClient} from "@/src/networking/GameClient";
import {TopReq, LeagueRewardReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopRes, TopEmptyRes, LeagueInfoRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming, EloGameResult} from "ws-packets/src/objects/Rankings";

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useSegments: (): string[] => ["(protected)", "(tabs)", "arena", "[page]"], useRouter: (): object => ({push: mockPush, navigate: mockNavigate})}));
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
	it.each([
		{
			board: "player", dataType: TopDataType.GLORY, label: "app:arena.rankings.openProfile", ownTab: "/profile",
			other: {name: "Kyusaor", playerRef: "opaque-kyusaor"}, own: {name: "Aventurier", playerRef: "opaque-self"},
			opened: {pathname: "/arena/player/[ref]", params: {ref: "opaque-kyusaor"}}
		},
		{
			board: "guild", dataType: TopDataType.GUILD, label: "app:arena.rankings.openGuild", ownTab: "/guild",
			other: {name: "Aurore"}, own: {name: "Bananes"},
			opened: {pathname: "/arena/guilds/[name]", params: {name: "Aurore"}}
		}
	])("opens a ranked $board, and the player's own row on their own tab", async scenario => {
		const page = Object.assign(new TopRes(), {dataType: scenario.dataType, timing: TopTiming.ALL_TIME, canBeRanked: true, totalElements: 2, elementsPerPage: 10, pageNumber: 1, elements: [
			{rank: 1, sameContext: false, value: 1200, level: 60, ...scenario.other},
			{rank: 2, sameContext: true, value: 900, level: 50, ...scenario.own}
		]});
		await render(<RankingsContent data={page} onPage={jest.fn()} />);
		const [other, own] = screen.getAllByLabelText(scenario.label);
		await fireEvent.press(other);
		expect(mockPush).toHaveBeenCalledWith(scenario.opened);
		await fireEvent.press(own);
		expect(mockNavigate).toHaveBeenCalledWith(scenario.ownTab);
	});
	it("uses the server page for navigation and resets it when switching rankings", async () => {
		const page = Object.assign(new TopRes(), {dataType: TopDataType.SCORE, timing: TopTiming.ALL_TIME, contextRank: 36, canBeRanked: true, totalElements: 60, elementsPerPage: 10, pageNumber: 4, elements: [{rank: 36, sameContext: true, name: "Aventurier", value: 150, level: 10}]});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: page});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Rankings /></QueryClientProvider>);
		await screen.findByLabelText("app:arena.rankings.next");
		await fireEvent.press(screen.getByLabelText("app:arena.rankings.next"));
		await waitFor(() => expect(GameClient.request).toHaveBeenLastCalledWith(expect.objectContaining({page: 5, dataType: TopDataType.SCORE}), TopRes, expect.any(Array)));
		await fireEvent.press(screen.getByText("app:arena.rankings.types.Guild"));
		await waitFor(() => expect(GameClient.request).toHaveBeenLastCalledWith(expect.objectContaining({dataType: TopDataType.GUILD, timing: TopTiming.ALL_TIME}), TopRes, expect.any(Array)));
		const request = jest.mocked(GameClient.request).mock.calls.at(-1)![0];
		expect(request).toBeInstanceOf(TopReq);
		expect(JSON.parse(JSON.stringify(request))).not.toHaveProperty("page");
	});
	it.each([
		{case: "the arena opens on the weekly glory board", Board: GloryRankings, dataType: TopDataType.GLORY, timing: TopTiming.WEEK},
		{case: "the guild opens on the guild board", Board: GuildRankings, dataType: TopDataType.GUILD, timing: TopTiming.ALL_TIME}
	])("$case", async ({Board, dataType, timing}) => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: TopEmptyRes.wireName, packet: new TopEmptyRes()});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Board /></QueryClientProvider>);
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledWith(expect.objectContaining({dataType, timing}), TopRes, expect.any(Array)));
		expect(screen.getByRole("tab", {selected: true})).toHaveTextContent(`app:arena.rankings.types.${dataType}`);
	});
	it("shows a glory board nobody entered as an empty board with the fights still owed", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: TopEmptyRes.wireName, packet: Object.assign(new TopEmptyRes(), {needFight: 3})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><Rankings /></QueryClientProvider>);
		await fireEvent.press(screen.getByText("app:arena.rankings.types.Glory"));
		expect(await screen.findByText("app:arena.rankings.empty")).toBeTruthy();
		expect(screen.getByText("app:arena.rankings.needFight")).toBeTruthy();
		expect(screen.queryByText("app:reference.empty")).toBeNull();
	});
	it("distinguishes a defense from an attack and shows the glory swing at a glance", async () => {
		await render(<FightHistoryContent history={[{id: 42, initiator: false, opponentName: "Arsene", opponentRef: "ref-arsene", result: EloGameResult.LOSS, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: -10, opponent: 15}, leaguesChanges: {me: {oldLeague: 2, newLeague: 1}}}}]} />);
		expect(screen.getByText("Arsene")).toBeTruthy();
		expect(screen.getByText("app:arena.defeat")).toBeTruthy();
		expect(screen.getByText("-10")).toBeTruthy();
		expect(screen.getByText("models:leagues.1")).toBeTruthy();
	});
	it("opens the opponent's profile from a fight of the history", async () => {
		await render(<FightHistoryContent history={[{id: 42, initiator: false, opponentName: "Arsene", opponentRef: "ref-arsene", result: EloGameResult.LOSS, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: -10, opponent: 15}, leaguesChanges: {}}}]} />);
		await fireEvent.press(screen.getByText("Arsene"));
		expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({params: expect.objectContaining({ref: "ref-arsene"})}));
	});
	it("signs a won fight and reports a promotion", async () => {
		await render(<FightHistoryContent history={[{id: 43, initiator: true, opponentName: "Yuno", opponentRef: "ref-yuno", result: EloGameResult.WIN, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: 42, opponent: -15}, leaguesChanges: {me: {oldLeague: 1, newLeague: 2}}}}]} />);
		expect(screen.getByText("Yuno")).toBeTruthy();
		expect(screen.getByText("+42")).toBeTruthy();
		expect(screen.getByText("models:leagues.2")).toBeTruthy();
	});
	it("selects another league without claiming a reward until explicitly requested", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "LeagueRewardRes", packet: {}});
		await render(<LeaguesContent data={LEAGUES} />);
		expect(within(screen.getByTestId("league-standing")).getByLabelText("models:leagues.1")).toHaveProp("accessibilityValue", {now: 123, max: 300});
		expect(screen.queryByTestId("league-rewards-0")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "models:leagues.1"}));
		expect(screen.getByRole("button", {name: "models:leagues.1", selected: true})).toBeTruthy();
		const rewards = within(screen.getByTestId("league-rewards-1"));
		expect(rewards.getByText("300")).toBeTruthy();
		expect(rewards.getByText("350")).toBeTruthy();
		expect(rewards.getByText("250")).toBeTruthy();
		const standing = within(screen.getByTestId("league-standing"));
		expect(standing.getByText("models:leagues.0")).toBeTruthy();
		expect(standing.getByText("123")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
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
			.mockResolvedValueOnce({kind: "alternative", packetName: "LeagueRewardRes", packet: {}});
		await render(<LeaguesContent data={LEAGUES} />);
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.leagues.claim"}));
		await screen.findByText("app:common.connectionError");
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.leagues.claim", disabled: false}));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
		expect(screen.queryByText("app:common.connectionError")).toBeNull();
		expect(screen.getByRole("button", {name: "app:arena.leagues.claim", disabled: false})).toBeTruthy();
	});
	it("answers where the player stands before listing the others, and hides paging on a single page", async () => {
		const page = Object.assign(new TopRes(), {
			dataType: TopDataType.GLORY, timing: TopTiming.WEEK, contextRank: 2, canBeRanked: true, totalElements: 2, elementsPerPage: 10, pageNumber: 1,
			elements: [
				{rank: 1, sameContext: false, name: "Kyusaor", value: 1200, level: 60, leagueId: 3},
				{rank: 2, sameContext: true, name: "Aventurier", value: 900, level: 42, leagueId: 2}
			]
		});
		await render(<RankingsContent data={page} onPage={jest.fn()} />);
		expect(within(screen.getByTestId("ranking-standing")).getByText("2")).toBeTruthy();
		expect(screen.getByText("app:arena.you")).toBeTruthy();
		expect(screen.getByText(/models:leagues\.3/)).toBeTruthy();
		expect(screen.queryByLabelText("app:arena.rankings.next")).toBeNull();
	});
	it("reaches the player's own page and the first one without scrolling the list", async () => {
		const onPage = jest.fn();
		const page = Object.assign(new TopRes(), {
			dataType: TopDataType.SCORE, timing: TopTiming.ALL_TIME, contextRank: 36, canBeRanked: true, totalElements: 60, elementsPerPage: 10, pageNumber: 2,
			elements: [{rank: 11, sameContext: false, name: "Kyusaor", value: 1200, level: 60}]
		});
		await render(<RankingsContent data={page} onPage={onPage} />);
		await fireEvent.press(screen.getByLabelText("app:arena.rankings.goToMyPage"));
		expect(onPage).toHaveBeenLastCalledWith(4);
		await fireEvent.press(screen.getByLabelText("app:arena.rankings.backToFirst"));
		expect(onPage).toHaveBeenLastCalledWith(1);
	});
});
