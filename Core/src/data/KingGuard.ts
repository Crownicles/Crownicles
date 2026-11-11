import { readFileSync } from "fs";
import { SexTypeShort } from "../../../Lib/src/constants/StringConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";

/**
 * How a guard of the library is equipped, from the players who neglect their equipment to the ones who optimize everything
 */
export const KING_GUARD_PROFILES = {
	POORLY_EQUIPPED: "poorlyEquipped",
	AVERAGE: "average",
	WELL_EQUIPPED: "wellEquipped",
	OPTIMIZED: "optimized"
} as const;

export type KingGuardProfile = typeof KING_GUARD_PROFILES[keyof typeof KING_GUARD_PROFILES];

export type KingGuardMainItem = {
	id: number;
	level: number;
	enchantmentId: string | null;
};

export type KingGuardPetData = {
	typeId: number;
	sex: SexTypeShort;
};

/**
 * A guard of the library: its composition never changes, its rating lives in the king_guards table.
 * Its name is the translation kingGuards:names.{id}
 */
export type KingGuardData = {
	id: number;
	level: number;
	sex: SexTypeShort;
	classId: number;
	profile: KingGuardProfile;
	weapon: KingGuardMainItem;
	armor: KingGuardMainItem;

	// InventoryConstants.POTION_DEFAULT_ID when the guard has no fight potion
	potionId: number;
	objectId: number;
	pet: KingGuardPetData | null;

	// Rating given to the guard when it joins the king_guards table, estimated by a simulated tournament between the guards
	initialGlory: number;
};

/**
 * What a guard is made of, as drawn by the generator of the library: everything but its initial rating, estimated afterwards
 */
export type KingGuardComposition = Omit<KingGuardData, "initialGlory">;

export const KING_GUARD_LIBRARY_PATH = "resources/kingGuards/library.json";

/**
 * Library of the pre-generated king guards (see KingGuardLibraryGenerator), loaded on first use
 */
export class KingGuardDataController {
	private static loadedInstance: KingGuardDataController | null = null;

	private readonly guards: Map<number, KingGuardData>;

	private readonly guardsByLevel = new Map<number, KingGuardData[]>();

	private constructor(guards: KingGuardData[]) {
		this.guards = new Map(guards.map(guard => [guard.id, guard]));
		for (const guard of guards) {
			const guardsOfLevel = this.guardsByLevel.get(guard.level) ?? [];
			guardsOfLevel.push(guard);
			this.guardsByLevel.set(guard.level, guardsOfLevel);
		}
	}

	static get instance(): KingGuardDataController {
		KingGuardDataController.loadedInstance ??= new KingGuardDataController(
			JSON.parse(readFileSync(KING_GUARD_LIBRARY_PATH, "utf8")) as KingGuardData[]
		);
		return KingGuardDataController.loadedInstance;
	}

	public getById(id: number): KingGuardData | undefined {
		return this.guards.get(id);
	}

	public getAll(): KingGuardData[] {
		return [...this.guards.values()];
	}

	public getIds(): number[] {
		return [...this.guards.keys()];
	}

	/**
	 * Guards of the library closest in level to the given one, the library covering only FightConstants.KING_GUARD.LIBRARY levels
	 * @param level
	 */
	public getOfClosestLevel(level: number): KingGuardData[] {
		const {
			MIN_LEVEL, MAX_LEVEL
		} = FightConstants.KING_GUARD.LIBRARY;
		return this.guardsByLevel.get(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level))) ?? [];
	}
}
