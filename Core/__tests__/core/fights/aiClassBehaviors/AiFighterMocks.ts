import { FightActionDataController } from "../../../../src/data/FightAction";
import { FightAlterationDataController } from "../../../../src/data/FightAlteration";
import type { AiPlayerFighter } from "../../../../src/core/fights/fighter/AiPlayerFighter";
import type { FightView } from "../../../../src/core/fights/FightView";

/**
 * Mutable state of a mocked fighter: tests can change it between two decisions of an AI
 */
export type MockFighterState = {
	classId?: number;
	breath?: number;
	maxBreath?: number;
	regenBreath?: number;
	energy?: number;
	maxEnergy?: number;
	speed?: number;
	defense?: number;
	alterationId?: string | null;
	lastActionId?: string | null;
	history?: string[];
	actions?: string[];
};

const getAction = (id: string): ReturnType<typeof FightActionDataController.instance.getById> => FightActionDataController.instance.getById(id);

/**
 * Fighter exposing only what the AI class behaviors read, backed by a mutable state
 * @param state
 */
export function mockFighter(state: MockFighterState = {}): AiPlayerFighter {
	return {
		player: {
			get class(): number {
				return state.classId ?? 0;
			}
		},
		get alteration(): ReturnType<typeof FightAlterationDataController.instance.getById> | null {
			return state.alterationId ? FightAlterationDataController.instance.getById(state.alterationId) ?? null : null;
		},
		get fightActionsHistory(): ReturnType<typeof getAction>[] {
			return (state.history ?? []).map(getAction);
		},
		get availableFightActions(): Map<string, ReturnType<typeof getAction>> {
			return new Map((state.actions ?? []).map(id => [id, getAction(id)]));
		},
		getBreath: (): number => state.breath ?? 10,
		getMaxBreath: (): number => state.maxBreath ?? 16,
		getRegenBreath: (): number => state.regenBreath ?? 4,
		getEnergy: (): number => state.energy ?? 1000,
		getMaxEnergy: (): number => state.maxEnergy ?? 1000,
		getSpeed: (): number => state.speed ?? 100,
		getDefense: (): number => state.defense ?? 100,
		hasFightAlteration: (): boolean => Boolean(state.alterationId),
		getLastFightActionUsed: (): ReturnType<typeof getAction> | null => (state.lastActionId ? getAction(state.lastActionId) : null)
	} as unknown as AiPlayerFighter;
}

/**
 * Fight view in which the given opponent is the defending fighter at the given turn
 * @param turn
 * @param opponent
 */
export function mockFightView(turn: number, opponent: AiPlayerFighter): FightView {
	return {
		fightController: {
			turn,
			getDefendingFighter: (): AiPlayerFighter => opponent
		}
	} as unknown as FightView;
}
