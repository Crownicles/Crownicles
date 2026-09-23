import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/display/Amounts";
import {collectorDescription, eventPromptIcon} from "@/src/collectors/CollectorLabels";
import {EventJournal} from "@/src/collectors/EventOutcomeScreen";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {Check} from "@/src/design/FightIcons";
import {plainStory} from "@/src/display/Markdown";
import {i18n} from "@/src/translations/i18n";

/** A recipe seller makes a single offer, told the same way as any other travelling merchant. */
export function RecipeShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.RECIPE_SHOP) {
		return null;
	}
	const {recipe, recipeCost} = collector.data.data;
	const recipeName = plainStory(i18n.t("models:cooking.recipeDisplay", recipe));
	const locked = answered || submitting;
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={leave} />
				<EventJournal emoji={eventPromptIcon(collector.data)} story={collectorDescription(collector.data) ?? ""} />
				<ActionBanner
					icon={Check}
					label={i18n.t("app:city.shop.buy", {item: recipeName, price: formatMoney(recipeCost)})}
					pending={locked}
					onPress={(): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT))}
				/>
			</Screen>
		</SwipeBack>
	);
}
