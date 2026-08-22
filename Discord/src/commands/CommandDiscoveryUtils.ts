export function isCommandModuleFile(fileName: string): boolean {
	return fileName.endsWith("Command.js");
}

export function getCommandModuleImportPath(category: string, commandFile: string): string {
	return `./${category}/${commandFile}`;
}
