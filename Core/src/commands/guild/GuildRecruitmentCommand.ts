import {
	Op, WhereOptions
} from "sequelize";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildJoinErrorPacket,
	CommandGuildJoinPacketReq,
	CommandGuildJoinPacketRes,
	CommandGuildRecruitmentErrorPacket,
	CommandGuildRecruitmentListPacketReq,
	CommandGuildRecruitmentListPacketRes,
	CommandGuildRecruitmentPacketReq,
	CommandGuildRecruitmentPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import {
	GUILD_JOIN_ERRORS, GUILD_RECRUITMENT_ERRORS, GuildJoinBlocker, GuildJoinError, RecruitingGuild
} from "../../../../Lib/src/types/GuildRecruitment";
import { GuildRecruitmentConstants } from "../../../../Lib/src/constants/GuildRecruitmentConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Player } from "../../core/database/game/models/Player";
import Guild from "../../core/database/game/models/Guild";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { Maps } from "../../core/maps/Maps";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	attachMemberUnderLock, GUILD_ATTACH_RESULTS
} from "../../core/utils/GuildJoinUtils";

/** Suggestions are picked among more guilds than shown, since some turn out full. */
const SUGGESTION_POOL_FACTOR = 3;

/** A guild shows up in searches and suggestions only once its office is built and its doors are open. */
const DISCOVERABLE: WhereOptions = {
	recruitmentOfficeLevel: { [Op.gt]: 0 },
	recruitmentOpen: true
};

function isDiscoverable(guild: Guild): boolean {
	return guild.recruitmentOfficeLevel > 0 && guild.recruitmentOpen;
}

async function memberCounts(guildIds: number[]): Promise<Map<number, number>> {
	if (guildIds.length === 0) {
		return new Map();
	}
	const rows = await Player.count({
		where: { guildId: guildIds },
		group: ["guildId"]
	});
	return new Map(rows.map(row => [Number(row.guildId), row.count]));
}

function joinBlocker(guild: Guild, memberCount: number, playerScore: number): GuildJoinBlocker | undefined {
	if (memberCount >= GuildConstants.MAX_GUILD_MEMBERS) {
		return GUILD_JOIN_ERRORS.FULL;
	}
	return playerScore < guild.recruitmentMinScore ? GUILD_JOIN_ERRORS.MIN_SCORE : undefined;
}

async function describeGuilds(guilds: Guild[], playerScore: number): Promise<RecruitingGuild[]> {
	const counts = await memberCounts(guilds.map(guild => guild.id));
	return guilds.map(guild => {
		const memberCount = counts.get(guild.id) ?? 0;
		const blocker = joinBlocker(guild, memberCount, playerScore);
		return {
			id: guild.id,
			name: guild.name,
			level: guild.level,
			memberCount,
			minScore: guild.recruitmentMinScore,
			...blocker ? { blocker } : {}
		};
	});
}

/**
 * The guilds a player can join, the most fitting first: those asking the most the player still meets,
 * then the most advanced ones.
 */
async function suggestGuilds(playerScore: number): Promise<RecruitingGuild[]> {
	const candidates = await Guild.findAll({
		where: {
			...DISCOVERABLE,
			recruitmentMinScore: { [Op.lte]: playerScore }
		},
		order: [
			["recruitmentMinScore", "DESC"],
			["level", "DESC"],
			["score", "DESC"]
		],
		limit: GuildRecruitmentConstants.LIST_LIMIT * SUGGESTION_POOL_FACTOR
	});
	return (await describeGuilds(candidates, playerScore))
		.filter(guild => !guild.blocker)
		.slice(0, GuildRecruitmentConstants.LIST_LIMIT);
}

function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, "\\$&");
}

/** Every recruiting guild whose name contains the search, even those the player cannot join yet, so it learns why. */
async function searchGuilds(search: string, playerScore: number): Promise<RecruitingGuild[]> {
	const guilds = await Guild.findAll({
		where: {
			...DISCOVERABLE,
			name: { [Op.like]: `%${escapeLike(search)}%` }
		},
		order: [["level", "DESC"], ["score", "DESC"]],
		limit: GuildRecruitmentConstants.LIST_LIMIT
	});
	return await describeGuilds(guilds, playerScore);
}

function recruitmentError(response: CrowniclesPacket[], error: typeof GUILD_RECRUITMENT_ERRORS[keyof typeof GUILD_RECRUITMENT_ERRORS]): void {
	response.push(makePacket(CommandGuildRecruitmentErrorPacket, { error }));
}

