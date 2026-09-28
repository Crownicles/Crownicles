import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type { Player } from "../../../src/core/database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import {
	deliverRoyalLetter, dueRoyalLetter
} from "../../../src/core/onboarding/RoyalMail";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn(() => Promise.resolve(null))
}));

const NOW = new Date(2026, 8, 27, 18);
const HOUR_MS = 3_600_000;
const { DELAYS_HOURS } = OnboardingConstants.ROYAL_MAIL;

function hoursBeforeNow(hours: number): Date {
	return new Date(NOW.valueOf() - hours * HOUR_MS);
}

function mail(royalLettersReceived: number, lastRoyalLetterAt: Date | null): PlayerMissionsInfo {
	return {
		royalLettersReceived, lastRoyalLetterAt
	} as PlayerMissionsInfo;
}

async function reportWith(info: PlayerMissionsInfo): Promise<CrowniclesPacket[]> {
	vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue(info);
	const response: CrowniclesPacket[] = [];
	await deliverRoyalLetter({ id: 1 } as Player, response, NOW);
	return response;
}

describe("royal mail on each report", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("leaves a player who read the whole week alone, without locking them", async () => {
		expect(await reportWith(mail(OnboardingConstants.ROYAL_MAIL.LETTERS, hoursBeforeNow(48)))).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("does not lock a newcomer again before the next letter's delay has passed", async () => {
		expect(await reportWith(mail(2, hoursBeforeNow(DELAYS_HOURS[2] - 1)))).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("locks the newcomer when the first report starts the count or a letter's delay has passed", async () => {
		await reportWith(mail(0, null));
		await reportWith(mail(2, hoursBeforeNow(DELAYS_HOURS[2])));
		expect(withLockedPlayerAndMissions).toHaveBeenCalledTimes(2);
	});

	it("writes the first letters within hours, then waits longer between the later ones", () => {
		expect(DELAYS_HOURS).toHaveLength(OnboardingConstants.ROYAL_MAIL.LETTERS);
		expect(DELAYS_HOURS[0]).toBeLessThanOrEqual(1);
		DELAYS_HOURS.slice(1).forEach((delay, index) => expect(delay).toBeGreaterThanOrEqual(DELAYS_HOURS[index]));
		expect(dueRoyalLetter(mail(0, hoursBeforeNow(DELAYS_HOURS[0])), NOW)).toBe(1);
		expect(dueRoyalLetter(mail(3, hoursBeforeNow(DELAYS_HOURS[1])), NOW)).toBeNull();
	});
});
