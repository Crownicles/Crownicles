import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/ErrorHandler";
import "../../src/packetHandlers/handlers/FightHandler";
import "../../src/packetHandlers/handlers/commands/admin/SetPlayerInfoCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildDailyCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildDescriptionPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildElderCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildElderRemoveCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildInviteCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildKickCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildLeaveCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/guild/GuildShelterPacketHandlers";
import "../../src/packetHandlers/handlers/commands/missions/MissionShopCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetFeedPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetSellCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetTransferCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/ClassesCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/DailyBonusCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/DefenseCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/DrinkCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/EquipCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/JoinBoatCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/LeagueRewardCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/ProfileCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/ReportCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/RespawnCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/SellCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/UnlockCommandPacketHandlers";
import { CommandClassesCancelErrorPacket } from "../../../Lib/src/packets/commands/CommandClassesPacket";
import {
	CommandDailyBonusCancelPacket,
	CommandDailyBonusNoAvailableObject
} from "../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { CommandDefenseCancelPacketRes } from "../../../Lib/src/packets/commands/CommandDefensePacket";
import {
	CommandDrinkCancelDrink,
	CommandDrinkNoAvailablePotion
} from "../../../Lib/src/packets/commands/CommandDrinkPacket";
import { CommandEquipErrorNoItem } from "../../../Lib/src/packets/commands/CommandEquipPacket";
import {
	CommandFightNotEnoughEnergyPacketRes,
	CommandFightOpponentsNotFoundPacket
} from "../../../Lib/src/packets/commands/CommandFightPacket";
import { CommandGuildDailyPveIslandErrorPacket } from "../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import {
	CommandGuildDescriptionNoGuildPacket,
	CommandGuildDescriptionNotAnElderPacket
} from "../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import {
	CommandGuildElderAlreadyElderPacketRes,
	CommandGuildElderFoundPlayerPacketRes,
	CommandGuildElderHimselfPacketRes,
	CommandGuildElderSameGuildPacketRes
} from "../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { CommandGuildElderRemoveNoElderPacket } from "../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import { CommandGuildInvitePlayerNotFound } from "../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import { CommandGuildKickBlockedErrorPacket } from "../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { CommandGuildLeaveNotInAGuildPacketRes } from "../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { CommandGuildShelterNoPetErrorPacket } from "../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import {
	CommandJoinBoatNoGuildPacketRes,
	CommandJoinBoatNotEnoughGemsPacketRes
} from "../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import {
	CommandLeagueRewardAlreadyClaimedPacketRes,
	CommandLeagueRewardNoPointsPacketRes
} from "../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopNoPet
} from "../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	CommandPetFeedCancelErrorPacket,
	CommandPetFeedGuildStorageEmptyErrorPacket,
	CommandPetFeedNoMoneyFeedErrorPacket,
	CommandPetFeedNoPetErrorPacket,
	CommandPetFeedPetOnExpeditionErrorPacket,
	CommandPetFeedSituationChangedErrorPacket
} from "../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { CommandPetPetNotFound } from "../../../Lib/src/packets/commands/CommandPetPacket";
import {
	CommandPetSellAlreadyHavePetError,
	CommandPetSellCancelPacket,
	CommandPetSellCantSellToYourselfErrorPacket,
	CommandPetSellFeistyErrorPacket,
	CommandPetSellInitiatorSituationChangedErrorPacket,
	CommandPetSellNoOneAvailableErrorPacket,
	CommandPetSellNoPetErrorPacket,
	CommandPetSellNotInGuildErrorPacket,
	CommandPetSellOnlyOwnerCanCancelErrorPacket,
	CommandPetSellPetOnExpeditionErrorPacket,
	CommandPetSellSameGuildError
} from "../../../Lib/src/packets/commands/CommandPetSellPacket";
import {
	CommandPetTransferCancelErrorPacket,
	CommandPetTransferFeistyErrorPacket,
	CommandPetTransferNoPetErrorPacket,
	CommandPetTransferPetOnExpeditionErrorPacket,
	CommandPetTransferSituationChangedErrorPacket
} from "../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { CommandProfilePlayerNotFound } from "../../../Lib/src/packets/commands/CommandProfilePacket";
import {
	CommandReportErrorNoMonsterRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportItemCannotBeEnchantedRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { CommandRespawnErrorAlreadyAlive } from "../../../Lib/src/packets/commands/CommandRespawnPacket";
import {
	CommandSellCancelErrorPacket,
	CommandSellNoItemErrorPacket
} from "../../../Lib/src/packets/commands/CommandSellPacket";
import { CommandSetPlayerInfoDoesntExistError } from "../../../Lib/src/packets/commands/CommandSetPlayerInfo";
import {
	CommandUnlockHimself,
	CommandUnlockNoPlayerFound,
	CommandUnlockNotInJail
} from "../../../Lib/src/packets/commands/CommandUnlockPacket";
import {
	ErrorBannedPacket,
	ErrorResetIsNow,
	ErrorSeasonEndIsNow
} from "../../../Lib/src/packets/commands/ErrorPacket";
import { BuggedFightPacket } from "../../../Lib/src/packets/fights/BuggedFightPacket";
import {
	CrowniclesPacket, makePacket, PacketLike
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	dispatch, embedsOf, ERROR_COLOR, fakeCommand, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

/**
 * Packets Core sends to refuse an action, each with the beginning of the explanation the player must read
 */
const REFUSALS: [PacketLike<CrowniclesPacket>, string][] = [
	[ErrorBannedPacket, "Vous avez été banni du jeu"],
	[ErrorResetIsNow, "Le classement de la semaine est en cours"],
	[ErrorSeasonEndIsNow, "La saison de combat est en cours de réin"],
	[CommandFightOpponentsNotFoundPacket, "Aucun adversaire n'a été trouvé pour vou"],
	[CommandFightNotEnoughEnergyPacketRes, "Vous n'avez pas assez d'énergie pour dém"],
	[BuggedFightPacket, "Le combat a été annulé car il y a eu un"],
	[CommandSetPlayerInfoDoesntExistError, "Le joueur demandé n'a pas encore commenc"],
	[CommandGuildDailyPveIslandErrorPacket, "La récompense de guilde ne peut pas être"],
	[CommandGuildDescriptionNoGuildPacket, "Il semblerait que vous ne fassiez plus p"],
	[CommandGuildDescriptionNotAnElderPacket, "Vous n'avez plus les permissions nécessa"],
	[CommandGuildElderSameGuildPacketRes, "Ce joueur n'appartient pas à votre guild"],
	[CommandGuildElderHimselfPacketRes, "En tant que chef de la guilde, vous ne p"],
	[CommandGuildElderAlreadyElderPacketRes, "Le joueur est déjà aîné de votre guilde"],
	[CommandGuildElderFoundPlayerPacketRes, "Ce joueur n'a pas été trouvé"],
	[CommandGuildElderRemoveNoElderPacket, "La guilde n'a pas d'aîné"],
	[CommandGuildInvitePlayerNotFound, "Le joueur demandé n'a pas encore commenc"],
	[CommandGuildKickBlockedErrorPacket, "Le joueur que vous essayez d'expulser es"],
	[CommandGuildLeaveNotInAGuildPacketRes, "Il semblerait que vous ne fassiez déjà p"],
	[CommandGuildShelterNoPetErrorPacket, "Il semblerait qu'aucun familier ne soit"],
	[CommandMissionShopAlreadyBoughtPointsThisWeek, "Vous avez déjà acheté des points cette s"],
	[CommandMissionShopNoMissionToSkip, "Vous n'avez aucune mission à passer"],
	[CommandMissionShopAlreadyHadBadge, "Vous possédez déjà le badge \"Maître des"],
	[CommandMissionShopNoPet, "Vous n'avez aucun animal sur vous, nous"],
	[CommandPetPetNotFound, "Aucun familier n'a été trouvé"],
	[CommandPetFeedNoPetErrorPacket, "Vous n'avez aucun familier"],
	[CommandPetFeedPetOnExpeditionErrorPacket, "Votre familier est actuellement en expéd"],
	[CommandPetFeedNoMoneyFeedErrorPacket, "Vous n'avez pas assez d'argent pour effe"],
	[CommandPetFeedGuildStorageEmptyErrorPacket, "L'entrepôt de nourriture de votre guilde"],
	[CommandPetFeedSituationChangedErrorPacket, "Votre familier a changé pendant que vous"],
	[CommandPetFeedCancelErrorPacket, "Nourrissage annulé"],
	[CommandPetSellNoPetErrorPacket, "Vous n'avez aucun familier à vendre"],
	[CommandPetSellPetOnExpeditionErrorPacket, "Votre familier est actuellement en expéd"],
	[CommandPetSellNotInGuildErrorPacket, "Vous ne pouvez pas vendre votre familier"],
	[CommandPetSellFeistyErrorPacket, "Vous ne pouvez pas vendre un familier fi"],
	[CommandPetSellOnlyOwnerCanCancelErrorPacket, "Seul l'initiateur d'une vente peut l'ann"],
	[CommandPetSellCancelPacket, "La vente a été annulée"],
	[CommandPetSellCantSellToYourselfErrorPacket, "Il est impossible de vendre un familier"],
	[CommandPetSellSameGuildError, "Vous ne pouvez pas acheter ce familier c"],
	[CommandPetSellAlreadyHavePetError, "Vous avez déjà un familier dans votre in"],
	[CommandPetSellInitiatorSituationChangedErrorPacket, "Le vendeur n'est plus en mesure de vendr"],
	[CommandPetSellNoOneAvailableErrorPacket, "Malheureusement, personne ne semble disp"],
	[CommandPetTransferCancelErrorPacket, "Le transfert a été annulé"],
	[CommandPetTransferSituationChangedErrorPacket, "Quelque chose s'est mal passé pendant le"],
	[CommandPetTransferNoPetErrorPacket, "Vous n'avez aucun familier à transférer"],
	[CommandPetTransferFeistyErrorPacket, "Vous ne pouvez pas transférer un familie"],
	[CommandPetTransferPetOnExpeditionErrorPacket, "Votre familier est actuellement en expéd"],
	[CommandClassesCancelErrorPacket, "Changement de classe annulé"],
	[CommandDailyBonusNoAvailableObject, "Vous n'avez malheureusement aucun objet"],
	[CommandDailyBonusCancelPacket, "Vous avez annulé l'utilisation de votre"],
	[CommandDefenseCancelPacketRes, "Votre style de défense n'a pas été modif"],
	[CommandDrinkCancelDrink, "Vous ne buvez pas de potion"],
	[CommandDrinkNoAvailablePotion, "Vous n'avez malheureusement aucune potio"],
	[CommandEquipErrorNoItem, "Vous n'avez aucun équipement à gérer"],
	[CommandJoinBoatNoGuildPacketRes, "Vous n'appartenez à aucune guilde"],
	[CommandJoinBoatNotEnoughGemsPacketRes, "Vous voulez rejoindre votre guilde mais"],
	[CommandLeagueRewardNoPointsPacketRes, "La récompense de ligue n'est disponible"],
	[CommandLeagueRewardAlreadyClaimedPacketRes, "Vous avez déjà récupéré votre récompense"],
	[CommandProfilePlayerNotFound, "Le joueur demandé n'a pas encore commenc"],
	[CommandReportErrorNoMonsterRes, "Aucun monstre n'a été trouvé pour vous a"],
	[CommandReportItemCannotBeEnchantedRes, "Mernil regarde votre équipement et secou"],
	[CommandReportHomeBedAlreadyFullRes, "Vous êtes déjà en pleine forme"],
	[CommandRespawnErrorAlreadyAlive, "Il semblerait que vous ne soyez pas K"],
	[CommandSellNoItemErrorPacket, "Vous n'avez malheureusement aucun objet"],
	[CommandSellCancelErrorPacket, "La vente a bien été annulée"],
	[CommandUnlockHimself, "Vous ne pouvez pas vous libérer vous-mêm"],
	[CommandUnlockNotInJail, "Ce joueur n'est pas en prison"],
	[CommandUnlockNoPlayerFound, "Le joueur demandé n'a pas encore commenc"]
];

describe("refusal packets", () => {
	it.each(REFUSALS)("%o displays its explanation in an error embed", async (packetClass, explanation) => {
		const {
			interaction, context
		} = fakeCommand("Refused");
		await dispatch(context, makePacket(packetClass, {}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.author?.name).toContain("Refused");
		expect(embed.description).toContain(explanation);
	});
});
