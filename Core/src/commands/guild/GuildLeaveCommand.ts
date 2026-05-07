import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	CommandGuildLeaveAcceptPacketRes,
	CommandGuildLeaveNotInAGuildPacketRes,
	CommandGuildLeavePacketReq,
	CommandGuildLeaveRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import { ReactionCollectorGuildLeave } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { crowniclesInstance } from "../../index";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { PacketUtils } from "../../core/utils/PacketUtils";
import { GuildStatusChangeNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Outcome of the in-lock leave-flow body. Lets the outer caller
 * dispatch the right response packet without re-deriving state
 * outside of the critical section.
 */
type LeaveOutcome =
	| {
		kind: "notInGuild";
	}
	| {
		kind: "chiefPromotedElder" | "guildDestroyed" | "left";
	};

/**
 * Promote the locked elder to chief and detach the locked
 * leaving chief. The three rows (chief, elder, guild) are
 * already held under \`SELECT ... FOR UPDATE\` so the swap commits
 * atomically.
 */
async function applyChiefPromotesElder(
	response: CrowniclesPacket[],
	locked: {
		chief: Player; elder: Player; guild: Guild;
	}
): Promise<void> {
	const {
		chief, elder, guild
	} = locked;

	crowniclesInstance?.logsDatabase.logGuildElderRemove(guild, elder.id)
		.then();
	crowniclesInstance?.logsDatabase.logGuildChiefChange(guild, elder.id)
		.then();

	chief.guildId = null;
	guild.elderId = null;
	guild.chiefId = elder.id;

	response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
		newChiefKeycloakId: elder.keycloakId,
		guildName: guild.name
	}));

	await Promise.all([
		elder.save(),
		guild.save(),
		chief.save()
	]);

	PacketUtils.sendNotifications([
		makePacket(GuildStatusChangeNotificationPacket, {
			keycloakId: elder.keycloakId,
			becomeChief: true,
			guildName: guild.name
		})
	]);
}

/**
 * Detach a non-chief player from the locked guild. Also clears
 * the elder slot when the leaving member is the elder.
 */
async function applyMemberLeavesGuild(
	response: CrowniclesPacket[],
	locked: {
		player: Player; guild: Guild;
	}
): Promise<void> {
	const {
		player, guild
	} = locked;

	if (guild.elderId === player.id) {
		crowniclesInstance?.logsDatabase.logGuildElderRemove(guild, guild.elderId)
			.then();
		guild.elderId = null;
	}

	LogsDatabase.logGuildLeave(guild, player.keycloakId)
		.then();
	player.guildId = null;

	response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
		guildName: guild.name
	}));
	await Promise.all([
		player.save(),
		guild.save()
	]);
}

/**
 * Predicate that captures the "the elder we snapshotted at
 * prompt time is still the elder of this guild on the locked
 * row" rule, so the lock body can stay flat.
 */
function isStillThePromotableElder(
	guild: Guild,
	elder: Player | undefined,
	expectedElderId: number | null
): elder is Player {
	if (elder === undefined) {
		return false;
	}
	return guild.elderId === elder.id && guild.elderId === expectedElderId;
}

/**
 * In-lock body shared by both lock paths. Re-validates that the
 * leaving player still belongs to the guild we read at prompt
 * time, then dispatches to the correct sub-flow (chief promotes
 * elder / chief destroys guild / regular leave).
 */
async function applyLockedAcceptGuildLeave(
	response: CrowniclesPacket[],
	locked: {
		player: Player; guild: Guild; elder?: Player;
	},
	expected: {
		guildId: number; elderId: number | null;
	}
): Promise<LeaveOutcome> {
	const {
		player, guild, elder
	} = locked;

	if (player.guildId !== expected.guildId) {
		return { kind: "notInGuild" };
	}

	const isChief = player.id === guild.chiefId;
	const elderStillElder = isStillThePromotableElder(guild, elder, expected.elderId);

	if (isChief && elderStillElder) {
		await applyChiefPromotesElder(response, {
			chief: player, elder, guild
		});
		return { kind: "chiefPromotedElder" };
	}

	if (isChief) {
		const guildName = guild.name;
		await guild.completelyDestroyAndDeleteFromTheDatabase();
		response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
			guildName,
			isGuildDestroyed: true
		}));
		return { kind: "guildDestroyed" };
	}

	await applyMemberLeavesGuild(response, {
		player, guild
	});
	return { kind: "left" };
}

/**
 * Allow the player to leave its guild. Locks the player + guild
 * (and the elder when the chief is leaving with a successor)
 * with \`withLockedEntities\` so a concurrent leave / kick /
 * promotion cannot leave the guild orphaned, with two chiefs, or
 * promote a stale elder.
 *
 * @param player
 * @param response
 */
async function acceptGuildLeave(player: Player, response: CrowniclesPacket[]): Promise<void> {
	const fresh = await Players.getById(player.id);

	if (fresh.guildId === null) {
		response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
		return;
	}

	const guildSnapshot = await Guilds.getById(fresh.guildId);
	if (!guildSnapshot) {
		response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
		return;
	}

	const elderIdAtRead = fresh.id === guildSnapshot.chiefId ? guildSnapshot.elderId : null;

	try {
		const outcome = elderIdAtRead !== null
			? await withLockedEntities(
				[
					Player.lockKey(fresh.id),
					Player.lockKey(elderIdAtRead),
					Guild.lockKey(guildSnapshot.id)
				] as const,
				async ([
					lockedPlayer,
					lockedElder,
					lockedGuild
				]) => await applyLockedAcceptGuildLeave(
					response,
					{
						player: lockedPlayer, guild: lockedGuild, elder: lockedElder
					},
					{
						guildId: guildSnapshot.id, elderId: elderIdAtRead
					}
				)
			)
			: await withLockedEntities(
				[Player.lockKey(fresh.id), Guild.lockKey(guildSnapshot.id)] as const,
				async ([lockedPlayer, lockedGuild]) => await applyLockedAcceptGuildLeave(
					response,
					{
						player: lockedPlayer, guild: lockedGuild
					},
					{
						guildId: guildSnapshot.id, elderId: null
					}
				)
			);

		if (outcome.kind === "notInGuild") {
			response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * Either the guild was destroyed concurrently or the
			 * elder candidate row vanished. Either way the leave
			 * is moot: surface the same "not in a guild" outcome.
			 */
			response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
			return;
		}
		throw error;
	}
}

function endCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptGuildLeave(player, response);
		}
		else {
			response.push(makePacket(CommandGuildLeaveRefusePacketRes, {}));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_LEAVE);
	};
}
export default class GuildLeaveCommand {
	@commandRequires(CommandGuildLeavePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandGuildLeavePacketReq, context: PacketContext): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;
		const newChief = guild.chiefId === player.id && guild.elderId ? await Players.getById(guild.elderId) : null;

		const collector = new ReactionCollectorGuildLeave(
			guild.name,
			guild.chiefId === player.id && guild.elderId === null,
			newChief?.keycloakId ?? ""
		);

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_LEAVE)
			.build();

		response.push(collectorPacket);
	}
}
