import {ReactElement} from "react";
import * as NativeIcons from "lucide-react-native";
import Svg, {Circle, Path, SvgProps} from "react-native-svg";
import {useColors} from "@/src/design/ThemeContext";

type IconProps = {size?: number; color?: string};
export type LucideIcon = (props: IconProps) => ReactElement;

function cannonDrawing(props: SvgProps): ReactElement {
	return <Svg {...props} viewBox="0 0 72 52" fill="none" stroke={props.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
		<Path d="m14 27 39-15 5 13-40 11Z" fill={props.color} fillOpacity={0.12} />
		<Path d="m50 10 7-3 7 19-7 3ZM23 24l4 9M41 17l5 13M15 33 5 39h33M32 34l17 9h13" />
		<Circle cx={28} cy={39} r={10} fill="white" />
		<Circle cx={28} cy={39} r={3} />
		<Path d="M28 29v7m0 6v7M18 39h7m6 0h7m-17-7 5 5m4 4 5 5m-14 0 5-5m4-4 5-5M55 13l4 10" />
	</Svg>;
}

function iconComponent(Component: React.ComponentType<SvgProps>): LucideIcon {
	return function Icon({size = 24, color}: IconProps): ReactElement {
		const colors = useColors();
		return <Component width={size} height={size} color={color ?? colors.ink} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{flexShrink: 0}} />;
	};
}

export const ArrowRight = iconComponent(NativeIcons.ArrowRight);
export const AtSign = iconComponent(NativeIcons.AtSign);
export const Cannon = iconComponent(cannonDrawing);
export const AudioLines = iconComponent(NativeIcons.AudioLines);
export const Bell = iconComponent(NativeIcons.Bell);
export const BookOpen = iconComponent(NativeIcons.BookOpen);
export const Castle = iconComponent(NativeIcons.Castle);
export const ChevronDown = iconComponent(NativeIcons.ChevronDown);
export const ChevronRight = iconComponent(NativeIcons.ChevronRight);
export const Check = iconComponent(NativeIcons.Check);
export const CircleAlert = iconComponent(NativeIcons.CircleAlert);
export const CircleDashed = iconComponent(NativeIcons.CircleDashed);
export const Clock3 = iconComponent(NativeIcons.Clock3);
export const Coins = iconComponent(NativeIcons.Coins);
export const Compass = iconComponent(NativeIcons.Compass);
export const Crosshair = iconComponent(NativeIcons.Crosshair);
export const Droplets = iconComponent(NativeIcons.Droplets);
export const Flame = iconComponent(NativeIcons.Flame);
export const Flag = iconComponent(NativeIcons.Flag);
export const Footprints = iconComponent(NativeIcons.Footprints);
export const Gift = iconComponent(NativeIcons.Gift);
export const Heart = iconComponent(NativeIcons.Heart);
export const HeartPulse = iconComponent(NativeIcons.HeartPulse);
export const Hammer = iconComponent(NativeIcons.Hammer);
export const History = iconComponent(NativeIcons.History);
export const Info = iconComponent(NativeIcons.Info);
export const LogOut = iconComponent(NativeIcons.LogOut);
export const Maximize2 = iconComponent(NativeIcons.Maximize2);
export const Medal = iconComponent(NativeIcons.Medal);
export const MessageCircle = iconComponent(NativeIcons.MessageCircle);
export const Minus = iconComponent(NativeIcons.Minus);
export const PawPrint = iconComponent(NativeIcons.PawPrint);
export const Pause = iconComponent(NativeIcons.Pause);
export const Play = iconComponent(NativeIcons.Play);
export const Plus = iconComponent(NativeIcons.Plus);
export const Search = iconComponent(NativeIcons.Search);
export const Shield = iconComponent(NativeIcons.Shield);
export const ShoppingBag = iconComponent(NativeIcons.ShoppingBag);
export const Skull = iconComponent(NativeIcons.Skull);
export const Snowflake = iconComponent(NativeIcons.Snowflake);
export const Sparkles = iconComponent(NativeIcons.Sparkles);
export const Star = iconComponent(NativeIcons.Star);
export const Swords = iconComponent(NativeIcons.Swords);
export const Sword = iconComponent(NativeIcons.Sword);
export const Trophy = iconComponent(NativeIcons.Trophy);
export const UserPlus = iconComponent(NativeIcons.UserPlus);
export const UserRound = iconComponent(NativeIcons.UserRound);
export const Utensils = iconComponent(NativeIcons.Utensils);
export const Waves = iconComponent(NativeIcons.Waves);
export const Wind = iconComponent(NativeIcons.Wind);
export const X = iconComponent(NativeIcons.X);
export const Zap = iconComponent(NativeIcons.Zap);