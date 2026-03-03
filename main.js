import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// ─── CONSTANTES DU PRISME ───
const NUM_SLIDES = 10;
const FACE_ANGLE = (2 * Math.PI) / NUM_SLIDES;
const FACE_WIDTH = 10;
const PRISM_HEIGHT = 5.6;
const PRISM_RADIUS = FACE_WIDTH / (2 * Math.sin(FACE_ANGLE / 2));
const APOTHEM = PRISM_RADIUS * Math.cos(FACE_ANGLE / 2);

// ─── CONSTANTES DE LAYOUT DES SLIDES ───
const MARGIN   = 0.4;
const PANEL_W  = 9.6;
const PANEL_H  = 5.2;
const HEADER_H = 1.5;
const HEADER_Y = (PANEL_H / 2) - (HEADER_H / 2);  // 1.85
const LEFT_X   = -(PANEL_W / 2) + MARGIN;           // -4.4

// --- SYSTÈME DE CADRES (FRAMED PICTURES) ---
function createFramedPicture(mediaUrl, width = 4, height = 2.5) {
    const group = new THREE.Group();

    // 1. Le cadre (Frame)
    const frameDepth = 0.1;
    const frameThickness = 0.1;
    
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    
    // Top
    const topGeo = new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, frameDepth);
    const topMesh = new THREE.Mesh(topGeo, frameMat);
    topMesh.position.set(0, height / 2 + frameThickness / 2, 0);
    group.add(topMesh);

    // Bottom
    const bottomGeo = new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, frameDepth);
    const bottomMesh = new THREE.Mesh(bottomGeo, frameMat);
    bottomMesh.position.set(0, -(height / 2 + frameThickness / 2), 0);
    group.add(bottomMesh);

    // Left
    const sideGeo = new THREE.BoxGeometry(frameThickness, height, frameDepth);
    const leftMesh = new THREE.Mesh(sideGeo, frameMat);
    leftMesh.position.set(-(width / 2 + frameThickness / 2), 0, 0);
    group.add(leftMesh);

    // Right
    const rightMesh = new THREE.Mesh(sideGeo, frameMat);
    rightMesh.position.set(width / 2 + frameThickness / 2, 0, 0);
    group.add(rightMesh);

    // 2. Le fond (Backing)
    const backGeo = new THREE.BoxGeometry(width, height, 0.02);
    const backMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, 0, -frameDepth / 2 + 0.01);
    group.add(backMesh);

    // 3. Image/Video
    let texture;
    if (mediaUrl.endsWith('.mp4')) {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.play();
        texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
    } else {
        const texLoader = new THREE.TextureLoader();
        texture = texLoader.load(mediaUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
    }
    
    const imageGeo = new THREE.PlaneGeometry(width, height);
    const imageMat = new THREE.MeshBasicMaterial({
        map: texture, color: 0xffffff, side: THREE.FrontSide 
    });
    const imageMesh = new THREE.Mesh(imageGeo, imageMat);
    imageMesh.position.set(0, 0, 0);
    group.add(imageMesh);

    return group;
}

// ─── 1. SCÈNE, CAMÉRA, RENDERER ───
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, APOTHEM + 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── 2. ORBIT CONTROLS ───
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enabled = false;
orbitControls.target.set(0, 0, 0);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.minDistance = 2;
orbitControls.maxDistance = 500;
let freeCameraMode = false;

// ─── 3. ÉCLAIRAGE ET ENVIRONNEMENT HDRI ───
const hdriLoader = new EXRLoader();
hdriLoader.load('assets/industrial_sunset_puresky_4k.exr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    scene.backgroundIntensity = 0.3;
});

// ─── 4. MATÉRIAU ONYX PBR (MARBRE) ───
const texLoader = new THREE.TextureLoader();
const onyxColor = texLoader.load('assets/Onyx013_8K-PNG/Onyx013_8K-PNG_Color.png');
onyxColor.colorSpace = THREE.SRGBColorSpace;
const onyxNormal = texLoader.load('assets/Onyx013_8K-PNG/Onyx013_8K-PNG_NormalGL.png');
const onyxRoughness = texLoader.load('assets/Onyx013_8K-PNG/Onyx013_8K-PNG_Roughness.png');

