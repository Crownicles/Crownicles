import {ReactElement} from "react";
import {Image, ImageSource} from "expo-image";
import {Theme} from "@/src/design/Theme";
import arrowRightAsset from "lucide-static/icons/arrow-right.svg";
import audioLinesAsset from "lucide-static/icons/audio-lines.svg";
import chevronDownAsset from "lucide-static/icons/chevron-down.svg";
import circleAlertAsset from "lucide-static/icons/circle-alert.svg";
import circleDashedAsset from "lucide-static/icons/circle-dashed.svg";
import clock3Asset from "lucide-static/icons/clock-3.svg";
import coinsAsset from "lucide-static/icons/coins.svg";
import crosshairAsset from "lucide-static/icons/crosshair.svg";
import dropletsAsset from "lucide-static/icons/droplets.svg";
import flameAsset from "lucide-static/icons/flame.svg";
import flagAsset from "lucide-static/icons/flag.svg";
import heartPulseAsset from "lucide-static/icons/heart-pulse.svg";
import historyAsset from "lucide-static/icons/history.svg";
import infoAsset from "lucide-static/icons/info.svg";
import medalAsset from "lucide-static/icons/medal.svg";
import pawPrintAsset from "lucide-static/icons/paw-print.svg";
import shieldAsset from "lucide-static/icons/shield.svg";
import skullAsset from "lucide-static/icons/skull.svg";
import snowflakeAsset from "lucide-static/icons/snowflake.svg";
import sparklesAsset from "lucide-static/icons/sparkles.svg";
import swordsAsset from "lucide-static/icons/swords.svg";
import trophyAsset from "lucide-static/icons/trophy.svg";
import wavesAsset from "lucide-static/icons/waves.svg";
import windAsset from "lucide-static/icons/wind.svg";
import xAsset from "lucide-static/icons/x.svg";
import zapAsset from "lucide-static/icons/zap.svg";

type IconProps = {size?: number; color?: string};
export type LucideIcon = (props: IconProps) => ReactElement;

function iconAsset(source: number | ImageSource): LucideIcon {
	return function Icon({size = 24, color = Theme.colors.ink}: IconProps): ReactElement {
		return <Image source={source} contentFit="contain" tintColor={color} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width: size, height: size, flexShrink: 0}} />;
	};
}

export const ArrowRight = iconAsset(arrowRightAsset);
export const AudioLines = iconAsset(audioLinesAsset);
export const ChevronDown = iconAsset(chevronDownAsset);
export const CircleAlert = iconAsset(circleAlertAsset);
export const CircleDashed = iconAsset(circleDashedAsset);
export const Clock3 = iconAsset(clock3Asset);
export const Coins = iconAsset(coinsAsset);
export const Crosshair = iconAsset(crosshairAsset);
export const Droplets = iconAsset(dropletsAsset);
export const Flame = iconAsset(flameAsset);
export const Flag = iconAsset(flagAsset);
export const HeartPulse = iconAsset(heartPulseAsset);
export const History = iconAsset(historyAsset);
export const Info = iconAsset(infoAsset);
export const Medal = iconAsset(medalAsset);
export const PawPrint = iconAsset(pawPrintAsset);
export const Shield = iconAsset(shieldAsset);
export const Skull = iconAsset(skullAsset);
export const Snowflake = iconAsset(snowflakeAsset);
export const Sparkles = iconAsset(sparklesAsset);
export const Swords = iconAsset(swordsAsset);
export const Trophy = iconAsset(trophyAsset);
export const Waves = iconAsset(wavesAsset);
export const Wind = iconAsset(windAsset);
export const X = iconAsset(xAsset);
export const Zap = iconAsset(zapAsset);