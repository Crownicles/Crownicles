import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/commands/player/ReportCommandPacketHandlers";
import * as ReportPackets from "../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../Lib/src/packets/CrowniclesPacket";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import {
	answeredClick, dispatch, fakeCommand, RenderedMessage, renderedText, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

const PVE_ATTACK = {
	enchantmentId: ItemEnchantment.PVE_ATTACK_1.id,
	enchantmentType: ItemEnchantment.PVE_ATTACK_1.kind.type.id
};

const APARTMENT = {
	cityId: "boug_coton",
	mapLocationId: 6
};

type ReportPacketName = keyof typeof ReportPackets;

/**
 * Answers of Core to the city and travel menus of the report, each with the texts the player must read
 */
const ANSWERS: [ReportPacketName, object, string[]][] = [
	["CommandReportEatInnMealRes", {
		energy: 40, moneySpent: 120
	}, ["Hero, vous mangez à l'auberge !", "**40**", "**120**"]],
	["CommandReportSleepRoomRes", {
		roomId: "simpleRoom", health: 30, moneySpent: 200
	}, ["chambre simple", "**30**", "**200**"]],
	["CommandReportNotEnoughMoneyRes", { missingMoney: 77 }, ["Il vous manque 77"]],
	["CommandReportEnchantNotEnoughCurrenciesRes", {
		missingMoney: 50, missingGems: 0
	}, ["pas assez d'argent pour payer", "**50**"]],
	["CommandReportEnchantNotEnoughCurrenciesRes", {
		missingMoney: 0, missingGems: 5
	}, ["pas assez de gemmes pour payer", "**5**"]],
	["CommandReportEnchantNotEnoughCurrenciesRes", {
		missingMoney: 50, missingGems: 5
	}, ["pas assez d'argent et de gemmes", "**50**", "**5**"]],
	["CommandReportItemEnchantedRes", PVE_ATTACK, ["enchantement réussi", "**Attaque PvE I**"]],
	["CommandReportEnchanterDisenchantRes", PVE_ATTACK, ["désenchantement réussi", "**Attaque PvE I**"]],
	["CommandReportBuyHomeRes", { cost: 5000 }, ["achat de maison réussi", "**5000"]],
	["CommandReportUpgradeHomeRes", { cost: 8000 }, ["amélioration de maison réussie", "**8000"]],
	["CommandReportMoveHomeRes", { cost: 3000 }, ["déménagement réussi", "**3000"]],
	["CommandReportMoveHomeRes", {
		cost: 3000, rentDeducted: 200
	}, ["**3000", "dont **200"]],
	["CommandReportApartmentBuyRes", {
		...APARTMENT, cost: 4000
	}, ["dans **Boug-Coton** contre **4000"]],
	["CommandReportApartmentClaimRentRes", {
		...APARTMENT, rentClaimed: 300
	}, ["**300", "**Boug-Coton**"]],
	["CommandReportApartmentClaimRentTooLowRes", {
		...APARTMENT, currentRent: 10, minRequired: 50
	}, ["**10", "au moins **50"]],
	["CommandReportApartmentAlreadyOwnedRes", APARTMENT, ["déjà un logis dans **Boug-Coton**"]],
	["CommandReportApartmentRequiresHomeRes", APARTMENT, ["demeure officielle", "**Boug-Coton**"]],
	["CommandReportUseTokensAcceptPacketRes", {
		tokensSpent: 3, isArrived: true
	}, ["**3 jetons**", "arrivé à destination", "</report:0>"]],
	["CommandReportUseTokensAcceptPacketRes", {
		tokensSpent: 3, isArrived: false
	}, ["**3 jetons**", "Un événement vous attend"]],
	["CommandReportUseTokensRefusePacketRes", {}, ["conserver vos jetons"]],
	["CommandReportTokenMerchantBoughtRes", { amount: 4 }, ["**4 jetons**"]],
	["CommandReportTokenMerchantTooMuchRes", {}, ["déjà acquis tous les jetons"]],
	["CommandReportTokenMerchantFullRes", {}, ["poches débordent"]],
	["CommandReportTokenMerchantRefuseRes", {}, ["déclinez l'offre"]],
	["CommandReportTokenMerchantCannotAffordRes", {}, ["pas assez d'or"]],
	["CommandReportTokenMerchantCharityRes", { amount: 2 }, ["**2 jetons**", "sans rien demander"]],
	["CommandReportTokenMerchantCharityAlreadyUsedRes", {}, ["déjà fait l'aumône"]],
	["CommandReportBuyHealAcceptPacketRes", {
		healPrice: 300, isArrived: true
	}, ["**300**", "arrivé à destination"]],
	["CommandReportBuyHealAcceptPacketRes", {
		healPrice: 300, isArrived: false
	}, ["**300**", "Un événement vous attend"]],
	["CommandReportBuyHealRefusePacketRes", {}, ["ne pas vous soigner"]],
	["CommandReportBuyHealNoAlterationPacketRes", {}, ["aucune altération"]],
	["CommandReportBuyHealCannotHealOccupiedPacketRes", {}, ["actuellement occupé"]],
	["CommandReportUpgradeItemRes", {
		itemCategory: 0, newItemLevel: 3
	}, ["**niveau 3**"]],
	["CommandReportUpgradeItemMissingMaterialsRes", {}, ["matériaux insuffisants"]],
	["CommandReportUpgradeItemMaxLevelRes", {}, ["niveau maximum atteint"]],
	["CommandReportEquipmentChangedRes", {}, ["n'est plus le même"]],
	["CommandReportBlacksmithUpgradeRes", {
		itemCategory: 0, newItemLevel: 4, totalCost: 900, boughtMaterials: false
	}, ["frappe l'enclume", "niveau 4"]],
	["CommandReportBlacksmithUpgradeRes", {
		itemCategory: 0, newItemLevel: 4, totalCost: 900, boughtMaterials: true
	}, ["fournit les matériaux manquants", "niveau 4"]],
	["CommandReportBlacksmithNotEnoughMoneyRes", { missingMoney: 123 }, ["**123**"]],
	["CommandReportBlacksmithMissingMaterialsRes", {}, ["achetez-les directement au forgeron"]],
	["CommandReportBlacksmithEnchantmentTransferRes", {
		...PVE_ATTACK, cost: 400
	}, ["transfert d'enchantement", "**Attaque PvE I**"]],
	["CommandReportScrapDealerRecycleRes", {
		materialLoot: [
			{
				materialId: 1, quantity: 3
			}
		],
		moneyGained: 40
	}, ["**40**", "Chlorate de potassium x**3**"]],
	["CommandReportRoyalBlacksmithUpgradeRes", {
		itemCategory: 0, upgradeCost: 1000, materialsCost: 0, gemCost: 5, boughtMaterials: false
	}, ["marteau serti de runes", "**5** "]],
	["CommandReportRoyalBlacksmithUpgradeRes", {
		itemCategory: 0, upgradeCost: 1000, materialsCost: 300, gemCost: 5, boughtMaterials: true
	}, ["combler vos matériaux manquants", "**300**"]],
	["CommandReportRoyalBlacksmithNotEnoughMoneyRes", { missingMoney: 10 }, ["**10**"]],
	["CommandReportRoyalBlacksmithNotEnoughGemsRes", { missingGems: 3 }, ["**3**"]],
	["CommandReportRoyalBlacksmithMissingMaterialsRes", {}, ["matériaux précis"]],
	["CommandReportRoyalBlacksmithMockBadgeGivenRes", {}, ["Vous gagnez le badge"]],
	["CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes", {}, ["lève les yeux au ciel"]],
	["CommandReportHomeBedRes", { health: 25 }, ["**25**"]],
	["CommandReportBedCooldownRes", { nextAvailableAt: 1_800_000_000_000 }, ["<t:1800000000:R>"]],
	["CommandReportEatInnMealCooldownRes", { nextAvailableAt: 1_800_000_000_000 }, ["<t:1800000000:R>"]],
	["CommandReportGuildDomainPurchaseRes", { cost: 0 }, ["domaine installé", "actes officiels"]],
	["CommandReportGuildDomainRelocateRes", { cost: 2000 }, ["domaine déplacé", "**2000"]],
	["CommandReportGuildDomainNotEnoughTreasuryRes", { missingTreasury: 700 }, ["**700"]],
	["CommandReportGardenCompostRes", {
		plantId: 1, quantity: 5, materials: [1, 2]
	}, ["**5** 🌿 Herbe commune", "Chlorate de potassium", "Planche d'acacia"]],
	["CommandReportGardenCompostNotEnoughPlantsRes", {
		plantId: 1, quantity: 5
	}, ["Herbe commune", "composter **5**"]],
	["CommandReportRefusePveFightRes", {}, ["Journal de Hero", "ne pas engager le combat"]],
	["CommandReportStayInCity", {}, ["vous êtes en ville", "</report:0>"]]
];

/**
 * Dispatch the answer of Core to a click of the player in his report and return the single message displayed, on the
 * click or on the command
 */
async function renderAnswer(name: ReportPacketName, payload: object): Promise<RenderedMessage> {
	const command = fakeCommand("Hero");
	const {
		click, context
	} = answeredClick(command);
	const packetClass = ReportPackets[name] as new () => CrowniclesPacket;
	await dispatch(context, makePacket(packetClass, payload));
	return singleMessage({ messages: [...command.interaction.messages, ...click.messages] });
}

describe("report answers", () => {
	it.each(ANSWERS)("%s %o displays its outcome", async (name, payload, expectedTexts) => {
		const text = renderedText(await renderAnswer(name, payload));

		for (const expected of expectedTexts) {
			expect(text).toContain(expected);
		}
	});
});
