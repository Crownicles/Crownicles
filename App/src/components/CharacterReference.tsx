import {ReactNode} from "react";
import {Linking, Pressable, Text} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {RarityReq} from "ws-packets/src/fromClient/RarityReq";
import {BlessingReq} from "ws-packets/src/fromClient/BlessingReq";
import {RarityRes} from "ws-packets/src/fromServer/character/RarityRes";
import {BlessingRes} from "ws-packets/src/fromServer/character/BlessingRes";
import {BlessingType} from "ws-packets/src/objects/BlessingType";
import {ItemRarity} from "ws-packets/src/objects/ItemRarity";
import {Badge, BADGE_CODES} from "ws-packets/src/objects/Badge";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {FightGauge} from "@/src/components/FightGauge";
import {gaugeEmoji} from "@/src/components/Guild";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, EntryRow, ExpandableList, Fact, Figure, Figures, Standing} from "@/src/design/Sections";
import {BookOpen} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const HIDDEN_BADGES = new Set<Badge>([BADGE_CODES.DONOR, BADGE_CODES.VOTER]);
const VISIBLE_BADGES = Object.values(BADGE_CODES).filter(badge => !HIDDEN_BADGES.has(badge));
const BLESSING_EMBLEM_SIZE = 40;
const BADGE_EMOJI_SIZE = 28;
const GUIDE_URL = "https://guide.crownicles.com";

const useStyles = createStyles(colors => ({
	badges: {flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Theme.spacing.md, padding: Theme.spacing.lg},
	noBadge: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: colors.muted},
	pressed: {opacity: 0.7}
}));

export function RarityContent({rarities}: {rarities: number[]}): ReactNode {
	if (rarities.length === 0) return <Note>{i18n.t("app:reference.empty")}</Note>;
	return <ExpandableList>{Object.entries(rarities).map(([rarity, percentage]) => <EntryRow key={rarity}
		title={i18n.t(`items:rarities.${rarity}`)}
		end={Number(rarity) === ItemRarity.BASIC ? i18n.t("commands:rarity.earlyAvailable") : i18n.t("app:reference.percentage", {value: percentage})}
	/>)}</ExpandableList>;
}

export function Rarity(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.RARITY, () => GameClient.request(makeFromClientPacket(RarityReq, {}), RarityRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.RARITY}>{data => <RarityContent rarities={data.rarities} />}</GameQueryContent>;
}

/** The people and dates behind a blessing, each shown only when the server sent it. */
function blessingDetails(data: BlessingRes, active: boolean): {label: string; value: string}[] {
	return [
		...active && data.blessingEndAt ? [{label: i18n.t("app:reference.blessing.endsAt"), value: missionDate(data.blessingEndAt)}] : [],
		...!active && data.poolExpiresAt > 0 ? [{label: i18n.t("app:reference.blessing.expiresAt"), value: missionDate(data.poolExpiresAt)}] : [],
		...data.lastTriggeredBy ? [{label: i18n.t("app:reference.blessing.triggeredBy"), value: data.lastTriggeredBy}] : [],
		...data.topContributor ? [{label: i18n.t("app:reference.blessing.topContributor"), value: data.topContributor}] : []
	];
}

function blessingFigures(data: BlessingRes): Figure[] {
	return [
		{caption: i18n.t("app:reference.blessing.contributors"), value: formatNumber(data.totalContributors)},
		...data.topContributorAmount === undefined ? [] : [{caption: i18n.t("app:reference.blessing.topAmount"), value: formatNumber(data.topContributorAmount), unit: "money"}]
	];
}

