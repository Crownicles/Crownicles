import {act, fireEvent, render, screen, within} from "@testing-library/react-native";
import {AccessibilityInfo, Animated, StyleSheet} from "react-native";
import {FightConfirmCollector, FightActions} from "@/src/collectors/FightActionCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {fightStore, FightSnapshot} from "@/src/store/FightStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FightIntroductionRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightLiveView} from "@/src/components/FightBattle";
import {FightFighter} from "ws-packets/src/objects/Fight";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {FightEffects} from "@/src/components/FightEffects";
import {fightCue} from "@/src/display/FightMotion";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@react-native-async-storage/async-storage", () => ({getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined)}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

describe("fight collectors", () => {
	afterEach(() => fightStore.reset());
	it("keeps action positions stable and exposes details without submitting", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: {fightId: "duel", initiator: {isSelf: true}, opponent: {isSelf: false}, initiatorActions: [["heavyAttack", 7], ["simpleAttack", 2], ["resting", 0]], opponentActions: []}});
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "stable-turn", endTime: Date.now() + 60_000, data: {type: "fightAction", data: {fightId: "duel"}}, reactions: [{type: "fightAction", data: {id: "resting"}}, {type: "fightAction", data: {id: "simpleAttack"}}]});
		const choose = jest.fn();
		await render(<FightActions collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getByRole("button", {name: "models:fight_actions.heavyAttack.name"})).toBeDisabled();
		await fireEvent.press(screen.getAllByRole("button", {name: "app:battle.actionDetails"})[0]);
		expect(screen.getByText("models:fight_actions.heavyAttack.description")).toBeTruthy();
		expect(choose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:common.back"));
		await fireEvent.press(screen.getByText("models:fight_actions.simpleAttack.name"));
		expect(choose).toHaveBeenCalledWith(1);
	});
	it("lets the player cancel preparation at the original refusal index", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "confirm", endTime: Date.now() + 60_000, data: {type: "fightConfirm", data: {playerStats: {classId: 1, fightRanking: {glory: 500}, energy: {value: 90, max: 100}, attack: 10, defense: 5, speed: 8, breath: {base: 3, max: 10, regen: 2}}}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const choose = jest.fn();
		await render(<FightConfirmCollector collector={collector} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(choose).toHaveBeenCalledWith(2);
	});
	it("sends the original action index once even if the player taps twice", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "turn", endTime: Date.now() + 60_000, data: {type: "fightAction", data: {fightId: "duel"}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "fightAction", data: {id: "rest"}}, {type: "fightAction", data: {id: "simpleAttack"}}]});
		const choose = jest.fn();
		await render(<FightActions collector={collector} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:fight_actions.rest.name"));
		await fireEvent.press(screen.getByText("models:fight_actions.rest.name"));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(1);
	});
});

function battle(): FightSnapshot {
	const fighter: FightFighter = {isSelf: true, name: "Aster", classId: 1, level: 10, stats: {power: 80, maxEnergy: 100, attack: 15, defense: 12, speed: 20, breath: 6, maxBreath: 10, breathRegen: 2}};
	return {introduction: {fightId: "screen", initiator: fighter, opponent: {...fighter, name: "Arsene", isSelf: false}, initiatorActions: [["simpleAttack", 2]], opponentActions: []}, status: {fightId: "screen", numberOfTurn: 3, maxNumberOfTurn: 26, activeFighter: {...fighter, name: "Arsene", isSelf: false}, defendingFighter: fighter}, logs: [], result: null, reward: null, error: null, visible: true, waiting: true, playedSequence: 0};
}

