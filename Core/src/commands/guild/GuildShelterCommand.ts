import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandGuildShelterNoPetErrorPacket,
	CommandGuildShelterPacketReq, CommandGuildShelterPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import { GuildPets } from "../../core/database/game/models/GuildPet";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { Guilds } from "../../core/database/game/models/Guild";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";

export default class GuildShelterCommand {
	@commandRequires(CommandGuildShelterPacketReq, {
		notBlocked: false,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		const pets = await GuildPets.getOfGuild(player.guildId);

		if (pets.length === 0) {
			response.push(makePacket(CommandGuildShelterNoPetErrorPacket, {}));
			return;
		}

		const ownedPets = [];
		for (const pet of pets) {
			ownedPets.push((await PetEntities.getById(pet.petEntityId))!.asOwnedPet());
		}

		response.push(makePacket(CommandGuildShelterPacketRes, {
			pets: ownedPets,
			guildName: (await Guilds.getById(player.guildId))!.name,
			maxCount: PetConstants.SLOTS
		}));
	}
}
