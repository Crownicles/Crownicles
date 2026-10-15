import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandDailyBonusInCooldown, CommandDailyBonusPacketRes, CommandDailyBonusPacketReq} from "../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import {ItemNature} from "../../../Lib/src/constants/ItemConstants";
import {ReactionCollectorDailyBonus} from "../../../Lib/src/packets/interaction/ReactionCollectorDailyBonus";
import {DailyBonusReq} from "../../../WsPackets/src/fromClient/DailyBonusReq";
import {DAILY_BONUS_REACTION_KINDS, GENERIC_REACTION_KINDS} from "../../../WsPackets/src/fromServer/collectors";
import DailyBonusCommandClientTranslator from "../../src/packets/fromClient/translators/DailyBonusCommandClientTranslator";
import DailyBonusCommandServerTranslator from "../../src/packets/fromServer/translators/DailyBonusCommandServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}};

describe("daily bonus over WebSocket", () => {
	it("opens Core's existing daily command", async () => {
		expect(await DailyBonusCommandClientTranslator.open(CONTEXT, new DailyBonusReq())).toBeInstanceOf(CommandDailyBonusPacketReq);
	});

	it("keeps usable objects and refusal at their server indexes", () => {
		const offered = new ReactionCollectorDailyBonus([{id: 3, itemCategory: 3, rarity: 1, nature: ItemNature.HEALTH, power: 25, maxPower: 25}]).creationPacket("daily", 1_900_000_000_000);
		const mapped = mapCollectorCreation(JSON.parse(JSON.stringify(offered)));
		expect(mapped.reactions).toEqual([{type: DAILY_BONUS_REACTION_KINDS.OBJECT, data: {object: {id: 3, itemCategory: 3, rarity: 1, nature: ItemNature.HEALTH, power: 25, maxPower: 25}}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]);
	});

	it("preserves cooldown hours and the absolute last-use timestamp", async () => {
		const result = await DailyBonusCommandServerTranslator.cooldown(CONTEXT, makePacket(CommandDailyBonusInCooldown, {timeBetweenDailies: 22, lastDailyTimestamp: 1_900_000_000_000}));
		expect(JSON.parse(JSON.stringify(result))).toEqual({cooldownHours: 22, lastDailyTimestamp: 1_900_000_000_000});
	});

	it.each([ItemNature.MONEY, ItemNature.HEALTH, ItemNature.ENERGY, ItemNature.TIME_SPEEDUP])("keeps the server-applied effect %s", async itemNature => {
		const result = await DailyBonusCommandServerTranslator.success(CONTEXT, makePacket(CommandDailyBonusPacketRes, {itemNature, value: 25}));
		expect(JSON.parse(JSON.stringify(result))).toEqual({itemNature, value: 25});
	});
});
