import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { RoyalLetterPacket } from "../../../../Lib/src/packets/events/RoyalLetterPacket";
import { MissionType } from "../../../../Lib/src/types/CompletedMission";
import { APP_STATE_FLAGS } from "../../../../Lib/src/types/AppState";
import { Players } from "../../../src/core/database/game/models/Player";
import { PlayerMissionsInfo } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import {
	appendReveals, keepPendingReveals, pendingRevealsOf, seenFlags, storePendingReveals, withSeen
} from "../../../src/core/appState/AppState";

vi.mock("../../../src/core/database/game/models/Player", () => ({
	Players: { getByKeycloakId: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfo: { withLocked: vi.fn() },
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));

const WEBSOCKET: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "player", webSocket: {}
};
const DISCORD: PacketContext = {
	frontEndOrigin: "discord", frontEndSubOrigin: "", keycloakId: "player", discord: {
		user: "u", channel: "c", interaction: "i", language: "fr", shardId: 0
	}
} as PacketContext;

function letter(): RoyalLetterPacket {
	return makePacket(RoyalLetterPacket, {
		keycloakId: "player", letter: 1, letters: 7, tokens: 20, money: 2000, gems: 0
	});
}

function missions(): MissionsCompletedPacket {
	return makePacket(MissionsCompletedPacket, {
		keycloakId: "player",
		missions: [{ missionId: "commandMission", missionType: MissionType.CAMPAIGN, missionObjective: 1, missionVariant: 0, numberDone: 1, pointsToWin: 0, xpToWin: 10, gemsToWin: 1, moneyToWin: 0 }]
	});
}

describe("app state kept by Core", () => {
	it("stores each flag on its own bit, and never loses one already seen", () => {
		const mask = withSeen(0, ["journeyRecorded", "royalSeal"]);
		expect(seenFlags(mask)).toEqual(["journeyRecorded", "royalSeal"]);
		expect(seenFlags(withSeen(mask, ["royalSeal", "tip.tokens"]))).toEqual(["journeyRecorded", "tip.tokens", "royalSeal"]);
		expect(seenFlags(withSeen(0, [...APP_STATE_FLAGS]))).toEqual([...APP_STATE_FLAGS]);
	});

	it("fits every flag in the INT UNSIGNED column", () => {
		expect(APP_STATE_FLAGS.length).toBeLessThanOrEqual(32);
	});

	it("never gives an id twice, even after the oldest reveals were seen", () => {
		const kept = appendReveals([], [{ letter: letter() }, { missions: missions() }]);
		const afterSeen = kept.filter(reveal => reveal.id !== 1);
		expect(appendReveals(afterSeen, [{ letter: letter() }]).map(reveal => reveal.id)).toEqual([2, 3]);
	});

	it("reads back what it stored, and nothing from a corrupted column", () => {
		const info = { pendingReveals: null as string | null };
		storePendingReveals(info, appendReveals([], [{ letter: letter() }]));
		expect(pendingRevealsOf(info)).toHaveLength(1);
		storePendingReveals(info, []);
		expect(info.pendingReveals).toBeNull();
		expect(pendingRevealsOf({ pendingReveals: "{not json" })).toEqual([]);
	});
});

describe("rewards kept for the app", () => {
	const saved: Array<string | null> = [];

	beforeEach(() => {
		vi.clearAllMocks();
		saved.length = 0;
		vi.mocked(Players.getByKeycloakId).mockResolvedValue({ id: 7 } as never);
		vi.mocked(PlayerMissionsInfo.withLocked).mockImplementation(async (_playerId, body) => {
			const info = {
				pendingReveals: null as string | null,
				save: vi.fn(async (): Promise<void> => {
					saved.push(info.pendingReveals);
				})
			};
			return await body(info as unknown as PlayerMissionsInfo);
		});
	});

	it("keeps the missions and the letter a response to the app credits", async () => {
		await keepPendingReveals(WEBSOCKET, [missions(), letter()]);
		expect(saved).toHaveLength(1);
		expect(pendingRevealsOf({ pendingReveals: saved[0] }).map(reveal => Object.keys(reveal).sort())).toEqual([["id", "missions"], ["id", "letter"]]);
	});

	it("keeps nothing for Discord, which shows everything as it happens", async () => {
		await keepPendingReveals(DISCORD, [missions(), letter()]);
		expect(PlayerMissionsInfo.withLocked).not.toHaveBeenCalled();
	});
});
