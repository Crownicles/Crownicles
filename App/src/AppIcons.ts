type EmotePathFolder = Record<string, unknown> | string[];
type EmotePath = EmotePathFolder | string;

let libIcons: EmotePathFolder = {};

export class AppIcons {
	static getIconOrNull(emote: string): string | null {
		try {
			let basePath: EmotePath = libIcons;
			const emotePath = emote.split(".");
			for (const path of emotePath) {
				if (basePath === undefined || typeof basePath === "string") {
					return null;
				}
				basePath = Array.isArray(basePath) ? basePath[parseInt(path, 10)] : basePath[path] as EmotePath;
			}
			return typeof basePath === "string" ? basePath : null;
		}
		catch (e) {
			console.error(`Error while getting emote ${emote}:`, e);
			return null;
		}
	}

	static getIcon(emote: string): string {
		return this.getIconOrNull(emote) ?? "❓";
	}

	static reloadAppIcons(icons: Record<string, unknown>): void {
		libIcons = icons;
	}
}

