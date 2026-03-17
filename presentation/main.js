import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// ─── CONSTANTES DU PRISME ───
const NUM_SLIDES = 12;
const FACE_ANGLE = (2 * Math.PI) / NUM_SLIDES;
const FACE_WIDTH = 10;
const PRISM_HEIGHT = 5.6;
const PRISM_RADIUS = FACE_WIDTH / (2 * Math.sin(FACE_ANGLE / 2));
const APOTHEM = PRISM_RADIUS * Math.cos(FACE_ANGLE / 2);

// ─── ÉTAT VUE EN HAUT (BG VIDEO) ───
let isLookingUp = false;
let lookUpTransitioning = false;
let lookUpProgress = 0;
let lookUpDirection = 0;

// ─── ÉTAT VUE EN HAUT (SLIDE 12 - QUESTION) ───
let isLookingUp12 = false;
let lookUpTransitioning12 = false;
let lookUpProgress12 = 0;
let lookUpDirection12 = 0;
let questionGroup = null;
// ─── AVION SLIDE 12 ───
const TRAIL_LENGTH         = 500;    // nb de particules dans la traînée
const PLANE_SPEED          = 0.0010; // progression par frame (~17s pour traverser)
const CONTRAIL_FADE_FRAMES = 480;    // ~8s de persistance après disparition de l'avion
let planeGroup      = null;
let contrailGeo     = null;
let contrailMat     = null;
let contrailPoints  = null;
let planeActive     = false;
let contrailActive  = false; // true pendant le fade-out après que l'avion a disparu
let contrailFadeTime = 0;
let planeProgress   = 0;
// Orbite caméra : de la vue frontale (élévation 0°) à la vue supérieure (élévation 75°)
const CAMERA_R           = APOTHEM + 10;
const CAMERA_ELEV        = 75 * Math.PI / 180;
const CAMERA_POS_NORMAL  = new THREE.Vector3(0, 0, CAMERA_R);
const CAMERA_POS_UP      = new THREE.Vector3(0, 0, CAMERA_R); // même position, la caméra tourne sur elle-même
const CAMERA_LOOK_NORMAL = new THREE.Vector3(0, 0, 0);
const CAMERA_LOOK_UP     = new THREE.Vector3(0, 0, CAMERA_R + 20); // derrière la caméra
// Slide 12 : inclinaison du groupe de lettres pour faire face à la caméra (caméra à Z=CAMERA_R, lettres à Y≈27)
const SLIDE12_TILT       = Math.atan2(27, CAMERA_R);  // ≈ 0.73 rad
const SLIDE12_LAY        = 27 * Math.cos(SLIDE12_TILT); // position Y du centre des lettres après tilt ≈ 20
const SLIDE12_LAZ        = 27 * Math.sin(SLIDE12_TILT); // position Z du centre des lettres après tilt ≈ 18
let bgVideo = null;
let playBtnGroup = null;
let pauseBtnGroup = null;

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

