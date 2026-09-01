import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type PlayerType from "../../src/core/database/game/models/Player";
import type TournamentType from "../../src/core/database/game/models/Tournament";
import type TournamentCodeType from "../../src/core/database/game/models/TournamentCode";
import type TournamentParticipantType from "../../src/core/database/game/models/TournamentParticipant";
import type TournamentFightType from "../../src/core/database/game/models/TournamentFight";
import type { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentCategories, TournamentStatuses
} from "../../../Lib/src/types/Tournament";

type TournamentManagerModule = typeof import("../../src/core/tournaments/TournamentManager");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");

const GUILD_ID = "tournament-race-guild";
const CHANNEL_ID = "tournament-race-channel";

function buildContext(keycloakId: string): PacketContext {
	return {
		frontEndOrigin: "discord",
		frontEndSubOrigin: GUILD_ID,
		keycloakId,
		discord: {
			user: keycloakId,
			interaction: `interaction-${keycloakId}`,
			channel: CHANNEL_ID,
			language: "fr",
			shardId: 0
		}
	};
}

describe("TournamentManager integration", () => {
	let env: CoreTestEnvironment;
	let manager: TournamentManagerModule["TournamentManager"];
	let packetUtils: PacketUtilsModule["PacketUtils"];
	let Player: ModelStatic<PlayerType>;
	let Tournament: ModelStatic<TournamentType>;
	let TournamentCode: ModelStatic<TournamentCodeType>;
	let TournamentParticipant: ModelStatic<TournamentParticipantType>;
	let TournamentFight: ModelStatic<TournamentFightType>;

	beforeAll(async () => {
		env = await setupCoreForTests("tournament");
		manager = loadProductionModule<TournamentManagerModule>("core/tournaments/TournamentManager").TournamentManager;
		packetUtils = loadProductionModule<PacketUtilsModule>("core/utils/PacketUtils").PacketUtils;
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Tournament = env.crownicles.gameDatabase.sequelize.models.Tournament as ModelStatic<TournamentType>;
		TournamentCode = env.crownicles.gameDatabase.sequelize.models.TournamentCode as ModelStatic<TournamentCodeType>;
		TournamentParticipant = env.crownicles.gameDatabase.sequelize.models.TournamentParticipant as ModelStatic<TournamentParticipantType>;
		TournamentFight = env.crownicles.gameDatabase.sequelize.models.TournamentFight as ModelStatic<TournamentFightType>;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await TournamentFight.destroy({ truncate: true, force: true });
			await TournamentParticipant.destroy({ truncate: true, force: true });
			await Tournament.destroy({ truncate: true, force: true });
			await TournamentCode.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("allows only one concurrent registration for the same player", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner",
			level: 50
		});
		const code = await manager.generateCode(GUILD_ID);
		await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1, 1000);
		const player = await Player.create({
			keycloakId: "tournament-racer",
			level: 50
		});

		const results = await Promise.allSettled([
			manager.registerPlayer(buildContext(player.keycloakId), player),
			manager.registerPlayer(buildContext(player.keycloakId), player)
		]);

		expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
		expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
		expect(await TournamentParticipant.count()).toBe(1);
	});

	it("starts combat only with 20 participants and 10 in each category", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-threshold",
			level: 50
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1, 1000);
		const players = await Promise.all(Array.from({ length: 20 }, (_, index) => Player.create({
			keycloakId: `tournament-threshold-${index}`,
			level: index < 10 ? 50 : 100
		})));
		await Promise.all(players.map(player => manager.registerPlayer(buildContext(player.keycloakId), player)));
		await Tournament.update({ registrationEndsAt: new Date(Date.now() - 1) }, { where: { id: tournament.id } });

		const sendNotifications = vi.spyOn(packetUtils, "sendNotifications").mockImplementation(() => undefined);
		await manager.processDueTournaments();

		const started = await Tournament.findByPk(tournament.id);
		expect(started?.status).toBe(TournamentStatuses.COMBAT);
		expect(sendNotifications).toHaveBeenCalledOnce();
		expect(sendNotifications.mock.calls[0][0]).toHaveLength(20);
		sendNotifications.mockRestore();
	});

	it("assigns a late registration 750 attack and zero defense glory", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-late",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1, 1000);
		await Tournament.update({ status: TournamentStatuses.COMBAT }, { where: { id: tournament.id } });
		const player = await Player.create({
			keycloakId: "tournament-late-player",
			level: 100
		});

		const participant = await manager.registerPlayer(buildContext(player.keycloakId), player);

		expect(participant.category).toBe(TournamentCategories.LEVEL_100);
		expect(participant.attackGloryPoints).toBe(750);
		expect(participant.defenseGloryPoints).toBe(0);
		expect(participant.lateRegistration).toBe(true);
	});

	it("resolves the same fight only once", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-idempotence",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1, 1000);
		await Tournament.update({ status: TournamentStatuses.COMBAT }, { where: { id: tournament.id } });
		const attacker = await Player.create({
			keycloakId: "tournament-attacker-idempotence",
			level: 100
		});
		const defender = await Player.create({
			keycloakId: "tournament-defender-idempotence",
			level: 100
		});
		const attackerParticipant = await manager.registerPlayer(buildContext(attacker.keycloakId), attacker);
		const defenderParticipant = await manager.registerPlayer(buildContext(defender.keycloakId), defender);
		await TournamentParticipant.update({ defenseGloryPoints: 750 }, { where: { id: defenderParticipant.id } });
		const fightInitiator = {};
		const fakeFight = {
			id: "tournament-fight-idempotence",
			tournamentContext: {
				tournamentId: tournament.id,
				attackerParticipantId: attackerParticipant.id,
				defenderParticipantId: defenderParticipant.id,
				category: TournamentCategories.LEVEL_100
			},
			fightInitiator,
			isADraw: (): boolean => false,
			getWinnerFighter: (): object => fightInitiator
		} as never;

		await manager.resolveFight(fakeFight, []);
		const afterFirstResolution = await TournamentParticipant.findByPk(attackerParticipant.id);
		await manager.resolveFight(fakeFight, []);
		const afterSecondResolution = await TournamentParticipant.findByPk(attackerParticipant.id);

		expect(await TournamentFight.count()).toBe(1);
		expect(afterSecondResolution?.attackGloryPoints).toBe(afterFirstResolution?.attackGloryPoints);
	});
});