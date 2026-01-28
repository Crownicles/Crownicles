import { SmallEventFuncs } from "../../data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Guilds } from "../database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventWinGuildXPPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinGuildXPPacket";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		const guild = await Guilds.getById(player.guildId);
		return Boolean(guild && !guild.isAtMaxLevel());
	},
	executeSmallEvent: async (response, player): Promise<void> => {
		const guild = await Guilds.getById(player.guildId);
		if (!guild) {
			return;
		}
		const xpWon = RandomUtils.crowniclesRandom.integer(
			SmallEventConstants.GUILD_EXPERIENCE.MIN + guild.level,
			SmallEventConstants.GUILD_EXPERIENCE.MAX + guild.level * 2
		);
		await guild.addExperience(xpWon, response, NumberChangeReason.SMALL_EVENT);
		await guild.save();
		response.push(makePacket(SmallEventWinGuildXPPacket, {
			amount: xpWon,
			guildName: guild.name
		}));
	}
};