// --- CADRE VIDÉO BG2 (au-dessus du prisme) ---
function createBGVideoFrame() {
    // Élément vidéo HTML5 — sans autoplay, avec son
    bgVideo = document.createElement('video');
    bgVideo.src = 'assets/bg2.mp4';
    bgVideo.crossOrigin = 'anonymous';
    bgVideo.loop = false;
    bgVideo.muted = false;

    // Trimming programmatique à 24s
    bgVideo.addEventListener('timeupdate', () => {
        if (bgVideo.currentTime >= 24) {
            bgVideo.currentTime = 0;
            bgVideo.pause();
        }
    });

    const videoTexture = new THREE.VideoTexture(bgVideo);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const frameGroup = new THREE.Group();
    const W = 10, H = W * (16 / 9); // ratio 9:16 (Short vertical)
    const T = 0.35;          // épaisseur des barres du cadre

    // Barres du cadre — même matériau que le prisme (Onyx)
    const barDefs = [
        { w: W + 2 * T, h: T, d: 0.18, x: 0,          y: H / 2 + T / 2 }, // haut
        { w: W + 2 * T, h: T, d: 0.18, x: 0,          y: -(H / 2 + T / 2) }, // bas
        { w: T,         h: H, d: 0.18, x: -(W / 2 + T / 2), y: 0 }, // gauche
        { w: T,         h: H, d: 0.18, x: W / 2 + T / 2,    y: 0 }, // droite
    ];
    barDefs.forEach(b => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), prismMaterial);
        mesh.position.set(b.x, b.y, 0);
        frameGroup.add(mesh);
    });

    // Fond noir
    const backing = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    backing.position.z = -0.02;
    frameGroup.add(backing);

    // Plan vidéo
    const videoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({ map: videoTexture })
    );
    videoMesh.position.z = 0.01;
    frameGroup.add(videoMesh);

    // ── Bouton Play : triangle 3D extrudé ──
    playBtnGroup = new THREE.Group();
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.7, -0.9);
    triShape.lineTo( 1.0,  0.0);
    triShape.lineTo(-0.7,  0.9);
    triShape.closePath();
    const playGeo = new THREE.ExtrudeGeometry(triShape, {
        depth: 0.35, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3
    });
    const playMesh = new THREE.Mesh(playGeo, prismMaterial);
    playMesh.position.z = -0.18;
    playBtnGroup.add(playMesh);
    playBtnGroup.position.set(-2.0, -(H / 2 + 1.5), 0);
    frameGroup.add(playBtnGroup);

    // ── Bouton Pause : deux barres 3D ──
    pauseBtnGroup = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.45, 1.8, 0.35);
    const bar1 = new THREE.Mesh(barGeo, prismMaterial);
    bar1.position.set(-0.5, 0, 0);
    const bar2 = new THREE.Mesh(barGeo, prismMaterial);
    bar2.position.set( 0.5, 0, 0);
    pauseBtnGroup.add(bar1);
    pauseBtnGroup.add(bar2);
    pauseBtnGroup.position.set(2.0, -(H / 2 + 1.5), 0);
    frameGroup.add(pauseBtnGroup);

    // Cadre derrière la caméra, face à elle (rotation Y 180°)
    frameGroup.position.set(0, 0, CAMERA_R + 40);
    frameGroup.rotation.y = Math.PI;

    scene.add(frameGroup);
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

// Cadre vidéo BG2 au-dessus du prisme
createBGVideoFrame();

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

// ─── 8. CONTENU DES 13 SLIDES ───
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
        subtitle: "A 'Supply-Chain Risk' Designation",
        bullets: [
            "Feb 27: Designated a 'National Security Risk'.",
            "Label usually reserved for Huawei or Kaspersky.",
            "Trump orders all federal agencies to drop Claude."
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
        subtitle: '"Too Big To Fail" — Entanglement as a Strategy',
        bullets: [
            "CFO requests a government 'backstop' for loans.",
            "Pentagon deal makes OpenAI indispensable.",
            "If bankrupt, the government must bail them out."
        ]
    },
    {
        title: "The Counter-Strike",
        subtitle: "March 9, 2026: Anthropic Sues",
        bullets: [
            "Lawsuit filed in federal court against the DoD.",
            "Argues the ban is 'punitive censorship'.",
            "A landmark test for 'AI First Amendment' rights."
        ]
    },
    {
        title: "The Public's Verdict",
        subtitle: "The #QuitGPT Movement",
        bullets: [
            "295% surge in ChatGPT uninstalls in 48 hours.",
            "Claude hits #1 on the App Store after the ban.",
            "Users rewarding ethics over government deals."
        ]
    },
    {
        title: "The $14 Billion Leak",
        subtitle: "The Paradox of Growth",
        bullets: [
            "Leaked documents project $14B loss for 2026.",
            "Infrastructure spend revised to $600B by 2030.",
            "Massive revenue vs. staggering compute costs."
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
            // The Counter-Strike -> Anthropic logo
            const framed = createFramedPicture('assets/anthropic.webp', 3.6, 2.4);
            framed.position.set(2.4, 0.2, 0.1);
            faceGroup.add(framed);
        }

        if (i === 9) {
            // The Public's Verdict -> OpenAI Logo (Boycott target)
            const framed = createFramedPicture('assets/OpenAI_Logo.png', 3.2, 3.2);
            framed.position.set(2.4, 0.0, 0.1);
            faceGroup.add(framed);
        }

        if (i === 10) {
            // The $14 Billion Leak -> Donald Duck Money (Reuse)
            const framed = createFramedPicture('assets/donald_duck.mp4', 2.8, 3.4);
            framed.position.set(2.4, 0.0, 0.1);
            faceGroup.add(framed);
        }

        // Numéro de slide, centré en bas du panneau
        addTextToFace(faceGroup, `${i + 1} / ${NUM_SLIDES}`, 0.12, -2.2, font, silverMaterial);

        prism.add(faceGroup);
    }

    // ─── LETTRES FLOTTANTES SLIDE 12 ───
    questionGroup = new THREE.Group();
    questionGroup.rotation.x = SLIDE12_TILT; // incline les lettres pour qu'elles fassent face à la caméra
    questionGroup.visible = false;
    scene.add(questionGroup);

    const lines12 = ['CAN AI', 'BE ETHICAL?'];
    const letterSize = 1.2;
    const letterDepth = 0.005;
    const kerning = 0.15;
    const lineGap = 2.2;

    lines12.forEach((lineText, lineIndex) => {
        const chars = lineText.split('');

        // Measure widths
        const letterWidths = chars.map(char => {
            if (char === ' ') return letterSize * 0.4;
            const geo = new TextGeometry(char, {
                font, size: letterSize, height: letterDepth, depth: letterDepth,
                curveSegments: 8, bevelEnabled: false
            });
            geo.computeBoundingBox();
            const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
            geo.dispose();
            return w;
        });

        const totalWidth = letterWidths.reduce((s, w) => s + w, 0) + (chars.length - 1) * kerning;
        let currentX = -totalWidth / 2;
        const baseY = 26 + (1 - lineIndex) * lineGap;

        chars.forEach((char, ci) => {
            if (char === ' ') {
                currentX += letterWidths[ci] + kerning;
                return;
            }
            const geo = new TextGeometry(char, {
                font, size: letterSize, height: letterDepth, depth: letterDepth,
                curveSegments: 8, bevelEnabled: false
            });
            const mesh = new THREE.Mesh(geo, goldMaterial);
            mesh.castShadow = true;
            const bx = currentX;
            const by = baseY;
            mesh.position.set(bx, by, 0);
            mesh.userData = { baseX: bx, baseY: by, phase: Math.random() * Math.PI * 2 };
            questionGroup.add(mesh);
            currentX += letterWidths[ci] + kerning;
        });
    });
});

