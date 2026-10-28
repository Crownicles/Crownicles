import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { AiPersonalityConstants } from "../../../Lib/src/constants/AiPersonalityConstants";

type AiPlayerFighterModule = typeof import("../../src/core/fights/fighter/AiPlayerFighter");
type AiBehaviorControllerModule = typeof import("../../src/core/fights/AiBehaviorController");
type ClassModule = typeof import("../../src/data/Class");
type KnightEnduringModule = typeof import("../../src/core/fights/aiClassBehaviors/KnightEnduringFightBehavior");

/**
 * The defense personality picked by a player is persisted by the game database migration
 * and drives the AI fighting on behalf of the player
 */
describe("defense personality", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;

	beforeAll(async () => {
		env = await setupCoreForTests("defense_personality");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		loadProductionModule<AiBehaviorControllerModule>("core/fights/AiBehaviorController").initializeAllClassBehaviors();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	/**
	 * Build the AI fighting on behalf of the stored player, as a ranked fight does for the defender
	 * @param keycloakId
	 */
	async function buildDefender(keycloakId: string): Promise<unknown> {
		const { AiPlayerFighter } = loadProductionModule<AiPlayerFighterModule>("core/fights/fighter/AiPlayerFighter");
		const { ClassDataController } = loadProductionModule<ClassModule>("data/Class");
		const player = (await Player.findOne({ where: { keycloakId } }))!;
		const fighter = new AiPlayerFighter(player, ClassDataController.instance.getById(player.class)!);
		// The behavior is private to the fighter: it is read here only to check which personality was built
		return Reflect.get(fighter, "classBehavior");
	}

	it("lets a player without choice be defended by a random personality", async () => {
		const player = await Player.create({
			keycloakId: "defense-default", class: ClassConstants.CLASSES_ID.VALIANT_KNIGHT
		});

		expect((await Player.findByPk(player.id))!.defensePersonality).toBeNull();
	});

	it("defends a player with the personality the player picked", async () => {
		const { default: KnightEnduringFightBehavior } = loadProductionModule<KnightEnduringModule>("core/fights/aiClassBehaviors/KnightEnduringFightBehavior");
		await Player.create({
			keycloakId: "defense-enduring",
			class: ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
			defensePersonality: AiPersonalityConstants.PERSONALITIES.KNIGHT_ENDURING
		});

		for (let i = 0; i < 20; i++) {
			expect(await buildDefender("defense-enduring")).toBeInstanceOf(KnightEnduringFightBehavior);
		}
	});
});