describe("live battle presentation", () => {
	beforeEach(() => jest.mocked(AsyncStorage.getItem).mockResolvedValue(null));
	afterEach(() => {jest.restoreAllMocks(); jest.useRealTimers();});
	it("leaves animation speed in the app settings", async () => {
		await render(<FightLiveView fight={battle()} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.queryByRole("switch", {name: "app:battle.speed.fast"})).toBeNull();
	});
	it("shows a recoverable refusal without a fake waiting battle", async () => {
		const close = jest.fn();
		await render(<FightLiveView fight={{...battle(), introduction: null, status: null, error: "energy"}} onChoose={jest.fn()} submitting={false} onClose={close} />);
		expect(screen.getByText("app:arena.errors.energy")).toBeTruthy();
		expect(screen.queryByText("app:battle.preparing")).toBeNull();
		await fireEvent.press(screen.getByText("app:battle.returnToArena"));
		expect(close).toHaveBeenCalledTimes(1);
	});
	it("offers a single history button during combat", async () => {
		await render(<FightLiveView fight={battle()} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.getAllByRole("button", {name: "app:battle.showHistory"})).toHaveLength(1);
		expect(screen.queryByRole("button", {name: "app:arena.log"})).toBeNull();
	});
	it("keeps the player on the left during an opponent turn and exposes fighter details", async () => {
		await render(<FightLiveView fight={battle()} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(within(screen.getByTestId("fight-fighter-self")).getByText("Aster")).toBeTruthy();
		expect(within(screen.getByTestId("fight-fighter-opponent")).getByText("Arsene")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.details : Aster"}));
		expect(screen.getAllByText("app:arena.stats.attack").length).toBeGreaterThan(0);
		expect(screen.getAllByText("15").length).toBeGreaterThan(0);
	});
	it("shows both fighters' current statistics without opening their details", async () => {
		const initial = battle();
		const view = await render(<FightLiveView fight={initial} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(within(screen.getByTestId("fight-stat-attack-self")).getByText("15")).toBeTruthy();
		expect(within(screen.getByTestId("fight-stat-defense-opponent")).getByText("12")).toBeTruthy();
		expect(within(screen.getByTestId("fight-stat-speed-opponent")).getByText("20")).toBeTruthy();
		const status = initial.status!;
		await view.rerender(<FightLiveView fight={{...initial, status: {...status, defendingFighter: {...status.defendingFighter, stats: {...status.defendingFighter.stats, attack: 31, defense: 25}}}}} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(within(screen.getByTestId("fight-stat-attack-self")).getByText("31")).toBeTruthy();
		expect(within(screen.getByTestId("fight-stat-defense-self")).getByText("25")).toBeTruthy();
	});
	it("waits for the final animation before revealing victory and retains the full journal", async () => {
		jest.useFakeTimers();
		let finish: ((result: {finished: boolean}) => void) | undefined;
		jest.spyOn(Animated, "timing").mockImplementation((_value, config) => ({start: callback => {if (config.useNativeDriver) finish = callback;}, stop: jest.fn(), reset: jest.fn()}));
		const initial = battle();
		const view = await render(<FightLiveView fight={initial} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		const final = {...initial, logs: [{sequence: 1, before: initial.status!, entry: {fightId: "screen", fighter: {isSelf: true}, fightActionId: "heavyAttack", status: "critical", fightActionEffectDealt: {damages: 80}}}], result: {winner: {isSelf: true, name: "Aster", finalEnergy: 80, maxEnergy: 100}, loser: {isSelf: false, name: "Arsene", finalEnergy: 0, maxEnergy: 100}, draw: false, turns: 3, maxTurns: 26}};
		await view.rerender(<FightLiveView fight={final} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.queryByText("app:arena.victory")).toBeNull();
		expect(screen.getByTestId("fight-effect-heavy", {includeHiddenElements: true})).toBeTruthy();
		await act(() => finish?.({finished: true}));
		expect(screen.queryByText("app:arena.victory")).toBeNull();
		await act(() => jest.advanceTimersByTime(6500));
		expect(screen.getByText("app:arena.victory")).toBeTruthy();
		await fireEvent.press(screen.getAllByRole("button", {name: "app:arena.log"})[0]);
		expect(screen.getByText("models:fight_actions.heavyAttack.name")).toBeTruthy();
	});
	it("omits moving visual effects when reduced motion is enabled", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		const initial = battle();
		const view = await render(<FightLiveView fight={initial} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		await act(async () => undefined);
		await view.rerender(<FightLiveView fight={{...initial, logs: [{sequence: 1, before: initial.status!, entry: {fightId: "screen", fighter: {isSelf: true}, fightActionId: "fireAttack", status: "normal"}}]}} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.queryByTestId("fight-effect-flame", {includeHiddenElements: true})).toBeNull();
	});
	it("shows the assisting pet for an action that arrived before the battle view mounted", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
		jest.spyOn(Animated, "timing").mockReturnValue({start: jest.fn(), stop: jest.fn(), reset: jest.fn()});
		const initial = battle();
		const pet = {typeId: 1, nickname: "Milo", rarity: 1, sex: "m" as const, loveLevel: 5, force: 10, feedDelay: 0};
		await render(<FightLiveView fight={{...initial, logs: [{sequence: 1, before: initial.status!, entry: {fightId: "screen", fighter: {isSelf: true, name: "Aster"}, fightActionId: "stealWeapon", status: "success", pet}}]}} onChoose={jest.fn()} submitting={false} onClose={jest.fn()} />);
		expect(screen.getByTestId("fight-active-pet").props.accessibilityLabel).toBe("Milo");
		expect(screen.getByTestId("fight-particle-stolen-weapon", {includeHiddenElements: true})).toBeTruthy();
	});
});

describe("rendered attack trajectories", () => {
	it.each(["normal", "critical", "missed", "maxUses"])("gives cannon outcome %s its own visible behavior", async status => {
		const damages = status === "normal" || status === "critical" ? 27 : 0;
		const cue = fightCue({fightId: "outcome", fighter: {isSelf: true}, fightActionId: "canonAttack", status, fightActionEffectDealt: {damages}});
		await render(<FightEffects cue={cue} progress={new Animated.Value(0.44)} width={400} />);
		const find = (id: string): ReturnType<typeof screen.queryByTestId> => screen.queryByTestId(`fight-particle-${id}`, {includeHiddenElements: true});
		expect(Boolean(find("cannon-shell"))).toBe(status !== "maxUses");
		expect(Boolean(find("cannon-impact-ring"))).toBe(damages > 0);
		expect(Boolean(find("cannon-critical-pressure"))).toBe(status === "critical");
		expect(Boolean(find("failed-preparation"))).toBe(status === "maxUses");
		if (damages) expect(screen.getAllByText("-27", {includeHiddenElements: true})).toHaveLength(1);
	});
	it("winds up a heavy weapon at its owner before striking with a short impact", async () => {
		const progress = new Animated.Value(0.2);
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf: true}, fightActionId: "heavyAttack", status: "normal"});
		await render(<FightEffects cue={cue} progress={progress} width={400} />);
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-raised-weapon", {includeHiddenElements: true}).props.style).transform).toEqual(expect.arrayContaining([{translateX: 94}, {translateY: -32}]));
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-downward-impact", {includeHiddenElements: true}).props.style).opacity).toBe(0);
		await act(() => progress.setValue(0.4));
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-raised-weapon", {includeHiddenElements: true}).props.style).transform).toEqual(expect.arrayContaining([{translateX: 306}, {translateY: 0}]));
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-impact-core", {includeHiddenElements: true}).props.style).opacity).toBe(1);
		await act(() => progress.setValue(0.56));
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-impact-core", {includeHiddenElements: true}).props.style).opacity).toBe(0);
	});
	it.each([true, false])("lands a fireball on the defender at the impact frame (self: %s)", async isSelf => {
		const progress = new Animated.Value(0);
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf}, fightActionId: "fireAttack", status: "normal"});
		await render(<FightEffects cue={cue} progress={progress} width={400} />);
		await act(() => progress.setValue(0.4));
		const style = StyleSheet.flatten(screen.getByTestId("fight-particle-fireball", {includeHiddenElements: true}).props.style);
		expect(style.transform).toEqual(expect.arrayContaining([{translateX: isSelf ? 306 : 94}]));
		expect(style.opacity).toBe(1);
	});
	it("brings the boomerang back to its sender before disappearing", async () => {
		const progress = new Animated.Value(0);
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf: true}, fightActionId: "boomerangAttack", status: "normal"});
		await render(<FightEffects cue={cue} progress={progress} width={400} />);
		await act(() => progress.setValue(0.4));
		expect(StyleSheet.flatten(screen.getByTestId("fight-particle-boomerang", {includeHiddenElements: true}).props.style).transform).toEqual(expect.arrayContaining([{translateX: 306}]));
		await act(() => progress.setValue(1));
		const style = StyleSheet.flatten(screen.getByTestId("fight-particle-boomerang", {includeHiddenElements: true}).props.style);
		expect(style.transform).toEqual(expect.arrayContaining([{translateX: 94}]));
		expect(style.opacity).toBe(0);
	});
	it("retains the swing but omits contact effects when a heavy attack misses", async () => {
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf: true}, fightActionId: "heavyAttack", status: "missed"});
		await render(<FightEffects cue={cue} progress={new Animated.Value(0.4)} width={400} />);
		expect(screen.getByTestId("fight-particle-raised-weapon", {includeHiddenElements: true})).toBeTruthy();
		expect(screen.queryByTestId("fight-particle-shockwave", {includeHiddenElements: true})).toBeNull();
		expect(screen.queryByTestId("fight-particle-impact-core", {includeHiddenElements: true})).toBeNull();
		expect(screen.getByText("app:battle.missed", {includeHiddenElements: true})).toBeTruthy();
	});
	it("sends a missed projectile past the target without a heat impact", async () => {
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf: true}, fightActionId: "fireAttack", status: "missed"});
		await render(<FightEffects cue={cue} progress={new Animated.Value(0.4)} width={400} />);
		const style = StyleSheet.flatten(screen.getByTestId("fight-particle-fireball", {includeHiddenElements: true}).props.style);
		expect(style.transform).toEqual(expect.arrayContaining([{translateX: 334}]));
		expect(screen.queryByTestId("fight-particle-heat-ripple", {includeHiddenElements: true})).toBeNull();
	});
	it("shows poison damage on the affected fighter without launching another projectile", async () => {
		const cue = fightCue({fightId: "trajectory", fighter: {isSelf: true}, fightActionId: "poisoned", status: "active", fightActionEffectDealt: {damages: 17}});
		await render(<FightEffects cue={cue} progress={new Animated.Value(0.6)} width={400} />);
		const style = StyleSheet.flatten(screen.getByTestId("fight-particle-venom-pool", {includeHiddenElements: true}).props.style);
		expect(style.transform).toEqual(expect.arrayContaining([{translateX: 94}]));
		expect(style.opacity).toBeGreaterThan(0);
		expect(screen.getByText("-17", {includeHiddenElements: true})).toBeTruthy();
		expect(screen.queryByTestId("fight-particle-venom-drop", {includeHiddenElements: true})).toBeNull();
	});
});
