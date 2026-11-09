import { afterEach, describe, expect, it, vi } from "vitest";
import { MqttManager } from "../../src/mqtt/MqttManager";
import { GlobalMqttClient } from "../../src/mqtt/GlobalMqttClient";
import { WebSocketServer } from "../../src/services/WebSocketServer";
import { coreAccountAdventures } from "../../src/services/CoreAccountAdventures";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandAccountAdventuresReq, CommandAccountAdventuresRes } from "../../../Lib/src/packets/commands/CommandAccountAdventuresPacket";
import { ErrorInternalPacket, ErrorMaintenancePacket } from "../../../Lib/src/packets/commands/ErrorPacket";
import { BlockedPacket } from "../../../Lib/src/packets/commands/BlockedPacket";
import "../../src/packets/fromServer/translators/BlockedServerTranslator";

vi.mock("../../src/index", () => ({keycloakConfig: {}, restWsConfig: {PREFIX: "test"}}));
vi.mock("mqtt", () => ({connect: vi.fn(() => ({on: vi.fn(), publish: vi.fn(), subscribe: vi.fn()}))}));

function sentRequest(): {context: PacketContext; packet: CommandAccountAdventuresReq} {
	const [context, packet] = vi.mocked(MqttManager.globalMqttClient.sendToBackEnd).mock.calls[0];
	return {context, packet: packet as CommandAccountAdventuresReq};
}

describe("account adventures asked to Core", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	function connect(): void {
		MqttManager.globalMqttClient = new GlobalMqttClient("mqtt://test", {});
		vi.spyOn(MqttManager.globalMqttClient, "sendToBackEnd").mockImplementation(() => undefined);
	}

	it("asks for both accounts on behalf of the requester and answers what Core read", async () => {
		connect();
		const adventures = coreAccountAdventures("requester", ["discord-user", "email-user"]);
		await vi.waitFor(() => expect(MqttManager.globalMqttClient.sendToBackEnd).toHaveBeenCalledOnce());
		const {context, packet} = sentRequest();
		expect(context.keycloakId).toBe("requester");
		expect(context.webSocket).toEqual({});
		expect(packet.keycloakIds).toEqual(["discord-user", "email-user"]);
		const read = [{keycloakId: "discord-user", level: 42, score: 1000, classId: 3}];
		await expect(MqttManager.asyncPacketSender.handleResponse(context, CommandAccountAdventuresRes.name, {adventures: read} as CommandAccountAdventuresRes)).resolves.toBe(true);
		await expect(adventures).resolves.toEqual(read);
	});

	it("answers nothing when Core refuses, for instance during a maintenance", async () => {
		connect();
		const adventures = coreAccountAdventures("requester", ["discord-user"]);
		await vi.waitFor(() => expect(MqttManager.globalMqttClient.sendToBackEnd).toHaveBeenCalledOnce());
		await MqttManager.asyncPacketSender.handleResponse(sentRequest().context, ErrorMaintenancePacket.name, {});
		await expect(adventures).resolves.toBeNull();
	});

	it("does not keep the player waiting when Core stays silent", async () => {
		vi.useFakeTimers();
		connect();
		const adventures = coreAccountAdventures("requester", ["discord-user"]);
		await vi.advanceTimersByTimeAsync(5_000);
		await expect(adventures).resolves.toBeNull();
	});

	it("ignores an account preview that arrives after the timeout without notifying the game", async () => {
		vi.useFakeTimers();
		connect();
		const dispatch = vi.spyOn(WebSocketServer, "dispatchPacketsToClient").mockImplementation(() => undefined);
		const adventures = coreAccountAdventures("requester", ["discord-user"]);
		await vi.advanceTimersByTimeAsync(5_000);
		await expect(adventures).resolves.toBeNull();
		await MqttManager.globalMqttClient.onMessage(JSON.stringify({
			context: sentRequest().context,
			packets: [{name: CommandAccountAdventuresRes.name, packet: {adventures: [{keycloakId: "discord-user", level: 42, score: 1000, classId: 3}]}}]
		}));
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("ignores a late internal read error without blocking an existing game session", async () => {
		vi.useFakeTimers();
		connect();
		const dispatch = vi.spyOn(WebSocketServer, "dispatchPacketsToClient").mockImplementation(() => undefined);
		const adventures = coreAccountAdventures("requester", ["discord-user"]);
		await vi.advanceTimersByTimeAsync(5_000);
		await expect(adventures).resolves.toBeNull();
		await MqttManager.globalMqttClient.onMessage(JSON.stringify({
			context: sentRequest().context,
			packets: [{name: ErrorInternalPacket.name, packet: {reason: "Preview unavailable"}}]
		}));
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("continues forwarding ordinary game replies after a preview timed out", async () => {
		vi.useFakeTimers();
		connect();
		const dispatch = vi.spyOn(WebSocketServer, "dispatchPacketsToClient").mockImplementation(() => undefined);
		const adventures = coreAccountAdventures("requester", ["discord-user"]);
		await vi.advanceTimersByTimeAsync(5_000);
		await adventures;
		await MqttManager.globalMqttClient.onMessage(JSON.stringify({
			context: {...sentRequest().context, packetId: "game-request"},
			packets: [{name: BlockedPacket.name, packet: {keycloakId: "requester", reasons: ["Busy"]}}]
		}));
		expect(dispatch).toHaveBeenCalledOnce();
		expect(dispatch.mock.calls[0][0]).toBe("requester");
		expect(dispatch.mock.calls[0][1][0].packet).toMatchObject({reasons: ["Busy"]});
	});
});
