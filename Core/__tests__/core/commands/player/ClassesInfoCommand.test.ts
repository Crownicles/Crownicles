import {describe, expect, it, vi} from "vitest";
import ClassesInfoCommand from "../../../../src/commands/player/ClassesInfoCommand";
import type Player from "../../../../src/core/database/game/models/Player";
import {CommandClassesInfoPacketRes} from "../../../../../Lib/src/packets/commands/CommandClassesInfoPacket";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => descriptor,
	CommandUtils: {DISALLOWED_EFFECTS: {NOT_STARTED_OR_DEAD: []}}
}));
vi.mock("../../../../src/commands/player/ClassChangeCooldown", () => ({classChangeCooldownUntil: (): Promise<null> => Promise.resolve(null)}));
vi.mock("../../../../src/data/FightAction", () => ({FightActionDataController: {instance: {getListById: (ids: string[]) => ids.map(id => ({id, breath: 2}))}}}));

const CLASSES = vi.hoisted(() => [[1, 0], [10, 2], [11, 2]].map(([id, group]) => ({
	id,
	group,
	fightActionsIds: ["simpleAttack"],
	getClassStats: (level: number): object => ({classGroup: group, health: level})
})));
vi.mock("../../../../src/data/Class", () => ({
	ClassDataController: {
		instance: {
			getByGroup: (group: number) => CLASSES.filter(entry => entry.group === group),
			getById: (id: number) => CLASSES.find(entry => entry.id === id)
		}
	}
}));

async function classesInfoFor(classId: number): Promise<CommandClassesInfoPacketRes> {
	const response: CommandClassesInfoPacketRes[] = [];
	await new ClassesInfoCommand().execute(response, {class: classId, level: 70, getClassGroup: () => 2} as Player);
	return response[0];
}

describe("classes info", () => {
	it("sends the player's class from a lower tier aside from the offered classes", async () => {
		const packet = await classesInfoFor(1);
		expect(packet.data?.classesStats.map(entry => entry.id)).toEqual([10, 11]);
		expect(packet.data?.currentClass).toEqual({id: 1, stats: {classGroup: 0, health: 70}, attacks: [{id: "simpleAttack", cost: 2}]});
	});

	it("does not repeat a class already offered", async () => {
		const packet = await classesInfoFor(10);
		expect(packet.data?.currentClass).toBeUndefined();
	});
});
