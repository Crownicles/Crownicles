import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {GuildOverview, GuildCreation} from "@/src/components/Guild";
import {GuildData, GuildMember, GuildMembership} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GuildCreateReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildCreateCollector} from "@/src/collectors/GuildCreateCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GuildInvitation} from "@/src/components/GuildMembers";
import {GuildInviteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {JoinBoatReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {GuildDomainContent} from "@/src/components/GuildDomain";
import {GuildDomainSnapshot} from "ws-packets/src/objects/GuildDomain";
import {GuildDomainDepositReq, GuildDomainUpgradeReq} from "ws-packets/src/fromClient/GuildDomainReq";
import {formatNumber} from "@/src/display/Amounts";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: (): {push: jest.Mock} => ({push: jest.fn()})}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
const mockTrack = jest.fn();
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const DOMAIN: GuildDomainSnapshot = {
	guildName: "Aurore", guildLevel: 20, treasury: 50_000, playerMoney: 2000,
	isInCity: true, isChief: true, isElder: false, domainCityId: "test-city",
	shopLevel: 1, shelterLevel: 0, pantryLevel: 0, trainingGroundLevel: 0,
	food: {common: 0, carnivorous: 0, herbivorous: 0, ultimate: 0},
	foodCaps: [150, 90, 90, 30], foodPrices: [20, 250, 250, 600], maxBuyableFood: [10, 2, 2, 1], maxFoodCosts: [200, 500, 500, 600],
	canUseShop: true, shelterPets: [], shelterMaxCount: 6,
	canUpgradeBuildings: {shop: null, shelter: {canAfford: true, meetsLevel: true, cost: 10_000, requiredGuildLevel: 15}, pantry: {canAfford: true, meetsLevel: true, cost: 40_000, requiredGuildLevel: 15}, trainingGround: {canAfford: false, meetsLevel: false, cost: 150_000, requiredGuildLevel: 50}},
	canDeposit: {small: true, big: false, huge: false}, depositOffers: [{amount: 1000, treasuryDeposited: 950, canAfford: true}],
	dailyFoodProduction: [0, 0, 0, 0], dailyLovePoints: 0
};

const SELF: GuildMember = {id: 7, name: "Aventurier", isSelf: true, rank: 12, score: 42, islandStatus: {isOnPveIsland: false, isOnBoat: false, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}};
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
	it.each([
		{kind: "deposit", Packet: GuildDomainDepositReq, expected: {amount: 1000}, confirm: "app:guildDomain.confirmDeposit"},
		{kind: "upgrade", Packet: GuildDomainUpgradeReq, expected: {building: "pantry", expectedLevel: 0}, confirm: "app:guildDomain.confirmUpgrade"}
	])("unfolds the row before submitting the server $kind offer", async scenario => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "GuildDomainRes"});
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
	it.each([
		{case: "sailing", cannotBeJoinedOnBoat: false, requested: true},
		{case: "sailing for too long", cannotBeJoinedOnBoat: true, requested: false}
	])("offers the crossing from a member $case", async scenario => {
		const sailor: GuildMember = {id: 9, name: "Marin", isSelf: false, rank: 30, score: 12, islandStatus: {isOnPveIsland: false, isOnBoat: true, isPveIslandAlly: false, cannotBeJoinedOnBoat: scenario.cannotBeJoinedOnBoat}};
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
});