// ─── AVION RÉALISTE (Boeing 737-style, géométries Three.js uniquement) ───

function _buildFuselage(mat) {
    // Profil LatheGeometry : ogive au nez, barrique constante, effilement queue
    // Axe Y (LatheGeometry) → sera pivoté en X (axe de vol)
    const pts = [
        new THREE.Vector2(0.000, 0.00),
        new THREE.Vector2(0.060, 0.10),
        new THREE.Vector2(0.160, 0.28),
        new THREE.Vector2(0.245, 0.52),
        new THREE.Vector2(0.280, 0.85),
        new THREE.Vector2(0.288, 1.20),  // début section constante
        new THREE.Vector2(0.288, 4.55),  // fin section constante
        new THREE.Vector2(0.280, 5.00),
        new THREE.Vector2(0.220, 5.50),
        new THREE.Vector2(0.120, 5.82),
        new THREE.Vector2(0.000, 6.00),
    ];
    const geo  = new THREE.LatheGeometry(pts, 28);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.x = -3.0;  // centre le fuselage sur x=0
    return mesh;
}

function _buildWings(mat) {
    const group     = new THREE.Group();
    const halfSpan  = 2.30;
    const rootChord = 1.15;
    const tipChord  = 0.38;
    const sweep     = 0.50;

    const shape = new THREE.Shape();
    shape.moveTo( rootChord * 0.35,  0);
    shape.lineTo( rootChord * 0.35 - sweep, halfSpan);
    shape.lineTo(-rootChord * 0.65 - sweep + tipChord, halfSpan);
    shape.lineTo(-rootChord * 0.65, 0);
    shape.closePath();

    const extOpts = {
        depth: 0.09, bevelEnabled: true,
        bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extOpts);

    const right = new THREE.Mesh(geo, mat);
    right.rotation.x = Math.PI / 2;
    right.position.set(0.15, -0.06, 0);
    group.add(right);

    const left = right.clone();
    left.scale.y = -1;
    group.add(left);
    return group;
}

