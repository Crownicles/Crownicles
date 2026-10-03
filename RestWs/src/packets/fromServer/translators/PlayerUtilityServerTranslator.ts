import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandRespawnPacketRes, CommandRespawnErrorAlreadyAlive
} from "../../../../../Lib/src/packets/commands/CommandRespawnPacket";
import {
	CommandUnlockAcceptPacketRes, CommandUnlockRefusePacketRes, CommandUnlockHimself, CommandUnlockNoPlayerFound, CommandUnlockNotInJail, CommandUnlockNotEnoughMoney
} from "../../../../../Lib/src/packets/commands/CommandUnlockPacket";
import {
	CommandJoinBoatAcceptPacketRes, CommandJoinBoatRefusePacketRes, CommandJoinBoatNoGuildPacketRes,
	CommandJoinBoatNoMemberOnBoatPacketRes, CommandJoinBoatNotEnoughEnergyPacketRes, CommandJoinBoatNotEnoughGemsPacketRes,
	CommandJoinBoatNotTravellingPacketRes, CommandJoinBoatTooManyRunsPacketRes
} from "../../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { CommandUpdatePacketRes } from "../../../../../Lib/src/packets/commands/CommandUpdatePacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	PLAYER_UTILITY_ERRORS, PlayerUtilityError
} from "../../../../../WsPackets/src/objects/PlayerUtility";
import {
	PlayerUtilityRes, VersionRes
} from "../../../../../WsPackets/src/fromServer/common/PlayerUtilityRes";
import { resolvePlayerName } from "../PlayerDisplay";

function failure(error: PlayerUtilityError): Promise<PlayerUtilityRes> {
	return asyncMakeFromServerPacket(PlayerUtilityRes, { outcome: {
		type: "error", error
	} });
}

export default class PlayerUtilityServerTranslator {
	@fromServerTranslator(CommandRespawnPacketRes, PlayerUtilityRes)
	public static respawn(_context: PacketContext, packet: CommandRespawnPacketRes): Promise<PlayerUtilityRes> {
		return asyncMakeFromServerPacket(PlayerUtilityRes, { outcome: {
			type: "respawn", lostScore: packet.lostScore
		} });
	}

	@fromServerTranslator(CommandUnlockAcceptPacketRes, PlayerUtilityRes)
	public static async unlock(_context: PacketContext, packet: CommandUnlockAcceptPacketRes): Promise<PlayerUtilityRes> {
		const playerName = await resolvePlayerName(packet.unlockedKeycloakId);
		return asyncMakeFromServerPacket(PlayerUtilityRes, { outcome: {
			type: "unlocked", ...playerName ? { playerName } : {}
		} });
	}

	@fromServerTranslator(CommandJoinBoatAcceptPacketRes, PlayerUtilityRes)
	public static boat(_context: PacketContext, packet: CommandJoinBoatAcceptPacketRes): Promise<PlayerUtilityRes> {
		return asyncMakeFromServerPacket(PlayerUtilityRes, { outcome: {
			type: "boat", score: packet.score
		} });
	}

	@fromServerTranslator(CommandUnlockNotEnoughMoney, PlayerUtilityRes)
	public static money(_context: PacketContext, packet: CommandUnlockNotEnoughMoney): Promise<PlayerUtilityRes> {
		return asyncMakeFromServerPacket(PlayerUtilityRes, { outcome: {
			type: "money", money: packet.money
		} });
	}

	@fromServerTranslator(CommandUpdatePacketRes, VersionRes)
	public static version(_context: PacketContext, packet: CommandUpdatePacketRes): Promise<VersionRes> {
		return asyncMakeFromServerPacket(VersionRes, { coreVersion: packet.coreVersion });
	}

	@fromServerTranslator(CommandRespawnErrorAlreadyAlive, PlayerUtilityRes)
	public static alive(_context: PacketContext, _packet: CommandRespawnErrorAlreadyAlive): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.ALREADY_ALIVE); }

	@fromServerTranslator(CommandUnlockNoPlayerFound, PlayerUtilityRes)
	public static notFound(_context: PacketContext, _packet: CommandUnlockNoPlayerFound): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NO_PLAYER); }

	@fromServerTranslator(CommandUnlockNotInJail, PlayerUtilityRes)
	public static notJailed(_context: PacketContext, _packet: CommandUnlockNotInJail): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NOT_JAILED); }

	@fromServerTranslator(CommandUnlockHimself, PlayerUtilityRes)
	public static self(_context: PacketContext, _packet: CommandUnlockHimself): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.SELF); }

	@fromServerTranslator(CommandUnlockRefusePacketRes, PlayerUtilityRes)
	public static refusedUnlock(_context: PacketContext, _packet: CommandUnlockRefusePacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.CANCELLED); }

	@fromServerTranslator(CommandJoinBoatRefusePacketRes, PlayerUtilityRes)
	public static refusedBoat(_context: PacketContext, _packet: CommandJoinBoatRefusePacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.CANCELLED); }

	@fromServerTranslator(CommandJoinBoatNoGuildPacketRes, PlayerUtilityRes)
	public static noGuild(_context: PacketContext, _packet: CommandJoinBoatNoGuildPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NO_GUILD); }

	@fromServerTranslator(CommandJoinBoatNoMemberOnBoatPacketRes, PlayerUtilityRes)
	public static noBoat(_context: PacketContext, _packet: CommandJoinBoatNoMemberOnBoatPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NO_MEMBER_ON_BOAT); }

	@fromServerTranslator(CommandJoinBoatTooManyRunsPacketRes, PlayerUtilityRes)
	public static runs(_context: PacketContext, _packet: CommandJoinBoatTooManyRunsPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.TOO_MANY_RUNS); }

	@fromServerTranslator(CommandJoinBoatNotEnoughEnergyPacketRes, PlayerUtilityRes)
	public static energy(_context: PacketContext, _packet: CommandJoinBoatNotEnoughEnergyPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NO_ENERGY); }

	@fromServerTranslator(CommandJoinBoatNotEnoughGemsPacketRes, PlayerUtilityRes)
	public static gems(_context: PacketContext, _packet: CommandJoinBoatNotEnoughGemsPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NO_GEMS); }

	@fromServerTranslator(CommandJoinBoatNotTravellingPacketRes, PlayerUtilityRes)
	public static travel(_context: PacketContext, _packet: CommandJoinBoatNotTravellingPacketRes): Promise<PlayerUtilityRes> { return failure(PLAYER_UTILITY_ERRORS.NOT_TRAVELLING); }
}
