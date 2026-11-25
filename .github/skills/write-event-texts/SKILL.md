---
name: write-event-texts
description: Règles de style, de lore et de données pour écrire ou réécrire les textes d'un big event ou d'un small event de Crownicles (Lang/fr) et ses issues conditionnelles. À utiliser dès qu'on écrit, réécrit ou relit un texte d'event, une issue, un seuil de niveau, de statistique ou de karma.
---

# Écrire les textes d'un event de Crownicles

Le joueur revoit chaque event des dizaines de fois, dans n'importe quel ordre. Un bon texte reste vrai et agréable à la centième lecture. Ces règles viennent des relectures du propriétaire du jeu sur la branche `outcomerequirements` (PR #3329).

Le français (`Lang/fr`) est la référence. Depuis l'abandon de Crowdin (#5181), chaque clé ajoutée, modifiée ou supprimée en français doit l'être aussi dans les autres langues (`de`, `en`, `es`, `it`, `pt`) dans la même PR, avec les mêmes placeholders : voir `Lang/README.md`. Le workflow `Translations` le vérifie. On écrit et on fait relire d'abord le français, puis on traduit quand le texte est stable.

## Sources à lire avant d'écrire

- **La bible du lore** : dépôt `Crownicles/Tools`, `documents/crownicles-lore-proposition.md` (https://github.com/Crownicles/Tools/blob/master/documents/crownicles-lore-proposition.md).
  - Sections 0 à 7 : les règles du présent permanent (R1 à R8), les personnages et la géographie.
  - Section 13.5 : les contradictions déjà relevées.
  - Section 14 : le guide de style.
  - Annexe A, le canon des lieux : tout ce que le jeu dit de chaque lieu, les voisins et le menu des villes.
- **Les consignes de l'atelier**, dans `references/` à côté de ce fichier :
  - `brief.md` : la consigne complète donnée à un rédacteur (format de sortie, exemples, retours de relecture) ;
  - `reference.md` : les champs d'une issue, les altérations, toutes les conditions et leurs repères en production ;
  - `repasse.md` : reprendre un event déjà réécrit avant les règles actuelles ;
  - `draft-rework.md` : reprendre le brouillon d'un contributeur.

## Style

### Les règles

- **Pas de discours direct.** Pas de guillemets « » ou " ", pas de « dit-il », pas de réplique entre apostrophes. Les paroles passent au style indirect : *Elle vous déconseille le sentier principal.*
- **Mots simples et courants.**
  - Pas de vocabulaire rare pour faire « médiéval » : pavoisé, poterne, échauguette, oriflamme, mâchicoulis…
  - Un mot que personne n'emploie sonne « IA ».
- **Pas d'expression inventée.** Une image doit exister en français. Sinon, on dit les choses simplement.
- **Phrases courtes, une action par phrase**, pronoms sans ambiguïté. Relis à voix haute : si on bute, on réécrit.
- **Deux phrases courtes qui forment une seule idée se lient** par deux-points ou par *et*. Une phrase par action, oui, mais pas une phrase par fragment. Event 3 : *Vous repérez un éclat de métal dans le sable. C'est la clef.* devient *… un éclat de métal dans le sable : c'est la clef.* ; *La clef est dessous. Le cadenas s'ouvre…* devient *La clef est dessous, et le cadenas s'ouvre…*.
- **Pas de mot ou de tournure qui fait hésiter.**
  - Évite les mots à double sens : *régimes* se lit d'abord comme une diète, écris *bananes*.
  - Évite les mesures à l'ancienne qui se lisent au pied de la lettre : *vous soulevez la poutre de quelques doigts* fait imaginer la poutre levée du bout des doigts ; écris *vous parvenez à soulever un peu la poutre*.
  - Évite les négations alambiquées comme *sans que vous ayez vu*.
- **Des réactions plausibles.** Si une scène ne sert qu'à justifier un gain, simplifie-la.
- **La physique tient.** Les tailles, les poids, les forces et les durées doivent rester vraisemblables, et la solution doit être à la mesure du problème. Un obstacle hors norme ne se règle pas avec des gestes ordinaires ; un obstacle ordinaire n'appelle pas d'exploit. Demande-toi aussi quelle est la solution évidente (passer par-dessus, creuser, faire le tour) : si elle marcherait mieux que les choix proposés, l'intro doit dire pourquoi elle est impossible. Event 1 : un chêne au tronc de *deux mètres de diamètre*, qu'on *coupait* sans outil et dont on *cassait les branches*, sortait le lecteur du jeu. C'est devenu un grand chêne dont la ramure forme un mur de branches brisées *trop haut et trop serré pour passer par-dessus*, et le choix *Dégager le passage* ouvre une brèche dans les branches.
- **Montrer la condition, ne pas la nommer.**
  - Pas de *Votre agilité vous permet de…*, de *votre réputation*, de *votre aura*.
  - Un joueur rapide rattrape le voleur ; un joueur au karma bas est reconnu et on se méfie de lui.
- **Registre sobre.**
  - Pas de *héros de légende*, de *gratitude éternelle*, de *noble quête*.
  - Un « ! » au plus par texte. Pas de points de suspension en fin d'introduction.
- **Pas de morale finale** (*Après tout, la mort fait partie du cycle naturel*).
- **Des enchaînements logiques.** Chaque phrase découle de la précédente.
- **Le joueur sait où il finit.** Après une traversée, une chute ou une fuite, le texte dit où le joueur se retrouve : *l'autre rive*, *la rive que vous veniez de quitter*, *hors du trou*. Event 12 : *vous vous hissez de l'autre côté* (du trou, ou de la rivière ?) et *vous regagnez la berge* (laquelle ?) laissaient deviner si le joueur avait traversé. *De l'autre côté* suffit quand l'obstacle est unique et nommé juste avant (un tronc en travers du chemin).
- **Pas de détail parasite.** Une phrase qui n'a ni cause dans ce qui précède ni conséquence dans ce qui suit se supprime. Event 71 : après un repas et une bonne nuit, *Au réveil, vous secouez un scorpion hors de votre botte* tombait de nulle part.
- **L'intro fixe l'état des choses, et aucune issue ne le contredit.** Ce que l'intro dit d'un objet, d'un lieu ou d'un personnage (son âge, son état, depuis quand il est là) vaut pour toutes les issues. Relis chaque issue en te demandant si elle reste vraie avec l'intro. Event 3 : le coffret est à demi enfoui dans le sable, ses ferrures sont rouillées, il est donc là depuis longtemps. Une issue où l'on craint que son propriétaire le cherche, ou où il est tombé de la charrette d'un marchand le matin même, ne tient pas. Le marchand reconnaît plutôt les ferrures de l'échoppe en ruine de son père.
  - L'intro fixe aussi l'humeur des personnages : chaque issue part de cette humeur et montre ce qui la fait changer. Event 15 : les hommes se taisent et jaugent le joueur, puis *Les marchands vous font bon accueil* sans transition. C'est devenu *D'abord méfiants, les marchands se détendent quand vous demandez à voir leurs armes*.
  - L'intro fixe aussi l'endroit où se tient le joueur. Event 13 : l'intro lui faisait passer les portes de Claire de Ville, et une issue de *Repartir* lui faisait faire le tour de la ville par l'extérieur des murailles. Il arrive maintenant aux portes, ce qui laisse ouverts tous les choix.
  - Faux : *Malgré vos efforts conjugués, le courant emporte la ligne. Le pêcheur vous remercie chaleureusement pour votre tentative et partage quelques pièces.* Le gain tombe comme un cheveu sur la soupe.
  - Juste : *Le poisson casse la ligne. Le pêcheur hausse les épaules, vous remercie quand même et vous glisse quelques pièces pour votre peine.*
- **Des sentiments à la mesure du résultat.** Si le joueur n'a servi à rien, il n'est pas *heureux d'avoir tenté d'aider* : *Vous repartez avec un léger sourire.* suffit.
- **Le verbe décrit ce qu'on voit.** Pas de personnification gratuite : la terre fraîche *montre* que l'arbre est tombé récemment, elle ne le *dit* pas.
- **Une réaction a sa raison.** Un mot avant l'action suffit à la motiver : *Agacé, le chien vous mord* ; *Méfiants, ses hommes fouillent votre sac*.
- **Un mot de contraste quand l'issue bascule** : *Votre radeau flotte bien, mais à mi-parcours, le courant le disloque.* ; *Des brigands surgissent, mais ils le regrettent vite.*
- **La réaction suit la condition.** Un chien intimidé par votre familier s'éloigne *en hâte*, pas *sans hâte*.
- **Pas de répétition en cascade.** *Puis d'autres histoires, puis d'autres encore* : une de trop. Deux *puis* au plus par phrase.
- **L'humour de l'original se garde**, et une chute qui brise le quatrième mur est bienvenue : l'issue qui s'ouvre sur *Mais pourquoi avoir fait cela ?* après avoir poussé le pêcheur.
- **Varier le ton.** Un event où toutes les issues ont la même couleur (morsures, blessures, pièces trouvées) devient lisse. Glisse une ou deux issues mignonnes et une ou deux drôles parmi les autres, sans en faire le cas général. Event 2, le chien des ruines : il y avait surtout des morsures ; on y a ajouté des chiots coincés sous une planche, le chien qui s'endort sur vos pieds, celui qui vous arrache le bâton brandi pour le faire fuir et part jouer avec, et celui qui file avec votre repas. Le comique naît d'une réaction naturelle de l'animal, pas d'un geste bizarre du joueur (gronder à quatre pattes comme un chien était trop gratuit).
- **Un brin d'absurde va bien au jeu**, surtout dans les issues rares : le requin qui se glisse dans le lac pour aider le pêcheur et vide d'un coup l'eau et le pique-nique (event 10). La situation reste logique, c'est la conséquence qui surprend.
  - Une issue drôle qui tient debout se garde, même si elle force un peu le trait : la vraisemblance ne doit pas tout aplatir. Event 18 : le castor qui *s'attaque à une pile de poutres tombées* et laisse *quelques bons morceaux empilés à ses pieds* avait été remplacé par un castor plus réaliste qui découvre du bois sous une bâche ; le propriétaire a fait rétablir le premier, plus drôle.
- **Une tournure naturelle.** *Les familles accourues* sonne bizarre ; *les familles venues voir l'incident* se lit sans buter.
- **On ne lit pas dans la tête d'un animal.** Le narrateur interprète ce qu'il voit : *Il semble vouloir que vous le suiviez*, pas *Il veut que vous le suiviez*.
- **Le narrateur ne sait que ce que le joueur voit ou apprend.** Ce qui s'est passé avant son arrivée se montre par un indice ou passe par un personnage, sinon c'est une supposition (*sans doute*, *a dû*, *semble*). Event 18 : *le dernier plancher, où plus personne ne grimpe depuis le départ des ouvriers* : comment le sait-il ? Écris *La poussière y est épaisse, sans une trace de pas : personne n'est monté jusqu'ici depuis longtemps*. De même, des mercenaires *se plaignent* de ne plus être payés (event 47), et les villageois *répondent* que la rumeur court depuis des années (event 63).
- **Un geste suit la blessure, et les mains doivent être libres pour le faire.** On souffle sur ses doigts pour refroidir une brûlure ou réchauffer des mains gelées, pas sur une piqûre de guêpe ni sur des paumes écorchées, et pas en descendant d'un échafaudage, quand on a besoin de ses mains pour se tenir. On se tient l'épaule qu'une pierre a entaillée, pas le bras. Un geste plaqué en fin d'issue pour faire vivant se voit tout de suite : décris plutôt l'état (*la main rouge et enflée*, *les paumes pleines d'échardes*). Le validateur avertit quand le joueur souffle sur ses mains sans brûlure ni froid.
- **Un familier fait un geste naturel pour son espèce, et on le voit.** Pas de formulation qui laisse imaginer une scène impossible. Event 71 : *votre scorpion se glisse sous le bol de Xirtex* ne se représente pas ; *votre scorpion grimpe sur la natte et s'approche du plat* se voit tout de suite. Event 18 : un singe qui *bondit de perche en perche* sur un échafaudage ne se voit pas, car les perches sont des poteaux debout ; il *se hisse d'un plancher à l'autre*. La réaction du personnage suit ce geste.
- **Pas de montant dans le texte.** Le jeu affiche les pièces, les points de vie et le temps perdu : *une bourse*, *une poignée de pièces*.
- **Typographie.**
  - Apostrophe droite `'`, pas de tiret cadratin `—`.
  - Une espace avant `: ; ! ?`.
  - On vouvoie le joueur.
  - Garde tels quels les placeholders : `{{...}}`, `{emote:...}`, `$t(...)`.

