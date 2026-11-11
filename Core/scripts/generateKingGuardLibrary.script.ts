import { it } from "vitest";
import {
	existsSync, readdirSync, readFileSync, writeFileSync
} from "fs";
import { resolve } from "path";
import { Sequelize } from "sequelize";
import {
	MersenneTwister19937, Random
} from "random-js";
import { initModel as initPlayer } from "../src/core/database/game/models/Player";
import { initModel as initPetEntity } from "../src/core/database/game/models/PetEntity";
import { FightActionDataController } from "../src/data/FightAction";
import { FightAlterationDataController } from "../src/data/FightAlteration";
import { PetAssistanceDataController } from "../src/data/PetAssistance";
import {
	completeKingGuardLibrary, generateKingGuardLibrary, KING_GUARD_LIBRARY_SEED
} from "../src/core/fights/kingGuards/library/KingGuardLibraryGenerator";
import {
	alignKingGuardsRatings, calibrateKingGuards
} from "../src/core/fights/kingGuards/library/KingGuardLibraryCalibration";
import {
	KING_GUARD_LIBRARY_PATH, KingGuardData
} from "../src/data/KingGuard";
import { initializeAllClassBehaviors } from "../src/core/fights/AiBehaviorController";
import { initializeAllPetBehaviors } from "../src/core/fights/PetAssistManager";
import { RandomUtils } from "../../Lib/src/utils/RandomUtils";
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";

/**
 * The fight engine requires its actions, alterations and pet assistances from the compiled files of the bot: the tool,
 * running the TypeScript sources, fills their caches with the source modules instead
 */
async function loadFightFunctionsFromSources(): Promise<void> {
	const loadFolder = async (folder: string): Promise<[string, unknown][]> => {
		const entries: [string, unknown][] = [];
		for (const file of readdirSync(`src/${folder}`).filter(name => name.endsWith(".ts"))) {
			const name = file.substring(0, file.length - 3);
			entries.push([name, (await import(/* @vite-ignore */ resolve(`src/${folder}/${file}`)) as { default: unknown }).default]);
		}
		return entries;
	};

	// The caches are private to the data controllers, which only know how to fill them from the compiled files
	(FightActionDataController as unknown as { fightActionsFunctionsCache: Map<string, unknown> }).fightActionsFunctionsCache = new Map([
		...await loadFolder("core/fights/actions/interfaces/players"),
		...await loadFolder("core/fights/actions/interfaces/monsters")
	]);
	(FightAlterationDataController as unknown as { fightAlterationsFunctionsCache: Map<string, unknown> }).fightAlterationsFunctionsCache
		= new Map(await loadFolder("core/fights/actions/interfaces/alterations"));
	(PetAssistanceDataController as unknown as { petAssistanceFunctionsCache: Map<string, unknown> }).petAssistanceFunctionsCache
		= new Map(await loadFolder("core/fights/actions/interfaces/pets"));
}

/*
 * Complete the library of the king guards so that every level has its guards, and estimate the initial rating of the new
 * guards with a simulated tournament between all the guards. The guards already in the library are never changed: their
 * rating, their name and the logs of their fights are tied to their id. Each new guard needs a unique first name in
 * Lang/fr/kingGuards.json, which the data test of the library checks.
 * Run with `pnpm generateKingGuardLibrary` from the Core folder (KING_GUARD_CALIBRATION_ROUNDS shortens the tournament for a try)
 */
it("completes the library of the king guards", async () => {
	const library: KingGuardData[] = existsSync(KING_GUARD_LIBRARY_PATH)
		? JSON.parse(readFileSync(KING_GUARD_LIBRARY_PATH, "utf8")) as KingGuardData[]
		: [];

	// The guards are unsaved players and pets: their models only need to be defined, the database is never reached
	const sequelize = new Sequelize({
		dialect: "mariadb", logging: false
	});
	initPlayer(sequelize);
	initPetEntity(sequelize);
	CrowniclesLogger.init("warn", ["console"], { app: "KingGuardLibrary" });
	await loadFightFunctionsFromSources();

	// Registered at the start of the bot: without them, the pets never assist and the guards have no scripted fallback
	initializeAllClassBehaviors();
	initializeAllPetBehaviors();

	/*
	 * The composition of the new guards only depends on the seed. The fights draw most of their randomness from the game's
	 * generator, seeded here too, but some actions use Math.random: the ratings vary by a few dozen points from one run to another
	 */
	RandomUtils.crowniclesRandom = new Random(MersenneTwister19937.seed(KING_GUARD_LIBRARY_SEED));

	const newGuards = completeKingGuardLibrary(library, generateKingGuardLibrary());
	if (newGuards.length === 0) {
		console.log("Every level of the library has its guards: nothing to add");
		return;
	}
	const guards: KingGuardData[] = [
		...library,
		...newGuards.map(guard => ({
			...guard,
			initialGlory: 0
		}))
	];
	const startTime = Date.now();
	const ratings = await calibrateKingGuards(guards, {
		seed: KING_GUARD_LIBRARY_SEED,
		...process.env.KING_GUARD_CALIBRATION_ROUNDS ? { rounds: Number(process.env.KING_GUARD_CALIBRATION_ROUNDS) } : {},
		onRoundEnd: (round, fights) => {
			const draws = fights.filter(fight => fight.firstScore === 0.5).length;
			console.log(`Round ${round + 1}: ${fights.length} fights, ${draws} draws, ${Math.round((Date.now() - startTime) / 1000)} s`);
		}
	});
	const initialRatings = library.length === 0 ? ratings : alignKingGuardsRatings(library, ratings);

	// One guard per line, so that the changes of the library stay readable in a diff
	const lines = guards.map(guard => `\t${JSON.stringify({
		...guard,
		initialGlory: initialRatings.get(guard.id)!
	})}`);
	writeFileSync(KING_GUARD_LIBRARY_PATH, `[\n${lines.join(",\n")}\n]\n`);
	console.log(`${newGuards.length} guards added (ids ${newGuards[0].id} to ${newGuards[newGuards.length - 1].id}): give each one a unique first name in Lang/fr/kingGuards.json`);
});
