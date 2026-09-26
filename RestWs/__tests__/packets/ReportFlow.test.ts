import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportPacketReq,
	CommandReportBigEventResultRes,
	CommandReportStayInCity,
	CommandReportTravelSummaryRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {makeFromClientPacket} from "../../../WsPackets/src/MakePackets";
import {ReportReq} from "../../../WsPackets/src/fromClient/ReportReq";
import {ReportTravelSummaryRes} from "../../../WsPackets/src/fromServer/report/ReportTravelSummaryRes";
import {ReportBigEventResultRes} from "../../../WsPackets/src/fromServer/report/ReportBigEventResultRes";
import {ReportStayInCity} from "../../../WsPackets/src/fromServer/report/ReportStayInCity";
import {
	getClientTranslator
} from "../../src/packets/fromClient/FromClientTranslator";
import ReportCommandClientTranslator from "../../src/packets/fromClient/translators/ReportCommandClientTranslator";
import {
	getServerTranslator
} from "../../src/packets/fromServer/FromServerTranslator";
import ReportCommandServerTranslator from "../../src/packets/fromServer/translators/ReportCommandServerTranslator";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		webSocket: {}
	};
}

function overTheWire<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function travelSummaryPacket(withOptionalFields: boolean): CommandReportTravelSummaryRes {
	return makePacket(CommandReportTravelSummaryRes, {
		startMap: {id: 1, type: "main"},
		endMap: {id: 2, type: "main"},
		startTime: 1_700_000_000_000,
		arriveTime: 1_700_007_200_000,
		nextStopTime: 1_700_003_600_000,
		isOnBoat: false,
		...(withOptionalFields ? {
			effect: "occupied",
			effectDuration: 300_000,
			effectEndTime: 1_700_001_300_000,
			lastSmallEventId: "small-event",
			tokens: {cost: 2, canAfford: true},
			heal: {price: 50, canAfford: false}
		} : {}),
		points: {show: true, cumulated: 12},
		energy: {show: true, current: 8, max: 10},
		isInCity: false
	});
}

function bigEventResultPacket(withEffect: boolean): CommandReportBigEventResultRes {
	return makePacket(CommandReportBigEventResultRes, {
		eventId: 19,
		possibilityId: "cook",
		outcomeId: "success",
		score: 15,
		experience: 10,
		...(withEffect ? {effect: {name: "slowed", time: 300_000}} : {}),
		health: -3,
		money: 20,
		energy: -2,
		gems: 1,
		tokens: 0,
		oneshot: false
	});
}

describe("/report over the WebSocket protocol", () => {
	it("registers the request and travel summary translators", () => {
		expect(getClientTranslator(ReportReq.name)).toBeDefined();
		expect(getServerTranslator(CommandReportTravelSummaryRes.name)).toMatchObject({
			protoName: ReportTravelSummaryRes.name
		});
		expect(getServerTranslator(CommandReportBigEventResultRes.name)).toMatchObject({
			protoName: ReportBigEventResultRes.name
		});
		expect(getServerTranslator(CommandReportStayInCity.name)).toMatchObject({
			protoName: ReportStayInCity.name
		});
	});

	it("turns a client request into the command the back end expects", async () => {
		const translated = await ReportCommandClientTranslator.translate(context(), makeFromClientPacket(ReportReq, {}));

		expect(translated).toBeInstanceOf(CommandReportPacketReq);
	});

	it("transports every travel summary field", async () => {
		const source = travelSummaryPacket(true);
		const translated = await ReportCommandServerTranslator.translate(context(), source);

		expect(translated).toBeInstanceOf(ReportTravelSummaryRes);
		expect(overTheWire(translated)).toStrictEqual(overTheWire(source));
	});

	it("does not add absent optional fields to the wire packet", async () => {
		const translated = await ReportCommandServerTranslator.translate(context(), travelSummaryPacket(false));

		expect(translated).not.toHaveProperty("effect");
		expect(translated).not.toHaveProperty("effectDuration");
		expect(translated).not.toHaveProperty("effectEndTime");
		expect(translated).not.toHaveProperty("lastSmallEventId");
		expect(translated).not.toHaveProperty("tokens");
		expect(translated).not.toHaveProperty("heal");
	});

	it("transports the result of a big-event possibility", async () => {
		const source = bigEventResultPacket(true);
		const translated = await ReportCommandServerTranslator.translateBigEventResult(context(), source);

		expect(translated).toBeInstanceOf(ReportBigEventResultRes);
		expect(overTheWire(translated)).toStrictEqual(overTheWire(source));
	});

	it("does not fabricate a missing big-event effect", async () => {
		const translated = await ReportCommandServerTranslator.translateBigEventResult(context(), bigEventResultPacket(false));

		expect(translated).not.toHaveProperty("effect");
	});

	it("transports the automatic city-stay signal", async () => {
		const translated = await ReportCommandServerTranslator.translateStayInCity(context(), makePacket(CommandReportStayInCity, {}));

		expect(translated).toBeInstanceOf(ReportStayInCity);
		expect(overTheWire(translated)).toStrictEqual({});
	});
});
