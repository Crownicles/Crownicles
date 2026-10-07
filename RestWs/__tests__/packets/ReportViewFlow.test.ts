import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandReportViewRes} from "../../../Lib/src/packets/commands/CommandReportViewPacket";
import {CommandReportTravelSummaryRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {ReactionCollectorCityData, ReactionCollectorExitCityReaction} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {ReportCityActionReq, ReportViewReq} from "../../../WsPackets/src/fromClient/ReportViewReq";
import ReportViewClientTranslator from "../../src/packets/fromClient/translators/ReportViewClientTranslator";
import ReportViewServerTranslator from "../../src/packets/fromServer/translators/ReportViewServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("read-only adventure protocol", () => {
	it("preserves the unstarted state without inventing a travel summary", async () => {
		const result = await ReportViewServerTranslator.view(CONTEXT, makePacket(CommandReportViewRes, {reportReady: true}));
		expect(result.reportReady).toBe(true);
		expect(result.travel).toBeUndefined();
		expect(result.city).toBeUndefined();
	});

	it("ignores a client identity and only forwards a validated city choice", async () => {
		expect(await ReportViewClientTranslator.view(CONTEXT, Object.assign(new ReportViewReq(), {keycloakId: "another-player"}))).toEqual({});
		const actionId = "a".repeat(64);
		expect(await ReportViewClientTranslator.action(CONTEXT, Object.assign(new ReportCityActionReq(), {mapLocationId: 23, actionId, keycloakId: "another-player"}))).toEqual({mapLocationId: 23, actionId});
		expect(() => ReportViewClientTranslator.action(CONTEXT, {mapLocationId: 1.5, actionId})).toThrow("Invalid city location");
		expect(() => ReportViewClientTranslator.action(CONTEXT, {mapLocationId: 23, actionId: "exitCity"})).toThrow("Invalid city action");
	});
	it("transports city choices without a collector identity or expiration", async () => {
		const travel = Object.assign(new CommandReportTravelSummaryRes(), {startMap: {id: 22, type: "fo"}, endMap: {id: 23, type: "ci"}, startTime: 0, arriveTime: 0, nextStopTime: 1, isOnBoat: false, points: {show: true, cumulated: 0}, energy: {show: false, current: 0, max: 0}, isInCity: true});
		const data = Object.assign(new ReactionCollectorCityData(), {mapTypeId: "ci", mapLocationId: 23, availableServices: [], inns: [], shops: [], energy: {current: 100, max: 100}, health: {current: 100, max: 100}, home: {}, apartmentNotary: {ownedApartments: []}});
		const result = await ReportViewServerTranslator.view(CONTEXT, makePacket(CommandReportViewRes, {travel, reportReady: false, city: {data, actions: [{id: "a".repeat(64), reaction: {type: ReactionCollectorExitCityReaction.name, data: {}}}]}}));
		expect(result.city?.data).toMatchObject({type: "city", data: {mapLocationId: 23}});
		expect(result.city?.actions[0].id).toBe("a".repeat(64));
		expect(result.city?.actions[0].reaction.type).toBe("cityExit");
		expect(result.city).not.toHaveProperty("endTime");
		expect(result.city).not.toHaveProperty("id");
		expect(JSON.stringify(result)).not.toContain("authenticated");
	});
});