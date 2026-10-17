import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandFriendlyFightErrorPacketRes,
	CommandFriendlyFightPacketReq,
	FRIENDLY_FIGHT_ERRORS,
	FriendlyFightError
} from "../../../../Lib/src/packets/commands/CommandFriendlyFightPacket";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { ClassDataController } from "../../data/Class";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { AiPlayerFighter } from "../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";

/**
 * Check that the asked opponent can be fought, returning the reason why not otherwise
 * @param player
 * @param opponent
 */
function getOpponentError(player: Player, opponent: Player): FriendlyFightError | null {
	if (!opponent.hasStartedToPlay()) {
		return FRIENDLY_FIGHT_ERRORS.OPPONENT_NOT_FOUND;
	}
	if (opponent.id === player.id) {
		return FRIENDLY_FIGHT_ERRORS.SELF_FIGHT;
	}
	if (opponent.level < FightConstants.REQUIRED_LEVEL) {
		return FRIENDLY_FIGHT_ERRORS.OPPONENT_LEVEL_TOO_LOW;
	}
	return null;
}

export default class FriendlyFightCommand {
	@commandRequires(CommandFriendlyFightPacketReq, {
		notBlocked: true,
		whereAllowed: [WhereAllowed.CONTINENT],
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: FightConstants.REQUIRED_LEVEL
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandFriendlyFightPacketReq, context: PacketContext): Promise<void> {
		const opponent = await Players.getAskedPlayer(packet.askedPlayer, player);
		if (!opponent) {
			response.push(makePacket(CommandFriendlyFightErrorPacketRes, { error: FRIENDLY_FIGHT_ERRORS.OPPONENT_NOT_FOUND }));
			return;
		}
		const error = getOpponentError(player, opponent);
		if (error) {
			response.push(makePacket(CommandFriendlyFightErrorPacketRes, { error }));
			return;
		}

		const playerClass = ClassDataController.instance.getById(player.class);
		const opponentClass = ClassDataController.instance.getById(opponent.class);
		if (!playerClass || !opponentClass) {
			throw new Error("Class not found for friendly fight player or opponent");
		}

		const askingFighter = new PlayerFighter(player, playerClass, { withoutConsequences: true });
		askingFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
		await askingFighter.loadStats();

		const incomingFighter = new AiPlayerFighter(opponent, opponentClass, {
			allowPotionConsumption: false,
			withoutConsequences: true
		});
		incomingFighter.setFightRole(FightConstants.FIGHT_ROLES.DEFENDER);
		await incomingFighter.loadStats();

		// No end callback: a friendly fight is neither logged nor rewarded
		await new FightController(
			{
				fighter1: askingFighter,
				fighter2: incomingFighter
			},
			{
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
				context,
				friendly: true
			}
		).startFight(response);
	}
}
