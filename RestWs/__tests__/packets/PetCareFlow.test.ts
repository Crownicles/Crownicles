import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandPetFeedNoPetErrorPacket, CommandPetFeedNotHungryErrorPacket, CommandPetFeedResult, CommandPetFeedSuccessPacket} from "../../../Lib/src/packets/commands/CommandPetFeedPacket";
import {ReactionCollectorPetFeedWithoutGuild} from "../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import {PetFood} from "../../../Lib/src/types/PetFood";
import {PetNickReq} from "../../../WsPackets/src/fromClient/PetCareReq";
import PetCareClientTranslator from "../../src/packets/fromClient/translators/PetCareClientTranslator";
import PetCareServerTranslator from "../../src/packets/fromServer/translators/PetCareServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const PET = {typeId: 1, sex: "m" as const, rarity: 1, loveLevel: 3, force: 10, feedDelay: 2, nickname: "Compagnon"};

describe("pet care commands", () => {
	it("binds nickname writes to the authenticated identity, including clearing", async () => {
		const packet = Object.assign(new PetNickReq(), {newNickname: "Aster", keycloakId: "other-player"});
		expect(await PetCareClientTranslator.nickname(CONTEXT, packet)).toMatchObject({keycloakId: "authenticated", newNickname: "Aster"});
		const cleared = await PetCareClientTranslator.nickname(CONTEXT, new PetNickReq());
		expect(JSON.parse(JSON.stringify(cleared))).toEqual({keycloakId: "authenticated"});
	});

	it("keeps Core's feed price and confirmation indexes", () => {
		const result = mapCollectorCreation(new ReactionCollectorPetFeedWithoutGuild(PET, PetFood.CANDY, 42).creationPacket("feed", 1_900_000_000_000));
		expect(result.data).toEqual({type: "petFeedPersonal", data: {pet: PET, food: "commonFood", price: 42}});
		expect(result.reactions.map(reaction => reaction.type)).toEqual(["accept", "refuse"]);
	});

	it("transports success and the pet used in a satiety refusal", async () => {
		expect(await PetCareServerTranslator.fed(CONTEXT, makePacket(CommandPetFeedSuccessPacket, {result: CommandPetFeedResult.DISLIKE}))).toMatchObject({outcome: {success: true, result: "dislike"}});
		expect(await PetCareServerTranslator.notHungry(CONTEXT, makePacket(CommandPetFeedNotHungryErrorPacket, {pet: PET}))).toMatchObject({outcome: {success: false, error: "notHungry", pet: PET}});
		expect(await PetCareServerTranslator.noPet(CONTEXT, makePacket(CommandPetFeedNoPetErrorPacket, {}))).toMatchObject({outcome: {success: false, error: "noPet"}});
	});
});