import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandPetExpeditionPacketRes, CommandPetExpeditionResolvePacketRes} from "../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {ReactionCollectorPetExpeditionChoice} from "../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import PetExpeditionServerTranslator from "../../src/packets/fromServer/translators/PetExpeditionServerTranslator";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const PET = {petTypeId: 1, petSex: "m" as const, petNickname: "Aster"};
const OPTION = {id: "exp-one", mapLocationId: 12, locationType: "forest" as const, durationMinutes: 123, displayDurationMinutes: 130, riskRate: 25, difficulty: 40, foodCost: 3, rewardIndex: 4, hasBonusTokens: true};

describe("pet expeditions over WebSocket", () => {
	it("keeps selection indexes and gives display categories without internal durations", () => {
		const source = new ReactionCollectorPetExpeditionChoice({pet: PET, expeditions: [OPTION], hasGuild: true, guildFoodAmount: 10}).creationPacket("exp", 1_900_000_000_000);
		const result = mapCollectorCreation(JSON.parse(JSON.stringify(source)));
		expect(result.reactions).toEqual([{type: "expeditionSelect", data: {expeditionId: "exp-one"}}, {type: "expeditionCancel", data: {}}]);
		expect(result.data).toMatchObject({type: "expeditionChoice", data: {hasGuild: true, guildFoodAmount: 10, expeditions: [{displayDurationMinutes: 130, foodCost: 3, hasBonusTokens: true}]}});
		expect(JSON.stringify(result)).not.toContain("riskRate");
		expect(JSON.stringify(result)).not.toContain('"durationMinutes"');
	});

	it("never exposes current hidden love points in a start refusal", async () => {
		const result = await PetExpeditionServerTranslator.status(CONTEXT, makePacket(CommandPetExpeditionPacketRes, {hasTalisman: true, hasExpeditionInProgress: false, canStartExpedition: false, cannotStartReason: "insufficientLove", petLovePoints: 7, pet: PET}));
		expect(result.cannotStartReason).toBe("insufficientLove");
		expect(result).not.toHaveProperty("petLovePoints");
	});

	it("preserves granted rewards and strips the server-only wealth multiplier", async () => {
		const rewards = {money: 53, points: 37, experience: 29, tokens: 2, materialLoot: [{materialId: 12, quantity: 3}]};
		const result = await PetExpeditionServerTranslator.resolved(CONTEXT, makePacket(CommandPetExpeditionResolvePacketRes, {success: true, partialSuccess: true, totalFailure: false, rewards, loveChange: 2, pet: PET, expedition: {...OPTION, wealthRate: 1.9}, petLikedExpedition: true}));
		expect(result.rewards).toEqual(rewards);
		expect(result.expedition).toEqual({locationType: "forest", mapLocationId: 12});
	});
});