;[onyxColor, onyxNormal, onyxRoughness].forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(NUM_SLIDES, 1);
});

const prismMaterial = new THREE.MeshStandardMaterial({
    map: onyxColor,
    normalMap: onyxNormal,
    roughnessMap: onyxRoughness,
    roughness: 0.15,
    metalness: 0.1,
    envMapIntensity: 1.0
});

// ─── 5. PRISME CENTRAL ───
const prismGeo = new THREE.CylinderGeometry(PRISM_RADIUS, PRISM_RADIUS, PRISM_HEIGHT, NUM_SLIDES);
const prism = new THREE.Mesh(prismGeo, prismMaterial);
prism.rotation.y = -FACE_ANGLE / 2; // Face 0 pointe vers +Z (caméra)
prism.castShadow = true;
prism.receiveShadow = true;
scene.add(prism);

// ─── 6. CHARGEMENT DES TEXTURES ───

// Marble 82 — bande titre (fond de la barre noire)
const m82Color     = texLoader.load('assets/marble_82-1K/marble_82_basecolor-1K.png');
m82Color.colorSpace = THREE.SRGBColorSpace;
const m82Normal    = texLoader.load('assets/marble_82-1K/marble_82_normal-1K.png');
const m82Roughness = texLoader.load('assets/marble_82-1K/marble_82_roughness-1K.png');

// Metal 14 — lettres des titres
const mt14Color    = texLoader.load('assets/metal_14-1K/metal_14_basecolor-1K.png');
mt14Color.colorSpace = THREE.SRGBColorSpace;
const mt14Normal   = texLoader.load('assets/metal_14-1K/metal_14_normal-1K.png');
const mt14Roughness = texLoader.load('assets/metal_14-1K/metal_14_roughness-1K.png');
const mt14Metallic  = texLoader.load('assets/metal_14-1K/metal_14_metallic-1K.png');

// Metal 13 — lettres des sous-titres
const mt13Color    = texLoader.load('assets/metal_13-1K/metal_13_basecolor-1K.png');
mt13Color.colorSpace = THREE.SRGBColorSpace;
const mt13Normal   = texLoader.load('assets/metal_13-1K/metal_13_normal-1K.png');
const mt13Roughness = texLoader.load('assets/metal_13-1K/metal_13_roughness-1K.png');
const mt13Metallic  = texLoader.load('assets/metal_13-1K/metal_13_metallic-1K.png');

// Marble 74 — fond blanc des slides
const m74Color     = texLoader.load('assets/marble_74-1K/marble_74_basecolor-1K.png');
m74Color.colorSpace = THREE.SRGBColorSpace;
const m74Normal    = texLoader.load('assets/marble_74-1K/marble_74_normal-1K.png');
const m74Roughness = texLoader.load('assets/marble_74-1K/marble_74_roughness-1K.png');

// ─── 7. MATÉRIAUX ───

// Lettres titres — metal_14
const goldMaterial = new THREE.MeshStandardMaterial({
    map:          mt14Color,
    normalMap:    mt14Normal,
    roughnessMap: mt14Roughness,
    metalnessMap: mt14Metallic,
    metalness:    1.0,
    envMapIntensity: 3.0
});

// Lettres sous-titres — metal_13
const silverMaterial = new THREE.MeshStandardMaterial({
    map:          mt13Color,
    normalMap:    mt13Normal,
    roughnessMap: mt13Roughness,
    metalnessMap: mt13Metallic,
    metalness:    1.0,
    envMapIntensity: 2.5
});

// Lettres bullets — noir métal (paramétrique)
const blackMaterial = new THREE.MeshStandardMaterial({
    color:    0x111111,
    roughness: 0.25,
    metalness: 0.75,
    envMapIntensity: 2.0
});

// Fond des slides — marble_74
const whitePanelMaterial = new THREE.MeshStandardMaterial({
    map:          m74Color,
    normalMap:    m74Normal,
    roughnessMap: m74Roughness,
    metalness:    0.0,
    envMapIntensity: 1.0
});

