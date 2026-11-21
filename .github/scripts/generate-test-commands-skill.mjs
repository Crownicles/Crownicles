/**
 * Generate the test commands skills from the game sources:
 * - .github/skills/test-commands/SKILL.md: reference table of the repository skill
 * - skills/commandes-test-crownicles/: portable skill (SKILL.md + IDs reference) for Claude, Gemini, ChatGPT...
 * - skills/commandes-test-crownicles.zip: the portable skill, ready to import
 *
 * Usage:
 *   node .github/scripts/generate-test-commands-skill.mjs          write the generated files
 *   node .github/scripts/generate-test-commands-skill.mjs --check  fail if a generated file is outdated
 */
import {
	existsSync, readdirSync, readFileSync, statSync, writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_COMMANDS_DIR = join(ROOT, "Core", "src", "commands", "admin", "testCommands");
const RESOURCES_DIR = join(ROOT, "Core", "resources");
const LANG_DIR = join(ROOT, "Lang", "fr");
const PORTABLE_NAME = "commandes-test-crownicles";
const REPO_SKILL = ".github/skills/test-commands/SKILL.md";
const PORTABLE_SKILL = `skills/${PORTABLE_NAME}/SKILL.md`;
const PORTABLE_IDS = `skills/${PORTABLE_NAME}/references/crownicles-ids.md`;
const PORTABLE_ZIP = `skills/${PORTABLE_NAME}.zip`;
const MARKER = "<!-- generated-reference -->";
const REFERENCE_HEADER = /^## Référence \(\d+ commandes\)$/mu;

// Descriptions that are not a plain string literal in the source (built from data at runtime)
const DESCRIPTION_OVERRIDES = {
	guildreward: "Déclenche une récompense de guilde sans le cooldown (types : `/test help guildreward`)",
	smallEvent: "Force un mini-événement précis (noms : `/test help smallEvent`)"
};

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const numericOrder = (a, b) => (Number(a) || Number.MAX_SAFE_INTEGER) - (Number(b) || Number.MAX_SAFE_INTEGER) || a.localeCompare(b);
const cell = text => String(text).replace(/\{emote:[^}]*\}\s*/gu, "")
	.replace(/\*\*/gu, "")
	.replace(/\s+/gu, " ")
	.replace(/\|/gu, "/")
	.trim();
const listDirectory = (path, predicate = () => true) => readdirSync(path).filter(name => !name.startsWith(".") && predicate(name))
	.sort();

function parseDescription(name, source) {
	if (DESCRIPTION_OVERRIDES[name]) {
		return DESCRIPTION_OVERRIDES[name];
	}
	const literal = source.match(/description:\s*"((?:[^"\\]|\\.)*)"/su);
	if (literal) {
		return literal[1].replace(/\\n/gu, " ").replace(/\\(["'\\])/gu, "$1");
	}

	// Template literal listing runtime values: keep the static sentence and point to the in-game help
	const template = source.match(/description:\s*`([^`$]*)/su);
	const prefix = template ? template[1].replace(/\\n/gu, " ").trim() : "";
	return `${prefix} voir \`/test help ${name}\``.trim();
}

function parseTestCommand(source) {
	const name = source.match(/name:\s*"([^"]+)"/u)[1];
	const commandFormat = source.match(/commandFormat:\s*"([^"]*)"/u)?.[1] ?? "";
	const aliases = [...source.match(/aliases:\s*\[([^\]]*)\]/su)?.[1].matchAll(/"([^"]+)"/gu) ?? []].map(match => match[1]);
	return {
		syntax: `/test ${name} ${commandFormat}`.trim(),
		aliases: aliases.join(", "),
		description: cell(parseDescription(name, source))
	};
}

function buildCommandsReference() {
	let total = 0;
	const sections = listDirectory(TEST_COMMANDS_DIR, name => statSync(join(TEST_COMMANDS_DIR, name)).isDirectory()).map(category => {
		const commands = listDirectory(join(TEST_COMMANDS_DIR, category), name => name.endsWith(".ts"))
			.map(file => parseTestCommand(readFileSync(join(TEST_COMMANDS_DIR, category, file), "utf8")));
		total += commands.length;
		const rows = commands.map(command => `| \`${command.syntax}\` | ${command.aliases} | ${command.description} |`);
		return [`### ${category} (${commands.length})`, "", "| Syntaxe | Alias | Description |", "|---|---|---|", ...rows].join("\n");
	});
	return {
		total, tables: sections.join("\n\n")
	};
}

function idTable(title, rows, header = "Nom") {
	return [`## ${title}`, "", `| ID | ${header} |`, "|---|---|", ...rows.map(([id, label]) => `| ${id} | ${cell(label)} |`)].join("\n");
}

function sortedEntries(record, skipZero = false) {
	return Object.entries(record)
		.filter(([id]) => !skipZero || id !== "0")
		.sort(([a], [b]) => numericOrder(a, b));
}

function buildPetRows(pets) {
	const bySex = {};
	for (const [key, label] of Object.entries(pets)) {
		const [id, sex] = key.split("_");
		bySex[id] = {
			...bySex[id], [sex]: label
		};
	}
	return sortedEntries(bySex, true).map(([id, { male, female }]) => [id, male === female ? male : `${male} (m) / ${female} (f)`]);
}

