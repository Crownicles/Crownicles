import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import {
	getCrowniclesNamespace, getCurrentTransaction
} from "../../../Lib/src/locks/CLSNamespace";

type WithLockedPlayerAndMissionsModule = typeof import("../../src/core/utils/withLockedPlayerAndMissions");

type Gate = {
	opened: Promise<void>;
	open: () => void;
};

function createGate(): Gate {
	let open!: () => void;
	const opened = new Promise<void>(resolve => {
		open = resolve;
	});
	return {
		opened, open
	};
}

/**
 * The player helpers storing per-action state in the CLS context must not leave that context active once they
 * return their promise: an unrelated callback run meanwhile (another player's packet) would see it, and with it the
 * transaction of the caller, then fail once that transaction committed (#5123).
 */
describe("player CLS contexts", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let withLockedPlayerAndMissions: WithLockedPlayerAndMissionsModule["withLockedPlayerAndMissions"];

	beforeAll(async () => {
		env = await setupCoreForTests("clscontextleak");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		withLockedPlayerAndMissions = loadProductionModule<WithLockedPlayerAndMissionsModule>("core/utils/withLockedPlayerAndMissions").withLockedPlayerAndMissions;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	async function createPlayer(keycloakId: string): Promise<PlayerType> {
		const player = await Player.create({ keycloakId });
		await PlayerMissionsInfo.create({ playerId: player.id });
		return player;
	}

	it("does not leak the transaction of a token cap reference action to unrelated callbacks", async () => {
		const player = await createPlayer("cls-leak-token-cap");
		const bodyStarted = createGate();
		const bodyReleased = createGate();
		let transactionInBody: unknown;

		const action = withLockedPlayerAndMissions(player.id, lockedPlayer => lockedPlayer.runWithTokenCapReference(async () => {
			transactionInBody = getCurrentTransaction();
			bodyStarted.open();
			await bodyReleased.opened;
		}));
		await bodyStarted.opened;
		const transactionSeenByUnrelatedCallback = await new Promise(resolve => setImmediate(() => resolve(getCurrentTransaction())));
		bodyReleased.open();
		await action;

		expect(transactionInBody).toBeDefined();
		expect(transactionSeenByUnrelatedCallback).toBeUndefined();
	});

	it("does not leave the level up context active once the level up returned its promise", async () => {
		const player = await createPlayer("cls-leak-level-up");
		await player.update({ experience: player.getExperienceNeededToLevelUp() });
		const initialLevel = player.level;
		const namespace = getCrowniclesNamespace();
		const activeContextBefore = namespace.active;

		const levelUp = player.levelUpIfNeeded([]);
		const activeContextAfterCall = namespace.active;
		await levelUp;

		expect(activeContextAfterCall).toBe(activeContextBefore);
		expect((await Player.findByPk(player.id))!.level).toBe(initialLevel + 1);
	});
});
