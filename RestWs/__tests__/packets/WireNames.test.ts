import {
	describe, expect, it
} from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Every packet travels under the identifier its class declares in `wireName`, never under the
 * class name: the app ships as a minified bundle where class names are mangled, and installed
 * apps outlive any back-end rename.
 *
 * Renaming a class is therefore free, but changing one of these strings breaks every published
 * app. This list is the protocol; a diff on it has to be a deliberate decision.
 */
const WIRE_NAMES = [
	"PetExpeditionReq",
	"PetExpeditionResolveReq",
	"PetExpeditionRes",
	"PetExpeditionStartedRes",
	"PetExpeditionCancelRes",
	"PetExpeditionRecallRes",
	"PetExpeditionResolveRes",
	"PetExpeditionErrorRes",
	"PetCaressReq",
	"PetCaressRes",
	"PetNickReq",
	"PetNickRes",
	"PetFeedReq",
	"PetFeedRes",
	"RarityReq",
	"RarityRes",
	"BlessingReq",
	"BlessingRes",
	"ClassesReq",
	"ClassesInfoReq",
	"ClassesInfoRes",
	"ClassesRes",
	"ClassesCooldownRes",
	"ClassesCancelRes",
	"CommandRejected",
	"DailyBonusReq",
	"DailyBonusRes",
	"DailyBonusNoObjectRes",
	"DailyBonusCooldownRes",
	"DailyBonusCancelRes",
	"Blocked",
	"CommandGetCurrentReactionCollectorsReq",
	"CommandGetCurrentReactionCollectorsRes",
	"DrinkCancel",
	"DrinkNoAvailablePotion",
	"DrinkReq",
	"DrinkRes",
	"EquipReq",
	"EquipActionReq",
	"EquipActionRes",
	"EquipNoItemRes",
	"SellReq",
	"SellRes",
	"SellNoItemRes",
	"SellCancelRes",
	"InventoryReq",
	"InventoryRes",
	"MissionsReq",
	"MissionsRes",
	"PetNotFound",
	"PetReq",
	"PetRes",
	"PingReq",
	"PingRes",
	"PlayerNotFound",
	"ProfileReq",
	"ProfileRes",
	"ReactionCollectorCreation",
	"ReactionCollectorEnded",
	"ReactionCollectorReactReq",
	"ReactionCollectorStop",
	"ReportBigEventResultRes",
	"ReportBuyHealAcceptedRes",
	"ReportBuyHealCannotHealOccupiedRes",
	"ReportBuyHealNoAlterationRes",
	"ReportBuyHealRefusedRes",
	"ReportBuyHealReq",
	"ReportReq",
	"ReportStayInCity",
	"ReportTokenMerchantBoughtRes",
	"ReportTokenMerchantCannotAffordRes",
	"ReportTokenMerchantCharityAlreadyUsedRes",
	"ReportTokenMerchantCharityRes",
	"ReportTokenMerchantFullRes",
	"ReportTokenMerchantRefusedRes",
	"ReportTokenMerchantTooMuchRes",
	"ReportTravelSummaryRes",
	"ReportUseTokensAcceptedRes",
	"ReportUseTokensRefusedRes",
	"ReportUseTokensReq",
	"SmallEventLotteryLoseRes",
	"SmallEventLotteryNoAnswerRes",
	"SmallEventLotteryPoorRes",
	"SmallEventLotteryWinRes",
	"SmallEventChoiceResultRes",
	"SmallEventResultRes",
	"SmallEventWitchResultRes"
];

const PACKETS_ROOT = join(__dirname, "../../../WsPackets/src");

const PACKET_DECLARATION = /export class (\w+) extends From(?:Client|Server)Packet \{(?<body>[\s\S]*?)\n\}/g;
const WIRE_NAME_DECLARATION = /static readonly wireName = "([^"]+)"/;

type DeclaredPacket = {
	className: string;
	wireName: string | null;
};

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true })
		.flatMap(entry => (entry.isDirectory()
			? sourceFiles(join(directory, entry.name))
			: [join(directory, entry.name)].filter(file => file.endsWith(".ts"))));
}

function declaredPackets(): DeclaredPacket[] {
	return sourceFiles(PACKETS_ROOT).flatMap(file => {
		const source = readFileSync(file, "utf8");
		return [...source.matchAll(PACKET_DECLARATION)].map(match => ({
			className: match[1],
			wireName: WIRE_NAME_DECLARATION.exec(match.groups!.body)?.[1] ?? null
		}));
	});
}

describe("packet wire names", () => {
	const packets = declaredPackets();

	it("finds the packet classes to check", () => {
		expect(packets.length).toBeGreaterThan(0);
	});

	it("declares an identifier on every packet", () => {
		expect(packets.filter(packet => packet.wireName === null).map(packet => packet.className)).toEqual([]);
	});

	it("never reuses an identifier", () => {
		const names = packets.map(packet => packet.wireName);
		expect(new Set(names).size).toBe(names.length);
	});

	it("matches the frozen protocol", () => {
		expect(packets.map(packet => packet.wireName).sort()).toEqual([...WIRE_NAMES].sort());
	});
});
