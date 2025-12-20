// skipcq: JS-C1003 - fs does not expose itself as an ES Module.
import * as fs from "fs";

// skipcq: JS-C1003 - path does not expose itself as an ES Module.
import * as path from "path";
import { existsSync } from "node:fs";

const folderPath = `${__dirname}/../../../../Lib/src`; // Directory containing Lib TypeScript files
const corePath = `${__dirname}/../../../../Core/src`; // Directory containing Core TypeScript files
const discordPath = `${__dirname}/../../../../Discord/src/packetHandlers/handlers`; // Directory containing Discord TypeScript files

// Only run packet validation in dev environment (when source folders exist)
const isDevEnvironment = existsSync(folderPath);

// Lazy-loaded typescript module (only imported in dev environment to avoid runtime dependency)
let ts: typeof import("typescript") | null = null;

const parentTypes = new Map<string, string>();
const typeHasDecorator = new Map<string, boolean>();
const backToFrontPackets = new Array<string>();
const frontToBackPackets = new Array<string>();
const nonePackets = new Array<string>();
const coreImplementedPackets = new Array<string>();
const discordImplementedPackets = new Array<string>();

type TypeExpression = {
	expression?: TypeExpression;
	escapedText: string;
	name: TypeExpression;
	arguments: TypeExpression[];
};

function checkForDecorators(filePath: string): void {
	const sourceCode = fs.readFileSync(filePath, "utf8");
	const sourceFile = ts!.createSourceFile(filePath, sourceCode, ts!.ScriptTarget.ESNext, true);

	function visit(node: import("typescript").Node): void {
		if (ts!.isClassDeclaration(node) && node.heritageClauses) {
			parentTypes.set(node.name!.escapedText.toString(), (node.heritageClauses[0].types[0].expression as unknown as TypeExpression).escapedText);
			if (node.modifiers && node.modifiers.length > 0 && node.modifiers.some(modifier => (modifier as unknown as TypeExpression)?.expression?.expression?.escapedText === "sendablePacket")) {
				typeHasDecorator.set(node.name!.escapedText.toString(), true);
				const modifier = node.modifiers[0] as unknown as TypeExpression;
				const directionName = modifier?.expression?.arguments[0].name.escapedText ?? "";
				if (directionName === "BACK_TO_FRONT") {
					backToFrontPackets.push(node.name!.escapedText.toString());
				}
				else if (directionName === "FRONT_TO_BACK") {
					frontToBackPackets.push(node.name!.escapedText.toString());
				}
				else {
					nonePackets.push(node.name!.escapedText.toString());
				}
			}
			else {
				typeHasDecorator.set(node.name!.escapedText.toString(), false);
			}
		}
		ts!.forEachChild(node, visit);
	}

	visit(sourceFile);
}

function checkForPacketHandlers(filePath: string, array: Array<string>): void {
	const sourceCode = fs.readFileSync(filePath, "utf8");
	const sourceFile = ts!.createSourceFile(filePath, sourceCode, ts!.ScriptTarget.ESNext, true);

	function visit(node: import("typescript").Node): void {
		if (ts!.isCallExpression(node) && [
			"packetHandler",
			"commandRequires",
			"adminCommand"
		].some(v => v === node.expression.getText())) {
			const packetType = (node as unknown as TypeExpression).arguments[0].escapedText;
			array.push(packetType);
		}
		ts!.forEachChild(node, visit);
	}

	visit(sourceFile);
}

function walkDirectory(dir: string, callback: (fullPath: string) => void): void {
	fs.readdirSync(dir)
		.forEach(file => {
			const fullPath = path.join(dir, file);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				walkDirectory(fullPath, callback);
			}
			else if (fullPath.endsWith(".ts")) {
				callback(fullPath);
			}
		});
}

function isCrowniclesPacket(packetName: string): boolean {
	if (parentTypes.has(packetName)) {
		return isCrowniclesPacket(parentTypes.get(packetName)!);
	}

	return packetName === "CrowniclesPacket";
}

// Development-only validation: only run if source folders exist (not in production Docker)
if (isDevEnvironment) {
	// Dynamically import typescript only in dev environment
	ts = require("typescript");

	walkDirectory(folderPath, checkForDecorators);

	let error = false;
	console.log("Verifying packets decorators...");

	for (const packet of parentTypes.keys()) {
		if (isCrowniclesPacket(packet) && !typeHasDecorator.get(packet)) {
			console.error(`Packet decorator missing on packet: ${packet}`);
			error = true;
		}
	}

	if (error) {
		process.exit(1);
	}

	console.log("All packets decorators OK");

	// Verify core if path exists
	if (existsSync(corePath)) {
		walkDirectory(corePath, fullPath => checkForPacketHandlers(fullPath, coreImplementedPackets));

		error = false;
		console.log("Verifying core packets handlers...");

		for (const packet of frontToBackPackets) {
			if (!coreImplementedPackets.includes(packet)) {
				console.error(`No handler found for packet: ${packet}`);
				error = true;
			}
		}

		for (const packet of coreImplementedPackets) {
			if (!frontToBackPackets.includes(packet)) {
				console.error(`Handler found for a packet not FRONT_TO_BACK: ${packet}`);
				error = true;
			}
		}

		if (error) {
			process.exit(1);
		}

		console.log("All core packets handlers OK");
	}

	// Verify discord if path exists
	if (existsSync(discordPath)) {
		walkDirectory(discordPath, fullPath => checkForPacketHandlers(fullPath, discordImplementedPackets));

		error = false;
		console.log("Verifying discord packets handlers...");

		for (const packet of backToFrontPackets) {
			if (!discordImplementedPackets.includes(packet)) {
				console.error(`No handler found for packet: ${packet}`);
				error = true;
			}
		}

		for (const packet of discordImplementedPackets) {
			if (!backToFrontPackets.includes(packet)) {
				console.error(`Handler found for a packet not BACK_TO_FRONT: ${packet}`);
				error = true;
			}
		}

		if (error) {
			process.exit(1);
		}

		console.log("All discord packets handlers OK");
	}
}
