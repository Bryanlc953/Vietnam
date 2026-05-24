// =========================================================
// VARIABLES GLOBALES
// =========================================================
const carteContainer = document.getElementById('carteContainer');
const svgMap = document.getElementById('svgVietnam');
const hoverLabel = document.getElementById('province-hover-label');

const isMobileInit = window.innerWidth <= 768;

// 🌟 ZOOM_MIN n'est plus une constante, il est plus petit sur mobile (0.7)
let ZOOM_MIN = isMobileInit ? 0.7 : 1.0; 
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
    
    const isMobile = window.innerWidth <= 768;
    
    // 🌟 1. On réduit fortement le zoom pour mobile
    zoomScale = isMobile ? 1.4 : 2.4; 
    
    const correctionsManuelles = {
      "LamDong": { x: -580, y: 10 }
    };
    
    // 🌟 2. On calcule sur la taille fixe du conteneur (qui gère bien Safari grâce au 100dvh)
    const conteneurHauteur = carteContainer.getBoundingClientRect().height;
    
    // 🌟 3. Sur mobile, on remonte la carte visuellement de 25% pour qu'elle s'affiche au-dessus de la fiche
    let pointAncrageX = isMobile ? 0 : 730; 
    let pointAncrageY = isMobile ? -(conteneurHauteur * 0.25) : 0; 
    
    // On n'applique les corrections manuelles (décalage à gauche) que sur PC
    if (correctionsManuelles[id] && !isMobile) {
      pointAncrageX += correctionsManuelles[id].x;
      pointAncrageY += correctionsManuelles[id].y;
    }
    
    translateX = (svgCenterX - provinceX) * pixelRatio * zoomScale + pointAncrageX;
    translateY = (svgCenterY - provinceY) * pixelRatio * zoomScale + pointAncrageY;
    // 📱 --- FIN DU BLOC RESPONSIVE ---
    
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

// Événements de Drag (Glissement)
// =========================================================
// DRAG & DROP (SOURIS ET TACTILE)
// =========================================================

// Fonction de démarrage du glissement
const startDrag = (clientX, clientY) => {
  startClickX = clientX;
  startClickY = clientY;
  if (zoomScale > ZOOM_MIN) {
    isPanning = true;
    svgMap.style.transition = 'none'; 
    startX = clientX - translateX;
    startY = clientY - translateY;
  }
};

// Fonction de déplacement
const doDrag = (clientX, clientY) => {
  if (!isPanning) return;
  if (document.body.classList.contains('fiche-mode')) userInteractedWithZoom = true;
  
  const limiteX = (zoomScale - ZOOM_MIN) * 800;
  const limiteY = (zoomScale - ZOOM_MIN) * 1000;
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

if (svgMap) {
  // --- ÉVÉNEMENTS SOURIS (PC) ---
  svgMap.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => doDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  // --- ÉVÉNEMENTS TACTILES (MOBILE) ---
  svgMap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
      e.preventDefault(); // Empêche l'écran du téléphone de défiler
      doDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  
  window.addEventListener('touchend', endDrag);
}

// Bouton Retour
document.getElementById('retourCarte')?.addEventListener('click', () => {
  document.body.classList.remove('fiche-mode');
  document.querySelectorAll('.province').forEach(p => p.classList.remove('active-province'));
  
  if (!userInteractedWithZoom) {
    translateX = 0;
    translateY = 0;
    ajusterZoom(ZOOM_MIN);
  } else {
    if (svgMap) svgMap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    appliquerTransformation();
  }
});

// =========================================================
// 4. ANIMATION DE LA BARRE DE RECHERCHE
// =========================================================
const searchContainer = document.getElementById('searchContainer');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const inputRecherche = document.getElementById('searchProvince');

if (searchToggleBtn && searchContainer && inputRecherche) {
  searchToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    searchContainer.classList.toggle('active');
    
    if (searchContainer.classList.contains('active')) {
      setTimeout(() => inputRecherche.focus(), 100);
    } else {
      inputRecherche.value = '';
    }
  });

  document.addEventListener('click', (e) => {
    if (searchContainer.classList.contains('active') && !searchContainer.contains(e.target)) {
      searchContainer.classList.remove('active');
      inputRecherche.value = '';
    }
  });
}

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
  "Nord":   { scale: 1.4, x: 600, y: 300 }, // Zoom plus doux, et décalé vers le haut
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
