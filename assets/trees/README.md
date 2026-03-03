# Modèles 3D d'arbres

Placez ici vos modèles d'arbres au format **GLB** (ou GLTF). Ils seront chargés automatiquement et **instanciés par GPU** dans la scène pour de bonnes performances.

## Fichiers reconnus

Le projet tente de charger, dans l'ordre :

- `tree.glb`
- `tree1.glb`
- `tree2.glb`

Vous pouvez ajouter d’autres noms de fichiers dans le tableau `TREE_MODEL_PATHS` dans `main.js` (recherchez `TREE_MODEL_PATHS`).

## Recommandations

- **Format** : préférez `.glb` (binaire, un seul fichier).
- **Taille** : modèles low-poly recommandés (quelques milliers de triangles par arbre) pour garder de bonnes perfs avec des centaines d’instances.
- **Échelle** : le code adapte la taille à la scène ; une hauteur d’environ 5–10 unités dans le logiciel 3D est un bon ordre de grandeur.
- **Origine** : idéalement à la base du tronc (au sol).

## Si aucun fichier n’est présent

Si aucun modèle n’est trouvé dans ce dossier, la scène utilise automatiquement des **arbres et buissons procéduraux** (géométries Three.js).
