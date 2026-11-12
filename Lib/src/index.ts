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

type TypeExpression = {
	expression?: TypeExpression;
	escapedText: string;
	name: TypeExpression;
	arguments: TypeExpression[];
};

const packetsByDirection = new Map<string, string[]>([
	["BACK_TO_FRONT", backToFrontPackets],
	["FRONT_TO_BACK", frontToBackPackets]
]);

/**
 * Direction given to the sendablePacket decorator of a class, null when the class has no such decorator
 */
function getSendablePacketDirection(node: import("typescript").ClassDeclaration): string | null {
	const decorator = node.modifiers?.find(modifier => (modifier as unknown as TypeExpression)?.expression?.expression?.escapedText === "sendablePacket");
	return decorator ? (decorator as unknown as TypeExpression).expression?.arguments[0].name.escapedText ?? "" : null;
}

function checkForDecorators(filePath: string): void {
	const sourceCode = fs.readFileSync(filePath, "utf8");
	const sourceFile = ts!.createSourceFile(filePath, sourceCode, ts!.ScriptTarget.ESNext, true);

	function visit(node: import("typescript").Node): void {
		if (ts!.isClassDeclaration(node) && node.heritageClauses) {
			const className = node.name!.escapedText.toString();
			parentTypes.set(className, (node.heritageClauses[0].types[0].expression as unknown as TypeExpression).escapedText);
			const direction = getSendablePacketDirection(node);
			typeHasDecorator.set(className, direction !== null);
			if (direction !== null) {
				(packetsByDirection.get(direction) ?? nonePackets).push(className);
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

/**
 * Log an error for each packet of the list
 * @param packets - Packets in error
 * @param message - Error logged before the name of each packet
 * @returns whether there was any packet in error
 */
function reportPacketsInError(packets: string[], message: string): boolean {
	for (const packet of packets) {
		console.error(`${message}: ${packet}`);
	}
	return packets.length > 0;
}

function verifyPacketsDecorators(): void {
	walkDirectory(folderPath, checkForDecorators);
	console.log("Verifying packets decorators...");

	const packetsWithoutDecorator = [...parentTypes.keys()].filter(packet => isCrowniclesPacket(packet) && !typeHasDecorator.get(packet));
	if (reportPacketsInError(packetsWithoutDecorator, "Packet decorator missing on packet")) {
		process.exit(1);
	}

	console.log("All packets decorators OK");
}

type PacketsDirection = {
	name: string;
	packets: string[];
};

/**
 * Verify that the handlers of a service handle exactly the packets of its direction
 * @param service - Name of the service in the logs
 * @param handlersPath - Directory containing the TypeScript files of the handlers
 * @param direction - Direction of the packets the service receives
 */
function verifyPacketsHandlers(service: string, handlersPath: string, direction: PacketsDirection): void {
	const implementedPackets = new Array<string>();
	walkDirectory(handlersPath, fullPath => checkForPacketHandlers(fullPath, implementedPackets));
	console.log(`Verifying ${service} packets handlers...`);

	const missingHandlers = reportPacketsInError(
		direction.packets.filter(packet => !implementedPackets.includes(packet)),
		"No handler found for packet"
	);
	const unexpectedHandlers = reportPacketsInError(
		implementedPackets.filter(packet => !direction.packets.includes(packet)),
		`Handler found for a packet not ${direction.name}`
	);
	if (missingHandlers || unexpectedHandlers) {
		process.exit(1);
	}

	console.log(`All ${service} packets handlers OK`);
}

async function verifyPackets(): Promise<void> {
	// Dynamically import typescript only in dev environment
	ts = await import("typescript");

	verifyPacketsDecorators();

	// Verify core if path exists
	if (existsSync(corePath)) {
		verifyPacketsHandlers("core", corePath, {
			name: "FRONT_TO_BACK",
			packets: frontToBackPackets
		});
	}

	// Verify discord if path exists
	if (existsSync(discordPath)) {
		verifyPacketsHandlers("discord", discordPath, {
			name: "BACK_TO_FRONT",
			packets: backToFrontPackets
		});
	}
}

// Development-only validation: only run if source folders exist (not in production Docker)
if (isDevEnvironment) {
	verifyPackets()
		.catch((error: unknown) => {
			console.error("Error while verifying the packets", error);
			process.exit(1);
		});
}
