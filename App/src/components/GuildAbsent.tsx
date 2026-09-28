import {ReactNode, useState} from "react";
import {Animated, View} from "react-native";
import {useRouter} from "expo-router";
import {GUILD_CREATION_PRICE} from "ws-packets/src/objects/Guild";
import {AppIcons} from "@/src/AppIcons";
import {GuildCreation} from "@/src/components/Guild";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {ActionBanner, Lock} from "@/src/design/Sections";
import {
	cycleWindow, FAREWELL_TONES, FarewellEmblem, FarewellPage, FarewellTip, FarewellTips, useMotionLoop
} from "@/src/design/Farewell";
import {Coins, Flag, Gift, PawPrint, Shield, UserPlus} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {formatMoney} from "@/src/display/Amounts";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const BANNER_MOTION = {
	waveMs: 1800,
	rallyMs: 3000,
	lift: -5,
	tilt: "7deg",
	dimShield: 0.2,
	guild: 60,
	shield: 18
} as const;

/** The companions gathering around the banner, each showing up in turn. */
const SHIELDS = [
	{style: {top: 12, left: 12}, phase: 0.05},
	{style: {top: 24, right: 8}, phase: 0.3},
	{style: {bottom: 12, left: 28}, phase: 0.55}
] as const;

const SHIELD_FLASH_SPAN = 0.2;

const useStyles = createStyles(() => ({
	shield: {position: "absolute"},
	actions: {gap: 12}
}));

const ABSENT_CHOICES = {CREATE: "create", JOIN: "join"} as const;
type AbsentChoice = typeof ABSENT_CHOICES[keyof typeof ABSENT_CHOICES];

function perks(): FarewellTip[] {
	return [
		{icon: Gift, text: i18n.t("app:guild.absent.dailyBonus"), tone: FAREWELL_TONES.GAIN},
		{icon: Shield, text: i18n.t("app:guild.absent.domain"), tone: FAREWELL_TONES.GAIN},
		{icon: PawPrint, text: i18n.t("app:guild.absent.shelter"), tone: FAREWELL_TONES.GAIN}
	];
}

function shieldLight(rally: Animated.Value, phase: number): Animated.AnimatedInterpolation<number> {
	return cycleWindow(rally, {phase, span: SHIELD_FLASH_SPAN, rest: BANNER_MOTION.dimShield, peak: 1});
}

/** The guild banner waves while companions gather around it one after the other. */
function BannerEmblem(): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const wave = useMotionLoop(BANNER_MOTION.waveMs, true);
	const rally = useMotionLoop(BANNER_MOTION.rallyMs, false);
	return <FarewellEmblem pulse={wave} haloColor={colors.wash}>
		{SHIELDS.map(shield => <Animated.View key={shield.phase} style={[styles.shield, shield.style, {opacity: shieldLight(rally, shield.phase)}]}>
			<Shield size={BANNER_MOTION.shield} color={colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [
			{translateY: wave.interpolate({inputRange: [0, 1], outputRange: [0, BANNER_MOTION.lift]})},
			{rotate: wave.interpolate({inputRange: [0, 1], outputRange: [`-${BANNER_MOTION.tilt}`, BANNER_MOTION.tilt]})}
		]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("navigation.guild")} size={BANNER_MOTION.guild} />
		</Animated.View>
	</FarewellEmblem>;
}

function creationLock(money: number | undefined): Lock | undefined {
	if (money === undefined || money >= GUILD_CREATION_PRICE) return undefined;
	return {reason: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(GUILD_CREATION_PRICE - money)}), icon: Coins};
}

/** A guild is only joined on its chief's invitation, which the app shows as soon as it is sent. */
function JoinHelp({pseudo}: {pseudo: string}): ReactNode {
	const router = useRouter();
	return <>
		<Note>{i18n.t("app:guild.absent.joinHow", {pseudo})}</Note>
		<ButtonRow><Button onPress={(): void => router.push("/guild/rankings")}>{i18n.t("app:guild.absent.browse")}</Button></ButtonRow>
	</>;
}

/** No guild yet: what one brings, then founding one or joining one. */
export function GuildAbsent(): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const profile = usePlayerProfile();
	const [choice, setChoice] = useState<AbsentChoice | null>(null);
	const data = profile.status === "ready" ? profile.data : null;
	const lock = creationLock(data?.money);
	return <>
		<FarewellPage
			emblem={<BannerEmblem />}
			eyebrow={i18n.t("app:guild.eyebrow")}
			eyebrowColor={colors.gold}
			title={i18n.t("app:guild.absent.title")}
			description={i18n.t("app:guild.absent.description")}
		/>
		<FarewellTips title={i18n.t("app:guild.absent.perks")} tips={perks()} />
		<View style={styles.actions}>
			<ActionBanner
				icon={Flag}
				label={i18n.t("app:guild.absent.createWithCost", {price: formatMoney(GUILD_CREATION_PRICE)})}
				onPress={(): void => setChoice(ABSENT_CHOICES.CREATE)}
				{...lock ? {lock} : {}}
			/>
			{choice === ABSENT_CHOICES.CREATE ? <GuildCreation /> : null}
			<ButtonRow><Button icon={UserPlus} onPress={(): void => setChoice(ABSENT_CHOICES.JOIN)}>{i18n.t("app:guild.absent.join")}</Button></ButtonRow>
			{choice === ABSENT_CHOICES.JOIN ? <JoinHelp pseudo={data?.pseudo ?? ""} /> : null}
		</View>
	</>;
}
