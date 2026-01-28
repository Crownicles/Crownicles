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
import { MapCache } from "../../core/maps/MapCache";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class GuildCommand {
	@commandRequires(CommandGuildPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildPacketReq): Promise<void> {
		let guild: Guild | null = null;
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);
		if (packet.askedGuildName) {
			try {
				guild = await Guilds.getByName(packet.askedGuildName);
			}
			catch {
				guild = null;
			}
		}
		else if (toCheckPlayer?.guildId) {
			guild = await Guilds.getById(toCheckPlayer.guildId);
		}

		if (!guild || !toCheckPlayer) {
			response.push(makePacket(CommandGuildPacketRes, {
				foundGuild: false
			}));
		}
		else {
			const members = await Players.getByGuild(guild.id);
			const rank = await guild.getRanking();
			const numberOfGuilds = await Guilds.getTotalRanked();
			const membersPveAlliesIds = (await Maps.getGuildMembersOnPveIsland(toCheckPlayer)).map(player => player.id);
			const isUnranked = rank > -1;

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
						unranked: isUnranked,
						rank,
						numberOfGuilds,
						score: guild.score
					},
					members: await Promise.all(
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
							}
						}))
					)
				}
			}));
		}
	}
}
