import {
	afterEach, beforeEach, vi
} from "vitest";
import type Player from "../../../src/core/database/game/models/Player";
import type { PlayerActiveObjects } from "../../../src/core/database/game/models/PlayerActiveObjects";
import type { SmallEventFuncs } from "../../../src/data/SmallEvent";
import { ReactionCollectorInstance } from "../../../src/core/utils/ReactionsCollector";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";
import type { EditValueParameters } from "../../../src/core/database/game/EditValueParameters";
import { asPlayer } from "../ModelStubs";

/**
 * Shared harness of the small event tests (#5165): a player fixture whose value mutators update its state like the
 * real model does (before blessings and missions), the collector of the small event driven through the real
 * `ReactionCollectorInstance`, and helpers to read the answered packets.
 *
 * The test files still have to mock, with `vi.mock` (hoisted per file), the lock helper so the critical section runs
 * on the fixture: see {@link lockedPlayerPassthrough}.
 */

export type TestPlayer = {
	id: number;
	keycloakId: string;
	level: number;
	class: number;
	money: number;
	health: number;
	experience: number;
	score: number;
	rage: number;
	tokens: number;
	petId: number | null;
	guildId: number | null;
	mapLinkId: number;
	addMoney: ReturnType<typeof vi.fn>;
	spendMoney: ReturnType<typeof vi.fn>;
	addHealth: ReturnType<typeof vi.fn>;
	addExperience: ReturnType<typeof vi.fn>;
	addScore: ReturnType<typeof vi.fn>;
	addRage: ReturnType<typeof vi.fn>;
	addTokens: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
	getMaxHealth: ReturnType<typeof vi.fn>;
	getMaxStatsValue: ReturnType<typeof vi.fn>;
};

type NumericField = "money" | "health" | "experience" | "score" | "rage" | "tokens";

/**
 * Build a player whose `addX` methods change the matching field by the amount they receive
 */
export function createTestPlayer(overrides: Partial<Omit<TestPlayer, NumericField | "id">> & Partial<Pick<TestPlayer, NumericField | "id">> = {}): TestPlayer {
	const player = {
		id: 1,
		keycloakId: "keycloak-1",
		level: 50,
		class: 0,
		money: 1000,
		health: 100,
		experience: 0,
		score: 0,
		rage: 0,
		tokens: 0,
		petId: null,
		guildId: null,
		mapLinkId: 1,
		...overrides
	} as TestPlayer;
	const mutate = (field: NumericField) => vi.fn((parameters: EditValueParameters): Promise<TestPlayer> => {
		player[field] += parameters.amount;
		return Promise.resolve(player);
	});
	player.addMoney = mutate("money");
	player.addHealth = mutate("health");
	player.addExperience = mutate("experience");
	player.addScore = mutate("score");
	player.addRage = mutate("rage");
	player.addTokens = mutate("tokens");
	player.spendMoney = vi.fn((parameters: EditValueParameters): Promise<TestPlayer> => {
		player.money -= Math.abs(parameters.amount);
		return Promise.resolve(player);
	});
	player.save = vi.fn().mockResolvedValue(player);
	player.getMaxHealth = vi.fn().mockReturnValue(100);
	player.getMaxStatsValue = vi.fn().mockReturnValue({
		attack: 100, defense: 100, speed: 100
	});
	return player;
}

export { asPlayer };

/**
 * Body of the `vi.mock` factory of `withLockedPlayerAndMissionsSafe`: the critical section receives the caller's player,
 * which stands for the re-fetched locked row
 */
export function lockedPlayerPassthrough(player: Player, _context: string, body: (lockedPlayer: Player) => Promise<void>): Promise<void> {
	return body(player);
}

export const TEST_CONTEXT: PacketContext = {
	frontEndOrigin: "test",
	frontEndSubOrigin: "test",
	keycloakId: "keycloak-1"
};

export type SmallEventRun = {
	response: CrowniclesPacket[];
	collector: ReactionCollectorInstance | undefined;
};

/**
 * Instant the small events of the tests happen at
 */
export const TEST_NOW = new Date(2026, 10, 14, 12, 0, 0);

