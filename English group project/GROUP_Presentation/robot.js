/**
 * ARIA — Animated Robot Intelligence Avatar
 * Robot mascot for the AI & Science Fiction presentation
 * Powered by GSAP 3
 */

(function () {
    'use strict';

    function init() {
        if (typeof gsap === 'undefined') {
            setTimeout(init, 100);
            return;
        }

        const aria           = document.getElementById('aria');
        const ariaBody       = document.getElementById('aria-body');
        const eyeLeft        = document.getElementById('aria-eye-left');
        const eyeRight       = document.getElementById('aria-eye-right');
        const ariaEyes       = document.getElementById('aria-eyes');
        const pupilLeft      = document.getElementById('aria-pupil-left');
        const pupilRight     = document.getElementById('aria-pupil-right');
        const armLeft        = document.getElementById('aria-arm-left');
        const armRight       = document.getElementById('aria-arm-right');
        const ariaGlow       = document.getElementById('aria-glow');
        const robotContainer = document.getElementById('robot-container');

        if (!aria) return;

        // ── Position helpers ──────────────────────────────────────────────
        const ARM_ORIGIN = '50% 0%';
        const ROB_W = 130; // largeur robot (px)
        const ROB_H = 182; // hauteur robot (px)

        function vw() { return window.innerWidth; }
        function vh() { return window.innerHeight; }

        // Géométrie de la carte slide (centrée, max-width 900px, padding latéral ≈ 96px)
        function cardLeft()  { return (vw() - Math.min(vw() - 192, 900)) / 2; }
        function cardRight() { return vw() - cardLeft(); }
        function cardBotY()  { return vh() * 0.82; }  // bas approximatif de la carte
        function cardTopY()  { return vh() * 0.13; }  // haut approximatif de la carte

        // Positions d'ancrage — à l'extérieur des bords de la carte slide
        function restPos()      { return { x: Math.min(vw() - ROB_W - 10, cardRight() + 8), y: cardBotY() - ROB_H + 25 }; } // Bas-droite (hors carte)
        function restPosLeft()  { return { x: Math.max(10, cardLeft() - ROB_W - 8),          y: cardBotY() - ROB_H + 25 }; } // Bas-gauche (hors carte)
        function bottomCenter() { return { x: vw() / 2 - ROB_W / 2,                          y: cardBotY() - ROB_H + 25 }; } // Bas-centre
        function topRight()     { return { x: Math.min(vw() - ROB_W - 10, cardRight() + 8),  y: cardTopY() - 20          }; } // Haut-droite (hors carte)
        function topLeft()      { return { x: Math.max(10, cardLeft() - ROB_W - 8),           y: cardTopY() - 20          }; } // Haut-gauche (hors carte)
        function offRight()     { return { x: vw() + 60,       y: cardBotY() - ROB_H + 25 }; }
        function offLeft()      { return { x: -ROB_W - 20,     y: cardBotY() - ROB_H + 25 }; }

        const ANCHORS = [restPos, restPosLeft, bottomCenter, topRight, topLeft];
        let currentAnchor = restPos;

        // Zone de la carte slide (utilisée pour le passage derrière)
        function slideZoneL()   { return cardLeft(); }
        function slideZoneR()   { return cardRight(); }

        // ── Gestion des couches ────────────
        function setLayer(behind) {
            robotContainer.classList.toggle('robot-behind', behind);
        }

        // Place off-screen on the right initially
        gsap.set(aria, { x: offRight().x, y: offRight().y });

        // ── Idle (float + blink + look) ──────────────
        let idleTweens = [];
        let blinkTimer = null;
        let lookTimer  = null;
        let lookTween  = null;

        function startIdle() {
            stopIdle();
            idleTweens.push(
                gsap.to(ariaBody, { y: '+=6', duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
                gsap.to(ariaBody, { rotation: 2, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
                gsap.to(ariaGlow, { opacity: 0.3, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
            );
            scheduleBlink();
            scheduleLookAround();
            scheduleLifeEvent();
        }

        function stopIdle() {
            idleTweens.forEach(t => t.kill());
            idleTweens = [];
            if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }
            if (lookTimer)  { clearTimeout(lookTimer); lookTimer = null; }
            if (lookTween)  { lookTween.kill(); lookTween = null; }
            stopLifeEvent();
        }

        function blink() {
            const doubleBlink = Math.random() > 0.7; // 30% chance of double blink
            const tl = gsap.timeline();
            const eyes = [eyeLeft, eyeRight, pupilLeft, pupilRight];
            
            tl.to(eyes, { scaleY: 0.08, duration: 0.07, ease: 'power2.in',  transformOrigin: '50% 50%' })
              .to(eyes, { scaleY: 1,    duration: 0.10, ease: 'power2.out', transformOrigin: '50% 50%' });
            
            if (doubleBlink) {
                tl.to(eyes, { scaleY: 0.08, duration: 0.07, ease: 'power2.in', transformOrigin: '50% 50%' }, "+=0.05")
                  .to(eyes, { scaleY: 1,    duration: 0.10, ease: 'power2.out', transformOrigin: '50% 50%' });
            }
            scheduleBlink();
        }
        function scheduleBlink() {
            blinkTimer = setTimeout(blink, 2500 + Math.random() * 3500);
        }

        // ── Look Around (Suivi du regard) ────────────────────────────────
        // File d'attente cyclique sur les zones de la slide active
        let lookQueue = [];
        let lookQueueIndex = 0;

        // Identifie les ~4-5 zones principales de la slide : titre + zones du grid
        function buildLookTargets() {
            const activeContent = document.querySelector('.slide.active .slide-content');
            if (!activeContent) return [];

            const targets = [];
            const slideBody = activeContent.querySelector('.slide-body');

            if (slideBody) {
                // Éléments avant le slide-body (titre, sous-titre, tags…)
                Array.from(activeContent.children).forEach(child => {
                    if (child !== slideBody) targets.push(child);
                });
                // Zones directes du grid (les "morceaux" de la slide)
                Array.from(slideBody.children).forEach(child => targets.push(child));
            } else {
                // Slides sans grid : titre + paragraphes principaux
                activeContent.querySelectorAll('h1, h2, h3, p, li, img, .figure-box, .highlight-box')
                    .forEach(el => targets.push(el));
            }

            return targets.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 20 && rect.height > 20 &&
                       parseFloat(getComputedStyle(el).opacity) > 0.1;
            });
        }

        function scheduleLookAround() {
            lookTimer = setTimeout(doLookAround, 700 + Math.random() * 900);
        }

        function doLookAround() {
            lookTimer = null;
            if (!ariaEyes) { scheduleLookAround(); return; }

            // Reconstruction de la file à chaque nouveau cycle
            if (lookQueueIndex >= lookQueue.length) {
                lookQueue = buildLookTargets();
                lookQueueIndex = 0;
                // Légère permutation pour varier l'ordre à chaque tour
                for (let i = lookQueue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [lookQueue[i], lookQueue[j]] = [lookQueue[j], lookQueue[i]];
                }
            }

            const targetElement = lookQueue.length > 0 ? lookQueue[lookQueueIndex++] : null;

            const maxEyeMoveX = 7;
            const maxEyeMoveY = 5;
            let moveX = 0;
            let moveY = 0;

            if (targetElement) {
                const tRect   = targetElement.getBoundingClientRect();
                const tX      = tRect.left + tRect.width  / 2;
                const tY      = tRect.top  + tRect.height / 2;

                const eRect   = ariaEyes.getBoundingClientRect();
                const eX      = eRect.left + eRect.width  / 2;
                const eY      = eRect.top  + eRect.height / 2;

                const dx = tX - eX;
                const dy = tY - eY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    // Pleine amplitude : les yeux indiquent clairement la direction
                    moveX = (dx / dist) * maxEyeMoveX;
                    moveY = (dy / dist) * maxEyeMoveY;
                }
            }

            const dur = 0.25 + Math.random() * 0.2; // 0.25–0.45 s (rapide et précis)

            lookTween = gsap.timeline({ onComplete: scheduleLookAround })
                // ariaEyes group : déplace ensemble yeux + pupilles
                .to(ariaEyes, { x: moveX, y: moveY, duration: dur, ease: 'power3.out' }, 0)
                // Pupilles : décalage supplémentaire dans la même direction (profondeur)
                .to([pupilLeft, pupilRight], { x: moveX * 0.6, y: moveY * 0.6, duration: dur * 0.85, ease: 'power3.out' }, 0);
        }

        // Réinitialise la file quand la slide change
        document.addEventListener('slidechange', () => {
            lookQueue = [];
            lookQueueIndex = 0;
        });

        // ── Life Engine — Actions et Mouvements Aléatoires ────────────
        let lifeTimer = null;
        let lifeTl    = null;

        function scheduleLifeEvent() {
            lifeTimer = setTimeout(doLifeEvent, 8000 + Math.random() * 7000);
        }

        function stopLifeEvent() {
            if (lifeTimer) { clearTimeout(lifeTimer); lifeTimer = null; }
            if (lifeTl)    { lifeTl.kill(); lifeTl = null; }
        }

        function doLifeEvent() {
            lifeTimer = null;
            // Interrompre temporairement les animations idle "passives"
            idleTweens.forEach(t => t.kill());
            idleTweens = [];
            if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }
            if (lookTimer)  { clearTimeout(lookTimer); lookTimer = null; }
            if (lookTween)  { lookTween.kill(); lookTween = null; }
            
            if (ariaEyes) gsap.to(ariaEyes, { x: 0, y: 0, duration: 0.4 });
            if (pupilLeft) gsap.to([pupilLeft, pupilRight], { x: 0, y: 0, duration: 0.4 });

            const events = ['curiousPeek', 'sleepy', 'hideAndSeek', 'happyBob', 'sneakyDash', 'stretch', 'lookAtCamera', 'dance'];
            const ev = events[Math.floor(Math.random() * events.length)];
            const eyes = [eyeLeft, eyeRight, pupilLeft, pupilRight];

            lifeTl = gsap.timeline({
                onComplete: () => {
                    lifeTl = null;
                    setLayer(false);
                    resetParts();
                    startIdle();
                }
            });

            if (ev === 'curiousPeek') {
                const otherAnchors = ANCHORS.filter(a => a !== currentAnchor);
                const targetAnchor = otherAnchors[Math.floor(Math.random() * otherAnchors.length)];

                lifeTl.add(walkTo(targetAnchor, 1.4))
                      .to(aria, { scale: 1.12, duration: 0.4, ease: 'back.out(1.5)', transformOrigin: '50% 100%' })
                      .to(ariaEyes, { x: 7, duration: 0.3, ease: 'power1.inOut' })
                      .to(ariaEyes, { x: -7, duration: 0.4, ease: 'power1.inOut', delay: 0.2 })
                      .to(ariaEyes, { x: 0, duration: 0.3, ease: 'power1.inOut', delay: 0.2 })
                      .to(aria, { scale: 1, duration: 0.4, ease: 'power2.inOut', delay: 0.2 });

            } else if (ev === 'sleepy') {
                lifeTl.to(aria, { y: '+=15', duration: 0.8, ease: 'sine.inOut' })
                      .to(eyes, { scaleY: 0.3, duration: 0.8, transformOrigin: '50% 50%' }, '<')
                      .to(armLeft, { rotation: -15, duration: 0.8, transformOrigin: ARM_ORIGIN }, '<')
                      .to(armRight, { rotation: 15, duration: 0.8, transformOrigin: ARM_ORIGIN }, '<')
                      .to({}, { duration: 3.5 }) // Wait and sleep
                      .to(aria, { x: '+=4', duration: 0.05, repeat: 5, yoyo: true }) // Wake up shake
                      .to(aria, { y: '-=15', duration: 0.3, ease: 'power2.out' }, '>')
                      .to(eyes, { scaleY: 1.2, duration: 0.15, transformOrigin: '50% 50%' }, '<')
                      .to(eyes, { scaleY: 1, duration: 0.2, transformOrigin: '50% 50%' }, '>')
                      .to([armLeft, armRight], { rotation: 0, duration: 0.3, transformOrigin: ARM_ORIGIN }, '<');

            } else if (ev === 'hideAndSeek') {
                const otherAnchors = ANCHORS.filter(a => a !== currentAnchor);
                const targetAnchor = otherAnchors[Math.floor(Math.random() * otherAnchors.length)];
                
                lifeTl.to(aria, { y: vh() + 20, duration: 0.6, ease: 'back.in(1.2)' }) // Drop out of screen
                      .set(aria, { x: targetAnchor().x })
                      .to({}, { duration: 1.5 }) // Wait hidden
                      .to(aria, { y: targetAnchor().y, duration: 1.0, ease: 'back.out(1.2)' });
                currentAnchor = targetAnchor;

            } else if (ev === 'happyBob') {
                lifeTl
                      // Saut 1
                      .to(aria, { y: '-=25', duration: 0.22, ease: 'power2.out' })
                      .to(aria, { y: '+=25', duration: 0.22, ease: 'bounce.out' })
                      .to(ariaBody, { scaleY: 0.82, scaleX: 1.12, duration: 0.07, transformOrigin: '50% 100%' }, '-=0.07')
                      .to(ariaBody, { scaleY: 1, scaleX: 1, duration: 0.18, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
                      // Saut 2
                      .to(aria, { y: '-=15', duration: 0.18, ease: 'power2.out' })
                      .to(aria, { y: '+=15', duration: 0.22, ease: 'bounce.out' })
                      .to(ariaBody, { scaleY: 0.88, scaleX: 1.07, duration: 0.06, transformOrigin: '50% 100%' }, '-=0.06')
                      .to(ariaBody, { scaleY: 1, scaleX: 1, duration: 0.15, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
                      // Bras et clignements joyeux (depuis le début de la timeline)
                      .to(armLeft,  { rotation: -45, duration: 0.2, yoyo: true, repeat: 3, transformOrigin: ARM_ORIGIN }, 0)
                      .to(armRight, { rotation:  45, duration: 0.2, yoyo: true, repeat: 3, transformOrigin: ARM_ORIGIN }, 0)
                      .to(eyes, { scaleY: 0.2, duration: 0.1, yoyo: true, repeat: 3, transformOrigin: '50% 50%' }, 0);

            } else if (ev === 'sneakyDash') {
                const bottomAnchors = [restPos, restPosLeft, bottomCenter];
                const otherBottom = bottomAnchors.filter(a => a !== currentAnchor);
                const targetAnchor = otherBottom[Math.floor(Math.random() * otherBottom.length)];
                const pos = targetAnchor();
                const currX = parseFloat(gsap.getProperty(aria, 'x'));
                const leanDir = pos.x > currX ? -15 : 15;

                lifeTl
                      .to(aria,     { y: '+=20', duration: 0.3, ease: 'power2.out' })       // accroupi
                      .to(ariaBody, { rotation: leanDir, duration: 0.3 }, '<')              // penche dans la direction
                      .to(aria,     { x: pos.x, duration: 0.65, ease: 'power3.inOut' })     // dash
                      .to(ariaBody, { rotation: leanDir * 0.6, duration: 0.65, ease: 'power3.inOut' }, '<') // maintient l'élan
                      .to(aria,     { y: '-=20', duration: 0.3, ease: 'power2.inOut' })     // se redresse
                      .to(ariaBody, { rotation: 0, duration: 0.3 }, '<');                   // retour droit
                currentAnchor = targetAnchor;

            } else if (ev === 'stretch') {
                lifeTl
                      // Bras montent au-dessus de la tête en passant par l'extérieur
                      // armLeft : rotation positive → part vers l'extérieur puis monte (168° ≈ bras vertical vers le haut)
                      // armRight : rotation négative → part vers l'extérieur puis monte
                      .to(armLeft,  { rotation:  168, duration: 0.7, ease: 'power2.out', transformOrigin: ARM_ORIGIN })
                      .to(armRight, { rotation: -168, duration: 0.7, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, '<')
                      // Corps s'étire vers le haut
                      .to(ariaBody, { scaleY: 1.08, duration: 0.7, ease: 'power2.out', transformOrigin: '50% 100%' }, '<')
                      // Yeux grands ouverts
                      .to([eyeLeft, eyeRight], { scaleY: 1.2, duration: 0.35, transformOrigin: '50% 50%' }, '<')
                      // Maintien bras en l'air
                      .to({}, { duration: 0.5 })
                      // Rotation lente vers l'extérieur : de -168 → 0 (passe par -90 horizontal) et 168 → 0
                      .to(armLeft,  { rotation: 0, duration: 1.4, ease: 'sine.inOut', transformOrigin: ARM_ORIGIN })
                      .to(armRight, { rotation: 0, duration: 1.4, ease: 'sine.inOut', transformOrigin: ARM_ORIGIN }, '<')
                      // Corps et yeux reviennent progressivement
                      .to(ariaBody, { scaleY: 1, duration: 1.1, ease: 'sine.inOut', transformOrigin: '50% 100%' }, '<')
                      .to([eyeLeft, eyeRight], { scaleY: 1, duration: 0.6, transformOrigin: '50% 50%' }, '<0.5');

            } else if (ev === 'lookAtCamera') {
                lifeTl
                      // Yeux reviennent au centre exact
                      .to(ariaEyes, { x: 0, y: 0, duration: 0.7, ease: 'power2.inOut' })
                      .to([pupilLeft, pupilRight], { x: 0, y: 0, duration: 0.7, ease: 'power2.inOut' }, '<')
                      // Pupilles grossissent légèrement — effet "focus"
                      .to([pupilLeft, pupilRight], { scaleX: 1.15, scaleY: 1.15, duration: 0.3, transformOrigin: '50% 50%' })
                      // Léger penchement vers le spectateur
                      .to(ariaBody, { rotation: -2, duration: 0.4, ease: 'sine.inOut' }, '<')
                      // Maintien du regard
                      .to({}, { duration: 1.5 })
                      // Clignement lent et délibéré
                      .to([eyeLeft, eyeRight, pupilLeft, pupilRight], { scaleY: 0.08, duration: 0.1, ease: 'power2.in', transformOrigin: '50% 50%' })
                      .to([eyeLeft, eyeRight, pupilLeft, pupilRight], { scaleY: 1,    duration: 0.14, ease: 'power2.out', transformOrigin: '50% 50%' })
                      // Retour à la normale
                      .to([pupilLeft, pupilRight], { scaleX: 1, scaleY: 1, duration: 0.35, transformOrigin: '50% 50%' })
                      .to(ariaBody, { rotation: 0, duration: 0.4, ease: 'sine.inOut' }, '<');

            } else if (ev === 'dance') {
                const beatDur = 0.28;
                for (let i = 0; i < 3; i++) {
                    const dir = (i % 2 === 0) ? 1 : -1;
                    lifeTl
                          // Temps fort : corps penche, bras alternés, léger rebond
                          .to(ariaBody, { rotation: dir * 8, duration: beatDur, ease: 'sine.inOut' })
                          .to(aria,     { y: '-=8',          duration: beatDur, ease: 'sine.inOut' }, '<')
                          .to(armLeft,  { rotation: dir * -40, duration: beatDur, transformOrigin: ARM_ORIGIN }, '<')
                          .to(armRight, { rotation: dir *  40, duration: beatDur, transformOrigin: ARM_ORIGIN }, '<')
                          // Retour
                          .to(ariaBody, { rotation: 0, duration: beatDur, ease: 'sine.inOut' })
                          .to(aria,     { y: '+=8',   duration: beatDur, ease: 'bounce.out' }, '<')
                          .to(armLeft,  { rotation: 0, duration: beatDur, transformOrigin: ARM_ORIGIN }, '<')
                          .to(armRight, { rotation: 0, duration: beatDur, transformOrigin: ARM_ORIGIN }, '<');
                }
                // Finalisation : les deux bras montent, yeux s'illuminent
                lifeTl
                      .to(armLeft,  { rotation: -60, duration: 0.2, ease: 'back.out(2)', transformOrigin: ARM_ORIGIN })
                      .to(armRight, { rotation:  60, duration: 0.2, ease: 'back.out(2)', transformOrigin: ARM_ORIGIN }, '<')
                      .to([eyeLeft, eyeRight], { fill: '#ff8c5a', duration: 0.2 }, '<')
                      .to({}, { duration: 0.3 })
                      .to(armLeft,  { rotation: 0, duration: 0.3, transformOrigin: ARM_ORIGIN })
                      .to(armRight, { rotation: 0, duration: 0.3, transformOrigin: ARM_ORIGIN }, '<')
                      .to([eyeLeft, eyeRight], { fill: '#d67556', duration: 0.4 }, '<');
            }
        }

        // ── Reset helpers ─────────────────────────────────────────────────
        function resetParts() {
            gsap.to([armLeft, armRight], { rotation: 0, duration: 0.4, transformOrigin: ARM_ORIGIN });
            gsap.to(ariaBody,            { rotation: 0, scaleY: 1, duration: 0.4 });
            gsap.to(aria,                { scale: 1, duration: 0.4 }); // Reset in case of curiousPeek interruption
            gsap.to([eyeLeft, eyeRight], { scaleY: 1, scaleX: 1, fill: '#d67556', duration: 0.3, transformOrigin: '50% 50%' });
            if (pupilLeft) gsap.to([pupilLeft, pupilRight], { scaleY: 1, scaleX: 1, fill: 'white', duration: 0.3, transformOrigin: '50% 50%' });
            gsap.to(ariaGlow,            { opacity: 0.7, scaleX: 1, scaleY: 1, duration: 0.4 });
            if (ariaEyes) gsap.to(ariaEyes, { x: 0, y: 0, duration: 0.4 });
            if (pupilLeft) gsap.to([pupilLeft, pupilRight], { x: 0, y: 0, duration: 0.4 });
        }

        // ── Movement ──────────────────────────────────────────────────────
        function walkTo(destAnchor, duration) {
            currentAnchor = destAnchor;
            const dest = destAnchor();
            const dx = dest.x - parseFloat(gsap.getProperty(aria, 'x'));
            const leanAngle = Math.abs(dx) > 60 ? (dx > 0 ? -5 : 5) : 0;

            const tl = gsap.timeline();
            tl.to(aria, { x: dest.x, y: dest.y, duration, ease: 'power3.inOut' });
            if (leanAngle !== 0) {
                tl.to(ariaBody, { rotation: leanAngle, duration: duration * 0.28, ease: 'power2.out'  }, 0)
                  .to(ariaBody, { rotation: 0,          duration: duration * 0.35, ease: 'power2.out'  }, duration * 0.65);
            }
            return tl;
        }

        function walkIn(side, destAnchor) {
            const start = side === 'left' ? offLeft() : offRight();
            const endAnchor = destAnchor || restPos;
            const leanAngle = side === 'left' ? 3 : -3; // inclinaison dans la direction du mouvement
            gsap.set(aria, start);
            const tl = walkTo(endAnchor, 1.2);
            tl.to(ariaBody, { rotation: leanAngle, duration: 0.3, ease: 'power1.out' }, 0)
              .to(ariaBody, { rotation: 0,          duration: 0.4, ease: 'power2.inOut' }, 0.8);
            return tl;
        }

        function walkOut(side) {
            const dest = side === 'left' ? offLeft() : offRight();
            return gsap.timeline()
                .to(aria, { x: dest.x, y: dest.y, duration: 1.0, ease: 'power2.in' })
                .to(ariaBody, { rotation: 4, duration: 0.18, ease: 'sine.inOut', yoyo: true, repeat: 4 }, 0);
        }

        // ARIA traverse l'écran d'un côté à l'autre, en passant DERRIÈRE la carte
        function walkThrough(fromSide) {
            const start   = fromSide === 'right' ? offRight()     : offLeft();
            const destPos = fromSide === 'right' ? restPosLeft()  : restPos();
            const enterX  = fromSide === 'right' ? slideZoneR()   : slideZoneL();
            const exitX   = fromSide === 'right' ? slideZoneL()   : slideZoneR();
            const midY    = vh() - 200; // Force traverse à la bonne hauteur
            const totalDur = 2.6;
            
            currentAnchor = fromSide === 'right' ? restPosLeft : restPos;

            gsap.set(aria, start);
            setLayer(false);

            const tl = gsap.timeline();
            // Marche en avant jusqu'au bord de la carte
            tl.to(aria, { x: enterX, y: midY, duration: 0.55, ease: 'linear' });
            // Passe derrière
            tl.call(() => setLayer(true));
            tl.to(aria, { x: exitX, y: midY, duration: 1.20, ease: 'linear' });
            // Ressort devant
            tl.call(() => setLayer(false));
            // Rejoint sa position de repos
            tl.to(aria, { x: destPos.x, y: destPos.y, duration: 0.55, ease: 'power2.out' });

            // Waddle pendant toute la traversée
            const waddleRep = 15;
            tl.to(ariaBody, {
                rotation: -4, duration: totalDur / (waddleRep * 2),
                ease: 'sine.inOut', yoyo: true, repeat: waddleRep * 2 - 1
            }, 0);

            return tl;
        }

        // ── Gesture animations ────────────────────────────────────────────
        // Grand coucou d'entrée — bras haut vers l'extérieur, 4 oscillations, petit saut
        function grandWave() {
            return gsap.timeline()
                // Petit saut de bienvenue
                .to(aria, { y: '-=18', duration: 0.22, ease: 'power2.out' })
                .to(aria, { y: '+=18', duration: 0.28, ease: 'bounce.out' })
                // Bras gauche monte vers l'extérieur (rotation positive = vers la droite du robot)
                .to(armLeft, { rotation: 115, duration: 0.28, ease: 'back.out(2.5)', transformOrigin: ARM_ORIGIN }, 0)
                // 4 oscillations amples
                .to(armLeft, { rotation: 80,  duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 115, duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 80,  duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 115, duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 80,  duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 115, duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 80,  duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft, { rotation: 115, duration: 0.14, transformOrigin: ARM_ORIGIN })
                // Retour naturel
                .to(armLeft, { rotation: 0, duration: 0.35, ease: 'power2.out', transformOrigin: ARM_ORIGIN });
        }

        function point(dir) {
            const tl = gsap.timeline();
            if (dir === 'up') {
                tl.to(armRight, { rotation: -130, duration: 0.4, ease: 'back.out(1.7)', transformOrigin: ARM_ORIGIN })
                  .to(ariaBody,  { rotation: 4,    duration: 0.3 }, '<');
            } else if (dir === 'left') {
                tl.to(armLeft,  { rotation: -35, duration: 0.35, ease: 'back.out(1.7)', transformOrigin: ARM_ORIGIN })
                  .to(ariaBody,  { rotation: -4, duration: 0.3 }, '<');
            } else {
                tl.to(armRight, { rotation: 35, duration: 0.35, ease: 'back.out(1.7)', transformOrigin: ARM_ORIGIN })
                  .to(ariaBody,  { rotation: 4,  duration: 0.3 }, '<');
            }
            return tl;
        }

        function scared() {
            const eyes = [eyeLeft, eyeRight, pupilLeft, pupilRight];
            const currentX = gsap.getProperty(aria, 'x');
            const targetX  = Math.max(10, currentX - 70);
            return gsap.timeline()
                .to(aria, { x: targetX, duration: 0.22, ease: 'power3.out' })
                .to(eyes, { scaleY: 1.5, scaleX: 1.15, duration: 0.15, transformOrigin: '50% 50%' }, '<')
                .to(ariaBody, { rotation: -10, duration: 0.15 }, '<')
                .to(ariaBody, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.3)' }, '>')
                .to(eyes, { scaleY: 1, scaleX: 1, duration: 0.35, transformOrigin: '50% 50%' }, '<')
                .to(aria, { x: '+=4', duration: 0.05, repeat: 8, yoyo: true }, '>');
        }

        function excited() {
            return gsap.timeline()
                // Premier saut
                .to(aria, { y: '-=28', duration: 0.22, ease: 'power2.out' })
                .to(aria, { y: '+=28', duration: 0.28, ease: 'bounce.out' })
                .to(ariaBody, { scaleY: 0.82, scaleX: 1.12, duration: 0.08, transformOrigin: '50% 100%' }, '-=0.08')
                .to(ariaBody, { scaleY: 1, scaleX: 1, duration: 0.18, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
                // Deuxième saut
                .to(aria, { y: '-=14', duration: 0.18, ease: 'power2.out' })
                .to(aria, { y: '+=14', duration: 0.22, ease: 'bounce.out' })
                .to(ariaBody, { scaleY: 0.88, scaleX: 1.07, duration: 0.07, transformOrigin: '50% 100%' }, '-=0.07')
                .to(ariaBody, { scaleY: 1, scaleX: 1, duration: 0.15, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
                // Bras et yeux
                .to(armLeft,  { rotation: -65, duration: 0.2, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, 0)
                .to(armRight, { rotation:  65, duration: 0.2, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, 0)
                .to([eyeLeft, eyeRight], { fill: '#ff8c5a', duration: 0.25, transformOrigin: '50% 50%' }, 0)
                .to(armLeft,  { rotation: 0, duration: 0.35, transformOrigin: ARM_ORIGIN }, '>')
                .to(armRight, { rotation: 0, duration: 0.35, transformOrigin: ARM_ORIGIN }, '<')
                .to([eyeLeft, eyeRight], { fill: '#d67556', duration: 0.5 }, '<');
        }

        function thinking() {
            const eyes = [eyeLeft, eyeRight, pupilLeft, pupilRight];
            return gsap.timeline()
                .to(ariaBody, { rotation: -12, duration: 0.5, ease: 'power2.out' })
                .to(eyes, { scaleY: 0.55, duration: 0.3, transformOrigin: '50% 50%' }, '<')
                .to(armRight, { rotation: -25, duration: 0.4, transformOrigin: ARM_ORIGIN }, '<');
        }

        function typeInAir() {
            return gsap.timeline({ repeat: 2 })
                .to(armLeft,  { rotation: -22, duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armLeft,  { rotation:   0, duration: 0.14, transformOrigin: ARM_ORIGIN })
                .to(armRight, { rotation:  22, duration: 0.14, transformOrigin: ARM_ORIGIN }, '<')
                .to(armRight, { rotation:   0, duration: 0.14, transformOrigin: ARM_ORIGIN });
        }

        function proud() {
            return gsap.timeline()
                .to(ariaBody, { rotation: 0, scaleY: 1.09, duration: 0.4, ease: 'back.out(2)' })
                .to(ariaGlow,  { opacity: 1, scaleX: 1.5, scaleY: 1.5, duration: 0.4 }, '<')
                .to([eyeLeft, eyeRight], { fill: '#ff6030', duration: 0.3, transformOrigin: '50% 50%' }, '<');
        }

        function bow() {
            return gsap.timeline()
                .to(ariaBody, { rotation: 22, duration: 0.4, ease: 'power2.inOut' })
                .to(aria, { y: '+=18', duration: 0.4, ease: 'power2.inOut' }, '<')
                .to(ariaBody, { rotation: 0, duration: 0.4, ease: 'power2.out' }, '>')
                .to(aria, { y: '-=18', duration: 0.3 }, '<');
        }

        // ── Behavior runner ───────────────────────────────────────────────
        let currentBehaviorIndex = -1;
        let behaviorTl = null;
        let hasEntered = false; // le robot n'entre qu'une seule fois

        function triggerBehavior(index) {
            currentBehaviorIndex = index;

            // Entrée initiale : une seule fois — le flag empêche un re-déclenchement
            // si un slidechange arrive pendant le drag, la colère, ou un life event.
            if (!hasEntered) {
                hasEntered = true;
                setLayer(false);
                behaviorTl = gsap.timeline({ onComplete: () => { behaviorTl = null; resetParts(); startIdle(); } });
                behaviorTl.add(walkIn('right', restPos)).add(grandWave(), '+=0.2');
            }
            // Les changements de slide suivants n'interrompent pas le robot —
            // il continue ses life events et son idle naturellement.
        }

        // (Map de comportements par slide supprimée — le robot est autonome)
        // Conservé pour référence future si on veut réintroduire des gestes ponctuels :
        const BEHAVIORS = {
        };

        // ── Drag & Drop ───────────────────────────────────────────────────
        // Attraper le robot avec la souris : les bras traînent dans la direction
        // opposée au mouvement ; au relâchement : squash + symbole de colère.
        const angerMark = document.getElementById('aria-anger');

        let isDragging   = false;
        let dragOffsetX  = 0;
        let dragOffsetY  = 0;
        let dragLastX    = 0;
        let dragLastTime = 0;
        let dragVelX     = 0;
        let angerTl      = null;
        let cursorTrackX = 0;
        let cursorTrackY = 0;
        let cursorTracking = false;

        function updateEyesToCursor() {
            if (!ariaEyes) return;
            const maxX = 7, maxY = 5;
            const eRect = ariaEyes.getBoundingClientRect();
            const eX = eRect.left + eRect.width / 2;
            const eY = eRect.top  + eRect.height / 2;
            const dx = cursorTrackX - eX;
            const dy = cursorTrackY - eY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            gsap.to(ariaEyes,            { x: (dx/dist)*maxX,        y: (dy/dist)*maxY,        duration: 0.15, overwrite: 'auto' });
            gsap.to([pupilLeft, pupilRight], { x: (dx/dist)*maxX*0.6, y: (dy/dist)*maxY*0.6, duration: 0.12, overwrite: 'auto' });
        }

        // Rend #aria cliquable malgré pointer-events:none sur le container
        aria.style.pointerEvents = 'auto';
        aria.style.cursor = 'grab';

        if (angerMark) gsap.set(angerMark, { opacity: 0, scale: 0 });

        function startDrag(clientX, clientY) {
            if (isDragging) return;

            // Stoppe tout ce qui tourne
            if (behaviorTl) { behaviorTl.kill(); behaviorTl = null; }
            if (lifeTl)     { lifeTl.kill();     lifeTl = null; }
            if (angerTl)    { angerTl.kill();    angerTl = null; }
            if (angerMark)  gsap.set(angerMark, { opacity: 0, scale: 0 });
            stopIdle();

            isDragging = true;
            aria.style.cursor = 'grabbing';

            const robotX = parseFloat(gsap.getProperty(aria, 'x'));
            const robotY = parseFloat(gsap.getProperty(aria, 'y'));
            dragOffsetX  = clientX - robotX;
            dragOffsetY  = clientY - robotY;
            dragLastX    = clientX;
            dragLastTime = performance.now();
            dragVelX     = 0;

            // Réaction "pris en main" : yeux qui s'écarquillent, petit squash
            gsap.killTweensOf([ariaBody, eyeLeft, eyeRight, ariaEyes, armLeft, armRight]);
            gsap.to(ariaBody,            { scaleY: 0.88, scaleX: 1.08, duration: 0.12, ease: 'power2.out', transformOrigin: '50% 100%' });
            gsap.to([eyeLeft, eyeRight], { scaleY: 1.4,  duration: 0.12, transformOrigin: '50% 50%' });
            gsap.to(ariaEyes,            { y: -2, duration: 0.12 });
            // Bras légèrement levés en surprise
            gsap.to(armLeft,  { rotation:  30, duration: 0.15, ease: 'power2.out', transformOrigin: ARM_ORIGIN });
            gsap.to(armRight, { rotation: -30, duration: 0.15, ease: 'power2.out', transformOrigin: ARM_ORIGIN });
        }

        function moveDrag(clientX, clientY) {
            if (!isDragging) return;

            const now = performance.now();
            const dt  = Math.max(1, now - dragLastTime);
            dragVelX  = (clientX - dragLastX) / dt; // px/ms
            dragLastX    = clientX;
            dragLastTime = now;

            // Déplace le robot directement
            gsap.set(aria, { x: clientX - dragOffsetX, y: clientY - dragOffsetY });

            // Bras asymétriques — les deux bras tournent dans le MÊME sens (celui du mouvement) :
            //   ARM_ORIGIN = '50% 0%' → pivot en haut du bras ; rotation+/- = clockwise/CCW
            //   Pour armRight : rotation négative = bras part vers la GAUCHE (intérieur puis dessus)
            //                   rotation positive = bras part vers la DROITE (extérieur, traîne)
            //   Pour armLeft  : rotation positive = bras part vers la DROITE (intérieur puis dessus)
            //                   rotation négative = bras part vers la GAUCHE (extérieur, traîne)
            //
            //   Draggé vers la DROITE (velX > 0) :
            //     armRight : -110° → passe par l'intérieur et monte par dessus ✓
            //     armLeft  :  -40° → traîne vers l'extérieur-gauche             ✓
            //
            //   Draggé vers la GAUCHE (velX < 0) :
            //     armLeft  : +110° → passe par l'intérieur et monte par dessus ✓
            //     armRight :  +40° → traîne vers l'extérieur-droite             ✓
            const t = Math.min(1, Math.abs(dragVelX) * 0.45);
            if (dragVelX >= 0) {
                // Droite : armLeft passe par dessus (+), armRight traîne (+)
                gsap.to(armLeft,  { rotation:  t * 110, duration: 0.18, overwrite: 'auto', transformOrigin: ARM_ORIGIN });
                gsap.to(armRight, { rotation:  t *  40, duration: 0.22, overwrite: 'auto', transformOrigin: ARM_ORIGIN });
            } else {
                // Gauche : armRight passe par dessus (-), armLeft traîne (-)
                gsap.to(armRight, { rotation: -t * 110, duration: 0.18, overwrite: 'auto', transformOrigin: ARM_ORIGIN });
                gsap.to(armLeft,  { rotation: -t *  40, duration: 0.22, overwrite: 'auto', transformOrigin: ARM_ORIGIN });
            }
            const bodyTilt = Math.max(-10, Math.min(10, -dragVelX * 13));
            gsap.to(ariaBody, {
                rotation: bodyTilt, scaleY: 0.88, scaleX: 1.08,
                duration: 0.18, overwrite: 'auto', transformOrigin: '50% 100%'
            });
        }

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            aria.style.cursor = 'grab';

            // Atterrissage : petite chute + rebond + squash
            gsap.timeline({ onComplete: showAnger })
                .to(aria,     { y: '+=20', duration: 0.22, ease: 'power2.in' })
                .to(aria,     { y: '-=12', duration: 0.16, ease: 'power2.out' })
                .to(aria,     { y: '+=12', duration: 0.18, ease: 'bounce.out' })
                .to(ariaBody, { scaleY: 0.80, scaleX: 1.18, duration: 0.07, transformOrigin: '50% 100%' }, '-=0.07')
                .to(ariaBody, { scaleY: 1, scaleX: 1, duration: 0.32, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
                .to([eyeLeft, eyeRight], { scaleY: 1, duration: 0.2, transformOrigin: '50% 50%' }, '<')
                .to(ariaEyes,            { y: 0, duration: 0.2 }, '<')
                .to([armLeft, armRight], { rotation: 0, duration: 0.28, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, '<');
        }

        function showAnger() {
            cursorTracking = true;  // yeux suivent le curseur pendant toute la colère
            updateEyesToCursor();
            if (!angerMark) { afterAnger(); return; }

            gsap.set(angerMark, { scale: 0, transformOrigin: '50% 50%' });

            angerTl = gsap.timeline({ onComplete: afterAnger })
                // Yeux mi-clos et rouges (colère)
                .to([eyeLeft, eyeRight], { scaleY: 0.45, fill: '#ff3333', duration: 0.1, transformOrigin: '50% 50%' })
                // Bras légèrement baissés (pose "bras croisés")
                .to(armLeft,  { rotation: -20, duration: 0.18, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, '<')
                .to(armRight, { rotation:  20, duration: 0.18, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, '<')
                // Symbole de colère : pop sur la tempe
                .to(angerMark, { opacity: 1, scale: 1.4, duration: 0.18, ease: 'back.out(2)', transformOrigin: '50% 50%' })
                .to(angerMark, { scale: 1, duration: 0.12 })
                // Deux pulsations
                .to(angerMark, { scale: 1.25, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
                // Tremblement de rage
                .to(ariaBody,  { rotation: -5, duration: 0.055, repeat: 6, yoyo: true, ease: 'none' }, '<')
                // Maintien de la colère
                .to({}, { duration: 2.2 })
                // Dissipation
                .to(angerMark, { opacity: 0, scale: 0.4, duration: 0.35, ease: 'power2.in', transformOrigin: '50% 50%' })
                .to([eyeLeft, eyeRight], { scaleY: 1, fill: '#d67556', duration: 0.4, transformOrigin: '50% 50%' }, '<')
                .to([armLeft, armRight], { rotation: 0, duration: 0.4, ease: 'power2.out', transformOrigin: ARM_ORIGIN }, '<')
                .to(ariaBody,            { rotation: 0, duration: 0.3, ease: 'power2.out' }, '<');
        }

        function afterAnger() {
            angerTl = null;
            // Ancre la plus proche du point de chute
            const curX = parseFloat(gsap.getProperty(aria, 'x'));
            const curY = parseFloat(gsap.getProperty(aria, 'y'));
            let minDist = Infinity;
            ANCHORS.forEach(a => {
                const p = a();
                const d = Math.hypot(p.x - curX, p.y - curY);
                if (d < minDist) { minDist = d; currentAnchor = a; }
            });
            resetParts();
            // Continue à suivre le curseur ~1.5s, puis reprend le scan de la slide
            setTimeout(() => {
                cursorTracking = false;
                startIdle();
            }, 1500);
        }

        // Listeners souris
        aria.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
        document.addEventListener('mousemove', e => {
            cursorTrackX = e.clientX;
            cursorTrackY = e.clientY;
            moveDrag(e.clientX, e.clientY);
            if (cursorTracking) updateEyesToCursor();
        });
        document.addEventListener('mouseup', () => endDrag());

        // Listeners tactiles
        aria.addEventListener('touchstart', e => {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchmove', e => {
            if (isDragging) { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }
        }, { passive: false });
        document.addEventListener('touchend', () => endDrag());

        // ── Resize: repositionner ARIA sur son ancre courante ────────────
        window.addEventListener('resize', function () {
            if (idleTweens.length === 0) return; // ne repositionne que si en idle
            const r = currentAnchor();
            gsap.set(aria, { x: r.x, y: r.y });
        });

        // ── Listen for slide changes ──────────────────────────────────────
        document.addEventListener('slidechange', function (e) {
            triggerBehavior(e.detail.index);
        });

        // ── Fire initial behavior after slides have loaded ────────────────
        window.addEventListener('load', function () {
            setTimeout(function () {
                const saved = parseInt(localStorage.getItem('pres_slide') || '0');
                triggerBehavior(saved);
            }, 400);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();