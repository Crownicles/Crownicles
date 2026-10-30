import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandDefenseCancelPacketRes,
	CommandDefenseChangeSuccessPacketRes,
	CommandDefenseNoChoicePacketRes,
	CommandDefensePacketReq
} from "../../../../Lib/src/packets/commands/CommandDefensePacket";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import {
	ReactionCollectorDefensePersonality,
	ReactionCollectorDefensePersonalityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { getAiPersonalities } from "../../core/fights/AiBehaviorController";
import { withLockedPlayerSafe } from "../../core/utils/withLockedPlayerSafe";
import { AiPersonality } from "../../../../Lib/src/constants/AiPersonalityConstants";

/**
 * Save the defense personality picked by the player, or a random one at each fight when none is picked
 * @param player
 * @param personality
 * @param response
 */
async function saveDefensePersonality(player: Player, personality: AiPersonality | undefined, response: CrowniclesPacket[]): Promise<void> {
	await withLockedPlayerSafe(player, "defense personality change", async lockedPlayer => {
		// The class may have changed since the choice was displayed
		const isValid = personality === undefined || getAiPersonalities(lockedPlayer.class).includes(personality);
		if (!isValid) {
			response.push(makePacket(CommandDefenseCancelPacketRes, {}));
			return;
		}
		lockedPlayer.defensePersonality = personality ?? null;
		await lockedPlayer.save();
		response.push(makePacket(CommandDefenseChangeSuccessPacketRes, personality ? { personality } : {}));
	});
}

function getEndCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		try {
			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type !== ReactionCollectorDefensePersonalityReaction.name) {
				response.push(makePacket(CommandDefenseCancelPacketRes, {}));
				return;
			}
			await saveDefensePersonality(player, (reaction.reaction.data as ReactionCollectorDefensePersonalityReaction).personality, response);
		}
		finally {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DEFENSE_PERSONALITY);
		}
	};
}

export default class DefenseCommand {
	@commandRequires(CommandDefensePacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: FightConstants.REQUIRED_LEVEL,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[], player: Player, _packet: CommandDefensePacketReq, context: PacketContext): void {
		const personalities = getAiPersonalities(player.class);
		if (personalities.length < 2) {
			response.push(makePacket(CommandDefenseNoChoicePacketRes, { classId: player.class }));
			return;
		}

		// A personality kept from a previous class is not the one defending the player anymore
		const currentPersonality = player.defensePersonality && personalities.includes(player.defensePersonality)
			? player.defensePersonality
			: undefined;

		const packet = new ReactionCollectorInstance(
			new ReactionCollectorDefensePersonality(player.class, personalities, currentPersonality),
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.DEFENSE_PERSONALITY)
			.build();

		response.push(packet);
	}
}