// Bande titre — marble_82
const darkHeaderMaterial = new THREE.MeshStandardMaterial({
    map:          m82Color,
    normalMap:    m82Normal,
    roughnessMap: m82Roughness,
    metalness:    0.05,
    envMapIntensity: 1.2
});

// ─── 8. CONTENU DES 10 SLIDES ───
const SLIDES = [
    {
        title: "The AI Moral Crossroads",
        subtitle: "Killer Robots, Mass Surveillance,\nand the 'Too Big To Fail' Gamble",
        bullets: []
    },
    {
        title: "The Pentagon's Ultimatum",
        subtitle: "The Demand for 'Unfettered Access'",
        bullets: [
            "DoD demands 'any lawful use' of AI models.",
            "Goal: AI into classified military networks.",
            "Target: Anthropic, the safety-first AI lab."
        ]
    },
    {
        title: "Anthropic's Red Lines",
        subtitle: '"Cannot in Good Conscience"',
        bullets: [
            "Refusal 1: Fully Autonomous Lethal Weapons.",
            "Refusal 2: Domestic Mass Surveillance.",
            "AI is not reliable enough for life-or-death."
        ]
    },
    {
        title: "The Retaliation",
        subtitle: "Banned from the Government",
        bullets: [
            "Trump orders all federal agencies to drop Anthropic.",
            "Labeled 'Supply-Chain Risk' (reserved for enemies).",
            "Anthropic loses hundreds of millions in contracts."
        ]
    },
    {
        title: "Enter OpenAI",
        subtitle: "The Opportunistic Pivot",
        bullets: [
            "OpenAI signs a massive Pentagon deal hours later.",
            "Altman claims the same 'safeguards' are in place.",
            "Why did the Pentagon accept from OpenAI\nwhat it rejected from Anthropic?"
        ]
    },
    {
        title: "A Question of Hypocrisy",
        subtitle: "Ethics or PR Stunt?",
        bullets: [
            "Hundreds of Google & OpenAI employees protest.",
            "Critics label the deal a 'dog and pony show'.",
            "Ethics sacrificed for lucrative contracts."
        ]
    },
    {
        title: "The Hidden Financial Motive",
        subtitle: "A $1.4 Trillion Bet on the Future",
        bullets: [
            "OpenAI plans massive infrastructure build-outs.",
            "Billions of dollars in complex debt.",
            "Mounting concerns over an 'AI Bubble'."
        ]
    },
    {
        title: "The 2008 Playbook",
        subtitle: '"Too Big To Fail"',
        bullets: [
            "CFO requests a government 'backstop' for loans.",
            "Strategy: shift investor risk onto US taxpayers.",
            "Echoes of the Lehman Brothers collapse."
        ]
    },
    {
        title: "The Ultimate Trap",
        subtitle: "Entanglement as a Strategy",
        bullets: [
            "Sen. Elizabeth Warren warns against this strategy.",
            "Pentagon deal makes OpenAI indispensable.",
            "If bankrupt, the government must bail them out."
        ]
    },
    {
        title: "Profit vs. Principles",
        subtitle: "Who Decides the Future of AI?",
        bullets: []
    }
];

// ─── 8. FONCTION TEXTE 3D ───
// Supporte les sauts de ligne (\n) et utilise le matériau passé en paramètre.
// startX = null → centré ; startX = nombre → aligné à gauche depuis ce X
function addTextToFace(parent, text, size, yOffset, font, material, startX = null) {
    const lines = text.split('\n');
    const lineHeight = size * 1.35;

    lines.forEach((line, lineIndex) => {
        const textGeo = new TextGeometry(line, {
            font: font,
            size: size,
            height: 0.03,
            depth: 0.03,
            curveSegments: 10,
            bevelEnabled: false
        });

        textGeo.computeBoundingBox();
        const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;

        const x = startX !== null ? startX : -textWidth / 2;
        const textMesh = new THREE.Mesh(textGeo, material);
        textMesh.castShadow = true;
        textMesh.position.set(x, yOffset - lineIndex * lineHeight, 0);

        parent.add(textMesh);
    });
}

