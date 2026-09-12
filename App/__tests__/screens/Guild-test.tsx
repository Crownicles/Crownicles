import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {GuildOverview, GuildCreation} from "@/src/components/Guild";
import {GuildData} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GuildCreateReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildCreateCollector} from "@/src/collectors/GuildCreateCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
const mockTrack = jest.fn();
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: mockTrack})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

describe("guild screens", () => {
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