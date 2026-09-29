import {
	Player, Players
} from "../database/game/models/Player";
import { Guild } from "../database/game/models/Guild";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { LogsDatabase } from "../database/logs/LogsDatabase";
import { MissionsController } from "../missions/MissionsController";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import {
	GUILD_JOIN_ERRORS, GuildJoinBlocker, RecruitingGuild
} from "../../../../Lib/src/types/GuildRecruitment";

/** A guild can be found and joined on one's own only once its office is built and its doors are open. */
export function isDiscoverable(guild: Guild): boolean {
	return guild.recruitmentOfficeLevel > 0 && guild.recruitmentOpen;
}

function joinBlocker(guild: Guild, memberCount: number, playerScore: number): GuildJoinBlocker | undefined {
	if (memberCount >= GuildConstants.MAX_GUILD_MEMBERS) {
		return GUILD_JOIN_ERRORS.FULL;
	}
	return playerScore < guild.recruitmentMinScore ? GUILD_JOIN_ERRORS.MIN_SCORE : undefined;
}

/** A recruiting guild as a player looking for one sees it, with what stops them from joining. */
export function recruitingGuild(guild: Guild, memberCount: number, playerScore: number): RecruitingGuild {
	const blocker = joinBlocker(guild, memberCount, playerScore);
	return {
		id: guild.id,
		name: guild.name,
		level: guild.level,
		memberCount,
		minScore: guild.recruitmentMinScore,
		...blocker ? { blocker } : {}
	};
}

export const GUILD_ATTACH_RESULTS = {
	OK: "OK",
	ALREADY_IN_GUILD: "alreadyInGuild",
	GUILD_FULL: "guildFull"
} as const;
export type GuildAttachResult = typeof GUILD_ATTACH_RESULTS[keyof typeof GUILD_ATTACH_RESULTS];

/**
 * Adds a player to a guild once both rows are locked, whether invited or joining on their own.
 * Re-checks that the player has not joined another guild and that the guild still has room.
 * @param response
 * @param locked The joining player and the guild, both locked along with the player's missions info
 * @param addedByKeycloakId Who let the player in: the inviting member, or the player itself
 */
export async function attachMemberUnderLock(
	response: CrowniclesPacket[],
	locked: {
		member: Locked<Player>; guild: Locked<Guild>;
	},
	addedByKeycloakId: string
): Promise<GuildAttachResult> {
	const {
		member, guild
	} = locked;
	if (member.hasAGuild()) {
		return GUILD_ATTACH_RESULTS.ALREADY_IN_GUILD;
	}
	if ((await Players.getByGuild(guild.id)).length >= GuildConstants.MAX_GUILD_MEMBERS) {
		return GUILD_ATTACH_RESULTS.GUILD_FULL;
	}

	member.guildId = guild.id;
	guild.updateLastDailyAt();
	await Promise.all([
		member.save(),
		guild.save()
	]);

	LogsDatabase.logGuildJoin(guild, member.keycloakId, addedByKeycloakId)
		.then();
	await MissionsController.update(member, response, { missionId: "joinGuild" });
	await MissionsController.update(member, response, {
		missionId: "guildLevel",
		count: guild.level,
		set: true
	});
	return GUILD_ATTACH_RESULTS.OK;
}
