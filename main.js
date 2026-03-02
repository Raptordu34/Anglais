import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'; // Import pour le pavé de verre

// ─── 1. INITIALISATION DE LA SCÈNE ET DU MOTEUR DE RENDU ───
const scene = new THREE.Scene();

// Création d'un ciel bleu procédural (dégradé + faux nuages)
function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Dégradé du ciel (Bleu profond en haut -> Bleu clair horizon)
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#1A5276');   // Zénith
    gradient.addColorStop(0.5, '#4FA1D8'); // Milieu
    gradient.addColorStop(1, '#D4E6F1');   // Horizon
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Faux nuages très doux
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512; // Surtout dans la partie haute
        const radius = 50 + Math.random() * 150;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    // Pour que le dégradé reste fixe par rapport à la caméra
    texture.mapping = THREE.EquirectangularReflectionMapping; 
    return texture;
}

// Assigner le ciel et un brouillard de la couleur de l'horizon pour fondre le sol infini
const skyColor = new THREE.Color('#D4E6F1');
scene.background = skyColor; // On utilise une couleur unie claire si la texture ne mappe pas parfaitement
// scene.background = createSkyTexture(); // Alternative texturée, mais une couleur + fog donne un style plus épuré et moderne.
scene.fog = new THREE.FogExp2(skyColor, 0.015); // Brouillard atmosphérique

// Caméra légèrement plus proche pour que le mur soit imposant, tout en gardant une marge (était à 14.0, on passe à 11.5)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 11.5); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 3.5; 

// Réactivation des ombres douces pour mieux voir le sol
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// ─── 2. ÉCLAIRAGE ET ENVIRONNEMENT (GLOBAL PUR) ───
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// Lumière ambiante
const ambientLight = new THREE.HemisphereLight(0xffffff, 0x000000, 3.0);
scene.add(ambientLight);

// Lumière directionnelle (en haut, à droite, devant) pour projeter une belle ombre sur le sol
const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
dirLight.position.set(15, 20, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096; // Haute résolution pour une ombre propre sur une grande surface
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// Très important : ajouter la cible de la lumière à la scène
// par défaut elle est à (0,0,0). La lumière la regarde toujours.
scene.add(dirLight.target);

// ─── 3. LE SOL (Z = -1.5) ───
const wallMat = new THREE.MeshStandardMaterial({ 
    color: 0x080808, // Gris très foncé (pour voir l'ombre dessus)
    roughness: 1.0,  
    metalness: 0.0
});

// Le Sol (Perpendiculaire)
const floorGeo = new THREE.PlaneGeometry(200, 1000); // Sol très long pour les 10 slides
const floor = new THREE.Mesh(floorGeo, wallMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -4.0, -100); // On le décale vers le fond
floor.receiveShadow = true;
scene.add(floor);

// ─── 4. LES MATÉRIAUX ───
const textSolidMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4400,    
    roughness: 0.2,     
    metalness: 0.8,     
    envMapIntensity: 2.0 
});

