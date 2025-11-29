import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ExpeditionRewardData } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import { Guilds } from "../database/game/models/Guild";

/**
 * Apply expedition rewards to player
 */
export async function applyExpeditionRewards(
	rewards: ExpeditionRewardData,
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	if (rewards.money > 0) {
		await player.addMoney({
			amount: rewards.money,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
	}

	if (rewards.experience > 0) {
		await player.addExperience({
			amount: rewards.experience,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
	}

	if (rewards.points > 0) {
		await player.addScore({
			amount: rewards.points,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
	}

	if (rewards.guildExperience > 0 && player.guildId) {
		const guild = await Guilds.getById(player.guildId);
		if (guild) {
			await guild.addExperience(rewards.guildExperience, response, NumberChangeReason.SMALL_EVENT);
			await guild.save();
		}
	}

	/*
	 * Gems handled separately (need gem system)
	 * For now, convert gems to money bonus
	 */
	if (rewards.gems > 0) {
		await player.addMoney({
			amount: rewards.gems * ExpeditionConstants.GEM_TO_MONEY_FALLBACK_RATE,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
	}

	if (rewards.cloneTalismanFound) {
		player.hasCloneTalisman = true;
	}
}