### Exemples relevés en relecture

| Écrit | Problème | Mieux |
|---|---|---|
| *un château pavoisé* ; *on vous reconduit par la poterne* | Vocabulaire rare | *le château du duc* ; *on vous raccompagne à la sortie* |
| *Vexé jusqu'à la moustache* | Expression inventée | *Vexé, le duc…* |
| *on vous pousse sur le talus boueux qui descend vers la rivière* | Décor inutile à l'action | *on vous jette dehors* |
| *Le duc rit aux éclats, le lui fait redire devant toute la salle et vous remet une bourse* | Phrase alambiquée, pronoms en cascade | *Le duc éclate de rire. Il vous fait remettre une bourse.* |
| *Conquis, le duc veut l'acheter ; vous refusez, et il vous paie le spectacle* | Interaction peu crédible | Une seule réaction simple qui justifie le gain |
| *puis vous fait reconduire sans que vous ayez vu le duc* | Fait hésiter | *… et vous fait reconduire. Vous n'aurez pas vu le duc.* |
| *Le duc remarque vos cicatrices*, avec `level: {min: 60}` | Le texte décrit un vétéran, le seuil un débutant | Le seuil « vétéran » de l'échelle (`level` `min` 130) |
| *le courant disloque votre radeau. Vous regagnez la berge à la nage, gelé* (event 12) | Quelle berge ? On ne sait pas si le joueur a traversé, et la nage dans un torrent paraît facile alors qu'elle coûte 25 PV | *Agrippé à une branche, vous luttez contre les remous et atteignez à grand-peine l'autre rive* |
| *Vous testez chaque planche, comme la route vous l'a appris* (event 12) | Formule toute faite, qui sonne écrite | *Habitué des vieux ponts, vous testez chaque planche* |
| *Le courant vous roule contre les rochers* (event 12) | Verbe mal employé : on roule *sur* quelque chose, ou un courant vous roule *dans* l'eau | *Il vous emporte loin en aval et vous projette contre les rochers* |
| *Le vent se lève et le sable remplace les cailloux : le chemin débouche sur la plage* (event 12) | Détail parasite (le vent) et tournure littéraire | *Bientôt, vos pieds s'enfoncent dans le sable, et vous arrivez sur la plage* |
| *des pierres tombées ont crevé une cachette* ; *le plancher a crevé la cassette* ; *le toit crevé* (events 16 et 76) | Le propriétaire n'aime pas *crever* pour un objet | *ont ouvert une cachette*, *a brisé la cassette*, *le toit délabré* |
| *Pour ne pas déranger le forgeron, vous faites un large détour autour de la prairie. Le sol y est plus mou que prévu* (event 14) | Raison absurde (passer devant quelqu'un ne le dérange pas), *y* qui ne renvoie à rien de clair, et 20 minutes perdues sans que le joueur ait rien fait pour | Une issue neutre sans malus, ou un petit plus : *un ruisseau coupe le chemin : vous vous y rafraîchissez* |

## Structure d'un event

- **Introduction : 200 à 300 caractères.**
  - Elle nomme le lieu du jeu où l'event se déclenche et donne un ou deux détails concrets tirés de son canon, puis l'accroche.
  - Elle peut aller jusqu'à 400 caractères quand elle pose ce que les choix utilisent : qui est le personnage, ce qu'il veut, ce que le joueur en pense.
  - Couper ces éléments pour gagner de la place appauvrit l'event. C'est arrivé avec Donia (event 69), dont on avait perdu le doute du joueur, et avec Parziter (event 76), qui avait perdu son *a besoin d'aide*.
  - Pas de « Vous voyez » en ouverture.
- **Issue : une petite scène qui se tient**, avec ce que fait le joueur, ce qui se passe et la conséquence. Le décor se limite à ce qui sert l'action, avec un détail concret au plus.
- **Une péripétie par issue, et un comportement plausible.** Une issue raconte une chose qui arrive, pas une suite de faits empilés en phrases sèches. Le personnage agit comme agirait quelqu'un de sensé : on ne laisse pas son sac pour aller voir d'où viennent des bruits suspects. Event 1, sans réponse : *Vous montez un campement au pied du chêne. Très vite, des bruits suspects viennent des fourrés. Vous allez voir, sans rien trouver. À votre retour, votre sac a été fouillé* enchaînait quatre faits, dont un geste absurde. C'est devenu une seule scène : le joueur hésite devant l'arbre, s'assied sur une racine, s'assoupit, et se réveille la bourse allégée.
- **Visualise la scène avant d'écrire, puis joue chaque issue dedans.** Avant la première issue, fixe l'espace que pose l'intro : dedans ou dehors, où se tient chaque personnage et le joueur, ce qui est à portée de main, ce que chacun voit et entend. Note-le en tête des `notes` (*Scène : …*). Puis relis chaque issue en te la représentant dans cet espace : un personnage ne passe pas de dehors à dedans sans le dire, une pièce que l'intro n'a pas montrée n'apparaît pas, un geste se fait depuis l'endroit où l'on se tient. Si la scène ne tient pas, corrige l'intro ou l'issue jusqu'à ce que tout se tienne.
  - Relis chaque détail de l'intro contre toutes les issues, un détail à la fois. Event 15 : *ils se taisent* contredisait *Les hommes sont absorbés par leur discussion*, et *la caisse est restée entrouverte* contredisait *vous ouvrez la caisse*. La première correction n'avait traité que l'issue signalée. Quand on corrige une incohérence, on cherche le même détail dans tout l'event.
  - Pense en trois dimensions : comment le joueur entre (une clôture, une porte, un mur à franchir), ce qui est en hauteur et ce qui est au sol, d'où tombe ce qui tombe. Event 18 : l'intro montrait les registres *par une brèche*, puis les issues mettaient le joueur sur l'échafaudage et dans la cabane sans qu'il soit entré ; un pan de palissade tombé sur les pavés ouvre maintenant le chantier. Des murs montés à mi-hauteur n'ont pas de charpente : une poutre *effondrée* ne peut venir que de l'échafaudage. Des registres laissés sur une table en plein air auraient fondu sous la pluie : ils sont dans une cabane.
- **Une réaction de réputation vient de quelqu'un qui a une raison d'être là.** Le karma se montre par un personnage qui vous reconnaît, mais ce personnage fait quelque chose sur place et protège ce qui est à lui. Event 18 : un habitant suivait le joueur au bout de la rue pour qu'il ne touche à rien d'un chantier abandonné qui ne lui appartient pas ; c'est devenu une poissonnière qui vend sa pêche au coin de la ruelle, cache sa recette et appelle ses voisins. Même chose pour la conclusion qu'il tire : un voisin qui reconnaît un voleur le croit en train de piller, pas *envoyé par les créanciers*.
  - Event 14 : l'intro montrait le forgeron *devant la porte*, dehors, mais les issues installaient le joueur *dans l'atelier, près de la forge*, et la chauve-souris s'y envolait. L'intro ouvre maintenant la porte sur une forge à l'intérieur de la maison. Le forgeron qui lançait une gourde au joueur depuis son enclume sort désormais le rejoindre sur le seuil.
- **Chaque issue se lit seule.** Le joueur ne voit qu'une issue, jamais les autres : chacune repart de l'intro et du choix, et pose elle-même ce qu'elle utilise. Écrites à la suite, les issues ont tendance à s'appuyer les unes sur les autres et à s'expliquer de moins en moins. Event 3, *Forcer le cadenas* : l'issue 0 trouve une pierre, l'issue 2 commençait par *La pierre ripe* (quelle pierre ?), et l'issue 4 par *Le vacarme attire les marchands* (quel vacarme ?), sans dire que le joueur frappe. Relis chaque issue juste après l'intro et le libellé, comme si c'était la seule.
- **La longueur d'une issue suit ce qu'elle a à raconter.** Beaucoup d'issues font entre 150 et 280 caractères, mais c'est un constat, pas une cible.
  - Une issue sans histoire peut tenir en une ou deux phrases (80 à 150 caractères) : passer son chemin, un refus accepté, une chute comique qui fait mouche.
  - Une issue qui enchaîne une cause, un retournement et une conséquence, ou qui fait vivre un personnage nommé, peut aller jusqu'à 400 caractères.
  - N'allonge pas une issue courte avec du décor ou un sentiment. Ne coupe pas ce qui rend une scène compréhensible.
  - Des longueurs variées se lisent mieux qu'une série d'issues taillées sur le même gabarit. Dans les 27 premiers events réécrits, 99 % des issues faisaient entre 150 et 280 caractères : c'est ce qu'on veut éviter.
- **L'issue rend le choix lisible.** Le libellé est court, donc la première phrase de l'issue rappelle ce que fait le joueur quand ce n'est pas évident : *Par méfiance, vous partez dans la direction opposée et contournez le Bois Hurlant par l'est.* Une chute comique peut tenir lieu de rappel.
- **Choix : un libellé court**, avec un verbe à l'infinitif.
  - Raccourcir un libellé ne doit pas cacher ce que font ses issues. Event 71 : *Accepter et profiter de la nuit pour lui dérober ses biens* était devenu *Le suivre pour le voler*, alors que dans quatre issues sur sept le joueur assommait l'ermite d'un coup de pierre. Le joueur ne fait que ce qu'il a choisi : si le libellé dit *voler*, les issues racontent un vol ; un coup reste une issue minoritaire, portée par une condition, ou le libellé l'annonce.
  - Il finit par un point, comme une phrase.
  - Il dit l'action, sans détail : les détails vont dans l'issue. *Prêter main-forte au pêcheur en difficulté* devient *Aider le pêcheur* ; *Chercher un chemin pour contourner l'obstacle* devient *Contourner l'obstacle*.
  - Il annonce la réussite visée, pas une tentative : *Faire fuir le chien*, pas *Essayer de faire fuir le chien*. C'est l'issue qui dit si ça marche.
  - Pas de « quand même » ni de jugement sur le choix : *Rester sur le sentier principal*, pas *Traverser quand même par le sentier principal*.
- **Ne pas déplacer un event.** Garde le déclencheur de `develop`. L'event 10 avait glissé du Lac Mirage à la Rivière Vacarme, qui avait déjà deux events au bord de l'eau.
- **Ne pas copier un autre event.** Quand deux events se ressemblent, leurs choix doivent différer. L'arbre tombé de la Forêt Du Vieillard (event 1) reprenait les choix de celui du Chemin aux Loups (event 55) ; on y a remplacé « escalader » par « rebrousser chemin ».
- **Fidélité à l'original.**
  - Même situation, mêmes personnages, même humour, mêmes possibilités.
  - Ce qui est illogique se corrige en gardant l'idée. Par exemple, le renard mort qui se relève pour mordre devient un spasme qui fait reculer le joueur contre un arbre, pour la même perte de vie.
  - **Quand l'original est vraiment faible, change sa prémisse plutôt que de le rapiécer.** Un event sans lien avec le lore, qui ne peut pas se répéter ou dont la situation ne tient pas, ne s'améliore pas à coups de retouches : chaque correction en révèle une autre. Garde ses possibilités et l'idée de chacune, et trouve une situation qui les porte mieux. Event 26 : une pendaison « pour propos contraires aux valeurs de l'Église », réécrite deux fois sans tenir, est devenue un spectacle où les villageois de Ville Forte rejouent pour les voyageurs la pendaison du traître de la Guerre des Héritiers. La scène revient naturellement, elle porte le lore, et s'interposer ou dénoncer les complices deviennent des façons de jouer le jeu.

## Lore

- **Pas de religion structurée.**
  - Pas de dieu qui agit, de clergé, de panthéon ni de miracle avéré.
  - Une expression ou une superstition reste possible.
  - Il y a toujours une explication possible : la Résonance, un escroc, une drogue.
- **Présent permanent.**
  - Pas de « plus jamais » ni de « désormais ».
  - Pas de mort d'un personnage récurrent.
  - Le joueur ne sauve pas la princesse et n'est pas adoubé : on reste à échelle humaine.
  - L'aléatoire s'explique par un trait de caractère.
  - **Une scène qui revient doit pouvoir revenir.** Le joueur retombe sur le même event, au même endroit. Une scène qui n'arrive qu'une fois (une exécution, un incendie, la visite d'un roi) se présente comme une habitude du lieu, avec sa raison. Event 26 : une vraie pendaison à chaque passage à Ville Forte ne tenait pas ; c'est devenu un spectacle que les villageois rejouent pour les voyageurs.
- **Un terme du lore s'explique en quelques mots, et une faction agit selon ses buts.** Le joueur ne connaît pas la bible : *la Charte* seule ne lui dit rien, *la Charte, qui donne la couronne au plus méritant et non au mieux né* lui suffit. Vérifie dans la bible ce que veut chaque faction. Event 26 : un noble du Parti des Lignées, qui veut abolir la Charte, faisait pendre un paysan pour avoir parlé *contre* la Charte ; c'est l'inverse. Évite aussi les mots rares comme *séditieux*.
- **Pas de passé commun inventé.** Le joueur n'a pas vécu ce que l'intro lui prête (*le paysan qui vous a un jour hébergé*), et il le relirait à chaque passage. Un lien personnel passe par une condition (karma, badge) ou par la scène elle-même.
- **Personnages nommés** : on suit leur fiche dans la bible. Un lien discret avec le lore est bienvenu s'il est naturel (le Grand Livre de Liard, la Résonance, une faction), sans en faire le sujet.

## Canon des lieux

- **Les voisins de la carte sont les seuls lieux qu'on peut supposer proches.**
  - Ne suppose jamais la destination suivante du joueur.
  - `mapTypesDestination` doit viser un type présent chez un voisin, sinon l'event plante. C'est arrivé avec le type `mo` près de Claire de Ville.
- **Un trait par lieu, qu'on ne prête pas à un autre.** Le joueur retient chaque lieu par un trait marquant. Si deux lieux partagent le même, il les confond. Des brigands peuvent rôder un peu partout, mais chaque lieu garde sa façon d'en avoir :
  - le Bois Hurlant : des brigands terrés dans les grottes de ses collines (description du jeu ; events 11 et 13) ;
  - le Grand Axe : la route des brigands, avec leurs campements au bord du chemin (events 17 et 43) ;
  - la Forêt du Vieillard : une forêt immense où l'on se perd (description du jeu), sans brigands.
  Avant de donner un trait à un lieu, vérifie dans la description du jeu et dans le canon de la bible qu'un autre lieu ne l'a pas déjà.
- **Le décor suit l'état du lieu.** Dans des ruines, pas de *salle commune* ni de *comptoir* en activité : *vers les ruines*, *les vestiges de l'écurie*.
- **Villes : ne contredis pas le menu affiché juste après l'event.**
  - L'auberge porte son nom du jeu (Halte des Braves, Auberge du Seigneur…).
  - Pas de forgeron ni de boutique que la ville n'a pas.
  - Mernil est itinérante.
- **`forceStayInCity`** : seulement dans une ville, et quand rester est naturel. Pas après une fuite.
- **Quitter la ville : `forceLeaveCity`.** Sans `forceStayInCity` ni `forceLeaveCity`, le joueur voit le menu des destinations, qui lui propose aussi de rester en ville. Une issue où il est chassé, s'enfuit ou raccompagné aux portes le dit et pose `"forceLeaveCity": true` (ou `mapTypesDestination`, qui le fait partir aussi). Event 13 : un joueur recherché qui semait les gardes pouvait aller dormir à la Halte des Braves juste après.
- **Rebrousser chemin.** Une issue « rebrousser chemin » renvoie le joueur d'où il vient avec `"goBackToPreviousMap": true`, et le texte le dit (*vous repartez par où vous êtes venu*). Le demi-tour est impossible vers une ville ou par un lien à sens unique : l'issue doit donc aussi déclarer `mapTypesDestination` (les types des voisins), utilisé à sa place. Le choix n'est ainsi jamais masqué, contrairement au demi-tour retiré par #4844. Réserve ce texte aux lieux dont aucun voisin n'est une ville ; sinon, écris *vous repartez par la première route venue* et n'utilise que `mapTypesDestination`.

## Issues conditionnelles

### Un choix doit être prévisible

L'un des buts de la réécriture : quand le joueur clique sur un bouton, il sait à peu près ce qui va se passer, compte tenu de ce qu'il choisit et de sa situation.

- Le libellé annonce l'action, et les issues du choix en sont des variantes : aider le pêcheur donne une prise, petite ou grosse, ou un échec quand on est faible ; pas un trésor caché ni une chute sans rapport.
- Les conditions rendent le résultat plus prévisible, pas moins : un joueur fort s'attend à s'en sortir, un joueur mal famé à être reconnu. Ce que le texte raconte découle du profil, et le profil se lit dans le texte.
- Les surprises restent possibles, mais minoritaires : une issue inattendue par choix au plus, et elle doit rester liée à la situation de l'event.

### Une réaction à la mesure de ce que fait le joueur

**Le contre-exemple (event 75).** Le joueur décline poliment l'invitation d'un capitaine pirate qu'il n'a jamais vu. Dans la réécriture, le capitaine fait tirer au canon sur lui, et quatre issues sur cinq de ce choix étaient des boulets (trois paliers de vitesse et une armure). Quand le joueur ne répond pas, le même capitaine descend de son navire pour l'assommer. On lit ça et on se dit : pourquoi ?

1. **Disproportion.** Un refus poli ne mérite pas de l'artillerie. La réaction dépasse de loin ce que le joueur a fait.
2. **Aucune relation.** Le capitaine ne connaît pas le joueur. Une hostilité envers un inconnu n'a pas de cause.
3. **Contre l'intérêt du personnage.** Tirer au canon à côté du port de Mergagnan coûte un boulet et attire la garde, pour rien.
4. **Les paliers ont fait de l'exception la règle.** L'original avait un coup de canon parmi deux issues. En le graduant en trois paliers et une armure, la réécriture a fait du bombardement le cas normal : le choix le plus prudent est devenu le plus dangereux, à l'inverse de « Un choix doit être prévisible ».

L'original contenait déjà le canon. La fidélité garde l'idée (un coup de canon, une bouteille de rhum), pas l'incohérence.

**Avant d'écrire qu'un personnage s'en prend au joueur, réponds à trois questions :**
- Qu'a fait le joueur pour le provoquer ?
- Que sait le personnage du joueur ?
- Qu'y gagne-t-il, et que risque-t-il ?

Si l'une n'a pas de réponse dans le texte, l'issue ne tient pas.

**L'échelle de réaction d'un inconnu :**

| Ce que fait le joueur | Réaction la plus forte d'un inconnu |
|---|---|
| neutre ou poli : refuser, passer, se taire | indifférence, moquerie, un geste d'humeur (une bouteille lancée par dépit) |
| maladroit ou vexant : insister, fouiner, se moquer | refus sec, on le chasse |
| malhonnête ou menaçant : voler, pousser, provoquer | bagarre, poursuite, garde appelée |
| hostile : attaquer | violence |

- **Monter d'un cran demande une raison montrée dans le texte, portée par une condition** : un joueur au karma bas qu'on reconnaît, un joueur qui surprend un secret, un personnage déjà présenté comme ivre, fou ou hostile dans l'introduction.
- **Sans raison, change la cause du malus, pas son effet** : un accident (une salve d'adieu mal pointée), le lieu (une planche pourrie), la maladresse du joueur, un tiers qui a ses propres raisons.
- **Gradue la conséquence, jamais une prémisse douteuse.** Avant de découper une issue en paliers, vérifie que sa situation de départ est plausible pour tous les joueurs : les paliers la multiplient et en font la norme.
- **Un choix prudent reste prudent.** Refuser, décliner, passer son chemin : la majorité de ses issues se passent bien. Un malus y reste rare et vient du monde, pas d'un personnage qui surréagit. Pas de malus gratuit non plus : une perte de temps ou de vie sans condition a une cause que le joueur relie à son choix (event 14 : continuer sa route faisait perdre 20 minutes pour un détour sans raison).
- **Quand le joueur ne répond pas (`end`), son personnage fait ce qu'il veut.** Le joueur n'a rien choisi : c'est le personnage qui prend la main. On privilégie l'inaction et la rêverie (il hésite, regarde, s'assoupit, et le monde agit autour de lui), mais ce n'est pas obligatoire : il peut aussi agir librement (monter un campement, partir en chasse au trésor, se méfier d'un piège, pousser quelqu'un). Ce qu'il fait reste plausible dans la scène, et les réactions des autres restent à la mesure de ses actes. C'est la possibilité où l'on a le plus de liberté.
  - Les autres personnages, eux, agissent selon ce que l'intro dit d'eux. Event 11 : l'inconnue qui rabat les voyageurs vers un guet-apens passait des heures à raconter des histoires au joueur muet, puis se vexait de son silence. Une rabatteuse ne perd pas son temps avec un voyageur qui se méfie : elle se trouble et s'éloigne, ou rejoint ses complices, que le joueur peut suivre.
- **Un personnage garde la même attitude envers un même profil dans tout l'event.** Si l'équipage traite un joueur au karma bas comme l'un des siens quand il accepte, il ne le canarde pas quand il refuse.

### Combien et lesquelles

- **Par possibilité :** au moins 3 issues, dont au moins une sans condition. Le cas général tient en quelques issues (6 sans condition au plus). Les issues rares, réservées à un familier, un badge, une classe ou un profil particulier, n'ont pas de plafond : ajoutes-en autant que la scène s'y prête (event 10 : la loutre qui plonge, l'ours qui pêche comme au saumon, le chat qui vole la prise).
  - Des paliers complémentaires seuls (vitesse faible / moyenne / forte) ne suffisent pas : un joueur donné retomberait toujours sur la même issue. Ajoute une ou deux issues sans condition pour la variété (event 12, emprunter le pont et traverser à la nage).
  - **Pense au joueur le plus courant.** Le karma n'est pas encore en production : pour l'instant, tous les joueurs sont à 0, et les issues de karma ne leur apportent aucune variété. Un joueur au karma 0, sans familier, doit avoir au moins deux issues possibles à chaque choix, quels que soient son niveau et ses statistiques. Event 13 : neuf issues de karma, mais un joueur courant qui proposait son aide aux gardes obtenait toujours le même refus poli. Le validateur avertit d'un tel choix (sauf `end`).
  - **Pas deux fois la même scène.** Deux issues d'un même choix qui ne diffèrent que par la durée ou le montant n'en font qu'une. Event 11 : dans `end`, l'inconnue parlait au joueur dans deux issues, une heure dans l'une, des heures dans l'autre. Garde-en une, ou change ce qui se passe.
- **Pour tout l'event :**
  - environ 2 à 4 fois plus d'issues que l'original ;
  - environ les trois quarts sont conditionnelles ;
  - une ou deux possibilités nouvelles au plus.
- **Le cas général d'abord.** Chaque possibilité traite le cas général sans condition, ou avec une paire de conditions complémentaires (défense `max` 519 / `min` 520). Une issue conditionnelle fait basculer la situation pour un profil particulier ; elle ne doit jamais pénaliser une force *par accident*, c'est-à-dire en réservant aux forts un risque que la situation fait courir à tout le monde.
  - Faux (event 2, ignorer le chien) : seule une défense ≥ 400 donnait une issue où le chien attaque. Les autres joueurs n'étaient jamais attaqués : avoir une grosse défense ajoutait un risque.
  - Juste : le chien attaque tout le monde (défense `max` 519, -20 PV) ; une bonne armure réduit les dégâts (défense `min` 520, -8 PV).
  - Juste aussi, sans complémentaire (event 10, aider le pêcheur) : une attaque faible ajoute un risque de chute, mais le cas général, tirer la ligne avec lui, est déjà traité sans condition.
- **Une vraie conséquence pour les meilleurs.** Une issue réservée à un joueur fort ne se contente pas d'être « la même, sans dégâts » : il prend l'initiative et ça change la suite. Event 11 : il repère le guet-apens, capture un brigand, le livre à la garde contre une prime et repart vers Claire de Ville (`mapTypesDestination`). Les destinations et `forceStayInCity` font de bonnes conséquences.
- **Le revers d'une force.** Toutes les stats ne doivent pas jouer dans le même sens : quand c'est la force elle-même qui cause le problème, une issue où un joueur fort s'en sort moins bien est bienvenue. Elle s'ajoute aux issues habituelles de ce joueur, sans les remplacer.
  - Le pont pourri cède sous le poids d'une lourde armure (event 12, défense `min` 740) ; une armure gorgée d'eau tire le nageur vers le fond.
  - Une attaque trop forte casse la canne du pêcheur (event 10, attaque `min` 780) ou défigure le marchand qu'on voulait juste bousculer.
  - Un coureur trop rapide rate la marche effondrée (event 2, vitesse `min` 500).
  - Le malus reste petit (étourdi, quelques PV, quelques pièces) : c'est un clin d'œil, pas une punition.
- **Chaque profil doit avoir au moins une issue possible**, karma et familier compris.
  - Le test `eventsRequirements.test.ts` ignore le karma et les familiers.
  - Or une liste d'issues valides vide fait planter `pickRandomOutcome` : `random-js` lève une erreur sur `pick([])`. Le choix reste affiché : seul un `condition` posé sur la possibilité elle-même la masque.
  - Le test `eventsRequirements.test.ts` explore toutes les conditions (karma, familier, cuisine, matériaux, enchantement compris) et donne le profil sans issue.
  - Piège fréquent : deux plages qui ne se touchent pas (`speed` `max` 200 et `min` 250 laissent 201 à 249 sans issue). Les plages opposées doivent se recouvrir ou se toucher, sinon il faut une issue sans condition.

### Texte et mécanique

- **Chaque issue a son texte et chaque texte son issue.** La mécanique doit correspondre au texte :
  - une perte de vie est une blessure ;
  - `money` est un gain de pièces ;
  - `randomItem` est un objet ;
  - `lostTime` est du temps perdu ;
  - `effect` doit être plausible : `sleeping` quand le joueur dort, `drunk` quand il a bu.
  - Un lit est partagé avec celui de la maison et de l'auberge : une issue où le joueur dort dans un lit (chambre, dortoir, lit d'un hôte, couchette) pose `"useBed": true`. Elle disparaît si le joueur a dormi dans un lit dans les dernières 24 heures, et l'empêche de redormir dans un lit ensuite (event 13, le dortoir de la Halte des Braves). Voir `reference.md`, section « Dormir dans un lit ».
  - `confounded` veut dire **étourdi** (pas « confus ») : c'est l'altération d'une petite blessure, d'un coup ou d'une chute légère (event 10, tomber dans le lac avec le pêcheur ; event 11, une entaille au bras). Garde `hurt` pour une vraie blessure, et ne mets aucune altération pour une égratignure.
  - **L'altération suit la partie du corps touchée.** Un pied écrasé ou brûlé, une cheville tordue : `feetHurt` (le joueur boite). Un coup à la tête : `confounded`. La douleur n'étourdit pas : *Étourdi par la douleur* ne se dit pas (event 14, un soc brûlant sur le pied, passé à `feetHurt`).
  - **Le geste après une blessure est celui qu'on ferait.** On bande un pouce écrasé, on plonge une brûlure dans l'eau froide, on presse une plaie. On ne *secoue pas la main* après un coup de marteau (event 14).
- **La gravité du texte suit la perte de vie.** Un chien qui mord *encore et encore* ne colle pas à -25 PV ; une mâchoire de piège qui s'enfonce dans la cheville vaut -40 PV. Ajuste le texte ou le chiffre.
- **Le texte décrit la stat, pas l'équipement.** Une défense faible, c'est *sans bonne armure* : le joueur en porte une. *Sans armure* fait croire à un inventaire vide. De même, une attaque faible n'est pas *sans arme*.
- **Pas d'équipement que le joueur ne porte pas vraiment.** Un joueur peut se battre à mains nues (l'arme 0, *Poing*) et sans armure. Le texte ne parle de *votre arme*, *votre lame*, *votre pioche* ou *votre armure* que si une condition le garantit : `weaponTags`, `attack` `min` 600, `weaponLevel` `min` 1 ou un enchantement d'arme pour l'arme ; `defense` `min` 520, `armorLevel` `min` 1 ou un enchantement d'armure pour l'armure. Une statistique forte pour le niveau le garantit aussi (`level` `max` 80 et `defense` `min` 280, par exemple ; voir « Relatif au niveau ») : à niveau égal, seul l'équipement la donne. Une classe ne le garantit pas : un Chevalier a une *allure de chevalier*, pas forcément une armure. Sinon, le joueur se sert de ce qu'il trouve sur place (*une grosse pierre*, *la pointe d'un bâton*) ou le texte reste neutre (*vous encaissez le choc*). Event 3 : *Attaquer le cadenas à coups de pioche* est devenu *Forcer le cadenas*, avec une pierre dans le cas général et une meilleure issue pour une arme lourde (`weaponTags` `blunt`).
- **Le temps suit la durée.** Le joueur n'a pas d'horaire : jamais *en retard*, *avec du retard*, *plus tard que prévu* (écris *plus longtemps que prévu*). Le mot dépend des minutes perdues (`lostTime`, ou la durée de l'altération) : *un moment* sous 30 minutes, *plus longtemps que prévu* vers une heure, *des heures* à partir de 90 minutes.
- **La récompense suit l'exploit raconté.** Un combat glorieux rapporte plus qu'une bourse ramassée ; une humiliation coûte plus de karma qu'une maladresse (event 10, -12 au lieu de -10).
- **Une trouvaille a une raison d'être là.** Un objet caché sous une planche du pont, sans explication, ne tient pas ; un objet abandonné dans les roseaux de la rive, repéré par un œil exercé, si.
- **Une ruse tient debout des deux côtés.** Qui l'a préparée, pourquoi, et quand le joueur la découvre, au moment où il la découvrirait vraiment. Event 71 : une bourse remplie de noyaux de dattes, que le joueur ne découvre qu'en la vidant loin de la tente, ne tient pas. Personne ne range des noyaux dans une bourse, et on sent tout de suite la différence. Ce qui tient : Xirtex attendait ce voleur au karma bas et lui a préparé un leurre, une bourse lourde remplie de cailloux plats qui tintent comme des pièces, que le joueur ouvre au clair de lune à peine sorti.
- **Une perte de temps plutôt qu'une altération lourde** quand la situation est bénigne : se perdre dans une auberge en ruine, c'est fort ; mettre longtemps à en ressortir (`occupied`), c'est juste.
- **Le mot du texte suit le seuil**, et inversement.
- **La condition est la cause de ce qui arrive.** Le joueur doit pouvoir relier son issue à ce qui la déclenche. La fatigue dépend de l'énergie (`energyPercent`), pas de la vitesse. La vitesse sert à rattraper, esquiver, se rattraper à temps ou fuir, et le texte le montre (*Trop lent pour l'éviter…*, *vous ne vous rattrapez pas à temps*). Event 14 : continuer malgré la fatigue faisait s'effondrer les joueurs à 10 de vitesse ou moins et donnait des ampoules aux autres ; c'est maintenant l'énergie qui décide (`max` 15 : il s'endort au bord du chemin ; 16 à 50 : il traîne les pieds).

### L'échelle des seuils

L'échelle est calée sur les 130 joueurs réguliers en production, c'est-à-dire ceux qui ont joué au moins 3 jours sur 14. Les statistiques comptent l'équipement et la potion. Le niveau médian est 96.

| Le texte décrit… | `level` | `attack` | `defense` | `speed` | Part des joueurs |
|---|---|---|---|---|---|
| un débutant | `max` 30 | `max` 90 | `max` 60 | `max` 10 | 10 % |
| un joueur encore faible | `max` 55 | `max` 230 | `max` 180 | `max` 40 | 25 % |
| un joueur correct, pas nul | `min` 120 | `min` 600 | `min` 520 | `min` 350 | 25 % |
| un joueur fort, un vétéran | `min` 130 | `min` 700 | `min` 740 | `min` 500 | 10 % |
| un joueur exceptionnel | `min` 140 | `min` 780 | `min` 860 | `min` 560 | 5 % |

- **Relatif au niveau.** Une statistique ne dit quelque chose qu'à niveau égal : une défense de 300 est une armure lourde pour un joueur de niveau 50, et une armure ordinaire au niveau 130. Une issue peut donc combiner `level` et la statistique dans la même condition. Une tranche de niveau donne une issue, avec le même texte d'une issue à l'autre. Le quart le plus faible et le quart le plus fort de chaque tranche, mesurés sur les 145 joueurs réguliers le 25/11/2026 :

  | Niveau | `attack` faible / fort | `defense` faible / forte | `speed` faible / forte |
  |---|---|---|---|
  | 1 à 40 | `max` 40 / `min` 120 | `max` 40 / `min` 120 | `max` 8 / `min` 30 |
  | 41 à 80 | `max` 185 / `min` 295 | `max` 115 / `min` 280 | `max` 25 / `min` 105 |
  | 81 à 110 | `max` 430 / `min` 560 | `max` 245 / `min` 510 | `max` 75 / `min` 330 |
  | 111 et plus | `max` 555 / `min` 675 | `max` 450 / `min` 760 | `max` 240 / `min` 500 |

  Exemple, event 17 : la branche qui cède sous une *lourde armure* vaut pour une défense d'au moins 280 jusqu'au niveau 80, 510 de 81 à 110 et 760 au-delà. L'échelle absolue ci-dessus reste le bon outil quand le texte décrit un joueur fort dans l'absolu (*un vétéran*, *un combattant redouté*).
- **Une vitesse de 10 ou moins existe bien** : 17 joueurs réguliers sur 145 (12 %, mesuré le 25/11/2026). Ce sont surtout les classes en armure lourde (Ganté, Casqué, Maillé, Tank impénétrable), que leur équipement ralentit, et les débutants. Le texte d'une telle issue montre une lenteur, pas une faiblesse en général.
- **« Fort » veut dire vraiment fort**, le premier dixième. Être dans le premier quart, c'est juste « correct ».
- **Des paliers plutôt qu'un seuil binaire.** Entre une défense de 519 et de 520, le joueur ne doit pas passer de « se faire déchiqueter » à « s'en sortir indemne ». Quand une stat fait varier un malus ou un bonus, on le gradue en trois paliers :

  | | Faible | Moyen | Fort |
  |---|---|---|---|
  | `attack` | `max` 230 | `min` 231, `max` 599 | `min` 600 |
  | `defense` | `max` 180 | `min` 181, `max` 519 | `min` 520 |
  | `speed` | `max` 40 | `min` 41, `max` 349 | `min` 350 |
  | `level` | `max` 55 | `min` 56, `max` 119 | `min` 120 |
  | Malus | lourd | léger | rien |
  | Bonus | rien | un petit quelque chose | tout |

  - Exemple, event 10 (aider le pêcheur) : attaque faible, vous tombez à l'eau et vous blessez ; moyenne, vous dérapez sur les planches et vous écorchez les genoux ; forte, vous remontez une prise rare.
  - Exemple, event 2 (ignorer le chien) : défense faible -25 PV, moyenne -12, forte -3.
  - Un malus réservé aux plus faibles, sans palier moyen, reste possible si le cas général est traité par ailleurs (event 10 : seul un joueur faible peut tomber à l'eau).
- **La difficulté change d'un event à l'autre.** Si tous les events coupent aux mêmes valeurs, le joueur passe d'un coup de « ne réussit rien » à « réussit tout » quand il franchit l'attaque 600 ou la défense 520. Chaque épreuve a sa difficulté, tirée de la scène : écarter un chien n'est pas traverser un torrent. Choisis pour chaque épreuve un des quatre paliers ci-dessous (bornes incluses), et varie-les d'un event à l'autre ; le palier standard ne doit pas être celui de tous les events.

  | Difficulté | Exemple de scène | Échec (lourd) | Moyen | Réussite | `attack` | `defense` | `speed` | `level` |
  |---|---|---|---|---|---|---|---|---|
  | facile | écarter un chien, attraper une noix | 10 % les plus faibles | | la moitié des joueurs | 90 / 91-439 / 440 | 60 / 61-339 / 340 | 10 / 11-134 / 135 | 30 / 31-95 / 96 |
  | standard | aider à tirer une ligne | le premier quart | | le dernier quart | 230 / 231-599 / 600 | 180 / 181-519 / 520 | 40 / 41-349 / 350 | 55 / 56-119 / 120 |
  | difficile | traverser un torrent, maîtriser un garde | la moitié des joueurs | | le premier dixième | 440 / 441-699 / 700 | 340 / 341-739 / 740 | 135 / 136-499 / 500 | 96 / 97-129 / 130 |
  | très difficile | soulever une poutre de pont-levis, battre un vétéran | les trois quarts | | les 5 % meilleurs | 600 / 601-779 / 780 | 520 / 521-859 / 860 | 350 / 351-559 / 560 | 120 / 121-139 / 140 |

  Le mot du texte suit le palier : l'échec d'une épreuve facile est celui d'un débutant, la réussite d'une épreuve très difficile celle d'un joueur exceptionnel. Le validateur avertit quand toutes les épreuves d'un event sont au palier standard.
- **De la variété dans les seuils.** Les joueurs réguliers sont nombreux tout en haut, avec un creux autour du niveau 80 : ne mets pas tous les seuils tout en haut. Quelques issues vraiment réservées aux meilleurs, qu'on découvre tard, c'est voulu ; mais chaque event a aussi des issues pour les joueurs faibles et moyens.
- **Un niveau 60 est encore le début du jeu.**
- **Classes et familiers.** Une condition sur une seule classe ou un seul type de familier peut ne toucher que 1 à 2 % des joueurs : c'est voulu. Des issues rares, avec une part de joueurs concernés très variable, rendent l'event plus riche.
  - Quand l'issue repose sur une capacité partagée (voler, flairer, porter le joueur, être très lourd, faire peur), utilise la condition `petTags` (`"petTags": ["keenNose"]`) plutôt qu'une longue liste d'ids : elle vise toute la famille, y compris les familiers ajoutés plus tard. Le texte dit alors *votre familier*, et ce qu'il fait convient à chaque animal qui a le tag. Les tags existants et la règle pour en créer un : `reference.md`, section « Familiers ».
  - Si la capacité manque, crée le tag quand plusieurs familiers la partagent et qu'elle peut resservir. Pour un seul familier ou un comportement propre à quelques animaux (le chien qui aboie), garde `validPetTypeIds` : pas de tag pour chaque animal.
  - **Une condition large appelle un geste que tous peuvent faire.** `petRarity` couvre tous les familiers, poissons, méduse, escargot et fantôme compris : un familier qui *longe la berge le nez au vent*, *fouille un quai* ou *vous mordille la main* ne convient pas à tous. Avec `petRarity`, écris un geste que n'importe quel familier peut faire (*s'agite près de vous*, *attire l'attention*), ou passe par `petTags` pour viser ceux qui ont la capacité.
  - **Pas de chien par réflexe.** Le chien est le premier animal qui vient à l'esprit, et les réécritures en mettaient partout. Une issue réservée au chien (`validPetTypeIds` 1, 2, avec parfois le loup 28) n'est permise que pour un comportement propre au chien : aboyer, tirer sur sa laisse, hurler, jouer avec un autre chien. Pour flairer une piste, creuser, retrouver un objet ou faire peur, utilise `petTags` (`keenNose`, `intimidating`) : ces capacités appartiennent à toute une famille d'animaux. Event 3 : *votre chien renifle le sable et déterre la clef* est devenu *votre familier* avec `keenNose`. Le validateur avertit de chaque issue réservée au chien.
  - **Pas de gibier de l'espèce du familier.** Une issue où le joueur chasse, cuisine ou mange un animal ne s'affiche pas à celui dont le familier est de la même espèce : on la lui masque avec `excludedPetTypeIds`. Event 17 : le joueur qui a une volaille ne plume plus de faisan, et celui qui a un lapin n'en grille plus. Si l'exclusion vide un choix pour ce familier, ajoute-lui une issue où il est là : au carrefour de l'event 19, le renard du joueur se couche contre la dépouille et l'empêche de la dépecer. Le validateur avertit quand une issue grille ou mange un animal qu'un joueur peut avoir comme familier sans l'exclure.
- **Cuisine, matériaux, enchantements et amélioration de l'équipement.** Des conditions existent aussi sur le niveau de cuisine (`cookingLevel`), les matériaux du sac (`materials`), l'enchantement de l'arme ou de l'armure équipée (`enchantment`) et leur amélioration chez le forgeron (`weaponLevel`, `armorLevel`). Une issue peut aussi consommer (`consumeMaterials`) ou donner (`giveMaterials`) des matériaux. Formats et repères en production : `reference.md` de l'atelier, section « Cuisine, matériaux et équipement ».
  - Cuisine : 52 % des joueurs réguliers sont au niveau 0 et 70 % à 30 ou moins ; « bon cuisinier » = `min` 70 (12 %), « chef » = `min` 90 (5 %).
  - Savoir ce qui se mange demande un vrai niveau. Event 17 : *lesquels se mangent, et comment les préparer ?* et le champignon rouge à points blancs croqué à pleines dents visaient `max` 0, alors qu'un cuisinier de niveau 20 ne trie pas mieux les champignons. Une issue où le joueur ne sait pas vise `max` 30 ; `max` 0 ne décrit que celui qui n'a jamais cuisiné.
  - Les matériaux sont très répandus : une condition de matériau raconte ce que le joueur a dans son sac, pas un joueur rare.
  - Le matériau doit correspondre au texte : pour une corde, vise les `ids` des cordes, pas le type `rope` qui contient aussi les tissus.
  - Une condition `materials` ne retire rien : le texte ne dit pas que le matériau est perdu. Si l'issue l'utilise, c'est `consumeMaterials`, et le jeu affiche lui-même ce qui est retiré.
  - **Le sac du joueur résout la scène.** Une issue `consumeMaterials` où le matériau sert vraiment à franchir l'obstacle plaît au propriétaire. Event 16 : un escalier effondré descend vers les caves ; le joueur attache une corde de son sac à un pilier et se laisse glisser dans le noir. En bas, un coffre a échappé aux pillards, et il remonte à la force des bras en laissant la corde nouée au pilier. Le texte montre le geste et où reste le matériau, et la récompense est meilleure que celle des autres issues (objet de rareté 3 au moins).
  - **Montre ce que le joueur a construit.** Une issue rare peut mettre en scène son équipement : l'objet fait quelque chose de visible, et la scène y réagit. Event 14 : le joueur pose son arme enchantée près de l'enclume pour aider le forgeron. Elle se met à vibrer, et le forgeron, qui n'en avait jamais vu, en relève les motifs et le paie pour ce privilège. Le propriétaire veut d'autres issues de ce genre.
    - Ce qui se voit vraiment : un enchantement magique (6 % des joueurs). Une arme au feu (`kinds` `burnedDamage`) tiédit, rougeoie, fait fumer l'eau, allume un feu. Une arme au givre (`frozenDamage`) se couvre de givre et refroidit ce qu'elle touche. Une arme au venin (`poisonedDamage`) suinte une goutte verdâtre. Avec `types` `["magic"]` seul, le texte reste vague (elle vibre, une lueur court sur le métal).
    - Ce qui se reconnaît : une arme ou une armure très améliorée chez le forgeron (`weaponLevel` ou `armorLevel` `min` 3, 17 %), qu'un artisan ou un garde reconnaît comme un travail rare. Un enchantement ordinaire (attaque, défense, vitesse, 40 à 60 % des joueurs) ne se voit pas : pas de scène dessus.
    - Le geste tient la physique de l'élément, et la réaction est l'émerveillement ou la curiosité, pas la peur. La récompense reste modeste : quelques pièces, un objet, un service rendu.
- **Argent du joueur.** Une issue peut dépendre des pièces que le joueur porte (`money` dans `requirements`) : fauché `max` 5 000, riche `min` 100 000, fortune `min` 500 000. Échelle complète dans `reference.md`, section « Argent du joueur ». La richesse se montre (une bourse qui tinte, un marchand qui flaire le client) et a ses revers (prix gonflés, pickpockets). Une issue où le joueur paie peut exiger qu'il ait de quoi payer.
- **Badges.** Une issue peut dépendre d'un badge gagné dans le monde du jeu (`badges`) : guilde puissante, familier légendaire, chef cuisinier, protecteur de l'Oracle, relique reforgée… La liste, le sens de chaque badge et la part des joueurs qui l'ont sont dans `reference.md`, section « Badges ». Les badges hors fiction (équipe, donateurs, concours, votes) sont refusés. Le badge se montre comme le karma, par un personnage qui reconnaît le joueur ou ce qu'il a fait, et doit être en lien avec la scène.
- **Combats.** Une issue peut déclencher un combat contre un monstre à niveau fixe (`fight`), joué juste après son texte ; la destination se choisit une fois le combat fini.
  - Rare : au plus un choix par event mène à un combat, et seulement quand la scène pose un adversaire qui veut se battre (un brigand qui barre la route, pas un marchand vexé). Le combat n'est jamais l'issue d'un choix prudent.
  - Le niveau est fixé par l'issue, donc l'issue borne `level`, et plusieurs paliers font plusieurs issues. **Les niveaux et les tranches changent d'un event à l'autre, selon l'adversaire.** Un brigand blessé ou un faux récolteur est faible (niveau 15 à 20). Un seigneur squelette ou un chef de mercenaires est redoutable (niveau 130 à 140, réservé aux joueurs de niveau 95 à 100 et plus). Si tous les combats se jouaient à 40 et 100, le joueur rencontrerait partout le même adversaire. La récompense d'un combat gagné suit le niveau du monstre : environ 2 à 5 pièces et 0,8 point d'expérience par niveau.
  - Une issue de combat exige `energyPercent` `min` (le joueur a encore des forces, 40 est un bon repère). Le revers est une issue `energyPercent` `max` 15 : épuisé, le joueur ne peut pas se défendre et subit pire qu'un combat perdu.
  - Le texte de l'issue pose l'affrontement sans le résoudre. Les textes `fights.<issue>.won` et `.lost` racontent la suite, chacun lisible seul ; le jeu affiche lui-même gains et pertes. Format et monstres : `reference.md`, section « Combats ».
- **Karma.**
  - Il part de 0 et n'est pas encore en production.
  - Les seuils sont `min` 0, 50, 80 ou 100, et `max` -30 ou -50.
  - Une issue le change de ±1 à ±5 pour un petit geste, de -10 à -20 pour un acte grave, et de +8 à +15 pour un acte vraiment généreux.
  - **Une interaction avec un autre humain touche presque toujours le karma.** Le karma suit ce que le joueur fait aux autres, pas ce qui lui arrive.
    - Il monte quand le joueur aide, partage, rend service, tient parole ou se montre aimable. Un échange cordial vaut +1.
    - Il baisse quand le joueur vole, ment, triche, menace, bouscule, se moque ou laisse tomber quelqu'un qui lui demandait de l'aide. Un refus sec vaut -1.
    - Il ne bouge pas quand le joueur ne fait rien à personne : il est la victime (on le vole, on l'escroque), il subit un accident, ou il ne fait que croiser quelqu'un.
    - L'intention compte plus que le résultat : un joueur qui aide le pêcheur et tombe à l'eau gagne quand même un peu de karma. Event 13 : les marchands qui l'invitent à leur table promettent de parler de lui sur les routes (+2).
    - Le validateur avertit des issues qui nomment une personne sans changer le karma ; chacune se tranche à la main.

## Workflow avec l'atelier

Les scripts sont dans `scripts/` à côté de ce fichier, et se lancent depuis la racine du dépôt. Ils travaillent dans `.event-rewrites/` (ignoré par git) : `input/<id>.json` pour l'entrée, `out/<id>.json` pour la réécriture.

1. **Préparer l'entrée.** `node .github/skills/write-event-texts/scripts/prepare.mjs <id> [--draft-ref <commit>]` écrit `input/<id>.json` : les textes et la mécanique de `develop`, le canon du lieu (lu dans la bible) et, avec `--draft-ref`, une version à reprendre (champ `draft`) : le brouillon d'un contributeur, ou `HEAD` pour repasser un event déjà réécrit.
2. **Écrire la sortie**, en commençant par visualiser la scène (première puce des `notes`). Le rédacteur (souvent un agent, à qui l'on donne `references/brief.md` et, selon le cas, `repasse.md` ou `draft-rework.md`) écrit `out/<id>.json` : `text`, `possibilities`, `data` (le contenu complet de `Core/resources/events/<id>.json`), `icons` et `notes`.
3. **Valider.** `node .github/skills/write-event-texts/scripts/validate.mjs <id>` vérifie le style, les longueurs, la parité entre textes et données, les destinations et la couverture de tous les profils.
4. **Appliquer.** `node .github/skills/write-event-texts/scripts/apply.mjs [ids]` écrit `Lang/fr/events.json`, `Core/resources/events/<id>.json` et les emojis dans `Lib/src/CrowniclesIcons.ts` (il retire ceux des issues supprimées). Il n'écrit que le français : les autres langues sont à traduire ensuite (`node .github/scripts/check-translations.mjs parity Lang` liste les clés manquantes).
5. **Tester :**
   - `cd Core && npx vitest run __tests__/data/events __tests__/core/eventsRequirements.test.ts` ;
   - `cd Lib && npx eslint src/CrowniclesIcons.ts` ;
   - `node .github/scripts/generate-test-commands-skill.mjs` (la CI vérifie que ce skill est à jour).
6. **Relire sur le site.** Une fois la branche poussée, le site de comparaison (`https://crownicles.github.io/Tools/generators/event-rewrites/index.html?base=develop&head=<branche>`) montre l'avant / après de chaque event modifié.

## Brouillon d'un contributeur

Quand un contributeur envoie sa version d'un event :

1. **Commit de son brouillon, dont il est l'auteur** (`git commit --author="Nom <id+login@users.noreply.github.com>"`). On n'y corrige que ce qui empêche de le lire (JSON cassé, clés mal orthographiées) et on ajoute les emojis des nouvelles issues pour que le jeu puisse les afficher.
2. **Reprise selon ce skill, dans un second commit.** On garde ses idées et ses possibilités, on applique les règles. La consigne de l'atelier pour cette reprise est `references/draft-rework.md`.

Le contributeur n'est pas forcément rédacteur : ses brouillons ont souvent des textes trop longs, des seuils de l'ancien barème, de la religion, du discours direct ou des fautes. C'est le travail de la reprise, pas une raison d'écarter ses idées.

## Relecture finale

Avant de rendre un texte, vérifie chaque point :

1. Il n'a pas de discours direct, pas de mot rare, pas d'expression inventée, pas de phrase où l'on bute.
2. Il se lit encore bien à la centième fois, et l'état du monde reste intact.
3. L'introduction nomme le lieu et garde ce dont les choix ont besoin.
4. Il ne contredit ni le canon du lieu ni le menu de la ville, et ne suppose pas la destination suivante.
5. Chaque condition se montre dans le texte, et chaque seuil correspond au mot de l'échelle.
6. Chaque issue a une mécanique qui correspond au texte, et chaque profil de joueur a au moins une issue.
7. Chaque personnage qui s'en prend au joueur a une raison montrée dans le texte, à la mesure de ce que le joueur a fait, et un choix prudent reste prudent.
8. Le joueur ne fait que ce que son choix annonce (quand il ne répond pas, son personnage est libre).
9. Chaque issue reste vraie avec ce que l'intro dit des choses, des lieux et des personnages.
10. Chaque issue se comprend lue seule, juste après l'intro et le libellé du choix.
11. Le narrateur ne dit rien que le joueur ne puisse voir ou apprendre, et chaque geste est possible à ce moment-là et suit la blessure.
11. La physique tient : tailles, poids, forces et durées vraisemblables, et une solution à la mesure du problème.
12. Quand le joueur se déplace, l'issue dit où il se retrouve, et deux issues d'un même choix ne racontent pas la même scène.
13. Les mécaniques suivent le texte jusqu'au bout : un joueur chassé de la ville part vraiment (`forceLeaveCity`), et le joueur le plus courant (karma 0, sans familier) a au moins deux issues à chaque choix.
14. La scène tient dans l'espace : en te représentant l'intro, chaque issue s'y joue sans changer de lieu en douce, et chaque geste est possible depuis l'endroit où se tient le personnage.

Une relecture ne s'arrête pas aux phrases. Relis aussi les mécaniques de chaque issue, ce que voit le joueur le plus courant et le ton de l'ensemble, puis demande-toi si l'event donne envie d'être rejoué.

## Events validés par le propriétaire

`reviewed.json` liste les events que le propriétaire a relus et validés comme vraiment bien retravaillés, avec la date et une empreinte de leurs textes et de leurs mécaniques. Le comparateur (Crownicles/Tools) les marque « ✅ relu », ou « ⚠️ modifié depuis la relecture » quand l'event a changé ensuite.

- Marquer un event sur demande du propriétaire seulement : `node .github/skills/write-event-texts/scripts/review.mjs <ids>`. Retirer la marque : `--remove <ids>`.
- **Un event validé est figé : on ne le réécrit plus.** Pas de nouvelle passe de style, de familiers ou d'issues en plus. Deux exceptions seulement : une demande du propriétaire sur cet event, ou une erreur objective trouvée lors d'une passe globale (physique impossible, incohérence avec l'intro, mécanique fausse). On la corrige alors au plus près, sans rien réécrire autour, on le dit au propriétaire, puis on marque l'event à nouveau. `apply.mjs` refuse d'écrire un event validé sans `--allow-reviewed`, pour qu'aucune retouche ne passe par mégarde.
- `review.mjs --check` liste les events validés modifiés depuis leur relecture.

## Journal des retours du propriétaire

Les 21 events déjà réécrits (1, 2, 10 à 20, 30, 39, 46, 56, 69, 71, 76, 89) servent de jeu de référence pour réécrire les autres plus vite. Chaque fois que le propriétaire fait corriger l'un d'eux, on en tire la règle générale, on l'ajoute à la bonne section de ce skill avec un exemple avant/après, et on la note ici en une ligne.

Quand le propriétaire recopie une issue en y changeant quelques mots, sans autre commentaire, c'est la correction qu'il veut : applique-la telle quelle. Si tu vois mieux, propose ta version à part, sans l'appliquer d'office.

- **Event 11, l'inconnue bavarde (le propriétaire)** : dans `end`, une rabatteuse de guet-apens racontait des histoires pendant des heures à un voyageur muet, dans deux issues presque identiques. Voir « Quand le joueur ne répond pas » et « Pas deux fois la même scène ».
- **Event 12 (le propriétaire)** : *de l'autre côté* et *la berge* sans dire lesquels, formule toute faite, verbe mal employé, détail parasite. Voir « Le joueur sait où il finit » et « Exemples relevés en relecture ».
- **Familier en expédition (le propriétaire)** : sans talisman de clonage, il ne compte pas pour les conditions de familier, et le joueur est traité comme s'il n'en avait pas. Voir `reference.md`, section « Familiers ».
- **Lit partagé (le propriétaire, event 13)** : dormir dans un lit pendant un event ignorait la recharge des lits de la maison et de l'auberge. Voir `useBed` dans « Texte et mécanique ».
- **Seuils relatifs au niveau (le propriétaire, event 17)** : une défense de 300 peut être lourde selon le niveau ; le skill n'imposait que des seuils absolus. Voir « Relatif au niveau ».
- **Event 14, scène incohérente (le propriétaire)** : la forge était dehors dans l'intro et dedans dans les issues. Voir « Visualise la scène avant d'écrire ».
- **Event 14, blessures (le propriétaire)** : *Étourdi par la douleur* pour un pied brûlé, et un joueur qui *secoue la main* après s'être écrasé le pouce. Voir « L'altération suit la partie du corps touchée » et « Le geste après une blessure est celui qu'on ferait ».
- **Event 13, relecture trop légère (le propriétaire)** : une première passe n'avait retouché que des phrases. Restaient un choix qui donnait toujours la même issue au joueur courant (karma 0), des fuites après lesquelles le joueur pouvait rester en ville, et un event porté presque entièrement par le karma, sans issue drôle ni rare. Voir « Pense au joueur le plus courant », « Quitter la ville » et la fin de « Relecture finale ».
- **Event 30** : vocabulaire rare, expressions inventées, décor inutile, phrases alambiquées, réactions peu crédibles, mots ambigus. Voir « Exemples relevés en relecture ».
- **Seuils** : « fort » veut dire le premier dixième des joueurs réguliers, pas le premier cinquième. Voir « L'échelle des seuils ».
- **Classes et familiers** : une issue qui ne concerne que 1 à 2 % des joueurs est voulue.
- **Events 69 et 76** : une intro trop raccourcie perd ce qui motive les choix ; jusqu'à 400 caractères quand c'est nécessaire. Voir « Structure d'un event ».
- **Trous de couverture (events 2, 11, 13, 15, 16, 17, 20)** : des plages qui ne se touchent pas laissaient des joueurs sans issue ; le test de couverture vérifie maintenant toutes les conditions. Voir « Combien et lesquelles ».
- **Relecture de GabrieLre (events 1, 2, 10)** : cas général d'abord, enchaînements logiques, sentiments à la mesure du résultat, animal interprété, event à garder à sa place, choix différents d'un event voisin, demi-tour par un voisin. Voir « Style », « Structure d'un event », « Canon des lieux » et « Combien et lesquelles ».
- **Brouillon de Gabriel (events 24, 25, 26)** : son brouillon est commité sous son nom, puis repris selon le skill dans un second commit. Voir « Brouillon d'un contributeur ».
- **Prévisibilité et paliers (le propriétaire et GabrieLre)** : le joueur doit à peu près savoir ce qui va se passer quand il clique ; un malus ou un bonus lié à une stat se gradue en trois paliers au lieu d'un seuil binaire, et les seuils ne sont pas tous tout en haut. Voir « Un choix doit être prévisible » et « L'échelle des seuils ». Appliqué aux events 2, 10, 24, 25 et 26.
- **Équipement réellement porté (le propriétaire, event 3)** : pas de pioche ni d'armure supposées ; condition `weaponTags` et tag d'arme `blunt`. Le validateur avertit d'une arme ou d'une armure nommée sans condition qui la garantit. Voir « Texte et mécanique ».
- **Event 3, chiens et phrases hachées (Gabriel)** : un chien partout où un autre familier ferait l'affaire ; deux phrases courtes au lieu d'une phrase liée. Voir « Classes et familiers » et « Style ».
- **Event 26, prémisse changée (le propriétaire)** : l'original était trop faible pour être rapiécé ; on garde les possibilités et leur idée, et on change la situation. Voir « Fidélité à l'original ».
- **Event 26, scène répétée (le propriétaire)** : une pendaison qui revient à chaque passage, une bourse que « personne ne réclame » et des propriétaires qui remercient alors que tout le village est à la pendaison. Voir « Une scène qui revient doit pouvoir revenir » et « L'intro fixe l'état des choses ».
- **Event 26, intro confuse (le propriétaire)** : termes du lore jetés sans explication, faction qui agit contre ses propres buts, seigneur installé dans une ville en ruine, passé commun inventé. Voir « Lore ».
- **Event 2, ton uniforme (le propriétaire)** : trop de morsures, rien de mignon ni de drôle. Voir « Varier le ton ».
- **Paliers tous identiques (le propriétaire)** : tous les events coupaient aux mêmes valeurs, et le joueur passait d'un coup de ne rien réussir à tout réussir. Voir « La difficulté change d'un event à l'autre ».
- **Events validés figés (le propriétaire)** : un event relu ne se réécrit plus ; seules les erreurs objectives s'y corrigent, au plus près (les corrections de physique des events 9, 10 et 26 ont été gardées). Voir « Events validés par le propriétaire ».
- **Event 1, le campement (le propriétaire)** : quatre faits empilés en une issue et un personnage qui laisse son sac pour aller voir des bruits. Voir « Une péripétie par issue ».
- **Event 1, la physique (relecture d'un joueur)** : un chêne géant réglé par des gestes ordinaires, et un paquet « là depuis longtemps » dans un arbre tombé récemment. Voir « La physique tient » et « L'intro fixe l'état des choses ».
- **Event 71, la bourse aux noyaux** : une ruse sans auteur crédible, découverte trop tard. Voir « Une ruse tient debout des deux côtés ».
- **Event 3, issues enchaînées (Gabriel)** : les issues d'un même choix s'appuyaient les unes sur les autres (*La pierre ripe*, *Le vacarme*), alors que le joueur n'en lit qu'une. Voir « Chaque issue se lit seule ».
- **Event 3 (le propriétaire)** : une issue contredisait l'état posé par l'intro (un coffret enfoui depuis longtemps, mais tombé d'une charrette le matin même). Voir « L'intro fixe l'état des choses ».
- **Combats et énergie (le propriétaire)** : une issue peut déclencher un combat à niveau fixe, conditionné par l'énergie, avec un revers pour le joueur épuisé. Premier usage : event 11. Voir « Combats » dans « L'échelle des seuils ».
- **Event 71 (le propriétaire)** : détail parasite (le scorpion dans la botte), geste de familier impossible à se représenter, libellé raccourci qui cachait une agression, libellés sans point final. Voir « Style », « Structure d'un event » et « Une réaction à la mesure de ce que fait le joueur ».
- **Le personnage est libre dans `end` (le propriétaire)** : quand le joueur ne répond pas, son personnage peut agir comme il veut ; une règle qui le disait immobile a été retirée. Voir « Une réaction à la mesure de ce que fait le joueur ».
- **Réaction disproportionnée (le propriétaire, event 75)** : un pirate inconnu tirait au canon sur un joueur qui déclinait poliment, et les paliers en faisaient la norme. Voir « Une réaction à la mesure de ce que fait le joueur ».
- **Longueur des issues (le propriétaire)** : la fourchette 150-280 était devenue une cible, et toutes les issues avaient la même longueur. Elle suit maintenant ce que l'issue raconte, de 80 à 400 caractères. Voir « Structure d'un event ».
- **Relecture de Gabriel (events 1, 2, 10, 11, 12)**, deuxième passe : verbe juste, réaction motivée, contraste, décor des ruines, stat plutôt qu'équipement, temps à la mesure de la durée, trouvaille plausible, issue qui rappelle le choix, conséquence pour les meilleurs, demi-tour réel (`goBackToPreviousMap`). Le validateur avertit maintenant des libellés trop longs ou en « Essayer de », de `hurt` pour une petite blessure, de *sans armure* sur une condition de défense, des durées incohérentes, de *retard*, des listes d'ids qui partagent un tag et des events qui misent tout sur le chien.
- **Relecture de Gabriel (events 1, 2, 10, 11, 12)**, première passe : libellés de choix courts qui visent la réussite, `confounded` (étourdi) pour les petites blessures, gravité du texte à la mesure de la perte de vie, revers d'une force, familles de familiers entières (condition `petTags`), quelques issues sans condition en plus pour varier. Voir « Structure d'un event », « Texte et mécanique », « Le revers d'une force » et « Classes et familiers ».
- **Le castor de l'event 18 (le propriétaire)** : une issue drôle avait été aplatie au nom de la vraisemblance ; on garde l'humour quand la scène tient debout. Voir « Un brin d'absurde ».
- **Event 18 en trois dimensions (le propriétaire)** : le chantier vu par une brèche, mais où l'on entrait sans le dire ; un habitant sans raison d'être là ni de surveiller un chantier abandonné. L'event a été entièrement repris. Voir « Visualise la scène » et « Une réaction de réputation ».
- **Narrateur et gestes (le propriétaire, event 18)** : un narrateur qui savait ce que le joueur ne peut pas voir (personne ne grimpe là depuis le départ des ouvriers), et des personnages qui soufflaient sur leurs mains sans raison, dont une fois en descendant d'un échafaudage. Voir « Style ».
- **Champignons et débutants (le propriétaire, event 17)** : ne pas reconnaître un champignon vénéneux visait `cookingLevel` `max` 0 ; c'est le lot de tout débutant, `max` 30. Voir « Cuisine, matériaux, enchantements ».
- **Gibier et familier de la même espèce (le propriétaire, event 17)** : un faisan plumé et rôti s'affichait au joueur qui a une volaille. Condition `excludedPetTypeIds`, et une issue dédiée quand l'exclusion vide un choix (le renard de l'event 19). Voir « Classes et familiers ».
- **Cuisine, matériaux, équipement** : des issues doivent dépendre du niveau de cuisine, des matériaux et des enchantements ou améliorations de l'équipement, et certaines peuvent consommer des matériaux. Voir « L'échelle des seuils ».
