# Item material categories (materialloot)

This document describes how the 212 craftable items (100 weapons + 112 armors)
are grouped into 15 "material" categories. Each category is the basis of the
upcoming upgrade system: each item draws its upgrade materials from the
pool associated with its category.

## Design goals

- 15 categories total.
- ~20 materials per category, where each material appears in 3–4 categories
  (min 2, max 5; aim for 3–4 most of the time).
- Each item consumes 4 to 8–9 materials per upgrade.
- 2–3 of those materials change between every level so the upgrade path
  walks through (almost) every material of the category over the full level
  range.
- Each item belongs to exactly one category — see the lists below.
- Material rarities (common / uncommon / rare) are roughly balanced.

The "Ce que je veux voir" notes for each category list illustrative
materials that *must* appear in that category's pool; they are not the full
list — feel free to add other materials when they fit the category lore.

## Verification

A verification script lives in the [Tools](https://github.com/Crownicles/Tools)
repository (`other/verify-item-material-categories.py`). Run it to ensure the
categorization is complete and free of duplicates, passing the models file and
this document as arguments:

```bash
python3 ../Tools/other/verify-item-material-categories.py Lang/fr/models.json docs/design/item-material-categories.md
```

It re-resolves each item against `Lang/fr/models.json`, validates per-category
counts against the `## N. Title - COUNT` headers, and ensures every weapon
(id 0..99) and armor (id 0..111) is assigned exactly once.

---

## 1. Lames forgées - 17

Beaucoup d'alliages et de métal. Surtout métal — c'est plus brut.
2–3 explosifs pour la chaleur de la forge (charbon, soufre…).
Un peu de bois (certains manches) et de corde pour maintenir le tout.

**Ce que je veux voir comme matériaux** : acier trempé, charbon, soufre,
fer brut, corde de jute, une ou deux branches.

**Items :**

- 4 — Transperceur (weapon)
- 6 — Couteau simple (weapon)
- 7 — Dague (weapon)
- 8 — Percingasiteur (weapon)
- 15 — Paire de dagues (weapon)
- 19 — Couteau Ancien (weapon)
- 25 — Dague fragile (weapon)
- 27 — Sabre (weapon)
- 29 — Couteau de débutant (weapon)
- 33 — Vieux couteau (weapon)
- 36 — Épée en fer (weapon)
- 37 — Épée de débutant (weapon)
- 38 — Épée de maître (weapon)
- 39 — Épées doubles (weapon)
- 52 — Rasoir (weapon)
- 55 — Fourchettecouteau (weapon)
- 69 — Ines'word (weapon)

## 2. Métal sur base bois - 13

Une grande partie de métal, d'alliages et de bois.
Un peu de cuir et de corde.

**Ce que je veux voir comme matériaux** : planches d'ébène, différentes
branches et planches, zinc, bronze et fer, bronze antique…, un ou deux cuirs
et des morceaux de tissu.

**Items :**

- 2 — Outils usés (weapon)
- 3 — Assomoire (weapon)
- 5 — Marteau (weapon)
- 16 — Pioche (weapon)
- 17 — Masse (weapon)
- 21 — Pioche abimée (weapon)
- 26 — Crosse (weapon)
- 28 — Marteau de combat (weapon)
- 73 — Ashoir (weapon)
- 76 — Volto-hache (weapon)
- 33 — Scutum (armor)
- 36 — Bouclier à pointes (armor)
- 90 — Parma (armor)

## 3. Éléments naturels - 14

Du bois, certains poisons naturels, de la corde et de la nature.

**Ce que je veux voir comme matériaux** : graine de ricin, mûres de sureau,
cactus, tige de bambou, liane céleste, cordes tressées, mailles de soie,
différents bois, feuilles.

**Items :**

- 10 — Épée en bois (weapon)
- 14 — Guitare lourde (weapon)
- 18 — Bâton (weapon)
- 43 — Cornichon (weapon)
- 44 — Bouquet de roses (weapon)
- 45 — Banane (weapon)
- 47 — Boule de neige (weapon)
- 53 — Chaise (weapon)
- 75 — Boomerang (weapon)
- 4 — Bouclier en bois (armor)
- 54 — Nam Nam (armor)
- 65 — Armure banane (armor)
- 77 — Bouclier épineux (armor)
- 110 — Armure en chlorophyte (armor)

## 4. Bois et cordes - 13

Du bois et de la corde principalement, un peu de cuir et de nature.

**Ce que je veux voir comme matériaux** : différents bois et cordes, pignon
de pin, cuir de porc et d'agneau, la liane céleste.

**Items :**

- 20 — Branche souple (weapon)
- 22 — Arc (weapon)
- 32 — Canne à pêche de débutant (weapon)
- 34 — Canne à pêche (weapon)
- 35 — Canne à pêche de maître (weapon)
- 48 — Arc de chevalier (weapon)
- 49 — Arc de soldat (weapon)
- 50 — Arc de novice (weapon)
- 51 — Arc du héros (weapon)
- 72 — Ballon de fluxball (weapon)
- 85 — Pavise (armor)
- 88 — Bouclier zoulou (armor)
- 91 — Adarga (armor)

## 5. Boucliers bois et placage métal/cuir - 16

Un peu de bois, du métal et des alliages. Un peu de cuir et d'explosif est
le bienvenu.

**Ce que je veux voir comme matériaux** : cuivre, bronze antique et classique,
laiton doré et laiton, aluminium (léger ou pas), titane, gaz comprimé,
pétrole, au moins un cuir.

**Items :**

- 3 — Bouclier (armor)
- 8 — Bouclier simple (armor)
- 11 — Bouclier de débutant (armor)
- 16 — Bouclier usé (armor)
- 24 — Bouclier de gladiateur (armor)
- 25 — Bouclier de guerrier (armor)
- 26 — Bouclier de Brennus (armor)
- 29 — Bouclier solide (armor)
- 30 — Petit bouclier (armor)
- 34 — Rondache (armor)
- 82 — Bouclier rond (armor)
- 83 — Bouclier banal (armor)
- 84 — Targe (armor)
- 86 — Écu normand (armor)
- 87 — Bouclier hoplite (armor)
- 89 — Bouclier bosselé (armor)

## 6. Plaques en métal - 15

Plein de métal et d'alliages. Un peu d'explosif pour la fonte et de cuir
pour assouplir les articulations.

**Ce que je veux voir comme matériaux** : charbon, soufre, au moins un cuir.

**Items :**

- 23 — Poêle (weapon)
- 24 — Ciseaux (weapon)
- 31 — Poing renforcé (weapon)
- 5 — Bouclier en fer (armor)
- 6 — Armure de fer (armor)
- 9 — Bouclier résistant (armor)
- 10 — Bouclier lourd (armor)
- 12 — Bouclier de maître (armor)
- 13 — Bouclier ultime (armor)
- 14 — Bouclier puissant (armor)
- 42 — Casque de guerre (armor)
- 103 — Plastron (armor)
- 105 — Cuirasse (armor)
- 106 — Bouclier 3 en 1 (armor)
- 109 — Armûre (armor)

## 7. Textiles, cuir - 14

Beaucoup de cuir, de corde et de nature. Ajouter un peu de magie /
spirituel.

**Ce que je veux voir comme matériaux** : quasiment tous les cuirs (surtout
le synthétique), la liane, le bambou, les mousses et feuilles de chêne, rune
enchantée, une ou deux poussières, la lavande séchée, la résine, le livre
philosophique.

**Items :**

- 30 — Gant de boxe (weapon)
- 46 — Vieux grimoire (weapon)
- 58 — Gros livre (weapon)
- 93 — Torchon du Cuisinier (weapon)
- 7 — Kimono renforcé (armor)
- 18 — Kimono de maître (armor)
- 19 — Veste de sécurité (armor)
- 48 — Manteau (armor)
- 49 — Doudoune de combat (armor)
- 50 — Blouse de protection (armor)
- 51 — Tente de protection (armor)
- 71 — Chapeau (armor)
- 78 — Casquette (armor)
- 79 — Armure légère (armor)

## 8. Chantier et structures - 13

De la nature, des cordes, du bois de construction principalement, un peu
de métal et d'alliages.

**Items :**

- 9 — Clé rouillée (weapon)
- 54 — Brique (weapon)
- 2 — Casque de sécurité (armor)
- 43 — Seau en métal (armor)
- 44 — Mur (armor)
- 45 — Rangée de pions (armor)
- 47 — Forteresse japonaise (armor)
- 64 — Bouclier gigantesque (armor)
- 73 — Roque (armor)
- 74 — Grand Roque (armor)
- 92 — Château de Himeji (armor)
- 93 — Caravane (armor)
- 111 — Roque fort (armor)

## 9. Magie de lumière / métaux précieux - 13

De la magie, du spirituel, de l'explosif.

**Ce que je veux voir comme matériaux** : flamme éternelle, quartz arc-en-ciel,
les 2 poussières, nitroglycérine, cristal d'améthyste, encens sacré,
poudre à canon…

**Items :**

- 1 — Foudre de Zeus (weapon)
- 40 — Épée en diamant (weapon)
- 41 — Épée sharpness 4 (weapon)
- 56 — Épée Kokiri (weapon)
- 71 — Épée de Ragnell (weapon)
- 81 — Exagide (weapon)
- 95 — Lame de l'aura argentée (weapon)
- 17 — Bouclier solaire (armor)
- 28 — Bouclier de lynel (armor)
- 38 — Lumière de node (armor)
- 97 — Armure en diamant (armor)
- 102 — Armure en mythril (armor)
- 104 — Plastron protection 4 (armor)

## 10. Parties animales - 12

La nature, les poisons, ainsi que la magie et le spirituel pour certains
animaux légendaires.

**Ce que je veux voir comme matériaux** : écaille de dragon, plume de phénix,
larme d'élémentaire, quasiment tous les poisons (surtout les naturels), la
rose du néant, l'herbe fantôme.

**Items :**

- 68 — Griffe (weapon)
- 74 — Âme du démon (weapon)
- 82 — Griffe de chat enragé (weapon)
- 88 — Aile gauche d'Icare (weapon)
- 89 — Épée du Dragon (weapon)
- 90 — Corne de Licorne (weapon)
- 94 — Poudre de Squelette (weapon)
- 97 — Lame du Phénix (weapon)
- 99 — Serre d'Aigle (weapon)
- 20 — Bouclier humain (armor)
- 40 — Carapace de Franklin (armor)
- 57 — Aile droite d'Icare (armor)

## 11. Chimie, biologie, polymères - 13

De la nature, des explosifs et du poison. Le spirituel et la magie peuvent
être intéressants.

**Ce que je veux voir comme matériaux** : quasiment tous les poisons, racines
de gingembre, ammoniac, chlorate de potassium, peroxyde d'hydrogène, quartz
arc-en-ciel, une poussière (étoiles, argent ou les deux), eau purifiée.

**Items :**

- 12 — Seringue infectée (weapon)
- 57 — Extincteur (weapon)
- 59 — Seringue (weapon)
- 60 — Seringue contaminée (weapon)
- 61 — Seringue sale (weapon)
- 62 — Bio-Arme (weapon)
- 77 — Sabotage de l'oxygène (weapon)
- 96 — Electektron (weapon)
- 15 — Bouclier rouillé (armor)
- 46 — Plexiglas (armor)
- 67 — Protège-dents (armor)
- 72 — Masque à gaz (armor)
- 75 — Vaccin (armor)

## 12. Armes à distance, à feu ou à sorts - 13

De l'explosif, de la magie, du spirituel, un peu de métal / d'alliage.

**Ce que je veux voir comme matériaux** : flamme éternelle, cristal
d'améthyste, bois de santal, poudre à canon, nitroglycérine, gaz comprimé,
pierre de lune, rune enchantée, larme d'élémentaire.

**Items :**

- 11 — Pistolet vide (weapon)
- 13 — Bombe (weapon)
- 42 — Pistolet chargé (weapon)
- 63 — Bombe atomique (weapon)
- 64 — Brûleur (weapon)
- 70 — Pistolet pan pan QQ (weapon)
- 79 — Parapluie de grand-mère (weapon)
- 80 — Sceptre à 100 sorts (weapon)
- 91 — Baguette de Fibonacci (weapon)
- 98 — Épée de givre (weapon)
- 21 — Bras mécanique (armor)
- 23 — Parapluie d'auto défense (armor)
- 108 — Bouhclier (armor)

## 13. Nouvelles techs - 14

De l'explosif, de la magie, du spirituel, des alliages et du métal (surtout
alliages plus technologiques). Le poison peut être intéressant.

