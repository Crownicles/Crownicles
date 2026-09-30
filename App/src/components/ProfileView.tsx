import {ReactNode} from "react";
import {View} from "react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {FightGauge} from "@/src/components/FightGauge";
import {gaugeEmoji} from "@/src/components/Guild";
import {ProfileBadges} from "@/src/components/CharacterReference";
import {AppIcons} from "@/src/AppIcons";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {EntryRow, ExpandableList, Fact, Figure, Figures, Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {formatNumber} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const MILLISECONDS_PER_MINUTE = 60_000;
const PET_RARITY_MIN = 0;
const PET_RARITY_MAX = 8;
const CAMPAIGN_COMPLETE = 100;
const UNRANKED_GLORY = -1;
const STANDING_EMBLEM_SIZE = 40;
const GUILD_ROW_EMBLEM_SIZE = 24;

export type ProfilePage = "inventory" | "unlock" | "guide" | "blessing" | "badges" | "rankings";

const useStyles = createStyles(() => ({
	gauge: {padding: Theme.spacing.md}
}));

function numberValue(value: number): string {
	return i18n.t("app:profile.formats.number", {value});
}

function progressValue(value: number, max: number): string {
	return i18n.t("app:profile.formats.progress", {value, max});
}

function duration(milliseconds: number): string {
	return formatDurationMinutes(milliseconds / MILLISECONDS_PER_MINUTE);
}

function iconLabel(path: string, label: string): string {
	return `${AppIcons.getIcon(path)} ${label}`;
}

function classLabel(profile: ProfileRes): string {
	if (profile.classId === undefined) {
		return i18n.t("app:profile.values.unknown");
	}
	const icon = AppIcons.getIconOrNull(`classes.${profile.classId}`);
	const name = i18n.t(`models:classes.${profile.classId}`);
	return icon ? `${icon} ${name}` : name;
}

function locationLabel(profile: ProfileRes): string {
	if (profile.destinationId === undefined) {
		return i18n.t("app:profile.values.unknownLocation");
	}
	const name = i18n.t(`models:map_locations.${profile.destinationId}.name`);
	const icon = profile.mapTypeId ? AppIcons.getIconOrNull(`mapTypes.${profile.mapTypeId}`) : null;
	return icon ? `${icon} ${name}` : name;
}

function shouldDisplayEffectTime(profile: ProfileRes): boolean {
	const {effect} = profile;
	return !effect.healed && effect.hasTimeDisplay && effect.effect !== "none";
}

function effectLabel(profile: ProfileRes): string {
	return i18n.t("commands:profile.timeLeft.fieldValue", {
		effectId: profile.effect.effect,
		timeLeft: duration(profile.effect.timeLeft)
	});
}

function petLabel(profile: ProfileRes): string {
	if (!profile.pet) {
		return i18n.t("app:profile.values.none");
	}
	const {pet} = profile;
	const icon = AppIcons.getIcon(`pets.${pet.typeId}.${pet.sex === "f" ? "emoteFemale" : "emoteMale"}`);
	const typeName = i18n.t(`models:pets:${pet.typeId}`, {context: pet.sex === "f" ? "female" : "male"});
	const rarity = i18n.t(`items:rarities.${Math.min(PET_RARITY_MAX, Math.max(PET_RARITY_MIN, pet.rarity))}`);
	return `${icon} ${pet.nickname || typeName} · ${rarity}`;
}

/** What the player carries, right under who they are. */
function walletFigures(profile: ProfileRes): Figure[] {
	return [
		{caption: i18n.t("app:profile.fields.money"), value: formatNumber(profile.money), unit: "money"},
		{caption: i18n.t("app:profile.fields.gems"), value: formatNumber(profile.missions.gems), unit: "gem"},
		...profile.tokens ? [{caption: i18n.t("app:profile.fields.tokens"), value: progressValue(profile.tokens.value, profile.tokens.max), unit: "token"}] : []
	];
}

function ProfileStanding({profile}: {profile: ProfileRes}): ReactNode {
	const colors = useColors();
	const classIcon = profile.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${profile.classId}`);
	return (
		<Standing
			testID="profile-standing"
			emblem={classIcon ? <TwemojiIcon emoji={classIcon} size={STANDING_EMBLEM_SIZE} /> : null}
			caption={i18n.t("app:profile.eyebrow")}
			title={profile.pseudo || i18n.t("error:unknownPlayer")}
			subtitle={i18n.t("app:profile.subtitle", {
				className: classLabel(profile),
				level: profile.level,
				location: locationLabel(profile)
			})}
		>
			<FightGauge
				label={i18n.t("app:profile.fields.health")}
				value={profile.health.value}
				max={profile.health.max}
				color={colors.red}
				{...gaugeEmoji("unitValues.health")}
			/>
			{profile.stats ? <FightGauge
				label={i18n.t("app:profile.fields.energy")}
				value={profile.stats.energy.value}
				max={profile.stats.energy.max}
				color={colors.green}
				{...gaugeEmoji("unitValues.energy")}
			/> : null}
			<FightGauge
				label={i18n.t("app:profile.fields.experience")}
				value={profile.experience.value}
				max={profile.experience.max}
				color={colors.gold}
				{...gaugeEmoji("unitValues.xp")}
			/>
			<Figures items={walletFigures(profile)} />
		</Standing>
	);
}

/** A section either states a short fact beside its title or leads to the page holding the rest. */
type ProfileSection = {id: string; icon: string; label: string; caption?: string; page?: ProfilePage; content: ReactNode};

function statisticsSection(profile: ProfileRes): ProfileSection | null {
	if (!profile.stats) {
		return null;
	}
	const {stats} = profile;
	return {
		id: "statistics",
		icon: "unitValues.attack",
		label: i18n.t("app:profile.titles.statistics"),
		content: <>
			<Figures items={[
				{caption: i18n.t("app:profile.fields.attack"), value: numberValue(stats.attack), unit: "attack"},
				{caption: i18n.t("app:profile.fields.defense"), value: numberValue(stats.defense), unit: "defense"},
				{caption: i18n.t("app:profile.fields.speed"), value: numberValue(stats.speed), unit: "speed"}
			]} />
			<Figures items={[
				{caption: i18n.t("app:profile.fields.breath"), value: progressValue(stats.breath.base, stats.breath.max), unit: "breath"},
				{caption: i18n.t("app:profile.fields.breathRegen"), value: numberValue(stats.breath.regen), unit: "breathRegen"}
			]} />
		</>
	};
}

function leagueLabel(league: number): string {
	const icon = AppIcons.getIconOrNull(`leagues.${league}`);
	const name = i18n.t(`models:leagues.${league}`);
	return icon ? `${icon} ${name}` : name;
}

function rankingSection(profile: ProfileRes): ProfileSection {
	const rank = profile.rank.unranked
		? i18n.t("app:profile.values.unranked")
		: i18n.t("app:profile.formats.rank", {rank: profile.rank.rank, players: profile.rank.numberOfPlayers});
	const fight = profile.fightRanking;
	const gloryRank = fight && fight.gloryRank !== UNRANKED_GLORY
		? i18n.t("app:profile.formats.rank", {rank: fight.gloryRank, players: fight.numberOfFighters})
		: i18n.t("app:profile.values.unranked");
	return {
		id: "ranking",
		icon: "announcements.trophy",
		label: i18n.t("app:profile.titles.scoreAndRank"),
		page: "rankings",
		content: <>
			<Figures items={[
				{caption: i18n.t("app:profile.fields.score"), value: formatNumber(profile.rank.score), unit: "score"},
				...fight ? [{caption: i18n.t("app:profile.fields.glory"), value: formatNumber(fight.glory), unit: "glory"}] : []
			]} />
			<Fact label={i18n.t("app:profile.fields.rank")} value={rank} />
			{fight ? <>
				<Fact label={i18n.t("app:profile.fields.gloryRank")} value={gloryRank} />
				<Fact label={i18n.t("app:profile.fields.league")} value={leagueLabel(fight.league)} />
			</> : null}
		</>
	};
}

function SectionGauge({label, value, max, emojiPath}: {label: string; value: number; max: number; emojiPath: string}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	return <View style={styles.gauge}><FightGauge label={label} value={value} max={max} color={colors.gold} {...gaugeEmoji(emojiPath)} /></View>;
}

function campaignSection(profile: ProfileRes): ProfileSection {
	return {
		id: "missions",
		icon: "missions.campaign",
		label: i18n.t("app:profile.fields.campaign"),
		content: <SectionGauge label={i18n.t("app:missions.progress")} value={profile.missions.campaignProgression} max={CAMPAIGN_COMPLETE} emojiPath="missions.campaign" />
	};
}

function cookingSection(profile: ProfileRes): ProfileSection | null {
	if (!profile.cooking) {
		return null;
	}
	const {cooking} = profile;
	return {
		id: "cooking",
		icon: "city.homeUpgrades.cooking",
		label: i18n.t("app:profile.titles.cooking"),
		caption: i18n.t("app:profile.formats.cooking", {
			level: cooking.level,
			grade: i18n.t(`models:cooking.grades.${cooking.grade}`)
		}),
		content: <SectionGauge label={i18n.t("app:profile.fields.experience")} value={cooking.experience.value} max={cooking.experience.max} emojiPath="unitValues.xp" />
	};
}

function sectionAction(section: ProfileSection, onPage?: (page: ProfilePage) => void): {action?: {label?: string; hint?: string; onPress?: () => void}} {
	const {page, caption} = section;
	if (page && onPage) return {action: {label: i18n.t(`app:profile.titles.${page}`), onPress: (): void => onPage(page)}};
	return caption ? {action: {hint: caption}} : {};
}

/** Everything the character is, read at a glance: nothing to unfold. */
function ProfileSections({profile, onPage}: {profile: ProfileRes; onPage?: (page: ProfilePage) => void}): ReactNode {
	const sections = [statisticsSection(profile), rankingSection(profile), campaignSection(profile), cookingSection(profile)]
		.filter((section): section is ProfileSection => section !== null);
	return <>
		{sections.map(section => <View key={section.id} testID={`profile-${section.id}`}>
			<SectionHeader icon={AppIcons.getIcon(section.icon)} {...sectionAction(section, onPage)}>{section.label}</SectionHeader>
			<ExpandableList>{section.content}</ExpandableList>
		</View>)}
	</>;
}

/** The company the player keeps, which lives in its own tab but is worth naming here; someone else's guild opens from it. */
function Belongings({profile, onGuild}: {profile: ProfileRes; onGuild?: (name: string) => void}): ReactNode {
	if (!profile.guild && !profile.pet) {
		return null;
	}
	const guild = profile.guild;
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.information")}</SectionHeader>
			<ExpandableList>
				{guild && onGuild
					? <EntryRow emblem={<TwemojiIcon emoji={AppIcons.getIcon("guild.icon")} size={GUILD_ROW_EMBLEM_SIZE} />} title={guild} subtitle={i18n.t("app:profile.fields.guild")} onPress={(): void => onGuild(guild)} testID="profile-guild" />
					: null}
				{guild && !onGuild ? <Fact label={iconLabel("guild.icon", i18n.t("app:profile.fields.guild"))} value={guild} /> : null}
				{profile.pet ? <Fact label={iconLabel("other.pet", i18n.t("app:profile.fields.pet"))} value={petLabel(profile)} /> : null}
			</ExpandableList>
		</>
	);
}

/**
 * A character as the server describes it. The player's own profile passes `onPage` to reach its sub-pages,
 * and `lead` for what only they see under their name; someone else's profile is read-only.
 */
export function ProfileView({profile, onPage, onGuild, lead}: {profile: ProfileRes; onPage?: (page: ProfilePage) => void; onGuild?: (name: string) => void; lead?: ReactNode}): ReactNode {
	return <>
		<ProfileStanding profile={profile} />
		{lead}
		{shouldDisplayEffectTime(profile) ? <Note>{effectLabel(profile)}</Note> : null}
		<ProfileSections profile={profile} {...onPage ? {onPage} : {}} />
		<ProfileBadges badges={profile.badges} {...onPage ? {onOpen: (): void => onPage("badges")} : {}} />
		<Belongings profile={profile} {...onGuild ? {onGuild} : {}} />
	</>;
}
