import {ReactElement} from "react";
import {
	ArrowRight as NativeArrowRight,
	AtSign as NativeAtSign,
	AudioLines as NativeAudioLines,
	Bell as NativeBell,
	BookOpen as NativeBookOpen,
	Castle as NativeCastle,
	Check as NativeCheck,
	ChevronDown as NativeChevronDown,
	ChevronRight as NativeChevronRight,
	CircleAlert as NativeCircleAlert,
	CircleDashed as NativeCircleDashed,
	Clock3 as NativeClock3,
	Coins as NativeCoins,
	Compass as NativeCompass,
	Crosshair as NativeCrosshair,
	Droplets as NativeDroplets,
	Flag as NativeFlag,
	Flame as NativeFlame,
	Footprints as NativeFootprints,
	Gift as NativeGift,
	Hammer as NativeHammer,
	Heart as NativeHeart,
	HeartPulse as NativeHeartPulse,
	History as NativeHistory,
	Info as NativeInfo,
	LogOut as NativeLogOut,
	Maximize2 as NativeMaximize2,
	Medal as NativeMedal,
	MessageCircle as NativeMessageCircle,
	Minus as NativeMinus,
	Pause as NativePause,
	PawPrint as NativePawPrint,
	Play as NativePlay,
	Plus as NativePlus,
	Search as NativeSearch,
	Shield as NativeShield,
	ShoppingBag as NativeShoppingBag,
	Skull as NativeSkull,
	Snowflake as NativeSnowflake,
	Sparkles as NativeSparkles,
	Star as NativeStar,
	Sword as NativeSword,
	Swords as NativeSwords,
	Trophy as NativeTrophy,
	UserPlus as NativeUserPlus,
	UserRound as NativeUserRound,
	Utensils as NativeUtensils,
	Waves as NativeWaves,
	Wind as NativeWind,
	X as NativeX,
	Zap as NativeZap
} from "lucide-react-native";
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

export const ArrowRight = iconComponent(NativeArrowRight);
export const AtSign = iconComponent(NativeAtSign);
export const Cannon = iconComponent(cannonDrawing);
export const AudioLines = iconComponent(NativeAudioLines);
export const Bell = iconComponent(NativeBell);
export const BookOpen = iconComponent(NativeBookOpen);
export const Castle = iconComponent(NativeCastle);
export const ChevronDown = iconComponent(NativeChevronDown);
export const ChevronRight = iconComponent(NativeChevronRight);
export const Check = iconComponent(NativeCheck);
export const CircleAlert = iconComponent(NativeCircleAlert);
export const CircleDashed = iconComponent(NativeCircleDashed);
export const Clock3 = iconComponent(NativeClock3);
export const Coins = iconComponent(NativeCoins);
export const Compass = iconComponent(NativeCompass);
export const Crosshair = iconComponent(NativeCrosshair);
export const Droplets = iconComponent(NativeDroplets);
export const Flame = iconComponent(NativeFlame);
export const Flag = iconComponent(NativeFlag);
export const Footprints = iconComponent(NativeFootprints);
export const Gift = iconComponent(NativeGift);
export const Heart = iconComponent(NativeHeart);
export const HeartPulse = iconComponent(NativeHeartPulse);
export const Hammer = iconComponent(NativeHammer);
export const History = iconComponent(NativeHistory);
export const Info = iconComponent(NativeInfo);
export const LogOut = iconComponent(NativeLogOut);
export const Maximize2 = iconComponent(NativeMaximize2);
export const Medal = iconComponent(NativeMedal);
export const MessageCircle = iconComponent(NativeMessageCircle);
export const Minus = iconComponent(NativeMinus);
export const PawPrint = iconComponent(NativePawPrint);
export const Pause = iconComponent(NativePause);
export const Play = iconComponent(NativePlay);
export const Plus = iconComponent(NativePlus);
export const Search = iconComponent(NativeSearch);
export const Shield = iconComponent(NativeShield);
export const ShoppingBag = iconComponent(NativeShoppingBag);
export const Skull = iconComponent(NativeSkull);
export const Snowflake = iconComponent(NativeSnowflake);
export const Sparkles = iconComponent(NativeSparkles);
export const Star = iconComponent(NativeStar);
export const Swords = iconComponent(NativeSwords);
export const Sword = iconComponent(NativeSword);
export const Trophy = iconComponent(NativeTrophy);
export const UserPlus = iconComponent(NativeUserPlus);
export const UserRound = iconComponent(NativeUserRound);
export const Utensils = iconComponent(NativeUtensils);
export const Waves = iconComponent(NativeWaves);
export const Wind = iconComponent(NativeWind);
export const X = iconComponent(NativeX);
export const Zap = iconComponent(NativeZap);