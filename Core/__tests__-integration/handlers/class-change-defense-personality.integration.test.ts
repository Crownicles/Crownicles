import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import {
	AiPersonality, AiPersonalityConstants
} from "../../../Lib/src/constants/AiPersonalityConstants";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandClassesChangeSuccessPacket } from "../../../Lib/src/packets/commands/CommandClassesPacket";
import { ReactionCollectorChangeClassReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";

type ClassesCommandModule = typeof import("../../src/commands/player/ClassesCommand");
type AiBehaviorControllerModule = typeof import("../../src/core/fights/AiBehaviorController");
type EndCallbackCollector = Parameters<ReturnType<ClassesCommandModule["getEndCallback"]>>[0];

/**
 * The defense personality stored for a player is the one defending them: a class change to a class that does not
 * offer it forgets it in the same critical section, and the confirmation tells the player (#5126)
 */
describe("class change and defense personality", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let classesCommand: ClassesCommandModule;

	beforeAll(async () => {
		env = await setupCoreForTests("class_change_defense");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		classesCommand = loadProductionModule<ClassesCommandModule>("commands/player/ClassesCommand");
		loadProductionModule<AiBehaviorControllerModule>("core/fights/AiBehaviorController").initializeAllClassBehaviors();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await Player.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function createPlayer(keycloakId: string, classId: number, defensePersonality: AiPersonality | null): Promise<void> {
		await Player.create({
			keycloakId,
			level: ClassConstants.GROUP4LEVEL,
			class: classId,
			defensePersonality
		});
	}

	/**
	 * Change the class of a stored player as the class change collector does once the player picked the new class
	 * @param keycloakId
	 * @param classId
	 * @returns The packet confirming the change
	 */
	async function changeClass(keycloakId: string, classId: number): Promise<CommandClassesChangeSuccessPacket> {
		const player = (await Player.findOne({ where: { keycloakId } }))!;
		const collector = {
			getFirstReaction: () => ({
				reaction: {
					type: ReactionCollectorChangeClassReaction.name,
					data: { classId }
				}
			})
		} as unknown as EndCallbackCollector;
		const response: CrowniclesPacket[] = [];

		await classesCommand.getEndCallback(player)(collector, response);

		const success = response.find(packet => packet.constructor.name === CommandClassesChangeSuccessPacket.name);
		expect(success).toBeDefined();
		return success as CommandClassesChangeSuccessPacket;
	}

	async function getStoredPlayer(keycloakId: string): Promise<PlayerType> {
		return (await Player.findOne({ where: { keycloakId } }))!;
	}

	it("forgets a personality the new class does not offer, and tells the player", async () => {
		await createPlayer("valiant-knight-to-paladin", ClassConstants.CLASSES_ID.VALIANT_KNIGHT, AiPersonalityConstants.PERSONALITIES.KNIGHT_STRATEGIST);

		const success = await changeClass("valiant-knight-to-paladin", ClassConstants.CLASSES_ID.LUMINOUS_PALADIN);

		const stored = await getStoredPlayer("valiant-knight-to-paladin");
		expect(stored.class).toBe(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN);
		expect(stored.defensePersonality).toBeNull();
		expect(success.classId).toBe(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN);
		expect(success.lostDefensePersonality).toBe(AiPersonalityConstants.PERSONALITIES.KNIGHT_STRATEGIST);
	});

	it("keeps a personality the new class offers too, without telling the player", async () => {
		await createPlayer("knight-to-valiant-knight", ClassConstants.CLASSES_ID.KNIGHT, AiPersonalityConstants.PERSONALITIES.KNIGHT_ENDURING);

		const success = await changeClass("knight-to-valiant-knight", ClassConstants.CLASSES_ID.VALIANT_KNIGHT);

		const stored = await getStoredPlayer("knight-to-valiant-knight");
		expect(stored.class).toBe(ClassConstants.CLASSES_ID.VALIANT_KNIGHT);
		expect(stored.defensePersonality).toBe(AiPersonalityConstants.PERSONALITIES.KNIGHT_ENDURING);
		expect(success.lostDefensePersonality).toBeUndefined();
	});

	it("tells nothing to a player who let a random personality defend them", async () => {
		await createPlayer("random-defense", ClassConstants.CLASSES_ID.VALIANT_KNIGHT, null);

		const success = await changeClass("random-defense", ClassConstants.CLASSES_ID.MYSTIC_MAGE);

		const stored = await getStoredPlayer("random-defense");
		expect(stored.class).toBe(ClassConstants.CLASSES_ID.MYSTIC_MAGE);
		expect(stored.defensePersonality).toBeNull();
		expect(success.lostDefensePersonality).toBeUndefined();
	});
});
