import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {DeathScreen} from "@/src/components/DeathScreen";
import {PlayerUtilityCollector} from "@/src/collectors/PlayerUtilityCollector";
import {GameClient} from "@/src/networking/GameClient";
import {RespawnReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: () => ({track: jest.fn()})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: (): object => ({status: "ready", data: {effect: {effect: "dead", respawnScoreLoss: 2820}}})}));
jest.mock("@/src/store/useReducedMotion", () => ({useReducedMotion: (): boolean => true}));

describe("player utilities", () => {
	beforeEach(() => jest.clearAllMocks());
	it("tells the dead player what getting back up restores and costs", async () => {
		await render(<DeathScreen />);
		expect(screen.getByText("error:effects.dead.self")).toBeTruthy();
		expect(screen.getByText("app:death.health")).toBeTruthy();
		expect(screen.getByText("app:utilities.respawnWarning")).toBeTruthy();
		expect(screen.getByText("app:death.scoreLossCaption")).toBeTruthy();
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("requests the respawn from the death screen", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "PlayerUtilityRes"});
		await render(<DeathScreen />);
		await fireEvent.press(screen.getByText("app:utilities.respawn"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalled());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(RespawnReq);
	});
	it("presents the public prisoner and keeps the original refusal index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "bail", endTime: Date.now() + 60_000, data: {type: "unlockPlayer", data: {price: 321, playerName: "Aster"}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const choose = jest.fn();
		await render(<PlayerUtilityCollector collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByText("Aster")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(choose).toHaveBeenCalledWith(2);
	});
});
