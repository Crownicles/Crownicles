import {
	Player, Players
} from "../database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { RoyalLetterPacket } from "../../../../Lib/src/packets/events/RoyalLetterPacket";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { datesAreOnSameDay } from "../../../../Lib/src/utils/TimeUtils";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedPlayerAndMissions } from "../utils/withLockedPlayerAndMissions";

const { ROYAL_MAIL } = OnboardingConstants;

type RoyalLetterClaim = {
	letter: number; tokens: number;
};

/** The letter the king writes today, if one is due. */
export function dueRoyalLetter(info: Pick<PlayerMissionsInfo, "royalLettersReceived" | "lastRoyalLetterAt">, now: Date): number | null {
	if (info.royalLettersReceived >= ROYAL_MAIL.LETTERS || !info.lastRoyalLetterAt) {
		return null;
	}
	return datesAreOnSameDay(info.lastRoyalLetterAt, now) || info.lastRoyalLetterAt > now ? null : info.royalLettersReceived + 1;
}

/** The letter and its gifts commit together; the first report only starts the daily count. */
async function claimRoyalLetterUnderLock(
	player: Locked<Player>,
	info: Locked<PlayerMissionsInfo>,
	response: CrowniclesPacket[],
	now: Date
): Promise<RoyalLetterClaim | null> {
	if (!info.lastRoyalLetterAt && info.royalLettersReceived < ROYAL_MAIL.LETTERS) {
		info.lastRoyalLetterAt = now;
		await info.save();
		return null;
	}
	const letter = dueRoyalLetter(info, now);
	if (letter === null) {
		return null;
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
	await info.reload();
	if (letter === ROYAL_MAIL.LETTERS) {
		await info.addGems(ROYAL_MAIL.FINAL_GEMS, player.keycloakId, NumberChangeReason.ROYAL_MAIL);
	}
	info.royalLettersReceived = letter;
	info.lastRoyalLetterAt = now;
	await info.save();
	return {
		letter, tokens
	};
}

/** Delivers the king's letter of the day to a newcomer, with its gifts, during their first week. */
export async function deliverRoyalLetter(player: Player, response: CrowniclesPacket[], now = new Date()): Promise<void> {
	const rewardPackets: CrowniclesPacket[] = [];
	const delivered = await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
		const info = await PlayerMissionsInfos.getOfPlayer(player.id);
		const claim = await claimRoyalLetterUnderLock(lockedPlayer, info, rewardPackets, now);
		return claim
			? {
				...claim, updatedPlayer: lockedPlayer
			}
			: null;
	});
	if (!delivered) {
		return;
	}
	Object.assign(player, delivered.updatedPlayer);
	response.push(...rewardPackets);
	let placement: {
		rank: number; rankedPlayers: number;
	} | undefined;
	try {
		const [rank, rankedPlayers] = await Promise.all([Players.getRankById(player.id), Players.getNbPlayersHaveStartedTheAdventure()]);
		if (rank <= rankedPlayers) {
			placement = {
				rank, rankedPlayers
			};
		}
	}
	catch (error) {
		console.warn("Could not include the contest ranking in the royal letter:", error);
	}
	response.push(makePacket(RoyalLetterPacket, {
		keycloakId: player.keycloakId,
		letter: delivered.letter,
		letters: ROYAL_MAIL.LETTERS,
		tokens: delivered.tokens,
		money: ROYAL_MAIL.MONEY,
		gems: delivered.letter === ROYAL_MAIL.LETTERS ? ROYAL_MAIL.FINAL_GEMS : 0,
		...placement ? placement : {}
	}));
}
