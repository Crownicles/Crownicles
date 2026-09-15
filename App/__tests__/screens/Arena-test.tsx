import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
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
	it("distinguishes a defense from an attack and expands the persisted details", async () => {
		await render(<FightHistoryContent history={[{id: 42, initiator: false, opponentName: "Arsene", result: EloGameResult.LOSS, date: 1_900_000_000_000, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: -10, opponent: 15}, leaguesChanges: {me: {oldLeague: 2, newLeague: 1}}}}]} />);
		expect(screen.getByText("app:arena.history.defended")).toBeTruthy();
		expect(screen.getByText("app:arena.defeat")).toBeTruthy();
		expect(screen.getByText("models:leagues.1")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:arena.history.defended"));
		expect(screen.getByText("app:arena.history.opponentGlory")).toBeTruthy();
	});
	it("selects another league without claiming a reward until explicitly requested", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "LeagueRewardRes"});
		const data = Object.assign(new LeagueInfoRes(), {currentLeagueId: 0, glory: 123, leagues: [{id: 0, minGloryPoints: 0, maxGloryPoints: 299, money: 250, xp: 200, winMoney: 200}, {id: 1, minGloryPoints: 300, maxGloryPoints: 599, money: 300, xp: 350, winMoney: 250}]});
		await render(<LeaguesContent data={data} />);
		await fireEvent.press(screen.getByText("models:leagues.1"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:arena.leagues.claim"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(LeagueRewardReq);
	});
});
