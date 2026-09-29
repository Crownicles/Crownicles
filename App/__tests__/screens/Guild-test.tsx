import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {GuildOverview, GuildCreation} from "@/src/components/Guild";
import {GuildData, GuildMember, GuildMembership} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GuildCreateReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildCreateCollector} from "@/src/collectors/GuildCreateCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GuildInvitation, GuildInvitePlayer} from "@/src/components/GuildMembers";
import {GuildInvitePlayerReq, GuildInviteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {JoinBoatReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {GuildDomainContent} from "@/src/components/GuildDomain";
import {GuildDomainSnapshot} from "ws-packets/src/objects/GuildDomain";
import {GuildDomainDepositReq, GuildDomainUpgradeReq} from "ws-packets/src/fromClient/GuildDomainReq";
import {formatNumber} from "@/src/display/Amounts";
import {GuildCommandRes, GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: (): object => ({push: mockPush, navigate: mockNavigate, replace: mockReplace})}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
const mockTrack = jest.fn();
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const DOMAIN: GuildDomainSnapshot = {
	guildName: "Aurore", guildLevel: 20, treasury: 50_000, playerMoney: 2000,
	isInCity: true, isChief: true, isElder: false, domainCityId: "test-city",
	shopLevel: 1, shelterLevel: 0, pantryLevel: 0, trainingGroundLevel: 0, recruitmentOfficeLevel: 0,
	recruitment: {open: false, minScore: 0},
	food: {common: 0, carnivorous: 0, herbivorous: 0, ultimate: 0},
	foodCaps: [150, 90, 90, 30], foodPrices: [20, 250, 250, 600], maxBuyableFood: [10, 2, 2, 1], maxFoodCosts: [200, 500, 500, 600],
	canUseShop: true, shelterPets: [], shelterMaxCount: 6,
	canUpgradeBuildings: {shop: null, shelter: {canAfford: true, meetsLevel: true, cost: 10_000, requiredGuildLevel: 15}, pantry: {canAfford: true, meetsLevel: true, cost: 40_000, requiredGuildLevel: 15}, trainingGround: {canAfford: false, meetsLevel: false, cost: 150_000, requiredGuildLevel: 50}, recruitmentOffice: {canAfford: true, meetsLevel: true, cost: 10_000, requiredGuildLevel: 5}},
	canDeposit: {small: true, big: false, huge: false}, depositOffers: [{amount: 1000, treasuryDeposited: 950, canAfford: true}],
	dailyFoodProduction: [0, 0, 0, 0], dailyLovePoints: 0
};

const SELF: GuildMember = {id: 7, name: "Aventurier", isSelf: true, playerRef: "opaque-self", rank: 12, score: 42, islandStatus: {isOnPveIsland: false, isOnBoat: false, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}};
const MEMBERSHIP: GuildMembership = {treasury: 12_000, daily: {availableAt: 0, blockedByIsland: false}, domain: {established: true, isInCity: true, mapLocationId: 3}};

function guildData(overrides: Partial<GuildData> = {}): GuildData {
	return {
		name: "Aurore", chiefId: 7, elderId: null, level: 3, isMaxLevel: false,
		experience: {value: 3, max: 10}, rank: {unranked: false, rank: 1, numberOfGuilds: 3, score: 42},
		members: [SELF], membership: MEMBERSHIP, ...overrides
	};
}

describe("guild screens", () => {
	beforeEach(() => jest.clearAllMocks());
	it.each([
		{type: "guildReimburse", data: {amount: 60}, message: "app:guildDomain.confirmReimburse"},
		{type: "guildLeave", data: {guildName: "Aurore", isGuildDestroyed: true}, message: "app:guild.dissolveWarning"}
	])("preserves the server warning and refusal index for $type", async scenario => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: scenario.type, endTime: Date.now() + 60_000, data: {type: scenario.type, data: scenario.data}, reactions: [{type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const choose = jest.fn();
		await render(<GuildCreateCollector collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByText(scenario.message)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(choose).toHaveBeenCalledWith(1);
	});
	it("previews a new description and saves it through the server's accept reaction", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "description", endTime: Date.now() + 60_000, data: {type: "guildDescription", data: {description: "Marchands loyaux"}}, reactions: [{type: "refuse", data: {}}, {type: "accept", data: {}}]});
		const choose = jest.fn();
		await render(<GuildCreateCollector collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByText("app:guild.descriptionPreview")).toBeTruthy();
		expect(screen.getByText("Marchands loyaux")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:pet.care.save"));
		expect(choose).toHaveBeenCalledWith(1);
	});
	it.each([
		{kind: "deposit", Packet: GuildDomainDepositReq, expected: {amount: 1000}, confirm: "app:guildDomain.confirmDeposit"},
		{kind: "upgrade", Packet: GuildDomainUpgradeReq, expected: {building: "pantry", expectedLevel: 0}, confirm: "app:guildDomain.confirmUpgrade"}
	])("unfolds the row before submitting the server $kind offer", async scenario => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "GuildDomainRes", packet: {}});
		await render(<GuildDomainContent domain={DOMAIN} />);
		if (scenario.kind === "upgrade") await fireEvent.press(screen.getByText(/commands:report.city.guildDomain.buildings.pantry/));
		else await fireEvent.press(screen.getByText("app:guildDomain.depositNet"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText(scenario.confirm));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(scenario.Packet);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject(scenario.expected);
	});
	it("sends an invitation using the entered rank without selecting another identity", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildInvitation />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.inviteRank"), "42");
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.sendInvitation"}));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(GuildInviteReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({rank: 42});
	});
	describe("invitation from another player's profile", () => {
		const STRANGER = Object.assign(new ProfileRes(), {guild: undefined});
		async function renderInvite(guild: GuildData, profile: ProfileRes = STRANGER): Promise<void> {
			jest.mocked(GameClient.request).mockImplementation(async packet => packet instanceof GuildReq
				? {kind: "answer", packet: Object.assign(new GuildRes(), {foundGuild: true, data: guild})}
				: {kind: "answer", packet: new GuildCommandRes()});
			const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
			await render(<QueryClientProvider client={client}><GuildInvitePlayer playerRef="opaque-ref" profile={profile} /></QueryClientProvider>);
			await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		}
		it("lets a chief with room left invite the player through their handle", async () => {
			await renderInvite(guildData());
			await fireEvent.press(await screen.findByRole("button", {name: "app:guild.inviteInto"}));
			await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
			const invite = jest.mocked(GameClient.request).mock.calls[1][0];
			expect(invite).toBeInstanceOf(GuildInvitePlayerReq);
			expect(invite).toMatchObject({playerRef: "opaque-ref"});
		});
		it.each([
			{name: "a member who is not the chief", guild: guildData({chiefId: 99})},
			{name: "a chief whose guild is full", guild: guildData({members: Array.from({length: 6}, (_, index) => ({...SELF, id: 7 + index, isSelf: index === 0}))})}
		])("offers nothing to $name", async ({guild}) => {
			await renderInvite(guild);
			expect(screen.queryByRole("button", {name: "app:guild.inviteInto"})).toBeNull();
		});
		it("says why a player who already has a guild cannot be invited", async () => {
			await renderInvite(guildData(), Object.assign(new ProfileRes(), {guild: "Crépuscule"}));
			await fireEvent.press(await screen.findByRole("button", {name: "app:guild.inviteInto"}));
			expect(screen.getByText("app:guild.memberErrors.alreadyMember")).toBeTruthy();
			expect(GameClient.request).toHaveBeenCalledTimes(1);
		});
	});
	it("shows the guild treasury to a plain member", async () => {
		await render(<GuildOverview guild={guildData({chiefId: 99})} onPage={jest.fn()} />);
		expect(screen.getByText(formatNumber(MEMBERSHIP.treasury))).toBeTruthy();
	});
	it("shows the real guild and routes to the storage", async () => {
		const onPage = jest.fn();
		await render(<GuildOverview guild={guildData({description: "Notre guilde"})} onPage={onPage} />);
		expect(screen.getByText("Aurore")).toBeTruthy();
		expect(screen.getByText("Aventurier")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.pages.storage"));
		expect(onPage).toHaveBeenCalledWith("storage");
	});
	it.each([
		{case: "no domain", domain: {established: false, isInCity: false}, chiefId: 7, lock: "app:guild.domainLocks.none"},
		{case: "not the chief", domain: {established: true, isInCity: true}, chiefId: 99, lock: "app:guild.domainLocks.chiefOnly"},
		{case: "away from the city", domain: {established: true, isInCity: false, mapLocationId: 3}, chiefId: 7, lock: "app:guild.domainLocks.away"}
	])("locks the domain and says why when $case", async scenario => {
		const onPage = jest.fn();
		await render(<GuildOverview guild={guildData({chiefId: scenario.chiefId, membership: {...MEMBERSHIP, domain: scenario.domain}})} onPage={onPage} />);
		expect(screen.getByText(scenario.lock)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.pages.domain"));
		expect(onPage).not.toHaveBeenCalled();
	});
	it("opens the domain once the chief stands in its city", async () => {
		const onPage = jest.fn();
		await render(<GuildOverview guild={guildData()} onPage={onPage} />);
		expect(screen.queryByTestId("guild-domain-lock")).toBeNull();
		await fireEvent.press(screen.getByText("app:guild.pages.domain"));
		expect(onPage).toHaveBeenCalledWith("domain");
	});
	it.each([
		{case: "the cooldown is running", daily: {availableAt: Date.now() + 3_600_000, blockedByIsland: false}, lock: "app:guild.dailyLocks.cooldown"},
		{case: "a member explores the island", daily: {availableAt: 0, blockedByIsland: true}, lock: "app:guild.dailyLocks.island"}
	])("refuses the daily reward and says why when $case", async scenario => {
		await render(<GuildOverview guild={guildData({membership: {...MEMBERSHIP, daily: scenario.daily}})} onPage={jest.fn()} />);
		expect(screen.getByText(scenario.lock)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.daily"));
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("claims the daily reward once it is available", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildOverview guild={guildData()} onPage={jest.fn()} />);
		expect(screen.queryByTestId("guild-daily-lock")).toBeNull();
		await fireEvent.press(screen.getByText("app:guild.daily"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
	});
	it("sends the entered guild name without a client identity", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildCreation />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.name"), "Aurore");
		await fireEvent.press(screen.getByText("app:guild.create"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		const request = jest.mocked(GameClient.request).mock.calls[0][0];
		expect(request).toBeInstanceOf(GuildCreateReq);
		expect(request).toMatchObject({askedGuildName: "Aurore"});
		expect(request).not.toHaveProperty("keycloakId");
	});
	it("says why a typed guild name is refused and keeps it from being sent", async () => {
		await render(<GuildCreation />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.name"), "Rois_");
		expect(screen.getByText("app:inputIssues.forbiddenCharacter")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.create"));
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("shows the server's refusal in the form, until the name is changed", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: GuildCommandRes.wireName, packet: Object.assign(new GuildCommandRes(), {outcome: {type: "creationStatus", status: {foundGuild: false, guildNameIsAvailable: false}}})});
		await render(<GuildCreation />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.name"), "Aurore");
		await fireEvent.press(screen.getByText("app:guild.create"));
		await waitFor(() => expect(screen.getByText("app:guild.errors.nameTaken")).toBeTruthy());
		await fireEvent.changeText(screen.getByLabelText("app:guild.name"), "Aurores");
		expect(screen.queryByText("app:guild.errors.nameTaken")).toBeNull();
	});
	it("sends the name as the keyboard typed it, trimmed and with a straight apostrophe", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildCreation />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.name"), "L’Ordre ");
		expect(screen.queryByText(/^app:inputIssues\./u)).toBeNull();
		await fireEvent.press(screen.getByText("app:guild.create"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({askedGuildName: "L'Ordre"});
	});
	it.each([
		{case: "sailing", cannotBeJoinedOnBoat: false, requested: true},
		{case: "sailing for too long", cannotBeJoinedOnBoat: true, requested: false}
	])("offers the crossing from a member $case", async scenario => {
		const sailor: GuildMember = {id: 9, name: "Marin", isSelf: false, playerRef: "opaque-marin", rank: 30, score: 12, islandStatus: {isOnPveIsland: false, isOnBoat: true, isPveIslandAlly: false, cannotBeJoinedOnBoat: scenario.cannotBeJoinedOnBoat}};
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildOverview guild={guildData({members: [SELF, sailor]})} onPage={jest.fn()} />);
		await fireEvent.press(screen.getByText("Marin"));
		await fireEvent.press(screen.getByText("app:utilities.boat"));
		if (scenario.requested) await waitFor(() => expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(JoinBoatReq));
		else expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("keeps the crossing out of a member who is not on a boat", async () => {
		await render(<GuildOverview guild={guildData()} onPage={jest.fn()} />);
		await fireEvent.press(screen.getByText("Aventurier"));
		expect(screen.queryByText("app:utilities.boat")).toBeNull();
	});
	it("opens a guildmate's profile from their sheet, and the player's own on their tab", async () => {
		const mate: GuildMember = {...SELF, id: 9, name: "Marin", isSelf: false, playerRef: "opaque-marin"};
		await render(<GuildOverview guild={guildData({members: [SELF, mate]})} onPage={jest.fn()} />);
		await fireEvent.press(screen.getByText("Marin"));
		await fireEvent.press(screen.getByText("app:guild.openProfile"));
		expect(mockPush).toHaveBeenCalledWith({pathname: "/player/[ref]", params: {ref: "opaque-marin"}});
		await fireEvent.press(screen.getByText("Aventurier"));
		await fireEvent.press(screen.getByText("app:guild.openProfile"));
		expect(mockNavigate).toHaveBeenCalledWith("/profile");
	});
	it("shows another guild read-only, where a member leads straight to their profile", async () => {
		const sailor: GuildMember = {id: 9, name: "Marin", isSelf: false, playerRef: "opaque-marin", rank: 30, score: 12, islandStatus: {isOnPveIsland: false, isOnBoat: true, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}};
		const {membership: _ownOnly, ...foreign} = guildData({chiefId: 9, members: [sailor]});
		await render(<GuildOverview guild={foreign} />);
		expect(screen.queryByText(formatNumber(MEMBERSHIP.treasury))).toBeNull();
		await fireEvent.press(screen.getByText("Marin"));
		expect(mockPush).toHaveBeenCalledWith({pathname: "/player/[ref]", params: {ref: "opaque-marin"}});
		expect(screen.queryByText("app:utilities.boat")).toBeNull();
	});
	it.each([
		{case: "joins it at once", blocker: undefined, requested: true},
		{case: "learns why it cannot join yet", blocker: "minScore" as const, requested: false}
	])("offers a recruiting guild to a player without one, who $case", async scenario => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		const {membership: _ownOnly, ...foreign} = guildData({chiefId: 9, members: []});
		const recruitment = {id: 3, name: "Aurore", level: 3, memberCount: 0, minScore: 500, ...scenario.blocker ? {blocker: scenario.blocker} : {}};
		await render(<QueryClientProvider client={new QueryClient()}><GuildOverview guild={{...foreign, recruitment}} /></QueryClientProvider>);
		await fireEvent.press(screen.getByText("app:guild.join.join"));
		if (scenario.requested) await waitFor(() => expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({guildId: 3}));
		else {
			expect(screen.getByText("app:guild.join.blockers.minScore")).toBeTruthy();
			expect(GameClient.request).not.toHaveBeenCalled();
		}
	});
});