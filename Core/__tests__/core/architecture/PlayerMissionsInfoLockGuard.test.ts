import {
	describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE_ROOT = path.join(__dirname, "../../../src");
const PLAYER_MISSIONS_INFO_MODEL_PATH = "core/database/game/models/PlayerMissionsInfo.ts";
const LOCK_CALL = "PlayerMissionsInfo.lockKey";
const ENSURE_CALL = "PlayerMissionsInfos.getOfPlayer";

function listTypeScriptFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true })
		.flatMap(entry => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return listTypeScriptFiles(entryPath);
			}
			return entry.name.endsWith(".ts") ? [entryPath] : [];
		});
}

function toSourceRelativePath(filePath: string): string {
	return path.relative(SOURCE_ROOT, filePath)
		.split(path.sep)
		.join("/");
}

function hasEnsureCallBeforeLockCall(code: string): boolean {
	const lockIndex = code.indexOf(LOCK_CALL);
	if (lockIndex === -1) {
		return true;
	}
	const ensureIndex = code.indexOf(ENSURE_CALL);
	return ensureIndex !== -1 && ensureIndex < lockIndex;
}

describe("PlayerMissionsInfo lock guard", () => {
	it("ensures player mission info rows before locking them", () => {
		const offenders = listTypeScriptFiles(SOURCE_ROOT)
			.filter(filePath => toSourceRelativePath(filePath) !== PLAYER_MISSIONS_INFO_MODEL_PATH)
			.filter(filePath => {
				const code = fs.readFileSync(filePath, "utf-8");
				return code.includes(LOCK_CALL) && !hasEnsureCallBeforeLockCall(code);
			})
			.map(toSourceRelativePath);

		expect(offenders).toEqual([]);
	});
});
