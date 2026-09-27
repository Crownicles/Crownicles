import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { OnboardingConstants } from "../../../Lib/src/constants/OnboardingConstants";

type RoyalMailModule = typeof import("../../src/core/onboarding/RoyalMail");

const DAY_MS = 24 * 60 * 60 * 1000;
const RACERS = 5;
const STARTING_TOKENS = 5;

describe("royal mail", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let deliverRoyalLetter: RoyalMailModule["deliverRoyalLetter"];

	beforeAll(async () => {
		env = await setupCoreForTests("royalmail");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		deliverRoyalLetter = loadProductionModule<RoyalMailModule>("core/onboarding/RoyalMail").deliverRoyalLetter;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await PlayerMissionsInfo.destroy({
			truncate: true, force: true
		});
		await Player.destroy({
			truncate: true, force: true
		});
	});

	async function newcomer(lastRoyalLetterAt: Date | null, royalLettersReceived = 0): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: `newcomer-${Date.now()}-${Math.random()}`, tokens: STARTING_TOKENS, money: 0
		});
		await PlayerMissionsInfo.create({
			playerId: player.id, campaignBlob: "0".repeat(149), lastRoyalLetterAt, royalLettersReceived
		});
		return player;
	}

	async function reload(player: PlayerType): Promise<{ tokens: number; money: number; letters: number; gems: number }> {
		const [fresh, info] = await Promise.all([Player.findByPk(player.id), PlayerMissionsInfo.findByPk(player.id)]);
		return {
			tokens: fresh!.tokens, money: fresh!.money, letters: info!.royalLettersReceived, gems: info!.gems
		};
	}

	function letters(responses: CrowniclesPacket[][]): number {
		return responses.flat().filter(packet => packet.constructor.name === "RoyalLetterPacket").length;
	}

	it("only starts counting the days at the first report", async () => {
		const player = await newcomer(null);
		const response: CrowniclesPacket[] = [];
		await deliverRoyalLetter(player, response);
		expect(letters([response])).toBe(0);
		const info = await PlayerMissionsInfo.findByPk(player.id);
		expect(info!.lastRoyalLetterAt).not.toBeNull();
		expect(info!.royalLettersReceived).toBe(0);
	});

	it("delivers exactly one letter a day, whatever the number of reports racing for it", async () => {
		const player = await newcomer(new Date(Date.now() - DAY_MS));
		const responses = Array.from({ length: RACERS }, (): CrowniclesPacket[] => []);
		await Promise.all(responses.map(async response => {
			const instance = (await Player.findByPk(player.id))!;
			await deliverRoyalLetter(instance, response);
		}));
		expect(letters(responses)).toBe(1);
		expect(await reload(player)).toMatchObject({
			letters: 1,
			tokens: STARTING_TOKENS + OnboardingConstants.ROYAL_MAIL.TOKENS,
			money: OnboardingConstants.ROYAL_MAIL.MONEY
		});
	});

	it("closes the week with gems on the last letter, then writes no more", async () => {
		const player = await newcomer(new Date(Date.now() - DAY_MS), OnboardingConstants.ROYAL_MAIL.LETTERS - 1);
		await deliverRoyalLetter(player, []);
		const afterLast = await reload(player);
		expect(afterLast.letters).toBe(OnboardingConstants.ROYAL_MAIL.LETTERS);
		expect(afterLast.gems).toBeGreaterThanOrEqual(OnboardingConstants.ROYAL_MAIL.FINAL_GEMS);

		const nextWeek = new Date(Date.now() + DAY_MS);
		const response: CrowniclesPacket[] = [];
		await deliverRoyalLetter((await Player.findByPk(player.id))!, response, nextWeek);
		expect(letters([response])).toBe(0);
	});

	it("leaves players who were already in the kingdom alone", async () => {
		const veteran = await newcomer(null, OnboardingConstants.ROYAL_MAIL.LETTERS);
		const response: CrowniclesPacket[] = [];
		await deliverRoyalLetter(veteran, response);
		expect(letters([response])).toBe(0);
		expect((await PlayerMissionsInfo.findByPk(veteran.id))!.lastRoyalLetterAt).toBeNull();
	});
});
