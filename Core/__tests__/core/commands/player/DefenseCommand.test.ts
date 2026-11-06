import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import DefenseCommand from "../../../../src/commands/player/DefenseCommand";
import { initializeAllClassBehaviors } from "../../../../src/core/fights/AiBehaviorController";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { AiPersonalityConstants } from "../../../../../Lib/src/constants/AiPersonalityConstants";
import {
	ReactionCollectorDefensePersonality,
	ReactionCollectorDefensePersonalityReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import { ReactionCollectorRefuseReaction } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandDefenseCancelPacketRes,
	CommandDefenseChangeSuccessPacketRes,
	CommandDefenseNoChoicePacketRes
} from "../../../../../Lib/src/packets/commands/CommandDefensePacket";

type CapturedCollector = {
	collector: ReactionCollectorDefensePersonality;
	endCallback: (collector: unknown, response: unknown[]) => Promise<void>;
};

const captured: { value?: CapturedCollector } = {};
const lockedPlayer = {
	class: 0,
	defensePersonality: null as string | null,
	save: vi.fn()
};

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		ALLOWED_EFFECTS: { NO_EFFECT: [] },
		WHERE: { EVERYWHERE: [] }
	}
}));
vi.mock("../../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(collector: ReactionCollectorDefensePersonality, _context: unknown, _options: unknown, endCallback: CapturedCollector["endCallback"]) {
			captured.value = {
				collector, endCallback
			};
		}

		block(): this {
			return this;
		}

		build(): { collector: true } {
			return { collector: true };
		}
	}
}));
vi.mock("../../../../src/core/utils/withLockedPlayerSafe", () => ({
	withLockedPlayerSafe: (_player: unknown, _context: string, body: (player: typeof lockedPlayer) => Promise<void>) => body(lockedPlayer)
}));
vi.mock("../../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: { unblockPlayer: vi.fn() }
}));

// Hoisted above the imports, hence the raw id of the gunner class
const { RECENT_DEFENSES, getRecentDefenses } = vi.hoisted(() => {
	const recentDefenses = [
		{
			attackerClassId: 11, defenses: 3, won: 1
		}
	];
	return {
		RECENT_DEFENSES: recentDefenses,
		getRecentDefenses: vi.fn(() => Promise.resolve(recentDefenses))
	};
});
vi.mock("../../../../src/core/database/logs/requests/LogsFightHistoryRequests", () => ({
	LogsFightHistoryRequests: { getRecentDefensesByAttackerClass: getRecentDefenses }
}));

const PERSONALITIES = AiPersonalityConstants.PERSONALITIES;

async function execute(classId: number, defensePersonality: string | null = null): Promise<unknown[]> {
	const response: unknown[] = [];
	await new DefenseCommand().execute(response as never, {
		class: classId, defensePersonality, keycloakId: "keycloak"
	} as never, {} as never, {} as never);
	return response;
}

async function react(data: { type: string; personality?: string }): Promise<unknown[]> {
	const response: unknown[] = [];
	const reaction = {
		reaction: {
			type: data.type, data: data.personality ? { personality: data.personality } : {}
		}
	};
	await captured.value!.endCallback({ getFirstReaction: () => reaction }, response);
	return response;
}

describe("DefenseCommand", () => {
	beforeEach(() => {
		initializeAllClassBehaviors();
		captured.value = undefined;
		lockedPlayer.class = ClassConstants.CLASSES_ID.VALIANT_KNIGHT;
		lockedPlayer.defensePersonality = null;
		lockedPlayer.save.mockClear();
	});

	it("tells a player whose class has a single way to fight that there is nothing to choose", async () => {
		const response = await execute(ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN);

		expect(response[0]).toBeInstanceOf(CommandDefenseNoChoicePacketRes);
		expect(captured.value).toBeUndefined();
	});

	it("offers the personalities of the class of the player, with the current one", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, PERSONALITIES.KNIGHT_FIERY);
		const packet = captured.value!.collector.creationPacket("id", 0);
		const personalities = packet.reactions
			.filter(reaction => reaction.type === ReactionCollectorDefensePersonalityReaction.name)
			.map(reaction => (reaction.data as ReactionCollectorDefensePersonalityReaction).personality);

		expect(personalities).toEqual([PERSONALITIES.KNIGHT_STRATEGIST, PERSONALITIES.KNIGHT_ENDURING, PERSONALITIES.KNIGHT_FIERY, undefined]);
		expect(packet.data.data.currentPersonality).toBe(PERSONALITIES.KNIGHT_FIERY);
	});

	it("does not present a personality kept from a previous class as the current one", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, PERSONALITIES.TANK_RIPOSTE);

		expect(captured.value!.collector.creationPacket("id", 0).data.data.currentPersonality).toBeUndefined();
	});

	it("shows the recent defenses of the player, to help it pick the style resisting its attackers", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);

		expect(getRecentDefenses).toHaveBeenCalledWith("keycloak", AiPersonalityConstants.RECENT_DEFENSES_DAYS);
		expect(captured.value!.collector.creationPacket("id", 0).data.data.recentDefenses).toEqual(RECENT_DEFENSES);
	});

	it("saves the picked personality", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);
		const response = await react({
			type: ReactionCollectorDefensePersonalityReaction.name, personality: PERSONALITIES.KNIGHT_ENDURING
		});

		expect(lockedPlayer.defensePersonality).toBe(PERSONALITIES.KNIGHT_ENDURING);
		expect(lockedPlayer.save).toHaveBeenCalled();
		expect(response[0]).toBeInstanceOf(CommandDefenseChangeSuccessPacketRes);
		expect((response[0] as CommandDefenseChangeSuccessPacketRes).personality).toBe(PERSONALITIES.KNIGHT_ENDURING);
	});

	it("goes back to a random personality at each fight", async () => {
		lockedPlayer.defensePersonality = PERSONALITIES.KNIGHT_ENDURING;
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);
		const response = await react({ type: ReactionCollectorDefensePersonalityReaction.name });

		expect(lockedPlayer.defensePersonality).toBeNull();
		expect((response[0] as CommandDefenseChangeSuccessPacketRes).personality).toBeUndefined();
	});

	it("does not save a personality that no longer matches the class of the player", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);
		lockedPlayer.class = ClassConstants.CLASSES_ID.IMPENETRABLE_TANK;
		const response = await react({
			type: ReactionCollectorDefensePersonalityReaction.name, personality: PERSONALITIES.KNIGHT_ENDURING
		});

		expect(lockedPlayer.save).not.toHaveBeenCalled();
		expect(response[0]).toBeInstanceOf(CommandDefenseCancelPacketRes);
	});

	it("keeps the personality when the player refuses", async () => {
		await execute(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);
		const response = await react({ type: ReactionCollectorRefuseReaction.name });

		expect(lockedPlayer.save).not.toHaveBeenCalled();
		expect(response[0]).toBeInstanceOf(CommandDefenseCancelPacketRes);
	});
});