**Ce que je veux voir comme matériaux** : flamme éternelle, rune enchantée,
quartz arc-en-ciel, cristal d'améthyste, encens de sauge, pétrole brut,
métal composite, laiton doré, cellule extraterrestre, plutonium.

**Items :**

- 65 — Pew Pew (weapon)
- 66 — Beat Saber (weapon)
- 84 — Tournevis sonique (weapon)
- 1 — Bouclier déflecteur Engi (armor)
- 22 — Casque de robot (armor)
- 27 — Champ de force (armor)
- 39 — Blindage du Major (armor)
- 69 — Rhinoshield (armor)
- 70 — Pare-feu (armor)
- 81 — Armée de robots défensifs (armor)
- 94 — Armure électrifiée (armor)
- 95 — Exosquelette (armor)
- 101 — Bouclier thermique (armor)
- 107 — Armure Mk IX (armor)

## 14. Magie sombre et métaux précieux - 17

De la magie, du spirituel, pourquoi pas de la nature et des poisons. Les
explosifs sont intéressants, et le cuir peut être utile.

**Ce que je veux voir comme matériaux** : rune enchantée, larme d'élémentaire
(optionnel), flamme éternelle (optionnel), écaille de dragon, cellule
extraterrestre, bougie blanche, herbe fantôme, rose du néant.

