import Player from "../../core/database/game/models/Player";
import Guild, { Guilds } from "../../core/database/game/models/Guild";
import { GuildPets } from "../../core/database/game/models/GuildPet";
import { Maps } from "../../core/maps/Maps";

async function verifyConditionCanAcceptPet(condition: PossibilityCondition, player: Player): Promise<boolean> {
	if (!condition.canAcceptPet) {
		return true;
	}

	let guild: Guild | null;

	// Search for a user's guild
	try {
		guild = await Guilds.getById(player.guildId) ?? null;
	}
	catch {
		guild = null;
	}

	const noRoomInGuild = !guild ? true : guild.isPetShelterFull(await GuildPets.getOfGuild(guild.id));

	return !(noRoomInGuild && player.petId !== null);
}

export async function verifyPossibilityCondition(condition: PossibilityCondition, player: Player): Promise<boolean> {
	return player.level >= (condition.level ?? 0)
		&& (!condition.canGoBack || Maps.getGoBackMapLink(player) !== null)
		&& await verifyConditionCanAcceptPet(condition, player);
}

export interface PossibilityCondition {
	level?: number;
	canAcceptPet?: boolean;

	/**
	 * Only offer this possibility when the player may actually go back to the map they come from.
	 */
	canGoBack?: boolean;
}
