import * as THREE from 'three';
// RoomEnvironment retiré – remplacé par HDRI
// Sky addon retiré – on utilise une HDRI à la place
import { Water } from 'three/addons/objects/Water.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// ─── 1. INITIALISATION DE LA SCÈNE ET DU MOTEUR DE RENDU ───
const scene = new THREE.Scene();

// Atmosphère : brouillard très léger (linéaire pour plus de contrôle) + couleur ciel
const skyColor = new THREE.Color('#c8dce8');
scene.fog = new THREE.Fog(new THREE.Color('#e8d8c0'), 120, 450); // Brume chaude dorée

// Caméra légèrement plus proche pour que le mur soit imposant, tout en gardant une marge (était à 14.0, on passe à 11.5)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 11.5); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.4; // Plus lumineux + contraste ACES naturel

// Réactivation des ombres douces pour mieux voir le sol
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// Contrôles caméra libre (temporaire) : touche C pour basculer mode exploration
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enabled = false;
orbitControls.target.set(0, -2, -100);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.minDistance = 2;
orbitControls.maxDistance = 500;
orbitControls.maxPolarAngle = Math.PI * 0.48;
let freeCameraMode = false;

// ─── 2. ÉCLAIRAGE ET ENVIRONNEMENT ───
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Chargement HDRI pour le ciel + éclairage environnemental (IBL)
const hdriLoader = new EXRLoader();
hdriLoader.load('assets/trees/citrus_orchard_puresky_4k.exr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;

    // Appliquer comme fond de scène (le vrai ciel)
    scene.background = texture;

    // Générer l'environnement IBL pour les reflets/éclairage indirect
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;

    pmremGenerator.dispose();
});

// Lumière ambiante : ciel chaud en haut, terre chaude en bas
const ambientLight = new THREE.HemisphereLight(0xffeebb, 0x886633, 1.0);
scene.add(ambientLight);