**Items :**

- 67 — Épée royale (weapon)
- 86 — Masque Mojaro (weapon)
- 32 — Bouclier royal (armor)
- 35 — Bouclier en vibranium (armor)
- 52 — Égide puissante (armor)
- 53 — Égide contrefaite (armor)
- 58 — Lampe Magique (armor)
- 59 — Chapeau Magique (armor)
- 62 — Bouclier de givre (armor)
- 63 — Bouclier du vent (armor)
- 66 — Bouclier du gardien (armor)
- 68 — Protego (armor)
- 76 — Bouclier maudit (armor)
- 80 — Bouclier magique (armor)
- 96 — Tenue de l'Archimage (armor)
- 98 — Bouclier en Beskar (armor)
- 99 — Armure en Beskar (armor)

## 15. Immatériel, conceptuel - 15

Le spirituel, la magie, les explosifs sont importants ; les métaux et
alliages sont intéressants.

**Ce que je veux voir comme matériaux** : bougie blanche, encens, pierre de
lune, poussières, pierre précieuse, aluminium léger.

**Items :**

- 0 — Poing (weapon)
- 78 — Pouvoir de l'amitié (weapon)
- 83 — Injures (weapon)
- 85 — Pouvoir de l'amour (weapon)
- 87 — Plothammer (weapon)
- 92 — Game Over (weapon)
- 0 — Pas de bouclier ni d'armure (armor)
- 31 — Bouclier de la solitude (armor)
- 37 — Conventions de Genève (armor)
- 41 — Jurisprudence (armor)
- 55 — Autodérision (armor)
- 56 — Flemme (armor)
- 60 — Giga Chad (armor)
- 61 — Cri UwUrlant (armor)
- 100 — Plot armor (armor)

---

## Notes on adjustments from the initial draft

- Cat 1 header corrected from `16` to `17` (the original list already
  contained 17 weapons).
- Three items were missing from the initial draft and have been placed in
  the most logical category:
  - weapon **0 — Poing** → cat 15 (immatériel, no material).
  - armor **0 — Pas de bouclier ni d'armure** → cat 15 (no material).
  - armor **32 — Bouclier royal** → cat 14 (precious metals + magic).
