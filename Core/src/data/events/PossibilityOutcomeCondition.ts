import Player from "../../core/database/game/models/Player";
import Guild, { Guilds } from "../../core/database/game/models/Guild";
import { GuildPets } from "../../core/database/game/models/GuildPet";

export interface PossibilityOutcomeCondition {
	canAcceptPet?: boolean;
}

async function verifyConditionCanAcceptPet(condition: PossibilityOutcomeCondition, player: Player): Promise<boolean> {
	if (!condition.canAcceptPet) {
		return true;
	}

	let guild: Guild | null = null;

	// Search for a user's guild

	try {
		guild = await Guilds.getById(player.guildId);
	}
	catch {
		// guild remains null
	}

	const noRoomInGuild = !guild ? true : guild.isPetShelterFull(await GuildPets.getOfGuild(guild.id));

	return !(noRoomInGuild && player.petId !== null);
}

export async function verifyPossibilityOutcomeCondition(condition: PossibilityOutcomeCondition, player: Player): Promise<boolean> {
	return await verifyConditionCanAcceptPet(condition, player);
}
