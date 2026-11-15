# Compétences Crownicles

## Commandes test

La compétence `commandes-test-crownicles` trouve la commande `/test` exacte pour faire quelque chose en jeu, avec les bons IDs (familiers, objets, lieux, missions, événements…).

**Télécharger :** https://github.com/Crownicles/Crownicles/raw/develop/skills/commandes-test-crownicles.zip

Elle est générée depuis le code du jeu par `node .github/scripts/generate-test-commands-skill.mjs`, et la CI vérifie qu'elle est à jour. Ne pas modifier à la main le contenu sous le marqueur `<!-- generated-reference -->` ni le fichier `references/crownicles-ids.md`.

### Installer

- **Claude** : Paramètres → Capacités → Compétences → téléverser le zip.
- **Gemini** : Personnaliser → Compétences → Créer → Importer.
- **Claude Code, Copilot CLI et autres agents** : décompresser le zip dans le dossier de compétences de l'outil.
- **ChatGPT ou tout autre assistant** : joindre `commandes-test-crownicles/SKILL.md` et `references/crownicles-ids.md` à la discussion, ou les ajouter aux instructions d'un projet.
