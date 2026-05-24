// =========================================================
// VARIABLES GLOBALES
// =========================================================
const carteContainer = document.getElementById('carteContainer');
const svgMap = document.getElementById('svgVietnam');
const hoverLabel = document.getElementById('province-hover-label');

const isMobileInit = window.innerWidth <= 768;

// 🌟 ZOOM_MIN n'est plus une constante, il est plus petit sur mobile (0.7)
let ZOOM_MIN = isMobileInit ? 0.9 : 1.0; 
let zoomScale = ZOOM_MIN; 
const ZOOM_MAX = 4.5;
const ZOOM_STEP = 0.2;

let isPanning = false;
let startX = 0, startY = 0;
let translateX = 0, translateY = 0; 
let startClickX = 0, startClickY = 0;
let userInteractedWithZoom = false;

// =========================================================
// 1. ÉVÉNEMENTS SUR LES PROVINCES
// =========================================================
document.querySelectorAll('.province').forEach(el => {
  el.addEventListener('mouseenter', () => {
    if (window.innerWidth <= 1024) return;
    if (el.parentNode && el.parentNode.lastElementChild !== el) {
      el.parentNode.appendChild(el);
    }
    const provinceKey = el.getAttribute('data-province');
    if(provinceKey) {
      hoverLabel.textContent = provinceKey.replace(/([A-Z])/g, ' $1').trim();
      hoverLabel.style.display = 'block';
    }
  });

  el.addEventListener('mouseleave', () => {
    hoverLabel.style.display = 'none';
  });

  el.addEventListener('click', (e) => {
    const distanceDeplacement = Math.hypot(e.clientX - startClickX, e.clientY - startClickY);
    if (distanceDeplacement > 6) return; 
    ouvrirFiche(el.getAttribute('data-province'));
  });
});

