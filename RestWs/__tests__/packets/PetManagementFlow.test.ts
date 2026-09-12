import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandPetFreeAcceptPacketRes} from "../../../Lib/src/packets/commands/CommandPetFreePacket";
import {ReactionCollectorPetTransfer, ReactionCollectorPetTransferWithdrawReaction} from "../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import {ReactionCollectorPetFree} from "../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import {ReactionCollectorRefuseReaction} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {PetFreeReq} from "../../../WsPackets/src/fromClient/PetManagementReq";
import PetManagementClientTranslator from "../../src/packets/fromClient/translators/PetManagementClientTranslator";
import PetManagementServerTranslator from "../../src/packets/fromServer/translators/PetManagementServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const PET = {typeId: 1, sex: "m" as const, nickname: "Aster", rarity: 1, loveLevel: 3, force: 10, feedDelay: 2};
describe("pet ownership management", () => {
	it("authenticates free requests without trusting a client identity", async () => {
		expect(await PetManagementClientTranslator.free(CONTEXT, Object.assign(new PetFreeReq(), {keycloakId: "other"}))).toMatchObject({keycloakId: "authenticated"});
	});
	it("keeps shelter entity IDs and reaction positions", () => {
		const result = mapCollectorCreation(new ReactionCollectorPetTransfer(PET, [{petEntityId: 42, pet: PET}], [makePacket(ReactionCollectorRefuseReaction, {}), makePacket(ReactionCollectorPetTransferWithdrawReaction, {petEntityId: 42})]).creationPacket("transfer", 1_900_000_000_000));
		expect(result.reactions).toEqual([{type: "refuse", data: {}}, {type: "petWithdraw", data: {petEntityId: 42}}]);
	});
	it("presents the server cost before free confirmation and after success", async () => {
		const collector = mapCollectorCreation(new ReactionCollectorPetFree(1, "m", "Aster", 1000).creationPacket("free", 1_900_000_000_000));
		expect(collector.data).toMatchObject({type: "petFreeConfirm", data: {freeCost: 1000, isFromShelter: false}});
		const result = await PetManagementServerTranslator.freed(CONTEXT, makePacket(CommandPetFreeAcceptPacketRes, {petId: 1, petSex: "m", petNickname: "Aster", freeCost: 1000, luckyMeat: true}));
		expect(result.outcome).toEqual({type: "freed", pet: {petTypeId: 1, petSex: "m", petNickname: "Aster"}, freeCost: 1000, luckyMeat: true, isFromShelter: false});
	});
});