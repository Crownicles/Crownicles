export type HexColorString = `#${string}`;

export class ColorConstants {
	static readonly DEFAULT = "default";

	static readonly ERROR: HexColorString = <HexColorString>"#D92D43";

	static readonly SUCCESSFUL: HexColorString = <HexColorString>"#5EAD45";

	static readonly GOLD: HexColorString = <HexColorString>"#FFAC33";
}