// Lumière directionnelle forte – soleil doré de fin d'après-midi
const dirLight = new THREE.DirectionalLight(0xffd280, 5.0);
dirLight.position.set(20, 25, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.bias = -0.0005;
dirLight.shadow.radius = 4;
scene.add(dirLight);

scene.add(dirLight.target);

// ─── 3. LE DÉCOR NATUREL (SOL, RUISSEAU, VÉGÉTATION) ───

// A. Texture de Sol Naturel – textures réalistes (coast_sand_rocks_02)
const textureLoader = new THREE.TextureLoader();
const exrLoader = new EXRLoader();

const groundColor = textureLoader.load('assets/trees/textures/coast_sand_rocks_02_diff_4k.jpg');
groundColor.wrapS = THREE.RepeatWrapping;
groundColor.wrapT = THREE.RepeatWrapping;
groundColor.repeat.set(15, 75);
groundColor.colorSpace = THREE.SRGBColorSpace;

// Matériau de base (les EXR seront ajoutés de manière asynchrone)
const groundMat = new THREE.MeshStandardMaterial({
    map: groundColor,
    roughness: 0.85,
    metalness: 0.0,
});

// Chargement asynchrone des textures EXR (normal + roughness)
exrLoader.load('assets/trees/textures/coast_sand_rocks_02_nor_gl_4k.exr', (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(15, 75);
    groundMat.normalMap = tex;
    groundMat.normalScale.set(0.8, 0.8);
    groundMat.needsUpdate = true;
});

exrLoader.load('assets/trees/textures/coast_sand_rocks_02_rough_4k.exr', (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(15, 75);
    groundMat.roughnessMap = tex;
    groundMat.needsUpdate = true;
});

// Sol cabossé + sillon réaliste pour la rivière (lit creusé en forme de vallée)
const groundSegmentsX = 120;
const groundSegmentsY = 200;
const floorGeo = new THREE.PlaneGeometry(300, 1000, groundSegmentsX, groundSegmentsY);
const floorPos = floorGeo.attributes.position;
const floorGroundY = -4.0;
const floorGroundZ = -200;
const riverCenterX = (worldZ) => -25 + 8 * Math.sin(0.02 * (-200 - worldZ));
const riverHalfWidth = 10;
const trenchDepth = 2.2;
const trenchSlope = 4;

// Fonction réutilisable : calcule le bump (décalage Y) du terrain à une position monde (worldX, worldZ)
function getTerrainBump(worldX, worldZ) {
    const localY = -(worldZ - floorGroundZ); // inverse de worldZ = floorGroundZ - localY
    const nx = Math.abs(worldX) / 150;
    const edgeFactor = Math.max(0, nx - 0.15) + Math.max(0, 1 - nx - 0.15);
    const noise = Math.sin(worldX * 0.05) * 0.8 + Math.sin(localY * 0.03) * 0.6
        + Math.sin((worldX + localY) * 0.04) * 0.5;
    let bump = edgeFactor * noise * 2.5;

    // Aplatir près des slides (zone large et agressive)
    let flattenFactor = 1.0;
    for (let s = 0; s < 10; s++) {
        const slideZ = -s * 20;
        const dz = Math.abs(worldZ - slideZ);
        const dx = Math.abs(worldX);
        if (dx < 12 && dz < 8) {
            const fz = Math.max(0, 1 - dz / 8);
            const fx = Math.max(0, 1 - dx / 12);
            const f = fz * fx;
            flattenFactor = Math.min(flattenFactor, 1 - f * f); // quadratique = plus plat au centre
        }
    }
    bump *= flattenFactor;

    const centerX = riverCenterX(worldZ);
    const distToRiver = Math.abs(worldX - centerX);
    if (distToRiver < riverHalfWidth + trenchSlope) {
        const t = Math.max(0, 1 - distToRiver / riverHalfWidth);
        const smooth = t * t * (3 - 2 * t);
        const slopeZone = Math.max(0, 1 - (distToRiver - riverHalfWidth) / trenchSlope);
        const valleyDepth = trenchDepth * smooth + trenchDepth * 0.15 * slopeZone * (1 - smooth);
        bump += valleyDepth;
    }
    return bump;
}

for (let i = 0; i < floorPos.count; i++) {
    const x = floorPos.getX(i);
    const localY = floorPos.getY(i);
    const worldX = x;
    const worldZ = floorGroundZ - localY;
    const bump = getTerrainBump(worldX, worldZ);
    floorPos.setZ(i, floorPos.getZ(i) + bump);
}
floorGeo.computeVertexNormals();

const floor = new THREE.Mesh(floorGeo, groundMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -4.0, -200); 
floor.receiveShadow = true;
scene.add(floor);

// B. Rivière sinueuse avec shader Water (reflets, vagues, normales)
const streamGeo = new THREE.PlaneGeometry(12, 1000, 32, 100);
const streamPos = streamGeo.attributes.position;
for (let i = 0; i < streamPos.count; i++) {
    const y = streamPos.getY(i);
    streamPos.setX(i, streamPos.getX(i) + Math.sin(y * 0.02) * 8.0);
}
streamGeo.computeVertexNormals();

function createWaterNormalMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const nx = (Math.sin(x * 0.3) * Math.cos(y * 0.2) + 1) * 0.5 * 255;
            const ny = (Math.sin((x + y) * 0.15) + 1) * 0.5 * 255;
            const nz = 200;
            imgData.data[i] = nx;
            imgData.data[i + 1] = ny;
            imgData.data[i + 2] = nz;
            imgData.data[i + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const waterNormals = createWaterNormalMap();
const sunDirection = new THREE.Vector3(15, 20, 15).normalize();
const stream = new Water(streamGeo, {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: waterNormals,
    sunDirection: sunDirection,
    sunColor: 0xffffff,
    waterColor: 0x1a5276,
    distortionScale: 15,
    fog: true
});
stream.rotation.x = -Math.PI / 2;
stream.position.set(-25, floorGroundY - trenchDepth + 0.15, -200);
scene.add(stream);

// C. Herbe en GPU instancing (brins d'herbe) - OPTIMISÉE PAR CHUNKS
function createGrassBladeGeometry() {
    // Blade standing upright in Y: base at y=0, tip at y=h
    const h = 0.4;
    const w = 0.04;
    const vertices = new Float32Array([
        // Triangle 1: left base -> tip -> right base
        -w * 0.5, 0, 0,
        -w * 0.3, h * 0.6, 0,
         0,        h * 1.05, 0,
        // Triangle 2: left base -> right mid -> tip
        -w * 0.5, 0, 0,
         0,        h * 1.05, 0,
         w * 0.3,  h * 0.6, 0,
        // Triangle 3: left base -> right mid -> right base
        -w * 0.5, 0, 0,
         w * 0.3,  h * 0.6, 0,
         w * 0.5,  0, 0,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
}
const grassBladeGeo = createGrassBladeGeometry();

// Wind shader: inject vertex displacement into MeshStandardMaterial
const grassMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide
});

// We need a global time uniform for the wind
const grassWindUniforms = { uTime: { value: 0 } };

grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassWindUniforms.uTime;

    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`
    );

    // Vent cohérent : direction dominante (X+, légèrement Z+) avec vagues qui se propagent
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Position monde du brin (base)
        vec4 wPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

        // Facteur de hauteur : seul le haut du brin bouge (position.y va de 0 à ~0.42)
        float hf = clamp(position.y / 0.42, 0.0, 1.0);
        float hf2 = hf * hf; // quadratique = base bien ancrée, pointe libre

        // Direction dominante du vent : vers X+ avec léger Z+
        // Vague principale : grande onde qui traverse le champ
        float mainWave = sin(uTime * 1.2 - wPos.x * 0.08 - wPos.z * 0.05);
        // Seconde harmonique : ondulations plus rapides et fines
        float secondWave = sin(uTime * 2.8 - wPos.x * 0.2 + wPos.z * 0.12) * 0.3;
        // Rafale : variation lente d'intensité
        float gust = 0.7 + 0.3 * sin(uTime * 0.4 + wPos.x * 0.01 + wPos.z * 0.015);

        float windTotal = (mainWave + secondWave) * gust;

        // Déplacement : direction X dominante, Z secondaire (même sens pour tous les brins)
        transformed.x += windTotal * hf2 * 0.12;
        transformed.z += windTotal * hf2 * 0.04;`
    );
};

