import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandInventoryPacketRes} from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import {CommandProfilePacketRes} from "../../../Lib/src/packets/commands/CommandProfilePacket";
import {Badge} from "../../../Lib/src/types/Badge";
import {ItemCategory, ItemNature, ItemRarity} from "../../../Lib/src/constants/ItemConstants";
import {PlantId as LibPlantId} from "../../../Lib/src/constants/PlantConstants";
import {MainItemDetails} from "../../../Lib/src/types/MainItemDetails";
import {SupportItemDetails} from "../../../Lib/src/types/SupportItemDetails";
import {InventoryRes} from "../../../WsPackets/src/fromServer/inventory/InventoryRes";
import {PlantId} from "../../../WsPackets/src/objects/PlantId";
import {packetContractChecks} from "../../src/packets/PacketContractChecks";
import InventoryCommandServerTranslator from "../../src/packets/fromServer/translators/InventoryCommandServerTranslator";
import {translateProfileData} from "../../src/packets/fromServer/translators/ProfileCommandServerTranslator";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		webSocket: {}
	};
}

function profileData(): CommandProfilePacketRes["playerData"] {
	return {
		stats: {
			energy: {value: 8, max: 12},
			attack: 15,
			defense: 16,
			speed: 17,
			breath: {base: 4, max: 6, regen: 2}
		},
		missions: {gems: 3, campaignProgression: 4},
		rank: {unranked: false, rank: 2, numberOfPlayers: 20, score: 120},
		effect: {healed: false, timeLeft: 0, effect: "none", hasTimeDisplay: false},
		classId: 1,
		fightRanking: {glory: 30, gloryRank: 4, numberOfFighters: 40, league: 2},
		guild: "guild",
		destinationId: 5,
		mapTypeId: "main",
		pet: {typeId: 1, sex: "m", rarity: 2, nickname: "pet"},
		color: "#ffffff",
		level: 8,
		badges: [Badge.BOT_OWNER],
		health: {value: 90, max: 100},
		experience: {value: 30, max: 100},
		money: 500,
		tokens: {value: 6, max: 10},
		cooking: {
			level: 5,
			grade: "expert",
			experience: {value: 12, max: 50}
		}
	};
}

function mainItem(): MainItemDetails {
	const stat = {baseValue: 1, upgradeValue: 2, maxValue: 3};
	return {
		id: 7,
		rarity: ItemRarity.RARE,
		itemCategory: ItemCategory.WEAPON,
		itemLevel: 2,
		attack: stat,
		defense: stat,
		speed: stat
	};
}

function supportItem(nature: ItemNature): SupportItemDetails {
	return {
		id: 8,
		rarity: ItemRarity.COMMON,
		nature,
		power: 10,
		maxPower: 20,
		itemCategory: ItemCategory.POTION
	};
}

function inventoryPacket(): CommandInventoryPacketRes {
	const item = mainItem();
	const potion = supportItem(ItemNature.HEALTH);
	const data: NonNullable<CommandInventoryPacketRes["data"]> = {
		weapon: item,
		armor: item,
		potion,
		object: potion,
		backupWeapons: [{display: item, slot: 1}],
		backupArmors: [{display: item, slot: 2}],
		backupPotions: [{display: potion, slot: 3}],
		backupObjects: [{display: potion, slot: 4}],
		slots: {weapons: 2, armors: 2, potions: 4, objects: 4},
		materials: [{materialId: 12, quantity: 4}],
		plants: {
			seed: LibPlantId.COMMON_HERB,
			plantSlots: [{plantId: LibPlantId.GOLDEN_CLOVER, slot: 1}],
			maxPlantSlots: 3
		}
	};

	return makePacket(CommandInventoryPacketRes, {
		foundPlayer: true,
		data,
		hasTalisman: true,
		hasCloneTalisman: true,
		hasRemoteHarvestTalisman: true
	});
}

describe("packet contracts", () => {
	it("keeps the compile-time contract checks active", () => {
		expect(packetContractChecks).toStrictEqual({
			drinkRequest: true,
			inventoryRequest: true,
			petRequest: true,
			pingRequest: true,
			profileRequest: true,
			collectorsRequest: true,
			drinkResponse: true,
			drinkCancel: true,
			drinkUnavailable: true,
			inventoryResponse: true,
			petResponse: true,
			pingResponse: true,
			profileResponse: true,
			collectorEnded: true,
			collectorReaction: true,
			collectorStop: true,
			collectorsResponseKeys: true,
			collectorCreationKeys: true,
			mainItem: true,
			mainItemStat: true,
			materialQuantity: true,
			ownedPet: true,
			supportItem: true,
			valueAndMax: true
		});
	});

	it("transports the complete profile data available to Discord", () => {
		const translated = translateProfileData("player", profileData());

		expect(translated).toMatchObject({
			fightRanking: {glory: 30, gloryRank: 4, numberOfFighters: 40, league: 2},
			tokens: {value: 6, max: 10},
			cooking: {
				level: 5,
				grade: "expert",
				experience: {value: 12, max: 50}
			}
		});
	});

	it("transports materials, plants and all inventory talismans", async () => {
		const translated = await InventoryCommandServerTranslator.translate(context(), inventoryPacket());

		expect(translated).toBeInstanceOf(InventoryRes);
		expect(translated.data?.materials).toStrictEqual([{materialId: 12, quantity: 4}]);
		expect(translated.data?.plants).toStrictEqual({
			seed: PlantId.COMMON_HERB,
			plantSlots: [{plantId: PlantId.GOLDEN_CLOVER, slot: 1}],
			maxPlantSlots: 3
		});
		expect(translated.hasTalisman).toBe(true);
		expect(translated.hasCloneTalisman).toBe(true);
		expect(translated.hasRemoteHarvestTalisman).toBe(true);
	});
});