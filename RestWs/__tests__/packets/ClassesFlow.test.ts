import { describe, expect, it } from "vitest";
import { makePacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorChangeClass } from "../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { CommandClassesChangeSuccessPacket, CommandClassesCooldownErrorPacket } from "../../../Lib/src/packets/commands/CommandClassesPacket";
import { CommandClassesInfoPacketRes } from "../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import { RequirementLevelPacket } from "../../../Lib/src/packets/commands/requirements/RequirementLevelPacket";
import { RequirementEffectPacket } from "../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import ClassesCommandServerTranslator from "../../src/packets/fromServer/translators/ClassesCommandServerTranslator";
import CommandRequirementsServerTranslator from "../../src/packets/fromServer/translators/CommandRequirementsServerTranslator";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated", webSocket: {}};

describe("classes over WebSocket", () => {
	it("keeps available classes and refusal at their original indexes", () => {
		const details = {id: 7, energy: 300, attack: 100, defense: 90, speed: 80, initialBreath: 4, maxBreath: 12, breathRegen: 3, health: 200};
		const offered = new ReactionCollectorChangeClass([details], 604800).creationPacket("classes", 1_900_000_000_000);
		const result = mapCollectorCreation(JSON.parse(JSON.stringify(offered)));
		expect(result.reactions).toEqual([{type: "chooseClass", data: {classId: 7}}, {type: "refuse", data: {}}]);
		expect(result.data).toEqual({type: "classes", data: {classesDetails: [details], cooldownSeconds: 604800}});
	});

	it("transports every statistic and attack from the class comparison", async () => {
		const packet = makePacket(CommandClassesInfoPacketRes, {data: {classesStats: [{id: 7, stats: {health: 10, attack: 20, defense: 30, speed: 40, fightPoint: 50, baseBreath: 3, maxBreath: 10, breathRegen: 2, classGroup: 1, classKind: "attack"}, attacks: [{id: "simpleAttack", cost: 3}]}]}});
		expect(JSON.parse(JSON.stringify(await ClassesCommandServerTranslator.info(CONTEXT, packet)))).toEqual({data: packet.data});
	});

	it("preserves the authoritative chosen class and absolute cooldown", async () => {
		expect(await ClassesCommandServerTranslator.success(CONTEXT, makePacket(CommandClassesChangeSuccessPacket, {classId: 7}))).toMatchObject({classId: 7});
		expect(await ClassesCommandServerTranslator.cooldown(CONTEXT, makePacket(CommandClassesCooldownErrorPacket, {timestamp: 1_900_000_000_000}))).toMatchObject({timestamp: 1_900_000_000_000});
	});

	it("forwards level and effect refusals instead of losing the command response", async () => {
		expect(await CommandRequirementsServerTranslator.level(CONTEXT, makePacket(RequirementLevelPacket, {requiredLevel: 10}))).toMatchObject({rejection: {type: "level", requiredLevel: 10}});
		expect(await CommandRequirementsServerTranslator.effect(CONTEXT, makePacket(RequirementEffectPacket, {currentEffectId: "sleep", remainingTime: 60_000}))).toMatchObject({rejection: {type: "effect", currentEffectId: "sleep", remainingTime: 60_000}});
	});
});