// ─── 9. CRÉATION DES SLIDES ───
const loader = new FontLoader();
loader.load('https://unpkg.com/three@0.162.0/examples/fonts/optimer_bold.typeface.json', function (font) {
    for (let i = 0; i < NUM_SLIDES; i++) {
        const slide = SLIDES[i];

        // Les faceGroups sont enfants du prisme (rotation.y = -FACE_ANGLE/2)
        // → l'angle local compense cette rotation initiale
        const angle = i * FACE_ANGLE + FACE_ANGLE / 2;

        const faceGroup = new THREE.Group();
        faceGroup.position.set(APOTHEM * Math.sin(angle), 0, APOTHEM * Math.cos(angle));
        faceGroup.rotation.y = angle;
        faceGroup.translateZ(0.08);

        // ── Fond blanc (toutes les slides) ──────────────────────────────
        const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), whitePanelMaterial);
        panelMesh.position.z = -0.06;
        faceGroup.add(panelMesh);

        if (i === 0 || i === NUM_SLIDES - 1) {
            // ── SLIDE 1 & 10 : grand titre centré avec bloc marble_82 ────────

            // Mesure le titre pour dimensionner le bloc exactement
            const titleGeo = new TextGeometry(slide.title, {
                font: font, size: 0.50, height: 0.03, depth: 0.03,
                curveSegments: 10, bevelEnabled: false
            });
            titleGeo.computeBoundingBox();
            const titleW = titleGeo.boundingBox.max.x - titleGeo.boundingBox.min.x;

            // Bloc marble_82 autour du titre (padding 0.3 H, 0.2 V)
            const titleBlockMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(titleW + 0.6, 0.90),
                darkHeaderMaterial
            );
            titleBlockMesh.position.set(0, 0.95, -0.04);
            faceGroup.add(titleBlockMesh);

            // Titre posé sur le bloc
            const titleMesh = new THREE.Mesh(titleGeo, goldMaterial);
            titleMesh.castShadow = true;
            titleMesh.position.set(-titleW / 2, 0.70, 0);
            faceGroup.add(titleMesh);

            // Sous-titre centré, sans bloc
            addTextToFace(faceGroup, slide.subtitle, 0.22, -0.25, font, silverMaterial);
        } else {
            // ── SLIDES 2-10 : DÉCOUPAGE EN 4 QUARTIERS ─────
            // Quartier Haut-Gauche : Titre & Sous-titre
            // Quartier Bas-Gauche : Texte (bullets)
            // Quartiers Droite (Haut/Bas) : Images

            // Bande or sombre en haut (sur toute la largeur)
            const headerMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, HEADER_H), darkHeaderMaterial);
            headerMesh.position.set(0, HEADER_Y, -0.03);
            faceGroup.add(headerMesh);

            // Titre dans la bande, aligné à gauche (Haut-Gauche)
            addTextToFace(faceGroup, slide.title,    0.28, 1.65, font, goldMaterial,   LEFT_X);

            // Sous-titre sous la bande, aligné à gauche (Haut-Gauche)
            addTextToFace(faceGroup, slide.subtitle, 0.16, 0.85, font, silverMaterial, LEFT_X);

            // Bullets alignés à gauche (Bas-Gauche)
            slide.bullets.forEach((bullet, bi) => {
                addTextToFace(faceGroup, `\u2022 ${bullet}`, 0.13, -0.15 - bi * 0.45, font, blackMaterial, LEFT_X);
            });
        }

        // --- GESTION DES IMAGES (QUARTIERS DROITS) ---
        // Moitié droite : x de 0 à 4.8. Centre = 2.4. (Marge max X = 4.4)
        // Haut-Droit : y de 0 à 2.6. Centre = 1.3
        // Bas-Droit : y de 0 à -2.6. Centre = -1.3

        if (i === 1) {
            // The Pentagon's Ultimatum -> Anthropic logo (Ratio 1.5 - 1620x1080)
            const framed = createFramedPicture('assets/anthropic.webp', 3.6, 2.4);
            framed.position.set(2.4, 0.2, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 2) {
            // Anthropic's Red Lines -> Terminator and Trump (Haut-Droit et Bas-Droit)
            const framed1 = createFramedPicture('assets/terminator.mp4', 3.2, 1.8);
            framed1.position.set(2.4, 1.3, 0.1); 
            faceGroup.add(framed1);

            const framed2 = createFramedPicture('assets/donald_trump.mp4', 3.2, 1.8);
            framed2.position.set(2.4, -1.3, 0.1); 
            faceGroup.add(framed2);
        }

        if (i === 3) {
            // The Retaliation -> Trump Angry (Centré à droite)
            const framed = createFramedPicture('assets/trump_angry.mp4', 3.4, 3.4);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 4) {
            // Enter OpenAI -> OpenAI Logo (Centré à droite, ratio 1:1)
            const framed = createFramedPicture('assets/OpenAI_Logo.png', 3.2, 3.2);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 5) {
            // A Question of Hypocrisy -> Hypocrisy GIF (Centré à droite, ratio 1:1)
            const framed = createFramedPicture('assets/hypocrisy.mp4', 3.4, 3.4);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 6) {
            // The Hidden Financial Motive -> Donald Duck Money (Centré à droite)
            const framed = createFramedPicture('assets/donald_duck.mp4', 2.8, 3.4);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 7) {
            // The 2008 Playbook -> Fraud GIF (Centré à droite, ratio 1:1)
            const framed = createFramedPicture('assets/fraud.mp4', 3.4, 3.4);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        if (i === 8) {
            // The Ultimate Trap -> Its A Trap GIF (Centré à droite)
            const framed = createFramedPicture('assets/its_a_trap.mp4', 4.0, 2.15);
            framed.position.set(2.4, 0.0, 0.1); 
            faceGroup.add(framed);
        }

        prism.add(faceGroup);
    }
});

