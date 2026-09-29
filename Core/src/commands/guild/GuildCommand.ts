import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	CommandGuildPacketReq, CommandGuildPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildPacket";
import { Maps } from "../../core/maps/Maps";
import {
	guildProbationEnd, isDiscoverable, recruitingGuild
} from "../../core/utils/GuildJoinUtils";

function probationField(member: Player, guild: Guild): { probationEndsAt?: number } {
	const end = guildProbationEnd(member, guild);
	return end ? { probationEndsAt: end } : {};
}
import { MapCache } from "../../core/maps/MapCache";
import { CityDataController } from "../../data/City";
import {
	GuildDomainStanding, GuildMembership
} from "../../../../Lib/src/types/GuildMembership";
import { GuildMember } from "../../../../Lib/src/types/GuildMember";
import { RecruitingGuild } from "../../../../Lib/src/types/GuildRecruitment";
import { GuildDailyConstants } from "../../../../Lib/src/constants/GuildDailyConstants";
import {
	dateToMs, hoursToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

/**
 * Where the guild domain stands for the asking player, so a front-end can lock its entrance and say why.
 */
function buildDomainStanding(player: Player, guild: Guild): GuildDomainStanding {
	const mapLocationId = guild.domainCityId ? CityDataController.instance.getById(guild.domainCityId)?.maps[0] : undefined;
	return {
		established: guild.domainCityId !== null,
		isInCity: player.insideCity && player.getCurrentCityId() === guild.domainCityId,
		...mapLocationId === undefined ? {} : { mapLocationId }
	};
}

/**
 * What the guild only tells its own members, so a front-end can lock its buttons and say why beforehand.
 */
function buildMembership(player: Player, guild: Guild, members: GuildMember[]): GuildMembership {
	return {
		treasury: guild.treasury,
		daily: {
			availableAt: dateToMs(guild.lastDailyAt) + hoursToMilliseconds(GuildDailyConstants.TIME_BETWEEN_DAILIES),
			blockedByIsland: members.some(member => member.islandStatus.isOnPveIsland)
		},
		domain: buildDomainStanding(player, guild)
	};
}

async function findAskedGuild(askedGuildName: string | undefined, toCheckPlayer: Player | null): Promise<Guild | null> {
	if (askedGuildName) {
		try {
			return await Guilds.getByName(askedGuildName);
		}
		catch {
			return null;
		}
	}
	return toCheckPlayer?.guildId ? await Guilds.getById(toCheckPlayer.guildId) : null;
}

async function describeMembers(guild: Guild, toCheckPlayer: Player): Promise<GuildMember[]> {
	const members = await Players.getByGuild(guild.id);
	const membersPveAlliesIds = (await Maps.getGuildMembersOnPveIsland(toCheckPlayer)).map(player => player.id);
	return await Promise.all(
		members.map(async member => ({
			id: member.id,
			keycloakId: member.keycloakId,
			rank: await Players.getRankById(member.id),
			score: member.score,
			islandStatus: {
				isOnPveIsland: Maps.isOnPveIsland(member),
				isOnBoat: MapCache.boatEntryMapLinks.includes(member.mapLinkId),
				isPveIslandAlly: membersPveAlliesIds.includes(member.id),
				cannotBeJoinedOnBoat: member.isNotActiveEnoughToBeJoinedInTheBoat()
			},
			...probationField(member, guild)
		}))
	);
}

/** What depends on who is looking: their own standing in their guild, or how a guild recruiting them can be joined. */
function viewerFields(player: Player, guild: Guild, members: GuildMember[]): {
	membership?: GuildMembership; recruitment?: RecruitingGuild;
} {
	if (player.guildId === guild.id) {
		return { membership: buildMembership(player, guild, members) };
	}
	return !player.hasAGuild() && isDiscoverable(guild) ? { recruitment: recruitingGuild(guild, members.length, player.score) } : {};
}

export default class GuildCommand {
	@commandRequires(CommandGuildPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildPacketReq): Promise<void> {
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);
		const guild = await findAskedGuild(packet.askedGuildName, toCheckPlayer);
		if (!guild || !toCheckPlayer) {
			response.push(makePacket(CommandGuildPacketRes, {
				foundGuild: false
			}));
			return;
		}

		const rank = await guild.getRanking();
		const guildMembers = await describeMembers(guild, toCheckPlayer);
		response.push(makePacket(CommandGuildPacketRes, {
			foundGuild: true,
			askedPlayerKeycloakId: toCheckPlayer.keycloakId,
			data: {
				name: guild.name,
				description: guild.guildDescription,
				chiefId: guild.chiefId,
				elderId: guild.elderId,
				level: guild.level,
				isMaxLevel: guild.isAtMaxLevel(),
				experience: {
					value: guild.experience,
					max: guild.getExperienceNeededToLevelUp()
				},
				rank: {
					unranked: rank > -1,
					rank,
					numberOfGuilds: await Guilds.getTotalRanked(),
					score: guild.score
				},
				members: guildMembers,
				...viewerFields(player, guild, guildMembers)
			}
		}));
	}
}
