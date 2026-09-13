import {ReactElement} from "react";
import {Image, ImageSource} from "expo-image";
import {Theme} from "@/src/design/Theme";

type IconProps = {size?: number; color?: string};
export type LucideIcon = (props: IconProps) => ReactElement;

function iconAsset(source: number | ImageSource): LucideIcon {
	return function Icon({size = 24, color = Theme.colors.ink}: IconProps): ReactElement {
		return <Image source={source} contentFit="contain" tintColor={color} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width: size, height: size, flexShrink: 0}} />;
	};
}

export const ArrowRight = iconAsset(require("lucide-static/icons/arrow-right.svg"));
export const AudioLines = iconAsset(require("lucide-static/icons/audio-lines.svg"));
export const ChevronDown = iconAsset(require("lucide-static/icons/chevron-down.svg"));
export const CircleAlert = iconAsset(require("lucide-static/icons/circle-alert.svg"));
export const CircleDashed = iconAsset(require("lucide-static/icons/circle-dashed.svg"));
export const Clock3 = iconAsset(require("lucide-static/icons/clock-3.svg"));
export const Coins = iconAsset(require("lucide-static/icons/coins.svg"));
export const Crosshair = iconAsset(require("lucide-static/icons/crosshair.svg"));
export const Droplets = iconAsset(require("lucide-static/icons/droplets.svg"));
export const Flame = iconAsset(require("lucide-static/icons/flame.svg"));
export const Flag = iconAsset(require("lucide-static/icons/flag.svg"));
export const HeartPulse = iconAsset(require("lucide-static/icons/heart-pulse.svg"));
export const History = iconAsset(require("lucide-static/icons/history.svg"));
export const Info = iconAsset(require("lucide-static/icons/info.svg"));
export const Medal = iconAsset(require("lucide-static/icons/medal.svg"));
export const PawPrint = iconAsset(require("lucide-static/icons/paw-print.svg"));
export const Shield = iconAsset(require("lucide-static/icons/shield.svg"));
export const Skull = iconAsset(require("lucide-static/icons/skull.svg"));
export const Snowflake = iconAsset(require("lucide-static/icons/snowflake.svg"));
export const Sparkles = iconAsset(require("lucide-static/icons/sparkles.svg"));
export const Swords = iconAsset(require("lucide-static/icons/swords.svg"));
export const Trophy = iconAsset(require("lucide-static/icons/trophy.svg"));
export const Waves = iconAsset(require("lucide-static/icons/waves.svg"));
export const Wind = iconAsset(require("lucide-static/icons/wind.svg"));
export const X = iconAsset(require("lucide-static/icons/x.svg"));
export const Zap = iconAsset(require("lucide-static/icons/zap.svg"));