
# Guide Utilisateur - IntelHub 🕵️

Bienvenue sur IntelHub. Cette extension regroupe des outils avancés de renseignement d'origine source ouverte (OSINT) dans une interface unique et pratique, permettant aux chercheurs et analystes d'effectuer des opérations rapidement et efficacement.

---

## 🏠 Vue d'ensemble - Interface Principale
En haut à gauche de l'extension, vous trouverez le bouton **Refresh** pour mettre à jour la liste des outils et les paramètres.
En dessous se trouve une **Barre de Recherche** pour localiser rapidement des catégories ou des outils spécifiques.

![Menu Principal - Haut](images/1.png)

Sur le côté droit, il y a une **Barre de Défilement** pour naviguer entre les différentes catégories. Dans le coin supérieur droit, un bouton permet de changer le **Thème** visuel.

![Menu Principal - Défilement](images/2.png)

---

## ⭐ Favorites - Gestion des Favoris
Cette catégorie centralise les outils que vous avez marqués comme "Favoris" dans la liste générale, et permet d'ajouter des outils personnalisés et de gérer des catégories.

![Écran des Favoris](images/3.png)

### Actions Principales :
**New Category :** Créez de nouveaux dossiers/catégories pour organiser vos outils favoris.

![Créer une Nouvelle Catégorie](images/4.png)

**Add Custom Tool :** Ajoutez un outil externe (non présent dans l'extension) en entrant un Nom, une URL et une courte description. Vous pouvez assigner l'outil à une catégorie spécifique avant de l'enregistrer.

![Ajouter un Outil Personnalisé](images/5.png)

**Export/Import :** Exportez votre liste de favoris et vos paramètres sous forme de fichier de sauvegarde, ou importez-les pour les transférer à un autre utilisateur.

![Export et Import](images/6.png)

**Gestion courante :**
Voici à quoi ressemble la liste des outils après l'ajout d'éléments.
Pour supprimer une catégorie, cliquez sur l'icône de la corbeille à droite. Pour retirer un outil des favoris, cliquez sur l'icône Étoile (Unstar).

![Liste des Favoris](images/7.png)

---

## 🛠️ OSINT Tools - Répertoire d'Outils
Cette catégorie contient le cœur de l'extension - une liste complète d'outils de renseignement divisée par sujets. La liste est automatiquement synchronisée avec le dépôt GitHub et mise à jour toutes les 24 heures (ou via une actualisation manuelle).

En cliquant sur un sujet (Catégorie), la liste des outils correspondants s'ouvrira :

![Catégories et Outils](images/8.png)

* Cliquer sur un outil l'ouvrira dans un nouvel onglet.
* Cliquer sur l'icône Étoile à côté d'un nom d'outil l'ajoutera aux "Favoris".
* Survoler un outil affichera une courte description (Tooltip) de sa fonction.

![Description de l'Outil](images/9.png)

---

## 🖼️ Reverse Image Search - Recherche Inversée d'Images
Cet outil vous permet d'effectuer une recherche inversée d'image sur plusieurs moteurs de recherche simultanément.

![Menu Recherche Inversée](images/10.png)

**Options d'Entrée :**
1.  **Upload :** Télécharger un fichier image depuis votre ordinateur.
2.  **Paste :** Coller une image directement depuis le Presse-papiers.

*Avant de chercher, cochez les cases des moteurs de recherche que vous souhaitez utiliser (Google, Yandex, Bing, TinEye, etc.). Votre sélection est sauvegardée pour la prochaine fois.*

---

## 📄 Metadata Analyzer - Analyseur de Métadonnées
Un outil pour extraire les informations cachées (Métadonnées/EXIF) des fichiers.

![Sélectionner le Type de Fichier](images/11.png)

Sélectionnez le type de fichier souhaité (Image, PDF ou document Office) et téléchargez-le. Le rapport de données apparaîtra immédiatement en bas de la fenêtre (faites défiler vers le bas pour voir tous les détails).

![Résultats des Métadonnées](images/12.png)

---

## 🔍 Google Dorks - Générateur de Requêtes
Une interface pour construire facilement des requêtes de recherche Google avancées.

![Générateur de Dorks](images/13.png)

Entrez les paramètres souhaités dans les différents champs (Recherche dans un site spécifique, Type de fichier, Mots-clés dans le Titre/URL/Texte).
Après avoir construit la requête, vous pouvez cliquer sur **Search on Google** pour une exécution immédiate, ou voir la structure de la requête dans la boîte ci-dessous et la copier.

![Copier la Requête](images/14.png)

---

## ✈️ Telegram Tools - Outils Telegram
Une suite d'outils pour les investigations sur Telegram. Cette catégorie permet la recherche de numéros de téléphone, la collecte de détails sur les utilisateurs/groupes et l'analyse des exportations.

![Menu Outils Telegram](images/15.png)

**User & Group Profiler :** Entrez un nom d'utilisateur (ou un lien) pour effectuer un scan approfondi et afficher les détails de l'utilisateur, sa photo de profil, son statut, et une option pour obtenir l'ID Numérique (**Fetch Numeric ID**).

![Résultats du Profileur Telegram](images/16.png)

---

## 🌐 Site, Link & Archive - Analyse de Site
Une collection d'outils pour analyser la page actuelle ou une URL spécifique pour une reconnaissance initiale.

![Menu Analyse de Site](images/17.png)

**Outils Disponibles :**
1.  **Website Fingerprint :** Capture l'empreinte du site (technologies, cookies) pour les vérifications d'authenticité.
2.  **WHOIS & DNS :** Vérifie la propriété du domaine et les enregistrements DNS.
3.  **Technology Detection :** Identifie la pile technologique sous-jacente.
4.  **Subdomain Finder :** Localise les sous-domaines.
5.  **Save Page Offline :** Sauvegarde la page actuelle en tant que fichier HTML local pour documentation.
6.  **Archive Search :** Recherche l'historique du site dans diverses archives web.

---

## 🆔 Social ID Extractor
Conçu pour extraire l'**ID Utilisateur Numérique** des profils de réseaux sociaux, ou pour naviguer vers un profil basé sur un ID existant.

![Menu Extraction ID](images/18.png)

Naviguez vers la page de profil (par exemple, sur Facebook) et cliquez sur le premier bouton pour extraire l'ID.

![Résultat de l'Extraction](images/19.png)

---

## 🔗 Link Analyzer - Analyse de Liens
Contient des outils pour vérifier la sécurité et l'origine des liens.

![Menu Analyse de Liens](images/20.png)

* **Unshorten URL :** Décode les liens raccourcis (comme bit.ly) pour révéler l'adresse originale.
* **Scan for Viruses :** Vérifie le lien contre la base de données VirusTotal.

---

## 📝 Text Profiler - Profileur de Texte
Scanne et extrait des **Entités** du texte. Le système identifie les emails, portefeuilles crypto, numéros de téléphone, noms d'utilisateur, et plus encore.

![Menu Profileur de Texte](images/21.png)

Vous pouvez analyser du texte via **Paste** (Coller), téléchargement de fichier texte externe, ou en scannant la **Page Actuelle** dans le navigateur. Les résultats peuvent être exportés en CSV.

---

## 📊 Investigation Graph - Graphique d'Investigation
Cliquer sur cette catégorie ouvre le système de visualisation.

![Bouton Graphique](images/22.png)

En utilisant le graphique, vous pouvez créer une carte d'investigation, ajouter des cartes d'entités et les lier pour visualiser clairement le tableau de renseignement.

![Interface du Graphique](images/23.png)