// Générateur de texture Marbre procédural
function createMarbleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Fond
    ctx.fillStyle = '#111111'; // Marbre très sombre
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Nervures aléatoires
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 4;
    for(let i=0; i<30; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
        for(let j=0; j<5; j++) {
            ctx.bezierCurveTo(
                Math.random() * 1024, Math.random() * 1024,
                Math.random() * 1024, Math.random() * 1024,
                Math.random() * 1024, Math.random() * 1024
            );
        }
        ctx.stroke();
    }
    
    // Bruit granuleux pour le réalisme
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for(let i=0; i<20000; i++) {
        ctx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

const marbleTexture = createMarbleTexture();
marbleTexture.repeat.set(2, 1);

const blockMaterial = new THREE.MeshStandardMaterial({
    map: marbleTexture,
    roughness: 0.1, // Très lisse (marbre poli)
    metalness: 0.1, // Légère réflectivité globale
    envMapIntensity: 3.0 // Beaux reflets de l'environnement
});

// ─── 4.bis SYSTÈME DE SLIDES (10 SLIDES) ───
const loader = new FontLoader();
const slides = [];
const slideSpacing = 20.0; // Distance entre chaque slide

function createSlide(zPos, titleText, subtitleText, font) {
    const hinge = new THREE.Group();
    hinge.position.set(0, -4.0, zPos - 0.1); 
    scene.add(hinge);

    const blockWidth = 14.22;
    const blockHeight = 8;
    const blockGeo = new RoundedBoxGeometry(blockWidth, blockHeight, 0.2, 6, 0.05);
    const block = new THREE.Mesh(blockGeo, blockMaterial);
    block.castShadow = true;
    block.receiveShadow = true;
    block.position.set(0, 4.0, 0.1); 
    hinge.add(block);

    // Fonction pour ajouter le texte en HAUT À GAUCHE
    function addTextToBlock(text, size, yTopOffset) {
        const textGeo = new TextGeometry(text, {
            font: font,
            size: size,
            height: 0.02,       
            depth: 0.02,        
            curveSegments: 12, 
            bevelEnabled: false
        });
        
        textGeo.computeBoundingBox();
        const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        const textHeight = textGeo.boundingBox.max.y - textGeo.boundingBox.min.y;
        
        // On aligne l'origine (qui est à gauche par défaut) sur le bord gauche du bloc + marge
        const marginX = 1.0;
        const alignX = -(blockWidth / 2) + marginX;
        
        // On aligne en Y par rapport au haut du bloc
        const alignY = (blockHeight / 2) - yTopOffset - textHeight;

        const textMesh = new THREE.Mesh(textGeo, textSolidMaterial);
        textMesh.castShadow = true;
        textMesh.position.set(alignX, alignY, 0.11); 
        
        const edges = new THREE.EdgesGeometry(textGeo);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const outlineLines = new THREE.LineSegments(edges, lineMaterial);
        textMesh.add(outlineLines);

        block.add(textMesh);
    }

    addTextToBlock(titleText, 0.9, 1.0); // yTopOffset de 1.0 depuis le haut
    addTextToBlock(subtitleText, 0.28, 2.5); // Placé sous le titre

    return hinge;
}

loader.load('https://unpkg.com/three@0.162.0/examples/fonts/helvetiker_bold.typeface.json', function (font) {
    // Génération de 10 slides
    for(let i=0; i<10; i++) {
        const z = -i * slideSpacing;
        const hinge = createSlide(
            z, 
            `SLIDE ${i+1}: THE RED LINE`, 
            `Concept point ${i+1}: AI Ethics vs Security`, 
            font
        );
        slides.push(hinge);
    }
});

// ─── 5. SYSTÈME DE TRANSITIONS VARIÉES ───
let currentSlideIndex = 0;
let isAnimating = false;
let transitionProgress = 0; // de 0.0 à 1.0
let transitionType = 0; // 0: Chute, 1: Contournement, 2: Vol par dessus, 3: Rembobinage (Recul)
let transitionDirection = 1; // 1 = Avance, -1 = Recule

// Variables physiques pour la chute (Type 0)
let angularVelocity = 0;
const gravityConstant = 0.0008; 
let shakeIntensity = 0;
let shakeTime = 0;
let fallComplete = false; // Pour savoir quand démarrer le travelling de la chute

// Vecteurs de caméra pour les interpolations
const startCamPos = new THREE.Vector3();
const targetCamPos = new THREE.Vector3();
const startLookAt = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3(0, 0, 0);

// Base de placement de la lumière
let dirLightBaseZ = 15;

function startTransition(direction) {
    if (isAnimating) return;
    
    // Vérification des limites
    if (direction === 1 && currentSlideIndex >= slides.length - 1) return;
    if (direction === -1 && currentSlideIndex <= 0) return;

    isAnimating = true;
    transitionDirection = direction;
    transitionProgress = 0;
    
    // Sauvegarde de l'état initial
    startCamPos.copy(camera.position);
    startLookAt.copy(currentLookAt);

    if (direction === 1) {
        // Déterminer le type de transition en avançant (cycle de 7 types différents)
        transitionType = currentSlideIndex % 7;
        
        targetCamPos.set(0, 0, (- (currentSlideIndex + 1) * slideSpacing) + 11.5);
        targetLookAt.set(0, 0, - (currentSlideIndex + 1) * slideSpacing);
        
        if (transitionType === 0) {
            // Setup pour la chute
            angularVelocity = -0.0001; 
            fallComplete = false;
        }
    } else {
        // En reculant, on fait toujours un rembobinage rapide (Type 99 pour le retour)
        transitionType = 99; 
        targetCamPos.set(0, 0, (- (currentSlideIndex - 1) * slideSpacing) + 11.5);
        targetLookAt.set(0, 0, - (currentSlideIndex - 1) * slideSpacing);
        
        // On cible physiquement la slide précédente
        currentSlideIndex--;
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        startTransition(1);
    }
    if (event.key === 'ArrowLeft') {
        startTransition(-1);
    }
});