function _buildEngine(bodyMat) {
    const group = new THREE.Group();

    // Nacelle principale (cylindre ouvert)
    const nacGeo = new THREE.CylinderGeometry(0.125, 0.132, 0.52, 22, 1, true);
    group.add(new THREE.Mesh(nacGeo, bodyMat));

    // Lèvre d'entrée d'air (tore)
    const lipGeo = new THREE.TorusGeometry(0.132, 0.013, 7, 22);
    const lip    = new THREE.Mesh(lipGeo, bodyMat);
    lip.position.y = 0.26;
    group.add(lip);

    // Face sombre de la soufflante
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x151b24, metalness: 0.7, roughness: 0.3 });
    const fanGeo = new THREE.CircleGeometry(0.118, 22);
    const fan    = new THREE.Mesh(fanGeo, fanMat);
    fan.position.y = 0.25;
    fan.rotation.x = -Math.PI / 2;
    group.add(fan);

    // Tuyère arrière
    const nozzleGeo = new THREE.CylinderGeometry(0.080, 0.125, 0.11, 22, 1, true);
    const nozzle    = new THREE.Mesh(nozzleGeo, bodyMat);
    nozzle.position.y = -0.315;
    group.add(nozzle);

    // Pylône
    const pylonGeo = new THREE.BoxGeometry(0.05, 0.17, 0.28);
    const pylon    = new THREE.Mesh(pylonGeo, bodyMat);
    pylon.position.y = 0.19;
    group.add(pylon);

    return group;
}

function _buildTail(mat) {
    const group = new THREE.Group();

    // Dérive verticale
    const finShape = new THREE.Shape();
    finShape.moveTo( 0.28,  0);
    finShape.lineTo( 0.08,  0.65);
    finShape.lineTo(-0.20,  0.65);
    finShape.lineTo(-0.38,  0);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.055, bevelEnabled: true, bevelThickness: 0.013, bevelSize: 0.013, bevelSegments: 2,
    });
    const fin = new THREE.Mesh(finGeo, mat);
    fin.rotation.x = -Math.PI / 2;
    fin.position.set(-2.52, 0.27, -0.027);
    group.add(fin);

    // Stabilisateur horizontal
    const stabShape = new THREE.Shape();
    const hs = 0.92, rc = 0.52, tc = 0.20, sw = 0.14;
    stabShape.moveTo( rc * 0.35,  0);
    stabShape.lineTo( rc * 0.35 - sw, hs);
    stabShape.lineTo(-rc * 0.65 - sw + tc, hs);
    stabShape.lineTo(-rc * 0.65, 0);
    stabShape.closePath();
    const stabGeo = new THREE.ExtrudeGeometry(stabShape, {
        depth: 0.046, bevelEnabled: true, bevelThickness: 0.011, bevelSize: 0.011, bevelSegments: 2,
    });
    const stabR = new THREE.Mesh(stabGeo, mat);
    stabR.rotation.x = Math.PI / 2;
    stabR.position.set(-2.52, 0.04, 0);
    group.add(stabR);

    const stabL = stabR.clone();
    stabL.scale.y = -1;
    group.add(stabL);

    return group;
}

