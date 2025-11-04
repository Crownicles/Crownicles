import {
	CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	CommandPetCaressPacketReq
} from "../../../../Lib/src/packets/commands/CommandPetPacket";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { MissionsController } from "../../core/missions/MissionsController";

export default class PetCaressCommand {
	@commandRequires(CommandPetCaressPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandPetCaressPacketReq): Promise<void> {
		await MissionsController.update(player, response, { missionId: "petCaress" });
	}
}
