import { Player, Players } from "../database/game/models/Player";
import { PlayerMissionsInfo } from "../database/game/models/PlayerMissionsInfo";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { RoyalLetterPacket } from "../../../../Lib/src/packets/events/RoyalLetterPacket";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { datesAreOnSameDay } from "../../../../Lib/src/utils/TimeUtils";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";

const { ROYAL_MAIL } = OnboardingConstants;

/** The letter the king writes today, if one is due. */
export function dueRoyalLetter(info: Pick<PlayerMissionsInfo, "royalLettersReceived" | "lastRoyalLetterAt">, now: Date): number | null {
	if (info.royalLettersReceived >= ROYAL_MAIL.LETTERS || !info.lastRoyalLetterAt) {
		return null;
	}
	return datesAreOnSameDay(info.lastRoyalLetterAt, now) || info.lastRoyalLetterAt > now ? null : info.royalLettersReceived + 1;
}

/**
 * Records today's letter under the missions row lock, so two reports racing on the same day
 * cannot both receive it. The first report ever only starts the count: the first letter
 * comes the next day.
 */
async function claimRoyalLetterUnderLock(info: Locked<PlayerMissionsInfo>, keycloakId: string, now: Date): Promise<number | null> {
	if (!info.lastRoyalLetterAt && info.royalLettersReceived < ROYAL_MAIL.LETTERS) {
		info.lastRoyalLetterAt = now;
		await info.save();
		return null;
	}
	const letter = dueRoyalLetter(info, now);
	if (letter === null) {
		return null;
	}
	info.royalLettersReceived = letter;
	info.lastRoyalLetterAt = now;
	await info.save();
	if (letter === ROYAL_MAIL.LETTERS) {
		await info.addGems(ROYAL_MAIL.FINAL_GEMS, keycloakId, NumberChangeReason.ROYAL_MAIL);
	}
	return letter;
}

/** Delivers the king's letter of the day to a newcomer, with its gifts, during their first week. */
export async function deliverRoyalLetter(player: Player, response: CrowniclesPacket[], now = new Date()): Promise<void> {
	const letter = await PlayerMissionsInfo.withLocked(player.id, info => claimRoyalLetterUnderLock(info, player.keycloakId, now));
	if (letter === null) {
		return;
	}
	const tokens = await player.addTokensAndGetActualGain({
		amount: ROYAL_MAIL.TOKENS,
		response,
		reason: NumberChangeReason.ROYAL_MAIL
	});
	await player.addMoney({
		amount: ROYAL_MAIL.MONEY,
		response,
		reason: NumberChangeReason.ROYAL_MAIL,
		ignoreBlessing: true
	});
	const [rank, rankedPlayers] = await Promise.all([Players.getRankById(player.id), Players.getNbPlayersHaveStartedTheAdventure()]);
	response.push(makePacket(RoyalLetterPacket, {
		keycloakId: player.keycloakId,
		letter,
		letters: ROYAL_MAIL.LETTERS,
		tokens,
		money: ROYAL_MAIL.MONEY,
		gems: letter === ROYAL_MAIL.LETTERS ? ROYAL_MAIL.FINAL_GEMS : 0,
		...rank <= rankedPlayers ? {
			rank, rankedPlayers
		} : {}
	}));
}