function createPlane() {
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xeef0f4, metalness: 0.05, roughness: 0.38, envMapIntensity: 1.3,
        side: THREE.DoubleSide,
    });
    const nacelleMat = new THREE.MeshStandardMaterial({
        color: 0xd0d6de, metalness: 0.40, roughness: 0.28, envMapIntensity: 1.5,
    });
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x192030, metalness: 0.0, roughness: 0.08, envMapIntensity: 2.0,
    });

    planeGroup = new THREE.Group();
    planeGroup.add(_buildFuselage(bodyMat));
    planeGroup.add(_buildWings(bodyMat));
    planeGroup.add(_buildTail(bodyMat));

    // Moteurs (axe Y → axe X après rotation)
    const nacelleMesh = _buildEngine(nacelleMat);
    [[-0.88], [0.88]].forEach(([zPos]) => {
        const e = nacelleMesh.clone();
        e.rotation.z = Math.PI / 2;
        e.position.set(0.50, -0.20, zPos);
        planeGroup.add(e);
    });

    // Bande de hublots
    const wsMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.095, 0.580), windowMat);
    wsMesh.position.set(-0.15, 0.135, 0);
    planeGroup.add(wsMesh);

    planeGroup.visible = false;
    scene.add(planeGroup);

    // Texture fumée haute-résolution : disque doux avec halo diffus
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = smokeCanvas.height = 128;
    const sCtx = smokeCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.00, 'rgba(255,255,255,1.0)');
    grad.addColorStop(0.20, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.70, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1.00, 'rgba(255,255,255,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
    smokeTexture.magFilter = THREE.LinearFilter;
    smokeTexture.minFilter = THREE.LinearFilter;

    // Traînée : buffer positions + attribut aAge statique (position 0 = plus récente)
    const positions = new Float32Array(TRAIL_LENGTH * 3).fill(-9999);
    const ages      = new Float32Array(TRAIL_LENGTH);
    for (let i = 0; i < TRAIL_LENGTH; i++) ages[i] = i / TRAIL_LENGTH;

    contrailGeo = new THREE.BufferGeometry();
    contrailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    contrailGeo.setAttribute('aAge',     new THREE.BufferAttribute(ages, 1));

    // ShaderMaterial : taille des particules croît avec l'âge (petite près de l'avion,
    // grande et étalée derrière), opacité globale contrôlée via uniform
    contrailMat = new THREE.ShaderMaterial({
        uniforms: {
            uTexture:       { value: smokeTexture },
            uBaseSize:      { value: 1.6 },
            uGlobalOpacity: { value: 0.85 },
            uScreenH:       { value: window.innerHeight }
        },
        vertexShader: `
            attribute float aAge;
            uniform float uBaseSize;
            uniform float uGlobalOpacity;
            uniform float uScreenH;
            varying float vAlpha;
            void main() {
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                // Expansion : fine au départ (0.2×), large à la fin (3.0×)
                float expand = mix(0.2, 3.0, aAge * aAge);
                // Atténuation perspective identique à sizeAttenuation:true
                float atten = projectionMatrix[1][1] * uScreenH * 0.5 / -mvPos.z;
                gl_PointSize = uBaseSize * expand * atten;
                // Fondu : quadratique, le cœur reste opaque longtemps
                vAlpha = max(0.0, (1.0 - aAge * aAge * 0.82)) * uGlobalOpacity;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            varying float vAlpha;
            void main() {
                vec4 tex = texture2D(uTexture, gl_PointCoord);
                if (tex.a < 0.01) discard;
                gl_FragColor = vec4(tex.rgb, tex.a * vAlpha);
            }
        `,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.NormalBlending
    });

    contrailPoints = new THREE.Points(contrailGeo, contrailMat);
    contrailPoints.visible = false;
    scene.add(contrailPoints);
}

createPlane();

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
    const nextIndex = ((currentSlideIndex + direction) + NUM_SLIDES) % NUM_SLIDES;
    // Reset vue en haut si active
    if (isLookingUp || lookUpTransitioning) {
        isLookingUp = false;
        lookUpTransitioning = false;
        lookUpProgress = 0;
        if (bgVideo) bgVideo.pause();
        camera.position.copy(CAMERA_POS_NORMAL);
        camera.lookAt(CAMERA_LOOK_NORMAL);
    }
    if (isLookingUp12 || lookUpTransitioning12) {
        isLookingUp12 = false;
        lookUpTransitioning12 = false;
        lookUpProgress12 = 0;
        if (questionGroup) questionGroup.visible = false;
        planeActive = false;
        contrailActive = false;
        contrailFadeTime = 0;
        if (planeGroup)     planeGroup.visible     = false;
        if (contrailPoints) { contrailPoints.visible = false; if (contrailMat) contrailMat.uniforms.uGlobalOpacity.value = 0.85; }
        camera.up.set(0, 1, 0);
        camera.position.copy(CAMERA_POS_NORMAL);
        camera.lookAt(CAMERA_LOOK_NORMAL);
    }
    isAnimating = true;
    transitionProgress = 0;
    startPrismAngle = currentPrismAngle;
    targetPrismAngle = currentPrismAngle - direction * FACE_ANGLE;
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
        if (!isLookingUp && !isLookingUp12) startTransition(1);
    }
    if (event.key === 'ArrowLeft') {
        if (!isLookingUp && !isLookingUp12) startTransition(-1);
    }
    if (event.key === 'ArrowUp') {
        if (currentSlideIndex === 7 && !isLookingUp && !lookUpTransitioning) {
            lookUpDirection = 1;
            lookUpTransitioning = true;
        }
        if (currentSlideIndex === 11 && !isLookingUp12 && !lookUpTransitioning12) {
            lookUpDirection12 = 1;
            lookUpTransitioning12 = true;
            if (questionGroup) questionGroup.visible = true;
            // Lancer l'avion
            planeActive      = true;
            contrailActive   = false;
            contrailFadeTime = 0;
            planeProgress    = 0;
            if (planeGroup) planeGroup.visible = false; // visible seulement quand dans le champ
            if (contrailPoints) {
                contrailPoints.visible = true;
                if (contrailMat) contrailMat.uniforms.uGlobalOpacity.value = 0.85;
            }
            // Reset la traînée à hors-champ
            if (contrailGeo) contrailGeo.attributes.position.array.fill(-9999);
        }
    }
    if (event.key === 'ArrowDown') {
        if (isLookingUp && !lookUpTransitioning) {
            lookUpDirection = -1;
            lookUpTransitioning = true;
            if (bgVideo) bgVideo.pause();
        }
        if (isLookingUp12 && !lookUpTransitioning12) {
            lookUpDirection12 = -1;
            lookUpTransitioning12 = true;
            planeActive  = false;
            contrailActive = false;
            contrailFadeTime = 0;
            if (planeGroup)     planeGroup.visible     = false;
            if (contrailPoints) { contrailPoints.visible = false; if (contrailMat) contrailMat.uniforms.uGlobalOpacity.value = 0.85; }
        }
    }
});

