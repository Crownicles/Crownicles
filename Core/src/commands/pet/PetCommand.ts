import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	CommandPetPacketReq,
	CommandPetPacketRes,
	CommandPetPetNotFound
} from "../../../../Lib/src/packets/commands/CommandPetPacket";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class PetCommand {
	@commandRequires(CommandPetPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetPacketReq): Promise<void> {
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);
		const pet = await PetEntities.getById(toCheckPlayer.petId);
		if (!pet) {
			response.push(makePacket(CommandPetPetNotFound, {}));
			return;
		}

		response.push(makePacket(CommandPetPacketRes, {
			askedKeycloakId: toCheckPlayer?.keycloakId,
			pet: pet.asOwnedPet()
		}));
	}
}
