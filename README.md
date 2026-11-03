# Road to Undisputed

Jeu de carrière de boxeur solo, en français, jouable dans un navigateur. Créez votre combattant, préparez vos camps, affrontez une IA sur un ring en 2D et progressez vers les quatre ceintures mondiales.

## Lancer le jeu

Prérequis : **Node.js 20 ou plus récent** et un navigateur moderne avec JavaScript et Canvas activés. Le jeu utilise les modules natifs du navigateur et de Node : aucune dépendance npm à installer et aucune compilation nécessaire.

Depuis le dossier du dépôt :

```sh
npm start
```

Ouvrez `http://localhost:3000` dans votre navigateur. Arrêtez le serveur avec `Ctrl+C`.

Pour redémarrer automatiquement le serveur après une modification de son code :

```sh
npm run dev
```

Le port peut être changé avec `PORT=3001 npm start`. Le serveur écoute sur `0.0.0.0` ; les sauvegardes appartiennent à l’origine utilisée par votre navigateur, donc changer de port ou d’adresse crée un espace de sauvegarde distinct.

## Jouer

1. Choisissez un avatar prédéfini ou personnalisez votre nom, surnom, identité, style, garde, taille, poids, allonge et apparence. Le visage, le teint, la coiffure, la barbe, la morphologie et les couleurs de l’équipement sont visibles dans l’aperçu.
2. Dans **La salle**, réalisez les exercices interactifs : sac de frappe, shadow boxing, corde à sauter, course, musculation et sparring. Les cinq premiers reposent sur le rythme ou la précision ; le sparring est un vrai combat d’entraînement.
3. Dans **Combats**, signez un contrat. Le rendez-vous a lieu trois jours plus tard : entraînez-vous et récupérez avant de monter sur le ring. Les jours avancent par vos actions ; le calendrier ne saute pas un combat prévu.
4. Déplacez-vous, gérez votre garde et votre souffle, puis marquez avec vos coups. Les rencontres durent de 3 à 12 rounds de 60 secondes selon votre progression et peuvent se terminer par KO, TKO ou décision aux points.
5. Gagnez des bourses et des places dans le classement de 50 adversaires fictifs. Dans le top 5, les combats de championnat permettent de réunir les quatre ceintures WBC, WBA, IBF et WBO.

### Commandes du ring

| Action | Clavier |
| --- | --- |
| Se déplacer | Flèches ou `Z Q S D` ; `W A S D` également accepté |
| Jab | `J` |
| Direct | `K` |
| Crochet | `L` |
| Uppercut | `I` |
| Tenir sa garde | Maintenir `Espace` |
| Esquiver | `Maj` |
| Pause / reprendre | `P` ou `Échap` |

Les commandes à l’écran permettent aussi de jouer au tactile. Dans les ateliers d’entraînement, suivez la touche ou la direction affichée ; en musculation, maintenez puis relâchez la commande dans la zone cible.

Les douze attributs sur 100 sont la puissance, la vitesse des mains, la précision, les réflexes, l’endurance, le cardio, la résistance, la défense, le jeu de jambes, la technique, le mental et l’intelligence tactique. Votre style influence vos qualités initiales ; chaque carrière possède des plafonds de potentiel. La distance et l’allonge, les attributs, l’énergie du camp et l’endurance en combat ont un effet sur le jeu. L’âge, la nationalité et la ville servent à personnaliser votre identité.

## Sauvegardes

La carrière est sauvegardée automatiquement dans le stockage local du navigateur, sans compte. Un combat en cours dispose également d’un point de reprise, enregistré environ toutes les deux secondes et lors de certaines interruptions. Après rechargement, il reprend en pause depuis le dernier point enregistré.

Dans **Mon boxeur**, utilisez **Exporter la sauvegarde** pour conserver un fichier JSON, et **Importer une carrière** pour le reprendre dans un autre navigateur. L’export contient la carrière, **pas l’état d’un combat en cours**. Une importation ou une nouvelle carrière demande confirmation avant de remplacer votre progression.

