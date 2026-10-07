import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import { ForeignKeyConstraintError } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import type { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ShopCurrency } from "../../../Lib/src/constants/ShopConstants";

type MissionShopItemsModule = typeof import("../../src/core/utils/MissionShopItems");

const N_CONCURRENT = 30;

/**
 * Race test for {@link MissionShopItemsModule.getMoneyShopItem}'s
 * `buyCallback`. Production behaviour (fixed by #3760): the callback
 * wraps `addMoney(...) + save()` in `withLockedEntitiesSafe` so every
 * concurrent invocation serialises on the player row. The invariant
 * is therefore "no lost updates": running the callback N times in
 * parallel must leave the player with exactly `initial + N * amount`
 * money — never less, because that would prove a missing lock.
 *
 * Without the lock, two callers would each read e.g. money=0,
 * each compute money += amount, each save money=amount -> final
 * money=amount instead of 2*amount.
 */
describe("MissionShopItems.getMoneyShopItem race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let missionShopItems: MissionShopItemsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("missionmoney");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		missionShopItems = loadProductionModule<MissionShopItemsModule>(
			"core/utils/MissionShopItems"
		);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	it(`credits exactly N * amount when ${N_CONCURRENT} callers race`, async () => {
		const player = await Player.create({
			keycloakId: "race-money-player",
			money: 0
		});
		await PlayerMissionsInfo.create({ playerId: player.id });

		const amount = missionShopItems.calculateGemsToMoneyRatio();
		const item = missionShopItems.getMoneyShopItem();

		const values = await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => item.buyCallback([], player.id))
		);

		const successes = values.filter(v => v === true).length;
		expect(successes).toBe(N_CONCURRENT);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT * amount);
	});

	it("allows only one paid conversion when stale shops race for the same gems", async () => {
		const item = missionShopItems.getMoneyShopItem();
		const player = await Player.create({keycloakId: "race-full-shop", money: 0});
		const {Campaign} = loadProductionModule<typeof import("../../src/core/missions/Campaign")>("core/missions/Campaign");
		await PlayerMissionsInfo.create({
			playerId: player.id,
			gems: item.price,
			campaignProgression: 0,
			campaignBlob: "1".repeat(Campaign.getMaxCampaignNumber())
		});
		const {ShopUtils} = loadProductionModule<typeof import("../../src/core/utils/ShopUtils")>("core/utils/ShopUtils");
		const {ReactionCollectorController} = loadProductionModule<typeof import("../../src/core/utils/ReactionsCollector")>("core/utils/ReactionsCollector");
		const moneyPackets = loadProductionModule<typeof import("../../../Lib/src/packets/commands/CommandMissionShopPacket")>("../../Lib/src/packets/commands/CommandMissionShopPacket");
		const menus = await runAllOrThrow(Array.from({length: N_CONCURRENT}, async (_unused, index): Promise<string> => {
			const stalePlayer = (await Player.findByPk(player.id))!;
			const context: PacketContext = {
				keycloakId: player.keycloakId, frontEndOrigin: "integration-test", frontEndSubOrigin: "shop-race",
				...(index % 2 === 0 ? {webSocket: {}} : {discord: {user: "test-user", channel: "test-channel", interaction: "test-interaction", language: "fr", shardId: 0, isGuildAdministrator: false, isBotOwner: false}})
			};
			const response: CrowniclesPacket[] = [];
			await ShopUtils.createAndSendShopCollector(context, response, {
				player: stalePlayer, shopCategories: [{id: "conversion", items: [item]}], additionalShopData: {currency: ShopCurrency.GEM}
			});
			return (response[0] as ReactionCollectorCreationPacket).id;
		}));
		const responses = await runAllOrThrow(menus.map(async (id): Promise<CrowniclesPacket[]> => {
			const response: CrowniclesPacket[] = [];
			await ReactionCollectorController.reactPacket(response, {id, keycloakId: player.keycloakId, reactionIndex: 0});
			return response;
		}));
		const freshPlayer = (await Player.findByPk(player.id))!;
		const freshInfo = (await PlayerMissionsInfo.findByPk(player.id))!;
		expect(freshInfo.gems).toBe(0);
		expect(freshPlayer.money).toBe(missionShopItems.calculateGemsToMoneyRatio());
		expect(responses.flat().filter(packet => packet instanceof moneyPackets.CommandMissionShopMoney)).toHaveLength(1);
	});

	it.each([false, true])("rolls back credit and unpublished collectors on a purchase error (foreign key: %s)", async (foreignKeyFailure) => {
		const {ShopUtils} = loadProductionModule<typeof import("../../src/core/utils/ShopUtils")>("core/utils/ShopUtils");
		const {ReactionCollectorController} = loadProductionModule<typeof import("../../src/core/utils/ReactionsCollector")>("core/utils/ReactionsCollector");
		const moneyPackets = loadProductionModule<typeof import("../../../Lib/src/packets/commands/CommandMissionShopPacket")>("../../Lib/src/packets/commands/CommandMissionShopPacket");
		const item = missionShopItems.getMoneyShopItem();
		const credit = item.buyCallback;
		const failure = foreignKeyFailure
			? new ForeignKeyConstraintError({parent: Object.assign(new Error("purchase interrupted"), {sql: "INSERT"})})
			: new Error("purchase interrupted");
		const player = await Player.create({keycloakId: "shop-interrupted", money: 0});
		await PlayerMissionsInfo.create({playerId: player.id, gems: item.price});
		const context: PacketContext = {keycloakId: player.keycloakId, frontEndOrigin: "integration-test", frontEndSubOrigin: "interrupted-shop", webSocket: {}};
		item.buyCallback = async (response, playerId, requestContext, amount): Promise<boolean> => {
			await credit(response, playerId, requestContext, amount);
			await ShopUtils.createAndSendShopCollector(requestContext, response, {
				player: (await Player.findByPk(playerId))!,
				shopCategories: [{id: "unpublished", items: [missionShopItems.getMoneyShopItem()]}],
				additionalShopData: {currency: ShopCurrency.GEM}
			});
			throw failure;
		};
		await ShopUtils.createAndSendShopCollector(context, [], {
			player, shopCategories: [{id: "conversion", items: [item]}], additionalShopData: {currency: ShopCurrency.GEM}
		});
		const collector = ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
		const response: CrowniclesPacket[] = [];
		await expect(collector.react(player.keycloakId, 0, response)).rejects.toBe(failure);
		expect((await Player.findByPk(player.id))!.money).toBe(0);
		expect((await PlayerMissionsInfo.findByPk(player.id))!.gems).toBe(item.price);
		expect(response.some(packet => packet instanceof moneyPackets.CommandMissionShopMoney)).toBe(false);
		expect(ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
	});

	it("does not expose a collector created inside a purchase until that purchase commits", async () => {
		const {ShopUtils} = loadProductionModule<typeof import("../../src/core/utils/ShopUtils")>("core/utils/ShopUtils");
		const {ReactionCollectorController} = loadProductionModule<typeof import("../../src/core/utils/ReactionsCollector")>("core/utils/ReactionsCollector");
		const item = missionShopItems.getMoneyShopItem();
		const credit = item.buyCallback;
		const player = await Player.create({keycloakId: "shop-commit-visibility", money: 0});
		await PlayerMissionsInfo.create({playerId: player.id, gems: item.price});
		const context: PacketContext = {keycloakId: player.keycloakId, frontEndOrigin: "integration-test", frontEndSubOrigin: "commit-visibility", webSocket: {}};
		let collectorCreated!: () => void;
		let finishPurchase!: () => void;
		const created = new Promise<void>(resolve => { collectorCreated = resolve; });
		const finish = new Promise<void>(resolve => { finishPurchase = resolve; });
		item.buyCallback = async (response, playerId, requestContext, amount): Promise<boolean> => {
			await credit(response, playerId, requestContext, amount);
			await ShopUtils.createAndSendShopCollector(requestContext, response, {
				player: (await Player.findByPk(playerId))!,
				shopCategories: [{id: "next-shop", items: [missionShopItems.getMoneyShopItem()]}],
				additionalShopData: {currency: ShopCurrency.GEM}
			});
			collectorCreated();
			await finish;
			return true;
		};
		await ShopUtils.createAndSendShopCollector(context, [], {
			player, shopCategories: [{id: "conversion", items: [item]}], additionalShopData: {currency: ShopCurrency.GEM}
		});
		const collector = ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
		const response: CrowniclesPacket[] = [];
		const pending = collector.react(player.keycloakId, 0, response);
		try {
			await created;
			expect(ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
			finishPurchase();
			await pending;
			expect((await PlayerMissionsInfo.findByPk(player.id))!.gems).toBe(0);
			expect(ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)).toHaveLength(1);
		}
		finally {
			finishPurchase();
			await pending;
			for (const remaining of ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)) {
				await remaining.end([]);
			}
		}
	});
});
