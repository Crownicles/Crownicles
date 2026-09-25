import {FightLogEntry} from "ws-packets/src/objects/Fight";
import {fightCue, FIGHT_ACTION_MOTIONS} from "@/src/display/FightMotion";
import {fightChoreography} from "@/src/display/FightChoreography";
import {fighterMotionFrames, fighterScaleFrames} from "@/src/display/FightTrajectories";

declare const __dirname: string;
const {readdirSync} = jest.requireActual<{readdirSync: (path: string) => string[]}>("node:fs");
const {join} = jest.requireActual<{join: (...paths: string[]) => string}>("node:path");
const ENTRY: FightLogEntry = {fightId: "duel", fighter: {isSelf: true}, fightActionId: "simpleAttack", status: "normal"};
const PET: NonNullable<FightLogEntry["pet"]> = {typeId: 1, nickname: "Milo", rarity: 1, sex: "m", loveLevel: 5, force: 10, feedDelay: 0};

describe("combat animation meaning", () => {
	it("assigns a visual to every action in the game's catalogue", () => {
		const actions = readdirSync(join(__dirname, "../../../Core/resources/fightActions")).filter(file => file.endsWith(".json")).map(file => file.slice(0, -5));
		expect(actions.length).toBeGreaterThan(150);
		expect(actions.filter(action => !FIGHT_ACTION_MOTIONS.has(action))).toEqual([]);
		for (const actionId of actions) {
			const choreography = fightChoreography(fightCue({...ENTRY, fightActionId: actionId}));
			expect(choreography.length).toBeGreaterThanOrEqual(2);
			expect(new Set(choreography.map(particle => particle.id)).size).toBe(choreography.length);
			expect(choreography.every(particle => particle.opacity.at(-1) === 0)).toBe(true);
		}
	});
	it.each([
		["simpleAttack", "slash", "opponent"], ["quickAttack", "rapid", "opponent"], ["heavyAttack", "heavy", "opponent"],
		["fireAttack", "flame", "opponent"], ["poisonousAttack", "poison", "opponent"], ["benediction", "blessing", "self"],
		["defenseBuff", "shield", "self"], ["resting", "rest", "self"], ["hydraulicHeal", "heal", "self"],
		["chargeUltimateAttack", "charge", "self"], ["boomerangAttack", "return", "opponent"]
	])("animates %s with the matching gesture and target", (actionId, motion, target) => {
		expect(fightCue({...ENTRY, fightActionId: actionId})).toMatchObject({motion, target});
	});
	it("uses the copied action and mirrors the attacker's side", () => {
		expect(fightCue({...ENTRY, fighter: {isSelf: false}, fightActionId: "counterAttack", usedFightActionId: "fireAttack"})).toMatchObject({motion: "flame", actor: "opponent", target: "self"});
	});
	it("distinguishes a missed attack from a landed impact", () => {
		expect(fightCue({...ENTRY, status: "missed"})).toMatchObject({missed: true, impacts: []});
	});
	it("applies periodic damage to the affected fighter, never their opponent", () => {
		expect(fightCue({...ENTRY, fightActionId: "poisoned", status: "active", fightActionEffectDealt: {damages: 17}})).toMatchObject({target: "self", periodic: true, impacts: [{side: "self", kind: "damage", amount: 17}]});
	});
	it("keeps exact drain, reflected damage and healing amounts on their actual recipients", () => {
		expect(fightCue({...ENTRY, fightActionId: "energeticAttack", fightActionEffectDealt: {damages: 123, reflectedDamages: 7}, fightActionEffectReceived: {energy: 19}}).impacts).toEqual([
			{side: "opponent", source: "dealt", kind: "damage", amount: 123}, {side: "self", source: "received", kind: "energy", amount: 19}, {side: "self", source: "reflected", kind: "damage", amount: 7}
		]);
	});
	it("targets a self buff without shaking the opponent, while retaining damage for mixed attacks", () => {
		expect(fightCue({...ENTRY, fightActionId: "roarAttack", fightActionEffectReceived: {attack: 20}})).toMatchObject({target: "self"});
		expect(fightCue({...ENTRY, fightActionId: "crystallineArmorAttack", fightActionEffectDealt: {damages: 12}, fightActionEffectReceived: {defense: 10}})).toMatchObject({target: "opponent"});
	});
	it("gives melee attacks distinct anticipation and recovery without moving a buff's opponent", () => {
		const attacks = ["simpleAttack", "quickAttack", "heavyAttack", "piercingAttack"].map(fightActionId => fightCue({...ENTRY, fightActionId}));
		expect(new Set(attacks.map(cue => JSON.stringify(fighterMotionFrames(cue, "self")))).size).toBe(attacks.length);
		const shield = fightCue({...ENTRY, fightActionId: "defenseBuff"});
		expect(fighterMotionFrames(shield, "opponent").every(value => value === 0)).toBe(true);
		expect(fighterScaleFrames(shield, "opponent")).toEqual([1, 1, 1, 1, 1, 1]);
	});
	it("shows a pet's preparatory general effect as a preparation on its own side, not a landed hit", () => {
		const warning = fightCue({...ENTRY, fightActionId: "horn", status: "generalEffect", pet: PET});
		expect(warning).toMatchObject({outcome: "prepared", target: "self", missed: false, impacts: []});
		expect(fighterMotionFrames(warning, "opponent").every(value => value === 0)).toBe(true);
		expect(fighterMotionFrames(warning, "self").every(value => value === 0)).toBe(true);
	});
	it("keeps a general effect that transmits an effect as a landed action", () => {
		expect(fightCue({...ENTRY, fightActionId: "healEveryone", status: "generalEffect", pet: PET, fightActionEffectReceived: {energy: 20}})).toMatchObject({outcome: "hit"});
	});
	it("shows a pet failure as a reduced hit when damage is dealt, and as a miss otherwise", () => {
		expect(fightCue({...ENTRY, fightActionId: "crush", status: "failure", pet: PET, fightActionEffectDealt: {damages: 12}})).toMatchObject({outcome: "hit", missed: false, target: "opponent"});
		expect(fightCue({...ENTRY, fightActionId: "spit", status: "failure", pet: PET})).toMatchObject({outcome: "missed", missed: true});
	});
	it("lunges with a pet only for melee attacks, never for a heal or an intimidation", () => {
		const lunge = fighterMotionFrames(fightCue({...ENTRY, fightActionId: "horn", status: "success", pet: PET, fightActionEffectDealt: {damages: 30}}), "self");
		const heal = fighterMotionFrames(fightCue({...ENTRY, fightActionId: "healEveryone", status: "success", pet: PET, fightActionEffectReceived: {energy: 20}}), "self");
		const roar = fighterMotionFrames(fightCue({...ENTRY, fightActionId: "scareFish", status: "generalEffect", pet: PET}), "self");
		expect(Math.max(...lunge)).toBeGreaterThan(20);
		expect(Math.max(...heal)).toBeLessThan(10);
		expect(Math.max(...roar)).toBeLessThan(10);
	});
});