function buildMissionRows(missions) {
	return listDirectory(join(RESOURCES_DIR, "missions"), name => name.endsWith(".json")).map(file => {
		const id = file.slice(0, -".json".length);
		const label = missions[id] ?? missions[`${id}_other`] ?? missions[`${id}_one`] ?? "";
		return [id, label.replace(/\{\{[^}]*\}\}/gu, "X")];
	});
}

function buildTravelPaths() {
	return listDirectory(join(RESOURCES_DIR, "mapLinks"), name => name.endsWith(".json"))
		.map(file => readJson(join(RESOURCES_DIR, "mapLinks", file)))
		.sort((a, b) => a.startMap - b.startMap || a.endMap - b.endMap)
		.map(link => `${link.startMap} → ${link.endMap}`)
		.join(", ");
}

function buildIdsReference() {
	const models = readJson(join(LANG_DIR, "models.json"));
	const events = readJson(join(LANG_DIR, "events.json"));
	const smallEvents = listDirectory(join(RESOURCES_DIR, "smallEvents"), name => name.endsWith(".json")).map(file => `\`${file.slice(0, -".json".length)}\``);
	return [
		"# IDs Crownicles pour les commandes /test",
		"Généré depuis le code du jeu. Les familiers prennent un sexe en plus de l'ID : m (mâle) ou f (femelle).",
		idTable("Familiers (/test pet <id> <m/f>, /test guildpet <id> <m/f>)", buildPetRows(models.pets)),
		idTable("Armes (/test giveitem 0 <id>)", sortedEntries(models.weapons, true)),
		idTable("Armures (/test giveitem 1 <id>)", sortedEntries(models.armors, true)),
		idTable("Potions (/test giveitem 2 <id>)", sortedEntries(models.potions, true)),
		idTable("Objets (/test giveitem 3 <id>)", sortedEntries(models.objects, true)),
		idTable("Matériaux (/test givematerial <id> <quantité>)", sortedEntries(models.materials)),
		idTable("Plantes et graines (/test giveplant <id>, /test giveseed <id>)", sortedEntries(models.plants)),
		idTable("Classes (/test changeClass <id>)", sortedEntries(models.classes)),
		idTable("Lieux (/test travel <idDépart> <idArrivée>, le chemin doit exister)", sortedEntries(models.map_locations).map(([id, location]) => [id, location.name])),
		`## Chemins valides pour /test travel (départ → arrivée)\n\n${buildTravelPaths()}`,
		idTable("Missions (/test giveMission <id> <e/m/h>, /test updateMissions <id> <nombre>)", buildMissionRows(models.missions)),
		idTable("Grands événements (/test forcereport <id>, -1 = aléatoire)", sortedEntries(events).map(([id, event]) => [id, (event.text ?? "").slice(0, 140)]), "Début du texte"),
		`## Mini-événements (/test smallEvent <nom>)\n\n${smallEvents.join(", ")}`
	].join("\n\n") + "\n";
}

function withReference(skillPath, { total, tables }) {
	const [head] = readFileSync(join(ROOT, skillPath), "utf8").split(MARKER);
	if (!REFERENCE_HEADER.test(head)) {
		throw new Error(`${skillPath} must contain a "## Référence (N commandes)" header before ${MARKER}`);
	}
	return `${head.replace(REFERENCE_HEADER, `## Référence (${total} commandes)`)}${MARKER}\n\n${tables}\n`;
}

/**
 * Stored (uncompressed) zip with a fixed date, so that the archive is byte-for-byte reproducible
 * whatever the Node or zlib version used to generate it.
 */
function buildZip(files) {
	const DOS_DATE_1980_01_01 = 0x21;
	const UTF8_FLAG = 0x0800;
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const [path, content] of files) {
		const name = Buffer.from(path, "utf8");
		const data = Buffer.from(content, "utf8");
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(UTF8_FLAG, 6);
		local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
		local.writeUInt32LE(crc32(data), 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(name.length, 26);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(UTF8_FLAG, 8);
		central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
		central.writeUInt32LE(crc32(data), 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		locals.push(local, name, data);
		centrals.push(central, name);
		offset += local.length + name.length + data.length;
	}
	const centralDirectory = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, centralDirectory, end]);
}

function generate() {
	const reference = buildCommandsReference();
	const portableSkill = withReference(PORTABLE_SKILL, reference);
	const ids = buildIdsReference();
	return {
		[REPO_SKILL]: withReference(REPO_SKILL, reference),
		[PORTABLE_SKILL]: portableSkill,
		[PORTABLE_IDS]: ids,
		[PORTABLE_ZIP]: buildZip([
			[`${PORTABLE_NAME}/SKILL.md`, portableSkill],
			[`${PORTABLE_NAME}/references/crownicles-ids.md`, ids]
		])
	};
}

const outputs = generate();
if (process.argv.includes("--check")) {
	const outdated = Object.entries(outputs)
		.filter(([path, content]) => !existsSync(join(ROOT, path)) || !readFileSync(join(ROOT, path)).equals(Buffer.from(content)))
		.map(([path]) => path);
	for (const path of outdated) {
		console.log(`::error file=${path},title=Outdated test commands skill::${path} does not match the test commands, translations or resources`);
	}
	if (outdated.length > 0) {
		console.log("\nRun `node .github/scripts/generate-test-commands-skill.mjs` and commit the result.");
		process.exit(1);
	}
	console.log("The test commands skills are up to date.");
}
else {
	for (const [path, content] of Object.entries(outputs)) {
		writeFileSync(join(ROOT, path), content);
		console.log(`Written ${path}`);
	}
}