async function applyRecruitmentChangesUnderLock(guild: Locked<Guild>, packet: CommandGuildRecruitmentPacketReq): Promise<boolean> {
	if (guild.recruitmentOfficeLevel === 0) {
		return false;
	}
	if (packet.open !== undefined) {
		guild.recruitmentOpen = packet.open;
	}
	if (packet.minScore !== undefined) {
		guild.recruitmentMinScore = packet.minScore;
	}
	await guild.save();
	return true;
}

function joinError(response: CrowniclesPacket[], error: GuildJoinError, minScore?: number): void {
	response.push(makePacket(CommandGuildJoinErrorPacket, {
		error,
		...minScore === undefined ? {} : { minScore }
	}));
}

async function joinUnderLock(
	response: CrowniclesPacket[],
	member: Locked<Player>,
	guild: Locked<Guild>
): Promise<void> {
	if (!isDiscoverable(guild)) {
		joinError(response, GUILD_JOIN_ERRORS.CLOSED);
		return;
	}
	if (member.score < guild.recruitmentMinScore) {
		joinError(response, GUILD_JOIN_ERRORS.MIN_SCORE, guild.recruitmentMinScore);
		return;
	}
	const result = await attachMemberUnderLock(response, {
		member, guild
	}, member.keycloakId);
	if (result === GUILD_ATTACH_RESULTS.OK) {
		response.push(makePacket(CommandGuildJoinPacketRes, { guildName: guild.name }));
		return;
	}
	joinError(response, result === GUILD_ATTACH_RESULTS.GUILD_FULL ? GUILD_JOIN_ERRORS.FULL : GUILD_JOIN_ERRORS.ALREADY_IN_GUILD);
}

export default class GuildRecruitmentCommand {
	@commandRequires(CommandGuildRecruitmentPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.ELDER,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async settings(response: CrowniclesPacket[], player: Player, packet: CommandGuildRecruitmentPacketReq): Promise<void> {
		if (packet.minScore !== undefined && !GuildRecruitmentConstants.isMinScoreStep(packet.minScore)) {
			recruitmentError(response, GUILD_RECRUITMENT_ERRORS.INVALID_MIN_SCORE);
			return;
		}
		const changed = packet.open !== undefined || packet.minScore !== undefined;
		const guild = await withLockedEntities([Guild.lockKey(player.guildId!)] as const, async ([locked]) => {
			if (changed && !await applyRecruitmentChangesUnderLock(locked, packet)) {
				return null;
			}
			return locked.recruitmentOfficeLevel === 0 ? null : locked;
		});
		if (!guild) {
			recruitmentError(response, GUILD_RECRUITMENT_ERRORS.NO_OFFICE);
			return;
		}
		response.push(makePacket(CommandGuildRecruitmentPacketRes, {
			settings: {
				open: guild.recruitmentOpen,
				minScore: guild.recruitmentMinScore
			},
			changed
		}));
	}

	@commandRequires(CommandGuildRecruitmentListPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async list(response: CrowniclesPacket[], player: Player, packet: CommandGuildRecruitmentListPacketReq): Promise<void> {
		const search = packet.search?.trim().slice(0, GuildRecruitmentConstants.SEARCH_MAX_LENGTH);
		const guilds = search
			? await searchGuilds(search, player.score)
			: await suggestGuilds(player.score);
		response.push(makePacket(CommandGuildRecruitmentListPacketRes, {
			guilds,
			playerScore: player.score,
			...search ? { search } : {}
		}));
	}

	@commandRequires(CommandGuildJoinPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async join(response: CrowniclesPacket[], player: Player, packet: CommandGuildJoinPacketReq): Promise<void> {
		if (player.hasAGuild()) {
			joinError(response, GUILD_JOIN_ERRORS.ALREADY_IN_GUILD);
			return;
		}
		if (Maps.isOnPveIsland(player) || Maps.isOnBoat(player)) {
			joinError(response, GUILD_JOIN_ERRORS.ON_ISLAND);
			return;
		}
		await PlayerMissionsInfos.getOfPlayer(player.id);
		try {
			await withLockedEntities(
				[
					Player.lockKey(player.id),
					Guild.lockKey(packet.guildId),
					PlayerMissionsInfo.lockKey(player.id)
				] as const,
				async ([member, guild]) => await joinUnderLock(response, member, guild)
			);
		}
		catch (error) {
			if (error instanceof LockedRowNotFoundError) {
				joinError(response, GUILD_JOIN_ERRORS.NOT_FOUND);
				return;
			}
			throw error;
		}
	}
}
