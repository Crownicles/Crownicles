import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ExpeditionRewardData } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import { Guilds } from "../database/game/models/Guild";

/**
 * Apply a currency reward to the player if amount is positive
 */
async function applyMoneyReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addMoney({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply experience reward to the player if amount is positive
 */
async function applyExperienceReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addExperience({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply score reward to the player if amount is positive
 */
async function applyScoreReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addScore({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply guild experience reward if applicable
 */
async function applyGuildExperienceReward(
	player: Player,
	response: CrowniclesPacket[],
	guildExperience: number
): Promise<void> {
	if (guildExperience <= 0 || !player.guildId) {
		return;
	}
	const guild = await Guilds.getById(player.guildId);
	if (guild) {
		await guild.addExperience(guildExperience, response, NumberChangeReason.SMALL_EVENT);
		await guild.save();
	}
}

/**
 * Apply expedition rewards to player
 */
export async function applyExpeditionRewards(
	rewards: ExpeditionRewardData,
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	await applyMoneyReward(player, response, rewards.money);
	await applyExperienceReward(player, response, rewards.experience);
	await applyScoreReward(player, response, rewards.points);
	await applyGuildExperienceReward(player, response, rewards.guildExperience);

	// Gems converted to money (gem system not yet implemented)
	const gemBonus = rewards.gems * ExpeditionConstants.GEM_TO_MONEY_FALLBACK_RATE;
	await applyMoneyReward(player, response, gemBonus);

	if (rewards.cloneTalismanFound) {
		player.hasCloneTalisman = true;
	}
}