let builtCollectors: ReactionCollectorInstance[] = [];

/**
 * Register the hooks of the harness: fake clock and collector timers, capture of the built collectors
 */
export function useSmallEventHarness(): void {
	beforeEach(() => {
		builtCollectors = [];
		for (const [keycloakId, blockings] of BlockingUtils.getBlockedPlayers()) {
			for (const blocking of blockings) {
				BlockingUtils.unblockPlayer(keycloakId, blocking.reason);
			}
		}
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
		vi.setSystemTime(TEST_NOW);
		const build = ReactionCollectorInstance.prototype.build;
		vi.spyOn(ReactionCollectorInstance.prototype, "build").mockImplementation(function (this: ReactionCollectorInstance) {
			builtCollectors.push(this);
			return build.call(this);
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});
}

/**
 * Execute a small event as the report does and return the answered packets with the collector it opened, if any
 */
export async function runSmallEvent(
	funcs: SmallEventFuncs,
	player: TestPlayer,
	options: {
		playerActiveObjects?: PlayerActiveObjects; testArgs?: string[];
	} = {}
): Promise<SmallEventRun> {
	const response: CrowniclesPacket[] = [];
	const collectorsBefore = builtCollectors.length;
	await funcs.executeSmallEvent(asPlayer(player), {
		response,
		context: TEST_CONTEXT,
		playerActiveObjects: options.playerActiveObjects ?? ({} as PlayerActiveObjects),
		testArgs: options.testArgs
	});
	return {
		response,
		collector: builtCollectors[collectorsBefore]
	};
}

function requireCollector(run: SmallEventRun): ReactionCollectorInstance {
	if (!run.collector) {
		throw new Error("The small event did not open a collector");
	}
	return run.collector;
}

/**
 * Reactions offered to the player by the collector of the run
 */
export function offeredReactions(run: SmallEventRun): ReactionCollectorCreationPacket["reactions"] {
	return requireCollector(run).creationPacket.reactions;
}

/**
 * Make the player pick the first offered reaction matching the predicate and return the packets of the end of the collector
 */
export async function react(
	run: SmallEventRun,
	matches: (reaction: ReactionCollectorCreationPacket["reactions"][number]) => boolean,
	keycloakId = TEST_CONTEXT.keycloakId ?? ""
): Promise<CrowniclesPacket[]> {
	const collector = requireCollector(run);
	const index = collector.creationPacket.reactions.findIndex(matches);
	if (index === -1) {
		throw new Error("No offered reaction matches");
	}
	const response: CrowniclesPacket[] = [];
	await collector.react(keycloakId, index, response);
	return response;
}

/**
 * Make the player pick the first offered reaction of the given class
 */
export function reactWith(run: SmallEventRun, reactionClass: { name: string }): Promise<CrowniclesPacket[]> {
	return react(run, reaction => reaction.type === reactionClass.name);
}

/**
 * Whether the collector of the run ignores the reactions of another player
 */
export async function ignoresOtherPlayers(run: SmallEventRun): Promise<boolean> {
	await react(run, () => true, "another-player");
	return !requireCollector(run).hasEnded;
}

/**
 * Whether the player is still blocked by a small event
 */
export function isBlocked(player: TestPlayer): boolean {
	return BlockingUtils.isPlayerBlocked(player.keycloakId);
}

/**
 * End the collector without any reaction, as when the player lets it time out
 */
export async function endWithoutReaction(run: SmallEventRun): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await requireCollector(run).end(response);
	return response;
}

/**
 * Packets of the given class among the answered ones
 */
export function packetsOf<T extends CrowniclesPacket>(response: CrowniclesPacket[], packetClass: new () => T): T[] {
	return response.filter((packet): packet is T => packet instanceof packetClass);
}

/**
 * The only packet of the given class among the answered ones
 */
export function packetOf<T extends CrowniclesPacket>(response: CrowniclesPacket[], packetClass: new () => T): T {
	const packets = packetsOf(response, packetClass);
	if (packets.length !== 1) {
		throw new Error(`Expected one ${packetClass.name}, got ${packets.length}`);
	}
	return packets[0];
}
