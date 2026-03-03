import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// ─── CONSTANTES DU PRISME ───
const NUM_SLIDES = 10;
const FACE_ANGLE = (2 * Math.PI) / NUM_SLIDES;
// On part de la largeur de face souhaitée (format slide paysage ~16:9)
const FACE_WIDTH = 10;
const PRISM_HEIGHT = 5.6;
// Rayon déduit pour que chaque face ait exactement FACE_WIDTH de large
const PRISM_RADIUS = FACE_WIDTH / (2 * Math.sin(FACE_ANGLE / 2));
const APOTHEM = PRISM_RADIUS * Math.cos(FACE_ANGLE / 2);

// ─── 1. SCÈNE, CAMÉRA, RENDERER ───
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, APOTHEM + 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── 2. ORBIT CONTROLS (DEBUG) ───
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enabled = true;
orbitControls.target.set(0, 0, 0);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.minDistance = 2;
orbitControls.maxDistance = 500;
let freeCameraMode = true;

// ─── 3. ÉCLAIRAGE ET ENVIRONNEMENT ───
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// HDRI pour IBL et affichage en arrière-plan
const hdriLoader = new EXRLoader();
hdriLoader.load('assets/qwantani_dusk_2_puresky_4k.exr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();
});

// SpotLight principal (éclairage théâtre) — decay=0 (pas d'atténuation par distance)
const spotLight = new THREE.SpotLight(0xffe8d0, 150);
spotLight.position.set(0, 18, APOTHEM + 12);
spotLight.angle = Math.PI / 4;
spotLight.penumbra = 0.5;
spotLight.decay = 0;
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(2048, 2048);
spotLight.target.position.set(0, 0, 0);
scene.add(spotLight);
scene.add(spotLight.target);

// Ambient faible pour les faces non éclairées
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);

// ─── 4. MATÉRIAU ONYX PBR ───
const texLoader = new THREE.TextureLoader();
const onyxColor = texLoader.load('assets/Onyx013_8K-PNG/Onyx013_8K-PNG_Color.png');
onyxColor.colorSpace = THREE.SRGBColorSpace; // Interprétation correcte des couleurs sombres
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
    envMapIntensity: 3.0
});

// ─── 5. PRISME CENTRAL ───
const prismGeo = new THREE.CylinderGeometry(PRISM_RADIUS, PRISM_RADIUS, PRISM_HEIGHT, NUM_SLIDES);
const prism = new THREE.Mesh(prismGeo, prismMaterial);
prism.rotation.y = -FACE_ANGLE / 2; // Face 0 pointe vers +Z (caméra)
prism.castShadow = true;
prism.receiveShadow = true;
scene.add(prism);

// ─── 6. TEXTE 3D SUR CHAQUE FACE ───
const textSolidMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    roughness: 0.2,
    metalness: 0.8,
    envMapIntensity: 2.0
});

const loader = new FontLoader();
loader.load('https://unpkg.com/three@0.162.0/examples/fonts/helvetiker_bold.typeface.json', function (font) {
    for (let i = 0; i < NUM_SLIDES; i++) {
        const angle = i * FACE_ANGLE;
        const faceGroup = new THREE.Group();

        // Position sur la face extérieure du prisme
        faceGroup.position.set(
            APOTHEM * Math.sin(angle),
            0,
            APOTHEM * Math.cos(angle)
        );
        // Rotation pour que le texte fasse face vers l'extérieur
        faceGroup.rotation.y = angle;
        // Petit offset pour éviter le z-fighting
        faceGroup.translateZ(0.05);

        const titleText = `SLIDE ${i + 1}`;
        const subtitleText = `AI Ethics vs Security`;

        // Titre
        addTextToFace(faceGroup, titleText, 0.45, 1.2, font);
        // Sous-titre
        addTextToFace(faceGroup, subtitleText, 0.18, -0.5, font);

        prism.add(faceGroup);
    }
});

function addTextToFace(parent, text, size, yOffset, font) {
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

    const textMesh = new THREE.Mesh(textGeo, textSolidMaterial);
    textMesh.castShadow = true;
    // Centrer horizontalement sur la face
    textMesh.position.set(-textWidth / 2, yOffset, 0);

    const edges = new THREE.EdgesGeometry(textGeo);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const outlineLines = new THREE.LineSegments(edges, lineMaterial);
    textMesh.add(outlineLines);

    parent.add(textMesh);
}

// ─── 7. SYSTÈME DE ROTATION (TRANSITIONS) ───
let currentSlideIndex = 0;
let isAnimating = false;
let transitionProgress = 0;
let currentPrismAngle = -FACE_ANGLE / 2; // Angle initial (face 0 vers caméra)
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

// ─── 8. CONTRÔLES CLAVIER ───
window.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') {
        freeCameraMode = !freeCameraMode;
        orbitControls.enabled = freeCameraMode;
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

// ─── 9. BOUCLE D'ANIMATION ───
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

// ─── 10. RESIZE ───
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
