import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SpaceConstants } from "../../../../Lib/src/constants/SpaceConstants";
import {
	NearEarthObject, SpaceUtils
} from "../utils/SpaceUtils";
import {
	MoonPhase, NextLunarEclipse, SearchLunarEclipse, SearchMoonQuarter
} from "../utils/Astronomy";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventSpaceInitialPacket, SmallEventSpaceResultPacket, SpaceFunctionResult
} from "../../../../Lib/src/packets/smallEvents/SmallEventSpacePacket";
import { PacketUtils } from "../utils/PacketUtils";
import { MissionsController } from "../missions/MissionsController";

// External library connections, naming conventions can't be easily applied
/* eslint-disable new-cap */

/**
 * Gives an object that is going close to earth
 */
async function neoWS(): Promise<SpaceFunctionResult> {
	let neoWSFeed: NearEarthObject[];
	try {
		neoWSFeed = await SpaceUtils.getNeoWSFeed();
	}
	catch {
		// If the request failed, return null
		neoWSFeed = [];
	}

	// Check if the list contains an object
	if (neoWSFeed.length > 0) {
		const randomObject: NearEarthObject = RandomUtils.crowniclesRandom.pick(neoWSFeed);
		return {
			mainValue: neoWSFeed.length,
			randomObjectName: randomObject.name,
			randomObjectDistance: Math.floor(parseInt(randomObject.close_approach_data[0].miss_distance.kilometers, 10) / 1000000),
			randomObjectDiameter: Math.floor((randomObject.estimated_diameter.meters.estimated_diameter_max + randomObject.estimated_diameter.meters.estimated_diameter_min) / 2)
		};
	}

	// If the list is empty, return a random invented object
	return {
		mainValue: 1,
		randomObjectName: RandomUtils.crowniclesRandom.pick(SpaceConstants.INVENTED_ASTEROIDS_NAMES),
		randomObjectDistance: RandomUtils.rangedInt(SpaceConstants.DISTANCE_RANGE),
		randomObjectDiameter: RandomUtils.rangedInt(SpaceConstants.DIAMETER_RANGE)
	};
}

/**
 * Gives when the next moon phase is occurring
 */
function moonPhase(): SpaceFunctionResult {
	return { mainValue: SearchMoonQuarter(new Date()).quarter };
}

/**
 * Gives when the next full moon is occurring
 */
function nextFullMoon(): SpaceFunctionResult {
	let days = 0;
	const currDate = new Date();
	let currDegrees = MoonPhase(currDate);
	let nextDegrees = MoonPhase(new Date(currDate.getDate() + 1));
	while (currDegrees > 180 || nextDegrees <= 180) {
		currDegrees = nextDegrees;
		currDate.setDate(currDate.getDate() + 1);
		nextDegrees = MoonPhase(currDate);
		days++;
	}
	return { mainValue: days };
}

/**
 * Gives when the next eclipse of a kind is occurring
 */
function nextEclipse(kind: string): SpaceFunctionResult {
	let eclipse = SearchLunarEclipse(new Date());
	while (eclipse.kind !== kind) {
		eclipse = NextLunarEclipse(eclipse.peak);
	}
	return { mainValue: Math.floor((eclipse.peak.date.valueOf() - new Date().valueOf()) / (1000 * 3600 * 24)) };
}

/**
 * Gives when the next partial lunar eclipse is coming
 */
function nextPartialLunarEclipse(): SpaceFunctionResult {
	return nextEclipse(SpaceConstants.PARTIAL_LUNAR_ECLIPSE);
}

/**
 * Gives when the next total lunar eclipse is coming
 */
function nextTotalLunarEclipse(): SpaceFunctionResult {
	return nextEclipse(SpaceConstants.TOTAL_LUNAR_ECLIPSE);
}

// Map the functions to the keys
const spaceFunctions = {
	neoWS,
	moonPhase,
	nextFullMoon,
	nextPartialLunarEclipse,
	nextTotalLunarEclipse
};

/**
 * Second part of the small event, where the astronomer is looking to the sky
 * @param context
 */
async function astronomyEvent(context: PacketContext): Promise<void> {
	let availableSpaceFunctions = Object.keys(spaceFunctions);
	if (nextFullMoon().mainValue === 0) {
		availableSpaceFunctions = availableSpaceFunctions.filter(e => e !== SpaceConstants.FUNCTIONS.nextFullMoon);
	}
	const specificEvent = RandomUtils.crowniclesRandom.pick(availableSpaceFunctions) as keyof typeof spaceFunctions;
	const t0 = performance.now();
	const result = await spaceFunctions[specificEvent]();
	const timeLeft = Math.max(SpaceConstants.WAIT_TIME_BEFORE_SEARCH - (performance.now() - t0), 0);
	setTimeout(() => {
		PacketUtils.sendPackets(context, [
			makePacket(SmallEventSpaceResultPacket, {
				chosenEvent: specificEvent,
				values: result
			})
		]);
	}, timeLeft);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	async executeSmallEvent(response, player, context): Promise<void> {
		// Update oracle missions for space oracle
		await MissionsController.update(player, response, {
			missionId: "meetOracle",
			params: { tags: ["meetOracleSpace"] }
		});
		await MissionsController.update(player, response, {
			missionId: "meetAllOracles",
			params: { oracleId: "space" }
		});

		response.push(makePacket(SmallEventSpaceInitialPacket, {}));
		await astronomyEvent(context);
	}
};