// ─── 10. SYSTÈME DE ROTATION (TRANSITIONS) ───
let currentSlideIndex = 0;
let isAnimating = false;
let transitionProgress = 0;
let currentPrismAngle = -FACE_ANGLE / 2;
let targetPrismAngle = -FACE_ANGLE / 2;
let startPrismAngle = -FACE_ANGLE / 2;

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function startTransition(direction) {
    if (isAnimating) return;
    const nextIndex = currentSlideIndex + direction;
    if (nextIndex < 0 || nextIndex >= NUM_SLIDES) return;
    isAnimating = true;
    transitionProgress = 0;
    startPrismAngle = currentPrismAngle;
    targetPrismAngle = -nextIndex * FACE_ANGLE - FACE_ANGLE / 2;
    currentSlideIndex = nextIndex;
}

// ─── 11. CONTRÔLES CLAVIER ───
window.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') {
        freeCameraMode = !freeCameraMode;
        orbitControls.enabled = freeCameraMode;
        
        if (!freeCameraMode) {
            // Revenir à la première slide
            camera.position.set(0, 0, APOTHEM + 10);
            camera.lookAt(0, 0, 0);
            
            currentSlideIndex = 0;
            currentPrismAngle = -FACE_ANGLE / 2;
            targetPrismAngle = -FACE_ANGLE / 2;
            prism.rotation.y = currentPrismAngle;
            isAnimating = false;
        }
        
        return;
    }
    if (freeCameraMode) return;
    if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        startTransition(1);
    }
    if (event.key === 'ArrowLeft') {
        startTransition(-1);
    }
});

// ─── 12. BOUCLE D'ANIMATION ───
function animate() {
    requestAnimationFrame(animate);

    if (isAnimating) {
        transitionProgress += 0.015;
        if (transitionProgress >= 1) transitionProgress = 1;
        const ease = easeInOutCubic(transitionProgress);
        currentPrismAngle = startPrismAngle + (targetPrismAngle - startPrismAngle) * ease;
        prism.rotation.y = currentPrismAngle;
        if (transitionProgress >= 1) {
            isAnimating = false;
            currentPrismAngle = targetPrismAngle;
        }
    }

    if (orbitControls.enabled) {
        orbitControls.update();
    } else {
        camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
}

// ─── 13. RESIZE ───
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