// Fonction d'interpolation (Ease In Out) pour rendre les mouvements fluides
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutElastic(x) {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

// ─── 6. BOUCLE D'ANIMATION ───
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    // La lumière avance globalement avec la caméra
    dirLight.position.z += ((camera.position.z + 3.5) - dirLight.position.z) * 0.1;
    dirLight.target.position.z = dirLight.position.z - 15.0;

    if (isAnimating) {
        const activeSlide = slides[currentSlideIndex];

        // --- TYPE 0 : LA CHUTE ARRIÈRE ---
        if (transitionType === 0 && transitionDirection === 1) {
            if (!fallComplete) {
                const angularAcceleration = -gravityConstant * Math.sin(Math.abs(activeSlide.rotation.x));
                angularVelocity += angularAcceleration;
                activeSlide.rotation.x += angularVelocity; 
                
                if (activeSlide.rotation.x <= -Math.PI / 2) {
                    activeSlide.rotation.x = -Math.PI / 2;
                    shakeIntensity = 0.6; 
                    shakeTime = 30;
                    fallComplete = true; 
                }
            } else {
                transitionProgress += 0.015; 
                if (transitionProgress >= 1) transitionProgress = 1;
                
                const ease = easeInOutCubic(transitionProgress);
                camera.position.lerpVectors(startCamPos, targetCamPos, ease);
                currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
                
                if (transitionProgress === 1) {
                    currentSlideIndex++;
                    isAnimating = false;
                }
            }
        }
        
        // --- TYPE 1 : CONTOURNEMENT PAR LA DROITE ---
        else if (transitionType === 1 && transitionDirection === 1) {
            transitionProgress += 0.012; 
            if (transitionProgress >= 1) transitionProgress = 1;
            
            const ease = easeInOutCubic(transitionProgress);
            const zPos = THREE.MathUtils.lerp(startCamPos.z, targetCamPos.z, ease);
            const xOffset = Math.sin(transitionProgress * Math.PI) * 15.0; // Demi-cercle droit
            
            camera.position.set(xOffset, startCamPos.y, zPos);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
            
            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }
        
        // --- TYPE 2 : VOL PAR DESSUS (PARABOLE) ---
        else if (transitionType === 2 && transitionDirection === 1) {
            transitionProgress += 0.012;
            if (transitionProgress >= 1) transitionProgress = 1;
            
            const ease = easeInOutCubic(transitionProgress);
            const zPos = THREE.MathUtils.lerp(startCamPos.z, targetCamPos.z, ease);
            const yOffset = startCamPos.y + Math.sin(transitionProgress * Math.PI) * 12.0; 
            
            camera.position.set(startCamPos.x, yOffset, zPos);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
            
            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }

        // --- TYPE 3 : LE TIROIR LATÉRAL ---
        else if (transitionType === 3 && transitionDirection === 1) {
            transitionProgress += 0.015;
            if (transitionProgress >= 1) transitionProgress = 1;

            const ease = easeInOutCubic(transitionProgress);
            
            // Le mur glisse très vite vers la gauche
            activeSlide.position.x = -ease * 30.0;
            
            // La caméra avance en même temps
            camera.position.lerpVectors(startCamPos, targetCamPos, ease);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);

            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }

        // --- TYPE 4 : LA PORTE TAMBOUR (Rotation Y) ---
        else if (transitionType === 4 && transitionDirection === 1) {
            transitionProgress += 0.012;
            if (transitionProgress >= 1) transitionProgress = 1;

            const ease = easeInOutCubic(transitionProgress);
            
            // Le mur pivote à 90° (devient plat face à la caméra)
            activeSlide.rotation.y = ease * (Math.PI / 2);
            
            // La caméra se glisse à travers l'ouverture créée
            const zPos = THREE.MathUtils.lerp(startCamPos.z, targetCamPos.z, ease);
            const xOffset = Math.sin(transitionProgress * Math.PI) * 6.0; // Léger écart pour ne pas taper la tranche
            
            camera.position.set(xOffset, startCamPos.y, zPos);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);

            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }

        // --- TYPE 5 : L'ESQUIVE PAR LE BAS ---
        else if (transitionType === 5 && transitionDirection === 1) {
            transitionProgress += 0.015;
            if (transitionProgress >= 1) transitionProgress = 1;

            const ease = easeInOutCubic(transitionProgress);
            
            // Le mur saute en l'air
            const jumpEase = Math.sin(transitionProgress * Math.PI);
            activeSlide.position.y = jumpEase * 12.0; 
            
            // La caméra fonce tout droit (passe en dessous)
            camera.position.lerpVectors(startCamPos, targetCamPos, ease);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);

            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }

        // --- TYPE 6 : CONTOURNEMENT PAR LA GAUCHE (Caméra libre) ---
        else if (transitionType === 6 && transitionDirection === 1) {
            transitionProgress += 0.012; 
            if (transitionProgress >= 1) transitionProgress = 1;
            
            const ease = easeInOutCubic(transitionProgress);
            const zPos = THREE.MathUtils.lerp(startCamPos.z, targetCamPos.z, ease);
            const xOffset = -Math.sin(transitionProgress * Math.PI) * 15.0; // Demi-cercle gauche
            const yOffset = startCamPos.y + Math.sin(transitionProgress * Math.PI) * 5.0; // S'élève un peu
            
            camera.position.set(xOffset, yOffset, zPos);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
            
            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }
        
        // --- TYPE 99 : REMBOBINAGE (RETOUR UNIVERSEL) ---
        else if (transitionType === 99 && transitionDirection === -1) {
            transitionProgress += 0.03; // Retour très rapide
            if (transitionProgress >= 1) transitionProgress = 1;
            
            const ease = easeInOutCubic(transitionProgress);
            camera.position.lerpVectors(startCamPos, targetCamPos, ease);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
            
            // On restaure "magiquement" toutes les transformations du mur ciblé
            const targetSlide = slides[currentSlideIndex];
            
            // On lerp toutes les propriétés modifiées par les transitions vers leur état initial (0)
            targetSlide.rotation.x += (0 - targetSlide.rotation.x) * 0.15;
            targetSlide.rotation.y += (0 - targetSlide.rotation.y) * 0.15;
            targetSlide.position.x += (0 - targetSlide.position.x) * 0.15;
            targetSlide.position.y += (-4.0 - targetSlide.position.y) * 0.15; // Y de base du hinge est -4.0
            
            if (transitionProgress === 1) {
                // S'assurer que tout est parfait à la fin
                targetSlide.rotation.set(0,0,0);
                targetSlide.position.set(0, -4.0, targetSlide.position.z);
                
                shakeIntensity = 0.1; // Petit clac de fin
                shakeTime = 10;
                isAnimating = false;
            }
        }
    }

    // Effet Camera Shake indépendant
    if (shakeTime > 0) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= 0.9; 
        shakeTime--;
    }
    
    // Application finale du LookAt
    camera.lookAt(currentLookAt);
    
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();