import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportApartmentClaimRentRes, CommandReportTravelSummaryRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { CommandReportViewRes } from "../../../Lib/src/packets/commands/CommandReportViewPacket";
import {
	ReactionCollectorCityData, ReactionCollectorExitCityReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ApartmentRentRes } from "../../../WsPackets/src/fromServer/home/ApartmentRentRes";
import { getServerTranslator } from "../../src/packets/fromServer/FromServerTranslator";
import ApartmentRentServerTranslator from "../../src/packets/fromServer/translators/ApartmentRentServerTranslator";
import ReportViewServerTranslator from "../../src/packets/fromServer/translators/ReportViewServerTranslator";

const CONTEXT: PacketContext = {
	keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}
};

function apartment(apartmentId: number, isRented: boolean, accumulatedRent: number): object {
	return {
		apartmentId, cityId: `city-${apartmentId}`, mapLocationId: apartmentId, purchasePrice: 5000, accumulatedRent, isRented, canClaim: isRented && accumulatedRent >= 100
	};
}

describe("apartment rent", () => {
	it("tells the app the rent the notary just credited, for the apartment it came from", async () => {
		expect(getServerTranslator(CommandReportApartmentClaimRentRes.name)?.protoName).toBe(ApartmentRentRes.wireName);
		const translated = await ApartmentRentServerTranslator.claimed(CONTEXT, makePacket(CommandReportApartmentClaimRentRes, {
			cityId: "boug_coton", mapLocationId: 6, rentClaimed: 2700
		}));
		expect(translated).toMatchObject({
			mapLocationId: 6, rent: 2700
		});
	});

	it("counts only the let apartments in the rent waiting at the notary, a foothold earning none", async () => {
		const travel = Object.assign(new CommandReportTravelSummaryRes(), {
			startMap: {
				id: 22, type: "fo"
			},
			endMap: {
				id: 23, type: "ci"
			},
			startTime: 0,
			arriveTime: 0,
			nextStopTime: 1,
			isOnBoat: false,
			points: {
				show: true, cumulated: 0
			},
			energy: {
				show: false, current: 0, max: 0
			},
			isInCity: true
		});
		const data = Object.assign(new ReactionCollectorCityData(), {
			mapTypeId: "ci",
			mapLocationId: 23,
			availableServices: [],
			inns: [],
			shops: [],
			energy: {
				current: 100, max: 100
			},
			health: {
				current: 100, max: 100
			},
			home: {},
			apartmentNotary: { ownedApartments: [apartment(6, true, 2700), apartment(23, false, 2700)] }
		});
		const result = await ReportViewServerTranslator.view(CONTEXT, makePacket(CommandReportViewRes, {
			travel,
			reportReady: false,
			city: {
				data,
				actions: [
					{
						id: "a".repeat(64), reaction: {
							type: ReactionCollectorExitCityReaction.name, data: {}
						}
					}
				]
			}
		}));
		expect(result.city?.data).toMatchObject({ data: { snapshot: { apartmentNotary: {
			ownedCount: 2, accumulatedRent: 2700
		} } } });
	});
});
