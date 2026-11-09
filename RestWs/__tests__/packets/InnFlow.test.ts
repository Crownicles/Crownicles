import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBedCooldownRes, CommandReportEatInnMealCooldownRes, CommandReportEatInnMealRes, CommandReportSleepRoomRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {ReactionCollectorCityData} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import InnServerTranslator from "../../src/packets/fromServer/translators/InnServerTranslator";
import {mapCitySnapshot} from "../../src/packets/fromServer/collectors/mappings/CitySnapshotMapping";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

function city(innCooldowns?: ReactionCollectorCityData["innCooldowns"]): ReactionCollectorCityData {
	return Object.assign(new ReactionCollectorCityData(), {
		mapTypeId: "ci", mapLocationId: 23, availableServices: [], inns: [{innId: "inn", meals: [], rooms: []}], shops: [],
		energy: {current: 100, max: 100}, health: {current: 100, max: 100}, home: {}, apartmentNotary: {ownedApartments: []},
		...innCooldowns ? {innCooldowns} : {}
	});
}

describe("inn protocol", () => {
	it("tells what a meal or a room just gave", async () => {
		expect((await InnServerTranslator.meal(CONTEXT, makePacket(CommandReportEatInnMealRes, {energy: 40, moneySpent: 15}))).outcome)
			.toEqual({type: "meal", energy: 40, moneySpent: 15});
		expect((await InnServerTranslator.room(CONTEXT, makePacket(CommandReportSleepRoomRes, {roomId: "suite", health: 60, moneySpent: 30}))).outcome)
			.toEqual({type: "room", roomId: "suite", health: 60, moneySpent: 30});
	});

	it("answers a refused meal or bed with the time it is served again, instead of staying silent", async () => {
		expect((await InnServerTranslator.mealCooldown(CONTEXT, makePacket(CommandReportEatInnMealCooldownRes, {nextAvailableAt: 1_000}))).outcome)
			.toEqual({type: "mealCooldown", nextAvailableAt: 1_000});
		expect((await InnServerTranslator.bedCooldown(CONTEXT, makePacket(CommandReportBedCooldownRes, {nextAvailableAt: 2_000}))).outcome)
			.toEqual({type: "bedCooldown", nextAvailableAt: 2_000});
	});

	it("carries the inn cooldowns Core computed into the city snapshot", () => {
		expect(mapCitySnapshot(city({mealAvailableAt: 5_000})).innCooldowns).toEqual({mealAvailableAt: 5_000});
		expect(mapCitySnapshot(city())).not.toHaveProperty("innCooldowns");
	});
});
