import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {GuildOverview, GuildCreation} from "@/src/components/Guild";
import {GuildData} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GuildCreateReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildCreateCollector} from "@/src/collectors/GuildCreateCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GuildMembers} from "@/src/components/GuildMembers";
import {GuildInviteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {GuildDomainContent} from "@/src/components/GuildDomain";
import {GuildDomainSnapshot} from "ws-packets/src/objects/GuildDomain";
import {GuildDomainDepositReq, GuildDomainUpgradeReq} from "ws-packets/src/fromClient/GuildDomainReq";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
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

describe("guild screens", () => {
	beforeEach(() => jest.clearAllMocks());
	it("keeps the server reimbursement amount and original refusal index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "refund", endTime: Date.now() + 60_000, data: {type: "guildReimburse", data: {amount: 60}}, reactions: [{type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const choose = jest.fn();
		await render(<GuildCreateCollector collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByText("app:guildDomain.confirmReimburse")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(choose).toHaveBeenCalledWith(1);
	});
	it("waits for confirmation before submitting the server deposit offer", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "GuildDomainRes"});
		await render(<GuildDomainContent domain={DOMAIN} />);
		await fireEvent.press(screen.getByText("app:guildDomain.depositNet"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:collector.accept"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(GuildDomainDepositReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({amount: 1000});
	});
	it("binds an upgrade confirmation to the displayed building level", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "GuildDomainRes"});
		await render(<GuildDomainContent domain={DOMAIN} />);
		await fireEvent.press(screen.getByText(/commands:report.city.guildDomain.buildings.pantry/));
		await fireEvent.press(screen.getByRole("button", {name: "app:guildDomain.upgrade"}));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:collector.accept"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(GuildDomainUpgradeReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({building: "pantry", expectedLevel: 0});
	});
	it("sends an invitation using the entered rank without selecting another identity", async () => {
		const guild: GuildData = {name: "Aurore", chiefId: 7, elderId: null, level: 1, isMaxLevel: false, experience: {value: 0, max: 150}, rank: {unranked: true, rank: -1, numberOfGuilds: 3, score: 0}, members: [{id: 7, name: "Aventurier", isSelf: true, rank: 1, score: 0, islandStatus: {isOnPveIsland: false, isOnBoat: false, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}}]};
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await render(<GuildMembers guild={guild} />);
		await fireEvent.changeText(screen.getByLabelText("app:guild.inviteRank"), "42");
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.invite"}));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(GuildInviteReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({rank: 42});
	});
	it("warns before dissolution and sends refusal without quitting", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "leave", endTime: Date.now() + 60_000, data: {type: "guildLeave", data: {guildName: "Aurore", isGuildDestroyed: true}}, reactions: [{type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const onChoose = jest.fn();
		await render(<GuildCreateCollector collector={collector} onChoose={onChoose} submitting={false} />);
		expect(screen.getByText("app:guild.dissolveWarning")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
	it("shows the real guild and routes to the storage", async () => {
		const data: GuildData = {name: "Aurore", description: "Notre guilde", chiefId: 7, elderId: null, level: 3, isMaxLevel: false, experience: {value: 3, max: 10}, rank: {unranked: false, rank: 1, numberOfGuilds: 3, score: 42}, members: [{id: 7, name: "Aventurier", isSelf: true, rank: 12, score: 42, islandStatus: {isOnPveIsland: false, isOnBoat: false, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}}]};
		const onPage = jest.fn();
		await render(<GuildOverview guild={data} onPage={onPage} />);
		expect(screen.getByText("Aurore")).toBeTruthy();
		expect(screen.getByText("Aventurier")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.pages.storage"));
		expect(onPage).toHaveBeenCalledWith("storage");
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
});