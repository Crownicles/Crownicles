import {ReactNode, useRef, useState} from "react";
import {Text} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, ReactionCollectorReaction, SELL_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {SellRes} from "ws-packets/src/fromServer/inventory/SellRes";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Figures, sectionStyles, Sheet} from "@/src/design/Sections";
import {Check, X} from "@/src/design/FightIcons";
import {itemCategoryLabel, itemDisplayName} from "@/src/collectors/CollectorLabels";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type SaleChoice = {reaction: Extract<ReactionCollectorReaction, {type: typeof SELL_REACTION_KINDS.ITEM}>; index: number};

function saleChoices(collector: ReactionCollectorCreation): SaleChoice[] {
	return collector.reactions.flatMap((reaction, index) => reaction.type === SELL_REACTION_KINDS.ITEM ? [{reaction, index}] : []);
}

export function SaleOutcome({outcome, onContinue}: {outcome: SellRes; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:sale.eyebrow")}
		title={i18n.t(outcome.price === 0 ? "app:sale.discarded" : "app:sale.sold")}
		subtitle={itemDisplayName(outcome.item)}
		closeLabel={i18n.t("app:sale.continue")}
		onClose={onContinue}
	>
		{outcome.price > 0
			? <Figures items={[{
				caption: i18n.t("app:sale.received"), value: formatNumber(outcome.price), unit: "money"
			}]} />
			: null}
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:sale.continue")}</Button></ButtonRow>
	</Sheet>;
}

/** Confirming a sale happens inside its own row: a second window over the list would be a dead end. */
function SaleEntry({choice, locked, expanded, onToggle, onChoose}: {
	choice: SaleChoice;
	locked: boolean;
	expanded: boolean;
	onToggle: () => void;
	onChoose: (index: number) => void;
}): ReactNode {
	const {item, slot, price} = choice.reaction.data;
	const discarded = price === 0;
	return <ExpandableEntry
		label={itemDisplayName(item)}
		caption={i18n.t("app:sale.itemSlot", {category: itemCategoryLabel(item.category), slot})}
		end={<Text style={sectionStyles.caption}>{discarded ? i18n.t("app:sale.discard") : formatMoney(price)}</Text>}
		dimmed={locked}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ActionBanner
			icon={discarded ? X : Check}
			label={i18n.t(discarded ? "app:sale.confirmDiscard" : "app:sale.confirmSell")}
			pending={locked}
			onPress={(): void => onChoose(choice.index)}
		/>
	</ExpandableEntry>;
}

export function SellCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	const [openIndex, setOpenIndex] = useState<number>();
	const [answered, setAnswered] = useState(false);
	const sent = useRef(false);
	const locked = submitting || answered;
	const refuseIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const choose = (index: number): void => {
		if (index < 0 || sent.current || locked) return;
		sent.current = true;
		setAnswered(true);
		setOpenIndex(undefined);
		onChoose(index);
	};
	const close = (): void => choose(refuseIndex);

	return <Sheet
		caption={i18n.t("app:sale.eyebrow")}
		title={i18n.t("app:sale.title")}
		closeLabel={i18n.t("app:common.back")}
		onClose={close}
	>
		<ExpandableList>
			{saleChoices(collector).map(choice => <SaleEntry
				key={choice.index}
				choice={choice}
				locked={locked}
				expanded={openIndex === choice.index}
				onToggle={(): void => setOpenIndex(openIndex === choice.index ? undefined : choice.index)}
				onChoose={choose}
			/>)}
		</ExpandableList>
		{locked ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
	</Sheet>;
}