export function BlessingContent({data}: {data: BlessingRes}): ReactNode {
	const colors = useColors();
	const active = data.activeBlessingType !== BlessingType.NONE;
	const details = blessingDetails(data, active);
	return <>
		<Standing
			emblem={<TwemojiIcon emoji={AppIcons.getIcon("smallEvents.altar")} size={BLESSING_EMBLEM_SIZE} />}
			caption={i18n.t("app:profile.titles.blessing")}
			title={active ? i18n.t(`bot:blessingNames.${data.activeBlessingType}`) : i18n.t("app:reference.blessing.pool")}
			{...active ? {subtitle: i18n.t(`bot:blessingEffects.${data.activeBlessingType}`)} : {}}
		>
			{active ? null : <FightGauge
				label={i18n.t("app:missions.progress")}
				value={data.poolAmount}
				max={data.poolThreshold}
				color={colors.gold}
				{...gaugeEmoji("unitValues.money")}
			/>}
			<Figures items={blessingFigures(data)} />
		</Standing>
		{details.length > 0 ? <ExpandableList>{details.map(detail => <Fact key={detail.label} label={detail.label} value={detail.value} />)}</ExpandableList> : null}
	</>;
}

export function Blessing(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.BLESSING, () => GameClient.request(makeFromClientPacket(BlessingReq, {}), BlessingRes));
	const deadline = state.status === "ready" ? state.data.blessingEndAt ?? state.data.poolExpiresAt : null;
	useGameDeadline(GAME_ENTITIES.BLESSING, deadline);
	return <GameQueryContent state={state} entity={GAME_ENTITIES.BLESSING}>{data => <BlessingContent data={data} />}</GameQueryContent>;
}

export function BadgesContent({badges}: {badges: string[]}): ReactNode {
	const owned = new Set(badges);
	// The ones earned come first, so a handful of badges is not lost among the thirty that remain to be won.
	const ordered = [...VISIBLE_BADGES].sort((first, second) => Number(owned.has(second)) - Number(owned.has(first)));
	return <ExpandableList>{ordered.map(badge => <EntryRow key={badge}
		disabled={!owned.has(badge)}
		emblem={<TwemojiIcon emoji={AppIcons.getIcon(`badges.${badge}`)} size={Theme.dimensions.headerIcon} />}
		title={i18n.t(`app:reference.badges.names.${badge}`)} end={i18n.t(owned.has(badge) ? "app:inventory.owned" : "app:inventory.absent")}
	/>)}</ExpandableList>;
}

/** The badges earned, shown as their emojis; a tap opens what each one means and those left to win. */
export function ProfileBadges({badges, onOpen}: {badges: string[]; onOpen: () => void}): ReactNode {
	const styles = useStyles();
	const earned = VISIBLE_BADGES.filter(badge => badges.includes(badge));
	return <>
		<SectionHeader action={{hint: i18n.t("app:profile.formats.progress", {value: earned.length, max: VISIBLE_BADGES.length})}}>{i18n.t("app:profile.titles.badges")}</SectionHeader>
		<ExpandableList>
			<Pressable accessibilityRole="button" accessibilityLabel={i18n.t("app:profile.titles.badges")} onPress={onOpen} style={({pressed}): object[] => [styles.badges, pressed && styles.pressed].filter(Boolean) as object[]}>
				{earned.length === 0
					? <Text style={styles.noBadge}>{i18n.t("app:reference.badges.none")}</Text>
					: earned.map(badge => <TwemojiIcon key={badge} emoji={AppIcons.getIcon(`badges.${badge}`)} size={BADGE_EMOJI_SIZE} />)}
			</Pressable>
		</ExpandableList>
	</>;
}

export function Badges(): ReactNode {
	const state = usePlayerProfile();
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{data => <>
		<Note>{i18n.t("app:reference.badges.total", {count: VISIBLE_BADGES.filter(badge => data.badges.includes(badge)).length, total: VISIBLE_BADGES.length})}</Note>
		<BadgesContent badges={data.badges} />
	</>}</GameQueryContent>;
}

/** Everything a player may want to look up: the online guide first, then the tables the game never explains by itself. */
export function Guide(): ReactNode {
	return <>
		<ActionBanner icon={BookOpen} label={i18n.t("app:reference.guide")} onPress={(): void => {
			Linking.openURL(GUIDE_URL).catch(console.error);
		}} />
		<SectionHeader>{i18n.t("app:profile.titles.rarity")}</SectionHeader>
		<Rarity />
	</>;
}