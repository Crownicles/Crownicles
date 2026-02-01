import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import {
	CommandPetNickPacketReq,
	CommandPetNickPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { checkNameString } from "../../../../Lib/src/utils/StringUtils";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import Player from "../../core/database/game/models/Player";
import { crowniclesInstance } from "../../index";


export default class PetNickCommand {
	@commandRequires(CommandPetNickPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetNickPacketReq): Promise<void> {
		const playerPet = await PetEntities.getById(player.petId);

		if (!playerPet) {
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: false
			}));
			return;
		}

		const newPetNickName = packet.newNickname;

		if (!newPetNickName) {
			// No nickname provided, reset the nickname to None
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: true,
				newNickname: undefined,
				nickNameIsAcceptable: true
			}));
		}
		else {
			if (!checkNameString(newPetNickName, PetConstants.NICKNAME_LENGTH_RANGE)) {
				response.push(makePacket(CommandPetNickPacketRes, {
					foundPet: true,
					newNickname: newPetNickName,
					nickNameIsAcceptable: false
				}));
				return;
			}
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: true,
				newNickname: newPetNickName,
				nickNameIsAcceptable: true
			}));
		}

		playerPet.nickname = newPetNickName ?? "";
		await playerPet.save();

		crowniclesInstance.logsDatabase.logPetNickname(playerPet).then();
	}
}