// =========================================================
// 2. DEPLOYEMENT DU PANNEAU LATÉRAL (FICHE INFO)
// =========================================================
function ouvrirFiche(id) {
  if (!id) return;
  
  userInteractedWithZoom = false;
  document.body.classList.add('fiche-mode');
  document.getElementById('searchContainer')?.classList.remove('active');

  if (typeof regionActive !== 'undefined' && regionActive !== null) {
    document.querySelectorAll('.province').forEach(p => p.classList.remove('region-highlighted', 'region-dimmed'));
    document.querySelectorAll('.dock-btn[data-region-btn]').forEach(b => b.classList.remove('active'));
    regionActive = null;
  }

  const targetElement = document.getElementById(id) || document.querySelector(`[data-province="${id}"]`);
  
  if (targetElement) {
    document.querySelectorAll('.province').forEach(p => p.classList.remove('active-province'));
    targetElement.classList.add('active-province');
    
    const bbox = targetElement.getBBox();
    const provinceX = bbox.x + bbox.width / 2;
    const provinceY = bbox.y + bbox.height / 2;
    
    const viewBoxAttr = svgMap.getAttribute('viewBox') || "200 20 480 940";
    const vb = viewBoxAttr.split(' ').map(Number);
    const svgCenterX = vb[0] + vb[2] / 2;
    const svgCenterY = vb[1] + vb[3] / 2;
    
    // 🌟 CORRECTION DU HORS-CHAMP CONSERVÉE
    const rect = svgMap.getBoundingClientRect();
    const tailleDeBasePx = rect.width / zoomScale; 
    const pixelRatio = tailleDeBasePx / vb[2];
    
    // --- BLOC RESPONSIVE ---
    const conteneurRect = carteContainer.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    
    // Définition des 3 paliers
    const isMobile = windowWidth <= 768;
    const isTablet = windowWidth > 768 && windowWidth <= 1024;
    
    // 1. Échelle de zoom adaptée au support
    zoomScale = isMobile ? 1.4 : (isTablet ? 1.8 : 2.4); 
    
    // 2. Décalages dynamiques basés sur le % de l'écran
    let decalagePanneauX = 0;
    let decalagePanneauY = 0;
    
    if (isMobile) {
      // Zoom global sur mobile (à augmenter si tu veux que la carte soit plus grosse)
      zoomScale = 1.4; 
      
      // 🌟 NOUVEAU : On récupère la région de la province cliquée
      const regionDeLaProvince = regionMapping[id];
      
      // On applique un ancrage différent selon la zone géographique
      if (regionDeLaProvince === "Sud") {
         // LE SUD : Souvent coupé en bas à droite. 
         // -> On le pousse vers la GAUCHE (-90) et on le remonte un peu plus haut
         decalagePanneauX = 230; 
         decalagePanneauY = -(conteneurRect.height * 0.05);
         
      } else if (regionDeLaProvince === "Nord") {
         // LE NORD : Très large en haut.
         // -> On le pousse vers la DROITE (+40) et on le descend un peu pour l'encoche
         decalagePanneauX = 270;
         decalagePanneauY = -(conteneurRect.height * 0.20);
         
      } else {
         // LE CENTRE (ou par défaut) : Relativement fin et droit.
         // -> Petit ajustement à gauche (-20) et hauteur classique
         decalagePanneauX = 250;
         decalagePanneauY = -(conteneurRect.height * 0.15); 
      }
    } 
    else if (isTablet) {
      // iPad : Le panneau latéral est là, on pousse la carte de 15% vers la droite
      decalagePanneauX = conteneurRect.width * 0.15;
    } else {
      // PC : Large écran, on pousse la carte de 20% vers la droite pour équilibrer
      decalagePanneauX = conteneurRect.width * 0.40; 
    }

    // Application des corrections spécifiques à certaines provinces extrêmes
    const correctionsManuelles = {
      "LamDong": { x: isMobile ? -200 : -550, y: 10 }, // premier chiffre est pour le smartphone, le second pour le PC
      "DienBien": { x: isMobile ? -90 : -100, y: isMobile ? 50 : 100 },
      "LaiChau": { x: isMobile ? -80 : -80, y: isMobile ? 30 : 60 },
    };
    
    if (correctionsManuelles[id]) {
      decalagePanneauX += correctionsManuelles[id].x;
      decalagePanneauY += correctionsManuelles[id].y;
    }
    
    translateX = (svgCenterX - provinceX) * pixelRatio * zoomScale + decalagePanneauX;
    translateY = (svgCenterY - provinceY) * pixelRatio * zoomScale + decalagePanneauY;
    
    document.body.classList.add('zoomed');
    document.documentElement.style.setProperty('--stroke-dynamic-width', `${0.6 / Math.sqrt(zoomScale)}px`);

    svgMap.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease, opacity 0.3s ease';
    appliquerTransformation();
  }
  
  document.getElementById('ficheTitre').textContent = id.replace(/([A-Z])/g, ' $1').trim();
  document.getElementById('ficheCapitale').textContent = "Chef-lieu local";
  document.getElementById('fichePop').textContent = "Recensement disponible";
  document.getElementById('ficheTexte').textContent = `Bienvenue dans la fiche d'information de la province de ${id.replace(/([A-Z])/g, ' $1').trim()}. Vous pouvez continuer à naviguer, glisser (drag) ou zoomer sur la partie droite de l'écran pour observer ses frontières de plus près.`;
}
// =========================================================
// 3. CONTRÔLE DU ZOOM ET DU DRAG (MÉCANIQUE RESTAURÉE)
// =========================================================
function appliquerTransformation() {
  if (svgMap) {
    svgMap.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`;
  }
}

function ajusterZoom(nouveauZoom) {
  zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nouveauZoom));
  
  if (document.body.classList.contains('fiche-mode')) {
    userInteractedWithZoom = true;
  }
  
  document.body.classList.toggle('zoomed', zoomScale > ZOOM_MIN);
  
  if (zoomScale === ZOOM_MIN) {
    translateX = 0;
    translateY = 0;
  } else {
    const limiteX = (zoomScale - ZOOM_MIN) * 350;
    const limiteY = (zoomScale - ZOOM_MIN) * 600;
    translateX = Math.max(-limiteX, Math.min(limiteX, translateX));
    translateY = Math.max(-limiteY, Math.min(limiteY, translateY));
  }
  
  document.documentElement.style.setProperty('--stroke-dynamic-width', `${0.6 / Math.sqrt(zoomScale)}px`);
  appliquerTransformation();
}

// Molette de la souris
if (carteContainer) {
  carteContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // 1. Calcul du nouveau zoom en respectant les limites
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const nouveauZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale + delta));
    
    // Si on a atteint le maximum ou le minimum, on arrête le calcul
    if (nouveauZoom === zoomScale) return;

    // 2. Coordonnées de la souris par rapport à la carte
    const rect = carteContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 3. Centre du conteneur (Point de départ par défaut du zoom CSS)
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    
    // Distance entre la souris et le centre
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    
    // 4. Le calcul magique pour garder la carte fixée sous la souris
    const ratio = nouveauZoom / zoomScale;
    translateX = translateX * ratio + dx * (1 - ratio);
    translateY = translateY * ratio + dy * (1 - ratio);
    
    // 5. On applique (ta fonction ajusterZoom s'occupe de bloquer les bords si on va trop loin)
    ajusterZoom(nouveauZoom);
  }, { passive: false });
}

// Boutons d'action zoom
document.getElementById('zoomIn')?.addEventListener('click', () => ajusterZoom(zoomScale + ZOOM_STEP));
document.getElementById('zoomOut')?.addEventListener('click', () => ajusterZoom(zoomScale - ZOOM_STEP));
document.getElementById('zoomReset')?.addEventListener('click', () => {
  translateX = 0;
  translateY = 0;
  ajusterZoom(ZOOM_MIN);
});


// =========================================================
// DRAG & DROP (SOURIS ET TACTILE)
// =========================================================

// Fonction de démarrage du glissement
const startDrag = (clientX, clientY) => {
  startClickX = clientX;
  startClickY = clientY;
  
  // 🌟 On a supprimé la condition de zoom ! On peut "drag" tout le temps.
  isPanning = true;
  if (svgMap) svgMap.style.transition = 'none'; 
  startX = clientX - translateX;
  startY = clientY - translateY;
};

// Fonction de déplacement
const doDrag = (clientX, clientY) => {
  if (!isPanning) return;
  if (document.body.classList.contains('fiche-mode')) userInteractedWithZoom = true;
  
  // 🌟 Tolérance dynamique : Permet un glissement "limité" sur mobile même au zoom minimum
  const margeDeGlissementX = window.innerWidth <= 768 ? 120 : 0; // 120px de glissement autorisé à gauche/droite
  const margeDeGlissementY = window.innerWidth <= 768 ? 200 : 0; // 200px en haut/bas
  
  // On calcule les limites physiques de la caméra
  const limiteX = margeDeGlissementX + ((zoomScale - ZOOM_MIN) * 800);
  const limiteY = margeDeGlissementY + ((zoomScale - ZOOM_MIN) * 1000);
  
  translateX = Math.max(-limiteX, Math.min(limiteX, clientX - startX));
  translateY = Math.max(-limiteY, Math.min(limiteY, clientY - startY));
  
  appliquerTransformation();
};

// Fonction de fin de glissement
const endDrag = () => {
  if (isPanning) {
    isPanning = false;
    if (svgMap) svgMap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease, opacity 0.3s ease';
  }
};

// Variables pour mémoriser l'écart des doigts au début du pincement
let initialPinchDistance = null;
let initialZoom = 1;
let pinchCenterX = 0;
let pinchCenterY = 0;

// --- ÉVÉNEMENTS SOURIS (PC) ---
  svgMap.addEventListener('mousedown', (e) => {
    // Si tu veux aussi empêcher de bouger la carte sur PC quand la fiche est ouverte, décommente la ligne dessous
    // if (document.body.classList.contains('fiche-mode')) return;
    startDrag(e.clientX, e.clientY);
  });
  
  // 🛑 LES DEUX LIGNES MANQUANTES POUR LE PC SONT LÀ :
  window.addEventListener('mousemove', (e) => {
    if (isPanning) doDrag(e.clientX, e.clientY);
  });
  
  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      if (svgMap) svgMap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease, opacity 0.3s ease';
    }
  });
  
  // --- ÉVÉNEMENTS TACTILES (MOBILE) ---
  svgMap.addEventListener('touchstart', (e) => {
    // 🌟 NOUVEAU : On gèle la carte UNIQUEMENT si la fiche est agrandie au max
    const sidebarLeft = document.querySelector('.app-sidebar-left');
    if (window.innerWidth <= 768 && sidebarLeft && sidebarLeft.classList.contains('sheet-expanded')) return;
    
    if (e.touches.length === 1) {
      // 👆 UN DOIGT : Glissement normal (Drag)
      initialPinchDistance = null;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } 
    else if (e.touches.length === 2) {
      // ✌️ DEUX DOIGTS : Début du Pinch-to-Zoom
      e.preventDefault(); 
      isPanning = false; // On annule le glissement
      
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      
      // On calcule la distance initiale entre les deux doigts
      initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialZoom = zoomScale;
      
      // On trouve le point central entre les deux doigts pour zoomer vers ce point
      const rect = carteContainer.getBoundingClientRect();
      pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
      pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
    }
  }, { passive: false }); // 🛑 Doit être "false" pour pouvoir bloquer le comportement de Safari

window.addEventListener('touchmove', (e) => {
  const sidebarLeft = document.querySelector('.app-sidebar-left');
  if (window.innerWidth <= 768 && sidebarLeft && sidebarLeft.classList.contains('sheet-expanded')) return;
  if (e.touches.length === 1 && isPanning) {
    // 👆 UN DOIGT : Glissement (Drag)
    e.preventDefault();
    doDrag(e.touches[0].clientX, e.touches[0].clientY);
    
  } else if (e.touches.length === 2 && initialPinchDistance) {
    // ✌️ DEUX DOIGTS : Pinch-to-Zoom
    e.preventDefault();
    if (document.body.classList.contains('fiche-mode')) userInteractedWithZoom = true;

    const t1 = e.touches[0];
    const t2 = e.touches[1];

    // Nouvelle distance entre les doigts
    const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const scaleChange = currentDistance / initialPinchDistance;
    const nouveauZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialZoom * scaleChange));

    if (nouveauZoom === zoomScale) return;

    // Calcul magique pour centrer le zoom sous les doigts
    const ratio = nouveauZoom / zoomScale;
    const rect = carteContainer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const dx = pinchCenterX - cx;
    const dy = pinchCenterY - cy;

    translateX = translateX * ratio + dx * (1 - ratio);
    translateY = translateY * ratio + dy * (1 - ratio);

    ajusterZoom(nouveauZoom);
  }
}, { passive: false });

let lastPinchEndTime = 0; // Variable de sécurité

window.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    if (initialPinchDistance !== null) {
      lastPinchEndTime = new Date().getTime(); // On mémorise l'heure de fin du zoom
    }
    initialPinchDistance = null; // Stoppe le Pinch
  }
  if (e.touches.length === 0) endDrag(); // Stoppe le glissement
});


// =========================================================
// 4. GESTION DES BOUTONS FLOTTANTS (LOUPE ET RÉGIONS)
// =========================================================
const searchContainer = document.getElementById('searchContainer');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const inputRecherche = document.querySelector('.search-input'); // Trouve l'input dynamiquement

const regionContainer = document.getElementById('regionContainer');
const regionToggleBtn = document.getElementById('regionToggleBtn');

// A. Ouvrir/Fermer la Loupe
if (searchToggleBtn && searchContainer) {
  searchToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Empêche le clic de fermer immédiatement
    if (regionContainer) regionContainer.classList.remove('active'); // Ferme l'autre
    searchContainer.classList.toggle('active');
    
    if (searchContainer.classList.contains('active') && inputRecherche) {
      setTimeout(() => inputRecherche.focus(), 100);
    }
  });
}

// B. Ouvrir/Fermer les Régions (Mobile)
if (regionToggleBtn && regionContainer) {
  regionToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (searchContainer) searchContainer.classList.remove('active'); // Ferme l'autre
    regionContainer.classList.toggle('active');
  });
}

// C. Fermer si on clique sur la carte (dans le vide)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.top-right-floating-ui')) {
    if (searchContainer) searchContainer.classList.remove('active');
    if (regionContainer) regionContainer.classList.remove('active');
  }
});

// D. Rendre les boutons "Nord/Centre/Sud" du rond fonctionnels
document.querySelectorAll('.region-pill-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 1. On ferme la petite pilule
    if (regionContainer) regionContainer.classList.remove('active');
    
    // 2. On déclenche le vrai bouton PC (qui gère le zoom)
    const regionName = btn.getAttribute('data-region-btn');
    const boutonEquivPC = document.querySelector(`.dock-btn[data-region-btn="${regionName}"]`);
    if (boutonEquivPC) {
      boutonEquivPC.click(); 
    }
  });
});

// =========================================================
// 5. FILTRE DES RÉGIONS AUTOMATIQUE
// =========================================================
const regionMapping = {
  "HaGiang": "Nord", "CaoBang": "Nord", "BacKan": "Nord", "TuyenQuang": "Nord", 
  "LaoCai": "Nord", "DienBien": "Nord", "LaiChau": "Nord", "SonLa": "Nord", 
  "YenBai": "Nord", "HoaBinh": "Nord", "ThaiNguyen": "Nord", "LangSon": "Nord", 
  "QuangNinh": "Nord", "BacGiang": "Nord", "PhuTho": "Nord", "VinhPhuc": "Nord", 
  "BacNinh": "Nord", "HaiDuong": "Nord", "HaiPhong": "Nord", "HungYen": "Nord", 
  "ThaiBinh": "Nord", "HaNam": "Nord", "NamDinh": "Nord", "NinhBinh": "Nord", "HaNoi": "Nord",
  "ThanhHoa": "Centre", "NgheAn": "Centre", "HaTinh": "Centre", "QuangBinh": "Centre", 
  "QuangTri": "Centre", "ThuaThienHue": "Centre", "DaNang": "Centre", "QuangNam": "Centre", 
  "QuangNgai": "Centre", "BinhDinh": "Centre", "PhuYen": "Centre", "KhanhHoa": "Centre", 
  "NinhThuan": "Centre", "BinhThuan": "Centre", "KonTum": "Centre", "GiaLai": "Centre", 
  "DakLak": "Centre", "DakNong": "Centre", "LamDong": "Centre",
  "BinhPhuoc": "Sud", "TayNinh": "Sud", "BinhDuong": "Sud", "DongNai": "Sud", 
  "BaRiaVungTau": "Sud", "HoChiMinh": "Sud", "HoChiMinhVille": "Sud", "LongAn": "Sud", 
  "TienGiang": "Sud", "BenTre": "Sud", "TraVinh": "Sud", "VinhLong": "Sud", 
  "DongThap": "Sud", "AnGiang": "Sud", "KienGiang": "Sud", "CanTho": "Sud", 
  "HauGiang": "Sud", "SocTrang": "Sud", "BacLieu": "Sud", "CaMau": "Sud"
};

const regionViewsDesktop = {
  "Nord":   { scale: 2.2, x: 100, y: 720 },
  "Centre": { scale: 1.5, x: 0,   y: 0   },
  "Sud":    { scale: 2.5, x: 0,   y: -750 }
};
const regionViewsMobile = {
  "Nord":   { scale: 1.4, x: 100, y: 300 }, // Zoom plus doux, et décalé vers le haut
  "Centre": { scale: 1.1, x: 0, y: 0 },
  "Sud":    { scale: 1.5, x: 0, y: -300 }
};

let regionActive = null;

document.querySelectorAll('.dock-btn[data-region-btn]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    const regionTarget = btn.getAttribute('data-region-btn');
    
    if (regionActive === regionTarget) {
      document.querySelectorAll('.province').forEach(p => p.classList.remove('region-highlighted', 'region-dimmed'));
      btn.classList.remove('active');
      regionActive = null;
      
      translateX = 0;
      translateY = 0;
      ajusterZoom(ZOOM_MIN);
    } else {
      document.querySelectorAll('.dock-btn[data-region-btn]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.province').forEach(p => {
        const provName = p.getAttribute('data-province');
        if (regionMapping[provName] === regionTarget) {
          p.classList.add('region-highlighted');
          p.classList.remove('region-dimmed');
          if (p.parentNode) p.parentNode.appendChild(p); 
        } else {
          p.classList.add('region-dimmed');
          p.classList.remove('region-highlighted');
        }
      });
      
      regionActive = regionTarget;
      
      const isMobile = window.innerWidth <= 768;
      const view = isMobile ? regionViewsMobile[regionTarget] : regionViewsDesktop[regionTarget];
      
      zoomScale = view.scale;
      translateX = view.x;
      translateY = view.y;
      
      document.body.classList.add('zoomed');
      document.documentElement.style.setProperty('--stroke-dynamic-width', `${0.6 / Math.sqrt(zoomScale)}px`);      
      if (svgMap) {
        svgMap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease, opacity 0.3s ease';
      }
      appliquerTransformation();
    }
  });
});

document.addEventListener('click', (e) => {
  const distanceDeplacement = Math.hypot(e.clientX - startClickX, e.clientY - startClickY);
  if (distanceDeplacement > 6) return; 

  if (regionActive && !e.target.closest('[data-region-btn]')) {
    document.querySelectorAll('.province').forEach(p => p.classList.remove('region-highlighted', 'region-dimmed'));
    document.querySelectorAll('.dock-btn[data-region-btn]').forEach(b => b.classList.remove('active'));
    regionActive = null;
    translateX = 0;
    translateY = 0;
    ajusterZoom(ZOOM_MIN);
  }
});

// Initialisation de sécurité au démarrage
ajusterZoom(ZOOM_MIN);

// =========================================================
// 6. DOUBLE-TAP SUR MOBILE POUR RÉINITIALISER
// =========================================================
let lastTapTime = 0;
let touchStartX = 0;
let touchStartY = 0;

if (carteContainer) {
  // On mémorise où le doigt se pose
  carteContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  carteContainer.addEventListener('touchend', (e) => {
    // 🛑 SÉCURITÉ 1 : On bloque si on vient de zoomer il y a moins de 500ms
    if (new Date().getTime() - lastPinchEndTime < 500) return;

    if (e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const distance = Math.hypot(endX - touchStartX, endY - touchStartY);

      // 🛑 SÉCURITÉ 2 : Si le doigt a glissé de plus de 10px, c'est un drag, pas un tap
      if (distance > 10) return;

      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTapTime;
      
      if (tapLength < 300 && tapLength > 0) {
        e.preventDefault(); 
        
        if (document.body.classList.contains('fiche-mode')) {
          const btnRetour = document.getElementById('retourCarte');
          if (btnRetour) btnRetour.click();
        } else {
          translateX = 0;
          translateY = 0;
          document.documentElement.style.setProperty('--stroke-dynamic-width', `${0.6 / Math.sqrt(ZOOM_MIN)}px`);
          ajusterZoom(ZOOM_MIN);
          if (svgMap) {
            svgMap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease';
            appliquerTransformation();
          }
        }
      }
      lastTapTime = currentTime;
    }
  });

// =========================================================
// GESTION DE LA FICHE (FERMETURE ET TIROIR 3 ÉTAPES)
// =========================================================
const sidebarLeft = document.querySelector('.app-sidebar-left');

// Fonction universelle de fermeture
function fermerFiche() {
  document.body.classList.remove('fiche-mode', 'zoomed');
  document.querySelectorAll('.province').forEach(p => p.classList.remove('active-province'));
  if (sidebarLeft) sidebarLeft.classList.remove('sheet-expanded'); 
  
  zoomScale = ZOOM_MIN;
  translateX = 0;
  translateY = 0;
  document.documentElement.style.setProperty('--stroke-dynamic-width', `${0.6 / Math.sqrt(ZOOM_MIN)}px`);
  
  if (svgMap) {
    svgMap.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease, opacity 0.3s ease';
  }
  appliquerTransformation();
}

// 1. Bouton retour classique (Pour PC)
const btnRetour = document.getElementById('retourCarte') || document.querySelector('.btn-retour');
if (btnRetour) {
  btnRetour.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    fermerFiche();
  });
}

// 2. Logique du Tiroir Tactile (Mobile)
let startYSheet = 0;
let actionRealisee = false; // 🌟 LE VERROU : Empêche de déclencher 2 choses en un seul glissement

if (sidebarLeft) {
  sidebarLeft.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 768) return;
    startYSheet = e.touches[0].clientY; 
    actionRealisee = false; // 🌟 On réinitialise le verrou à chaque fois qu'on pose le doigt
  }, { passive: true });

  sidebarLeft.addEventListener('touchmove', (e) => {
    if (window.innerWidth > 768) return;
    if (actionRealisee) return; // 🌟 Si une action a déjà été faite, on ignore le reste du mouvement
    
    const currentY = e.touches[0].clientY;
    const diffY = startYSheet - currentY; 

    if (sidebarLeft.scrollTop <= 0) {
      
      if (diffY > 40 && !sidebarLeft.classList.contains('sheet-expanded')) {
        // ACTION 1 : Agrandir la fiche
        sidebarLeft.classList.add('sheet-expanded');
        actionRealisee = true; // On verrouille
      } 
      else if (diffY < -40) {
        if (sidebarLeft.classList.contains('sheet-expanded')) {
          // ACTION 2 : Réduire la fiche (mais ne pas la fermer)
          sidebarLeft.classList.remove('sheet-expanded');
          actionRealisee = true; // On verrouille, il faudra lever le doigt pour fermer
        } else {
          // ACTION 3 : Fermer complètement la fiche
          fermerFiche();
          actionRealisee = true; // On verrouille
        }
      }
    }
  }, { passive: true });
}
}