// --- HERBE : restreinte à la zone visible (corridor des slides) ---
// Slides vont de z=0 à z=-180. On couvre x: -35 à +35, z: +15 à -200
// Découpage en 10 chunks le long de Z pour un bon frustum culling
const GRASS_CHUNKS = 10;
const grassPerChunk = 6000; // 10 * 6000 = 60000 brins concentrés dans la zone utile

const grassAreaMinX = -35;
const grassAreaMaxX = 35;
const grassAreaMinZ = -200; // worldZ
const grassAreaMaxZ = 15;   // worldZ
const grassChunkDepth = (grassAreaMaxZ - grassAreaMinZ) / GRASS_CHUNKS;

const grassGroundY = -4.0;
const grassDummy = new THREE.Object3D();

const grassGroup = new THREE.Group();
scene.add(grassGroup);

for (let ci = 0; ci < GRASS_CHUNKS; ci++) {
    const chunkMesh = new THREE.InstancedMesh(grassBladeGeo, grassMat, grassPerChunk);
    chunkMesh.castShadow = false;
    chunkMesh.receiveShadow = true;

    const chunkZMax = grassAreaMaxZ - ci * grassChunkDepth;
    const chunkZMin = chunkZMax - grassChunkDepth;

    let idx = 0;
    let attempts = 0;
    while (idx < grassPerChunk && attempts < grassPerChunk * 5) {
        attempts++;
        const wx = THREE.MathUtils.randFloat(grassAreaMinX, grassAreaMaxX);
        const wz = THREE.MathUtils.randFloat(chunkZMin, chunkZMax);

        // Exclusion : empreinte exacte des slides (rectangle ~15 x 2 centré en x=0)
        let onSlide = false;
        for (let s = 0; s < 10; s++) {
            const slideZ = -s * 20;
            if (Math.abs(wx) < 7.5 && Math.abs(wz - slideZ) < 1.2) {
                onSlide = true;
                break;
            }
        }
        if (onSlide) continue;

        // Échantillonner la hauteur du terrain à cette position
        const terrainBump = getTerrainBump(wx, wz);
        // Le sol PlaneGeometry est à Y = floorGroundY, le bump est appliqué via setZ → traduit en Y monde
        // La PlaneGeometry est pivotée de -PI/2 autour de X, donc Z local → Y monde
        const groundY = grassGroundY + terrainBump;

        // Variété de taille : petits brins fréquents, quelques grands brins
        const sizeRand = Math.random();
        let scale;
        if (sizeRand < 0.35) scale = 1.5 + Math.random() * 1.5;       // petits
        else if (sizeRand < 0.75) scale = 3.0 + Math.random() * 2.0;   // moyens
        else scale = 5.0 + Math.random() * 3.5;                         // grands

        grassDummy.position.set(wx, groundY, wz);
        grassDummy.rotation.set(
            (Math.random() - 0.5) * 0.12, // léger penchant X
            Math.random() * Math.PI * 2,    // rotation Y aléatoire
            0
        );
        grassDummy.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale);
        grassDummy.updateMatrix();

        chunkMesh.setMatrixAt(idx, grassDummy.matrix);
        idx++;
    }

    chunkMesh.count = idx;
    chunkMesh.instanceMatrix.needsUpdate = true;
    chunkMesh.computeBoundingSphere();

    grassGroup.add(chunkMesh);
}

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