// ─── 11b. RAYCASTING CLICS ET HOVER (BOUTONS VIDÉO) ───
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

window.addEventListener('click', (e) => {
    if (!isLookingUp || !playBtnGroup || !pauseBtnGroup) return;
    _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    const hitsPlay  = _raycaster.intersectObjects(playBtnGroup.children,  true);
    const hitsPause = _raycaster.intersectObjects(pauseBtnGroup.children, true);

    if (hitsPlay.length > 0 && bgVideo) {
        bgVideo.play().catch(err => console.warn('play() error:', err));
    } else if (hitsPause.length > 0 && bgVideo) {
        bgVideo.pause();
    }
});

window.addEventListener('mousemove', (e) => {
    if (!playBtnGroup || !pauseBtnGroup) return;
    if (!isLookingUp) {
        playBtnGroup.scale.setScalar(1.0);
        pauseBtnGroup.scale.setScalar(1.0);
        document.body.style.cursor = 'default';
        return;
    }
    _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    const hitsPlay  = _raycaster.intersectObjects(playBtnGroup.children,  true);
    const hitsPause = _raycaster.intersectObjects(pauseBtnGroup.children, true);

    playBtnGroup.scale.setScalar(hitsPlay.length  > 0 ? 1.08 : 1.0);
    pauseBtnGroup.scale.setScalar(hitsPause.length > 0 ? 1.08 : 1.0);
    document.body.style.cursor = (hitsPlay.length > 0 || hitsPause.length > 0) ? 'pointer' : 'default';
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
        if (lookUpTransitioning) {
            lookUpProgress = Math.max(0, Math.min(1, lookUpProgress + 0.018 * lookUpDirection));
            const ease = easeInOutCubic(lookUpProgress);
            // Rotation sur Y : de face au prisme (yaw=0) à face à la vidéo (yaw=π)
            const yaw = ease * Math.PI;
            camera.lookAt(Math.sin(yaw) * 50, 0, CAMERA_R - Math.cos(yaw) * 50);
            if (lookUpProgress >= 1) { isLookingUp = true;  lookUpTransitioning = false; }
            if (lookUpProgress <= 0) { isLookingUp = false; lookUpTransitioning = false; }
        } else if (isLookingUp) {
            camera.lookAt(0, 0, CAMERA_R + 50);
        } else if (lookUpTransitioning12) {
            lookUpProgress12 = Math.max(0, Math.min(1, lookUpProgress12 + 0.018 * lookUpDirection12));
            const ease12 = easeInOutCubic(lookUpProgress12);
            camera.lookAt(0, ease12 * SLIDE12_LAY, ease12 * SLIDE12_LAZ);
            if (lookUpProgress12 >= 1) {
                isLookingUp12 = true;
                lookUpTransitioning12 = false;
            }
            if (lookUpProgress12 <= 0) {
                isLookingUp12 = false;
                lookUpTransitioning12 = false;
                if (questionGroup) questionGroup.visible = false;
            }
        } else if (isLookingUp12) {
            camera.lookAt(0, SLIDE12_LAY, SLIDE12_LAZ);
        } else {
            camera.position.copy(CAMERA_POS_NORMAL);
            camera.lookAt(CAMERA_LOOK_NORMAL);
        }

        if (questionGroup && questionGroup.visible) {
            const t = performance.now() * 0.001;
            questionGroup.children.forEach(letter => {
                const { baseX, baseY, phase } = letter.userData;
                letter.position.x = baseX + Math.sin(t * 0.9 + phase) * 0.12;
                letter.position.y = baseY + Math.sin(t * 0.5 + phase * 1.4) * 0.07;
                letter.rotation.z = Math.sin(t * 0.6 + phase) * 0.04;
            });
        }

        // ─── Animation avion slide 12 ───
        if (planeActive && planeGroup) {
            planeProgress += PLANE_SPEED;

            // Trajectoire : X de -65 à +65, Y=37 (remonté), Z=-10, légère courbe
            const px = -65 + planeProgress * 130;
            const py = 37 + Math.sin(planeProgress * Math.PI) * 1.5;
            const pz = -10;

            // N'afficher l'avion que quand il est dans le champ de la caméra
            planeGroup.visible = (px > -55 && px < 55);
            if (planeGroup.visible) {
                planeGroup.position.set(px, py, pz);
                planeGroup.rotation.z = -0.08;
            }

            // Mise à jour traînée : décalage du buffer (aAge est statique, inutile de le maj)
            const pos = contrailGeo.attributes.position.array;
            for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
                pos[i * 3]     = pos[(i - 1) * 3];
                pos[i * 3 + 1] = pos[(i - 1) * 3 + 1];
                pos[i * 3 + 2] = pos[(i - 1) * 3 + 2];
            }
            // Émettre depuis l'arrière du fuselage
            pos[0] = px - 3.2 + (Math.random() - 0.5) * 0.5;
            pos[1] = py       + (Math.random() - 0.5) * 0.6;
            pos[2] = pz       + (Math.random() - 0.5) * 0.5;

            // Billowing : les vieilles particules dérivent (tourbillonnement naturel)
            for (let i = 5; i < TRAIL_LENGTH; i++) {
                pos[i * 3 + 1] += (Math.random() - 0.5) * 0.022;
                pos[i * 3 + 2] += (Math.random() - 0.5) * 0.014;
            }

            contrailGeo.attributes.position.needsUpdate = true;
            contrailMat.uniforms.uGlobalOpacity.value = 0.85;

            // Fin du passage : l'avion disparaît mais la traînée reste visible
            if (planeProgress >= 1) {
                planeActive      = false;
                contrailActive   = true;
                contrailFadeTime = 0;
                planeGroup.visible = false;
            }
        }

        // Dissipation dynamique : le buffer continue de se décaler après le départ de l'avion
        // → la traînée se "vide" naturellement depuis l'avant (côté récent) vers l'arrière
        if (contrailActive && contrailMat && contrailGeo) {
            contrailFadeTime++;
            const t = contrailFadeTime / CONTRAIL_FADE_FRAMES;

            const pos = contrailGeo.attributes.position.array;

            // Continuer à shifter le buffer : injecter hors-champ à l'index 0
            for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
                pos[i * 3]     = pos[(i - 1) * 3];
                pos[i * 3 + 1] = pos[(i - 1) * 3 + 1];
                pos[i * 3 + 2] = pos[(i - 1) * 3 + 2];
            }
            pos[0] = -9999; pos[1] = -9999; pos[2] = -9999;

            // Billowing : les particules encore visibles continuent de se disperser
            for (let i = 5; i < TRAIL_LENGTH; i++) {
                pos[i * 3 + 1] += (Math.random() - 0.5) * 0.025;
                pos[i * 3 + 2] += (Math.random() - 0.5) * 0.016;
            }

            contrailGeo.attributes.position.needsUpdate = true;

            // Fondu easeIn : lent au début, s'accélère vers la fin
            contrailMat.uniforms.uGlobalOpacity.value = Math.max(0, 0.85 * (1 - t * t));

            if (contrailFadeTime >= CONTRAIL_FADE_FRAMES) {
                contrailActive = false;
                contrailPoints.visible = false;
            }
        }
    }

    renderer.render(scene, camera);
}

// ─── 13. RESIZE ───
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (contrailMat) contrailMat.uniforms.uScreenH.value = window.innerHeight;
});

animate();
