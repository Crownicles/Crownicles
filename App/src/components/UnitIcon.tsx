import {ReactNode} from "react";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";

/** Game units wear the emojis the rest of the game uses for them, rather than a vector lookalike. */
export function UnitIcon({unit, size}: {unit: string; size: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`unitValues.${unit}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : null;
}
