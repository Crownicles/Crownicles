import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportBigEventFightResultRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import { FightController } from "../fights/FightController";
import { FightOvertimeBehavior } from "../fights/FightOvertimeBehavior";
import { PlayerFighter } from "../fights/fighter/PlayerFighter";
import { MonsterFighter } from "../fights/fighter/MonsterFighter";
import { MonsterDataController } from "../../data/Monster";
import { ClassDataController } from "../../data/Class";
import { MapLink } from "../../data/MapLink";
import {
	applyOutcomeFightConsequencesUnderLock, OutcomeFight
} from "../../data/events/OutcomeFight";
import { applyOutcomeRandomItem } from "../../data/events/PossibilityOutcome";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { chooseDestination } from "./ReportDestinationService";
import { withLockedPlayerSafe } from "../utils/withLockedPlayerSafe";

/**
 * Where the player goes once the fight is over, as decided by the outcome
 */
export type BigEventFightDestination = {
	newMapLink: MapLink | null;
	allowStayInCity: boolean;
	forceStayInCity: boolean;
};

/**
 * A fight an outcome triggered, with what is needed to display its result and continue the travel
 */
export type PendingBigEventFight = {
	eventId: number;
	possibilityId: string;
	outcomeId: string;
	fight: OutcomeFight;
	destination: BigEventFightDestination;
};

async function chooseBigEventDestinationUnderLock(
	lockedPlayer: Locked<Player>,
	destination: BigEventFightDestination,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const isDead = await lockedPlayer.killIfNeeded(response, NumberChangeReason.BIG_EVENT);
	if (destination.newMapLink || !isDead) {
		await chooseDestination(context, lockedPlayer, destination.newMapLink, response, {
			mainPacket: false,
			allowStayInCity: destination.allowStayInCity,
			forceStayInCity: destination.forceStayInCity
		});
	}
}

async function endBigEventFightUnderLock(
	lockedPlayer: Locked<Player>,
	pending: PendingBigEventFight,
	won: boolean,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const consequences = won ? pending.fight.won : pending.fight.lost;
	const result = await applyOutcomeFightConsequencesUnderLock(consequences, lockedPlayer, response);
	response.push(makePacket(CommandReportBigEventFightResultRes, {
		eventId: pending.eventId,
		possibilityId: pending.possibilityId,
		outcomeId: pending.outcomeId,
		monsterId: pending.fight.monster,
		won,
		...result
	}));
	await applyOutcomeRandomItem(consequences ?? {}, lockedPlayer, context, response);
	await chooseBigEventDestinationUnderLock(lockedPlayer, pending.destination, context, response);
	await lockedPlayer.save();
}

/**
 * Apply the result of the fight and let the player choose their next destination
 */
async function endBigEventFight(
	player: Player,
	pending: PendingBigEventFight,
	won: boolean,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	await PlayerMissionsInfos.getOfPlayer(player.id);
	try {
		await withLockedEntities(
			[Player.lockKey(player.id), PlayerMissionsInfo.lockKey(player.id)] as const,
			([lockedPlayer]) => endBigEventFightUnderLock(lockedPlayer, pending, won, context, response)
		);
	}
	catch (e) {
		if (!(e instanceof LockedRowNotFoundError)) {
			throw e;
		}
		CrowniclesLogger.warn(`endBigEventFight: locked row vanished for player ${player.id} — fight result dropped`);
	}
}

/**
 * Start the fight an outcome of a big event triggered. The player fights with the energy they have left,
 * and chooses their next destination once the fight is over.
 * @param player
 * @param pending - The fight and the outcome that triggered it
 * @param context
 * @param response
 */
export async function startBigEventFight(
	player: Player,
	pending: PendingBigEventFight,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const monster = MonsterDataController.instance.getById(pending.fight.monster);
	const playerClass = ClassDataController.instance.getById(player.class);
	if (!monster || !playerClass) {
		CrowniclesLogger.error(`startBigEventFight: unknown monster ${pending.fight.monster} or class ${player.class} — fight skipped`);
		await withLockedPlayerSafe(player, "startBigEventFight without fight", async lockedPlayer => {
			await chooseBigEventDestinationUnderLock(lockedPlayer, pending.destination, context, response);
			await lockedPlayer.save();
		});
		return;
	}

	const playerFighter = new PlayerFighter(player, playerClass);
	await playerFighter.loadStats(true);

	const fight = new FightController(
		{
			fighter1: playerFighter,
			fighter2: new MonsterFighter(pending.fight.level, monster)
		},
		{
			overtimeBehavior: FightOvertimeBehavior.INCREASE_DAMAGE_PVE,
			context
		}
	);
	fight.setEndCallback(async (endedFight, endFightResponse) => {
		const won = endedFight.isADraw() || endedFight.getWinnerFighter() instanceof PlayerFighter;
		await endBigEventFight(await Players.getById(player.id), pending, won, context, endFightResponse);
	});
	await fight.startFight(response);
}
