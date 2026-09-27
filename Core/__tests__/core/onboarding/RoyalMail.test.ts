import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type { Player } from "../../../src/core/database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import { deliverRoyalLetter } from "../../../src/core/onboarding/RoyalMail";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn(() => Promise.resolve(null))
}));

const NOW = new Date(2026, 8, 27, 18);
const YESTERDAY = new Date(2026, 8, 26, 18);
const EARLIER_TODAY = new Date(2026, 8, 27, 9);

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
		expect(await reportWith(mail(OnboardingConstants.ROYAL_MAIL.LETTERS, YESTERDAY))).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("does not lock a newcomer again once today's letter is read", async () => {
		expect(await reportWith(mail(2, EARLIER_TODAY))).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("locks the newcomer when the first report starts the count or a new day brings a letter", async () => {
		await reportWith(mail(0, null));
		await reportWith(mail(2, YESTERDAY));
		expect(withLockedPlayerAndMissions).toHaveBeenCalledTimes(2);
	});
});
