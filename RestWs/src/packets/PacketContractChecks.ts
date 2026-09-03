import {
	CommandDrinkCancelDrink,
	CommandDrinkNoAvailablePotion,
	CommandDrinkPacketReq,
	CommandDrinkPacketRes
} from "../../../Lib/src/packets/commands/CommandDrinkPacket";
import {
	CommandGetCurrentReactionCollectorsPacket,
	CommandGetCurrentReactionCollectorsPacketRes
} from "../../../Lib/src/packets/commands/CommandGetCurrentReactionCollectorsPacket";
import {
	CommandInventoryPacketReq,
	CommandInventoryPacketRes
} from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import {
	CommandPetPacketReq,
	CommandPetPacketRes
} from "../../../Lib/src/packets/commands/CommandPetPacket";
import {
	CommandPingPacketReq,
	CommandPingPacketRes
} from "../../../Lib/src/packets/commands/CommandPingPacket";
import {
	CommandProfilePacketReq,
	CommandProfilePacketRes
} from "../../../Lib/src/packets/commands/CommandProfilePacket";
import {
	CommandReportPacketReq,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealPacketReq,
	CommandReportBuyHealRefusePacketRes,
	CommandReportBigEventResultRes,
	CommandReportStayInCity,
	CommandReportTokenMerchantBoughtRes,
	CommandReportTokenMerchantCannotAffordRes,
	CommandReportTokenMerchantCharityAlreadyUsedRes,
	CommandReportTokenMerchantCharityRes,
	CommandReportTokenMerchantFullRes,
	CommandReportTokenMerchantRefuseRes,
	CommandReportTokenMerchantTooMuchRes,
	CommandReportTravelSummaryRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensPacketReq,
	CommandReportUseTokensRefusePacketRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorEnded,
	ReactionCollectorReactPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import { ReactionCollectorStopPacket as ReactionCollectorStopPacketWithReason } from "../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { Item as LibItem } from "../../../Lib/src/types/Item";
import { MaterialQuantity as LibMaterialQuantity } from "../../../Lib/src/types/MaterialQuantity";
import { OwnedPet as LibOwnedPet } from "../../../Lib/src/types/OwnedPet";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { DrinkCancel } from "../../../WsPackets/src/fromServer/drink/DrinkCancel";
import { DrinkNoAvailablePotion } from "../../../WsPackets/src/fromServer/drink/DrinkNoAvailablePotion";
import { DrinkReq } from "../../../WsPackets/src/fromClient/DrinkReq";
import { DrinkRes } from "../../../WsPackets/src/fromServer/drink/DrinkRes";
import { CommandGetCurrentReactionCollectorsReq } from "../../../WsPackets/src/fromClient/GetCurrentReactionCollectorsReq";
import { CommandGetCurrentReactionCollectorsRes } from "../../../WsPackets/src/fromServer/getCurrentReactionCollectors/GetCurrentReactionCollectorsRes";
import { InventoryReq } from "../../../WsPackets/src/fromClient/InventoryReq";
import { InventoryRes } from "../../../WsPackets/src/fromServer/inventory/InventoryRes";
import { PetReq } from "../../../WsPackets/src/fromClient/PetReq";
import { PetRes } from "../../../WsPackets/src/fromServer/pet/PetRes";
import { PingReq } from "../../../WsPackets/src/fromClient/PingReq";
import { PingRes } from "../../../WsPackets/src/fromServer/ping/PingRes";
import { ProfileReq } from "../../../WsPackets/src/fromClient/ProfileReq";
import { ProfileRes } from "../../../WsPackets/src/fromServer/profile/ProfileRes";
import { ReportReq } from "../../../WsPackets/src/fromClient/ReportReq";
import { ReportBuyHealReq } from "../../../WsPackets/src/fromClient/ReportBuyHealReq";
import { ReportUseTokensReq } from "../../../WsPackets/src/fromClient/ReportUseTokensReq";
import { ReportTravelSummaryRes } from "../../../WsPackets/src/fromServer/report/ReportTravelSummaryRes";
import { ReportBigEventResultRes } from "../../../WsPackets/src/fromServer/report/ReportBigEventResultRes";
import { ReportStayInCity } from "../../../WsPackets/src/fromServer/report/ReportStayInCity";
import {
	ReportBuyHealAcceptedRes,
	ReportBuyHealCannotHealOccupiedRes,
	ReportBuyHealNoAlterationRes,
	ReportBuyHealRefusedRes
} from "../../../WsPackets/src/fromServer/report/ReportHealRes";
import {
	ReportTokenMerchantBoughtRes,
	ReportTokenMerchantCannotAffordRes,
	ReportTokenMerchantCharityAlreadyUsedRes,
	ReportTokenMerchantCharityRes,
	ReportTokenMerchantFullRes,
	ReportTokenMerchantRefusedRes,
	ReportTokenMerchantTooMuchRes,
	ReportUseTokensAcceptedRes,
	ReportUseTokensRefusedRes
} from "../../../WsPackets/src/fromServer/report/ReportTokenRes";
import {
	SmallEventLotteryLoseRes,
	SmallEventLotteryNoAnswerRes,
	SmallEventLotteryPoorRes,
	SmallEventLotteryWinRes
} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventLotteryRes";
import { ReactionCollectorCreation } from "../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import { ReactionCollectorEnded as WireReactionCollectorEnded } from "../../../WsPackets/src/fromServer/common/ReactionCollectorEnded";
import { ReactionCollectorReactReq } from "../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import { ReactionCollectorStop } from "../../../WsPackets/src/fromServer/common/ReactionCollectorStop";
import { MainItem } from "../../../WsPackets/src/objects/MainItem";
import { Item } from "../../../WsPackets/src/objects/Item";
import { MaterialQuantity } from "../../../WsPackets/src/objects/MaterialQuantity";
import { OwnedPet } from "../../../WsPackets/src/objects/OwnedPet";
import { SupportItem } from "../../../WsPackets/src/objects/SupportItem";
import { ValueAndMax } from "../../../WsPackets/src/objects/ValueAndMax";

type WireShape<Value> =
	[Value] extends [number] ? "number"
		: [Value] extends [string] ? "string"
			: [Value] extends [boolean] ? "boolean"
				: [Value] extends [readonly (infer Item)[]] ? readonly ["array", WireShape<NonNullable<Item>>]
					: [Value] extends [object] ? { [Key in keyof Value]: WireShape<NonNullable<Value[Key]>> }
						: "unknown";

type IsEqual<Left, Right> =
	(<Type>() => Type extends Left ? 1 : 2) extends
	(<Type>() => Type extends Right ? 1 : 2)
		? (<Type>() => Type extends Right ? 1 : 2) extends
		(<Type>() => Type extends Left ? 1 : 2) ? true : false
		: false;

type Assert<Condition extends true> = Condition;

type WirePacketFields<Packet> = Omit<Packet, "_typeLock">;

type SameKeys<Left, Right> = IsEqual<keyof Left, keyof Right>;

type RenameField<Packet, From extends keyof Packet, To extends PropertyKey> = Omit<Packet, From> & Record<To, Packet[From]>;

type DrinkRequestContract = Assert<IsEqual<WireShape<CommandDrinkPacketReq>, WireShape<WirePacketFields<DrinkReq>>>>;
type InventoryRequestContract = Assert<IsEqual<WireShape<CommandInventoryPacketReq>, WireShape<WirePacketFields<InventoryReq>>>>;
type PetRequestContract = Assert<IsEqual<WireShape<CommandPetPacketReq>, WireShape<WirePacketFields<PetReq>>>>;
type PingRequestContract = Assert<IsEqual<WireShape<CommandPingPacketReq>, WireShape<WirePacketFields<PingReq>>>>;
type ProfileRequestContract = Assert<IsEqual<WireShape<CommandProfilePacketReq>, WireShape<WirePacketFields<ProfileReq>>>>;
type CollectorsRequestContract = Assert<IsEqual<WireShape<CommandGetCurrentReactionCollectorsPacket>, WireShape<WirePacketFields<CommandGetCurrentReactionCollectorsReq>>>>;
type ReportRequestContract = Assert<IsEqual<WireShape<CommandReportPacketReq>, WireShape<WirePacketFields<ReportReq>>>>;
type ReportUseTokensRequestContract = Assert<IsEqual<WireShape<CommandReportUseTokensPacketReq>, WireShape<WirePacketFields<ReportUseTokensReq>>>>;
type ReportBuyHealRequestContract = Assert<IsEqual<WireShape<CommandReportBuyHealPacketReq>, WireShape<WirePacketFields<ReportBuyHealReq>>>>;

type DrinkResponseContract = Assert<IsEqual<WireShape<CommandDrinkPacketRes>, WireShape<WirePacketFields<DrinkRes>>>>;
type DrinkCancelContract = Assert<IsEqual<WireShape<CommandDrinkCancelDrink>, WireShape<WirePacketFields<DrinkCancel>>>>;
type DrinkUnavailableContract = Assert<IsEqual<WireShape<CommandDrinkNoAvailablePotion>, WireShape<WirePacketFields<DrinkNoAvailablePotion>>>>;
type InventoryResponseContract = Assert<IsEqual<
	WireShape<Omit<CommandInventoryPacketRes, "keycloakId">>,
	WireShape<WirePacketFields<InventoryRes>>
>>;
type PetResponseContract = Assert<IsEqual<
	WireShape<Omit<CommandPetPacketRes, "askedKeycloakId">>,
	WireShape<WirePacketFields<PetRes>>
>>;
type PingResponseContract = Assert<IsEqual<
	WireShape<RenameField<CommandPingPacketRes, "clientTime", "time">>,
	WireShape<WirePacketFields<PingRes>>
>>;
type ProfileResponseContract = Assert<IsEqual<
	WireShape<CommandProfilePacketRes["playerData"]>,
	WireShape<Omit<WirePacketFields<ProfileRes>, "pseudo">>
>>;
type ReportTravelSummaryContract = Assert<IsEqual<
	WireShape<CommandReportTravelSummaryRes>,
	WireShape<WirePacketFields<ReportTravelSummaryRes>>
>>;
type ReportStayInCityContract = Assert<IsEqual<
	WireShape<CommandReportStayInCity>,
	WireShape<WirePacketFields<ReportStayInCity>>
>>;
type ReportBigEventResultContract = Assert<IsEqual<
	WireShape<CommandReportBigEventResultRes>,
	WireShape<WirePacketFields<ReportBigEventResultRes>>
>>;
type ReportUseTokensAcceptedContract = Assert<IsEqual<
	WireShape<CommandReportUseTokensAcceptPacketRes>,
	WireShape<WirePacketFields<ReportUseTokensAcceptedRes>>
>>;
type ReportUseTokensRefusedContract = Assert<IsEqual<
	WireShape<CommandReportUseTokensRefusePacketRes>,
	WireShape<WirePacketFields<ReportUseTokensRefusedRes>>
>>;
type ReportBuyHealAcceptedContract = Assert<IsEqual<
	WireShape<CommandReportBuyHealAcceptPacketRes>,
	WireShape<WirePacketFields<ReportBuyHealAcceptedRes>>
>>;
type ReportBuyHealRefusedContract = Assert<IsEqual<
	WireShape<CommandReportBuyHealRefusePacketRes>,
	WireShape<WirePacketFields<ReportBuyHealRefusedRes>>
>>;
type ReportBuyHealNoAlterationContract = Assert<IsEqual<
	WireShape<CommandReportBuyHealNoAlterationPacketRes>,
	WireShape<WirePacketFields<ReportBuyHealNoAlterationRes>>
>>;
type ReportBuyHealCannotHealOccupiedContract = Assert<IsEqual<
	WireShape<CommandReportBuyHealCannotHealOccupiedPacketRes>,
	WireShape<WirePacketFields<ReportBuyHealCannotHealOccupiedRes>>
>>;
type ReportTokenMerchantBoughtContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantBoughtRes>,
	WireShape<WirePacketFields<ReportTokenMerchantBoughtRes>>
>>;
type ReportTokenMerchantTooMuchContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantTooMuchRes>,
	WireShape<WirePacketFields<ReportTokenMerchantTooMuchRes>>
>>;
type ReportTokenMerchantFullContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantFullRes>,
	WireShape<WirePacketFields<ReportTokenMerchantFullRes>>
>>;
type ReportTokenMerchantRefusedContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantRefuseRes>,
	WireShape<WirePacketFields<ReportTokenMerchantRefusedRes>>
>>;
type ReportTokenMerchantCannotAffordContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantCannotAffordRes>,
	WireShape<WirePacketFields<ReportTokenMerchantCannotAffordRes>>
>>;
type ReportTokenMerchantCharityContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantCharityRes>,
	WireShape<WirePacketFields<ReportTokenMerchantCharityRes>>
>>;
type ReportTokenMerchantCharityAlreadyUsedContract = Assert<IsEqual<
	WireShape<CommandReportTokenMerchantCharityAlreadyUsedRes>,
	WireShape<WirePacketFields<ReportTokenMerchantCharityAlreadyUsedRes>>
>>;
type SmallEventLotteryNoAnswerContract = Assert<IsEqual<
	WireShape<SmallEventLotteryNoAnswerPacket>,
	WireShape<WirePacketFields<SmallEventLotteryNoAnswerRes>>
>>;
type SmallEventLotteryPoorContract = Assert<IsEqual<
	WireShape<SmallEventLotteryPoorPacket>,
	WireShape<WirePacketFields<SmallEventLotteryPoorRes>>
>>;
type SmallEventLotteryWinContract = Assert<IsEqual<
	WireShape<SmallEventLotteryWinPacket>,
	WireShape<WirePacketFields<SmallEventLotteryWinRes>>
>>;
type SmallEventLotteryLoseContract = Assert<IsEqual<
	WireShape<SmallEventLotteryLosePacket>,
	WireShape<WirePacketFields<SmallEventLotteryLoseRes>>
>>;
type CollectorsResponseKeysContract = Assert<SameKeys<
	CommandGetCurrentReactionCollectorsPacketRes,
	WirePacketFields<CommandGetCurrentReactionCollectorsRes>
>>;
type CollectorCreationKeysContract = Assert<SameKeys<
	ReactionCollectorCreationPacket,
	WirePacketFields<ReactionCollectorCreation>
>>;
type CollectorEndedContract = Assert<IsEqual<
	WireShape<ReactionCollectorEnded>,
	WireShape<WirePacketFields<WireReactionCollectorEnded>>
>>;
type CollectorReactionContract = Assert<IsEqual<
	WireShape<RenameField<Omit<ReactionCollectorReactPacket, "keycloakId">, "id", "collectorId">>,
	WireShape<WirePacketFields<ReactionCollectorReactReq>>
>>;
type CollectorStopContract = Assert<IsEqual<
	WireShape<RenameField<ReactionCollectorStopPacketWithReason, "id", "collectorId">>,
	WireShape<WirePacketFields<ReactionCollectorStop>>
>>;

type MainItemContract = Assert<IsEqual<WireShape<MainItemDetails>, WireShape<MainItem>>>;
type ItemContract = Assert<IsEqual<WireShape<LibItem>, WireShape<Item>>>;
type MainItemStatContract = Assert<IsEqual<WireShape<MainItemDetails["attack"]>, WireShape<MainItem["attack"]>>>;
type MaterialQuantityContract = Assert<IsEqual<WireShape<LibMaterialQuantity>, WireShape<MaterialQuantity>>>;
type OwnedPetContract = Assert<IsEqual<WireShape<LibOwnedPet>, WireShape<OwnedPet>>>;
type SupportItemContract = Assert<IsEqual<WireShape<SupportItemDetails>, WireShape<SupportItem>>>;
type ValueAndMaxContract = Assert<IsEqual<WireShape<CommandProfilePacketRes["playerData"]["health"]>, WireShape<ValueAndMax>>>;

export const packetContractChecks: {
	drinkRequest: DrinkRequestContract;
	inventoryRequest: InventoryRequestContract;
	petRequest: PetRequestContract;
	pingRequest: PingRequestContract;
	profileRequest: ProfileRequestContract;
	collectorsRequest: CollectorsRequestContract;
	reportRequest: ReportRequestContract;
	reportUseTokensRequest: ReportUseTokensRequestContract;
	reportBuyHealRequest: ReportBuyHealRequestContract;
	drinkResponse: DrinkResponseContract;
	drinkCancel: DrinkCancelContract;
	drinkUnavailable: DrinkUnavailableContract;
	inventoryResponse: InventoryResponseContract;
	petResponse: PetResponseContract;
	pingResponse: PingResponseContract;
	profileResponse: ProfileResponseContract;
	reportTravelSummary: ReportTravelSummaryContract;
	reportStayInCity: ReportStayInCityContract;
	reportBigEventResult: ReportBigEventResultContract;
	reportUseTokensAccepted: ReportUseTokensAcceptedContract;
	reportUseTokensRefused: ReportUseTokensRefusedContract;
	reportBuyHealAccepted: ReportBuyHealAcceptedContract;
	reportBuyHealRefused: ReportBuyHealRefusedContract;
	reportBuyHealNoAlteration: ReportBuyHealNoAlterationContract;
	reportBuyHealCannotHealOccupied: ReportBuyHealCannotHealOccupiedContract;
	reportTokenMerchantBought: ReportTokenMerchantBoughtContract;
	reportTokenMerchantTooMuch: ReportTokenMerchantTooMuchContract;
	reportTokenMerchantFull: ReportTokenMerchantFullContract;
	reportTokenMerchantRefused: ReportTokenMerchantRefusedContract;
	reportTokenMerchantCannotAfford: ReportTokenMerchantCannotAffordContract;
	reportTokenMerchantCharity: ReportTokenMerchantCharityContract;
	reportTokenMerchantCharityAlreadyUsed: ReportTokenMerchantCharityAlreadyUsedContract;
	smallEventLotteryNoAnswer: SmallEventLotteryNoAnswerContract;
	smallEventLotteryPoor: SmallEventLotteryPoorContract;
	smallEventLotteryWin: SmallEventLotteryWinContract;
	smallEventLotteryLose: SmallEventLotteryLoseContract;
	collectorEnded: CollectorEndedContract;
	collectorReaction: CollectorReactionContract;
	collectorStop: CollectorStopContract;
	collectorsResponseKeys: CollectorsResponseKeysContract;
	collectorCreationKeys: CollectorCreationKeysContract;
	mainItem: MainItemContract;
	item: ItemContract;
	mainItemStat: MainItemStatContract;
	materialQuantity: MaterialQuantityContract;
	ownedPet: OwnedPetContract;
	supportItem: SupportItemContract;
	valueAndMax: ValueAndMaxContract;
} = {
	drinkRequest: true,
	inventoryRequest: true,
	petRequest: true,
	pingRequest: true,
	profileRequest: true,
	collectorsRequest: true,
	reportRequest: true,
	reportUseTokensRequest: true,
	reportBuyHealRequest: true,
	drinkResponse: true,
	drinkCancel: true,
	drinkUnavailable: true,
	inventoryResponse: true,
	petResponse: true,
	pingResponse: true,
	profileResponse: true,
	reportTravelSummary: true,
	reportStayInCity: true,
	reportBigEventResult: true,
	reportUseTokensAccepted: true,
	reportUseTokensRefused: true,
	reportBuyHealAccepted: true,
	reportBuyHealRefused: true,
	reportBuyHealNoAlteration: true,
	reportBuyHealCannotHealOccupied: true,
	reportTokenMerchantBought: true,
	reportTokenMerchantTooMuch: true,
	reportTokenMerchantFull: true,
	reportTokenMerchantRefused: true,
	reportTokenMerchantCannotAfford: true,
	reportTokenMerchantCharity: true,
	reportTokenMerchantCharityAlreadyUsed: true,
	smallEventLotteryNoAnswer: true,
	smallEventLotteryPoor: true,
	smallEventLotteryWin: true,
	smallEventLotteryLose: true,
	collectorEnded: true,
	collectorReaction: true,
	collectorStop: true,
	collectorsResponseKeys: true,
	collectorCreationKeys: true,
	mainItem: true,
	item: true,
	mainItemStat: true,
	materialQuantity: true,
	ownedPet: true,
	supportItem: true,
	valueAndMax: true
};