// ─── 4.ter EFFETS SPÉCIAUX (PARTICULES DE FUMÉE) ───
const smokeParticles = [];
const smokeGeo = new THREE.SphereGeometry(1, 7, 7);
const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
});

function triggerSmoke(x, y, z) {
    for (let i = 0; i < 15; i++) {
        const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
        p.position.set(
            x + (Math.random() - 0.5) * 4,
            y + Math.random() * 2,
            z + (Math.random() - 0.5) * 4
        );
        p.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
        
        const scale = 1 + Math.random() * 2;
        p.scale.set(scale, scale, scale);
        
        p.userData = {
            velocityX: (Math.random() - 0.5) * 0.2,
            velocityY: 0.1 + Math.random() * 0.2,
            velocityZ: (Math.random() - 0.5) * 0.2,
            life: 1.0
        };
        
        scene.add(p);
        smokeParticles.push(p);
    }
}

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
    const t = clock.getElapsedTime();

    // Update grass wind shader time
    grassWindUniforms.uTime.value = t;

    // La lumière avance globalement avec la caméra
    dirLight.position.z += ((camera.position.z + 3.5) - dirLight.position.z) * 0.1;
    dirLight.target.position.z = dirLight.position.z - 15.0;
    // (HDRI gère le ciel, plus besoin de synchroniser skyUniforms)

    // Animation du shader d'eau (vagues, reflets)
    if (stream.material && stream.material.uniforms && stream.material.uniforms['time'])
        stream.material.uniforms['time'].value = t;

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
            activeSlide.position.y = -4.0 + jumpEase * 12.0; // Y base = -4.0
            
            // La caméra fonce tout droit (passe en dessous)
            camera.position.lerpVectors(startCamPos, targetCamPos, ease);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);

            if (transitionProgress === 1) {
                currentSlideIndex++;
                isAnimating = false;
            }
        }

        // --- TYPE 6 : LE LANCER (ÉJECTION HAUTE ET VISIBLE) ---
        else if (transitionType === 6 && transitionDirection === 1) {
            transitionProgress += 0.015; // Un peu plus rapide pour le dynamisme
            if (transitionProgress >= 1) transitionProgress = 1;
            
            // L'avancée linéaire du lancer
            const throwEase = easeInOutCubic(transitionProgress); 
            // La cloche de la parabole (0 au début, 1 au milieu, 0 à la fin)
            const parabola = Math.sin(transitionProgress * Math.PI); 
            
            // Position de base de la charnière de cette slide
            const baseZ = -(currentSlideIndex * slideSpacing) - 0.1;
            
            // Mouvement X : On l'envoie sur la droite, mais pas trop loin pour qu'il reste à l'écran (ex: 15 unités)
            activeSlide.position.x = throwEase * 18.0; 
            
            // Mouvement Y : Il part du sol (-4.0), s'envole très haut (+25 unités), et retombe
            activeSlide.position.y = -4.0 + (parabola * 25.0); 
            
            // Mouvement Z : Il recule pour atterrir à côté de la PROCHAINE slide
            // La prochaine slide est à `baseZ - 20`. On le fait atterrir à `baseZ - 18` (juste un peu devant).
            activeSlide.position.z = baseZ - (throwEase * 18.0);
            
            // Rotations folles
            activeSlide.rotation.x = throwEase * Math.PI * 4; 
            activeSlide.rotation.y = throwEase * Math.PI * 3;
            activeSlide.rotation.z = throwEase * Math.PI * 1.5;

            // Caméra avance pour aller voir la prochaine slide
            const camEase = easeInOutCubic(transitionProgress);
            camera.position.lerpVectors(startCamPos, targetCamPos, camEase);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, camEase);
            
            if (transitionProgress === 1) {
                // Impact final
                activeSlide.position.y = -4.0; // S'assure qu'il est parfaitement au sol
                
                shakeIntensity = 0.8; // Gros impact !
                shakeTime = 30;
                
                // Déclencher la fumée aux coordonnées exactes de l'impact
                triggerSmoke(activeSlide.position.x, -4.0, activeSlide.position.z);
                
                currentSlideIndex++;
                isAnimating = false;
            }
        }
        
        // --- TYPE 99 : REMBOBINAGE (RETOUR UNIVERSEL) ---
        else if (transitionType === 99 && transitionDirection === -1) {
            transitionProgress += 0.03; 
            if (transitionProgress >= 1) transitionProgress = 1;
            
            const ease = easeInOutCubic(transitionProgress);
            camera.position.lerpVectors(startCamPos, targetCamPos, ease);
            currentLookAt.lerpVectors(startLookAt, targetLookAt, ease);
            
            const targetSlide = slides[currentSlideIndex];
            
            // Base Z de la slide
            const baseZ = -(currentSlideIndex * slideSpacing) - 0.1;

            // Retour magique à la position 0 stricte
            targetSlide.rotation.x += (0 - targetSlide.rotation.x) * 0.15;
            targetSlide.rotation.y += (0 - targetSlide.rotation.y) * 0.15;
            targetSlide.rotation.z += (0 - targetSlide.rotation.z) * 0.15;
            targetSlide.position.x += (0 - targetSlide.position.x) * 0.15;
            targetSlide.position.y += (-4.0 - targetSlide.position.y) * 0.15;
            targetSlide.position.z += (baseZ - targetSlide.position.z) * 0.15;
            
            if (transitionProgress === 1) {
                targetSlide.rotation.set(0,0,0);
                targetSlide.position.set(0, -4.0, baseZ);
                
                shakeIntensity = 0.1; 
                shakeTime = 10;
                isAnimating = false;
            }
        }
    }

    // Animation des particules de fumée
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.position.x += p.userData.velocityX;
        p.position.y += p.userData.velocityY;
        p.position.z += p.userData.velocityZ;
        
        p.scale.x *= 1.02;
        p.scale.y *= 1.02;
        p.scale.z *= 1.02;
        
        p.material.opacity -= 0.015;
        p.userData.life -= 0.015;
        
        if (p.userData.life <= 0) {
            scene.remove(p);
            smokeParticles.splice(i, 1);
        }
    }

    // Effet Camera Shake
    if (shakeTime > 0) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= 0.9; 
        shakeTime--;
    }
    
    // Application finale du LookAt (désactivé en mode caméra libre)
    if (orbitControls.enabled) {
        orbitControls.update();
    } else {
        camera.lookAt(currentLookAt);
    }
    
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();