import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildMissionNoMission,
	CommandGuildMissionPacketReq,
	CommandGuildMissionPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildMissionPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Guilds } from "../../core/database/game/models/Guild";
import { GuildMissionService } from "../../core/missions/GuildMissionService";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";

export default class GuildMissionCommand {
	@commandRequires(CommandGuildMissionPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		guildNeeded: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandGuildMissionPacketReq,
		_context: PacketContext
	): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;

		// Generate a mission if none is active
		GuildMissionService.ensureActiveMission(guild);
		await guild.save();

		if (!guild.guildMissionId) {
			response.push(makePacket(CommandGuildMissionNoMission, {}));
			return;
		}

		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);

		response.push(makePacket(CommandGuildMissionPacketRes, {
			missionId: guild.guildMissionId,
			objective: guild.guildMissionObjective,
			numberDone: guild.guildMissionNumberDone,
			playerContribution: missionInfo.guildMissionContribution,
			expiresAt: guild.guildMissionExpiry!.getTime(),
			completed: GuildMissionService.isMissionCompleted(guild)
		}));
	}
}
