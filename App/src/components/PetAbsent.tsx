import {ReactNode} from "react";
import {Animated} from "react-native";
import {useRouter} from "expo-router";
import {AppIcons} from "@/src/AppIcons";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner} from "@/src/design/Sections";
import {
	cycleWindow, FAREWELL_TONES, FarewellEmblem, FarewellPage, FarewellTip, FarewellTips, useMotionLoop
} from "@/src/design/Farewell";
import {Footprints, PawPrint} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const ABSENT_MOTION = {
	sniffMs: 1400,
	trailMs: 2800,
	hop: -5,
	tilt: "6deg",
	dimPrint: 0.15,
	pet: 60,
	print: 16
} as const;

/** The trail of prints leading to the emblem, each appearing in turn. */
const PRINTS = [
	{style: {bottom: 14, left: 6}, phase: 0.05},
	{style: {bottom: 30, left: 20}, phase: 0.3},
	{style: {top: 18, right: 10}, phase: 0.55}
] as const;

const PRINT_FLASH_SPAN = 0.2;

const useStyles = createStyles(() => ({
	print: {position: "absolute"}
}));

function tips(inGuild: boolean): FarewellTip[] {
	return [
		{icon: Footprints, text: i18n.t("app:pet.absent.roadHint"), tone: FAREWELL_TONES.GAIN},
		{icon: PawPrint, text: i18n.t(inGuild ? "app:pet.absent.shelterHint" : "app:pet.absent.shelterNoGuild"), tone: FAREWELL_TONES.GAIN}
	];
}

function printLight(trail: Animated.Value, phase: number): Animated.AnimatedInterpolation<number> {
	return cycleWindow(trail, {phase, span: PRINT_FLASH_SPAN, rest: ABSENT_MOTION.dimPrint, peak: 1});
}

/** A stray sniffs about while its prints come and go, as if a companion were never far. */
function AbsentEmblem(): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const sniff = useMotionLoop(ABSENT_MOTION.sniffMs, true);
	const trail = useMotionLoop(ABSENT_MOTION.trailMs, false);
	return <FarewellEmblem pulse={sniff} haloColor={colors.wash}>
		{PRINTS.map(print => <Animated.View key={print.phase} style={[styles.print, print.style, {opacity: printLight(trail, print.phase)}]}>
			<PawPrint size={ABSENT_MOTION.print} color={colors.muted} />
		</Animated.View>)}
		<Animated.View style={{transform: [
			{translateY: sniff.interpolate({inputRange: [0, 1], outputRange: [0, ABSENT_MOTION.hop]})},
			{rotate: sniff.interpolate({inputRange: [0, 1], outputRange: [`-${ABSENT_MOTION.tilt}`, ABSENT_MOTION.tilt]})}
		]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("smallEvents.findPet")} size={ABSENT_MOTION.pet} />
		</Animated.View>
	</FarewellEmblem>;
}

/** No companion yet: where one can be met, and the way to the guild shelter when there is one. */
export function PetAbsent(): ReactNode {
	const router = useRouter();
	const colors = useColors();
	const profile = usePlayerProfile();
	const inGuild = profile.status === "ready" && profile.data.guild !== undefined;
	return <Screen>
		<FarewellPage
			emblem={<AbsentEmblem />}
			eyebrow={i18n.t("app:pet.eyebrow")}
			eyebrowColor={colors.green}
			title={i18n.t("app:pet.absent.title")}
			description={i18n.t("app:pet.absent.description")}
		/>
		<FarewellTips title={i18n.t("app:pet.absent.where")} tips={tips(inGuild)} />
		{inGuild
			? <ActionBanner icon={PawPrint} label={i18n.t("app:pet.absent.visitShelter")} onPress={(): void => router.push("/guild/shelter")} />
			: <ActionBanner icon={Footprints} label={i18n.t("app:pet.absent.continue")} onPress={(): void => router.navigate("/")} />}
	</Screen>;
}
