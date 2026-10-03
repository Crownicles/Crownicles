import {ReactNode} from "react";
import {Text, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, GUILD_DATA_KINDS, ReactionCollectorData, ReactionCollectorDataOf} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {Note} from "@/src/design/Primitives";
import {QuestionSheet} from "@/src/design/Sections";
import {Check, LogOut, LucideIcon} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {createStyles} from "@/src/design/ThemeContext";
import {CollectorDecision} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const GUILD_EMBLEM_SIZE = 40;

const useStyles = createStyles(colors => ({
	preview: {alignItems: "center", gap: Theme.spacing.sm, paddingVertical: Theme.spacing.xl, paddingHorizontal: Theme.spacing.lg, borderRadius: Theme.radius, backgroundColor: colors.paper},
	previewCaption: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		letterSpacing: Theme.letterSpacing.eyebrow,
		textTransform: "uppercase",
		textAlign: "center",
		color: colors.muted
	},
	previewText: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.body, lineHeight: Theme.lineHeight.body, textAlign: "center", color: colors.ink}
}));

/** The action the confirmation is about, named on the button rather than a bare "confirm". */
function acceptAction(data: ReactionCollectorData): {label?: string; icon?: LucideIcon} {
	if (data.type === GUILD_DATA_KINDS.DESCRIPTION) return {label: i18n.t("app:pet.care.save"), icon: Check};
	return data.type === GUILD_DATA_KINDS.LEAVE ? {label: i18n.t("app:guild.leave"), icon: LogOut} : {};
}

/** The description as the guild's visitors will read it. */
function DescriptionPreview({description}: {description: string}): ReactNode {
	const styles = useStyles();
	return <View style={styles.preview}>
		<Text style={styles.previewCaption}>{i18n.t("app:guild.descriptionPreview")}</Text>
		<Text style={styles.previewText}>{description}</Text>
	</View>;
}

function guildConfirmationTitle(data: ReactionCollectorData): string {
	if (data.type === GUILD_DATA_KINDS.REIMBURSE) return i18n.t("app:guildDomain.reimburse");
	if (data.type === GUILD_DATA_KINDS.INVITE) return i18n.t("app:guild.invitation");
	if (data.type === GUILD_DATA_KINDS.MEMBER) return i18n.t(`app:guild.memberControls.${data.data.action}`);
	return i18n.t(data.type === GUILD_DATA_KINDS.DESCRIPTION ? "app:guild.confirmDescription" : "app:guild.leave");
}

function GuildDepartureDetails({data}: {data: ReactionCollectorDataOf<typeof GUILD_DATA_KINDS.LEAVE>}): ReactNode {
	return <>
		<Note>{i18n.t(data.data.isGuildDestroyed ? "app:guild.dissolveWarning" : "app:guild.leaveWarning", {name: data.data.guildName})}</Note>
		{data.data.memberName ? <Note>{i18n.t("app:guild.newChief", {name: data.data.memberName})}</Note> : null}
	</>;
}

function GuildConfirmationDetails({data}: {data: ReactionCollectorData}): ReactNode {
	if (data.type === GUILD_DATA_KINDS.REIMBURSE) return <Note>{i18n.t("app:guildDomain.confirmReimburse", {amount: formatMoney(data.data.amount)})}</Note>;
	if (data.type === GUILD_DATA_KINDS.INVITE) return <Note>{i18n.t("app:guild.confirmInvitation", {guild: data.data.guildName})}</Note>;
	if (data.type === GUILD_DATA_KINDS.MEMBER) return <Note>{i18n.t("app:guild.confirmMember", {member: data.data.memberName ?? i18n.t("error:unknownPlayer"), guild: data.data.guildName})}</Note>;
	if (data.type === GUILD_DATA_KINDS.DESCRIPTION) return <DescriptionPreview description={data.data.description} />;
	if (data.type === GUILD_DATA_KINDS.LEAVE) return <GuildDepartureDetails data={data} />;
	return null;
}

export function GuildCreateCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	const refuse = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	const action = acceptAction(collector.data);
	const emblem = AppIcons.getIconOrNull("guild.icon");
	return <QuestionSheet
		caption={i18n.t("app:guild.eyebrow")}
		title={guildConfirmationTitle(collector.data)}
		onClose={refuse}
		{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={GUILD_EMBLEM_SIZE} />} : {}}
	>
		<GuildConfirmationDetails data={collector.data} />
		<CollectorDecision
			collector={collector}
			onChoose={answer}
			submitting={locked}
			{...action.label ? {acceptLabel: action.label} : {}}
			{...action.icon ? {acceptIcon: action.icon} : {}}
		/>
	</QuestionSheet>;
}