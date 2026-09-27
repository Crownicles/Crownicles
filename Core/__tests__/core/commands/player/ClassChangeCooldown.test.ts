import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { secondsToMilliseconds } from "../../../../../Lib/src/utils/TimeUtils";
import type { Player } from "../../../../src/core/database/game/models/Player";
import type { MissionSlot } from "../../../../src/core/database/game/models/MissionSlot";
import { MissionSlots } from "../../../../src/core/database/game/models/MissionSlot";
import { LogsReadRequests } from "../../../../src/core/database/logs/LogsReadRequests";
import { classChangeCooldownUntil } from "../../../../src/commands/player/ClassChangeCooldown";

vi.mock("../../../../src/core/database/game/models/MissionSlot", () => ({
	MissionSlots: {getCampaignOfPlayer: vi.fn()}
}));
vi.mock("../../../../src/core/database/logs/LogsReadRequests", () => ({
	LogsReadRequests: {getLastTimeThePlayerHasEditedHisClass: vi.fn()}
}));
vi.mock("../../../../src/data/Class", () => ({
	ClassDataController: {instance: {getById: vi.fn(() => ({classGroup: 0}))}}
}));

const RECRUIT = ClassConstants.CLASSES_ID.RECRUIT;

function player(classId: number): Player {
	return {id: 1, class: classId, keycloakId: "reset-newcomer"} as Player;
}

function campaign(missionId: string, completed = false): MissionSlot {
	return {missionId, isCompleted: (): boolean => completed} as MissionSlot;
}

describe("class choice during the royal contest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(MissionSlots.getCampaignOfPlayer).mockResolvedValue(campaign("chooseClass"));
		vi.mocked(LogsReadRequests.getLastTimeThePlayerHasEditedHisClass).mockResolvedValue(new Date());
	});

	it("allows a recruit on the first class mission despite class-change logs from a reset profile", async () => {
		expect(await classChangeCooldownUntil(player(RECRUIT))).toBeNull();
		expect(LogsReadRequests.getLastTimeThePlayerHasEditedHisClass).not.toHaveBeenCalled();
	});

	it("retains the cooldown before the class mission and once it is completed", async () => {
		const changedAt = new Date();
		vi.mocked(LogsReadRequests.getLastTimeThePlayerHasEditedHisClass).mockResolvedValue(changedAt);
		vi.mocked(MissionSlots.getCampaignOfPlayer).mockResolvedValue(campaign("commandMap"));
		expect(await classChangeCooldownUntil(player(RECRUIT)))
			.toBe(changedAt.valueOf() + secondsToMilliseconds(ClassConstants.TIME_BEFORE_CHANGE_CLASS[0]));

		vi.mocked(MissionSlots.getCampaignOfPlayer).mockResolvedValue(campaign("chooseClass", true));
		expect(await classChangeCooldownUntil(player(RECRUIT))).toBeGreaterThan(Date.now());
	});

	it("retains the cooldown for an experienced class even if a class mission is pending", async () => {
		expect(await classChangeCooldownUntil(player(ClassConstants.CLASSES_ID.ESQUIRE))).toBeGreaterThan(Date.now());
	});

	it("has no cooldown when no class change was ever recorded", async () => {
		vi.mocked(MissionSlots.getCampaignOfPlayer).mockResolvedValue(campaign("travelHours"));
		vi.mocked(LogsReadRequests.getLastTimeThePlayerHasEditedHisClass).mockResolvedValue(new Date(0));
		expect(await classChangeCooldownUntil(player(RECRUIT))).toBeNull();
	});
});