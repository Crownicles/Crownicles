import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { PetEntities } from "../database/game/models/PetEntity";
import { Guilds } from "../database/game/models/Guild";
import { PET_ENTITY_GIVE_RETURN } from "../../../../Lib/src/constants/PetConstants";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindPetPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player): Promise<void> => {
		const pet = PetEntities.generateRandomPetEntityNotGuild();
		let guild;

		// Search if the user has a guild
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}

		// Give pet to player
		const giveReturn = await pet.giveToPlayer(player, response);

		response.push(makePacket(SmallEventFindPetPacket, {
			isPetReceived: giveReturn !== PET_ENTITY_GIVE_RETURN.NO_SLOT, // No pet received because of lack of space
			petIsReceivedByGuild: giveReturn === PET_ENTITY_GIVE_RETURN.GUILD, // Give to the guild or the player
			isPetFood: RandomUtils.crowniclesRandom.bool() && Boolean(guild), // 50 % chance if the player is in a guild
			petTypeID: pet.typeId,
			petSex: pet.sex
		}));
	}
};
