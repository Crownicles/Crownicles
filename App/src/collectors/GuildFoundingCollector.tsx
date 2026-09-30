import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, GUILD_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {GuildBannerEmblem} from "@/src/components/GuildBanner";
import {CollectorDecision} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {Screen} from "@/src/design/Primitives";
import {BackButton, Figure, Figures, FullScreen} from "@/src/design/Sections";
import {FarewellPage} from "@/src/design/Farewell";
import {Flag} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {useColors} from "@/src/design/ThemeContext";

function foundingFigures(price: number, money: number | undefined): Figure[] {
	const cost = {caption: i18n.t("app:guild.founding.cost"), value: formatNumber(price), unit: "money"};
	return money === undefined ? [cost] : [cost, {caption: i18n.t("app:guild.founding.remaining"), value: formatNumber(money - price), unit: "money"}];
}

/** Founding a guild is a moment of its own: the banner, its name and what it costs, then raising it. */
export function GuildFoundingCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const colors = useColors();
	const profile = usePlayerProfile();
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== GUILD_DATA_KINDS.CREATE) return null;
	const {guildName, price} = collector.data.data;
	const refuse = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <FullScreen onClose={refuse}>
		<Screen>
					<BackButton label={i18n.t("app:collector.refuse")} onClose={refuse} />
					<FarewellPage
						emblem={<GuildBannerEmblem haloColor={colors.goldWash} />}
						eyebrow={i18n.t("app:guild.founding.eyebrow")}
						eyebrowColor={colors.gold}
						title={guildName}
						description={i18n.t("app:guild.founding.description")}
					/>
					<Figures items={foundingFigures(price, profile.status === "ready" ? profile.data.money : undefined)} />
					<CollectorDecision
						collector={collector}
						onChoose={answer}
						submitting={locked}
						acceptLabel={i18n.t("app:guild.founding.confirm")}
						acceptIcon={Flag}
						cancelLabel={i18n.t("app:guild.founding.cancel")}
					/>
				</Screen>
	</FullScreen>;
}