Effacer les données du navigateur, utiliser une autre origine ou bloquer le stockage local peut supprimer ou empêcher la sauvegarde automatique. Gardez un export pour conserver votre progression.

## Publication sur GitHub Pages

Le jeu fonctionne aussi comme un site statique, sans serveur Node en production. Les chemins des ressources sont relatifs pour fonctionner sous `/achille/`.

```sh
npm run build
```

Le dossier généré `dist/` contient uniquement le jeu, sa licence et un fichier `.nojekyll`. Publiez son contenu sur la branche `gh-pages`. Dans les paramètres GitHub du dépôt, choisissez **Pages → Deploy from a branch → gh-pages → / (root)** si cette source n’est pas déjà activée. GitHub affiche l’adresse du jeu après le déploiement.

## Vérifier le code

```sh
npm test
npm run check
```

La suite utilise le lanceur natif `node:test` et comporte 22 cas individuels répartis entre la carrière, le combat et la publication statique : progression et fatigue, contrats, classements, ceintures, validation des sauvegardes, portée des coups, garde, esquives, IA, rounds, résultats et intégrité du site généré. Selon la version de Node, le résumé peut agréger l’exécution par fichiers de tests. `npm run check` vérifie la syntaxe des modules du jeu, du serveur et du script de publication.

Un test de parcours dans un vrai navigateur est aussi disponible :

```sh
# Dans un premier terminal
npm start

# Dans un second terminal, avec Python, Playwright et Chromium disponibles
python3 tests/browser_smoke.py
```

Ce test est facultatif pour jouer. Il utilise le module Python `playwright` et Chromium à `/usr/bin/chromium`, ou le chemin indiqué par la variable `CHROMIUM_PATH`. L’installation de ces outils de test n’est pas nécessaire au fonctionnement du jeu.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | Point d’entrée du navigateur |
| `styles.css` | Interface adaptative, formulaires, calendrier et commandes |
| `src/app.js` | Écrans, événements, entraînements interactifs et sauvegardes |
| `src/career.js` | Règles de progression, contrats, classement et validation des données |
| `src/combat.js` | Simulation du combat, IA, énergie, coups et arbitrage |
| `src/ring.js` | Dessin du ring et des boxeurs avec Canvas |
| `server.js` | Serveur HTTP local sans dépendance |
| `scripts/build-site.js` | Préparation du site statique pour GitHub Pages |
| `tests/` | Tests de règles et parcours navigateur |

Les règles de carrière et la simulation de combat sont séparées de l’affichage afin de pouvoir être testées et enrichies indépendamment.

## Périmètre

Cette réalisation s’inspire du PDF fourni, composé de deux pages et interrompu au début de la description du sparring. C’est un jeu web solo en 2D avec une simulation simplifiée de boxe et un classement fictif. Il ne comporte pas de rendu 3D, de multijoueur en ligne, d’athlètes réels, de serveur de comptes ou de sauvegarde distante. Le navigateur doit charger le jeu depuis le serveur local ou un hébergement statique comme GitHub Pages ; aucun mécanisme d’installation PWA ou de rechargement hors connexion n’est fourni.

## Contribuer

Les contributions peuvent être proposées par pull request. Décrivez le comportement attendu et les changements apportés, puis exécutez `npm run check` et `npm test`. Pour une modification de l’interface ou des commandes, vérifiez aussi le parcours dans le navigateur sur ordinateur et mobile ; le test facultatif `tests/browser_smoke.py` couvre les principaux scénarios. Ajoutez un test de règle lorsqu’une correction touche la carrière ou le combat.

## Licence

Le code est distribué sous [licence MIT](LICENSE). Vous pouvez l’utiliser, le modifier et le redistribuer, y compris dans un projet commercial, en conservant la notice de copyright et la licence. Le logiciel est fourni sans garantie.
