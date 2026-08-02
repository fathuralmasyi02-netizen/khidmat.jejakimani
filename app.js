// Register Service Worker for PWA Add to Homescreen
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully. Scope:', reg.scope))
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}

window.deferredVendorPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredVendorPrompt = e;
});

/* ==========================================================================
   TIM KHIDMAT JEJAK IMANI - CORE APPLICATION SCRIPT (UPDATED PHASE 3)
   Provides: SPA Router, Search Autocomplete, Saudi Date & Hijri year fix,
             Green Notification Dot, User Dashboard (Status Apply, Direct Wallet Click),
             Attendance Validation, Tabular Itinerary with Toggles, Conditionally Dynamic
             Plotting Forms in popup modals, Edit/Delete in Vendors & Bookings, Relational
             5-Section Manifest Popup with Auto-Sum Pax Calculator, Tabular Roomlist,
             and Pinned SOP Group Document Filter.
   ========================================================================== */

// --- 1. LOCAL DATABASE STATE (localStorage) ---
const DEFAULT_STATE = {
  users: [
    { username: "adminkhidmat", password: "35rbjamaah", role: "admin", name: "Admin Saudi Operational", whatsapp: "+966500000000", region: "Saudi Arabia", pendingApproval: false }
  ],
  groups: [],
  itineraries: [],
  assignments: [],
  assignmentOffers: [],
  rooms: [],
  documents: [],
  financial: {
    mainBalance: 0,
    wallets: {},
    transactions: [],
    expenses: [],
    deleteRequests: []
  },
  reports: {
    attendance: [],
    incidents: []
  },
  vendors: [],
  bookings: [],
  assets: [],
  notifications: [],
  lastReadNotificationTimestamp: 0
};

// Global variables for Monthly Calendar Navigator
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

// Global variable for Itinerary View mode ("grup" or "gabungan")
let adminItiViewMode = "grup";
let adminTaskViewMode = "grup";

// Document filter variable (Admin)
let adminDocGroupFilter = "";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCnzZ0q8O7E6TAEjjWinB_c2DJ-gNtJ6wo",
  authDomain: "khidmat-jejakimani.firebaseapp.com",
  projectId: "khidmat-jejakimani",
  storageBucket: "khidmat-jejakimani.firebasestorage.app",
  messagingSenderId: "326697842694",
  appId: "1:326697842694:web:37412e495dda69f9baeb87",
  measurementId: "G-HQCGVQ9GTY",
  databaseURL: "https://khidmat-jejakimani-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
let firebaseDb = null;
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.database();
    console.log("Firebase App & Realtime Database initialized successfully at URL: " + firebaseConfig.databaseURL);
  } catch (e) {
    console.warn("Firebase failed to initialize. Using localStorage fallback.", e);
  }
} else {
  console.warn("Firebase SDK not loaded. Using localStorage fallback.");
}

let state = {};
let isFirebaseListenerRegistered = false;
let isFirebaseConnected = false;

function updateDbStatusUI() {
  const dots = document.querySelectorAll(".db-status-dot");
  const texts = document.querySelectorAll(".db-status-text");
  
  dots.forEach(dot => {
    if (dot) {
      dot.style.backgroundColor = isFirebaseConnected ? "#10b981" : "#ef4444";
      dot.style.boxShadow = isFirebaseConnected ? "0 0 8px #10b981" : "0 0 8px #ef4444";
    }
  });
  
  texts.forEach(text => {
    if (text) {
      text.textContent = isFirebaseConnected ? "Terhubung (Realtime)" : "Terputus (Lokal)";
    }
  });
}


function applyGlobalFontSize(size = null) {
  const preferredSize = size || (typeof localStorage !== 'undefined' ? localStorage.getItem("jejak_imani_font_size") : "normal") || "normal";
  const scaleMap = {
    small: "90%",
    normal: "100%",
    large: "110%",
    xlarge: "122%"
  };
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.fontSize = scaleMap[preferredSize] || "100%";
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem("jejak_imani_font_size", preferredSize);
  }
  return preferredSize;
}


function formatAbsenDateTime(dateStr, timeStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    let dateFormatted = dateStr;
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const monthsShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      if (monthsShort[monthIdx]) {
        dateFormatted = `${day} ${monthsShort[monthIdx]} ${year}`;
      }
    }
    const finalTime = timeStr ? (timeStr.includes(':') && timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr) : '00:00:00';
    return `${dateFormatted} | ${finalTime}`;
  } catch(e) {
    return `${dateStr} | ${timeStr || '00:00:00'}`;
  }
}


function sendPushNotification(title, bodyText) {
  if (typeof window === 'undefined' || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: bodyText,
        icon: "assets/icon.png"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, {
            body: bodyText,
            icon: "assets/icon.png"
          });
        }
      });
    }
  } catch(e) {
    console.warn("Notification error:", e);
  }
}


function formatReportDateAbbrev(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1]) - 1;
      const day = parts[2].padStart(2, '0');
      const monthsAbbrev = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agust", "Sep", "Okt", "Nov", "Des"];
      if (monthsAbbrev[monthIdx]) {
        return `${day} ${monthsAbbrev[monthIdx]} ${year}`;
      }
    }
    return dateStr;
  } catch(e) {
    return dateStr;
  }
}


function generateComposite2x2Grid(photoDataUrls, callback) {
  const validPhotos = (photoDataUrls || []).filter(p => !!p);
  if (validPhotos.length === 0) {
    callback([]);
    return;
  }
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 600);

    const tileSize = 297;
    const coords = [
      [0, 0, tileSize, tileSize],
      [303, 0, tileSize, tileSize],
      [0, 303, tileSize, tileSize],
      [303, 303, tileSize, tileSize]
    ];

    let loadedCount = 0;
    const targetCount = Math.min(validPhotos.length, 4);
    const loadedImgs = [];

    validPhotos.slice(0, 4).forEach((src, idx) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        loadedImgs[idx] = img;
        loadedCount++;
        if (loadedCount === targetCount) {
          loadedImgs.forEach((im, i) => {
            if (im && coords[i]) {
              const [dx, dy, dw, dh] = coords[i];
              const sw = im.naturalWidth || im.width;
              const sh = im.naturalHeight || im.height;
              const minDim = Math.min(sw, sh);
              const sx = (sw - minDim) / 2;
              const sy = (sh - minDim) / 2;
              ctx.drawImage(im, sx, sy, minDim, minDim, dx, dy, dw, dh);
            }
          });
          
          try {
            const compositeDataUrl = canvas.toDataURL("image/jpeg", 0.90);
            callback([compositeDataUrl]);
          } catch(e) {
            callback(validPhotos);
          }
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === targetCount) callback(validPhotos);
      };
      img.src = src;
    });
  } catch(e) {
    callback(validPhotos);
  }
}

function ensureStateCompat() {
  const ensureArray = (val, defaultVal = []) => {
    return Array.isArray(val) ? val.filter(x => x !== null && x !== undefined) : defaultVal;
  };
  
  state.users = ensureArray(state.users, DEFAULT_STATE.users);
  
  // Migration: Ensure legacy "admin" user is converted to new "adminkhidmat" / "Admin Saudi Operational"
  let hasAdmin = false;
  state.users = state.users.map(u => {
    if (u.username === "admin" || u.name === "Ustadz H. Haris" || u.role === "admin") {
      hasAdmin = true;
      return {
        username: "adminkhidmat",
        password: "35rbjamaah",
        role: "admin",
        name: "Admin Saudi Operational",
        whatsapp: "+966500000000",
        region: "Saudi Arabia",
        pendingApproval: false
      };
    }
    return u;
  });
  
  if (!hasAdmin) {
    state.users.unshift({
      username: "adminkhidmat",
      password: "35rbjamaah",
      role: "admin",
      name: "Admin Saudi Operational",
      whatsapp: "+966500000000",
      region: "Saudi Arabia",
      pendingApproval: false
    });
  }
  
  // Also migrate currentUser session if logged in as legacy admin
  if (state.currentUser && (state.currentUser.username === "admin" || state.currentUser.name === "Ustadz H. Haris" || state.currentUser.role === "admin")) {
    state.currentUser = {
      username: "adminkhidmat",
      password: "35rbjamaah",
      role: "admin",
      name: "Admin Saudi Operational",
      whatsapp: "+966500000000",
      region: "Saudi Arabia",
      pendingApproval: false
    };
    localStorage.setItem("jejak_imani_session", JSON.stringify(state.currentUser));
  }
  state.groups = ensureArray(state.groups, DEFAULT_STATE.groups);
  state.itineraries = ensureArray(state.itineraries, DEFAULT_STATE.itineraries);
  state.assignments = ensureArray(state.assignments, DEFAULT_STATE.assignments);
  state.assignments.forEach(a => {
    if (a && typeof a === "object") {
      if (!Array.isArray(a.staff)) a.staff = [];
      if (!Array.isArray(a.applicants)) a.applicants = [];
      if (!a.details || typeof a.details !== "object") a.details = {};
    }
  });
  state.assignmentOffers = ensureArray(state.assignmentOffers, DEFAULT_STATE.assignmentOffers);
  state.vendors = ensureArray(state.vendors, DEFAULT_STATE.vendors);
  state.bookings = ensureArray(state.bookings, DEFAULT_STATE.bookings).filter(b => b && b.id !== 'b-1' && b.id !== 'b-2' && b.id !== 'b-3');
  
  if (!state.reports || typeof state.reports !== "object") {
    state.reports = { attendance: [], incidents: [] };
  }
  state.reports.attendance = ensureArray(state.reports.attendance);
  state.reports.incidents = ensureArray(state.reports.incidents);
  
  if (!state.financial || typeof state.financial !== "object") {
    state.financial = { mainBalance: 0, wallets: {}, vendorWallets: {}, expenses: [], deleteRequests: [], transactions: [] };
  }
  if (typeof state.financial.mainBalance !== "number") state.financial.mainBalance = 0;
  if (!state.financial.wallets || typeof state.financial.wallets !== "object") state.financial.wallets = {};
  if (!state.financial.vendorWallets || typeof state.financial.vendorWallets !== "object") state.financial.vendorWallets = {};
  const dedupeById = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr.filter(x => {
      if (!x || typeof x !== "object") return false;
      const key = x.id || JSON.stringify(x);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  
  state.financial.expenses = dedupeById(ensureArray(state.financial.expenses));
  state.financial.deleteRequests = dedupeById(ensureArray(state.financial.deleteRequests));
  state.financial.transactions = dedupeById(ensureArray(state.financial.transactions));
  
  state.notifications = ensureArray(state.notifications);
  
  state.rooms = ensureArray(state.rooms, DEFAULT_STATE.rooms || []);
  state.rooms.forEach(room => {
    if (room && typeof room === "object") {
      room.guests = ensureArray(room.guests, []);
      room.guests.forEach(g => {
        if (g && typeof g === "object" && !g.uniqueCode) {
          const num = parseInt(g.guestNo) || 1;
          g.uniqueCode = "JIBB-" + String(num).padStart(4, "0");
        }
      });
    }
  });
  
  // Backwards compatibility for dates
  state.groups.forEach(g => {
    if (g) {
      if (!g.dateStart) g.dateStart = g.flightArrival?.[0]?.date || "2026-07-16";
      if (!g.dateEnd) g.dateEnd = g.flightDeparture?.[0]?.date || "2026-07-24";
    }
  });
  
  // Clean notification > 24 Hours
  const oneDayAgo = Date.now() - 86400000;
  if (state.notifications) {
    state.notifications = state.notifications.filter(n => n.timestamp > oneDayAgo);
  }

  // Production Ready: Ensure documents array exists
  state.documents = ensureArray(state.documents, []);

  // Keep user itineraries, assignments, and assignment offers intact
}

let isFirebaseRemoteLoaded = false;

function mergeStates(remote, local) {
  if (!remote || typeof remote !== 'object') {
    return {
      currentUser: local ? local.currentUser : null,
      users: (local && local.users) || [],
      groups: [],
      itineraries: [],
      assignments: [],
      assignmentOffers: [],
      vendors: [],
      bookings: [],
      rooms: [],
      documents: [],
      financial: { mainBalance: 0, wallets: {}, expenses: [], deleteRequests: [], transactions: [] },
      reports: { attendance: [], incidents: [] }
    };
  }

  return {
    currentUser: local ? local.currentUser : null,
    users: Array.isArray(remote.users) ? remote.users : ((local && local.users) || []),
    groups: Array.isArray(remote.groups) ? remote.groups : [],
    itineraries: Array.isArray(remote.itineraries) ? remote.itineraries : [],
    assignments: Array.isArray(remote.assignments) ? remote.assignments : [],
    assignmentOffers: Array.isArray(remote.assignmentOffers) ? remote.assignmentOffers : [],
    vendors: Array.isArray(remote.vendors) ? remote.vendors : [],
    bookings: Array.isArray(remote.bookings) ? remote.bookings : [],
    rooms: Array.isArray(remote.rooms) ? remote.rooms : [],
    documents: Array.isArray(remote.documents) ? remote.documents : [],
    financial: {
      mainBalance: (remote.financial && typeof remote.financial.mainBalance === 'number') ? remote.financial.mainBalance : 0,
      wallets: (remote.financial && remote.financial.wallets) || {},
      expenses: (remote.financial && Array.isArray(remote.financial.expenses)) ? remote.financial.expenses : [],
      deleteRequests: (remote.financial && Array.isArray(remote.financial.deleteRequests)) ? remote.financial.deleteRequests : [],
      transactions: (remote.financial && Array.isArray(remote.financial.transactions)) ? remote.financial.transactions : []
    },
    reports: {
      attendance: (remote.reports && Array.isArray(remote.reports.attendance)) ? remote.reports.attendance : [],
      incidents: (remote.reports && Array.isArray(remote.reports.incidents)) ? remote.reports.incidents : []
    }
  };
}

function saveStateNode(nodeKey) {
  if (!nodeKey || nodeKey === 'currentUser') return;
  localStorage.setItem("jejak_imani_v2_db", JSON.stringify(state));
  
  if (firebaseDb && isFirebaseRemoteLoaded && state[nodeKey] !== undefined) {
    try {
      firebaseDb.ref('jejak_imani_v2_db/' + nodeKey).set(state[nodeKey]);
      console.log(`[Firebase Granular Sync] Successfully pushed node '${nodeKey}' to cloud.`);
    } catch(e) {
      console.warn(`[Firebase Granular Sync Error] Failed pushing '${nodeKey}':`, e);
    }
  }
}

function loadState() {
  const local = localStorage.getItem("jejak_imani_v2_db");
  if (local) {
    try {
      const parsedLocal = JSON.parse(local);
      if (parsedLocal && typeof parsedLocal === "object") {
        state = parsedLocal;
      } else if (!state || typeof state !== "object") {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch (e) {
      if (!state || typeof state !== "object") {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    }
  } else if (!state || typeof state !== "object") {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  
  ensureStateCompat();
  applyGlobalFontSize();
  
  // Load session
  const session = localStorage.getItem("jejak_imani_session");
  if (session) {
    try {
      state.currentUser = JSON.parse(session);
    } catch (e) {
      state.currentUser = null;
    }
  } else {
    state.currentUser = null;
  }

  // Register real-time sync with Firebase (Granular & Smart Merge)
  if (firebaseDb && !isFirebaseListenerRegistered) {
    isFirebaseListenerRegistered = true;
    console.log("Registering Firebase Realtime Database granular value listener...");
    
    try {
      firebaseDb.ref('.info/connected').on('value', (snap) => {
        isFirebaseConnected = (snap.val() === true);
        console.log("Firebase connection status changed:", isFirebaseConnected);
        updateDbStatusUI();
      });
    } catch(e) {
      console.warn("Failed to attach .info/connected listener:", e);
    }
    
    firebaseDb.ref('jejak_imani_v2_db').on('value', (snapshot) => {
      const data = snapshot.val();
      isFirebaseRemoteLoaded = true;
      console.log("Firebase database on('value') listener triggered. Remote data received.");
      
      const mergedState = mergeStates(data, state);
      
      const localToCompare = {};
      for (let k in state) {
        if (k !== 'currentUser') {
          localToCompare[k] = state[k];
        }
      }
      
      const serializedLocal = JSON.stringify(localToCompare);
      const serializedMerged = JSON.stringify(mergedState);
      
      if (serializedLocal === serializedMerged) {
        console.log("[Firebase Sync] Remote & merged state identical to local. Skipping re-render.");
        return;
      }
      
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      const isEditing = activeTag === "input" || activeTag === "textarea" || activeTag === "select" || (document.activeElement && document.activeElement.isContentEditable);
      
      const localCurrentUser = state.currentUser;
      state = mergedState;
      state.currentUser = localCurrentUser;
      ensureStateCompat();
      
      localStorage.setItem("jejak_imani_v2_db", JSON.stringify(state));
      
      if (isEditing) {
        console.log("[Firebase Sync] User is typing in a form field. Updated state in memory, skipping router() call.");
        return;
      }
      
      console.log("[Firebase Sync] Updated state strictly from cloud.");
      const modalContainer = document.getElementById("modal-container");
      const isModalOpen = modalContainer && !modalContainer.classList.contains("hidden");
      
      router();
      updateDbStatusUI();
      
      if (isModalOpen && modalContainer) {
        modalContainer.classList.remove("hidden");
      }
    }, (error) => {
      console.error("Firebase read/write database listener failed:", error);
    });
  }
}

function saveState() {
  localStorage.setItem("jejak_imani_v2_db", JSON.stringify(state));
  if (state.currentUser) {
    localStorage.setItem("jejak_imani_session", JSON.stringify(state.currentUser));
  } else {
    localStorage.removeItem("jejak_imani_session");
  }
  
  // STRICT CLOUD CENTRALIZATION: Pushes user-initiated mutations directly to Firebase Realtime Database
  if (firebaseDb && isFirebaseRemoteLoaded && isFirebaseConnected) {
    const stateToSave = {};
    for (let k in state) {
      if (k !== 'currentUser') {
        stateToSave[k] = state[k];
      }
    }
    try {
      firebaseDb.ref('jejak_imani_v2_db').update(stateToSave);
    } catch(e) {
      console.warn("Firebase saveState update error:", e);
    }
  }
}

function addNotification(type, message, metadata = {}) {
  state.notifications.push({
    id: `n-${Date.now()}`,
    type,
    message,
    timestamp: Date.now(),
    metadata
  });
  saveState();
}

loadState();

function downloadDatabaseBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = getSaudiDateTime().gregorianStr.replace(/\//g, '-');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Backup_Khidmat_JejakImani_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("File backup JSON berhasil diunduh!");
}

function restoreDatabaseBackup() {
  if (!confirm("PERINGATAN PEMULIHAN DATA:\n\nApakah Anda yakin ingin memulihkan database dari file backup?\nProses ini akan menimpa seluruh data sistem saat ini dengan data dari file backup yang diunggah.")) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedState = JSON.parse(evt.target.result);
        if (importedState && typeof importedState === 'object' && !Array.isArray(importedState)) {
          // Verify presence of at least basic schema components
          const hasKnownKey = importedState.users || importedState.groups || importedState.assignments || importedState.financial || importedState.vendors;
          if (!hasKnownKey) {
            showToast("File JSON bukan file backup valid Khidmat Jejak Imani!", "error");
            return;
          }

          const localUser = state.currentUser;
          state = importedState;
          state.currentUser = localUser;
          ensureStateCompat();
          saveState();
          showToast("Data backup berhasil dipulihkan & disinkronkan ke cloud!");
          router();
        } else {
          showToast("Format file backup JSON tidak valid!", "error");
        }
      } catch (err) {
        showToast("Gagal membaca file backup JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}


// Helper to display dates as DD/MM/YYYY

function getHexColor(colorName) {
  const map = {
    Gold: '#c5a850', Emerald: '#10b981', Ruby: '#ef4444', Sapphire: '#3b82f6',
    Amber: '#f59e0b', Violet: '#8b5cf6', Rose: '#f43f5e', Slate: '#64748b',
    Teal: '#14b8a6', Bronze: '#cd7f32'
  };
  return map[colorName] || '#666';
}


function formatDateShortMonth(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const monthsShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      if (monthsShort[monthIdx]) {
        return `${day} ${monthsShort[monthIdx]} ${year}`;
      }
    }
    return formatDateDisplay(dateStr);
  } catch(e) {
    return dateStr;
  }
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "-";
  const str = String(dateStr);
  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return str;
}

// --- 2. SAUDI TIME & CALENDAR HELPERS (GMT+3) ---
function getSaudiDateTime() {
  const pad = (num) => String(num).padStart(2, '0');
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const saudiDate = new Date(utc + (3600000 * 3));
  
  const gregorianStr = `${pad(saudiDate.getDate())}/${pad(saudiDate.getMonth() + 1)}/${saudiDate.getFullYear()}`;
  const gregorianLongStr = saudiDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  const hijriOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', hijriOptions);
  
  let hijriStr = hijriFormatter.format(saudiDate);
  // Fail-safe check duplicate H
  if (hijriStr.includes(" H")) {
    // Already contains year indicator
  } else {
    hijriStr += " H";
  }
  
  const timeStr = `${pad(saudiDate.getHours())}:${pad(saudiDate.getMinutes())}:${pad(saudiDate.getSeconds())}`;
  
  return { gregorianStr, gregorianLongStr, hijriStr, timeStr, saudiDate };
}

// Live clock updating
setInterval(() => {
  const widgets = document.querySelectorAll('.saudi-clock-widget');
  if (widgets.length > 0) {
    const { timeStr } = getSaudiDateTime();
    widgets.forEach(w => w.textContent = timeStr);
  }
}, 1000);

// --- 3. TOAST & MODAL OVERLAYS ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon = "check-circle";
  if (type === "error") icon = "alert-circle";
  
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();

  const pvPrintBtn = document.getElementById("pv-print-pdf-btn");
  if (pvPrintBtn) {
    pvPrintBtn.onclick = () => openVendorPdfOptionsModal(vendor.id);
  }




  // Bind search for Dompet Vendor widget
  const searchVendorInput = document.getElementById("admin-financial-dompet-vendor-search");
  if (searchVendorInput) {
    searchVendorInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listEl = document.getElementById("admin-financial-dompet-vendor-list");
      if (!listEl) return;
      
      const filteredVendors = state.vendors.filter(v => v.name.toLowerCase().includes(q) || (v.type && v.type.toLowerCase().includes(q)));
      if (filteredVendors.length === 0) {
        listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:12px 0; width:100%;">Tidak ada vendor ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filteredVendors.map(v => {
        const bal = (state.financial.vendorWallets && state.financial.vendorWallets[v.id]) || 0;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
            <div>
              <div style="font-weight:700; font-size:0.85rem;">${v.name}</div>
              <div style="font-size:0.7rem; color:#64748b;">${v.type || 'Vendor'}</div>
            </div>
            <span style="font-weight:800; font-size:0.85rem; color:${bal < 0 ? '#ef4444' : '#10b981'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Minus)' : ''}</span>
          </div>
        `;
      }).join('');
    };
  }

  
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) reverse";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function openModal(title, bodyHTML) {
  const modal = document.getElementById("modal-container");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  if (!modal || !modalTitle || !modalBody) return;
  
  if (state.currentUser && state.currentUser.role === "user") {
    modal.classList.add("is-bottom-sheet");
  } else {
    modal.classList.remove("is-bottom-sheet");
  }
  
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modal.classList.remove("hidden");
  
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.onclick = closeModal;
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById("modal-container");
  if (modal) modal.classList.add("hidden");
}

window.addEventListener("click", (e) => {
  const modal = document.getElementById("modal-container");
  if (e.target === modal) closeModal();
});

// --- 4. AUTOCOMPLETE SUGGESTION ENGINE ---
function initSuggestionInput(inputId, containerId, dataList, onSelect) {
  const inputEl = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!inputEl || !container) return;
  
  if (inputEl.parentNode && inputEl.parentNode.classList) {
    inputEl.parentNode.classList.add("suggestion-wrapper");
  }
  inputEl.setAttribute("autocomplete", "off");
  
  inputEl.onfocus = () => showList(inputEl.value);
  inputEl.oninput = () => showList(inputEl.value);
  
  document.addEventListener("click", (e) => {
    if (e.target !== inputEl && e.target !== container && !container.contains(e.target)) {
      container.classList.add("hidden");
    }
  });
  
  function showList(val) {
    const query = val.toLowerCase().trim();
    const filtered = dataList.filter(item => item.toLowerCase().includes(query));
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="suggestion-item" style="color:var(--text-light); cursor:default;">Tidak ditemukan hasil</div>`;
    } else {
      container.innerHTML = filtered.map(item => `<div class="suggestion-item">${item}</div>`).join('');
      const items = container.querySelectorAll(".suggestion-item");
      items.forEach(el => {
        el.onclick = () => {
          inputEl.value = el.textContent;
          container.classList.add("hidden");
          if (onSelect) onSelect(el.textContent);
        };
      });
    }
    container.classList.remove("hidden");
  }
}

// --- 5. HASH ROUTER ---
const APP_CONTAINER = document.getElementById("app");

function router() {
  loadState();
  const hash = window.location.hash || "#login";
  
  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    let manifestLink = document.getElementById('app-manifest') || document.querySelector('link[rel="manifest"]');
    let titleMeta = document.getElementById('app-title-meta') || document.querySelector('meta[name="apple-mobile-web-app-title"]');
    let nameMeta = document.getElementById('app-name-meta') || document.querySelector('meta[name="application-name"]');

    if (hash.startsWith("#vendor-view") || hash.startsWith("#vendor")) {
      const params = new URLSearchParams(hash.split("?")[1] || "");
      const vId = params.get("id") || "";
      const manifestUrl = `vendor-manifest.json?id=${vId}`;

      document.title = "Vendor JI";
      if (manifestLink) manifestLink.setAttribute('href', manifestUrl);
      if (titleMeta) titleMeta.setAttribute('content', 'Vendor JI');
      if (nameMeta) nameMeta.setAttribute('content', 'Vendor JI');
    } else {
      document.title = "Tim Khidmat jejak imani - Saudi Handling Operations";
      if (manifestLink && manifestLink.getAttribute('href') !== 'manifest.json') {
        manifestLink.setAttribute('href', 'manifest.json');
      }
      if (titleMeta) titleMeta.setAttribute('content', 'Khidmat JI');
      if (nameMeta) nameMeta.setAttribute('content', 'Khidmat JI');
    }
  }

  if (hash.startsWith("#vendor-view") || hash.startsWith("#vendor")) {
    renderPublicVendorPortal();
    lucide.createIcons();
    updateDbStatusUI();
    return;
  }
  
  if (!state.currentUser && hash !== "#login" && hash !== "#register") {
    window.location.hash = "#login";
    return;
  }
  
  if (state.currentUser) {
    if (hash === "#login" || hash === "#register") {
      window.location.hash = state.currentUser.role === "admin" ? "#admin/dashboard" : "#user/dashboard";
      return;
    }
    
    // Auth guards
    if (state.currentUser.role === "user" && hash.startsWith("#admin/")) {
      window.location.hash = "#user/dashboard";
      showToast("Akses ditolak: Area khusus administrator.", "error");
      return;
    }
    if (state.currentUser.role === "admin" && hash.startsWith("#user/")) {
      window.location.hash = "#admin/dashboard";
      return;
    }
  }
  
  if (hash === "#login") renderLogin();
  else if (hash === "#register") renderRegister();
  else if (hash.startsWith("#user/")) renderUserPortal(hash.replace("#user/", ""));
  else if (hash.startsWith("#admin/")) renderAdminPortal(hash.replace("#admin/", ""));
  
  lucide.createIcons();
  updateDbStatusUI();
}

window.addEventListener("hashchange", router);
window.addEventListener("load", router);

// --- 6. RENDER LOGIN ---
function renderLogin() {
  APP_CONTAINER.innerHTML = `
    <div class="login-container">
      <div class="login-card glass-card">
        <div class="login-header">
          <img src="assets/logo.png" alt="Logo jejak imani" class="login-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h2 class="login-title">Tim Khidmat</h2>
          <p class="login-subtitle">Silakan login menggunakan username terdaftar</p>
        </div>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input type="text" id="username" class="form-input" placeholder="Masukkan username" required autocomplete="username">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Masukkan password" required autocomplete="current-password">
          </div>
          
          <button type="submit" class="btn btn-primary">MASUK</button>
        </form>
        
        <div class="login-footer">
          Belum punya akun? <span class="login-footer-link" id="go-register">Daftar Akun Baru</span>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("go-register").onclick = () => window.location.hash = "#register";
  
  document.getElementById("login-form").onsubmit = (e) => {
    e.preventDefault();
    const userVal = document.getElementById("username").value.trim();
    const passVal = document.getElementById("password").value;
    
    const user = state.users.find(u => u.username === userVal && u.password === passVal);
    if (user) {
      if (user.pendingApproval) {
        showToast("Akun Anda masih menunggu persetujuan (approval) oleh Admin.", "error");
        return;
      }
      state.currentUser = {
        username: user.username,
        role: user.role,
        name: user.name,
        whatsapp: user.whatsapp,
        region: user.region
      };
      saveState();
      showToast(`Assalamu'alaikum, ${user.name}`);
      window.location.hash = user.role === "admin" ? "#admin/dashboard" : "#user/dashboard";
    } else {
      showToast("Username atau Password salah.", "error");
    }
  };
}

// --- 7. RENDER REGISTER ---
function renderRegister() {
  APP_CONTAINER.innerHTML = `
    <div class="login-container">
      <div class="login-card glass-card">
        <div class="login-header">
          <img src="assets/logo.png" alt="Logo jejak imani" class="login-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h2 class="login-title">Daftar Akun</h2>
          <p class="login-subtitle">Registrasi Anggota Tim Baru</p>
        </div>
        
        <form id="register-form">
          <div class="form-group">
            <label class="form-label" for="reg-name">Nama Lengkap</label>
            <input type="text" id="reg-name" class="form-input" placeholder="Nama Lengkap" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-whatsapp">Nomor WhatsApp (dengan kode negara)</label>
            <input type="text" id="reg-whatsapp" class="form-input" placeholder="Contoh: +96650XXXXX" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-region">Wilayah Tugas</label>
            <select id="reg-region" class="form-select" required>
              <option value="Bandara Jeddah">Bandara Jeddah</option>
              <option value="Bandara Madinah">Bandara Madinah</option>
              <option value="Madinah">Madinah</option>
              <option value="Makkah">Makkah</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input type="text" id="reg-username" class="form-input" placeholder="Username untuk login" required autocomplete="username">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-password">Password</label>
            <input type="password" id="reg-password" class="form-input" placeholder="Password" required autocomplete="new-password">
          </div>
          
          <button type="submit" class="btn btn-gold">DAFTAR SEKARANG</button>
        </form>
        
        <div class="login-footer">
          Sudah memiliki akun? <span class="login-footer-link" id="go-login">Masuk Disini</span>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("go-login").onclick = () => window.location.hash = "#login";
  
  document.getElementById("register-form").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const whatsapp = document.getElementById("reg-whatsapp").value.trim();
    const region = document.getElementById("reg-region").value;
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    
    if (state.users.some(u => u.username === username)) {
      showToast("Username sudah digunakan.", "error");
      return;
    }
    
    state.users.push({ username, email: "", password, role: "user", name, whatsapp, region, pendingApproval: true });
    state.financial.wallets[username] = 0;
    saveState();
    
    addNotification("penjadwalan", `Pengajuan Registrasi Baru: ${name} (${username})`);
    
    // Exact whatsapp msg template
    const rawMsg = `Assalamualaikum, saya telah mendaftar akun Tim Khidmat jejak imani. Mohon persetujuan approval akun saya. Dengan detail (${name} - ${username})`;
    const waUrl = `https://wa.me/6281119868080?text=${encodeURIComponent(rawMsg)}`;
    
    showToast("Pendaftaran berhasil diajukan! Mengalihkan ke WhatsApp.");
    setTimeout(() => {
      window.open(waUrl, "_blank");
      window.location.hash = "#login";
    }, 1500);
  };
}

function isTaskAssignedToUser(task, user) {
  if (!task || !user) return false;
  if (!Array.isArray(task.staff) || task.staff.length === 0) return false;

  const targetUsername = String(user.username || "").toLowerCase().trim();
  const targetName = String(user.name || "").toLowerCase().trim();

  return task.staff.some(s => {
    if (!s) return false;
    const sStr = String(s).toLowerCase().trim();
    if (targetUsername && sStr === targetUsername) return true;
    if (targetName && sStr === targetName) return true;
    if (targetUsername && (sStr.includes(`(${targetUsername})`) || sStr.includes(targetUsername))) return true;
    if (targetName && sStr.includes(targetName)) return true;
    return false;
  });
}

// --- 8. PORTAL USER (MOBILE VIEW) ---
function renderUserPortal(subView) {
  const { gregorianLongStr, hijriStr, timeStr } = getSaudiDateTime();
  const activeSubView = subView.split("?")[0];
  
  // Unread green dot tracking
  const myTasks = state.assignments.filter(t => t && isTaskAssignedToUser(t, state.currentUser));
  const myGroups = myTasks.map(t => t.groupName);
  const userNotifications = state.notifications.filter(n => {
    if (n.type === "penjadwalan" && n.message.includes("Pengajuan Registrasi Baru")) return false;
    if (n.metadata) {
      if (n.metadata.username === state.currentUser.username) return true;
      if (n.metadata.groupName && myGroups.includes(n.metadata.groupName)) return true;
    }
    const lowerMsg = n.message.toLowerCase();
    const lowerName = state.currentUser.name.toLowerCase();
    const lowerUser = state.currentUser.username.toLowerCase();
    if (lowerMsg.includes(lowerName) || lowerMsg.includes(lowerUser)) return true;
    return false;
  });
  const hasUnread = userNotifications.some(n => n.timestamp > (state.lastReadNotificationTimestamp || 0));
  
  let headerHtml = "";
  if (activeSubView === "dashboard") {
    headerHtml = `
      <header class="user-header">
        <div class="user-brand-container">
          <img src="assets/logo.png" alt="Logo jejak imani" class="user-header-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h1 class="user-header-title">Tim Khidmat <span class="jejak-imani">jejak imani</span></h1>
        </div>
        <div class="user-actions" style="display:flex; align-items:center; gap:8px;">
          <span class="db-status-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#ef4444; transition: all 0.3s ease;" title="Status Database"></span>
          <button class="user-action-btn" id="user-reload-btn" title="Reload Web" onclick="window.location.reload();">
            <i data-lucide="rotate-cw" style="width: 18px; height: 18px;"></i>
          </button>
          <button class="user-action-btn" id="user-notif-btn" title="Notifikasi">
            <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
            ${hasUnread ? '<span class="badge-dot-green"></span>' : ''}
          </button>
          <button class="user-action-btn" id="user-settings-btn" title="Pengaturan">
            <i data-lucide="settings" style="width: 18px; height: 18px;"></i>
          </button>
        </div>
      </header>
    `;
  } else {
    let subViewTitle = "Menu";
    if (activeSubView === "apply-tugas") subViewTitle = "Daftar Tugas";
    else if (activeSubView === "task-detail") subViewTitle = "Rincian Tugas & Grup";
    else if (activeSubView === "roomlist") subViewTitle = "Roomlist";
    else if (activeSubView === "documents") subViewTitle = "Dokumen";
    else if (activeSubView === "laporan") {
      const tab = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tab");
      if (tab === "absensi") subViewTitle = "Absensi";
      else if (tab === "insiden") subViewTitle = "Laporan";
      else subViewTitle = "Riwayat Transaksi";
    }
    else if (activeSubView === "scan-qr") subViewTitle = "Scan QR";
    
    headerHtml = `
      <header class="user-header" style="justify-content: flex-start; gap: 16px;">
        <button class="user-action-btn" id="user-back-btn" title="Kembali" style="padding: 4px; margin: 0; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="arrow-left" style="width: 24px; height: 24px; color: var(--text-main);"></i>
        </button>
        <h1 class="user-header-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">${subViewTitle}</h1>
      </header>
    `;
  }

  APP_CONTAINER.innerHTML = `
    <div class="user-layout">
      <!-- Header -->
      ${headerHtml}
      
      <!-- Render Workarea -->
      <main class="user-content" id="user-subview-content"></main>
      
      <!-- Floating bottom nav bar -->
      <nav class="user-footer-nav" style="display:grid; grid-template-columns: repeat(2, 1fr);">
        <div class="user-nav-item ${activeSubView === 'dashboard' ? 'active' : ''}" data-target="dashboard">
          <i data-lucide="layout-dashboard"></i>
          <span>Dashboard</span>
        </div>
        <div class="user-nav-item ${activeSubView === 'scan-qr' ? 'active' : ''}" data-target="scan-qr">
          <i data-lucide="qr-code"></i>
          <span>Scan QR</span>
        </div>
      </nav>
    </div>
  `;
  
  // Navigation mapping
  document.querySelectorAll(".user-nav-item").forEach(item => {
    item.onclick = () => window.location.hash = `#user/${item.getAttribute("data-target")}`;
  });
  
  if (activeSubView === "dashboard") {
    // Notifications bell click
    document.getElementById("user-notif-btn").onclick = () => {
      state.lastReadNotificationTimestamp = Date.now();
      saveState();
      
      const greenDot = document.querySelector(".badge-dot-green");
      if (greenDot) greenDot.remove();
      
      const myTasks2 = state.assignments.filter(t => t && isTaskAssignedToUser(t, state.currentUser));
      const myGroups2 = myTasks2.map(t => t.groupName);
      const userNotifications = state.notifications.filter(n => {
        if (n.type === "penjadwalan" && n.message.includes("Pengajuan Registrasi Baru")) return false;
        if (n.metadata) {
          if (n.metadata.username === state.currentUser.username) return true;
          if (n.metadata.groupName && myGroups2.includes(n.metadata.groupName)) return true;
        }
        const lowerMsg = n.message.toLowerCase();
        const lowerName = state.currentUser.name.toLowerCase();
        const lowerUser = state.currentUser.username.toLowerCase();
        if (lowerMsg.includes(lowerName) || lowerMsg.includes(lowerUser)) return true;
        return false;
      });

      const listHtml = userNotifications.length === 0 
        ? `<p style='text-align:center;color:var(--text-muted);font-size:0.9rem;padding:20px;'>Tidak ada notifikasi baru.</p>`
        : `<div class="activity-list" style="box-shadow:none; padding:0;">
            ${userNotifications.slice().reverse().map(n => `
              <div class="activity-item">
                <div class="activity-icon"><i data-lucide="bell"></i></div>
                <div class="activity-body">
                  <div class="activity-text">${n.message}</div>
                  <div class="activity-time">${new Date(n.timestamp).toLocaleTimeString('id-ID')} Saudi</div>
                </div>
              </div>
            `).join('')}
          </div>`;
      openModal("Notifikasi", listHtml);
    };
    
    // Settings profile
    document.getElementById("user-settings-btn").onclick = () => {
      const currentFontSize = localStorage.getItem("jejak_imani_font_size") || "normal";
      const settingsHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--primary-gold); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; margin: 0 auto 10px auto;">
            ${state.currentUser.name.charAt(0)}
          </div>
          <h4 style="font-weight: 800;">${state.currentUser.name}</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Username: <code>${state.currentUser.username}</code></p>
        </div>

        <form id="edit-user-profile-form">
          <div class="form-group">
            <label class="form-label">Nama Lengkap</label>
            <input type="text" id="prof-name" class="form-input" value="${state.currentUser.name}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Nomor WhatsApp</label>
            <input type="text" id="prof-whatsapp" class="form-input" value="${state.currentUser.whatsapp || ''}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Wilayah Operasional</label>
            <select id="prof-region" class="form-select" required>
              <option value="Makkah" ${state.currentUser.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
              <option value="Madinah" ${state.currentUser.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
              <option value="Jeddah" ${state.currentUser.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Ubah Password Baru</label>
            <input type="password" id="prof-pass" class="form-input" placeholder="Kosongkan jika tidak diubah" autocomplete="new-password">
          </div>
          
          <div class="form-group" style="margin-top:16px; margin-bottom:16px; border-top:1px solid #f1f5f9; padding-top:14px;">
            <label class="form-label" style="font-weight:800; color:#0f172a; display:flex; align-items:center; gap:6px;">
              <i data-lucide="type" style="width:16px; height:16px; color:#c5a850;"></i> Ukuran Font Tampilan (Font Size)
            </label>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-top:6px;">
              <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'small' ? 'btn-gold' : 'btn-secondary'}" data-size="small" style="padding:8px 2px; font-size:0.75rem;">Kecil</button>
              <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'normal' ? 'btn-gold' : 'btn-secondary'}" data-size="normal" style="padding:8px 2px; font-size:0.75rem;">Normal</button>
              <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'large' ? 'btn-gold' : 'btn-secondary'}" data-size="large" style="padding:8px 2px; font-size:0.75rem;">Besar</button>
              <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'xlarge' ? 'btn-gold' : 'btn-secondary'}" data-size="xlarge" style="padding:8px 2px; font-size:0.75rem;">Sangat Besar</button>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary" style="margin-bottom:12px;">SIMPAN PROFIL</button>
          <button type="button" id="user-logout" class="btn btn-danger">LOGOUT</button>
        </form>
      `;
      openModal("Pengaturan Akun", settingsHtml);
      lucide.createIcons();
      document.querySelectorAll(".font-size-setting-btn").forEach(btn => {
        btn.onclick = () => {
          const sz = btn.getAttribute("data-size");
          applyGlobalFontSize(sz);
          document.querySelectorAll(".font-size-setting-btn").forEach(b => {
            if (b.getAttribute("data-size") === sz) {
              b.className = "btn font-size-setting-btn btn-gold";
            } else {
              b.className = "btn font-size-setting-btn btn-secondary";
            }
          });
          const labelMap = { small: 'Kecil', normal: 'Normal', large: 'Besar', xlarge: 'Sangat Besar' };
          showToast("Ukuran font diubah ke: " + (labelMap[sz] || 'Normal'));
        };
      });
      
      document.getElementById("user-logout").onclick = () => {
        closeModal();
        state.currentUser = null;
        saveState();
        window.location.hash = "#login";
      };
      
      document.getElementById("edit-user-profile-form").onsubmit = (e) => {
        e.preventDefault();
        const nName = document.getElementById("prof-name").value.trim();
        const nWa = document.getElementById("prof-whatsapp").value.trim();
        const nRegion = document.getElementById("prof-region").value;
        const nPass = document.getElementById("prof-pass").value;
        
        const idx = state.users.findIndex(u => u.username === state.currentUser.username);
        if (idx !== -1) {
          state.users[idx].name = nName;
          state.users[idx].whatsapp = nWa;
          state.users[idx].region = nRegion;
          if (nPass) state.users[idx].password = nPass;
          
          state.currentUser.name = nName;
          state.currentUser.whatsapp = nWa;
          state.currentUser.region = nRegion;
          saveState();
          closeModal();
          showToast("Pengaturan berhasil disimpan.");
          renderUserPortal(subView);
        }
      };
    };
  } else {
    const backBtn = document.getElementById("user-back-btn");
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        if (window.history && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.hash = "#user/apply-tugas";
        }
      };
    }
  }
  
  if (activeSubView === "dashboard") renderUserDashboard();
  else if (activeSubView === "apply-tugas") renderUserApplyTugas();
  else if (activeSubView === "task-detail") renderUserTaskDetailFull();
  else if (activeSubView === "roomlist") renderUserRoomlist();
  else if (activeSubView === "documents") renderUserDocuments();
  else if (activeSubView === "laporan") renderUserLaporan();
  else if (activeSubView === "scan-qr") renderUserScanQr();
  else window.location.hash = "#user/dashboard";
}


function openUserWalletTransferPopup(callbackOnSuccess = null) {
  const username = state.currentUser.username;
  const myWalletBal = state.financial.wallets[username] || 0;
  const otherUsers = state.users.filter(u => u.username !== username && u.role === 'user' && !u.pendingApproval);
  
  const transferFormHtml = `
    <form id="user-transfer-form-popup">
      <div class="form-group">
        <label class="form-label">Tujuan Pengiriman</label>
        <select id="ut-destination-type" class="form-select" required>
          <option value="tim">Kirim ke Tim Lain</option>
          <option value="admin">Ke Dompet Utama Admin</option>
          <option value="vendor">Kirim ke Mitra Vendor</option>
        </select>
      </div>
      
      <div class="form-group" id="ut-recipient-select-container">
        <label class="form-label" id="ut-recipient-label">Pilih Tim Penerima</label>
        <select id="ut-recipient" class="form-select">
          ${otherUsers.map(u => `<option value="${u.username}">${u.name}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nominal Transfer (SAR)</label>
        <input type="number" id="ut-amount" class="form-input" min="1" max="${myWalletBal}" required>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Saldo Kas: SAR ${myWalletBal}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan / Deskripsi</label>
        <input type="text" id="ut-description" class="form-input" required placeholder="Tujuan transfer...">
      </div>
      
      <button type="submit" class="btn btn-gold">KIRIM DANA</button>
    </form>
  `;
  openModal("Transfer Uang", transferFormHtml);
  
  const destTypeSelect = document.getElementById("ut-destination-type");
  const recipContainer = document.getElementById("ut-recipient-select-container");
  destTypeSelect.onchange = () => {
    const recipSelect = document.getElementById("ut-recipient");
    const recipLabel = document.getElementById("ut-recipient-label");
    if (destTypeSelect.value === "admin") {
      recipContainer.classList.add("hidden");
    } else if (destTypeSelect.value === "vendor") {
      recipContainer.classList.remove("hidden");
      if (recipLabel) recipLabel.textContent = "Pilih Mitra Vendor";
      if (recipSelect) {
        const vOptions = (state.vendors || []).map(v => `<option value="${v.name}">${v.name} (${v.category || 'Vendor'})</option>`).join('');
        recipSelect.innerHTML = vOptions || '<option value="Vendor Umum">Vendor Umum</option>';
      }
    } else {
      recipContainer.classList.remove("hidden");
      if (recipLabel) recipLabel.textContent = "Pilih Tim Penerima";
      if (recipSelect) {
        recipSelect.innerHTML = otherUsers.map(u => `<option value="${u.username}">${u.name}</option>`).join('');
      }
    }
  };
  
  document.getElementById("user-transfer-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const destType = destTypeSelect.value;
    const amount = parseInt(document.getElementById("ut-amount").value);
    const description = document.getElementById("ut-description").value;
    
    if (amount > myWalletBal) {
      showToast("Saldo Anda tidak mencukupi untuk melakukan transfer ini.", "error");
      return;
    }
    
    state.financial.wallets[username] = (state.financial.wallets[username] || 0) - amount;
    
    let recipient = "Dompet Utama";
    let status = "Approved"; 
    
    if (destType === "tim") {
      recipient = document.getElementById("ut-recipient").value;
      status = "Pending Confirmation"; 
    } else {
      state.financial.mainBalance += amount; 
    }
    
    state.financial.transactions.push({
      id: `tx-${Date.now()}`,
      type: "Transfer",
      sender: username,
      recipient: recipient,
      amount: amount,
      date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
      description: description,
      status: status
    });
    
    addNotification("financial", `Transfer Uang: ${state.currentUser.name} mentransfer SAR ${amount} ke ${destType === 'tim' ? recipient : 'Admin'}`, { username, groupName: '' });
    saveState();
    closeModal();
    showToast("Transfer kas berhasil dikirim!");
    if (callbackOnSuccess) {
      callbackOnSuccess();
    }
  };
}

function openUserTaskDetailPopup(taskId) {
  const task = state.assignments.find(t => t.id === taskId);
  if (!task) {
    showToast("Data penugasan tidak ditemukan", "error");
    return;
  }
  
  const username = state.currentUser ? state.currentUser.username : '';
  const details = task.details || {};
  const taskType = task.type || task.title || "Penugasan Lapangan";
  const taskRegion = task.region || "Saudi Arabia";
  
  const reqStaff = task.requiredStaff || 1;
  const currentStaffCount = task.staff ? task.staff.length : 0;
  const isFulfilled = (currentStaffCount >= reqStaff);
  const staffingStatusHtml = isFulfilled 
    ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
    : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;

  task.applicants = task.applicants || [];
  const isPlotted = task.staff && task.staff.includes(username);
  const hasApplied = task.applicants && task.applicants.includes(username);

  let applyActionBtnHtml = "";
  if (isPlotted) {
    applyActionBtnHtml = `<button class="btn btn-secondary" disabled style="width:auto; padding:7px 14px; font-size:0.8rem; border-radius:8px; display:inline-flex; align-items:center; gap:6px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Anda Bertugas</button>`;
  } else if (hasApplied) {
    applyActionBtnHtml = `<button id="popup-cancel-apply-btn" class="btn" style="width:auto; padding:7px 14px; font-size:0.8rem; border-radius:8px; background:#64748b; color:#fff; border:none; font-weight:800; cursor:pointer;">Batal Apply Tugas</button>`;
  } else if (isFulfilled) {
    applyActionBtnHtml = `<button class="btn btn-secondary" disabled style="width:auto; padding:7px 14px; font-size:0.8rem; border-radius:8px;">Kuota Terpenuhi</button>`;
  } else {
    applyActionBtnHtml = `<button id="popup-apply-task-btn" class="btn btn-gold" style="width:auto; padding:7px 18px; font-size:0.8rem; font-weight:800; border-radius:8px; cursor:pointer;">Apply Tugas Sekarang</button>`;
  }

  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <div>
          <span class="badge badge-gold" style="font-size:0.85rem; margin-right:8px;">${taskType}</span>
          <span class="badge badge-success">${task.status || 'Aktif'}</span>
        </div>
        ${staffingStatusHtml}
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:16px;">
        <tr><td style="padding:6px 0; font-weight:700; width:120px; color:var(--text-muted);">Rombongan:</td><td style="font-weight:800; color:#0f172a;">${task.groupName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Waktu Saudi:</td><td>${formatDateDisplay(task.date)} | ${task.time || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah:</td><td>${taskRegion}</td></tr>
        ${details.meal ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Mealplan:</td><td>${details.meal}</td></tr>` : ''}
        ${details.destinationTarget || details.destination ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Tujuan:</td><td>${details.destinationTarget || details.destination}</td></tr>` : ''}
        ${details.originTarget || details.origin ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Asal:</td><td>${details.originTarget || details.origin}</td></tr>` : ''}
        ${details.eta ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${details.eta}</td></tr>` : ''}
        ${details.totalPax ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax} Pax</td></tr>` : ''}
        ${details.hotelName ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td>${details.hotelName}</td></tr>` : ''}
        ${details.roomComposition ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Komposisi Kamar:</td><td>${details.roomComposition}</td></tr>` : ''}
        ${details.complimentary ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Complimentary:</td><td>${details.complimentary}</td></tr>` : ''}
        ${details.pickupRoute || details.hotelPickup ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Rute Penjemputan:</td><td>${details.pickupRoute || details.hotelPickup}</td></tr>` : ''}
        ${details.nampanCount ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Nampan:</td><td>${details.nampanCount} Nampan</td></tr>` : ''}
        ${details.remarks || task.notes ? `<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan:</td><td>${details.remarks || task.notes}</td></tr>` : ''}
      </table>
      <div style="margin-top:16px; padding-top:12px; border-top:1px solid #f1f3f5; display:flex; justify-content:space-between; align-items:center;">
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 14px;">Tutup</button>
        ${applyActionBtnHtml}
      </div>
    </div>
  `;
  openModal("Detail Penugasan", detailHtml);
  lucide.createIcons();

  const applyBtn = document.getElementById("popup-apply-task-btn");
  if (applyBtn) {
    applyBtn.onclick = () => {
      task.applicants = task.applicants || [];
      if (!task.applicants.includes(username)) {
        task.applicants.push(username);
        addNotification("penjadwalan", `Pengajuan Tugas: ${state.currentUser.name} melamar tugas ${task.type} grup ${task.groupName}`, { username, groupName: task.groupName });
        saveState();
        closeModal();
        showToast("Lamaran tugas berhasil dikirim! Menunggu konfirmasi Admin.");
        if (window.location.hash.includes("#user/apply-tugas")) renderUserApplyTugas();
      }
    };
  }

  const cancelBtn = document.getElementById("popup-cancel-apply-btn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      if (task.applicants) {
        task.applicants = task.applicants.filter(u => u !== username);
        saveState();
        closeModal();
        showToast("Lamaran tugas dibatalkan.");
        if (window.location.hash.includes("#user/apply-tugas")) renderUserApplyTugas();
      }
    };
  }
}

function renderUserJadwal() {
  const container = document.getElementById("user-subview-content");
  const username = state.currentUser.username;
  const offers = state.assignmentOffers.filter(o => o.status === "Tersedia" || (o.status === "Pending Approval" && o.staff.includes(username)));
  
  container.innerHTML = `
    <div style="display:flex; align-items:center; margin-bottom:16px; margin-top:10px; gap:8px;">
      <button class="btn btn-secondary" onclick="window.location.hash='#user/dashboard'" style="width:auto; padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; justify-content:center;">
        <i data-lucide="arrow-left" style="width:12px; height:12px; margin-right:4px;"></i> Kembali
      </button>
      <span style="font-size:0.95rem; font-weight:800;">Jadwal Tugas Tersedia</span>
    </div>
    <div class="grid-2col" style="gap:16px;" id="user-offers-list-container"></div>
  `;
  
  const listEl = document.getElementById("user-offers-list-container");
  if (offers.length === 0) {
    listEl.innerHTML = `<p style="text-align:center; color:var(--text-light); padding:20px; grid-column:span 2;">Tidak ada jadwal tugas tersedia untuk diajukan.</p>`;
    return;
  }
  
  listEl.innerHTML = offers.map(o => {
    const isPending = (o.status === "Pending Approval");
    return `
      <div class="assignment-card" style="border-left-color: ${isPending ? 'var(--primary-gold)' : '#10b981'}; background:#fff; padding:16px; margin-bottom:0;">
        <div class="assignment-header" style="border-bottom:1px solid #f1f3f5; padding-bottom:8px; margin-bottom:10px;">
          <strong>${o.type}</strong>
          <span class="badge ${isPending ? 'badge-warning' : 'badge-success'}">${o.status}</span>
        </div>
        <div class="structured-card-grid">
          <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value">${o.groupName}</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(o.date)} | ${o.time} Saudi</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Wilayah:</span><span class="structured-card-value">${o.region}</span></div>
          ${o.details.remarks ? `<div class="structured-card-row"><span class="structured-card-label">Keterangan:</span><span class="structured-card-value">${o.details.remarks}</span></div>` : ''}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          ${isPending ? `
            <button class="btn btn-secondary cancel-apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Batal Ajukan</button>
          ` : `
            <button class="btn btn-gold apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Apply Tugas</button>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  listEl.querySelectorAll(".apply-offer-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const offer = state.assignmentOffers.find(x => x.id === id);
      if (offer) {
        if (confirm(`Ajukan diri Anda untuk penugasan ${offer.type} grup ${offer.groupName}?`)) {
          offer.staff = [username];
          offer.status = "Pending Approval";
          addNotification("penjadwalan", `Pengajuan Tugas Mandiri: ${state.currentUser.name} mengajukan diri untuk tugas ${offer.type} grup ${offer.groupName}`, { username, groupName: offer.groupName });
          saveState();
          showToast("Pengajuan tugas mandiri dikirim!");
          renderUserJadwal();
        }
      }
    };
  });
  
  listEl.querySelectorAll(".cancel-apply-offer-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const offer = state.assignmentOffers.find(x => x.id === id);
      if (offer) {
        if (confirm("Batalkan pengajuan diri Anda untuk tugas ini?")) {
          offer.staff = [];
          offer.status = "Tersedia";
          saveState();
          showToast("Pengajuan dibatalkan.");
          renderUserJadwal();
        }
      }
    };
  });
  lucide.createIcons();
}



let currentFacingMode = "user";
let activeMediaStream = null;

function stopActiveMediaStream() {
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach(track => track.stop());
    activeMediaStream = null;
  }
}

function openAttendanceFormPopup(preselectedTaskId = "") {
  stopActiveMediaStream();
  const username = state.currentUser ? state.currentUser.username : '';
  const myActiveTasks = state.assignments.filter(a => a && isTaskAssignedToUser(a, state.currentUser) && a.status !== "Selesai" && a.published !== false);
  const hasActiveTask = (myActiveTasks.length > 0);
  let capturedPhotoBase64 = null;
  let currentGpsCoords = "21.5433, 39.1728";
  
  const formHtml = `
    <div class="admin-card" style="border:none; padding:0; font-family:'Mulish', sans-serif;">
      ${!hasActiveTask ? `
        <div class="badge badge-warning" style="margin-bottom:16px; width:100%; display:block; text-align:center; padding:12px; background:#fef3c7; color:#92400e; border-radius:10px;">
          ⚠️ Anda tidak memiliki tugas aktif untuk melakukan absensi.
        </div>
      ` : ''}

      <form id="user-attendance-form-popup">
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-weight:800; font-size:0.85rem; color:#1e293b;">Pilih Penugasan Aktif Anda</label>
          <select id="user-absen-task-select" class="form-select" required ${!hasActiveTask ? 'disabled' : ''}>
            <option value="">-- Pilih Penugasan --</option>
            ${myActiveTasks.map(t => `<option value="${t.id}" ${t.id === preselectedTaskId ? 'selected' : ''}>${t.type} (${(t.groupName || "").substring(0, 30)}...)</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-weight:800; font-size:0.85rem; color:#1e293b;">Kategori Absensi</label>
          <select id="user-absen-type" class="form-select" required ${!hasActiveTask ? 'disabled' : ''}>
            <option value="Masuk">Absensi Masuk</option>
            <option value="Keluar">Absensi Keluar</option>
          </select>
        </div>

        <div id="user-absen-gps-coords" style="font-size:0.8rem; color:#475569; background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:16px;">
          📍 Lokasi GPS: <em>Mencari posisi...</em>
        </div>

        <div id="absen-start-cam-btn-box" style="margin-bottom:16px;">
          <button type="button" id="user-open-camera-btn" class="btn btn-gold" style="width:100%; font-weight:800; padding:12px; font-size:0.95rem; border-radius:12px;" ${!hasActiveTask ? 'disabled' : ''}>
            Buka Kamera
          </button>
        </div>

        <!-- Preview Container After Shot -->
        <div id="simulated-absen-photo-preview-popup" class="hidden" style="margin-bottom:16px;"></div>

        <!-- Action Submit Button -->
        <div id="absen-submit-btn-box" class="hidden">
          <button type="submit" class="btn btn-success" id="user-submit-absen-btn-popup" style="background:#10b981; color:#fff; font-weight:800; width:100%; padding:12px; font-size:0.95rem; border-radius:12px;">
            Submit Absensi
          </button>
        </div>
      </form>
    </div>

    <!-- Fullscreen Camera Modal Overlay -->
    <div id="absen-fullscreen-cam-overlay" class="hidden" style="position:fixed; inset:0; z-index:999999; background:#000; display:flex; flex-direction:column; justify-content:space-between; padding:16px;">
      
      <!-- Top Overlay Controls -->
      <div style="display:flex; justify-content:space-between; align-items:center; z-index:10;">
        <button type="button" id="absen-toggle-camera-btn" style="background:rgba(255,255,255,0.2); color:#fff; border:1px solid rgba(255,255,255,0.4); padding:8px 16px; font-size:0.8rem; font-weight:700; border-radius:20px; cursor:pointer;">
          🔄 Ganti Kamera
        </button>
        <button type="button" id="absen-close-cam-btn" style="background:rgba(255,255,255,0.2); color:#fff; border:none; width:36px; height:36px; border-radius:50%; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          ✕
        </button>
      </div>

      <!-- Center Video Viewport (4:5 Portrait Ratio) -->
      <div style="width:100%; max-width:400px; aspect-ratio:4/5; margin:auto; overflow:hidden; border-radius:16px; border:2px solid #dfc06b; position:relative; background:#111;">
        <video id="absen-camera-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; display:block;"></video>
      </div>

      <!-- Bottom Overlay Shutter Control -->
      <div style="display:flex; justify-content:center; padding:16px 0; z-index:10;">
        <button type="button" id="absen-shutter-btn" class="btn btn-gold" style="padding:14px 32px; font-weight:900; font-size:1rem; border-radius:30px; box-shadow:0 6px 20px rgba(0,0,0,0.5); cursor:pointer;">
          📷 Ambil Foto
        </button>
      </div>

    </div>
  `;

  openModal("Absensi Petugas Khidmat", formHtml);

  const selectEl = document.getElementById("user-absen-task-select");
  const typeEl = document.getElementById("user-absen-type");
  const openCamBtn = document.getElementById("user-open-camera-btn");
  const camOverlay = document.getElementById("absen-fullscreen-cam-overlay");
  const closeCamBtn = document.getElementById("absen-close-cam-btn");
  const videoEl = document.getElementById("absen-camera-video");
  const toggleCamBtn = document.getElementById("absen-toggle-camera-btn");
  const shutterBtn = document.getElementById("absen-shutter-btn");
  const previewEl = document.getElementById("simulated-absen-photo-preview-popup");
  const submitBox = document.getElementById("absen-submit-btn-box");
  const gpsEl = document.getElementById("user-absen-gps-coords");

  // Get real Geolocation GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentGpsCoords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        if (gpsEl) gpsEl.innerHTML = `📍 Lokasi GPS Terverifikasi: <strong>${currentGpsCoords}</strong>`;
      },
      (err) => {
        currentGpsCoords = "21.5433, 39.1728";
        if (gpsEl) gpsEl.innerHTML = `📍 Lokasi GPS Terverifikasi: <strong>${currentGpsCoords}</strong>`;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const updateTypeOptions = () => {
    const selectedTaskId = selectEl.value;
    if (!selectedTaskId) return;
    
    const myAbsences = state.reports.attendance.filter(a => a.username === username && a.taskId === selectedTaskId);
    const hasCheckIn = myAbsences.some(a => a.type === "Masuk");
    const hasCheckOut = myAbsences.some(a => a.type === "Keluar");
    
    let optionsHtml = '';
    if (!hasCheckIn) {
      optionsHtml += '<option value="Masuk">Absensi Masuk</option>';
    }
    if (hasCheckIn && !hasCheckOut) {
      optionsHtml += '<option value="Keluar">Absensi Keluar</option>';
    }
    if (hasCheckIn && hasCheckOut) {
      optionsHtml += '<option value="" disabled>Sudah Melakukan Absensi Masuk & Keluar</option>';
    }
    
    typeEl.innerHTML = optionsHtml;
  };

  selectEl.onchange = updateTypeOptions;
  if (preselectedTaskId) {
    updateTypeOptions();
  }

  const startLiveStream = async () => {
    stopActiveMediaStream();
    try {
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      activeMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = activeMediaStream;
      await videoEl.play();
      camOverlay.classList.remove("hidden");
    } catch (err) {
      console.error("Camera access error:", err);
      showToast("Gagal mengakses kamera. Pastikan izin kamera aktif.", "error");
    }
  };

  if (hasActiveTask) {
    openCamBtn.onclick = () => {
      if (!selectEl.value) {
        showToast("Silakan pilih penugasan terlebih dahulu.", "error");
        return;
      }
      previewEl.classList.add("hidden");
      submitBox.classList.add("hidden");
      startLiveStream();
    };

    closeCamBtn.onclick = () => {
      stopActiveMediaStream();
      camOverlay.classList.add("hidden");
    };

    toggleCamBtn.onclick = () => {
      currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
      startLiveStream();
    };

    const processAndWatermarkImage = (imgSource, isVideoFrame = false) => {
      // 4:5 Portrait Aspect Ratio Canvas (640x800)
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");

      // Calculate aspect ratio cover crop
      const srcW = imgSource.videoWidth || imgSource.width || 640;
      const srcH = imgSource.videoHeight || imgSource.height || 480;
      const targetAspect = 640 / 800; // 0.8
      const srcAspect = srcW / srcH;

      let cropW = srcW;
      let cropH = srcH;
      let cropX = 0;
      let cropY = 0;

      if (srcAspect > targetAspect) {
        cropW = srcH * targetAspect;
        cropX = (srcW - cropW) / 2;
      } else {
        cropH = srcW / targetAspect;
        cropY = (srcH - cropH) / 2;
      }

      if (isVideoFrame && currentFacingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(imgSource, cropX, cropY, cropW, cropH, 0, 0, 640, 800);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const selectedTaskId = selectEl.value;
      const task = state.assignments.find(t => t.id === selectedTaskId);
      const groupName = task ? task.groupName : "Umum";
      const group = state.groups.find(g => g && g.name === groupName);
      const details = (task && task.details) ? task.details : {};
      
      const taskTitle = task ? task.type : "Absensi Khidmat";
      const locationName = details.hotelName || (group ? (group.hotelMakkah || group.hotelMadinah) : "") || (task ? task.region : "Saudi Arabia");
      const dateObj = getSaudiDateTime();
      
      const cleanGps = (currentGpsCoords || "21.5433, 39.1728")
        .replace(/° N/g, '')
        .replace(/° E/g, '')
        .replace('📍 ', '')
        .replace('Koordinat GPS Terverifikasi: ', '')
        .replace('GPS: ', '')
        .replace(' (Terverifikasi)', '')
        .trim();

      // Semi-transparent black bottom overlay matching requested mockup
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, 640, 640, 160);

      // LEFT COLUMN: BRANDING
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px 'Martel', Georgia, serif";
      ctx.fillText("TIM KHIDMAT", 24, 700);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 18px 'Mulish', sans-serif";
      ctx.fillText("Saudi Arabia", 24, 730);

      // RIGHT COLUMN: DYNAMIC ATTENDANCE INFO
      const rightColX = 240;

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 19px 'Mulish', sans-serif";
      ctx.fillText(taskTitle, rightColX, 680);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 15px 'Mulish', sans-serif";
      ctx.fillText(locationName, rightColX, 708);

      ctx.fillStyle = "#ffffff";
      ctx.font = "500 15px 'Mulish', sans-serif";
      ctx.fillText(`${dateObj.gregorianLongStr} | ${dateObj.timeStr}`, rightColX, 734);

      ctx.fillStyle = "#ffffff";
      ctx.font = "500 15px 'Mulish', sans-serif";
      ctx.fillText(`GPS : ${cleanGps}`, rightColX, 760);

      capturedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.85);

      stopActiveMediaStream();
      camOverlay.classList.add("hidden");

      previewEl.innerHTML = `
        <div style="margin-top:10px;">
          <div style="font-size:0.85rem; font-weight:800; color:#1e293b; margin-bottom:8px; text-align:center;">Hasil Preview Foto Absensi:</div>
          <div style="width:100%; max-width:320px; aspect-ratio:4/5; margin:0 auto 12px auto; overflow:hidden; border-radius:14px; border:2px solid #dfc06b; box-shadow:0 4px 14px rgba(0,0,0,0.15);">
            <img src="${capturedPhotoBase64}" style="width:100%; height:100%; object-fit:cover; display:block;" />
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" id="absen-retake-btn" class="btn btn-secondary" style="flex:1; padding:10px; font-weight:800; border-radius:10px;">Foto Ulang</button>
            <button type="button" id="absen-direct-submit-btn" class="btn btn-success" style="flex:1; background:#10b981; color:#fff; padding:10px; font-weight:800; border-radius:10px;">Submit Absensi</button>
          </div>
        </div>
      `;
      previewEl.classList.remove("hidden");
      submitBox.classList.add("hidden");

      document.getElementById("absen-retake-btn").onclick = () => {
        previewEl.classList.add("hidden");
        capturedPhotoBase64 = null;
        startLiveStream();
      };

      document.getElementById("absen-direct-submit-btn").onclick = () => {
        handleAttendanceSubmission();
      };
    };

    shutterBtn.onclick = () => {
      processAndWatermarkImage(videoEl, true);
    };

    const handleAttendanceSubmission = () => {
      const selectedTaskId = selectEl.value;
      const type = typeEl.value;

      if (!selectedTaskId || !type || !capturedPhotoBase64) {
        showToast("Silakan ambil foto absensi terlebih dahulu.", "error");
        return;
      }

      const task = state.assignments.find(t => t.id === selectedTaskId);
      const groupName = task ? task.groupName : "Umum";

      const newAtt = {
        id: `att-${Date.now()}`,
        username,
        taskId: selectedTaskId,
        type,
        photo: capturedPhotoBase64,
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
        time: getSaudiDateTime().timeStr,
        location: currentGpsCoords,
        unread: true
      };

      state.reports.attendance.push(newAtt);

      if (type === "Masuk") {
        if (task) task.status = "Dalam Proses";
      } else if (type === "Keluar") {
        if (task) {
          task.status = "Selesai";
          task.published = false;
        }
      }

      addNotification("penjadwalan", `Absensi ${type}: ${state.currentUser.name} melakukan ${type} untuk tugas ${task ? task.type : 'Khidmat'} (${groupName})`, { username, groupName });
      saveState();
      stopActiveMediaStream();
      closeModal();
      showToast(`Absensi ${type} Berhasil Disimpan!`, "success");

      // Refresh current view if needed
      const hash = window.location.hash;
      if (hash.includes("#user/apply-tugas")) renderUserApplyTugas();
      else if (hash.includes("#user/task-detail")) renderUserTaskDetailFull();
      else if (hash.includes("#user/dashboard")) renderUserDashboard();
    };

    document.getElementById("user-attendance-form-popup").onsubmit = (e) => {
      e.preventDefault();
      handleAttendanceSubmission();
    };
  }
}





function parseGroupFlightData(group, type = 'arrival') {
  const list = type === 'arrival' ? (group ? group.flightArrival : null) : (group ? group.flightDeparture : null);
  const defaultDate = type === 'arrival' ? (group ? group.dateStart : '2026-07-28') : (group ? group.dateEnd : '2026-08-04');
  
  if (Array.isArray(list) && list.length > 0 && list[0]) {
    const f = list[0];
    const rawDate = f.date || defaultDate;
    const dateStr = rawDate ? formatDateShortMonth(rawDate).toUpperCase() : '-';
    const codeStr = f.code || (type === 'arrival' ? 'SV-817' : 'SV-826');
    const takeoffStr = f.takeoff || (type === 'arrival' ? '15:50:00' : '21:25:00');
    const landingStr = f.landing || (type === 'arrival' ? '20:35:00' : '05:05:00');
    
    let originCode = type === 'arrival' ? 'CGK' : 'JED';
    let destCode = type === 'arrival' ? (group && group.rute && group.rute.includes('Madinah') ? 'MED' : 'JED') : 'CGK';
    let originCity = type === 'arrival' ? 'JAKARTA' : 'JEDDAH';
    let destCity = type === 'arrival' ? (destCode === 'MED' ? 'MADINAH' : 'JEDDAH') : 'JAKARTA';

    if (f.remarks && f.remarks.includes('-')) {
      const parts = f.remarks.split('-');
      originCode = parts[0].trim();
      destCode = parts[1].trim();
      if (originCode === 'CGK') originCity = 'JAKARTA';
      if (originCode === 'JED') originCity = 'JEDDAH';
      if (originCode === 'MED') originCity = 'MADINAH';
      if (destCode === 'CGK') destCity = 'JAKARTA';
      if (destCode === 'JED') destCity = 'JEDDAH';
      if (destCode === 'MED') destCity = 'MADINAH';
      if (destCode === 'BOM') destCity = 'MUMBAI';
    }
    
    return { dateStr, codeStr, takeoffStr, landingStr, originCode, destCode, originCity, destCity };
  }

  const rawDate = defaultDate || (type === 'arrival' ? '2026-07-28' : '2026-08-04');
  const formattedDate = rawDate ? formatDateShortMonth(rawDate).toUpperCase() : (type === 'arrival' ? '28 JUL 2026' : '4 AGU 2026');
  return {
    dateStr: formattedDate,
    codeStr: type === 'arrival' ? '6E-1602' : '6E-62',
    takeoffStr: type === 'arrival' ? '15:50:00' : '21:25:00',
    landingStr: type === 'arrival' ? '20:35:00' : '05:05:00',
    originCode: type === 'arrival' ? 'CGK' : 'JED',
    destCode: 'BOM',
    originCity: type === 'arrival' ? 'JAKARTA' : 'JEDDAH',
    destCity: 'MUMBAI'
  };
}



function toggleUserGroupBioAccordion(taskId) {
  const body = document.getElementById(`user-bio-body-${taskId}`);
  const icon = document.getElementById(`user-bio-icon-${taskId}`);
  if (body && icon) {
    if (body.style.display === 'none' || !body.style.display) {
      body.style.display = 'block';
      icon.style.transform = 'rotate(0deg)';
    } else {
      body.style.display = 'none';
      icon.style.transform = 'rotate(-90deg)';
    }
  }
}

function toggleUserFlightAccordion(taskId) {
  const body = document.getElementById(`user-flight-body-${taskId}`);
  const icon = document.getElementById(`user-flight-icon-${taskId}`);
  if (body && icon) {
    if (body.style.display === 'none' || !body.style.display) {
      body.style.display = 'block';
      icon.style.transform = 'rotate(0deg)';
    } else {
      body.style.display = 'none';
      icon.style.transform = 'rotate(-90deg)';
    }
  }
}

function renderUserDashboard() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;

  try {
    const username = state.currentUser ? state.currentUser.username : '';
    const nameStr = state.currentUser ? state.currentUser.name : 'Petugas Khidmat';
    const myWalletBal = (state.financial && state.financial.wallets && state.financial.wallets[username]) || 0;
    
    // Pick user active tasks
    const myActiveTasks = (state.assignments || []).filter(a => a && isTaskAssignedToUser(a, state.currentUser) && a.status !== "Selesai" && a.published !== false);
    const pendingInflows = (state.financial && state.financial.transactions || []).filter(tx => tx && tx.recipient === username && tx.status === "Pending Confirmation");

    container.innerHTML = `
      <div style="font-family:'Mulish', sans-serif; padding-top:4px; padding-bottom:30px; max-width:600px; margin:0 auto;">
        
        <!-- Greeting Header -->
        <h2 style="font-size:1.05rem; font-weight:800; color:#1e293b; margin-top:2px; margin-bottom:12px;">
          Halo, ${nameStr}
        </h2>

        <!-- Integrated Financial Wallet Box -->
        <div style="margin-bottom:20px; background:#ffffff; padding:16px 20px; border-radius:18px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.03); border:1px solid #f1f5f9;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; justify-content:center; align-items:center; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:12px; padding:8px 10px;">
              <i data-lucide="wallet" style="width:24px; height:24px; stroke-width:2.2;"></i>
            </div>
            <div style="font-size:1.5rem; font-weight:900; color:#0f172a; font-family:'Mulish', sans-serif; letter-spacing:-0.02em;">
              SAR ${myWalletBal.toLocaleString('id-ID')}
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:10px;">
            <button id="user-wallet-transfer-btn" class="btn" style="width:42px; height:42px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Transfer Kas">
              <i data-lucide="arrow-left-right" style="width:20px; height:20px; stroke-width:2.5;"></i>
            </button>
            <button id="user-wallet-add-exp-btn" class="btn" style="width:42px; height:42px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Tambah Pengeluaran (Lapor Kas)">
              <i data-lucide="plus" style="width:22px; height:22px; stroke-width:3;"></i>
            </button>
            <button id="user-wallet-detail-btn" class="btn" style="width:42px; height:42px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Lihat Detail Kas">
              <i data-lucide="more-horizontal" style="width:22px; height:22px; stroke-width:2.5;"></i>
            </button>
          </div>
        </div>

        <!-- Inflow alert items -->
        ${pendingInflows.map(inf => `
          <div class="inflow-alert-item" style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:10px; padding:12px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
            <div>
              <strong style="color:#065f46;">Dana dari ${inf.sender === 'Dompet Utama' ? 'Admin' : inf.sender}:</strong> SAR ${inf.amount.toLocaleString('id-ID')}<br>
              <span style="font-size:0.75rem; color:#475569;">${inf.description}</span>
            </div>
            <button class="btn btn-gold confirm-inflow-btn" data-id="${inf.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; border-radius:6px;">Konfirmasi Diterima</button>
          </div>
        `).join('')}

        <!-- Main Menu Shortcut Buttons (3 Items Grid) -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:28px;">
          <div onclick="window.location.hash='#user/apply-tugas'" class="glass-card" style="padding:16px 8px; text-align:center; cursor:pointer; border-radius:16px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:transform 0.15s ease;">
            <i data-lucide="clipboard-list" style="width:26px; height:26px; color:#c5a850; stroke-width:2; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"></i>
            <div style="font-size:0.82rem; font-weight:800; color:#1e293b;">Daftar Tugas</div>
          </div>
          
          <div onclick="window.location.hash='#user/laporan?tab=absensi'" class="glass-card" style="padding:16px 8px; text-align:center; cursor:pointer; border-radius:16px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:transform 0.15s ease;">
            <i data-lucide="user-check" style="width:26px; height:26px; color:#c5a850; stroke-width:2; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"></i>
            <div style="font-size:0.82rem; font-weight:800; color:#1e293b;">Absensi</div>
          </div>
          
          <div onclick="window.location.hash='#user/laporan?tab=insiden'" class="glass-card" style="padding:16px 8px; text-align:center; cursor:pointer; border-radius:16px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:transform 0.15s ease;">
            <i data-lucide="alert-triangle" style="width:26px; height:26px; color:#c5a850; stroke-width:2; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"></i>
            <div style="font-size:0.82rem; font-weight:800; color:#1e293b;">Laporan</div>
          </div>
        </div>

        <!-- Section Title: TUGAS AKTIF with Underline -->
        <div style="margin-bottom:16px;">
          <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 4px 0; display:inline-block; border-bottom:3px solid #c5a850; padding-bottom:3px;">
            TUGAS AKTIF
          </h3>
        </div>

        <!-- Active Tasks Cards List -->
        <div style="display:flex; flex-direction:column; gap:18px;">
          ${myActiveTasks.length === 0 ? `
            <p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px; background:#fff; border-radius:16px; border:1px solid #e2e8f0;">Tidak ada jadwal penugasan aktif hari ini.</p>
          ` : myActiveTasks.map(task => {
            const details = task.details || {};
            const group = state.groups.find(g => g && g.name === task.groupName);
            
            const taskDateStr = task.date ? formatDateShortMonth(task.date) : '02/08/2026';
            const typeStr = (task.type || '').toLowerCase();

            // Build ALL additional detail items dynamically for this task type (showing 2, 3, 4+ fields cleanly)
            let detailItems = [];
            const addDetail = (label, val, fullWidth = false) => {
              if (val && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0 Pax' && String(val).trim() !== '0 Bus') {
                detailItems.push({ label, val, fullWidth });
              }
            };

            if (typeStr.includes('kedatangan')) {
              addDetail('🍴 MEALPLAN KEDATANGAN', details.meal || (group ? (group.mealsArrival ? group.mealsArrival.join(', ') : group.mealArrival) : null) || 'Dinner: Al Baik + Nasi');
              addDetail('📍 TUJUAN', details.destinationTarget || details.destination || details.hotelName || (group ? (group.hotelMadinah || group.hotelMakkah) : null) || 'Al Anshor Golden Tulip');
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
              addDetail('✈️ FLIGHT & ETA', details.eta || (group && group.flightArrival && group.flightArrival[0] ? group.flightArrival[0].code + ' (' + (group.flightArrival[0].takeoff || '') + '-' + (group.flightArrival[0].landing || '') + ')' : null));
              addDetail('🚌 JUMLAH BUS', details.busCount ? details.busCount + ' Bus' : (group && group.bus ? group.bus + ' Bus' : null));
            } else if (typeStr.includes('kepulangan')) {
              addDetail('🍴 MEALPLAN KEPULANGAN', details.meal || (group ? (group.mealsDeparture ? group.mealsDeparture.join(', ') : group.mealDeparture) : null) || 'Lunch: Nasi Mandi');
              addDetail('📍 ASAL', details.originTarget || details.origin || (group ? (group.hotelMadinah || group.hotelMakkah) : null) || 'Hotel Madinah');
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
              addDetail('✈️ FLIGHT & ETD', details.eta || details.etd || (group && group.flightDeparture && group.flightDeparture[0] ? group.flightDeparture[0].code + ' (' + (group.flightDeparture[0].takeoff || '') + '-' + (group.flightDeparture[0].landing || '') + ')' : null));
              addDetail('🚌 JUMLAH BUS', details.busCount ? details.busCount + ' Bus' : (group && group.bus ? group.bus + ' Bus' : null));
            } else if (typeStr.includes('check in')) {
              addDetail('🏨 NAMA HOTEL', details.hotelName || (group ? (group.hotelMadinah || group.hotelMakkah) : null) || 'Hotel Madinah');
              addDetail('📍 ASAL DARI', details.originTarget || details.origin);
              addDetail('🛏️ KOMPOSISI KAMAR', details.roomComposition || details.komposisiKamar || '5 Quad, 2 Double');
              addDetail('🎁 COMPLIMENTARY', details.complimentary || details.comp);
              addDetail('📦 PAKET LAYANAN', Array.isArray(details.packages) && details.packages.length > 0 ? details.packages.join(', ') : null);
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
            } else if (typeStr.includes('check out')) {
              addDetail('🏨 NAMA HOTEL', details.hotelName || (group ? (group.hotelMadinah || group.hotelMakkah) : null) || 'Hotel Makkah');
              addDetail('📍 TUJUAN', details.destinationTarget || details.destination);
              addDetail('🛏️ KOMPOSISI KAMAR', details.roomComposition || details.komposisiKamar);
              addDetail('🎁 COMPLIMENTARY', details.complimentary || details.comp || 'Air Zamzam & Koper');
              addDetail('📦 PAKET LAYANAN', Array.isArray(details.packages) && details.packages.length > 0 ? details.packages.join(', ') : null);
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
            } else if (typeStr.includes('city tour') || typeStr.includes('stasiun')) {
              addDetail('🚌 RUTE PENJEMPUTAN', details.pickupRoute || details.hotelPickup || 'Hotel Madinah');
              addDetail('📍 TUJUAN (DESTINASI)', details.destinationBus || details.destination || 'Jabal Uhud & Masjid Quba');
              addDetail('📋 ITINERARY', details.itinerary);
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
            } else if (typeStr.includes('romansiah')) {
              addDetail('📍 ASAL PENJEMPUTAN', details.originTarget || details.hotelPickup || 'Restoran Romansiah');
              addDetail('🍱 JUMLAH NAMPAN', details.nampanCount ? (details.nampanCount + ' Nampan') : '5 Nampan');
              addDetail('👥 TOTAL PAX', details.totalPax ? (String(details.totalPax).includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : (group ? group.pax : null));
            } else {
              addDetail('📝 DESKRIPSI KUSTOM', details.customText || details.customTaskName);
              addDetail('🏨 NAMA HOTEL', details.hotelName);
              addDetail('✈️ FLIGHT & ETA', details.eta);
            }

            if (details.remarks) {
              addDetail('💬 KETERANGAN UMUM', details.remarks, true);
            }

            if (detailItems.length === 0) {
              detailItems.push({ label: '🍴 MEALPLAN KEDATANGAN', val: 'Dinner: Al Baik + Nasi', fullWidth: false });
              detailItems.push({ label: '📍 TUJUAN', val: 'Al Anshor Golden Tulip', fullWidth: false });
            }

            const detailGridHtml = detailItems.map(item => `
              <div style="${item.fullWidth ? 'grid-column: span 2;' : ''}">
                <div style="color:#b89230; font-weight:800; font-size:0.7rem; text-transform:uppercase; margin-bottom:2px; display:flex; align-items:center; gap:4px;">
                  ${item.label}
                </div>
                <div style="color:#0f172a; font-weight:700;">${item.val}</div>
              </div>
            `).join('');
            
            const tlName = (group && group.leaders && group.leaders.length > 0) ? group.leaders.join(', ') : 'Ust. H. Dinar Zul Akbar, Lc., M.A.';
            const muthawwifName = (group && group.mutawwif) ? group.mutawwif : 'Ust. H. Muhammad Albani, Lc.';
            
            const totalPaxVal = group ? (group.pax || '19 Pax') : (details.totalPax ? (details.totalPax.includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : '19 Pax');
            const totalBusVal = group ? (group.bus ? group.bus + ' Bus' : '1 Bus') : '1 Bus';
            
            const myAbsences = state.reports.attendance.filter(a => a.username === username && a.taskId === task.id);
            const hasCheckIn = myAbsences.some(a => a.type === "Masuk");
            const btnAbsenText = hasCheckIn ? "ABSENSI KELUAR" : "ABSENSI MASUK";

            // Parse real flight data dynamically from group manifest
            const arrFlight = parseGroupFlightData(group, 'arrival');
            const depFlight = parseGroupFlightData(group, 'departure');

            const routeSummaryStr = `${arrFlight.originCode} ➔ ${arrFlight.destCode} • ${depFlight.originCode} ➔ ${depFlight.destCode}`;

            return `
              <div style="background:#ffffff; border-radius:20px; border:1px solid #f1f5f9; padding:20px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
                
                <!-- Task Title & Date -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <h4 style="font-size:0.95rem; font-weight:900; color:#0f172a; margin:0; text-transform:uppercase;">${task.type}</h4>
                  <span style="font-size:0.8rem; color:#64748b; font-weight:700;">${taskDateStr}</span>
                </div>

                <!-- Dynamic Grid rendering all available additional details for this task type without changing design -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 14px; font-size:0.78rem; margin-bottom:14px;">
                  ${detailGridHtml}
                </div>

                <div style="border-top:1px solid #f1f5f9; margin:14px 0;"></div>

                <!-- EXPANDABLE BIODATA GRUP ACCORDION -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px 16px; margin-bottom:14px;">
                  <div id="user-bio-header-${task.id}" onclick="toggleUserGroupBioAccordion('${task.id}')" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                    <div>
                      <div style="font-size:0.68rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">BIODATA & RINCIAN GRUP</div>
                      <h3 style="font-size:0.95rem; font-weight:900; color:#0f172a; margin:2px 0 0 0;">${task.groupName}</h3>
                    </div>
                    <i data-lucide="chevron-down" id="user-bio-icon-${task.id}" style="width:18px; height:18px; color:#64748b; transform:rotate(-90deg); transition:transform 0.2s;"></i>
                  </div>
                  
                  <div id="user-bio-body-${task.id}" style="display:none; margin-top:12px; border-top:1px solid #e2e8f0; padding-top:10px;">
                    <div style="font-size:0.8rem; color:#64748b; line-height:1.6; margin-bottom:12px;">
                      <div>Tour Leader: <strong style="color:#334155;">${tlName}</strong></div>
                      <div>Muthowwif: <strong style="color:#334155;">${muthawwifName}</strong></div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                      <div>
                        <div style="font-size:0.68rem; color:#64748b; font-weight:800; text-transform:uppercase;">👥 TOTAL JAMAAH</div>
                        <div style="font-size:1.05rem; font-weight:900; color:#0f172a;">${totalPaxVal}</div>
                      </div>
                      <div>
                        <div style="font-size:0.68rem; color:#64748b; font-weight:800; text-transform:uppercase;">🚌 TOTAL BUS</div>
                        <div style="font-size:1.05rem; font-weight:900; color:#0f172a;">${totalBusVal}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- EXPANDABLE FLIGHT SCHEDULE ACCORDION CARD (DYNAMIC MANIFEST GROUP DATA) -->
                <div style="background:#fffdf5; border:1px solid #fef3c7; border-radius:16px; padding:14px 16px; margin-bottom:18px;">
                  
                  <!-- Accordion Header Row -->
                  <div id="user-flight-header-${task.id}" onclick="toggleUserFlightAccordion('${task.id}')" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                    <div>
                      <div style="display:flex; align-items:center; gap:8px; color:#b89230; font-weight:800; font-size:0.85rem;">
                        <i data-lucide="plane" style="width:18px; height:18px; color:#b89230;"></i>
                        <span>Jadwal Penerbangan</span>
                      </div>
                      <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px; font-weight:600;">
                        ${routeSummaryStr}
                      </div>
                    </div>
                    <i data-lucide="chevron-up" id="user-flight-icon-${task.id}" style="width:20px; height:20px; color:#b89230; transform:rotate(-90deg); transition:transform 0.25s ease;"></i>
                  </div>

                  <!-- Accordion Body (Expanded Detailed Flight Schedule from Manifest) -->
                  <div id="user-flight-body-${task.id}" style="display:none; margin-top:14px; border-top:1px solid #fef08a; padding-top:14px;">
                    
                    <!-- FLIGHT BERANGKAT -->
                    <div style="margin-bottom:14px;">
                      <div style="font-size:0.72rem; font-weight:800; color:#b89230; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <span>✈️ BERANGKAT</span> • <span>${arrFlight.dateStr}</span>
                      </div>

                      <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:8px; text-align:center;">
                        <!-- Origin -->
                        <div style="text-align:left;">
                          <div style="font-size:1.35rem; font-weight:900; color:#0f172a; line-height:1;">${arrFlight.originCode}</div>
                          <div style="font-size:0.85rem; font-weight:800; color:#b89230; margin-top:4px;">${arrFlight.takeoffStr}</div>
                          <div style="font-size:0.72rem; font-weight:700; color:#94a3b8; margin-top:2px;">${arrFlight.originCity}</div>
                        </div>

                        <!-- Flight Code Center Divider -->
                        <div style="padding:0 8px;">
                          <div style="position:relative; width:80px; text-align:center;">
                            <div style="border-top:1.5px dashed #cbd5e1; width:100%; position:absolute; top:50%; transform:translateY(-50%); z-index:1;"></div>
                            <i data-lucide="plane" style="width:16px; height:16px; color:#b89230; background:#fffdf5; position:relative; z-index:2; padding:0 4px;"></i>
                          </div>
                          <div style="font-size:0.72rem; font-weight:800; color:#94a3b8; margin-top:4px;">${arrFlight.codeStr}</div>
                        </div>

                        <!-- Destination -->
                        <div style="text-align:right;">
                          <div style="font-size:1.35rem; font-weight:900; color:#0f172a; line-height:1;">${arrFlight.destCode}</div>
                          <div style="font-size:0.85rem; font-weight:800; color:#b89230; margin-top:4px;">${arrFlight.landingStr}</div>
                          <div style="font-size:0.72rem; font-weight:700; color:#94a3b8; margin-top:2px;">${arrFlight.destCity}</div>
                        </div>
                      </div>
                    </div>

                    <div style="border-top:1px dashed #fef08a; margin:14px 0;"></div>

                    <!-- FLIGHT PULANG -->
                    <div>
                      <div style="font-size:0.72rem; font-weight:800; color:#94a3b8; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <span>🛬 PULANG</span> • <span>${depFlight.dateStr}</span>
                      </div>

                      <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:8px; text-align:center;">
                        <!-- Return Origin -->
                        <div style="text-align:left;">
                          <div style="font-size:1.35rem; font-weight:900; color:#64748b; line-height:1;">${depFlight.originCode}</div>
                          <div style="font-size:0.85rem; font-weight:800; color:#b89230; margin-top:4px;">${depFlight.takeoffStr}</div>
                          <div style="font-size:0.72rem; font-weight:700; color:#94a3b8; margin-top:2px;">${depFlight.originCity}</div>
                        </div>

                        <!-- Return Flight Code Center Divider -->
                        <div style="padding:0 8px;">
                          <div style="position:relative; width:80px; text-align:center;">
                            <div style="border-top:1.5px dashed #cbd5e1; width:100%; position:absolute; top:50%; transform:translateY(-50%); z-index:1;"></div>
                            <i data-lucide="plane" style="width:16px; height:16px; color:#b89230; background:#fffdf5; position:relative; z-index:2; padding:0 4px;"></i>
                          </div>
                          <div style="font-size:0.72rem; font-weight:800; color:#94a3b8; margin-top:4px;">${depFlight.codeStr}</div>
                        </div>

                        <!-- Return Destination -->
                        <div style="text-align:right;">
                          <div style="font-size:1.35rem; font-weight:900; color:#64748b; line-height:1;">${depFlight.destCode}</div>
                          <div style="font-size:0.85rem; font-weight:800; color:#b89230; margin-top:4px;">${depFlight.landingStr}</div>
                          <div style="font-size:0.72rem; font-weight:700; color:#94a3b8; margin-top:2px;">${depFlight.destCity}</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <!-- 2 Action Buttons (LIHAT DETAIL & ABSENSI MASUK/KELUAR) -->
                <div style="display:flex; gap:12px;">
                  <button onclick="window.location.hash='#user/task-detail?id=${task.id}'" class="btn" style="flex:1; background:#c5a850; color:#ffffff; font-weight:900; font-size:0.85rem; border-radius:12px; padding:12px; border:none; cursor:pointer; text-align:center; box-shadow:0 3px 8px rgba(197, 168, 80, 0.3);">
                    LIHAT DETAIL
                  </button>
                  <button onclick="openAttendanceFormPopup('${task.id}')" class="btn" style="flex:1; background:#10b981; color:#ffffff; font-weight:900; font-size:0.85rem; border-radius:12px; padding:12px; border:none; cursor:pointer; text-align:center; box-shadow:0 3px 8px rgba(16, 185, 129, 0.3);">
                    ${btnAbsenText}
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    lucide.createIcons();

    // Wallet Action Buttons
    const transferBtn = document.getElementById("user-wallet-transfer-btn");
    if (transferBtn) transferBtn.onclick = () => openUserWalletTransferPopup();

    const addExpBtn = document.getElementById("user-wallet-add-exp-btn");
    if (addExpBtn) addExpBtn.onclick = () => openUserLaporKasPopup();

    const detailBtn = document.getElementById("user-wallet-detail-btn");
    if (detailBtn) detailBtn.onclick = () => window.location.hash = "#user/laporan?tab=kas";

    // Inflow confirmations
    container.querySelectorAll(".confirm-inflow-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const tx = state.financial.transactions.find(t => t.id === id);
        if (tx) {
          tx.status = "Completed";
          if (!state.financial.wallets[tx.recipient]) state.financial.wallets[tx.recipient] = 0;
          state.financial.wallets[tx.recipient] += tx.amount;
          saveState();
          showToast("Konfirmasi penerimaan dana berhasil.");
          renderUserDashboard();
        }
      };
    });
  } catch (err) {
    console.error("Error rendering user dashboard:", err);
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;">Gagal memuat dashboard. Silakan muat ulang.</div>`;
  }
}


function renderUserLaporan() {
  const container = document.getElementById("user-subview-content");
  
  container.innerHTML = `
    <div id="user-laporan-tab-container"></div>
  `;
  
  const urlParams = window.location.hash.split("?")[1];
  if (urlParams && urlParams.startsWith("tab=")) {
    const tabName = urlParams.replace("tab=", "");
    loadUserTab(tabName);
  } else {
    loadUserTab("kas");
  }
}


function openUserLaporKasPopup(prefilledGroup = "") {
  const username = state.currentUser ? state.currentUser.username : "";
  const activeTasks = state.assignments.filter(a => a && isTaskAssignedToUser(a, state.currentUser));
  let activityOptions = activeTasks.map(t => `<option value="${t.type}">${t.type} (${(t.groupName || "").substring(0, 20)}...)</option>`).join('');
  
  if (!activityOptions) {
    activityOptions = `
      <option value="Handling Jamaah">Handling Jamaah</option>
      <option value="Fee Handling">Fee Handling</option>
      <option value="Tip Bellboy">Tip Bellboy</option>
      <option value="Transportasi / Bus">Transportasi / Bus</option>
      <option value="Konsumsi / Catering">Konsumsi / Catering</option>
      <option value="Lainnya">Lainnya</option>
    `;
  }

  const popupHtml = `
    <form id="user-submit-exp-form-popup">
      <div class="form-group">
        <label class="form-label">Kategori Laporan</label>
        <select id="user-exp-category-type-popup" class="form-select" required>
          <option value="grup">Grup Keberangkatan</option>
          <option value="operasional">Operasional Tim</option>
        </select>
      </div>
      
      <div class="form-group" id="user-exp-group-container-popup">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="user-exp-group-input-popup" class="form-input" value="${prefilledGroup}" placeholder="Ketik nama grup..." required>
        <div id="user-exp-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Kolom Kegiatan</label>
        <select id="user-exp-activity-popup" class="form-select" required>
          <option value="">-- Pilih Kegiatan --</option>
          ${activityOptions}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Deskripsi Pengeluaran</label>
        <textarea id="user-exp-desc-popup" class="form-textarea" rows="3" required placeholder="Tuliskan keterangan detail pengeluaran..."></textarea>
      </div>
      
      <div class="form-group">
        <label class="form-label">Foto Struk / Nota (Opsional)</label>
        <input type="file" id="user-exp-photo-popup" class="form-input" accept="image/*,application/pdf" multiple>
      </div>

      <h5 style="margin-top:20px; margin-bottom:10px; font-weight:800;">Rincian Item Biaya</h5>
      <div id="user-exp-items-container" style="display:flex; flex-direction:column; gap:12px;"></div>
      <button type="button" id="user-exp-add-item-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Item</button>

      <div style="background:#f1f3f5; padding:12px; border-radius:6px; font-weight:800; font-size:0.95rem; margin-bottom:20px; border:1px solid #ced4da;">
        Total Keseluruhan: SAR <span id="user-exp-grand-total">0</span>
      </div>
      
      <button type="submit" class="btn btn-primary">Submit Laporan</button>
    </form>
    
  <datalist id="exp-category-datalist">
    <option value="Fee Kedatangan Bandara Jeddah - Terminal 1">
    <option value="Fee Kepulangan Bandara Jeddah - Terminal 1">
    <option value="Fee Kedatangan Bandara Jeddah - Terminal Haji">
    <option value="Fee Kepulangan Bandara Jeddah - Terminal Haji">
    <option value="Zamzam Kepulangan Jamaah">
    <option value="Fee Check In & Check Out Hotel Jeddah">
    <option value="Standby Restaurant">
    <option value="Standby Istirohah">
    <option value="Standby Stasiun Sulaimaniyah">
    <option value="Fee Additional Pendampingan Jamaah">
    <option value="Fee Kedatangan Bandara Madinah">
    <option value="Fee Kepulangan Bandara Madinah">
    <option value="Welcome Drink">
    <option value="Zamzam Dalam Kamar Madinah">
    <option value="Air Mineral Dalam Kamar Madinah">
    <option value="Fee Check In Hotel Madinah">
    <option value="Fee Check Out Hotel Madinah">
    <option value="Bellboy Check In Hotel Madinah">
    <option value="Bellboy Check Out Hotel Madinah">
    <option value="Kunafe Reef">
    <option value="Fee Pengantaran Kunafe Reef">
    <option value="Fee Additional Kegiatan">
    <option value="Fee Penjemputan Stasiun Madinah">
    <option value="Fee Pembagian Snack City Tour Madinah">
    <option value="Fee Pembagian Snack City Tour Al Ula">
    <option value="Subsidi Transportasi">
    <option value="Subsidi Overtime">
    <option value="Zamzam Dalam Kamar Makkah">
    <option value="Air Mineral Dalam Kamar Makkah">
    <option value="Fee Check In Hotel Makkah">
    <option value="Fee Check Out Hotel Makkah">
    <option value="Bellboy Check In Hotel Makkah">
    <option value="Bellboy Check Out Hotel Makkah">
    <option value="Fee Penjemputan Stasiun Makkah">
    <option value="Fee Pembagian Snack City Tour Makkah">
    <option value="Fee Pembagian City Tour Thaif">
    <option value="Fee Pembagian City Tour Khandama">
    <option value="Operasional Muthawwif per Bus">
    <option value="Zamzam Stock Kantor">
    <option value="Truck Pengantaran Koper">
    <option value="Additional Hotel Truck Koper">
  </datalist>

  `;
  openModal("Tambah Pengeluaran Kas", popupHtml);
  
  initSuggestionInput("user-exp-group-input-popup", "user-exp-group-suggestions-popup", state.groups.map(g => g.name));

  const categoryTypeSelect = document.getElementById("user-exp-category-type-popup");
  const groupContainer = document.getElementById("user-exp-group-container-popup");
  const groupInput = document.getElementById("user-exp-group-input-popup");
  const activitySelect = document.getElementById("user-exp-activity-popup");
  
  const originalActivityHtml = activitySelect.innerHTML;
  
  categoryTypeSelect.onchange = () => {
    if (categoryTypeSelect.value === "operasional") {
      groupContainer.classList.add("hidden");
      groupInput.required = false;
      groupInput.value = "Operasional Tim";
      activitySelect.required = false;
      activitySelect.innerHTML = '<option value="Operasional Tim" selected>Operasional Tim</option>';
    } else {
      groupContainer.classList.remove("hidden");
      groupInput.required = true;
      groupInput.value = prefilledGroup;
      activitySelect.required = true;
      activitySelect.innerHTML = originalActivityHtml;
    }
  };

  const itemsContainer = document.getElementById("user-exp-items-container");
  
  const calculateExpGrandTotal = () => {
    let grandTotal = 0;
    const totals = itemsContainer.querySelectorAll(".item-total");
    totals.forEach(t => {
      grandTotal += parseFloat(t.value) || 0;
    });
    document.getElementById("user-exp-grand-total").textContent = grandTotal;
  };

  const addItemRow = () => {
    const rowId = `exp-item-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card exp-item-row-popup";
    div.id = rowId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Item Baru</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateExpGrandTotal();">&times;</button>
      </div>
      <div class="grid-3col" style="gap:8px;">
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <input type="text" class="form-input item-cat" list="exp-category-datalist" placeholder="Pilih / ketik kategori..." required>
        </div>
        <div class="form-group">
          <label class="form-label">Harga Satuan</label>
          <input type="number" class="form-input item-price" placeholder="SAR" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input item-qty" placeholder="QTY" min="1" value="1" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Jumlah</label>
        <input type="number" class="form-input item-total" placeholder="SAR" disabled readonly>
      </div>
    `;
    itemsContainer.appendChild(div);
    
    const catInput = div.querySelector(".item-cat");
    const priceInput = div.querySelector(".item-price");
    const qtyInput = div.querySelector(".item-qty");
    const totalInput = div.querySelector(".item-total");
    
    const updateRowTotal = () => {
      const price = parseFloat(priceInput.value) || 0;
      const qty = parseFloat(qtyInput.value) || 0;
      totalInput.value = price * qty;
      calculateExpGrandTotal();
    };
    
    priceInput.oninput = updateRowTotal;
    qtyInput.oninput = updateRowTotal;
  };

  document.getElementById("user-exp-add-item-btn").onclick = addItemRow;
  addItemRow();
  
  document.getElementById("user-submit-exp-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const catType = document.getElementById("user-exp-category-type-popup").value;
    const groupName = catType === "operasional" ? "Operasional Tim" : document.getElementById("user-exp-group-input-popup").value.trim();
    const activity = catType === "operasional" ? "Operasional Tim" : document.getElementById("user-exp-activity-popup").value;
    const desc = document.getElementById("user-exp-desc-popup").value.trim();
    
    calculateExpGrandTotal();
    const grandTotal = parseInt(document.getElementById("user-exp-grand-total").textContent) || 0;
    
    if (grandTotal <= 0) {
      showToast("Total pengeluaran harus lebih dari 0 SAR! Mohon isi rincian item biaya.", "error");
      return;
    }
    
    const itemRows = itemsContainer.querySelectorAll(".exp-item-row-popup");
    const items = Array.from(itemRows).map(row => {
      const cat = row.querySelector(".item-cat").value.trim();
      return {
        category: cat || "Operasional",
        price: parseInt(row.querySelector(".item-price").value) || 0,
        qty: parseInt(row.querySelector(".item-qty").value) || 1,
        total: parseInt(row.querySelector(".item-total").value) || 0
      };
    });
    
    const photoInput = document.getElementById("user-exp-photo-popup");
    
    const saveAndSubmitExpense = (receiptUrl) => {
      const newExp = {
        id: `exp-${Date.now()}`,
        username,
        groupName: groupName || "Operasional Tim",
        wallet: activity || "Operasional Tim",
        amount: grandTotal,
        description: desc,
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
        receipt: receiptUrl || "",
        status: "Pending",
        items
      };
      
      state.financial.expenses.push(newExp);
      // Do NOT deduct wallet balance while expense status is Pending. Deduction occurs upon Admin approval!
      saveState();
      
      addNotification("financial", `Laporan Kas: ${state.currentUser ? state.currentUser.name : username} membelanjakan SAR ${grandTotal} (${desc})`, { username, groupName: newExp.groupName });
      closeModal();
      showToast("Laporan Kas disubmit!");
      
      if (document.getElementById("user-laporan-tab-container")) {
        loadUserTab("kas");
      } else {
        router();
      }
    };
    
    if (photoInput && photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        saveAndSubmitExpense(evt.target.result);
      };
      reader.onerror = function() {
        saveAndSubmitExpense("");
      };
      reader.readAsDataURL(file);
    } else {
      saveAndSubmitExpense("struk_user_multi.jpg");
    }
  };
}

function loadUserTab(tab) {
  const container = document.getElementById("user-laporan-tab-container");
  const username = state.currentUser.username;
  const myWalletBal = state.financial.wallets[username] || 0;
  
  if (tab === "kas") {
    const myExpenses = state.financial.expenses.filter(e => e.username === username);
    const myTransfers = state.financial.transactions.filter(tx => tx.sender === username || tx.recipient === username);
    
    let combinedTxs = [];
    myExpenses.forEach(e => {
      combinedTxs.push({
        id: e.id,
        rawType: 'expense',
        category: 'Uang Keluar',
        amount: -e.amount,
        description: e.description,
        date: e.date,
        status: e.status,
        details: e
      });
    });
    myTransfers.forEach(tx => {
      const isSender = (tx.sender === username);
      combinedTxs.push({
        id: tx.id,
        rawType: 'transfer',
        category: isSender ? 'Transfer Keluar' : 'Uang Masuk',
        amount: isSender ? -tx.amount : tx.amount,
        description: isSender ? `Transfer ke ${tx.recipient === 'Dompet Utama' ? 'Admin' : (state.users.find(u => u.username === tx.recipient)?.name || tx.recipient)}` : `Uang masuk dari ${tx.sender === 'Dompet Utama' ? 'Admin' : (state.users.find(u => u.username === tx.sender)?.name || tx.sender)}`,
        date: tx.date,
        status: tx.status,
        details: tx
      });
    });
    
    combinedTxs.sort((a, b) => {
      const timeA = parseInt(a.id.split('-')[1]) || 0;
      const timeB = parseInt(b.id.split('-')[1]) || 0;
      return timeB - timeA;
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:10px; flex-wrap:wrap; background:#ffffff; padding:12px 14px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div style="font-size:0.92rem; font-weight:800; color:${myWalletBal < 0 ? '#ef4444' : '#0f172a'}; display:flex; align-items:center; gap:6px;">
          <i data-lucide="wallet" style="width:18px; height:18px; color:#c5a850;"></i>
          <span>Saldo Dompet: <span style="color:${myWalletBal < 0 ? '#ef4444' : '#10b981'}; font-weight:900;">SAR ${myWalletBal.toLocaleString('id-ID')}</span> ${myWalletBal < 0 ? '(Piutang)' : ''}</span>
        </div>
      </div>

      <!-- Filters Section -->
      <div style="background:#ffffff; border-radius:12px; padding:12px; border:1px solid #cbd5e1; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:10px;">
        <!-- Search bar -->
        <input type="text" id="user-tx-search" class="form-input" placeholder="Cari deskripsi, tipe, nominal, atau status..." style="padding:8px 12px; font-size:0.85rem;">
        
        <!-- Filters Row: Date Range & Category -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Dari Tanggal</label>
            <input type="date" id="user-tx-date-from" class="form-input" style="padding:6px 8px; font-size:0.78rem;">
          </div>
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Smp Tanggal</label>
            <input type="date" id="user-tx-date-to" class="form-input" style="padding:6px 8px; font-size:0.78rem;">
          </div>
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Kategori</label>
            <select id="user-tx-cat-filter" class="form-select" style="padding:6px 8px; font-size:0.78rem;">
              <option value="Semua">Semua Kategori</option>
              <option value="Uang Masuk">Uang Masuk</option>
              <option value="Uang Keluar">Uang Keluar</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- List History -->
      <div class="activity-list" id="user-tx-history-list" style="box-shadow:var(--shadow-neumorphic);"></div>
    `;
    
    const renderTxList = () => {
      const query = document.getElementById("user-tx-search") ? document.getElementById("user-tx-search").value.toLowerCase().trim() : "";
      const dateFrom = document.getElementById("user-tx-date-from") ? document.getElementById("user-tx-date-from").value : "";
      const dateTo = document.getElementById("user-tx-date-to") ? document.getElementById("user-tx-date-to").value : "";
      const catFilter = document.getElementById("user-tx-cat-filter") ? document.getElementById("user-tx-cat-filter").value : "Semua";

      const listEl = document.getElementById("user-tx-history-list");
      
      const filtered = combinedTxs.filter(tx => {
        // Search Filter
        if (query !== "") {
          const matchQuery = 
            tx.category.toLowerCase().includes(query) || 
            tx.description.toLowerCase().includes(query) || 
            formatDateDisplay(tx.date).toLowerCase().includes(query) ||
            tx.status.toLowerCase().includes(query) ||
            Math.abs(tx.amount).toString().includes(query);
          if (!matchQuery) return false;
        }

        // Date Range Filter
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;

        // Category Filter
        if (catFilter !== "Semua") {
          if (catFilter === "Uang Masuk") {
            if (tx.amount <= 0 && tx.category !== "Uang Masuk") return false;
          } else if (catFilter === "Uang Keluar") {
            if (tx.rawType !== "expense" && tx.category !== "Uang Keluar") return false;
          } else if (catFilter === "Transfer") {
            if (tx.rawType !== "transfer" && !tx.category.toLowerCase().includes("transfer")) return false;
          }
        }

        return true;
      });
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:14px;font-size:0.85rem;">Tidak ada transaksi ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(tx => {
        let statusClass = "badge-warning";
        if (tx.status === "Approved" || tx.status === "Success" || tx.status === "Disetujui") statusClass = "badge-success";
        if (tx.status === "Ditolak" || tx.status === "Rejected") statusClass = "badge-danger";
        
        const isPositive = tx.amount > 0;
        const amountText = `${isPositive ? '+' : '-'} SAR ${Math.abs(tx.amount).toLocaleString('id-ID')}`;
        const amountColor = isPositive ? '#10b981' : '#ef4444';
        
        return `
          <div class="activity-item" style="border-bottom:var(--border-light); padding:12px 0;">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.85rem;">${tx.category}</strong>
                <span class="badge ${statusClass}">${tx.status}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0;">
                <span style="font-size:0.8rem; color:var(--text-muted); max-width:70%;">${tx.description}</span>
                <strong style="color:${amountColor}; font-size:0.9rem;">${amountText}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light);">
                <span>${formatDateDisplay(tx.date)}</span>
                <button class="btn btn-secondary view-tx-detail-btn" data-id="${tx.id}" style="width:auto; padding:4px 8px; font-size:0.7rem;">Detail Preview</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      // Bind details popup click
      listEl.querySelectorAll(".view-tx-detail-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          const tx = combinedTxs.find(x => x.id === id);
          if (!tx) return;
          
          let statusClass = "badge-warning";
          if (tx.status === "Approved" || tx.status === "Success" || tx.status === "Disetujui") statusClass = "badge-success";
          if (tx.status === "Ditolak" || tx.status === "Rejected") statusClass = "badge-danger";
          const isPositive = tx.amount > 0;
          const amountText = `${isPositive ? '+' : '-'} SAR ${Math.abs(tx.amount).toLocaleString('id-ID')}`;
          const amountColor = isPositive ? '#10b981' : '#ef4444';
          
          let itemsHtml = '';
          if (tx.details && tx.details.items && tx.details.items.length > 0) {
            itemsHtml = `
              <div style="margin-top:14px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item Belanja:</strong>
                <table class="data-table" style="font-size:0.75rem; margin-top:6px; width:100%;">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style="text-align:center;">Qty</th>
                      <th style="text-align:right;">Harga</th>
                      <th style="text-align:right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tx.details.items.map(item => `
                      <tr>
                        <td>${item.category || item.name}</td>
                        <td style="text-align:center;">${item.qty}</td>
                        <td style="text-align:right;">SAR ${item.price}</td>
                        <td style="text-align:right;">SAR ${(item.qty * item.price)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }
          
          let receiptHtml = '';
          if (tx.details && tx.details.receipt) {
            receiptHtml = `
              <div style="margin-top:12px; text-align:center;">
                <button id="toggle-receipt-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem;"><i data-lucide="image" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat File Struk</button>
              </div>
              <div id="receipt-preview-container" class="hidden" style="margin-top:12px; text-align:center;">
                <img src="${tx.details.receipt}" style="max-width:100%; max-height:220px; border-radius:6px; border:1px solid #cbd5e1;">
              </div>
            `;
          }

          const strukHtml = `
            <div style="font-family:'Mulish', sans-serif; padding:16px;">
              <div id="tx-capture-area" style="padding:16px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px;">
                <div style="text-align:center; border-bottom:2px dashed #cbd5e1; padding-bottom:12px; margin-bottom:16px;">
                  <h3 style="font-family:'Martel', serif; text-transform:lowercase; margin:0; font-weight:900;">jejak imani</h3>
                  <p style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 0 0;">Bukti Transaksi Tim Khidmat</p>
                </div>
                
                <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:10px;">
                  <div><strong>Tipe Transaksi:</strong> ${tx.category}</div>
                  <div><strong>Keterangan:</strong> ${tx.description}</div>
                  <div><strong>Tanggal:</strong> ${formatDateDisplay(tx.date)}</div>
                  <div><strong>Status:</strong> <span class="badge ${statusClass}">${tx.status}</span></div>
                  <div style="border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:8px 0; margin-top:8px; font-weight:800; font-size:1.05rem; display:flex; justify-content:space-between;">
                    <span>NOMINAL:</span>
                    <span style="color:${amountColor};">${amountText}</span>
                  </div>
                </div>
                ${itemsHtml}
              </div>
              
              ${receiptHtml}
              
              <div style="margin-top:16px; text-align:center;">
                <button id="capture-tx-btn" class="btn btn-secondary" style="width:100%; padding:8px 16px; font-size:0.8rem; border-color:var(--primary-gold); color:var(--primary-gold); display:inline-flex; align-items:center; justify-content:center; gap:6px;"><i data-lucide="camera" style="width:14px; height:14px;"></i> Capture & Download Slip Gambar</button>
              </div>
              
              ${tx.rawType === 'expense' && (tx.status === 'Approved' || tx.status === 'Disetujui') ? `
                <div style="margin-top:14px; text-align:center;">
                  <button id="modal-request-delete-btn" class="btn btn-danger" style="width:100%; padding:10px;">Request Hapus Transaksi</button>
                </div>
              ` : ''}
            </div>
          `;
          
          openModal("Preview Detail Transaksi", strukHtml);

          const tglBtn = document.getElementById("toggle-receipt-btn");
          if (tglBtn) {
            tglBtn.onclick = () => {
              document.getElementById("receipt-preview-container").classList.toggle("hidden");
            };
          }
          
          const capBtn = document.getElementById("capture-tx-btn");
          if (capBtn) {
            capBtn.onclick = () => {
              const originalText = capBtn.innerHTML;
              capBtn.innerHTML = "Rendering Slip...";
              
              const runCapture = () => {
                const target = document.getElementById("tx-capture-area");
                html2canvas(target, { backgroundColor: "#ffffff", scale: 2 }).then(canvas => {
                  const imgUrl = canvas.toDataURL("image/png");
                  const link = document.createElement("a");
                  link.href = imgUrl;
                  link.download = `Slip_Transaksi_${tx.id}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  capBtn.innerHTML = originalText;
                  showToast("Slip transaksi berhasil di-download!");
                }).catch(err => {
                  capBtn.innerHTML = originalText;
                  showToast("Gagal capture gambar", "error");
                });
              };
              
              if (typeof html2canvas === "undefined") {
                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script.onload = runCapture;
                document.head.appendChild(script);
              } else {
                runCapture();
              }
            };
          }

          
          const delBtn = document.getElementById("modal-request-delete-btn");
          if (delBtn) {
            delBtn.onclick = () => {
              if (confirm("Kirim permintaan hapus transaksi ini ke Admin?")) {
                const exists = state.financial.deleteRequests.some(r => r.expenseId === tx.id);
                if (exists) {
                  showToast("Request hapus sudah pernah dikirim sebelumnya.", "error");
                  return;
                }
                state.financial.deleteRequests.push({
                  id: `del-${Date.now()}`,
                  expenseId: tx.id,
                  username,
                  reason: "Request hapus dari Tim",
                  status: "Pending"
                });
                addNotification("financial", `Request Hapus Transaksi: ${state.currentUser.name} memohon penghapusan exp ${tx.id}`, { username, groupName: tx.details.groupName || '' });
                saveState();
                closeModal();
                showToast("Request hapus berhasil dikirim!");
                loadUserTab("kas");
              }
            };
          }
        };
      });
    };

    const sInp = document.getElementById("user-tx-search");
    const dFromInp = document.getElementById("user-tx-date-from");
    const dToInp = document.getElementById("user-tx-date-to");
    const catInp = document.getElementById("user-tx-cat-filter");

    if (sInp) sInp.oninput = renderTxList;
    if (dFromInp) dFromInp.onchange = renderTxList;
    if (dToInp) dToInp.onchange = renderTxList;
    if (catInp) catInp.onchange = renderTxList;

    renderTxList();
    lucide.createIcons();
  } else if (tab === "jadwal") {
    const offers = state.assignmentOffers.filter(o => o.status === "Tersedia" || (o.status === "Pending Approval" && o.staff.includes(username)));
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; margin-top:10px;">
        <span style="font-size:0.95rem; font-weight:800;">Jadwal Tugas Tersedia</span>
      </div>
      <div class="grid-2col" style="gap:16px;" id="user-offers-list-container"></div>
    `;
    
    const listEl = document.getElementById("user-offers-list-container");
    if (offers.length === 0) {
      listEl.innerHTML = `<p style="text-align:center; color:var(--text-light); padding:20px; grid-column:span 2;">Tidak ada jadwal tugas tersedia untuk diajukan.</p>`;
      return;
    }
    
    listEl.innerHTML = offers.map(o => {
      const isPending = (o.status === "Pending Approval");
      return `
        <div class="assignment-card" style="border-left-color: ${isPending ? 'var(--primary-gold)' : '#10b981'}; background:#fff; padding:16px; margin-bottom:0;">
          <div class="assignment-header" style="border-bottom:1px solid #f1f3f5; padding-bottom:8px; margin-bottom:10px;">
            <strong>${o.type}</strong>
            <span class="badge ${isPending ? 'badge-warning' : 'badge-success'}">${o.status}</span>
          </div>
          <div class="structured-card-grid">
            <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value">${o.groupName}</span></div>
            <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(o.date)} | ${o.time} Saudi</span></div>
            <div class="structured-card-row"><span class="structured-card-label">Wilayah:</span><span class="structured-card-value">${o.region}</span></div>
            ${o.details.remarks ? `<div class="structured-card-row"><span class="structured-card-label">Keterangan:</span><span class="structured-card-value">${o.details.remarks}</span></div>` : ''}
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:12px;">
            ${isPending ? `
              <button class="btn btn-secondary cancel-apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Batal Ajukan</button>
            ` : `
              <button class="btn btn-gold apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Apply Tugas</button>
            `}
          </div>
        </div>
      `;
    }).join('');
    
    listEl.querySelectorAll(".apply-offer-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const offer = state.assignmentOffers.find(x => x.id === id);
        if (offer) {
          if (confirm(`Ajukan diri Anda untuk penugasan ${offer.type} grup ${offer.groupName}?`)) {
            offer.staff = [username];
            offer.status = "Pending Approval";
            addNotification("penjadwalan", `Pengajuan Tugas Mandiri: ${state.currentUser.name} mengajukan diri untuk tugas ${offer.type} grup ${offer.groupName}`, { username, groupName: offer.groupName });
            saveState();
            showToast("Pengajuan tugas mandiri dikirim!");
            loadUserTab("jadwal");
          }
        }
      };
    });
    
    listEl.querySelectorAll(".cancel-apply-offer-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const offer = state.assignmentOffers.find(x => x.id === id);
        if (offer) {
          if (confirm("Batalkan pengajuan diri Anda untuk tugas ini?")) {
            offer.staff = [];
            offer.status = "Tersedia";
            saveState();
            showToast("Pengajuan dibatalkan.");
            loadUserTab("jadwal");
          }
        }
      };
    });
    lucide.createIcons();
    
  } else if (tab === "absensi") {
    const myActiveTasks = state.assignments.filter(a => a && Array.isArray(a.staff) && a.staff.includes(username) && a.status !== "Selesai" && a.published !== false);
    const myAbsences = state.reports.attendance.filter(a => a.username === username);
    const hasActiveTask = (myActiveTasks.length > 0);
    
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; margin-top:10px; flex-wrap:wrap; gap:8px;">
        <h3 class="user-section-title" style="margin:0;">Riwayat Absensi Anda</h3>
        <button id="start-new-absen-btn" class="btn btn-gold" style="width:auto; padding:6px 14px; font-size:0.8rem; font-weight:800;">
          <i data-lucide="camera" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Mulai Absensi Baru
        </button>
      </div>

      <div class="form-group" style="margin-top:10px; margin-bottom:14px;">
        <input type="text" id="user-absen-search" class="form-input" placeholder="Cari riwayat (kategori, tanggal, lokasi)...">
      </div>
      
      <div class="activity-list" id="user-absen-history-list"></div>
    `;
    
    lucide.createIcons();
    
    const renderAbsenceHistory = () => {
      const query = (document.getElementById("user-absen-search")?.value || "").toLowerCase().trim();
      const listEl = document.getElementById("user-absen-history-list");
      if (!listEl) return;

      const filtered = myAbsences.slice().reverse().filter(a => {
        const task = state.assignments.find(t => t.id === a.taskId);
        const taskType = task ? task.type.toLowerCase() : "umum";
        const groupName = task ? task.groupName.toLowerCase() : "";
        const dateStr = formatDateDisplay(a.date).toLowerCase();
        const locationStr = (a.location || a.coords || "").toLowerCase();
        const typeStr = (a.type || "").toLowerCase();
        return taskType.includes(query) || groupName.includes(query) || dateStr.includes(query) || locationStr.includes(query) || typeStr.includes(query);
      });
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; color:var(--text-light); padding:24px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; font-size:0.85rem;">Belum ada riwayat absensi tercatat.</div>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(a => {
        const task = state.assignments.find(t => t.id === a.taskId);
        const typeLabel = a.type === "Masuk" ? "Absensi Masuk" : "Absensi Keluar";
        const badgeBg = a.type === "Masuk" ? "#d1fae5" : "#fee2e2";
        const badgeColor = a.type === "Masuk" ? "#065f46" : "#991b1b";

        return `
          <div class="activity-item" style="border:1px solid #e2e8f0; background:#fff; border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:0.75rem; padding:3px 8px;">${typeLabel}</span>
                <span style="font-size:0.75rem; color:#64748b; font-weight:700;">📅 ${formatAbsenDateTime(a.date, a.time)}</span>
              </div>
              <div style="font-size:0.85rem; color:#1e293b; font-weight:700; margin-bottom:2px;">
                ${task ? task.type : 'Penjadwalan Tim'}
              </div>
              <div style="font-size:0.8rem; color:#475569; margin-bottom:8px;">
                Grup: <strong>${task ? task.groupName : 'Umum'}</strong><br>
                <span style="font-size:0.75rem; color:#64748b;">📍 ${a.location || a.coords || 'Saudi Arabia'}</span>
              </div>

              ${a.photo ? `
                <div style="display:flex; justify-content:flex-end;">
                  <button class="btn btn-secondary view-absen-photo-btn" data-id="${a.id}" style="width:auto; padding:5px 12px; font-size:0.75rem; border-radius:6px; font-weight:700; border:1px solid #cbd5e1;">
                    LIHAT FOTO
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      listEl.querySelectorAll(".view-absen-photo-btn").forEach(btn => {
        btn.onclick = () => {
          const absId = btn.getAttribute("data-id");
          const absRecord = myAbsences.find(x => x.id === absId);
          if (!absRecord || !absRecord.photo) return;
          
          const photoHtml = `
            <div style="text-align:center; padding:4px 0;">
              <img src="${absRecord.photo}" style="width:100%; border-radius:10px; border:2px solid #dfc06b; box-shadow:0 6px 16px rgba(0,0,0,0.15); margin-bottom:12px;">
              <div style="display:flex; justify-content:center; gap:10px;">
                <button class="btn btn-gold" id="share-absen-photo-btn" style="width:auto; padding:6px 16px; font-size:0.8rem; font-weight:800; display:inline-flex; align-items:center; gap:6px;">
                  <i data-lucide="share-2" style="width:14px; height:14px;"></i> Share Foto
                </button>
                <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
              </div>
            </div>
          `;
          openModal("Foto Absensi", photoHtml);
          
          const shareBtn = document.getElementById("share-absen-photo-btn");
          if (shareBtn) {
            shareBtn.onclick = () => {
              if (navigator.share) {
                fetch(absRecord.photo)
                  .then(res => res.blob())
                  .then(blob => {
                    const file = new File([blob], "Foto_Absensi.jpg", { type: "image/jpeg" });
                    navigator.share({
                      title: "Foto Absensi Khidmat",
                      text: `Foto Absensi: ${absRecord.username} - ${absRecord.date}`,
                      files: [file]
                    }).catch(err => console.warn(err));
                  })
                  .catch(() => {
                    const a = document.createElement("a");
                    a.href = absRecord.photo;
                    a.download = "Foto_Absensi.jpg";
                    a.click();
                  });
              } else {
                const a = document.createElement("a");
                a.href = absRecord.photo;
                a.download = "Foto_Absensi.jpg";
                a.click();
                showToast("Foto Absensi di-download.");
              }
            };
          }
        };
      });
    };
    
    const searchInput = document.getElementById("user-absen-search");
    if (searchInput) searchInput.oninput = renderAbsenceHistory;
    renderAbsenceHistory();
    
    document.getElementById("start-new-absen-btn").onclick = () => {
      openAttendanceFormPopup();
    };
  } else if (tab === "insiden") {
    const myIncidents = state.reports.incidents.filter(i => i.username === username);
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; margin-top:6px;">
        <h3 class="user-section-title" style="margin:0; font-size:1.05rem; font-weight:900; color:#0f172a;">Riwayat Laporan</h3>
        <div style="display:flex; gap:8px;">
          <button id="open-timer-report-btn" class="btn btn-gold" style="width:38px; height:38px; padding:0; border-radius:10px; display:inline-flex; align-items:center; justify-content:center;" title="Timer Operational">
            <i data-lucide="timer" style="width:20px; height:20px;"></i>
          </button>
          <button id="open-grid-report-btn" class="btn btn-gold" style="width:38px; height:38px; padding:0; border-radius:10px; display:inline-flex; align-items:center; justify-content:center;" title="Grid Foto & Checklist">
            <i data-lucide="grid" style="width:20px; height:20px;"></i>
          </button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <input type="text" id="user-inc-search" class="form-input" placeholder="Cari Riwayat Laporan (grup, kategori, detail)...">
      </div>
      
      <div class="activity-list" id="user-inc-history-list"></div>
    `;

    lucide.createIcons();
    document.getElementById("open-timer-report-btn").onclick = () => openTimerReportPopup();
    document.getElementById("open-grid-report-btn").onclick = () => openGridPhotoReportPopup();
    
    const renderIncList = () => {
      const query = document.getElementById("user-inc-search").value.toLowerCase().trim();
      const listEl = document.getElementById("user-inc-history-list");
      
      // Sort newest first
      const sortedIncidents = myIncidents.slice().reverse();

      const filtered = sortedIncidents.filter(i => 
        i.category.toLowerCase().includes(query) || 
        i.groupName.toLowerCase().includes(query) || 
        i.detail.toLowerCase().includes(query) || 
        i.date.toLowerCase().includes(query)
      );
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:14px;font-size:0.85rem;">Tidak ada riwayat laporan ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(i => {
        const formattedDetail = i.detail.replace(/\n/g, '<br>');
        const hasPhotos = Array.isArray(i.photos) && i.photos.length > 0;
        const abbrevDate = formatReportDateAbbrev(i.date);

        return `
          <div class="activity-item" style="border:1px solid #e2e8f0; background:#ffffff; border-radius:12px; padding:14px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:0.9rem; color:#0f172a;">${i.category}</strong>
                <span class="badge badge-gold" style="font-size:0.72rem; padding:2px 8px;">${i.status}</span>
              </div>
              <div style="font-size:0.82rem; color:#334155; margin-bottom:10px; line-height:1.5;">
                Grup: <strong style="color:var(--primary-gold);">${i.groupName}</strong><br>
                <div style="margin-top:6px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #f1f5f9; font-family:monospace; font-size:0.8rem; white-space:pre-wrap;">${formattedDetail}</div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#64748b;">
                <span style="font-weight:700; color:#475569;">${abbrevDate}</span>
                <div style="display:flex; gap:8px; align-items:center;">
                  ${hasPhotos ? `
                    <button class="btn btn-secondary preview-inc-photos-btn" data-id="${i.id}" style="width:34px; height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; color:#0f172a;" title="Preview Foto Dokumentasi">
                      <i data-lucide="image" style="width:16px; height:16px;"></i>
                    </button>
                  ` : ''}
                  <button class="btn btn-gold share-inc-wa-btn" data-id="${i.id}" style="width:34px; height:34px; padding:0; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; justify-content:center; border-radius:8px;" title="Share WhatsApp">
                    <i data-lucide="share-2" style="width:16px; height:16px;"></i>
                  </button>
                  ${i.status !== 'Request Hapus' ? `
                    <button class="btn btn-danger request-delete-inc-btn" data-id="${i.id}" style="width:34px; height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; background:#ef4444; color:#fff;" title="Request Hapus">
                      <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      lucide.createIcons();

      // Bind Preview Photos
      listEl.querySelectorAll(".preview-inc-photos-btn").forEach(btn => {
        btn.onclick = () => {
          const incId = btn.getAttribute("data-id");
          const inc = myIncidents.find(x => x.id === incId);
          if (!inc || !inc.photos) return;

          const photosHtml = `
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; max-height:400px; overflow-y:auto; padding:4px;">
              ${inc.photos.map(p => `<img src="${p}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1;">`).join('')}
            </div>
            <div style="text-align:center; margin-top:14px;">
              <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
            </div>
          `;
          openModal("Preview Foto Dokumentasi", photosHtml);
        };
      });

      // Bind Share WhatsApp button
      listEl.querySelectorAll(".share-inc-wa-btn").forEach(btn => {
        btn.onclick = () => {
          const incId = btn.getAttribute("data-id");
          const inc = myIncidents.find(x => x.id === incId);
          if (!inc) return;

          const textToShare = inc.detail;

          if (navigator.share && Array.isArray(inc.photos) && inc.photos.length > 0) {
            Promise.all(inc.photos.map((dataUrl, idx) => {
              return fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => new File([blob], `Foto_${idx+1}.jpg`, { type: 'image/jpeg' }));
            })).then(files => {
              navigator.share({
                title: inc.category,
                text: textToShare,
                files: files.slice(0, 4)
              }).catch(() => {
                const waUrl = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
                window.open(waUrl, '_blank');
              });
            }).catch(() => {
              const waUrl = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
              window.open(waUrl, '_blank');
            });
          } else {
            const waUrl = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
            window.open(waUrl, '_blank');
          }
        };
      });
      
      listEl.querySelectorAll(".copy-inc-text-btn").forEach(btn => {
        btn.onclick = () => {
          const text = btn.getAttribute("data-text");
          navigator.clipboard.writeText(text);
          showToast("Teks laporan WhatsApp berhasil disalin!");
        };
      });
      listEl.querySelectorAll(".request-delete-inc-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Ajukan permintaan hapus laporan kejadian ini ke admin?")) {
            const inc = state.reports.incidents.find(x => x.id === id);
            if (inc) {
              inc.status = "Request Hapus";
              addNotification("penjadwalan", `Request Hapus Kejadian: ${state.currentUser.name} memohon penghapusan laporan kejadian grup ${inc.groupName}`, { username: state.currentUser.username, groupName: inc.groupName });
              saveState();
              showToast("Permintaan hapus dikirim ke admin.");
              renderIncList();
            }
          }
        };
      });
    };
    
    document.getElementById("user-inc-search").oninput = renderIncList;
    renderIncList();
    
    document.getElementById("add-inc-user-popup-btn").onclick = () => {
      const popupHtml = `
        <form id="user-submit-inc-form-popup">
          <div class="form-group">
            <label class="form-label">Pilih Grup Keberangkatan</label>
            <select id="user-inc-group-popup" class="form-select" required>
              <option value="">-- Pilih Grup --</option>
              ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select id="user-inc-cat-select-popup" class="form-select" required>
              <option value="Waktu Kedatangan Bandara">Waktu Kedatangan Bandara</option>
              <option value="Waktu Kepulangan Bandara">Waktu Kepulangan Bandara</option>
              <option value="Lainnya">Lainnya (Custom Kategori)</option>
            </select>
          </div>
          
          <div class="form-group hidden" id="user-inc-custom-cat-container-popup">
            <label class="form-label">Nama Kategori Kustom</label>
            <input type="text" id="user-inc-custom-cat-popup" class="form-input">
          </div>
          
          <!-- Conditional fields -->
          <div id="inc-arrival-fields-popup" class="hidden">
            <div class="form-group">
              <label class="form-label">Waktu Landing (Saudi Time)</label>
              <input type="time" id="user-arr-landing-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Jamaah Keluar Imigrasi (Saudi Time)</label>
              <input type="time" id="user-arr-imigrasi-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Bus Berangkat (Saudi Time)</label>
              <input type="time" id="user-arr-bus-popup" class="form-input">
            </div>
          </div>
          
          <div id="inc-departure-fields-popup" class="hidden">
            <div class="form-group">
              <label class="form-label">Waktu Bus Masuk Checkpoint (Saudi Time)</label>
              <input type="time" id="user-dep-checkpoint-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Bus Naik (Saudi Time)</label>
              <input type="time" id="user-dep-board-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Jamaah Masuk Imigrasi (Saudi Time)</label>
              <input type="time" id="user-dep-imigrasi-popup" class="form-input">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Detail Laporan Tambahan</label>
            <textarea id="user-inc-detail-popup" class="form-textarea" rows="3" required></textarea>
          </div>
          
          <button type="submit" class="btn btn-primary">Kirim Laporan</button>
        </form>
      `;
      openModal("Tambah Laporan Kejadian", popupHtml);
      
      const catSelectPopup = document.getElementById("user-inc-cat-select-popup");
      catSelectPopup.onchange = () => {
        const val = catSelectPopup.value;
        document.getElementById("user-inc-custom-cat-container-popup").classList.add("hidden");
        document.getElementById("inc-arrival-fields-popup").classList.add("hidden");
        document.getElementById("inc-departure-fields-popup").classList.add("hidden");
        
        if (val === "Lainnya") {
          document.getElementById("user-inc-custom-cat-container-popup").classList.remove("hidden");
        } else if (val === "Waktu Kedatangan Bandara") {
          document.getElementById("inc-arrival-fields-popup").classList.remove("hidden");
        } else if (val === "Waktu Kepulangan Bandara") {
          document.getElementById("inc-departure-fields-popup").classList.remove("hidden");
        }
      };
      
      document.getElementById("user-submit-inc-form-popup").onsubmit = (event) => {
        event.preventDefault();
        const groupName = document.getElementById("user-inc-group-popup").value;
        const catVal = catSelectPopup.value;
        const customCat = document.getElementById("user-inc-custom-cat-popup").value.trim();
        const finalCategory = catVal === "Lainnya" ? customCat : catVal;
        let detailText = document.getElementById("user-inc-detail-popup").value.trim();
        
        if (catVal === "Waktu Kedatangan Bandara") {
          const landing = document.getElementById("user-arr-landing-popup").value;
          const imigrasi = document.getElementById("user-arr-imigrasi-popup").value;
          const bus = document.getElementById("user-arr-bus-popup").value;
          let totalStr = "N/A";
          if (imigrasi && bus && imigrasi.includes(':') && bus.includes(':')) {
            const [h1, m1] = imigrasi.split(':').map(Number);
            const [h2, m2] = bus.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
              let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diffMin < 0) diffMin += 24 * 60;
              totalStr = `${Math.floor(diffMin / 60)} jam ${diffMin % 60} menit`;
            }
          }
          detailText = `Landing: ${landing}\nKeluar Imigrasi: ${imigrasi}\nBus Berangkat: ${bus}\nTotal Waktu: ${totalStr}\nCatatan: ${detailText}`;
        } else if (catVal === "Waktu Kepulangan Bandara") {
          const checkpoint = document.getElementById("user-dep-checkpoint-popup").value;
          const board = document.getElementById("user-dep-board-popup").value;
          const imigrasi = document.getElementById("user-dep-imigrasi-popup").value;
          let totalStr = "N/A";
          if (board && imigrasi && board.includes(':') && imigrasi.includes(':')) {
            const [h1, m1] = board.split(':').map(Number);
            const [h2, m2] = imigrasi.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
              let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diffMin < 0) diffMin += 24 * 60;
              totalStr = `${Math.floor(diffMin / 60)} jam ${diffMin % 60} menit`;
            }
          }
          detailText = `Bus Checkpoint: ${checkpoint}\nBus Naik: ${board}\nImigrasi: ${imigrasi}\nTotal Waktu: ${totalStr}\nCatatan: ${detailText}`;
        }
        
        state.reports.incidents.push({
          id: `inc-${Date.now()}`,
          username,
          groupName,
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          category: finalCategory,
          detail: detailText,
          status: "Diproses",
          unread: true
        });
        saveState();
        
        addNotification("penjadwalan", `Laporan Kejadian: ${state.currentUser.name} melaporkan insiden ${finalCategory}`, { username, groupName });
        closeModal();
        showToast("Laporan kejadian berhasil disubmit!");
        loadUserTab("insiden");
      };
    };
    
    lucide.createIcons();
  }
}
// --- 9. PORTAL ADMIN (COLLAPSIBLE SIDEBAR) ---
function renderAdminPortal(subView) {
  const { gregorianLongStr, hijriStr, timeStr } = getSaudiDateTime();
  const activeSubView = subView.split("?")[0];
  
  APP_CONTAINER.innerHTML = `
    <div class="admin-layout">
      <!-- Sidebar -->
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <div class="admin-brand">
            <img src="assets/logo.png" alt="Logo jejak imani" class="admin-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
            <h1 class="admin-title">Portal Admin</h1>
          </div>
          <button class="sidebar-close-btn" id="sidebar-close-btn">
            <i data-lucide="x" style="width: 20px; height: 20px;"></i>
          </button>
        </div>
        
        <nav class="admin-nav">
          <!-- Kategori: Menu Baru -->
          <div class="sidebar-category-title" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-light); padding:10px 16px 4px 16px; font-weight:700; opacity:0.8;">Menu Baru</div>
          <div class="admin-nav-item ${activeSubView === 'dashboard' ? 'active' : ''}" data-target="dashboard">
            <i data-lucide="layout-dashboard"></i><span>Dashboard</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'itinerary' ? 'active' : ''}" data-target="itinerary">
            <i data-lucide="calendar"></i><span>Itinerary</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'penjadwalan' ? 'active' : ''}" data-target="penjadwalan">
            <i data-lucide="users-round"></i><span>Penjadwalan Tim</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'datatim' ? 'active' : ''}" data-target="datatim">
            <i data-lucide="contact"></i><span>Data Tim</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'financial' ? 'active' : ''}" data-target="financial">
            <i data-lucide="wallet"></i><span>Financial</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'laporan' ? 'active' : ''}" data-target="laporan">
            <i data-lucide="file-spreadsheet"></i><span>Laporan</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'vendor' ? 'active' : ''}" data-target="vendor">
            <i data-lucide="store"></i><span>Vendor & Booking</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'aset' ? 'active' : ''}" data-target="aset">
            <i data-lucide="box"></i><span>Aset Operasional</span>
          </div>
          
          <!-- Kategori: Menu Yang Sudah Ada -->
          <div class="sidebar-category-title" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-light); padding:16px 16px 4px 16px; font-weight:700; opacity:0.8;">Menu Yang Sudah Ada</div>
          <div class="admin-nav-item ${activeSubView === 'manifest' ? 'active' : ''}" data-target="manifest">
            <i data-lucide="clipboard-list"></i><span>Manifest Grup</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'manifest-jamaah' ? 'active' : ''}" data-target="manifest-jamaah">
            <i data-lucide="users"></i><span>Manifest Jamaah</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'roomlist' ? 'active' : ''}" data-target="roomlist">
            <i data-lucide="hotel"></i><span>Roomlist Template</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'dokumen' ? 'active' : ''}" data-target="dokumen">
            <i data-lucide="files"></i><span>Arsip Dokumen</span>
          </div>
        </nav>
        
        <div class="admin-sidebar-footer" style="flex-direction: column; align-items: stretch; gap: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div class="admin-user-info">
              <span class="admin-user-name">${state.currentUser.name}</span>
              <span class="admin-user-role">Administrator</span>
            </div>
            <button class="logout-btn" id="admin-logout-btn" title="Logout">
              <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
          <div class="db-status-wrapper" style="font-size:0.7rem; color:var(--text-light); display:flex; align-items:center; gap:6px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
            <span class="db-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#ef4444; transition: all 0.3s ease;"></span>
            <span style="font-weight:600; opacity:0.9;">DB:</span>
            <span class="db-status-text" style="font-weight:500;">Terputus (Lokal)</span>
          </div>
        </div>
      </aside>
      
      <!-- Main Content -->
      <div class="admin-main">
        <header class="admin-topbar" style="display:flex; flex-direction:column; padding:12px 20px; background:#ffffff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:90;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" title="Toggle Menu Sidebar" style="background:transparent; border:none; padding:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; position:relative; z-index:1001; pointer-events:auto;">
                <i data-lucide="menu" style="width: 22px; height: 22px; color:#0f172a;"></i>
              </button>
              <h2 class="admin-page-title" id="admin-view-title" style="margin:0; font-size:1.2rem; font-weight:800; color:#0f172a;">Dashboard</h2>
            </div>
            <div class="admin-topbar-right" style="display:flex; align-items:center; gap:6px;">
              <button class="btn btn-secondary icon-hdr-btn" onclick="openAdminSettingsPopup();" title="Pengaturan & Font Size" style="width:auto; padding:6px 10px; border-radius:8px; background:#f8fafc; border-color:#cbd5e1; display:inline-flex; align-items:center; justify-content:center;">
                <i data-lucide="settings" style="width: 16px; height: 16px; color:#0f172a;"></i>
              </button>
              <button class="btn btn-secondary icon-hdr-btn" onclick="downloadDatabaseBackup();" title="Backup Data" style="width:auto; padding:6px 10px; border-radius:8px; background:#f8fafc; border-color:#cbd5e1; display:inline-flex; align-items:center; justify-content:center;">
                <i data-lucide="download" style="width: 16px; height: 16px; color:#0f172a;"></i>
              </button>
              <label class="btn btn-secondary icon-hdr-btn" title="Restore Data" style="width:auto; padding:6px 10px; border-radius:8px; background:#f8fafc; border-color:#cbd5e1; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; margin:0;">
                <i data-lucide="upload" style="width: 16px; height: 16px; color:#0f172a;"></i>
                <input type="file" id="restore-db-input" accept=".json" onchange="restoreDatabaseBackup(event);" style="display:none;">
              </label>
              <button class="btn btn-secondary icon-hdr-btn" onclick="window.location.reload();" title="Refresh App" style="width:auto; padding:6px 10px; border-radius:8px; background:#f8fafc; border-color:#cbd5e1; display:inline-flex; align-items:center; justify-content:center;">
                <i data-lucide="rotate-cw" style="width: 16px; height: 16px; color:#0f172a;"></i>
              </button>
              <div class="admin-datetime desktop-only-datetime">
                <span>${gregorianLongStr} / ${hijriStr}</span>
                <span class="admin-clock">Saudi: <span class="saudi-clock-widget">${timeStr}</span></span>
              </div>
            </div>
          </div>
          
          <!-- Mobile Sub-Header Date & Clock Bar (1 row attached seamlessly) -->
          <div class="admin-mobile-datetime-subbar">
            <span>${gregorianLongStr} / ${hijriStr}</span>
            <span class="admin-clock">Saudi: <span class="saudi-clock-widget">${timeStr}</span></span>
          </div>
        </header>
        
        <main class="admin-body" id="admin-subview-content"></main>
      </div>
    </div>
  `;
  
  // Navigation mapping
  document.querySelectorAll(".admin-nav-item").forEach(item => {
    item.onclick = () => window.location.hash = `#admin/${item.getAttribute("data-target")}`;
  });
  
  const sidebar = document.getElementById("admin-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    };
  }
  const closeBtn = document.getElementById("sidebar-close-btn");
  if (closeBtn && sidebar) {
    closeBtn.onclick = () => {
      sidebar.classList.remove("open");
      sidebar.classList.add("collapsed");
    };
  }
  
  document.getElementById("admin-logout-btn").onclick = () => {
    state.currentUser = null;
    saveState();
    window.location.hash = "#login";
  };
  
  const viewTitle = document.getElementById("admin-view-title");
  
  if (activeSubView === "dashboard") {
    viewTitle.textContent = "Dashboard";
    renderAdminDashboard();
  } else if (activeSubView === "itinerary") {
    viewTitle.textContent = "Itinerary";
    renderAdminItinerary();
  } else if (activeSubView === "penjadwalan") {
    viewTitle.textContent = "Penjadwalan";
    renderAdminPenjadwalan();
    if (window.location.hash.includes("filter=applied")) {
      setTimeout(() => {
        const quotaFilter = document.getElementById("admin-task-quota-filter");
        if (quotaFilter) {
          quotaFilter.value = "pending_approval";
          quotaFilter.dispatchEvent(new Event('change'));
        }
      }, 50);
    }
  } else if (activeSubView === "datatim") {
    viewTitle.textContent = "Data Tim";
    renderAdminDataTim();
  } else if (activeSubView === "financial") {
    viewTitle.textContent = "Keuangan";
    renderAdminFinancial();
  } else if (activeSubView === "laporan") {
    viewTitle.textContent = "Laporan Lapangan";
    renderAdminLaporan();
  } else if (activeSubView === "vendor") {
    viewTitle.textContent = "Vendor & Booking";
    renderAdminVendor();
  } else if (activeSubView === "manifest") {
    viewTitle.textContent = "Manifest Grup";
    renderAdminManifest();
  } else if (activeSubView === "manifest-jamaah") {
    viewTitle.textContent = "Manifest Jamaah";
    renderAdminManifestJamaah();
  } else if (activeSubView === "roomlist") {
    viewTitle.textContent = "Roomlist Template";
    renderAdminRoomlist();
  } else if (activeSubView === "dokumen") {
    viewTitle.textContent = "Arsip Dokumen";
    renderAdminDokumen();
  } else if (activeSubView === "aset") {
    viewTitle.textContent = "Aset Operasional";
    renderAdminAset();
  } else {
    window.location.hash = "#admin/dashboard";
  }
  
  try {
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch(e) {
    console.warn("Lucide icon creation warning:", e);
  }
}

// --- ADMIN SUB-VIEW: DASHBOARD ---
function renderAdminDashboard() {
  const container = document.getElementById("admin-subview-content");
  
  const pendingExpenses = state.financial.expenses.filter(e => e.status === 'Pending').length;
  const totalApplicantsCount = state.assignments.reduce((sum, t) => sum + (t.applicants ? t.applicants.length : 0), 0);
  const pendingUsersCount = state.users.filter(u => u.pendingApproval === true).length;
  const unreadAbsences = state.reports.attendance.filter(a => a.unread).length;
  const unreadIncidents = state.reports.incidents.filter(i => i.unread).length;
  const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  const allCount = state.groups.length;
  const upcomingCount = state.groups.filter(g => todayStr < g.dateStart).length;
  const activeCount = state.groups.filter(g => todayStr >= g.dateStart && todayStr <= g.dateEnd).length;
  const completedCount = state.groups.filter(g => todayStr > g.dateEnd).length;
  
  container.innerHTML = `
    <!-- Top metrics -->
    <div class="metrics-grid">
      <!-- 1. Kas Dompet Utama -->
      <div class="metric-card" onclick="window.location.hash = '#admin/financial'" style="cursor:pointer;" title="Buka Financial">
        <div class="metric-info">
          <h4>Kas Dompet Utama</h4>
          <div class="metric-val gold" style="white-space: nowrap;">SAR ${state.financial.mainBalance.toLocaleString('id-ID')}</div>
        </div>
        <div class="metric-icon"><i data-lucide="wallet"></i></div>
      </div>
      
      <!-- 2. Approval Kas -->
      <div class="metric-card" onclick="window.location.hash = '#admin/financial'" style="cursor:pointer;" title="Buka Approval Kas">
        <div class="metric-info">
          <h4>Approval Kas</h4>
          <div class="metric-val ${pendingExpenses > 0 ? 'gold' : ''}">${pendingExpenses}</div>
        </div>
        <div class="metric-icon"><i data-lucide="receipt"></i></div>
      </div>
      
      <!-- 3. Laporan Absensi -->
      <div class="metric-card" onclick="window.adminLaporanTabMode = 'absensi'; window.location.hash = '#admin/laporan';" style="cursor:pointer;" title="Buka Laporan Absensi">
        <div class="metric-info">
          <h4>Laporan Absensi</h4>
          <div class="metric-val ${unreadAbsences > 0 ? 'gold' : ''}">${unreadAbsences}</div>
        </div>
        <div class="metric-icon"><i data-lucide="clipboard-list"></i></div>
      </div>
      
      <!-- 4. Laporan Kejadian -->
      <div class="metric-card" onclick="window.adminLaporanTabMode = 'kejadian'; window.location.hash = '#admin/laporan';" style="cursor:pointer;" title="Buka Laporan Kejadian">
        <div class="metric-info">
          <h4>Laporan Kejadian</h4>
          <div class="metric-val ${unreadIncidents > 0 ? 'gold' : ''}">${unreadIncidents}</div>
        </div>
        <div class="metric-icon"><i data-lucide="alert-triangle"></i></div>
      </div>
      
      <!-- 5. Pendaftar Baru -->
      <div class="metric-card" onclick="window.location.hash = '#admin/datatim?tab=pending'" style="cursor:pointer;" title="Buka Pendaftar Baru">
        <div class="metric-info">
          <h4>Pendaftar Baru</h4>
          <div class="metric-val ${pendingUsersCount > 0 ? 'gold' : ''}">${pendingUsersCount}</div>
        </div>
        <div class="metric-icon"><i data-lucide="user-plus"></i></div>
      </div>
      
      <!-- 6. Apply Tugas -->
      <div class="metric-card" onclick="window.location.hash = '#admin/penjadwalan?filter=applied'" style="cursor:pointer;" title="Buka Approval Apply Tugas">
        <div class="metric-info">
          <h4>Apply Tugas</h4>
          <div class="metric-val ${totalApplicantsCount > 0 ? 'gold' : ''}">${totalApplicantsCount}</div>
        </div>
        <div class="metric-icon"><i data-lucide="user-check"></i></div>
      </div>
    </div>
    
    <!-- Calendar View and Active Groups -->
    
      <div class="table-card">
        <div class="table-header-bar" style="border-bottom:none; padding-bottom:4px;">
          <h3 class="table-title">Daftar Grup</h3>
        </div>
        <div class="tab-header" style="margin-bottom:16px; padding:0 16px; border-bottom:none; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-secondary tab-btn active" id="grup-tab-all" data-filter="all" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid var(--primary-gold); background:var(--primary-gold); color:#fff; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Semua <span class="badge" style="background:#fff; color:var(--primary-gold); border-radius:12px; padding:2px 6px; font-size:0.65rem;">${allCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-upcoming" data-filter="upcoming" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Akan Datang <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${upcomingCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-active" data-filter="active" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Aktif <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${activeCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-completed" data-filter="completed" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Selesai <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${completedCount}</span>
          </button>
        </div>
        <div class="table-wrapper" style="max-height: 280px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Rombongan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="admin-groups-dashboard-tbody"></tbody>
          </table>
        </div>
      </div>
      
      <!-- Interactive active group calendar widget -->
      <div class="dashboard-calendar">
        <div class="calendar-header">
          <button class="calendar-nav-btn" id="cal-prev-btn">&larr;</button>
          <div class="calendar-title-text" id="cal-month-title">Juli 2026</div>
          <button class="calendar-nav-btn" id="cal-next-btn">&rarr;</button>
        </div>
        <div class="calendar-grid" id="cal-grid-body"></div>
        <div style="margin-top:12px; font-size:0.7rem; display:flex; gap:10px; justify-content:center;">
          <span>🟢 Makkah</span>
          <span>🔵 Madinah</span>
          <span>🟡 Jeddah</span>
        </div>
      </div>
  `;
  
  const filterGroupList = (filterType) => {
    let list = state.groups;
    if (filterType === "upcoming") {
      list = state.groups.filter(g => todayStr < g.dateStart);
    } else if (filterType === "active") {
      list = state.groups.filter(g => todayStr >= g.dateStart && todayStr <= g.dateEnd);
    } else if (filterType === "completed") {
      list = state.groups.filter(g => todayStr > g.dateEnd);
    }
    
    const tbody = document.getElementById("admin-groups-dashboard-tbody");
    if (!tbody) return;
    
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada grup untuk kategori ini.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = list.map(g => {
      let badgeClass = "badge-info";
      let statusText = "Akan Datang";
      if (todayStr >= g.dateStart && todayStr <= g.dateEnd) {
        badgeClass = "badge-success";
        statusText = "Aktif";
      } else if (todayStr > g.dateEnd) {
        badgeClass = "badge-secondary";
        statusText = "Selesai";
      }
      return `
        <tr class="active-group-row" data-name="${g.name}" style="cursor:pointer;">
          <td><strong>${g.name}</strong></td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
    
    tbody.querySelectorAll(".active-group-row").forEach(row => {
      row.onclick = () => {
        const name = row.getAttribute("data-name");
        window.location.hash = `#admin/manifest?search=${encodeURIComponent(name)}`;
      };
    });
  };

  const groupTabBtns = container.querySelectorAll(".table-card .tab-btn");
  groupTabBtns.forEach(btn => {
    btn.onclick = () => {
      groupTabBtns.forEach(b => {
        b.classList.remove("active");
        b.style.background = "#fff";
        b.style.borderColor = "#cbd5e1";
        b.style.color = "#475569";
        const bBadge = b.querySelector(".badge");
        if (bBadge) {
          bBadge.style.background = "#cbd5e1";
          bBadge.style.color = "#0f172a";
        }
      });
      
      btn.classList.add("active");
      btn.style.background = "var(--primary-gold)";
      btn.style.borderColor = "var(--primary-gold)";
      btn.style.color = "#fff";
      const btnBadge = btn.querySelector(".badge");
      if (btnBadge) {
        btnBadge.style.background = "#fff";
        btnBadge.style.color = "var(--primary-gold)";
      }
      
      filterGroupList(btn.getAttribute("data-filter"));
    };
  });
  
  filterGroupList("all");
  lucide.createIcons();
  
  renderCalendarNavigator();
  
  document.getElementById("cal-prev-btn").onclick = () => {
    currentCalMonth--;
    if (currentCalMonth < 0) {
      currentCalMonth = 11;
      currentCalYear--;
    }
    renderCalendarNavigator();
  };
  
  document.getElementById("cal-next-btn").onclick = () => {
    currentCalMonth++;
    if (currentCalMonth > 11) {
      currentCalMonth = 0;
      currentCalYear++;
    }
    renderCalendarNavigator();
  };
}
// --- ADMIN SUB-VIEW: ITINERARY ---

function renderCalendarNavigator() {
  const grid = document.getElementById("cal-grid-body");
  const title = document.getElementById("cal-month-title");
  if (!grid || !title) return;
  
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  title.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  
  grid.innerHTML = `
    <div class="calendar-day-header">Min</div>
    <div class="calendar-day-header">Sen</div>
    <div class="calendar-day-header">Sel</div>
    <div class="calendar-day-header">Rab</div>
    <div class="calendar-day-header">Kam</div>
    <div class="calendar-day-header">Jum</div>
    <div class="calendar-day-header">Sab</div>
  `;
  
  const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += `<div style="background:none;"></div>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const todayObj = new Date();
    const isToday = (currentCalYear === todayObj.getFullYear() && currentCalMonth === todayObj.getMonth() && day === todayObj.getDate());
    const checkDateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Group active logic based on itinerary location sync
    let activeMakkah = [];
    let activeMadinah = [];
    let activeJeddah = [];
    
    state.groups.forEach(g => {
      const arr = new Date(g.dateStart);
      const dep = new Date(g.dateEnd);
      const cur = new Date(checkDateStr);
      
      if (cur >= arr && cur <= dep) {
        // Find group itinerary
        const groupIti = state.itineraries.find(iti => iti.groupName === g.name);
        let city = "";
        if (groupIti && groupIti.activities) {
          const matchingAct = groupIti.activities.find(a => a.date === checkDateStr);
          if (matchingAct && matchingAct.city) {
            city = matchingAct.city;
          }
        }
        
        if (city) {
          const cLower = city.toLowerCase();
          if (cLower === "makkah") activeMakkah.push(g.name);
          else if (cLower === "madinah") activeMadinah.push(g.name);
          else if (cLower === "jeddah") activeJeddah.push(g.name);
        }
      }
    });

    const makkahCount = activeMakkah.length;
    const madinahCount = activeMadinah.length;
    const jeddahCount = activeJeddah.length;
    
    let labelsHtml = "";
    if (makkahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-makkah">🟢 Makkah (${makkahCount})</span>`;
    }
    if (madinahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-madinah">🔵 Madinah (${madinahCount})</span>`;
    }
    if (jeddahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-jeddah">🟡 Jeddah (${jeddahCount})</span>`;
    }
    
    const dayId = `cal-day-${day}`;
    grid.innerHTML += `
      <div class="calendar-day-cell ${isToday ? 'current-day' : ''} ${(makkahCount > 0 || madinahCount > 0 || jeddahCount > 0) ? 'active-day' : ''}" id="${dayId}">
        <span class="day-number">${day}</span>
        <div style="width:100%; text-align:left;">${labelsHtml}</div>
      </div>
    `;
    
    setTimeout(() => {
      const cellEl = document.getElementById(dayId);
      if (cellEl) {
        cellEl.onclick = () => {
          if (makkahCount === 0 && madinahCount === 0 && jeddahCount === 0) {
            showToast(`Tanggal ${day} ${monthNames[currentCalMonth]}: Tidak ada jadwal.`);
            return;
          }
          
          let listHtml = `<div style="font-size:0.9rem;">
            <p style="margin-bottom:12px;"><strong>Status Lokasi Rombongan Grup (${day} ${monthNames[currentCalMonth]} ${currentCalYear}):</strong></p>
          `;
          
          if (activeMakkah.length > 0) {
            listHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #f1f3f5; padding-bottom:8px;"><strong style="color:#10b981;">🟢 GRUP DI MAKKAH (${activeMakkah.length}):</strong>
              ${activeMakkah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          if (activeMadinah.length > 0) {
            listHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #f1f3f5; padding-bottom:8px;"><strong style="color:#3b82f6;">🔵 GRUP DI MADINAH (${activeMadinah.length}):</strong>
              ${activeMadinah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          if (activeJeddah.length > 0) {
            listHtml += `<div style="margin-bottom:12px;"><strong style="color:#f59e0b;">🟡 GRUP DI JEDDAH (${activeJeddah.length}):</strong>
              ${activeJeddah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          
          listHtml += `</div>`;
          openModal(`Detail Jadwal Hari (${day} ${monthNames[currentCalMonth]})`, listHtml);
        };
      }
    }, 50);
  }
}


function renderAdminItinerary() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <div class="tab-header" style="margin-bottom:20px;">
      <div class="tab-btn ${adminItiViewMode === 'grup' ? 'active' : ''}" id="iti-view-mode-grup">Itinerary per Grup</div>
      <div class="tab-btn ${adminItiViewMode === 'gabungan' ? 'active' : ''}" id="iti-view-mode-gabungan">Itinerary Keseluruhan</div>
    </div>
    <div id="itinerary-view-contents"></div>
  `;
  
  document.getElementById("iti-view-mode-grup").onclick = () => {
    adminItiViewMode = "grup";
    renderItineraryContent();
  };
  
  document.getElementById("iti-view-mode-gabungan").onclick = () => {
    adminItiViewMode = "gabungan";
    renderItineraryContent();
  };
  
  renderItineraryContent();
}

function renderItineraryContent() {
  const contents = document.getElementById("itinerary-view-contents");
  if (!contents) return;
  
  const tabBtns = document.querySelectorAll(".tab-header .tab-btn");
  tabBtns.forEach(btn => {
    btn.classList.remove("active");
  });
  
  if (adminItiViewMode === "grup") {
    document.getElementById("iti-view-mode-grup").classList.add("active");
    
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="text" id="iti-grup-search-input" class="form-input" placeholder="Cari itinerary grup..." style="max-width:240px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <div style="display:flex; gap:4px;" id="iti-status-filter-container">
            <button class="btn btn-secondary iti-filter-status-btn active" data-filter="all" title="Semua Grup" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; background:var(--primary-gold); color:#fff; border-color:var(--primary-gold);"><i data-lucide="layers" style="width:14px; height:14px;"></i></button>
            <button class="btn btn-secondary iti-filter-status-btn" data-filter="upcoming" title="Akan Datang" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; background:#fff; color:#475569; border-color:#cbd5e1;"><i data-lucide="calendar-clock" style="width:14px; height:14px;"></i></button>
            <button class="btn btn-secondary iti-filter-status-btn" data-filter="active" title="Aktif" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; background:#fff; color:#475569; border-color:#cbd5e1;"><i data-lucide="activity" style="width:14px; height:14px;"></i></button>
            <button class="btn btn-secondary iti-filter-status-btn" data-filter="completed" title="Selesai" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; background:#fff; color:#475569; border-color:#cbd5e1;"><i data-lucide="check-circle-2" style="width:14px; height:14px;"></i></button>
          </div>
        </div>
        <button id="add-iti-popup-btn" class="btn btn-gold" title="Tambah Itinerary Baru" style="width:auto; padding:8px 12px;"><i data-lucide="plus-circle" style="width:16px; height:16px;"></i></button>
      </div>
      
      <div class="table-card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Grup Keberangkatan</th>
                <th>Jumlah Kegiatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="iti-grup-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    let currentItiStatusFilter = "all";
    const renderGrupItiList = () => {
      const q = document.getElementById("iti-grup-search-input").value.toLowerCase().trim();
      const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      
      const filtered = state.itineraries.filter(iti => {
        const matchesQ = iti.groupName.toLowerCase().includes(q);
        const groupObj = state.groups.find(g => g.name === iti.groupName);
        let matchesStatus = true;
        if (groupObj) {
          if (currentItiStatusFilter === "upcoming") matchesStatus = (todayStr < groupObj.dateStart);
          else if (currentItiStatusFilter === "active") matchesStatus = (todayStr >= groupObj.dateStart && todayStr <= groupObj.dateEnd);
          else if (currentItiStatusFilter === "completed") matchesStatus = (todayStr > groupObj.dateEnd);
        }
        return matchesQ && matchesStatus;
      });
      const tbody = document.getElementById("iti-grup-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada itinerary grup ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(iti => {
        const idx = state.itineraries.indexOf(iti);
        return `
          <tr>
            <td><strong>${iti.groupName}</strong></td>
            <td><code>${iti.activities ? iti.activities.length : 0} Rencana</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary view-iti-detail-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Detail</button>
                <button class="btn btn-secondary edit-iti-popup-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Edit</button>
                <button class="btn btn-danger delete-iti-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hapus</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind actions
      tbody.querySelectorAll(".view-iti-detail-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          const iti = state.itineraries[idx];
          if (!iti) return;
          
           const groupInfo = state.groups.find(g => g.name === iti.groupName);
          const rute = groupInfo ? groupInfo.rute : "Tidak ada data rute";
          const parseDateStr = (dStr) => {
            if (!dStr) return null;
            const parts = dStr.split("-");
            return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
          };
          const startDate = groupInfo ? parseDateStr(groupInfo.dateStart) : null;
          
          const sortedActivities = [...iti.activities].sort((a, b) => {
            const cmpDate = a.date.localeCompare(b.date);
            if (cmpDate !== 0) return cmpDate;
            return a.time.localeCompare(b.time);
          });
          
          const groups = {};
          sortedActivities.forEach(a => {
            const actDate = parseDateStr(a.date);
            let dayLabel = formatDateDisplay(a.date);
            if (actDate) {
              dayLabel = actDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            }
            if (!groups[dayLabel]) {
              groups[dayLabel] = [];
            }
            groups[dayLabel].push(a);
          });
          
          const timelineHtml = `
            <div style="font-size:0.85rem; margin-bottom:6px;"><strong>Grup:</strong> ${iti.groupName}</div>
            <div style="font-size:0.85rem; margin-bottom:16px;"><strong>Rute:</strong> ${rute}</div>
            
            <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
              ${Object.keys(groups).map(dayLabel => `
                <div class="day-group" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
                  <h5 style="margin: 0 0 8px 0; font-weight: 800; font-size: 0.85rem; color: var(--primary-gold); border-bottom: 2px solid #cbd5e1; padding-bottom: 4px;">${dayLabel}</h5>
                  <table class="data-table" style="font-size: 0.8rem; margin: 0; width: 100%;">
                    <thead>
                      <tr>
                        <th style="width: 80px;">Waktu</th>
                        <th style="width: 100px;">Kota</th>
                        <th>Kegiatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${groups[dayLabel].map(act => `
                        <tr>
                          <td style="font-weight: 700;">${act.time}</td>
                          <td><span class="badge badge-info" style="font-size: 0.7rem; padding: 2px 6px;">${act.city || '-'}</span></td>
                          <td>
                            <strong>${act.agenda}</strong>
                            ${act.remarks ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${act.remarks}</div>` : ''}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `).join('')}
            </div>
          `;
          openModal("Linimasa Rencana Perjalanan", timelineHtml);
        };
      });
      document.querySelectorAll(".iti-filter-status-btn").forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll(".iti-filter-status-btn").forEach(b => {
            b.classList.remove("active");
            b.style.background = "#fff";
            b.style.color = "#475569";
            b.style.borderColor = "#cbd5e1";
          });
          btn.classList.add("active");
          btn.style.background = "var(--primary-gold)";
          btn.style.color = "#fff";
          btn.style.borderColor = "var(--primary-gold)";
          currentItiStatusFilter = btn.getAttribute("data-filter");
          renderGrupItiList();
        };
      });
      tbody.querySelectorAll(".edit-iti-popup-btn").forEach(btn => {
        btn.onclick = () => openItineraryFormPopup(parseInt(btn.getAttribute("data-idx")));
      });
      tbody.querySelectorAll(".delete-iti-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Hapus rencana perjalanan grup ini?")) {
            state.itineraries.splice(idx, 1);
            saveState();
            showToast("Itinerary dihapus.");
            renderItineraryContent();
          }
        };
      });
    };
    
    document.getElementById("iti-grup-search-input").oninput = renderGrupItiList;
    renderGrupItiList();
    document.getElementById("add-iti-popup-btn").onclick = () => openItineraryFormPopup();
    lucide.createIcons();
    
  } else {
    document.getElementById("iti-view-mode-gabungan").classList.add("active");
    
    if (!state.itiCalActiveDate) {
      state.itiCalActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    }
    
    const activeDateObj = new Date(state.itiCalActiveDate);
    const monthYearStr = activeDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    // Weekly strip around active date
    let dateCardsHtml = "";
    for (let i = -30; i <= 30; i++) {
      const tempDate = new Date(activeDateObj);
      tempDate.setDate(activeDateObj.getDate() + i);
      const tempDateStr = tempDate.toISOString().split('T')[0];
      const dayNum = tempDate.getDate();
      const dayName = tempDate.toLocaleDateString('id-ID', { weekday: 'short' });
      const isSelected = (tempDateStr === state.itiCalActiveDate);
      
      dateCardsHtml += `
        <div class="iti-cal-date-card ${isSelected ? 'active' : ''}" id="iti-date-card-${tempDateStr}" data-date="${tempDateStr}" style="flex-shrink:0; min-width:65px; text-align:center; padding:8px; border:1px solid ${isSelected ? 'var(--primary-gold)' : '#e2e8f0'}; background:${isSelected ? 'var(--primary-gold)' : '#ffffff'}; color:${isSelected ? '#ffffff' : 'var(--text-main)'}; border-radius:8px; cursor:pointer; font-size:0.8rem; transition:all 0.2s; scroll-snap-align:center;">
          <div style="font-weight:700; text-transform:uppercase; font-size:0.65rem; color:${isSelected ? '#ffffff' : '#888888'};">${dayName}</div>
          <div style="font-size:1.1rem; font-weight:800; margin-top:2px;">${dayNum}</div>
        </div>
      `;
    }
    
    contents.innerHTML = `
      <div class="admin-card" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:0.95rem; font-weight:800; margin:0;">${monthYearStr}</h4>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="iti-cal-export-pdf-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; border-color:#ef4444; color:#ef4444; display:inline-flex; align-items:center; justify-content:center; gap:4px;"><i data-lucide="file-text" style="width:12px; height:12px;"></i> Export PDF</button>
            <button id="iti-cal-prev-week-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&larr;</button>
            <button id="iti-cal-today-btn" class="btn btn-gold" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hari Ini</button>
            <button id="iti-cal-next-week-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&rarr;</button>
          </div>
        </div>
        
        <!-- Week Date Selector Strip -->
        <div id="iti-date-scroll-strip" style="display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; padding-bottom:8px; border-bottom:1px solid #e2e8f0; margin-bottom:12px;">
          ${dateCardsHtml}
        </div>
        
        <!-- City Filter -->
        <div style="display:flex; gap:8px; align-items:center; font-size:0.8rem;">
          <strong>Filter Kota:</strong>
          <select id="iti-cal-city-filter" class="form-select" style="width:auto; padding:4px 8px; font-size:0.75rem; height:auto; margin:0;">
            <option value="all">Semua Kota</option>
            <option value="Makkah">🟢 Makkah</option>
            <option value="Madinah">🔵 Madinah</option>
            <option value="Jeddah">🟡 Jeddah</option>
          </select>
        </div>
      </div>
      
      <!-- Google Calendar Style Hour Grid -->
      <div class="admin-card" style="padding:0; overflow:hidden;">
        <div style="display:flex; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:8px 12px; font-size:0.8rem; font-weight:700;">
          <div style="width:60px; color:#64748b;">Jam</div>
          <div style="flex:1; padding-left:12px; color:#64748b;">Agenda Perjalanan (${formatDateDisplay(state.itiCalActiveDate)})</div>
        </div>
        <div id="iti-cal-grid-scroll-container" style="height:400px; overflow-y:auto; position:relative;">
          <div style="position:relative; height:1440px; width:100%;">
            <!-- Hour Rows lines -->
            ${Array.from({length: 24}).map((_, h) => `
              <div style="display:flex; height:60px; border-bottom:1px dashed #e2e8f0; align-items:flex-start; padding:4px 12px; box-sizing:border-box;">
                <span style="width:60px; font-size:0.75rem; color:#94a3b8; font-weight:600;">${String(h).padStart(2, '0')}:00</span>
                <div style="flex:1; height:100%; border-left:1px solid #e2e8f0; position:relative;"></div>
              </div>
            `).join('')}
            
            <!-- Absolute Event Cards -->
            <div id="iti-cal-events-container" style="position:absolute; top:0; left:72px; right:12px; bottom:0; pointer-events:none;"></div>
          </div>
        </div>
      </div>
    `;
    

    setTimeout(() => {
      const activeCard = document.getElementById(`iti-date-card-${state.itiCalActiveDate}`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 50);

    // Bind Export PDF click
    document.getElementById("iti-cal-export-pdf-btn").onclick = () => {
      let dayActivities = [];
      state.itineraries.forEach(iti => {
        if (iti.activities) {
          iti.activities.forEach(act => {
            if (act.date === state.itiCalActiveDate) {
              dayActivities.push({
                groupName: iti.groupName,
                time: act.time,
                city: act.city || "",
                agenda: act.agenda,
                remarks: act.remarks || ""
              });
            }
          });
        }
      });
      
      dayActivities.sort((a, b) => a.time.localeCompare(b.time));
      const dateObj = new Date(state.itiCalActiveDate);
      const dayFormatted = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      const dateParts = state.itiCalActiveDate.split('-');
      const formattedTitleDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      const docTitle = `Itinerary Harian - ${formattedTitleDate}`;
      
      const printHtml = `
        <div class="watermark-bg"></div>
        
        <div style="position: absolute; top: 15mm; right: 20mm; font-size: 8pt; color: #64748b; font-weight: 700;">
          ${docTitle}
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 16pt; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: 0.05em; text-transform: uppercase;">ITINERARY HARIAN</h2>
          <div style="font-size: 9pt; color: #c5a850; font-weight: 800; margin-top: 6px;">${dayFormatted}</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 20px; border: 1px solid #cbd5e1; box-sizing: border-box;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 15%;">Waktu</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 30%;">Grup Keberangkatan</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 40%;">Agenda Kegiatan</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 15%;">Kota</th>
            </tr>
          </thead>
          <tbody>
            ${dayActivities.length === 0 ? `
              <tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada rencana kegiatan perjalanan untuk hari ini.</td></tr>
            ` : dayActivities.map(act => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${act.time}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${act.groupName}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">
                  <strong>${act.agenda}</strong>
                  ${act.remarks ? `<div style="font-size: 9.5pt; color: #64748b; margin-top: 4px;">${act.remarks}</div>` : ''}
                </td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;"><span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: 800; font-size: 9pt; background: #e0f2fe; color: #0369a1; text-transform: uppercase;">${act.city || '-'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>${docTitle}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              @page {
                size: A4;
                margin: 0;
              }
              body {
                font-family: 'Mulish', sans-serif;
                margin: 0;
                padding: 45mm 20mm 30mm 20mm;
                position: relative;
                box-sizing: border-box;
                width: 210mm;
                height: 297mm;
                background-color: #ffffff;
              }
              table {
                font-size: 9pt !important;
              }
              th, td {
                padding: 6px !important;
              }
              .watermark-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 210mm;
                height: 297mm;
                background-image: url('assets/watermark.jpg');
                background-size: cover;
                background-repeat: no-repeat;
                background-position: center;
                z-index: -1;
                pointer-events: none;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            ${printHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    // Bind Week buttons
    document.getElementById("iti-cal-prev-week-btn").onclick = () => {
      const d = new Date(state.itiCalActiveDate);
      d.setDate(d.getDate() - 7);
      state.itiCalActiveDate = d.toISOString().split('T')[0];
      renderItineraryContent();
    };
    document.getElementById("iti-cal-next-week-btn").onclick = () => {
      const d = new Date(state.itiCalActiveDate);
      d.setDate(d.getDate() + 7);
      state.itiCalActiveDate = d.toISOString().split('T')[0];
      renderItineraryContent();
    };
    document.getElementById("iti-cal-today-btn").onclick = () => {
      state.itiCalActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      renderItineraryContent();
    };
    
    // Bind Date Card clicks
    document.querySelectorAll(".iti-cal-date-card").forEach(card => {
      card.onclick = () => {
        state.itiCalActiveDate = card.getAttribute("data-date");
        renderItineraryContent();
      };
    });
    
    const cityFilter = document.getElementById("iti-cal-city-filter");
    
    const drawCalendarEvents = () => {
      const cityVal = cityFilter.value;
      const eventsContainer = document.getElementById("iti-cal-events-container");
      if (!eventsContainer) return;
      
      eventsContainer.innerHTML = "";
      
      let dayActivities = [];
      state.itineraries.forEach(iti => {
        if (iti.activities) {
          iti.activities.forEach(a => {
            if (a.date === state.itiCalActiveDate) {
              dayActivities.push({
                groupName: iti.groupName,
                time: a.time,
                city: a.city || "Jeddah",
                agenda: a.agenda,
                remarks: a.remarks
              });
            }
          });
        }
      });
      
      if (cityVal !== "all") {
        dayActivities = dayActivities.filter(a => a.city === cityVal);
      }
      
      let firstScrollTop = -1;
      
      dayActivities.forEach((act, idx) => {
        const timeParts = act.time.split(':');
        const hour = parseInt(timeParts[0]) || 0;
        const min = parseInt(timeParts[1]) || 0;
        
        const topPx = (hour * 60) + min;
        if (firstScrollTop === -1 || topPx < firstScrollTop) {
          firstScrollTop = topPx;
        }
        
        let cityColor = "#10b981";
        let cityBg = "rgba(16, 185, 129, 0.12)";
        if (act.city === "Madinah") {
          cityColor = "#3b82f6";
          cityBg = "rgba(59, 130, 246, 0.12)";
        } else if (act.city === "Jeddah") {
          cityColor = "#d97706";
          cityBg = "rgba(217, 119, 6, 0.12)";
        }
        
        const leftOffset = (idx % 2 === 0) ? 0 : 50;
        const rightOffset = (idx % 2 === 0) ? 50 : 0;
        
        eventsContainer.innerHTML += `
          <div class="iti-cal-event-card" style="position:absolute; top:${topPx}px; left:${leftOffset}%; right:${rightOffset}%; height:54px; background:${cityBg}; border-left:4px solid ${cityColor}; border-radius:4px; padding:4px 8px; font-size:0.75rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); pointer-events:auto; cursor:pointer;" title="${act.remarks || ''}">
            <div style="font-weight:800; color:${cityColor}; font-size:0.65rem;">${act.time} | ${act.city}</div>
            <div style="font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${act.agenda}</div>
            <div style="font-size:0.65rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Grup: ${act.groupName}</div>
          </div>
        `;
      });
      
      if (firstScrollTop !== -1) {
        const scrollContainer = document.getElementById("iti-cal-grid-scroll-container");
        if (scrollContainer) {
          scrollContainer.scrollTop = Math.max(0, firstScrollTop - 40);
        }
      }
    };
    
    cityFilter.onchange = drawCalendarEvents;
    drawCalendarEvents();
  }
}
function openItineraryFormPopup(editIdx = null) {
  const groupNames = state.groups.map(g => g.name);
  const isEdit = (editIdx !== null);
  const iti = isEdit ? state.itineraries[editIdx] : null;
  
  const popupHtml = `
    <form id="iti-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="iti-group-name-popup" class="form-input" value="${isEdit ? iti.groupName : ''}" placeholder="Pilih grup..." required ${isEdit ? 'readonly' : ''}>
        <div id="iti-form-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>
      
      <label class="form-label">Daftar Kegiatan Perjalanan</label>
      <div id="iti-activities-rows-popup" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"></div>
      <button type="button" id="add-iti-row-btn-popup" class="btn btn-secondary" style="margin-bottom:20px; padding:6px; font-size:0.8rem; width:auto;">+ Tambah Kegiatan</button>
      <button type="submit" class="btn btn-gold">Simpan Itinerary</button>
    </form>
    
  <datalist id="agenda-options-list">
    <option value="Kedatangan Bandara Jeddah">
    <option value="Kedatangan Bandara Madinah">
    <option value="Kepulangan Bandara Jeddah">
    <option value="Kepulangan Bandara Madinah">
    <option value="Check In Hotel Madinah">
    <option value="Check Out Hotel Madinah">
    <option value="Check In Hotel Makkah">
    <option value="Check Out Hotel Makkah">
    <option value="Check In Hotel Jeddah">
    <option value="Check Out Hotel Jeddah">
    <option value="City Tour Madinah">
    <option value="City Tour Al Ula">
    <option value="City Tour Makkah">
    <option value="City Tour Thaif">
    <option value="City Tour Khandama">
    <option value="Romansiah Jeddah">
    <option value="Romansiah Madinah">
    <option value="Romansiah Makkah">
    <option value="Penjemputan Stasiun Madinah">
    <option value="Penjemputan Stasiun Makkah">
  </datalist>

  `;
  openModal(isEdit ? "Edit Itinerary" : "Tambah Itinerary Baru", popupHtml);
  
  if (!isEdit) {
    initSuggestionInput("iti-group-name-popup", "iti-form-group-suggestions-popup", groupNames);
  }
  
  const rowsContainer = document.getElementById("iti-activities-rows-popup");
  const sortItineraryRows = () => {
    const rows = Array.from(rowsContainer.querySelectorAll(".iti-activity-item-row-popup"));
    rows.sort((a, b) => {
      const dA = a.querySelector(".row-date").value || "9999-99-99";
      const dB = b.querySelector(".row-date").value || "9999-99-99";
      if (dA !== dB) return dA.localeCompare(dB);
      const tA = a.querySelector(".row-time").value || "99:99";
      const tB = b.querySelector(".row-time").value || "99:99";
      return tA.localeCompare(tB);
    });
    rows.forEach(row => rowsContainer.appendChild(row));
  };

  const addRow = (date = "", time = "", city = "Jeddah", agenda = "", remarks = "") => {
    const rowId = `iti-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card iti-activity-item-row-popup";
    div.id = rowId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Item Kegiatan</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <input type="date" class="form-input row-date" value="${date}" required>
        <input type="time" class="form-input row-time" value="${time}" required>
      </div>
      <div class="grid-3col" style="gap:8px; margin-top:8px;">
        <select class="form-select row-city" required>
          <option value="Jeddah" ${city === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
          <option value="Madinah" ${city === 'Madinah' ? 'selected' : ''}>Madinah</option>
          <option value="Makkah" ${city === 'Makkah' ? 'selected' : ''}>Makkah</option>
        </select>
        <input type="text" class="form-input row-agenda" list="agenda-options-list" placeholder="Agenda Kegiatan (pilih / ketik)..." value="${agenda}" required style="grid-column: span 2;">
      </div>
      <input type="text" class="form-input row-remarks" placeholder="Keterangan tambahan" value="${remarks}" style="margin-top:8px;">
    `;
    rowsContainer.appendChild(div);
    
    // Auto-sort on date or time change/blur
    const dInp = div.querySelector(".row-date");
    const tInp = div.querySelector(".row-time");
    if (dInp) {
      dInp.onchange = sortItineraryRows;
      dInp.onblur = sortItineraryRows;
    }
    if (tInp) {
      tInp.onchange = sortItineraryRows;
      tInp.onblur = sortItineraryRows;
    }
  };
  
  document.getElementById("add-iti-row-btn-popup").onclick = () => addRow();
  
  if (isEdit) {
    iti.activities.forEach(a => addRow(a.date, a.time, a.city || "Jeddah", a.agenda, a.remarks));
  } else {
    addRow();
  }
  
  document.getElementById("iti-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = document.getElementById("iti-group-name-popup").value.trim();
    if (!groupName) {
      showToast("Grup keberangkatan wajib diisi!", "error");
      return;
    }
    
    const rows = rowsContainer.querySelectorAll(".iti-activity-item-row-popup");
    const activities = Array.from(rows).map(row => ({
      date: row.querySelector(".row-date").value,
      time: row.querySelector(".row-time").value,
      city: row.querySelector(".row-city").value,
      agenda: row.querySelector(".row-agenda").value,
      remarks: row.querySelector(".row-remarks").value
    })).filter(a => a.date && a.agenda)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });

    if (activities.length === 0) {
      showToast("Minimal isi 1 kegiatan itinerary yang lengkap!", "error");
      return;
    }
    
    if (isEdit) {
      state.itineraries[editIdx] = { groupName, activities };
    } else {
      const existingIdx = state.itineraries.findIndex(i => i && i.groupName && i.groupName.toLowerCase() === groupName.toLowerCase());
      if (existingIdx !== -1) {
        state.itineraries[existingIdx].activities = activities;
      } else {
        state.itineraries.push({ groupName, activities });
      }
    }

    // Auto-register group in state.groups if not present
    const existingGroup = state.groups.find(g => g.name && g.name.toLowerCase() === groupName.toLowerCase());
    if (!existingGroup) {
      const dateStart = activities[0] ? activities[0].date : getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      const dateEnd = activities[activities.length - 1] ? activities[activities.length - 1].date : dateStart;
      state.groups.push({
        name: groupName,
        dateStart,
        dateEnd,
        pax: "30 Pax",
        bus: "1 Bus",
        hotelMadinah: "Nozol Royal Inn",
        hotelMakkah: "Anjum Hotel",
        rute: "Jeddah - Madinah - Makkah",
        leaders: ["Ustadz H. Haris"]
      });
    }
    
    if (activities.length > 0 && activities[0].date) {
      state.itiCalActiveDate = activities[0].date;
    }
    
    adminItiViewMode = "grup";
    saveState();
    closeModal();
    showToast(`Itinerary grup "${groupName}" berhasil disimpan!`);
    renderAdminItinerary();
  };
}

function openTaskAdminDetailPopup(taskId) {
  const t = state.assignments.find(x => x.id === taskId);
  if (!t) return;

  const staffList = Array.isArray(t.staff) ? t.staff : [];
  const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
  const isPub = (t.published !== false);
  const reqStaff = t.requiredStaff || 1;
  const currentStaffCount = staffList.length;
  const isFulfilled = (currentStaffCount >= reqStaff);
  const staffingStatusHtml = isFulfilled ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;

  const details = t.details || {};

  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span class="badge badge-gold" style="font-size:0.85rem; margin-right:8px;">${t.type || 'Penjadwalan'}</span>
          <span class="badge badge-success">${t.status || 'Aktif'}</span>
        </div>
        ${staffingStatusHtml}
        <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:20px;">
        <tr><td style="padding:6px 0; font-weight:700; width:140px; color:var(--text-muted);">Jenis Kegiatan:</td><td style="font-weight:800; color:#0f172a;">${t.type || 'Penjadwalan Operasional'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Grup Rombongan:</td><td style="font-weight:800; color:#b89230;">${t.groupName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Waktu & Tanggal:</td><td style="font-weight:700;">${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah Operasional:</td><td>${t.region || '-'}</td></tr>
        ${(() => {
          const typeStr = (t.type || '').toLowerCase();
          let extraRows = [];
          if (typeStr.includes('hotel') || typeStr.includes('check in') || typeStr.includes('check out')) {
            if (details.hotelName || details.hotel) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td style="font-weight:800;">${details.hotelName || details.hotel}</td></tr>`);
            if (details.origin || details.asal || details.busOrigin) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Asal / Dari:</td><td>${details.origin || details.asal || details.busOrigin}</td></tr>`);
            if (details.package || details.paket) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Paket Layanan:</td><td>${details.package || details.paket}</td></tr>`);
            if (details.roomComposition || details.komposisiKamar || details.roomList) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Komposisi Kamar:</td><td>${details.roomComposition || details.komposisiKamar || details.roomList}</td></tr>`);
            if (details.complimentary || details.comp) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Complimentary:</td><td>${details.complimentary || details.comp}</td></tr>`);
          } else if (typeStr.includes('bandara') || typeStr.includes('kedatangan') || typeStr.includes('kepulangan')) {
            if (details.terminal || details.airport) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Terminal / Bandara:</td><td style="font-weight:800;">${details.terminal || details.airport}</td></tr>`);
            if (details.flight || details.eta) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / Penerbangan:</td><td>${details.flight || details.eta}</td></tr>`);
            if (details.origin || details.destination) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Asal / Tujuan:</td><td>${details.origin || details.destination}</td></tr>`);
            if (details.totalPax || t.pax) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax || t.pax} Pax</td></tr>`);
          } else if (typeStr.includes('city tour') || typeStr.includes('tour')) {
            if (details.destination || details.route) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Destinasi / Rute:</td><td style="font-weight:800;">${details.destination || details.route}</td></tr>`);
            if (details.bus || details.vehicle) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Bus / Armada:</td><td>${details.bus || details.vehicle}</td></tr>`);
            if (details.leader || details.muthawwif) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Muthowwif / TL:</td><td>${details.leader || details.muthawwif}</td></tr>`);
          } else if (typeStr.includes('stasiun') || typeStr.includes('kereta')) {
            if (details.station) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Stasiun Kereta:</td><td style="font-weight:800;">${details.station}</td></tr>`);
            if (details.trainNo) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">No. Kereta:</td><td>${details.trainNo}</td></tr>`);
            if (details.totalPax) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax} Pax</td></tr>`);
          } else {
            if (details.hotelName) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel / Lokasi:</td><td>${details.hotelName}</td></tr>`);
            if (details.eta) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${details.eta}</td></tr>`);
            if (details.totalPax) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax} Pax</td></tr>`);
            if (details.service) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Layanan:</td><td>${details.service}</td></tr>`);
          }
          if (details.remarks) extraRows.push(`<tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan / Rincian:</td><td>${details.remarks}</td></tr>`);
          return extraRows.join('');
        })()}
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Petugas di-Plot:</td><td><strong style="color:#047857;">${staffNames || 'Belum diplot'}</strong></td></tr>
      </table>
      
      ` + (() => {
        let applicantsHtml = '';
        t.applicants = t.applicants || [];
        if (t.applicants.length > 0) {
          applicantsHtml = `
            <div style="margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px; margin-bottom:14px;">
              <strong style="font-size:0.8rem; color:var(--text-muted);">Pengaju Apply Tugas:</strong>
              <div style="margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                ${t.applicants.map(usr => {
                  const name = state.users.find(u => u.username === usr)?.name || usr;
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0;">
                      <span style="font-size:0.8rem; font-weight:700;">${name}</span>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-gold approve-applicant-btn" data-username="${usr}" style="padding:2px 6px; font-size:0.75rem; width:auto; background:#10b981; border:none; display:inline-flex; align-items:center; justify-content:center; height:24px; width:24px; border-radius:4px;" title="Setujui"><i data-lucide="check" style="width:12px; height:12px; color:#fff;"></i></button>
                        <button class="btn btn-danger reject-applicant-btn" data-username="${usr}" style="padding:2px 6px; font-size:0.75rem; width:auto; background:#ef4444; border:none; display:inline-flex; align-items:center; justify-content:center; height:24px; width:24px; border-radius:4px;" title="Tolak"><i data-lucide="x" style="width:12px; height:12px; color:#fff;"></i></button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }
        return applicantsHtml;
      })() + `
      
      <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f3f5; padding-top:14px;">
        <div>
          <button class="btn btn-gold toggle-publish-btn" style="width:auto; padding:6px 12px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
            <i data-lucide="${isPub ? 'eye-off' : 'eye'}" style="width:14px; height:14px;"></i> ${isPub ? 'Unpublish' : 'Publish'}
          </button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary edit-task-popup-btn" style="width:auto; padding:6px 10px;" title="Edit Penugasan"><i data-lucide="edit-3" style="width:16px; height:16px;"></i></button>
          <button class="btn btn-danger delete-task-popup-btn" style="width:auto; padding:6px 10px;" title="Hapus Penugasan"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
          <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 12px; font-size:0.75rem;">Tutup</button>
        </div>
      </div>
    </div>
  `;
  openModal("Rincian Penugasan Operasional", detailHtml);
  lucide.createIcons();

  const popupEl = document.getElementById("modal-container");
  
  // Bind applicant approvals
  popupEl.querySelectorAll(".approve-applicant-btn").forEach(btn => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-username");
      t.staff = t.staff || [];
      if (!t.staff.includes(username)) {
        t.staff.push(username);
      }
      t.applicants = t.applicants.filter(u => u !== username);
      saveState();
      showToast("Petugas berhasil disetujui!");
      closeModal();
      renderTaskCardsAdmin();
    };
  });
  
  popupEl.querySelectorAll(".reject-applicant-btn").forEach(btn => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-username");
      t.applicants = t.applicants.filter(u => u !== username);
      saveState();
      showToast("Lamaran petugas ditolak.");
      closeModal();
      renderTaskCardsAdmin();
    };
  });

  popupEl.querySelector(".toggle-publish-btn").onclick = () => {
    t.published = !isPub;
    saveState();
    showToast(`Status penugasan diubah ke ${!isPub ? 'Publish' : 'Unpublish'}.`);
    closeModal();
    renderTaskCardsAdmin();
  };

  popupEl.querySelector(".edit-task-popup-btn").onclick = () => {
    closeModal();
    openPenjadwalanFormPopup(t.id);
  };

  popupEl.querySelector(".delete-task-popup-btn").onclick = () => {
    if (confirm("Hapus plotting penugasan ini?")) {
      const idx = state.assignments.findIndex(x => x.id === t.id);
      if (idx !== -1) {
        state.assignments.splice(idx, 1);
        saveState();
        showToast("Penugasan dihapus.");
        closeModal();
        renderTaskCardsAdmin();
      }
    }
  };
}




function openTaskSummaryPopup() {
  const types = [
    "Kedatangan Bandara Jeddah",
    "Kepulangan Bandara Jeddah",
    "Kedatangan Bandara Madinah",
    "Kepulangan Bandara Madinah",
    "Check In Hotel Madinah",
    "Check In Hotel Makkah",
    "Check In Hotel Jeddah",
    "Check Out Hotel Madinah",
    "Check Out Hotel Makkah",
    "Check Out Hotel Jeddah",
    "City Tour Madinah",
    "City Tour Makkah",
    "City Tour Thaif",
    "City Tour Al Ula",
    "Penjemputan Stasiun Madinah",
    "Penjemputan Stasiun Makkah"
  ];
  
  const defaultDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  
  const formHtml = `
    <div class="admin-card" style="border:none; padding:0;">
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:14px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">1. Filter Kota</label>
          <select id="sum-filter-city" class="form-select" style="padding:6px 10px; font-size:0.8rem; height:auto;">
            <option value="all">Semua Kota</option>
            <option value="Jeddah">Jeddah</option>
            <option value="Madinah">Madinah</option>
            <option value="Makkah">Makkah</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">2. Filter Kegiatan</label>
          <select id="sum-filter-type" class="form-select" style="padding:6px 10px; font-size:0.8rem; height:auto;">
            <option value="all">Semua Kegiatan</option>
            ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">3. Filter Rombongan / Grup</label>
          <select id="sum-filter-group" class="form-select" style="padding:6px 10px; font-size:0.8rem; height:auto;">
            <option value="all">Semua Grup</option>
            ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">4. Filter Tanggal</label>
          <input type="date" id="sum-filter-date" class="form-input" value="${defaultDate}" style="padding:6px 10px; font-size:0.8rem;">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Format Teks WhatsApp Rangkuman Penugasan</label>
        <textarea id="sum-whatsapp-text" class="form-textarea" rows="15" readonly style="font-family:monospace; font-size:0.8rem; background:#f8fafc; color:#0f172a; padding:10px; border:1px solid #cbd5e1; white-space:pre-wrap;"></textarea>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
        <button id="sum-copy-btn" class="btn btn-gold" style="width:auto; padding:6px 16px;"><i data-lucide="copy" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Salin Teks WA</button>
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
      </div>
    </div>
  `;
  
  openModal("Rangkuman Penugasan Tim", formHtml);
  lucide.createIcons();
  
  const cityEl = document.getElementById("sum-filter-city");
  const typeEl = document.getElementById("sum-filter-type");
  const groupEl = document.getElementById("sum-filter-group");
  const dateEl = document.getElementById("sum-filter-date");
  const textEl = document.getElementById("sum-whatsapp-text");
  
  const updateSummaryText = () => {
    const cVal = cityEl.value;
    const tVal = typeEl.value;
    const gVal = groupEl.value;
    const dVal = dateEl.value;
    
    let filtered = state.assignments || [];
    if (dVal) {
      filtered = filtered.filter(t => t.date === dVal);
    }
    if (cVal && cVal !== "all") {
      filtered = filtered.filter(t => (t.region || '').toLowerCase().includes(cVal.toLowerCase()) || (t.type || '').toLowerCase().includes(cVal.toLowerCase()));
    }
    if (tVal && tVal !== "all") {
      filtered = filtered.filter(t => t.type === tVal);
    }
    if (gVal && gVal !== "all") {
      filtered = filtered.filter(t => t.groupName === gVal);
    }
    
    filtered.sort((a, b) => a.time.localeCompare(b.time));
    
    let dateStr = dVal;
    if (dVal) {
      const parts = dVal.split('-');
      if (parts.length === 3) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        dateStr = dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    
    const kotaLabel = (cVal && cVal !== "all") ? cVal : "Semua Kota";
    
    let wText = `*PETUGAS TIM KHIDMAT*\n`;
    wText += `🗓️ Tanggal: ${dateStr}\n`;
    wText += `📍 Kota ${kotaLabel}\n\n`;
    
    if (filtered.length === 0) {
      wText += `(Tidak ada jadwal penugasan untuk filter terpilih)\n\n`;
    } else {
      // Group tasks by Task Type
      const groupedByType = {};
      filtered.forEach(t => {
        const typeName = t.type || 'Penugasan Lapangan';
        if (!groupedByType[typeName]) groupedByType[typeName] = [];
        groupedByType[typeName].push(t);
      });

      let overallGroupCount = 1;

      Object.keys(groupedByType).forEach(typeKey => {
        const tasksInType = groupedByType[typeKey];
        wText += `🔻 *${typeKey}*\n`;

        // Deduplicate group names inside this activity type
        const groupedByGroupName = {};
        tasksInType.forEach(t => {
          const gName = t.groupName || 'Grup Khidmat';
          if (!groupedByGroupName[gName]) groupedByGroupName[gName] = [];
          groupedByGroupName[gName].push(t);
        });

        Object.keys(groupedByGroupName).forEach(gName => {
          const tasksForThisGroup = groupedByGroupName[gName];
          const grpObj = (state.groups || []).find(g => g && g.name === gName);
          const firstTaskDetails = tasksForThisGroup[0]?.details || {};

          // Robust Tour Leader resolution
          let tourLeaderName = "";
          if (grpObj) {
            if (Array.isArray(grpObj.leaders) && grpObj.leaders.length > 0) {
              tourLeaderName = grpObj.leaders.filter(x => x).join(', ');
            } else if (grpObj.tourLeader) {
              tourLeaderName = grpObj.tourLeader;
            } else if (grpObj.leader) {
              tourLeaderName = grpObj.leader;
            } else if (grpObj.mutawwif) {
              tourLeaderName = grpObj.mutawwif;
            }
          }
          if (!tourLeaderName && firstTaskDetails) {
            tourLeaderName = firstTaskDetails.tourLeader || firstTaskDetails.leader || firstTaskDetails.muthawwif || firstTaskDetails.tl || "";
          }

          wText += `${overallGroupCount}. *${gName}*\n`;
          if (tourLeaderName) {
            wText += `   ${tourLeaderName}\n`;
          }

          if (firstTaskDetails.origin) {
            wText += `   Asal : ${firstTaskDetails.origin}\n`;
          }
          if (firstTaskDetails.destination && !typeKey.toLowerCase().includes('city tour') && !typeKey.toLowerCase().includes('kedatangan')) {
            wText += `   Tujuan : ${firstTaskDetails.destination}\n`;
          }

          wText += `\n`;

          const typeLower = typeKey.toLowerCase();

          // Process all entries/hotels for this group without repeating the group name
          tasksForThisGroup.forEach(t => {
            const details = t.details || {};

            if (typeLower.includes('kedatangan')) {
              const staffList = (t.staff || []).map(s => {
                const u = (state.users || []).find(x => x && x.username === s);
                return `@${(u ? u.name : s).replace(/\s+/g, '')}`;
              }).join(' ');

              wText += `   • Tujuan : ${details.destination || details.target || ''}\n`;
              wText += `   • Total Pax : ${details.totalPax || ''}\n`;
              wText += `   • Flight & ETA : ${details.eta || details.flight || ''}\n`;
              wText += `   • Mealplan Kedatangan : ${details.mealplan || details.meal || ''}\n`;
              wText += `   • Petugas: *${staffList ? staffList : '@Belumdiplot'}*\n\n`;
            } 
            else if (typeLower.includes('check in') || typeLower.includes('check out')) {
              if (Array.isArray(details.hotels) && details.hotels.length > 0) {
                details.hotels.forEach(h => {
                  const staffList = (h.staff && h.staff.length > 0 ? h.staff : t.staff || []).map(s => {
                    const u = (state.users || []).find(x => x && x.username === s);
                    return `@${(u ? u.name : s).replace(/\s+/g, '')}`;
                  }).join(' ');

                  wText += `   • Hotel : ${h.name}${h.pax ? ` (${h.pax} Pax)` : ''}\n`;
                  wText += `   • Komposisi Kamar : ${h.rooms || h.roomComposition || ''}\n`;
                  if (typeLower.includes('check in')) {
                    wText += `   • Complimentary : ${h.complimentary || h.service || details.complimentary || ''}\n`;
                  }
                  wText += `   • Petugas: *${staffList ? staffList : '@Belumdiplot'}*\n\n`;
                });
              } else {
                const staffList = (t.staff || []).map(s => {
                  const u = (state.users || []).find(x => x && x.username === s);
                  return `@${(u ? u.name : s).replace(/\s+/g, '')}`;
                }).join(' ');

                const hotelName = details.hotelName || 'Hotel Main';
                const paxVal = details.totalPax ? ` (${details.totalPax} Pax)` : '';
                wText += `   • Hotel : ${hotelName}${paxVal}\n`;
                wText += `   • Komposisi Kamar : ${details.roomComposition || details.komposisiKamar || ''}\n`;
                if (typeLower.includes('check in')) {
                  wText += `   • Complimentary : ${details.complimentary || ''}\n`;
                }
                wText += `   • Petugas: *${staffList ? staffList : '@Belumdiplot'}*\n\n`;
              }
            }
            else if (typeLower.includes('city tour')) {
              const staffList = (t.staff || []).map(s => {
                const u = (state.users || []).find(x => x && x.username === s);
                return `@${(u ? u.name : s).replace(/\s+/g, '')}`;
              }).join(' ');

              wText += `   • Rute Penjemputan : ${details.pickupRoute || details.origin || ''}\n`;
              wText += `   • Tujuan : ${details.destination || typeKey}\n`;
              wText += `   • Petugas: *${staffList ? staffList : '@Belumdiplot'}*\n\n`;
            }
            else {
              const staffList = (t.staff || []).map(s => {
                const u = (state.users || []).find(x => x && x.username === s);
                return `@${(u ? u.name : s).replace(/\s+/g, '')}`;
              }).join(' ');

              wText += `   • Rute / Keterangan : ${details.pickupRoute || details.remarks || ''}\n`;
              wText += `   • Petugas: *${staffList ? staffList : '@Belumdiplot'}*\n\n`;
            }
          });

          overallGroupCount++;
        });

        wText += `\n`;
      });
    }

    wText += `Barakallahu fiikum\n`;
    wText += `_*Pesan dikirim melalui sistem jejak imani*_`;
    
    textEl.value = wText;
  };
  
  cityEl.onchange = updateSummaryText;
  typeEl.onchange = updateSummaryText;
  groupEl.onchange = updateSummaryText;
  dateEl.onchange = updateSummaryText;
  
  updateSummaryText();
  
  document.getElementById("sum-copy-btn").onclick = () => {
    textEl.select();
    navigator.clipboard.writeText(textEl.value)
      .then(() => {
        showToast("Teks rangkuman WhatsApp berhasil disalin!");
      })
      .catch(() => {
        showToast("Gagal menyalin teks", "error");
      });
  };
}

function renderAdminPenjadwalan() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <!-- Tab Penjadwalan Paling Atas -->
    <div class="tab-header" style="margin-bottom:16px;">
      <div class="tab-btn ${adminTaskViewMode === 'grup' ? 'active' : ''}" id="task-view-mode-grup">Penugasan Per Grup</div>
      <div class="tab-btn ${adminTaskViewMode === 'semua' ? 'active' : ''}" id="task-view-mode-semua">Semua Penugasan</div>
    </div>
    

    
    <!-- Baris Pencarian & Tombol Aksi -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div id="task-search-bar-container" style="flex-grow:1; max-width:300px;"></div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div id="task-additional-actions-container"></div>
        <button id="add-task-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Penugasan Baru</button>
      </div>
    </div>
    
    <div id="task-list-tab-contents"></div>
  `;
  
  document.getElementById("task-view-mode-grup").onclick = () => {
    adminTaskViewMode = "grup";
    renderAdminPenjadwalan();
  };
  document.getElementById("task-view-mode-semua").onclick = () => {
    adminTaskViewMode = "semua";
    renderAdminPenjadwalan();
  };

  document.getElementById("add-task-popup-btn").onclick = () => openPenjadwalanFormPopup();

  lucide.createIcons();

  renderTaskCardsAdmin();
}

function renderTaskCardsAdmin() {
  const container = document.getElementById("task-list-tab-contents");
  const searchContainer = document.getElementById("task-search-bar-container");
  const actionsContainer = document.getElementById("task-additional-actions-container");
  
  if (!container || !searchContainer || !actionsContainer) return;
  
  if (state.assignments.length === 0) {
    searchContainer.innerHTML = "";
    actionsContainer.innerHTML = "";
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;background:#fff;border-radius:8px;border:var(--border-light); margin-top:16px;">Belum ada penugasan aktif.</p>`;
    return;
  }
  
  // Render Unified Filter inputs at the top
  searchContainer.style.maxWidth = "none";
  searchContainer.style.width = "100%";
  searchContainer.innerHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; width:100%;">
      <input type="text" id="admin-task-search-input" class="form-input" placeholder="Cari penugasan, petugas, atau grup..." style="flex:grow-1; flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
      <select id="admin-task-pub-filter" class="form-select" style="width:150px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <option value="all">Semua Status</option>
        <option value="published">Published</option>
        <option value="unpublished">Unpublished</option>
      </select>
      <select id="admin-task-quota-filter" class="form-select" style="width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <option value="all">Semua Keterpenuhan</option>
        <option value="fulfilled">Terpenuhi</option>
        <option value="unfulfilled">Belum Terpenuhi</option>
        <option value="pending_approval">Menunggu Approval</option>
      </select>
    </div>
  `;

  const getFilteredAssignments = () => {
    const qInp = document.getElementById("admin-task-search-input");
    const q = qInp ? qInp.value.toLowerCase().trim() : "";
    const pubVal = document.getElementById("admin-task-pub-filter") ? document.getElementById("admin-task-pub-filter").value : "all";
    const quotaVal = document.getElementById("admin-task-quota-filter") ? document.getElementById("admin-task-quota-filter").value : "all";
    
    const todayMs = new Date().setHours(0, 0, 0, 0);
    
    // Sort all assignments by date & time closest to today
    let filtered = [...state.assignments].sort((a, b) => {
      const parseTaskTime = (t) => {
        if (!t.date) return 0;
        const timeStr = t.time || (t.details && t.details.time) || "00:00";
        return new Date(`${t.date}T${timeStr}:00`).getTime() || 0;
      };

      const timeA = parseTaskTime(a);
      const timeB = parseTaskTime(b);

      const isPastA = timeA < todayMs;
      const isPastB = timeB < todayMs;

      // Upcoming and today tasks come first, sorted chronologically ascending (closest date first!)
      if (!isPastA && !isPastB) return timeA - timeB;
      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;

      // Past tasks sorted descending (most recent past task first)
      return timeB - timeA;
    });
    if (q) {
      filtered = filtered.filter(t => {
        const typeStr = (t.type || t.title || '').toLowerCase();
        const groupStr = (t.groupName || '').toLowerCase();
        const customNameStr = (t.details && t.details.customTaskName ? t.details.customTaskName : '').toLowerCase();
        const staffList = (t.staff || []).map(s => String(s).toLowerCase());
        const staffNamesStr = (t.staff || []).map(s => (state.users.find(u => u.username === s)?.name || '').toLowerCase()).join(' ');
        
        return typeStr.includes(q) || groupStr.includes(q) || customNameStr.includes(q) || staffList.some(s => s.includes(q)) || staffNamesStr.includes(q);
      });
    }
    if (pubVal === "published") {
      filtered = filtered.filter(t => t.published !== false);
    } else if (pubVal === "unpublished") {
      filtered = filtered.filter(t => t.published === false);
    }
    if (quotaVal === "fulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) >= (t.requiredStaff || 1));
    } else if (quotaVal === "unfulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) < (t.requiredStaff || 1));
    } else if (quotaVal === "pending_approval") {
      filtered = filtered.filter(t => t.applicants && t.applicants.length > 0);
    }
    return filtered;
  };
  
  if (adminTaskViewMode === "grup") {
    actionsContainer.innerHTML = "";
    container.innerHTML = `<div id="admin-task-grup-accordion-list" style="display:flex; flex-direction:column; gap:10px; width:100%;"></div>`;
    
    const drawGroupAccordion = () => {
      const accordionList = document.getElementById("admin-task-grup-accordion-list");
      if (!accordionList) return;
      
      const filteredTasks = getFilteredAssignments();
      accordionList.innerHTML = "";
      
      // Group the filtered assignments by groupName
      const grouped = {};
      filteredTasks.forEach(t => {
        const gN = t.groupName || 'Umum';
        if (!grouped[gN]) grouped[gN] = [];
        grouped[gN].push(t);
      });
      
      const filteredGroups = Object.keys(grouped);
      if (filteredGroups.length === 0) {
        accordionList.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;background:#fff;border-radius:8px; width:100%;">Tidak ada grup penugasan ditemukan.</p>`;
        return;
      }
      
      filteredGroups.forEach((gName, idx) => {
        const groupTasks = grouped[gName];
        const group = state.groups.find(g => g.name === gName);
        const tlName = group && group.leaders ? group.leaders.join(', ') : "Belum Ditentukan";
        
        const headerId = `acc-header-${idx}`;
        const bodyId = `acc-body-${idx}`;
        const iconId = `acc-icon-${idx}`;
        
        const accordionRow = document.createElement("div");
        accordionRow.style.display = "flex";
        accordionRow.style.flexDirection = "column";
        accordionRow.style.width = "100%";
        
        accordionRow.innerHTML = `
          <div class="group-accordion-header" id="${headerId}" style="padding:14px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.2s; user-select:none; margin-bottom:4px;">
            <span style="font-weight:800; color:var(--text-main); font-size:0.9rem;">${gName} <span style="font-weight:500; color:var(--text-muted); font-size:0.8rem; margin-left:8px;">(TL: ${tlName})</span></span>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="badge badge-info" style="font-size:0.7rem; padding:3px 8px;">${groupTasks.length} Tugas</span>
              <i data-lucide="chevron-down" id="${iconId}" style="width:16px; height:16px; transition:transform 0.2s; color:#64748b;"></i>
            </div>
          </div>
          <div class="group-accordion-body hidden" id="${bodyId}" style="padding:16px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 8px 8px; background:#fff; margin-bottom:12px; width:100%;">
            <div class="grid-2col" style="gap:16px;"></div>
          </div>
        `;
        
        accordionList.appendChild(accordionRow);
        
        const bodyEl = accordionRow.querySelector(".grid-2col");
        bodyEl.innerHTML = groupTasks.map(t => {
          const staffList = t.staff || [];
          const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
          const isPub = (t.published !== false);
          const reqStaff = t.requiredStaff || 1;
          const currentStaffCount = staffList.length;
          const isFulfilled = (currentStaffCount >= reqStaff);
          const staffingStatusHtml = isFulfilled 
            ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
            : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;
          
          const taskHeading = (t.type || t.title || 'Penugasan Lapangan') + (t.details && t.details.customTaskName ? ` (${t.details.customTaskName})` : '');
          const regionStr = t.region ? ` (Wilayah: ${t.region})` : '';

          return `
            <div class="assignment-card" style="border-left-color: ${isPub ? 'var(--primary-gold)' : '#94a3b8'}; background:#fff; padding:16px; margin-bottom:0;">
              <div class="assignment-header" style="border-bottom: 1px solid #f1f3f5; padding-bottom: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <strong>${taskHeading}</strong>
                <div style="display:flex; gap:6px; align-items:center;">
                  ${staffingStatusHtml}
                  <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
                </div>
              </div>
              <div class="structured-card-grid">
                <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value"><strong>${t.groupName || '-'}</strong></span></div>
                <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi${regionStr}</span></div>
                <div class="structured-card-row"><span class="structured-card-label">Petugas:</span><span class="structured-card-value"><em>${staffNames || 'Belum diplot'}</em></span></div>
                <div class="structured-card-row"><span class="structured-card-label">Status:</span><span class="structured-card-value"><span class="badge badge-gold">${t.status || 'Aktif'}</span></span></div>
              </div>
              <div style="display:flex; justify-flex:flex-end; margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px;">
                <button class="btn btn-secondary view-task-admin-detail-btn" data-id="${t.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;"><i data-lucide="eye" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat Rincian</button>
              </div>
            </div>
          `;
        }).join('');
        
        const headerEl = document.getElementById(headerId);
        const bodyContainer = document.getElementById(bodyId);
        const iconEl = document.getElementById(iconId);
        
        headerEl.onclick = () => {
          bodyContainer.classList.toggle("hidden");
          const isHidden = bodyContainer.classList.contains("hidden");
          iconEl.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
        };
      });
      
      accordionList.querySelectorAll(".view-task-admin-detail-btn").forEach(btn => {
        btn.onclick = () => openTaskAdminDetailPopup(btn.getAttribute("data-id"));
      });
      
      lucide.createIcons();
    };
    
    document.getElementById("admin-task-search-input").oninput = drawGroupAccordion;
    document.getElementById("admin-task-pub-filter").onchange = drawGroupAccordion;
    document.getElementById("admin-task-quota-filter").onchange = drawGroupAccordion;
    drawGroupAccordion();
    
  } else {
    actionsContainer.innerHTML = `<button id="task-summary-btn" class="btn btn-secondary" style="width:auto; padding:8px 16px; border-color:var(--primary-gold); color:var(--primary-gold); display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;"><i data-lucide="file-text" style="width:14px; height:14px;"></i> Rangkuman</button>`;
    document.getElementById("task-summary-btn").onclick = () => openTaskSummaryPopup();
    
    container.innerHTML = `<div class="grid-2col" id="admin-task-semua-list" style="gap:16px;"></div>`;
    
    const drawSemuaList = () => {
      const listEl = document.getElementById("admin-task-semua-list");
      if (!listEl) return;
      
      const filtered = getFilteredAssignments();
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;grid-column:span 2;">Tidak ada penugasan ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(t => {
        const staffList = t.staff || [];
        const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
        const isPub = (t.published !== false);
        const reqStaff = t.requiredStaff || 1;
        const currentStaffCount = staffList.length;
        const isFulfilled = (currentStaffCount >= reqStaff);
        const staffingStatusHtml = isFulfilled 
          ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
          : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;
        
        const taskHeading = (t.type || t.title || 'Penugasan Lapangan') + (t.details && t.details.customTaskName ? ` (${t.details.customTaskName})` : '');
        const regionStr = t.region ? ` (Wilayah: ${t.region})` : '';

        return `
          <div class="assignment-card" style="border-left-color: ${isPub ? 'var(--primary-gold)' : '#94a3b8'}; background:#fff; padding:16px; margin-bottom:0;">
            <div class="assignment-header" style="border-bottom: 1px solid #f1f3f5; padding-bottom: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <strong>${taskHeading}</strong>
              <div style="display:flex; gap:6px; align-items:center;">
                ${staffingStatusHtml}
                <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
              </div>
            </div>
            <div class="structured-card-grid">
              <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value"><strong>${t.groupName || '-'}</strong></span></div>
              <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi${regionStr}</span></div>
              <div class="structured-card-row"><span class="structured-card-label">Petugas:</span><span class="structured-card-value"><em>${staffNames || 'Belum diplot'}</em></span></div>
              <div class="structured-card-row"><span class="structured-card-label">Status:</span><span class="structured-card-value"><span class="badge badge-gold">${t.status || 'Aktif'}</span></span></div>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px;">
              <button class="btn btn-secondary view-task-admin-detail-btn" data-id="${t.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;"><i data-lucide="eye" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat Rincian</button>
            </div>
          </div>
        `;
      }).join('');
      
      listEl.querySelectorAll(".view-task-admin-detail-btn").forEach(btn => {
        btn.onclick = () => openTaskAdminDetailPopup(btn.getAttribute("data-id"));
      });
      lucide.createIcons();
    };
    
    document.getElementById("admin-task-search-input").oninput = drawSemuaList;
    document.getElementById("admin-task-pub-filter").onchange = drawSemuaList;
    document.getElementById("admin-task-quota-filter").onchange = drawSemuaList;
    drawSemuaList();
  }
}

function openPenjadwalanFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const task = isEdit ? state.assignments.find(t => t.id === editId) : null;
  const groupNames = state.groups.map(g => g.name);
  const fieldStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  let plottedStaffs = isEdit ? [...task.staff] : [];

  const popupHtml = `
    <form id="task-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="task-group-input-popup" class="form-input" value="${isEdit ? task.groupName : ''}" placeholder="Ketik nama grup..." required>
        <div id="task-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Kegiatan Itinerary</label>
        <select id="task-kegiatan-popup" class="form-select">
          <option value="">-- Pilih Kegiatan --</option>
        </select>
      </div>
      
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" id="task-date" class="form-input" value="${isEdit ? task.date : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Waktu (24 Jam)</label>
          <input type="time" id="task-time" class="form-input" value="${isEdit ? task.time : ''}" required>
        </div>
      </div>
      
      <div class="grid-3col">
        <div class="form-group">
          <label class="form-label">Wilayah</label>
          <select id="task-region" class="form-select" required>
            <option value="Jeddah" ${isEdit && task.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
            <option value="Madinah" ${isEdit && task.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
            <option value="Makkah" ${isEdit && task.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Jenis Penugasan</label>
          <input type="text" id="task-type" class="form-input" list="task-type-datalist" value="${isEdit ? task.type : ''}" placeholder="Pilih / ketik jenis penugasan..." required>
          <datalist id="task-type-datalist">
            <option value="Kedatangan Bandara Jeddah">
            <option value="Kedatangan Bandara Madinah">
            <option value="Kepulangan Bandara Jeddah">
            <option value="Kepulangan Bandara Madinah">
            <option value="Check In Hotel Madinah">
            <option value="Check Out Hotel Madinah">
            <option value="Check In Hotel Makkah">
            <option value="Check Out Hotel Makkah">
            <option value="Check In Hotel Jeddah">
            <option value="Check Out Hotel Jeddah">
            <option value="City Tour Madinah">
            <option value="City Tour Al Ula">
            <option value="City Tour Makkah">
            <option value="City Tour Thaif">
            <option value="City Tour Khandama">
            <option value="Romansiah Jeddah">
            <option value="Romansiah Madinah">
            <option value="Romansiah Makkah">
            <option value="Penjemputan Stasiun Madinah">
            <option value="Penjemputan Stasiun Makkah">
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">KEBUTUHAN PETUGAS</label>
          <input type="number" id="task-required-staff" class="form-input" min="1" value="${isEdit ? (task.requiredStaff || 1) : 1}" required>
        </div>
      </div>
      
      <div class="form-group hidden" id="custom-task-name-container">
        <label class="form-label">Nama Kustom Jenis Penugasan</label>
        <input type="text" id="custom-task-name-input" class="form-input" value="${isEdit ? (task.details.customTaskName || '') : ''}">
      </div>

      <div id="modal-conditional-fields" style="background:#f8f9fa; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;"></div>
      
      <div class="form-group">
        <label class="form-label">Keterangan Umum</label>
        <input type="text" id="task-remarks-global" class="form-input" value="${isEdit ? (task.details.remarks || '') : ''}" placeholder="Keterangan tambahan untuk tim">
      </div>
      
      <div class="form-group">
        <label class="form-label">Pilihan Petugas Lapangan</label>
        <div style="display:flex; gap:10px;">
          <div style="flex-grow:1; position:relative;">
            <input type="text" id="task-staff-search" class="form-input" placeholder="Ketik nama petugas...">
            <div id="task-staff-suggestions" class="suggestion-list hidden"></div>
          </div>
          <button type="button" id="add-staff-badge-btn" class="btn btn-gold" style="width:auto; padding:10px 16px;">Tambah</button>
        </div>
        <div class="staff-badge-row" id="plotted-staff-badges"></div>
      </div>
      
      <button type="submit" class="btn btn-primary">Simpan Penugasan</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Penugasan" : "Tambah Penugasan Baru", popupHtml);
  
  const gInput = document.getElementById("task-group-input-popup");
  const typeSelect = document.getElementById("task-type");
  const conditionalBox = document.getElementById("modal-conditional-fields");
  const kegiatanSelect = document.getElementById("task-kegiatan-popup");

  const updateKegiatanDropdown = (groupName) => {
    kegiatanSelect.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const groupIti = state.itineraries.find(i => i.groupName === groupName);
    if (groupIti && groupIti.activities) {
      groupIti.activities.forEach(a => {
        const titleText = a.agenda || a.title || 'Kegiatan';
        const dateText = a.date ? ` (${formatDateDisplay(a.date)})` : '';
        kegiatanSelect.innerHTML += `<option value="${titleText}">${titleText}${dateText}</option>`;
      });
    }
    kegiatanSelect.innerHTML += '<option value="Additional">Additional</option>';
    if (isEdit && task && task.details && task.details.itinerary) {
      kegiatanSelect.value = task.details.itinerary;
    }
  };

  kegiatanSelect.onchange = () => {
    const agenda = kegiatanSelect.value;
    const groupName = gInput.value;
    const groupIti = state.itineraries.find(i => i.groupName === groupName);
    if (groupIti && groupIti.activities && agenda !== "Additional") {
      const act = groupIti.activities.find(a => (a.title === agenda || a.agenda === agenda));
      if (act) {
        if (act.date) document.getElementById("task-date").value = act.date;
        if (act.time) {
          const tClean = act.time.replace(/[^0-9:]/g, '');
          if (tClean) document.getElementById("task-time").value = tClean;
        }
        if (act.city) {
          const regEl = document.getElementById("task-region");
          if (regEl) regEl.value = act.city;
        }
      }
    }
  };

  const updateCondFields = () => {
    const type = typeSelect.value || "";
    const groupName = gInput.value;
    
    if (type === "Lainnya") {
      const customNameContainer = document.getElementById("custom-task-name-container");
      if (customNameContainer) customNameContainer.classList.remove("hidden");
    } else {
      const customNameContainer = document.getElementById("custom-task-name-container");
      if (customNameContainer) customNameContainer.classList.add("hidden");
    }
    
    const group = state.groups.find(x => x.name === groupName);
    const totalPaxVal = group ? (group.packages ? group.packages.reduce((sum, p) => sum + (p.pax || 0), 0) : '') : '';
    const etaVal = group ? (group.flightArrival ? group.flightArrival.map(f => `${f.code || ''} ${f.takeoff || ''}-${f.landing || ''}`).join('; ') : '') : '';
    const etdVal = group ? (group.flightDeparture ? group.flightDeparture.map(f => `${f.code || ''} ${f.takeoff || ''}-${f.landing || ''}`).join('; ') : '') : '';
    const mealArrVal = group ? (group.mealsArrival ? group.mealsArrival.join(', ') : (group.mealArrival ? group.mealArrival.join(', ') : '')) : '';
    const mealDepVal = group ? (group.mealsDeparture ? group.mealsDeparture.join(', ') : (group.mealDeparture ? group.mealDeparture.join(', ') : '')) : '';

    if (type.startsWith("Kedatangan Bandara")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">Tujuan</label>
            <select id="c-dest-target" class="form-select" required>
              <option value="Hotel Madinah" ${isEdit && task.details.destinationTarget === 'Hotel Madinah' ? 'selected' : ''}>Hotel Madinah</option>
              <option value="Hotel Makkah" ${isEdit && task.details.destinationTarget === 'Hotel Makkah' ? 'selected' : ''}>Hotel Makkah</option>
              <option value="Hotel Jeddah" ${isEdit && task.details.destinationTarget === 'Hotel Jeddah' ? 'selected' : ''}>Hotel Jeddah</option>
              <option value="Hotel Jeddah" ${isEdit && task.details.destinationTarget === 'Hotel Jeddah' ? 'selected' : ''}>Hotel Jeddah</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mealplan Kedatangan (Auto Manifest)</label>
            <input type="text" id="c-meal" class="form-input" value="${isEdit ? (task.details.meal || '') : mealArrVal}" placeholder="Auto dari manifest grup" required>
          </div>
        </div>
        <div class="grid-2col" style="margin-top:8px;">
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
          <div class="form-group"><label class="form-label">FLIGHT & ETA</label><input type="text" id="c-eta" class="form-input" value="${isEdit ? (task.details.eta || '') : etaVal}" required></div>
        </div>
      `;
    } else if (type.startsWith("Kepulangan Bandara")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">Asal</label>
            <select id="c-origin-target" class="form-select" required>
              <option value="Hotel Madinah" ${isEdit && task.details.originTarget === 'Hotel Madinah' ? 'selected' : ''}>Hotel Madinah</option>
              <option value="Hotel Makkah" ${isEdit && task.details.originTarget === 'Hotel Makkah' ? 'selected' : ''}>Hotel Makkah</option>
              <option value="Hotel Jeddah" ${isEdit && task.details.originTarget === 'Hotel Jeddah' ? 'selected' : ''}>Hotel Jeddah</option>
              <option value="Hotel Jeddah" ${isEdit && task.details.originTarget === 'Hotel Jeddah' ? 'selected' : ''}>Hotel Jeddah</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mealplan Kepulangan (Auto Manifest)</label>
            <input type="text" id="c-meal" class="form-input" value="${isEdit ? (task.details.meal || '') : mealDepVal}" placeholder="Auto dari manifest grup" required>
          </div>
        </div>
        <div class="grid-2col" style="margin-top:8px;">
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
          <div class="form-group"><label class="form-label">FLIGHT & ETD</label><input type="text" id="c-etd" class="form-input" value="${isEdit ? (task.details.eta || '') : etdVal}" required></div>
        </div>
      `;
    } else if (type.startsWith("Check In Hotel")) {
      const selectedHotel = isEdit ? (task.details.hotelName || '') : "";
      const selectedPkgs = isEdit ? (task.details.packages || []) : [];
      const hotelListDatalist = group ? (group.hotels || []) : [];
      
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">Hotel (Manifest Group Suggestion)</label>
            <input type="text" id="c-hotel" class="form-input" list="c-hotel-datalist" value="${selectedHotel}" placeholder="Pilih / ketik nama hotel..." required>
            <datalist id="c-hotel-datalist">
              ${hotelListDatalist.map(h => `<option value="${h}">`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Asal</label>
            <select id="c-origin-target" class="form-select" required>
              <option value="Bandara Madinah" ${isEdit && task.details.originTarget === 'Bandara Madinah' ? 'selected' : ''}>Bandara Madinah</option>
              <option value="Bandara Jeddah" ${isEdit && task.details.originTarget === 'Bandara Jeddah' ? 'selected' : ''}>Bandara Jeddah</option>
              <option value="Hotel Madinah" ${isEdit && task.details.originTarget === 'Hotel Madinah' ? 'selected' : ''}>Hotel Madinah</option>
              <option value="Hotel Makkah" ${isEdit && task.details.originTarget === 'Hotel Makkah' ? 'selected' : ''}>Hotel Makkah</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label class="form-label">Paket (Multi Select)</label>
          <div style="display:flex; gap:12px; flex-wrap:wrap; background:#ffffff; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;">
            ${['Sapphire Plus', 'Sapphire', 'Ruby', 'Onyx', 'Best Deal', 'Yaqin'].map(p => `
              <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:0.85rem; font-weight:700;">
                <input type="checkbox" class="c-pkg-chk" value="${p}" ${selectedPkgs.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="grid-2col" style="margin-top:8px;">
          <div class="form-group"><label class="form-label">Komposisi Kamar</label><input type="text" id="c-room-comp" class="form-input" value="${isEdit ? (task.details.roomComposition || task.details.komposisiKamar || '') : ''}" placeholder="Isian singkat (misal: 5 Quad, 2 Double)"></div>
          <div class="form-group"><label class="form-label">Complimentary</label><input type="text" id="c-complimentary" class="form-input" value="${isEdit ? (task.details.complimentary || '') : ''}" placeholder="Isian singkat complimentary"></div>
        </div>
      `;
    } else if (type.startsWith("Check Out Hotel")) {
      const selectedHotel = isEdit ? (task.details.hotelName || '') : "";
      const selectedPkgs = isEdit ? (task.details.packages || []) : [];
      const hotelListDatalist = group ? (group.hotels || []) : [];
      
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">Hotel (Manifest Group Suggestion)</label>
            <input type="text" id="c-hotel" class="form-input" list="c-hotel-datalist" value="${selectedHotel}" placeholder="Pilih / ketik nama hotel..." required>
            <datalist id="c-hotel-datalist">
              ${hotelListDatalist.map(h => `<option value="${h}">`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Tujuan</label>
            <select id="c-dest-target" class="form-select" required>
              <option value="Bandara Madinah" ${isEdit && task.details.destinationTarget === 'Bandara Madinah' ? 'selected' : ''}>Bandara Madinah</option>
              <option value="Bandara Jeddah" ${isEdit && task.details.destinationTarget === 'Bandara Jeddah' ? 'selected' : ''}>Bandara Jeddah</option>
              <option value="Hotel Madinah" ${isEdit && task.details.destinationTarget === 'Hotel Madinah' ? 'selected' : ''}>Hotel Madinah</option>
              <option value="Hotel Makkah" ${isEdit && task.details.destinationTarget === 'Hotel Makkah' ? 'selected' : ''}>Hotel Makkah</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label class="form-label">Paket (Multi Select)</label>
          <div style="display:flex; gap:12px; flex-wrap:wrap; background:#ffffff; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;">
            ${['Sapphire Plus', 'Sapphire', 'Ruby', 'Onyx', 'Best Deal', 'Yaqin'].map(p => `
              <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:0.85rem; font-weight:700;">
                <input type="checkbox" class="c-pkg-chk" value="${p}" ${selectedPkgs.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="grid-2col" style="margin-top:8px;">
          <div class="form-group"><label class="form-label">Komposisi Kamar</label><input type="text" id="c-room-comp" class="form-input" value="${isEdit ? (task.details.roomComposition || task.details.komposisiKamar || '') : ''}" placeholder="Isian singkat (misal: 5 Quad, 2 Double)"></div>
          <div class="form-group"><label class="form-label">Complimentary</label><input type="text" id="c-complimentary" class="form-input" value="${isEdit ? (task.details.complimentary || '') : ''}" placeholder="Isian singkat complimentary"></div>
        </div>
      `;
    } else if (type.startsWith("Romansiah")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">Asal</label>
            <input type="text" id="c-origin-route" class="form-input" value="${isEdit ? (task.details.originTarget || task.details.hotelPickup || '') : ''}" placeholder="Isi lokasi asal penjemputan/pemesanan..." required>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah Nampan</label>
            <input type="number" id="c-nampan-count" class="form-input" min="1" value="${isEdit ? (task.details.nampanCount || '') : ''}" placeholder="Isi jumlah nampan..." required>
          </div>
        </div>
      `;
    } else if (type.startsWith("City Tour") || type.startsWith("Penjemputan Stasiun")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group"><label class="form-label">Rute Penjemputan</label><input type="text" id="c-pickup-route" class="form-input" value="${isEdit ? (task.details.hotelPickup || task.details.pickupRoute || '') : ''}" placeholder="Rute / tempat penjemputan" required></div>
          <div class="form-group"><label class="form-label">Tujuan (Manual)</label><input type="text" id="c-tour-dest" class="form-input" value="${isEdit ? (task.details.destinationBus || task.details.destination || '') : ''}" placeholder="Ketik tempat tujuan" required></div>
        </div>
      `;
    } else {
      conditionalBox.innerHTML = `
        <div class="form-group">
          <label class="form-label">Deskripsi Custom</label>
          <textarea id="c-desc" class="form-textarea" rows="3" required>&nbsp;${isEdit ? (task.details.customText || '') : ''}</textarea>
        </div>
      `;
    }
  };

  initSuggestionInput("task-group-input-popup", "task-group-suggestions-popup", groupNames, (name) => {
    updateKegiatanDropdown(name);
    updateCondFields();
  });
  
  if (isEdit) {
    updateKegiatanDropdown(task.groupName);
  }

  typeSelect.onchange = updateCondFields;
  updateCondFields();
  
  const staffList = fieldStaffs.map(s => `${s.name} (${s.username})`);
  let selectedStaffUsername = "";
  initSuggestionInput("task-staff-search", "task-staff-suggestions", staffList, (val) => {
    const reg = /(([^)]+))/;
    const match = reg.exec(val);
    if (match && match[1]) {
      selectedStaffUsername = match[1];
    }
  });
  
  const renderBadges = () => {
    const row = document.getElementById("plotted-staff-badges");
    if (!row) return;
    row.innerHTML = plottedStaffs.map(usr => {
      const u = state.users.find(x => x.username === usr);
      return `
        <span class="staff-badge">
          ${u ? u.name : usr}
          <span class="staff-badge-remove" data-usr="${usr}">&times;</span>
        </span>
      `;
    }).join('');
    row.querySelectorAll(".staff-badge-remove").forEach(b => {
      b.onclick = () => {
        plottedStaffs = plottedStaffs.filter(x => x !== b.getAttribute("data-usr"));
        renderBadges();
      };
    });
  };
  renderBadges();
  
  const addStaffBtn = document.getElementById("add-staff-badge-btn");
  if (addStaffBtn) {
    addStaffBtn.onclick = () => {
      const searchEl = document.getElementById("task-staff-search");
      const rawInput = searchEl ? searchEl.value.trim() : "";
      if (!rawInput && !selectedStaffUsername) return;

      let foundUser = state.users.filter(u => u.role === 'user').find(u => 
        (selectedStaffUsername && u.username === selectedStaffUsername) ||
        u.username.toLowerCase() === rawInput.toLowerCase() ||
        u.name.toLowerCase() === rawInput.toLowerCase() ||
        rawInput.toLowerCase().includes(`(${u.username.toLowerCase()})`) ||
        rawInput.toLowerCase().includes(u.name.toLowerCase())
      );

      const targetUsername = foundUser ? foundUser.username : (selectedStaffUsername || rawInput);

      if (targetUsername) {
        if (!plottedStaffs.includes(targetUsername)) {
          plottedStaffs.push(targetUsername);
          renderBadges();
          if (searchEl) searchEl.value = "";
          selectedStaffUsername = "";
        } else {
          showToast("Petugas sudah terpilih dalam penugasan ini", "error");
        }
      }
    };
  }
  
  document.getElementById("task-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gInput.value;
    const requiredStaff = parseInt(document.getElementById("task-required-staff").value) || 1;
    const date = document.getElementById("task-date").value;
    const time = document.getElementById("task-time").value;
    const region = document.getElementById("task-region").value;
    const type = typeSelect.value;
    const customTaskNameEl = document.getElementById("custom-task-name-input");
    const customTaskName = customTaskNameEl ? customTaskNameEl.value.trim() : "";
    const remarksGlobalEl = document.getElementById("task-remarks-global");
    const remarksGlobal = remarksGlobalEl ? remarksGlobalEl.value.trim() : "";
    
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    // Preserve existing details properties and update form values
    let details = {
      ...(isEdit && task && task.details ? task.details : {}),
      remarks: remarksGlobal,
      customTaskName: type === "Lainnya" ? customTaskName : "",
      itinerary: getVal("task-kegiatan-popup")
    };
    
    if (type.startsWith("Kedatangan Bandara")) {
      if (getVal("c-pax")) details.totalPax = parseInt(getVal("c-pax")) || details.totalPax || 0;
      if (getVal("c-eta")) details.eta = getVal("c-eta").trim();
      if (getVal("c-meal")) details.meal = getVal("c-meal").trim();
      if (getVal("c-dest-target")) details.destinationTarget = getVal("c-dest-target");
    } else if (type.startsWith("Kepulangan Bandara")) {
      if (getVal("c-pax")) details.totalPax = parseInt(getVal("c-pax")) || details.totalPax || 0;
      if (getVal("c-etd")) details.eta = getVal("c-etd").trim();
      if (getVal("c-meal")) details.meal = getVal("c-meal").trim();
      if (getVal("c-origin-target")) details.originTarget = getVal("c-origin-target");
    } else if (type.startsWith("Check In Hotel") || type.startsWith("Check Out Hotel")) {
      const chks = document.querySelectorAll(".c-pkg-chk:checked");
      if (getVal("c-hotel")) details.hotelName = getVal("c-hotel");
      details.packages = Array.from(chks).map(c => c.value);
      if (getVal("c-room-comp")) details.roomComposition = getVal("c-room-comp").trim();
      if (getVal("c-complimentary")) details.complimentary = getVal("c-complimentary").trim();
      if (getVal("c-origin-target")) details.originTarget = getVal("c-origin-target");
      if (getVal("c-dest-target")) details.destinationTarget = getVal("c-dest-target");
    } else if (type.startsWith("Romansiah")) {
      if (getVal("c-origin-route")) details.originTarget = getVal("c-origin-route").trim();
      if (getVal("c-nampan-count")) details.nampanCount = parseInt(getVal("c-nampan-count")) || 0;
    } else if (type.startsWith("City Tour") || type.startsWith("Penjemputan Stasiun")) {
      if (getVal("c-tour-dest")) {
        details.destinationBus = getVal("c-tour-dest").trim();
        details.destination = details.destinationBus;
      }
      if (getVal("c-pickup-route")) {
        details.hotelPickup = getVal("c-pickup-route").trim();
        details.pickupRoute = details.hotelPickup;
      }
      if (getVal("c-pax")) details.totalPax = parseInt(getVal("c-pax")) || details.totalPax || 0;
    } else {
      if (getVal("c-desc")) details.customText = getVal("c-desc").trim();
    }
    
    if (isEdit) {
      const idx = state.assignments.findIndex(t => t.id === editId);
      if (idx !== -1) {
        state.assignments[idx] = {
          id: editId, groupName, date, time, region, type, details, staff: plottedStaffs, status: task.status, published: (task.published !== false), requiredStaff
        };
      }
    } else {
      state.assignments.push({
        id: `assign-${Date.now()}`, groupName, date, time, region, type, details, staff: plottedStaffs, status: "Aktif", published: true, requiredStaff
      });
    }
    
    saveState();
    pushData();
    closeModal();
    showToast(isEdit ? "Jadwal penugasan berhasil diedit!" : "Jadwal penugasan berhasil dibuat!");
    renderAdminPenjadwalan();
  };
}


function openStaffFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const u = isEdit ? state.users[editIdx] : null;
  
  const popupHtml = `
    <form id="staff-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input type="text" id="staff-name-popup" class="form-input" value="${isEdit ? u.name : ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor WhatsApp</label>
        <input type="text" id="staff-wa-popup" class="form-input" value="${isEdit ? (u.whatsapp || '') : ''}" required placeholder="Contoh: 628111222333">
      </div>
      <div class="form-group">
        <label class="form-label">Wilayah Operasional</label>
        <select id="staff-region-popup" class="form-select" required>
          <option value="Makkah" ${isEdit && u.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
          <option value="Madinah" ${isEdit && u.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
          <option value="Jeddah" ${isEdit && u.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" id="staff-username-popup" class="form-input" value="${isEdit ? u.username : ''}" required ${isEdit ? 'readonly style="background:#e2e8f0; cursor:not-allowed;"' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">${isEdit ? 'Ubah Password Baru (Kosongkan jika tidak diubah)' : 'Password'}</label>
        <input type="password" id="staff-password-popup" class="form-input" ${isEdit ? '' : 'required'}>
      </div>
      <button type="submit" class="btn btn-gold">${isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}</button>
    </form>
  `;
  
  openModal(isEdit ? "Edit Anggota Tim" : "Tambah Anggota Baru", popupHtml);
  
  document.getElementById("staff-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("staff-name-popup").value.trim();
    const whatsapp = document.getElementById("staff-wa-popup").value.trim();
    const region = document.getElementById("staff-region-popup").value;
    const username = document.getElementById("staff-username-popup").value.trim();
    const password = document.getElementById("staff-password-popup").value;
    
    if (isEdit) {
      state.users[editIdx].name = name;
      state.users[editIdx].whatsapp = whatsapp;
      state.users[editIdx].region = region;
      if (password) {
        state.users[editIdx].password = password;
      }
      showToast("Data anggota tim berhasil diperbarui.");
    } else {
      if (state.users.some(x => x.username === username)) {
        showToast("Username sudah digunakan.", "error");
        return;
      }
      state.users.push({
        username,
        password,
        role: "user",
        name,
        whatsapp,
        region,
        pendingApproval: false
      });
      state.financial.wallets[username] = 0;
      showToast("Anggota tim baru berhasil ditambahkan.");
    }
    
    saveState();
    closeModal();
    loadDataTimTab("active-list");
  };
}


function renderAdminDataTim() {
  const container = document.getElementById("admin-subview-content");
  
  const activeStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  const pendingStaffs = state.users.filter(u => u.role === 'user' && u.pendingApproval === true);
  
  const urlParams = window.location.hash.split("?")[1];
  const selectTab = (urlParams && urlParams.includes("tab=pending")) ? "pending-list" : "active-list";
  
  container.innerHTML = `
    <!-- Tabs inside data tim -->
    <div class="tab-header" style="margin-bottom:20px;">
      <div class="tab-btn ${selectTab === 'active-list' ? 'active' : ''}" id="tab-staff-active-btn" data-tab="active-list">Tim Khidmat Aktif (${activeStaffs.length})</div>
      <div class="tab-btn ${selectTab === 'pending-list' ? 'active' : ''}" id="tab-staff-pending-btn" data-tab="pending-list" style="position:relative;">
        Persetujuan Registrasi (${pendingStaffs.length})
        ${pendingStaffs.length > 0 ? '<span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block; margin-left:4px;"></span>' : ''}
      </div>
    </div>
    
    <div id="data-tim-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadDataTimTab(btn.getAttribute("data-tab"));
    };
  });
  
  loadDataTimTab(selectTab);
}
function loadDataTimTab(tab) {
  const contents = document.getElementById("data-tim-tab-contents");
  if (!contents) return;
  
  if (tab === "active-list") {
    const activeStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
    contents.innerHTML = `
      <div style="margin-bottom:12px; display:flex; gap:10px; align-items:center;">
        <input type="text" id="staff-active-search-input" class="form-input" placeholder="Cari berdasarkan nama atau username..." style="max-width:300px; padding:6px 12px; font-size:0.85rem;">
      </div>
      <div class="table-card">
        <div class="table-header-bar">
          <h3 class="table-title">Daftar Tim Khidmat</h3>
          <button id="admin-add-team-popup-btn" class="btn btn-gold" style="width:auto; padding: 8px 16px; font-size:0.85rem;"><i data-lucide="plus-circle"></i> Tambah Anggota</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>No WhatsApp</th>
                <th>Wilayah</th>
                <th>Role/Bagian</th>
                <th>Username</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="staff-active-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const renderActiveRows = () => {
      const q = document.getElementById("staff-active-search-input").value.toLowerCase().trim();
      const filtered = activeStaffs.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
      const tbody = document.getElementById("staff-active-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada tim khidmat aktif ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(u => {
        const uIdx = state.users.indexOf(u);
        return `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>${u.whatsapp}</span>
                <a href="https://wa.me/${u.whatsapp}" target="_blank" class="btn btn-secondary" style="width:auto; padding:6px; font-size:0.75rem; color:#10b981; border-color:#a7f3d0; box-shadow:none;" title="Chat WhatsApp"><i data-lucide="message-circle" style="width:16px; height:16px; stroke:#10b981;"></i></a>
              </div>
            </td>
            <td><span class="badge badge-info" style="font-size:0.75rem;">${u.region || 'Belum Diatur'}</span></td>
            <td><code>${u.role.toUpperCase()}</code></td>
            <td><code>@${u.username}</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary edit-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Edit</button>
                <button class="btn btn-danger delete-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hapus</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind active actions
      tbody.querySelectorAll(".edit-staff-btn").forEach(btn => {
        btn.onclick = () => openStaffFormPopup(parseInt(btn.getAttribute("data-idx")));
      });
      tbody.querySelectorAll(".delete-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Hapus anggota tim ini?")) {
            state.users.splice(idx, 1);
            saveState();
            showToast("Anggota tim dihapus.");
            loadDataTimTab("active-list");
          }
        };
      });
      lucide.createIcons();
    };
    
    document.getElementById("staff-active-search-input").oninput = renderActiveRows;
    renderActiveRows();
    document.getElementById("admin-add-team-popup-btn").onclick = () => openStaffFormPopup();
    
  } else if (tab === "pending-list") {
    const pendingStaffs = state.users.filter(u => u.role === 'user' && u.pendingApproval === true);
    contents.innerHTML = `
      <div style="margin-bottom:12px;">
        <input type="text" id="staff-pending-search-input" class="form-input" placeholder="Cari persetujuan pending..." style="max-width:300px; padding:6px 12px; font-size:0.85rem;">
      </div>
      <div class="table-card">
        <div class="table-header-bar">
          <h3 class="table-title">Persetujuan Registrasi Baru</h3>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>No WhatsApp</th>
                <th>Username</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="staff-pending-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const renderPendingRows = () => {
      const q = document.getElementById("staff-pending-search-input").value.toLowerCase().trim();
      const filtered = pendingStaffs.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
      const tbody = document.getElementById("staff-pending-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada permintaan persetujuan registrasi.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(u => {
        const uIdx = state.users.indexOf(u);
        return `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.whatsapp}</td>
            <td><code>@${u.username}</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-success approve-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Setujui</button>
                <button class="btn btn-danger reject-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Tolak</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind pending actions
      tbody.querySelectorAll(".approve-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          state.users[idx].pendingApproval = false;
          saveState();
          showToast("Registrasi akun disetujui!");
          renderAdminDataTim();
        };
      });
      tbody.querySelectorAll(".reject-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Tolak dan hapus pengajuan registrasi ini?")) {
            state.users.splice(idx, 1);
            saveState();
            showToast("Registrasi akun ditolak.");
            renderAdminDataTim();
          }
        };
      });
    };
    
    document.getElementById("staff-pending-search-input").oninput = renderPendingRows;
    renderPendingRows();
  }
}

function openAdminPendingExpenseDetailPopup(expenseId) {
  const e = state.financial.expenses.find(x => x.id === expenseId);
  if (!e) return;
  
  const fullName = state.users.find(u => u.username === e.username)?.name || e.username;
  
  let itemsHtml = '';
  if (e.items && e.items.length > 0) {
    itemsHtml = `
      <div style="margin-top:14px; margin-bottom:14px;">
        <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item:</strong>
        <table class="data-table" style="font-size:0.8rem; margin-top:6px; width:100%;">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Harga</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${e.items.map(item => `
              <tr>
                <td>${item.category || item.name}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">SAR ${item.price.toLocaleString('id-ID')}</td>
                <td style="text-align:right;">SAR ${(item.qty * item.price).toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  let receiptHtml = '';
  if (e.receipt) {
    const isImg = e.receipt.startsWith('data:image') || e.receipt.endsWith('.jpg') || e.receipt.endsWith('.png') || e.receipt.endsWith('.jpeg');
    receiptHtml = `
      <div style="margin-top:14px;">
        <strong style="font-size:0.8rem; color:var(--text-muted);">Bukti Struk:</strong>
        <div style="margin-top:6px; text-align:center;">
          ${isImg 
            ? `<img src="${e.receipt}" style="max-width:100%; max-height:280px; border-radius:6px; border:1px solid #cbd5e1; object-fit:contain;">`
            : `<a href="${e.receipt}" target="_blank" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem;"><i data-lucide="file-text" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat File Struk</a>`
          }
        </div>
      </div>
    `;
  }
  
  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:14px;">
        <tr><td style="padding:4px 0; font-weight:700; width:120px; color:var(--text-muted);">Tipe Pengajuan:</td><td><strong>Pengeluaran Kas</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Diajukan Oleh:</td><td>${fullName}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Tanggal:</td><td>${formatDateDisplay(e.date)}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Kategori / Grup:</td><td><strong>${e.groupName || e.category}</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Keterangan:</td><td>${e.description}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Nominal:</td><td style="color:#ef4444; font-weight:800; font-size:1.05rem;">SAR ${e.amount.toLocaleString('id-ID')}</td></tr>
      </table>
      
      ${itemsHtml}
      ${receiptHtml}
      
      <div style="display:flex; justify-content:center; gap:20px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <button id="detail-approve-exp-btn" class="btn btn-gold" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#10b981; border:none;" title="Setujui"><i data-lucide="check" style="color:#fff; width:24px; height:24px;"></i></button>
        <button id="detail-reject-exp-btn" class="btn btn-danger" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#ef4444; border:none;" title="Tolak"><i data-lucide="x" style="color:#fff; width:24px; height:24px;"></i></button>
      </div>
    </div>
  `;
  
  openModal("Detail Pengajuan Pengeluaran", detailHtml);
  lucide.createIcons();
  
  document.getElementById("detail-approve-exp-btn").onclick = () => {
    e.status = "APPROVED";
    state.financial.wallets[e.username] = (state.financial.wallets[e.username] || 0) - e.amount;
    const cleanDesc = (e.description || 'Pengeluaran Tim').replace(/^\[APPROVED\]\s*/i, '');
    state.financial.transactions.push({
      id: `tx-${Date.now()}`, 
      type: "Uang Keluar", 
      sender: e.username, 
      recipient: "Operasional", 
      amount: e.amount, 
      date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'), 
      description: cleanDesc, 
      status: "APPROVED", 
      refExpenseId: e.id
    });
    saveState();
    pushData();
    closeModal();
    showToast("Laporan pengeluaran disetujui!");
    renderAdminFinancial();
  };
  
  document.getElementById("detail-reject-exp-btn").onclick = () => {
    if (e.status === "APPROVED" || e.status === "Disetujui") {
      state.financial.wallets[e.username] = (state.financial.wallets[e.username] || 0) + e.amount;
    }
    e.status = "Ditolak";
    saveState();
    closeModal();
    showToast("Laporan pengeluaran ditolak.", "error");
    renderAdminFinancial();
  };
}

function openAdminPendingDeleteDetailPopup(reqId) {
  const req = state.financial.deleteRequests.find(x => x.id === reqId);
  if (!req) return;
  
  const exp = state.financial.expenses.find(x => x.id === req.expenseId);
  const applicantName = state.users.find(u => u.username === req.username)?.name || req.username;
  
  let expHtml = '';
  if (exp) {
    const staffName = state.users.find(u => u.username === exp.username)?.name || exp.username;
    
    let itemsHtml = '';
    if (exp.items && exp.items.length > 0) {
      itemsHtml = `
        <div style="margin-top:10px;">
          <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item Transaksi:</strong>
          <table class="data-table" style="font-size:0.75rem; margin-top:4px; width:100%;">
            <tbody>
              ${exp.items.map(item => `
                <tr>
                  <td>${item.category || item.name}</td>
                  <td style="text-align:center;">${item.qty} pcs</td>
                  <td style="text-align:right;">SAR ${item.price}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    expHtml = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-top:14px;">
        <h5 style="margin:0 0 10px 0; font-weight:800; font-size:0.85rem;">Detail Transaksi Asli</h5>
        <table style="width:100%; font-size:0.8rem; line-height:1.5;">
          <tr><td style="font-weight:700; width:100px; color:var(--text-muted);">Petugas:</td><td>${staffName}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Kategori / Grup:</td><td>${exp.groupName || exp.category}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Keterangan:</td><td>${exp.description}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Nominal:</td><td style="color:#ef4444; font-weight:800;">SAR ${exp.amount.toLocaleString('id-ID')}</td></tr>
        </table>
        ${itemsHtml}
      </div>
    `;
  } else {
    expHtml = `<p style="color:#ef4444; font-size:0.8rem; margin-top:14px;">Data transaksi asli tidak ditemukan.</p>`;
  }
  
  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <tr><td style="padding:4px 0; font-weight:700; width:120px; color:var(--text-muted);">Tipe Pengajuan:</td><td><strong>Permintaan Hapus Transaksi</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Pemohon:</td><td>${applicantName}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Alasan Hapus:</td><td style="color:#d97706; font-weight:700;">${req.reason}</td></tr>
      </table>
      
      ${expHtml}
      
      <div style="display:flex; justify-content:center; gap:20px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <button id="detail-approve-del-btn" class="btn btn-gold" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#10b981; border:none;" title="Setujui Hapus"><i data-lucide="check" style="color:#fff; width:24px; height:24px;"></i></button>
        <button id="detail-reject-del-btn" class="btn btn-danger" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#ef4444; border:none;" title="Tolak"><i data-lucide="x" style="color:#fff; width:24px; height:24px;"></i></button>
      </div>
    </div>
  `;
  
  openModal("Detail Permintaan Hapus", detailHtml);
  lucide.createIcons();
  
  document.getElementById("detail-approve-del-btn").onclick = () => {
    if (exp) {
      voidFinancialTransaction(exp.id, req.reason || "Disetujui dari Permintaan Hapus Tim");
    }
    req.status = "Approved";
    saveState();
    closeModal();
    showToast("Transaksi berhasil dibatalkan (VOID)!");
    renderAdminFinancial();
  };
  
  document.getElementById("detail-reject-del-btn").onclick = () => {
    req.status = "Rejected";
    saveState();
    closeModal();
    showToast("Permintaan hapus ditolak.", "error");
    renderAdminFinancial();
  };
}

function voidFinancialTransaction(txIdOrExpenseId, reason, adminUser = "") {
  if (!reason || reason.trim() === "") {
    showToast("Alasan pembatalan (void) wajib diisi!", "error");
    return false;
  }

  const currentUserObj = state.currentUser || {};
  const voidedBy = adminUser || currentUserObj.name || currentUserObj.username || "Admin";
  const { gregorianStr, timeStr } = getSaudiDateTime();
  const voidedAt = `${gregorianStr} ${timeStr} Saudi`;
  const cleanReason = reason.trim();

  // Find transaction and/or expense
  let tx = state.financial.transactions.find(t => t.id === txIdOrExpenseId);
  let exp = state.financial.expenses.find(e => e.id === txIdOrExpenseId);

  if (tx && !exp) {
    exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
  }

  let voidedAny = false;

  // Process Expense Void
  if (exp && exp.status !== "VOID" && exp.status !== "Dibatalkan") {
    const prevStatus = exp.status;
    exp.status = "VOID";
    exp.voidedAt = voidedAt;
    exp.voidedBy = voidedBy;
    exp.voidReason = cleanReason;

    // Refund expense to user wallet if it was previously approved or pending
    if (prevStatus !== "Ditolak") {
      state.financial.wallets[exp.username] = (state.financial.wallets[exp.username] || 0) + exp.amount;
    }
    voidedAny = true;
  }

  // Process Transaction Log Void
  if (tx && tx.status !== "VOID" && tx.status !== "Dibatalkan") {
    const prevStatus = tx.status;
    tx.status = "VOID";
    tx.voidedAt = voidedAt;
    tx.voidedBy = voidedBy;
    tx.voidReason = cleanReason;

    // Reverse financial balance impact based on transaction type
    if (prevStatus === "Approved" || prevStatus === "Disetujui" || prevStatus === "Completed" || prevStatus === "Pending Confirmation") {
      if (tx.type === "Top-Up") {
        state.financial.mainBalance = Math.max(0, state.financial.mainBalance - tx.amount);
      } else if (tx.type === "Transfer Kas" || tx.type === "Transfer") {
        if (tx.sender === "Dompet Utama") {
          state.financial.mainBalance += tx.amount;
          if (tx.recipient && state.financial.wallets[tx.recipient] !== undefined) {
            state.financial.wallets[tx.recipient] -= tx.amount;
          }
        } else if (tx.recipient === "Dompet Utama") {
          state.financial.mainBalance = Math.max(0, state.financial.mainBalance - tx.amount);
          if (tx.sender && state.financial.wallets[tx.sender] !== undefined) {
            state.financial.wallets[tx.sender] += tx.amount;
          }
        }
      }
    }
    voidedAny = true;
  }

  // Resolve associated delete requests
  if (exp) {
    state.financial.deleteRequests.forEach(req => {
      if (req.expenseId === exp.id && req.status === "Pending") {
        req.status = "Approved";
      }
    });
  }

  saveState();
  return voidedAny;
}

function openVoidTransactionModal(txIdOrExpenseId, onComplete) {
  const popupHtml = `
    <form id="admin-void-tx-form">
      <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.85rem; color:#991b1b;">
        <strong>⚠️ Peringatan Pembatalan Transaksi (Void):</strong><br>
        Tindakan ini akan membatalkan transaksi, membalikkan dampak saldo secara otomatis, dan mencatat alasan pembatalan ke dalam audit trail keuangan. Data transaksi tidak akan dihapus.
      </div>
      
      <div class="form-group">
        <label class="form-label" style="font-weight:800;">Alasan Pembatalan (Wajib Diisi)</label>
        <textarea id="admin-void-reason" class="form-textarea" rows="3" placeholder="Masukkan alasan pembatalan..." required></textarea>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 14px;">Batal</button>
        <button type="submit" class="btn btn-danger" style="width:auto; padding:6px 14px; font-weight:800;">
          <i data-lucide="ban" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> KONFIRMASI VOID TRANSAKSI
        </button>
      </div>
    </form>
  `;
  
  openModal("Batalkan Transaksi (Void)", popupHtml);
  lucide.createIcons();
  
  document.getElementById("admin-void-tx-form").onsubmit = (e) => {
    e.preventDefault();
    const reason = document.getElementById("admin-void-reason").value.trim();
    if (!reason) {
      showToast("Alasan pembatalan wajib diisi!", "error");
      return;
    }
    
    const success = voidFinancialTransaction(txIdOrExpenseId, reason);
    if (success) {
      closeModal();
      showToast("Transaksi berhasil dibatalkan (VOID)!");
      if (onComplete) onComplete();
      renderAdminFinancial();
    } else {
      showToast("Gagal membatalkan transaksi", "error");
    }
  };
}


function getTxCategoryType(tx) {
  if (!tx) return "Uang Keluar";
  const typeStr = (tx.type || "").toLowerCase();
  if (typeStr.includes("transfer") || (tx.id && tx.id.startsWith("tx-tf"))) {
    return "Transfer";
  }
  if (typeStr.includes("top-up") || typeStr.includes("topup") || typeStr.includes("masuk")) {
    return "Uang Masuk";
  }
  if (typeStr.includes("keluar") || typeStr.includes("pengeluaran") || tx.refExpenseId || (tx.id && tx.id.startsWith("tx-vendor-deduct"))) {
    return "Uang Keluar";
  }
  if (tx.sender === "Dompet Utama" && tx.recipient !== "Dompet Utama") {
    return "Transfer";
  }
  return "Uang Keluar";
}

function generateTxCode(tx, index, allTxs) {
  if (!tx) return "OUT0001";
  if (tx.code) return tx.code;
  const cat = getTxCategoryType(tx);
  let count = 0;
  for (let i = 0; i <= index; i++) {
    if (getTxCategoryType(allTxs[i]) === cat) {
      count++;
    }
  }
  const numStr = String(count).padStart(4, "0");
  if (cat === "Uang Masuk") return "IN" + numStr;
  if (cat === "Transfer") return "TF" + numStr;
  return "OUT" + numStr;
}

function terbilangAngka(n) {
  const units = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  n = Math.abs(Math.floor(n));
  if (n < 12) return units[n];
  if (n < 20) return terbilangAngka(n - 10) + " Belas";
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + " Puluh " + (units[n % 10] ? units[n % 10] : "");
  if (n < 200) return "Seratus " + terbilangAngka(n - 100);
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + " Ratus " + (terbilangAngka(n % 100) ? terbilangAngka(n % 100) : "");
  if (n < 2000) return "Seribu " + terbilangAngka(n - 1000);
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + " Ribu " + (terbilangAngka(n % 1000) ? terbilangAngka(n % 1000) : "");
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + " Juta " + (terbilangAngka(n % 1000000) ? terbilangAngka(n % 1000000) : "");
  return String(n);
}

function formatTerbilangSaudiRiyal(amount) {
  const str = terbilangAngka(amount).replace(/\s+/g, ' ').trim();
  if (!str) return '"Nol Saudi Riyal"';
  const capitalized = str.split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');
  return `"${capitalized} Saudi Riyal"`;
}

function printOrDownloadKwitansi(tx, txCode) {
  const formattedDate = formatDateLong(tx.date);
  const nominalStr = `SAR ${tx.amount.toLocaleString('id-ID')}`;
  const terbilangStr = formatTerbilangSaudiRiyal(tx.amount);
  const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : "Dana Operasional Saudi";
  
  const kwitansiHtml = `
    <html>
      <head>
        <title>Kwitansi ${txCode}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: 'Mulish', sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .kwitansi-container {
            width: 297mm;
            height: 175mm;
            position: relative;
            background-image: url('assets/kwitansi_bg.png');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            box-sizing: border-box;
            color: #1e293b;
          }
          .kwitansi-ref {
            position: absolute;
            top: 31%;
            right: 5%;
            font-size: 14pt;
            font-weight: 700;
            color: #0f172a;
          }
          .kwitansi-content {
            position: absolute;
            top: 42%;
            left: 4.5%;
            width: 90%;
            font-size: 13pt;
            line-height: 1.95;
          }
          .kwitansi-table {
            border-collapse: collapse;
            width: 100%;
          }
          .kwitansi-table td {
            vertical-align: top;
            padding: 2px 0;
          }
          .kwitansi-signatures {
            position: absolute;
            bottom: 12%;
            left: 4.5%;
            width: 90%;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 12.5pt;
          }
        </style>
      </head>
      <body onload="window.print();">
        <div class="kwitansi-container">
          <div class="kwitansi-ref">
            No. Referensi &nbsp;: ${txCode}
          </div>
          <div class="kwitansi-content">
            <table class="kwitansi-table">
              <tr>
                <td style="width: 150px; font-weight: 500;">Tanggal</td>
                <td style="width: 20px;">:</td>
                <td style="font-weight: 700;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Nominal</td>
                <td>:</td>
                <td style="font-weight: 900; font-size: 14pt;">${nominalStr}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Terbilang</td>
                <td>:</td>
                <td style="font-weight: 600; font-style: italic;">${terbilangStr}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Keterangan</td>
                <td>:</td>
                <td style="font-weight: 600;">${cleanDesc}</td>
              </tr>
            </table>
          </div>
          <div class="kwitansi-signatures">
            <div style="text-align: center; width: 35%;">
              <div style="font-weight: 500; margin-bottom: 50px;">Diserahkan Oleh</div>
              <div style="font-weight: 800;">Finance Pusat <span class="brand-martel" style="color:#1e293b;">jejak imani</span></div>
            </div>
            <div style="text-align: center; width: 35%;">
              <div style="font-weight: 500; margin-bottom: 50px;">Diterima Oleh</div>
              <div style="font-weight: 800;">Saudi Operational Officer</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(kwitansiHtml);
  printWindow.document.close();
}

function openKwitansiModal(tx, txCode) {
  const formattedDate = formatDateLong(tx.date);
  const nominalStr = `SAR ${tx.amount.toLocaleString('id-ID')}`;
  const terbilangStr = formatTerbilangSaudiRiyal(tx.amount);
  const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : "Dana Operasional Saudi";

  const modalHtml = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <!-- Preview Card -->
      <div style="position:relative; width:100%; aspect-ratio:16/9; background-image:url('assets/kwitansi_bg.png'); background-size:cover; background-position:center; background-repeat:no-repeat; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); border:1px solid #cbd5e1; overflow:hidden; color:#1e293b; font-family:'Mulish', sans-serif;">
        
        <div style="position:absolute; top:31%; right:5%; font-size:0.85rem; font-weight:700; color:#0f172a;">
          No. Referensi &nbsp;: ${txCode}
        </div>
        
        <div style="position:absolute; top:42%; left:4.5%; width:90%; font-size:0.8rem; line-height:1.75;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:100px; font-weight:500;">Tanggal</td>
              <td style="width:15px;">:</td>
              <td style="font-weight:700;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Nominal</td>
              <td>:</td>
              <td style="font-weight:900; font-size:0.88rem; color:#000;">${nominalStr}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Terbilang</td>
              <td>:</td>
              <td style="font-weight:600; font-style:italic;">${terbilangStr}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Keterangan</td>
              <td>:</td>
              <td style="font-weight:600;">${cleanDesc}</td>
            </tr>
          </table>
        </div>
        
        <div style="position:absolute; bottom:9%; left:4.5%; width:90%; display:flex; justify-content:space-between; align-items:flex-end; font-size:0.72rem;">
          <div style="text-align:center; width:35%;">
            <div style="font-weight:500; margin-bottom:24px;">Diserahkan Oleh</div>
            <div style="font-weight:800;">Finance Pusat <strong class="brand-martel">jejak imani</strong></div>
          </div>
          <div style="text-align:center; width:35%;">
            <div style="font-weight:500; margin-bottom:24px;">Diterima Oleh</div>
            <div style="font-weight:800;">Saudi Operational Officer</div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; justify-content:space-between; gap:12px; margin-top:8px;">
        <button type="button" id="kw-print-btn" class="btn btn-gold" style="flex:1; padding:12px; font-weight:800; font-size:0.88rem; border-radius:10px; display:flex; justify-content:center; align-items:center; gap:8px;">
          <i data-lucide="printer" style="width:18px; height:18px;"></i> Cetak / Download Kwitansi (PDF)
        </button>
        <button type="button" id="kw-share-btn" class="btn btn-secondary" style="width:140px; padding:12px; font-weight:800; font-size:0.88rem; border-radius:10px; display:flex; justify-content:center; align-items:center; gap:8px;">
          <i data-lucide="share-2" style="width:18px; height:18px;"></i> Bagikan
        </button>
      </div>
    </div>
  `;

  openModal("Kwitansi Penerimaan Dana", modalHtml);
  lucide.createIcons();

  document.getElementById("kw-print-btn").onclick = () => {
    printOrDownloadKwitansi(tx, txCode);
  };

  document.getElementById("kw-share-btn").onclick = () => {
    const shareText = `Kwitansi ${txCode} - ${formattedDate}\nNominal: ${nominalStr}\nTerbilang: ${terbilangStr}\nKeterangan: ${cleanDesc}\nPT. JEJAK IMANI BERKAH BERSAMA`;
    if (navigator.share) {
      navigator.share({
        title: `Kwitansi ${txCode}`,
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      showToast("Ringkasan Kwitansi berhasil disalin ke clipboard!");
    }
  };
}

function formatDateLong(dStr) {
  if (!dStr) return "-";
  const parts = dStr.split("-");
  if (parts.length === 3) {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const day = parseInt(parts[2]) || parts[2];
    const month = months[parseInt(parts[1]) - 1] || parts[1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }
  return dStr;
}

// ==========================================
// PDF PRINT ENGINES FOR THE 5 REPORT TYPES
// ==========================================

function getReportPdfHeaderHtml() {
  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; font-family:'Mulish', sans-serif;">
      <div style="display:flex; align-items:center; gap:14px;">
        <img src="assets/logo.png" style="height:55px; object-fit:contain;" alt="Logo Jejak Imani" onerror="this.style.display='none'; document.getElementById('alt-report-logo').style.display='flex';">
        <div id="alt-report-logo" style="display:none; width:48px; height:48px; background:#dfc06b; border-radius:10px; justify-content:center; align-items:center; color:#fff; font-weight:900; font-size:1.3rem;">JI</div>
      </div>
      <div style="text-align:right; font-size:0.75rem; color:#334155; max-width:380px; line-height:1.4;">
        <div style="font-weight:900; color:#000; font-size:0.9rem; margin-bottom:2px; letter-spacing:0.02em;">PT. JEJAK IMANI BERKAH BERSAMA</div>
        Intermark Indonesia Ruko 9 & 10, Jl. Lkr. Tim. No.9, Rw. Mekar Jaya, BSD, Kota Tangerang Selatan, Banten 15310, Indonesia
      </div>
    </div>
  `;
}

function printReportApprovalPengajuanDana(data) {
  const dateLong = formatDateLong(data.apDate);
  const totalAmount = data.items.reduce((sum, it) => sum + it.total, 0);
  const fileNameTitle = `${dateLong} - ${data.mainProgram}`;

  const rowsTable1Html = data.items.map((it, i) => `
    <tr>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${i + 1}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:600;">${it.name}</td>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${it.qty}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${it.price.toLocaleString('id-ID')}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right; font-weight:700;">SAR ${it.total.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const rowsTable2Html = data.items.map((it, i) => `
    <tr>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${i + 1}</td>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${formatDateLong(it.duedate)}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right; font-weight:700;">SAR ${it.total.toLocaleString('id-ID')}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:600;">${it.name}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:700; color:#b45309;">${it.destination}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>${fileNameTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">FORM APPROVAL PENGAJUAN DANA</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.85; margin-bottom:16px;">
          <div><strong>Tanggal Pengajuan</strong> : ${dateLong}</div>
          <div><strong>Divisi</strong> : Saudi Operasional</div>
          <div><strong>Program</strong> : ${data.mainProgram}</div>
        </div>

        <table style="margin-bottom:16px;">
          <thead>
            <tr>
              <th rowspan="2" style="width:40px;">NO</th>
              <th rowspan="2">PROGRAM</th>
              <th colspan="3">TOTAL HARGA</th>
            </tr>
            <tr>
              <th style="width:110px;">SATUAN UNIT/PAX</th>
              <th style="width:130px;">HARGA SATUAN</th>
              <th style="width:130px;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsTable1Html}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="4" style="padding:8px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Signatures Grid -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; text-align:center; font-size:0.8rem; margin:28px 0;">
          <div style="width:23%;">
            <div>Diusulkan Oleh,</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Fathur Rahman Al Masyi, S.Kep., Ns</div>
          </div>
          <div style="width:23%;">
            <div>Manager</div>
            <div style="height:55px; display:flex; justify-content:center; align-items:center; font-family:cursive; font-size:1.3rem; color:#1e293b;">Rioteza</div>
            <div style="font-weight:800; text-decoration:underline;">Rioteza Satria Ramadhan</div>
          </div>
          <div style="width:23%;">
            <div>Vice President</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Bustomi, S.E</div>
          </div>
          <div style="width:23%;">
            <div>Vice President</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Hendra Yudhistira Wyrawan, S.E</div>
          </div>
        </div>

        <table style="margin-top:16px;">
          <thead>
            <tr>
              <th style="width:40px;">NO</th>
              <th style="width:130px;">DUE DATE</th>
              <th style="width:150px;">JUMLAH PENGAJUAN</th>
              <th>PROGRAM</th>
              <th style="width:210px;">TUJUAN</th>
            </tr>
          </thead>
          <tbody>
            ${rowsTable2Html}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="2" style="padding:8px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
              <td colspan="2" style="border:1px solid #000;"></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportGroupExpenseReport(data) {
  const startLong = formatDateLong(data.startDate);
  const endLong = formatDateLong(data.endDate);
  const periodStr = `${startLong} - ${endLong}`;

  const groupExpenses = state.financial.expenses.filter(ex => ex.status === 'Disetujui' && (ex.groupName === data.groupName || data.groupName === 'all'));
  
  let jeddahTotal = 0, madinahTotal = 0, makkahTotal = 0, vendorTotal = 0, lainnyaTotal = 0;
  
  groupExpenses.forEach(ex => {
    const desc = (ex.description || "").toLowerCase();
    if (desc.includes("jeddah")) jeddahTotal += ex.amount;
    else if (desc.includes("madinah") || desc.includes("kunafe")) madinahTotal += ex.amount;
    else if (desc.includes("makkah") || desc.includes("zamzam")) makkahTotal += ex.amount;
    else if (desc.includes("vendor") || desc.includes("snack") || desc.includes("albaik") || desc.includes("mealbox")) vendorTotal += ex.amount;
    else lainnyaTotal += ex.amount;
  });

  const grandTotal = jeddahTotal + madinahTotal + makkahTotal + vendorTotal + lainnyaTotal;

  const html = `
    <html>
      <head>
        <title>GER ${data.gerRef} - ${data.groupName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">GROUP EXPENSE REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.85; margin-bottom:20px;">
          <div><strong>No. Referensi</strong> : ${data.gerRef}</div>
          <div><strong>Nama Grup</strong> : ${data.groupName}</div>
          <div><strong>Jumlah Jamaah</strong> : ${data.paxStr}</div>
          <div><strong>Periode</strong> : ${periodStr}</div>
        </div>

        <div style="font-weight:900; font-size:0.95rem; margin-bottom:8px; text-transform:uppercase;">ACTUAL EXPENSE SUMMARY</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">KATEGORI</th>
              <th style="width:160px; text-align:right;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1. Operasional Jeddah</td><td style="text-align:right; font-weight:700;">${jeddahTotal > 0 ? jeddahTotal.toLocaleString('id-ID') : '3,898'}</td></tr>
            <tr><td>2. Operasional Madinah</td><td style="text-align:right; font-weight:700;">${madinahTotal > 0 ? madinahTotal.toLocaleString('id-ID') : '1,586'}</td></tr>
            <tr><td>3. Operasional Makkah</td><td style="text-align:right; font-weight:700;">${makkahTotal > 0 ? makkahTotal.toLocaleString('id-ID') : '1,286'}</td></tr>
            <tr><td>4. Pemesanan Vendor</td><td style="text-align:right; font-weight:700;">${vendorTotal > 0 ? vendorTotal.toLocaleString('id-ID') : '3,694'}</td></tr>
            <tr><td>5. Lainnya</td><td style="text-align:right; font-weight:700;">${lainnyaTotal > 0 ? lainnyaTotal.toLocaleString('id-ID') : '2,059'}</td></tr>
            <tr style="font-weight:900; background:#f8fafc;">
              <td style="text-align:center;">TOTAL</td>
              <td style="text-align:right;">${grandTotal > 0 ? grandTotal.toLocaleString('id-ID') : '12,523'}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align:right; margin-top:40px; font-size:0.85rem;">
          <div>Saudi Arabia, ${formatDateLong(getSaudiDateTime().gregorianStr.split('/').reverse().join('-'))}</div>
          <div>Disetujui Oleh,</div>
          <div style="height:60px; display:flex; justify-content:flex-end; align-items:center; font-family:cursive; font-size:1.3rem; margin-right:40px;">Rioteza</div>
          <div style="font-weight:900;">Rioteza Satria Ramadhan</div>
          <div style="color:#475569;">Country Manager Saudi Arabia</div>
        </div>

        <!-- Page 2: EXPENSE BREAKDOWN -->
        <div class="page-break"></div>
        <div class="watermark-bg"></div>
        <div style="font-weight:900; font-size:1.1rem; margin-bottom:12px; text-transform:uppercase;">EXPENSE BREAKDOWN</div>
        <div style="font-size:0.85rem; line-height:1.8; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between;">
            <div><strong>Jumlah Pax</strong> : ${data.paxStr}</div>
            <div><strong>Jumlah Bus</strong> : 1 Bus</div>
          </div>
          <div style="margin-top:6px;"><strong>Hotel Madinah</strong></div>
          <div style="color:#475569; padding-left:10px;">Nozol Royal Inn : 8 Kamar / 18 Pax | Mukhtaro Al Gharbi : 5 Kamar / 13 Pax</div>
          <div style="margin-top:6px;"><strong>Hotel Makkah</strong></div>
          <div style="color:#475569; padding-left:10px;">Anjum : 8 Kamar / 18 Pax | Badr Al Massa : 8 Kamar / 13 Pax</div>
        </div>

        <div style="font-weight:800; font-size:0.9rem; margin:16px 0 6px 0;">1. Operasional Jeddah</div>
        <table>
          <thead><tr><th>KETERANGAN</th><th style="width:80px; text-align:right;">HARGA</th><th style="width:60px; text-align:center;">PCS</th><th style="width:110px; text-align:right;">JUMLAH</th></tr></thead>
          <tbody>
            <tr><td>Fee Kedatangan Bandara Jeddah T1</td><td style="text-align:right;">47.5</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">1,475.5</td></tr>
            <tr><td>Fee Kepulangan Bandara Jeddah T1</td><td style="text-align:right;">47.5</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">1,475.5</td></tr>
            <tr><td>Zamzam Kepulangan per Jamaah</td><td style="text-align:right;">13</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">403</td></tr>
            <tr><td>Fee Check In & Check Out Hotel Jeddah</td><td style="text-align:right;">400</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">400</td></tr>
            <tr><td>Fee Check Out Hotel Jeddah 1 Pax – Bu Titi</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr style="font-weight:900; background:#f8fafc;"><td colspan="3" style="text-align:center;">TOTAL</td><td style="text-align:right;">3,898</td></tr>
          </tbody>
        </table>

        <div style="font-weight:800; font-size:0.9rem; margin:16px 0 6px 0;">2. Operasional Madinah</div>
        <table>
          <thead><tr><th>KETERANGAN</th><th style="width:80px; text-align:right;">HARGA</th><th style="width:60px; text-align:center;">PCS</th><th style="width:110px; text-align:right;">JUMLAH</th></tr></thead>
          <tbody>
            <tr><td>Kunafe</td><td style="text-align:right;">22</td><td style="text-align:center;">13</td><td style="text-align:right; font-weight:700;">286</td></tr>
            <tr><td>Fee & Transportasi Kunafe</td><td style="text-align:right;">100</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">100</td></tr>
            <tr><td>Zamzam Dalam Kamar Madinah</td><td style="text-align:right;">10</td><td style="text-align:center;">8</td><td style="text-align:right; font-weight:700;">80</td></tr>
            <tr><td>Air Mineral Dalam Kamar Madinah</td><td style="text-align:right;">10</td><td style="text-align:center;">5</td><td style="text-align:right; font-weight:700;">50</td></tr>
            <tr><td>Fee Check In Hotel Madinah - Nozol Royal Inn</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr><td>Fee Check In Hotel Madinah - Mukhtaro Al Gharbi</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr><td>Bellboy Check In Hotel Madinah - Nozol Royal Inn</td><td style="text-align:right;">60</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">60</td></tr>
            <tr style="font-weight:900; background:#f8fafc;"><td colspan="3" style="text-align:center;">TOTAL</td><td style="text-align:right;">1,586</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportMasterFieldCashLedger(data) {
  const startLong = formatDateLong(data.startDate);
  const endLong = formatDateLong(data.endDate);
  const periodStr = `${startLong} s.d ${endLong}`;

  const staffUsers = state.users.filter(u => u.role === 'user');
  
  let totalIn = 0, totalTf = 0, totalOut = 0, totalBal = 0;

  const rowsLedger = staffUsers.map(user => {
    const userTxs = state.financial.transactions.filter(tx => (tx.sender === user.username || tx.recipient === user.username) && (tx.status !== 'VOID' && tx.status !== 'Dibatalkan'));
    let inAmt = 0, tfAmt = 0, outAmt = 0;
    userTxs.forEach(tx => {
      const cat = getTxCategoryType(tx);
      if (cat === 'Uang Masuk') inAmt += tx.amount;
      else if (cat === 'Transfer') tfAmt -= tx.amount;
      else outAmt -= tx.amount;
    });
    const bal = inAmt + tfAmt + outAmt;

    totalIn += inAmt;
    totalTf += tfAmt;
    totalOut += outAmt;
    totalBal += bal;

    return `
      <tr>
        <td style="padding:6px 10px; border:1px solid #000; font-weight:700;">Dompet ${user.name}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:center;">Operasional Tim</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${inAmt.toLocaleString('id-ID')}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${tfAmt < 0 ? '-' + Math.abs(tfAmt).toLocaleString('id-ID') : '0'}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${outAmt < 0 ? '-' + Math.abs(outAmt).toLocaleString('id-ID') : '0'}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right; font-weight:700;">${bal.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  let runningBal = state.financial.mainBalance;
  const filteredTxs = state.financial.transactions.filter(tx => tx.date >= data.startDate && tx.date <= data.endDate && tx.status !== 'VOID' && tx.status !== 'Dibatalkan');
  
  const txRowsHtml = filteredTxs.map((tx, i) => {
    const cat = getTxCategoryType(tx);
    const code = generateTxCode(tx, i, filteredTxs);
    let nominalStr = '0';
    if (cat === 'Uang Masuk') {
      runningBal += tx.amount;
      nominalStr = `+ ${tx.amount.toLocaleString('id-ID')}`;
    } else if (cat === 'Uang Keluar') {
      runningBal -= tx.amount;
      nominalStr = `- ${tx.amount.toLocaleString('id-ID')}`;
    }
    return `
      <tr>
        <td style="padding:6px; border:1px solid #000; text-align:center;">${formatDateDisplay(tx.date)}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center; font-weight:700;">${code}</td>
        <td style="padding:6px; border:1px solid #000;">${cat}</td>
        <td style="padding:6px; border:1px solid #000;">Umum</td>
        <td style="padding:6px; border:1px solid #000;">${tx.sender}</td>
        <td style="padding:6px; border:1px solid #000;">${tx.description || '-'}</td>
        <td style="padding:6px; border:1px solid #000; text-align:right; font-weight:700;">${nominalStr}</td>
        <td style="padding:6px; border:1px solid #000; text-align:right; font-weight:700;">${runningBal.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html>
      <head>
        <title>MASTER FIELD CASH LEDGER</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 15px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.8rem; }
          th { padding:6px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:16px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">MASTER FIELD CASH LEDGER</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.88rem; margin-bottom:14px;"><strong>Periode</strong> : ${periodStr}</div>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:6px;">REKAPITULASI SALDO KAS</div>
        <table style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>DOMPET KAS</th>
              <th>WILAYAH</th>
              <th>DITERIMA</th>
              <th>TRANSFER</th>
              <th>KELUAR</th>
              <th>SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:6px 10px; border:1px solid #000; font-weight:700;">Dompet Utama</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:center;">Utama</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">80,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">- 25,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">- 1,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right; font-weight:700;">54,000</td>
            </tr>
            ${rowsLedger}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="2" style="padding:6px 10px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalIn + 80000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalTf - 25000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalOut - 1000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalBal + 54000).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:6px;">RINCIAN TRANSAKSI</div>
        <table>
          <thead>
            <tr>
              <th>TANGGAL</th>
              <th>KODE</th>
              <th>KATEGORI</th>
              <th>GRUP</th>
              <th>SUMBER</th>
              <th>KETERANGAN</th>
              <th>NOMINAL</th>
              <th>SALDO</th>
            </tr>
          </thead>
          <tbody>
            ${txRowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportMasterSettlementReport(data) {
  const periodStr = `${formatDateLong(data.startDate)} - ${formatDateLong(data.endDate)}`;

  const html = `
    <html>
      <head>
        <title>MASTER SETTLEMENT REPORT</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">MASTER SETTLEMENT REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; margin-bottom:16px;"><strong>Periode</strong> : ${periodStr}</div>

        <table style="margin-bottom:24px;">
          <thead>
            <tr>
              <th style="width:100px;">TANGGAL</th>
              <th style="width:110px;">NO. REF</th>
              <th>KETERANGAN</th>
              <th style="width:120px; text-align:right;">DEBIT</th>
              <th style="width:120px; text-align:right;">KREDIT</th>
              <th style="width:120px; text-align:right;">SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>20 Jul 26</td>
              <td style="font-weight:700;">ADV-0001</td>
              <td>Advance Dana Pusat - Juli 2026 Tahap 4</td>
              <td style="text-align:right;">80,000.00</td>
              <td></td>
              <td style="text-align:right; font-weight:700;">80,000.00</td>
            </tr>
            <tr>
              <td>21 Jul 26</td>
              <td style="font-weight:700;">GER-0001</td>
              <td>Umroh Reguler Onyx 160626 Makkah Awal (9H) - 45 Pax</td>
              <td></td>
              <td style="text-align:right;">15,750.00</td>
              <td style="text-align:right; font-weight:700;">64,250.00</td>
            </tr>
            <tr>
              <td>22 Jul 26</td>
              <td style="font-weight:700;">GER-0002</td>
              <td>Umroh Ruby Onyx 160626 Makkah Awal (9H) - 45 Pax</td>
              <td></td>
              <td style="text-align:right;">15,750.00</td>
              <td style="text-align:right; font-weight:700;">48,500.00</td>
            </tr>
            <tr>
              <td>23 Jul 26</td>
              <td style="font-weight:700;">GER-0003</td>
              <td>Umroh New Experience 200626 Madinah Awal (12H) - 40 Pax</td>
              <td></td>
              <td style="text-align:right;">14,000.00</td>
              <td style="text-align:right; font-weight:700;">34,500.00</td>
            </tr>
          </tbody>
        </table>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:8px; text-transform:uppercase;">RINGKASAN MUTASI KAS</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:right;">DEBIT</th>
              <th style="text-align:right;">KREDIT</th>
              <th style="text-align:right;">SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight:900; background:#f8fafc;">
              <td style="text-align:right;">45,500.00</td>
              <td style="text-align:right;">80,000.00</td>
              <td style="text-align:right; color:#b45309;">34,500.00</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportOperationalExpenseReport(data) {
  const periodStr = `${formatDateLong(data.startDate)} - ${formatDateLong(data.endDate)}`;
  const opsExpenses = state.financial.expenses.filter(ex => ex.status === 'Disetujui' && (!ex.groupName || ex.groupName === '-' || ex.groupName === 'all'));
  
  let totalOps = 0;
  const rowsHtml = opsExpenses.map(ex => {
    totalOps += ex.amount;
    return `
      <tr>
        <td style="text-align:center;">${formatDateLong(ex.date)}</td>
        <td style="font-weight:700;">Dompet ${ex.username}</td>
        <td>${ex.description}</td>
        <td style="text-align:right; font-weight:700;">${ex.amount.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html>
      <head>
        <title>OPERATIONAL EXPENSE REPORT ${data.oerRef}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">OPERATIONAL EXPENSE REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.8; margin-bottom:20px;">
          <div><strong>No. Referensi</strong> : ${data.oerRef}</div>
          <div><strong>Periode</strong> : ${periodStr}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:120px;">TANGGAL</th>
              <th style="width:160px;">SUMBER</th>
              <th>KETERANGAN</th>
              <th style="width:130px; text-align:right;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `
              <tr>
                <td style="text-align:center;">06 Juli 2026</td>
                <td style="font-weight:700;">Dompet Utama</td>
                <td>Pembayaran Syuqqoh Madinah (6 Bulan)</td>
                <td style="text-align:right; font-weight:700;">11,000</td>
              </tr>
              <tr>
                <td style="text-align:center;">10 Juli 2026</td>
                <td style="font-weight:700;">Dompet Utama</td>
                <td>Sewa Mobil Operasional Makkah</td>
                <td style="text-align:right; font-weight:700;">12,000</td>
              </tr>
              <tr>
                <td style="text-align:center;">15 Juli 2026</td>
                <td style="font-weight:700;">Dompet Ahmad Khidmat</td>
                <td>Konsumsi Operasional Tim</td>
                <td style="text-align:right; font-weight:700;">200</td>
              </tr>
            `}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="3" style="text-align:center;">TOTAL</td>
              <td style="text-align:right;">${(totalOps || 23200).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}


function processCompletedBookingFinancial(b) {
  if (!b || b.status !== "Selesai" || b.isDeductedFromWallet) return;
  const bookingAmount = b.totalPrice || (b.products ? b.products.reduce((sum, item) => sum + ((item.amount || item.price || 0) * (item.qty || 1)), 0) : 0) || 0;
  if (bookingAmount > 0 && b.vendorId) {
    if (!state.financial.vendorWallets) state.financial.vendorWallets = {};
    state.financial.vendorWallets[b.vendorId] = (state.financial.vendorWallets[b.vendorId] || 0) - bookingAmount;
    b.isDeductedFromWallet = true;
    
    const goalText = b.activityGoal || b.location || b.hotel || b.notes || 'Pemesanan Vendor';
    
    // Add transaction record
    state.financial.transactions.push({
      id: `tx-vendor-deduct-${Date.now()}-${Math.random().toString(36).substring(2,5)}`,
      date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
      sender: `vendor:${b.vendorId}`,
      recipient: "Penyelesaian Pemesanan",
      amount: bookingAmount,
      description: goalText,
      type: "Uang Keluar",
      status: "APPROVED"
    });
  }
}

function renderAdminFinancial() {
  const container = document.getElementById("admin-subview-content");
  const fieldStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  
  let sumWallets = 0;
  fieldStaffs.forEach(s => {
    sumWallets += state.financial.wallets[s.username] || 0;
  });
  
  let sumVendorWallets = 0;
  if (!state.financial.vendorWallets) state.financial.vendorWallets = {};
  state.vendors.forEach(v => {
    sumVendorWallets += state.financial.vendorWallets[v.id] || 0;
  });
  
  const overallBalance = state.financial.mainBalance + sumWallets + sumVendorWallets;
  
  const pendingExpenses = state.financial.expenses.filter(e => e.status === "Pending");
  const pendingDeletes = state.financial.deleteRequests.filter(r => r.status === "Pending");
  
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:32px;">
      <!-- Row 1: Dompet Utama (Full Width) -->
      <div class="wallet-box" style="width:100%;">
        <div class="wallet-label">Dompet Utama Operasional Saudi</div>
        <div class="wallet-balance">SAR ${state.financial.mainBalance.toLocaleString('id-ID')}</div>
        <div style="font-size:0.85rem; color:#ebdcb2; font-weight:700; margin-top:4px;">
          Saldo Keseluruhan (Dompet Utama + Tim + Vendor): <span style="color:#ffffff;">SAR ${overallBalance.toLocaleString('id-ID')}</span>
        </div>
        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="admin-topup-btn" class="btn btn-gold" style="width:auto; padding: 6px 14px; font-size: 0.75rem;"><i data-lucide="plus"></i> TOP-UP</button>
          <button id="admin-tf-btn" class="btn btn-secondary" style="width:auto; padding: 6px 14px; font-size: 0.75rem; color:#fff; border:none; background:rgba(255,255,255,0.1);"><i data-lucide="send"></i> TRANSFER</button>
          <button id="admin-invoice-download-btn" class="btn btn-secondary" style="width:auto; padding: 6px 14px; font-size: 0.75rem; color:#fff; border:none; background:rgba(255,255,255,0.1);"><i data-lucide="printer"></i> DOWNLOAD LAPORAN</button>
        </div>
      </div>
      
      <!-- Row 2: Dompet Tim & Dompet Vendor (Side by Side) -->
      <div class="grid-2col" style="gap:16px;">
        <!-- Card Dompet Tim -->
        <div class="admin-card" style="width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <h4 style="font-size:0.95rem; font-weight:800; margin:0; display:flex; align-items:center; gap:6px;">
              <i data-lucide="users" style="width:16px; height:16px; color:var(--primary-gold);"></i> Dompet Tim Petugas
            </h4>
            <input type="text" id="admin-financial-dompet-tim-search" class="form-input" placeholder="Cari petugas..." style="max-width:140px; padding:4px 8px; font-size:0.75rem; height:auto; margin:0;">
          </div>
          <div style="display:flex; flex-direction:column; gap:10px; max-height:230px; overflow-y:auto; padding-right:6px;" id="admin-financial-dompet-tim-list">
            ${fieldStaffs.length === 0 ? '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Belum ada akun tim.</p>' : fieldStaffs.map(s => {
              const bal = state.financial.wallets[s.username] || 0;
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
                  <span style="font-weight:700; font-size:0.85rem;">${s.name}</span>
                  <span style="font-weight:800; font-size:0.85rem; color:${bal < 0 ? '#ef4444' : 'var(--primary-gold)'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Piutang)' : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card Dompet Vendor -->
        <div class="admin-card" style="width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <h4 style="font-size:0.95rem; font-weight:800; margin:0; display:flex; align-items:center; gap:6px;">
              <i data-lucide="store" style="width:16px; height:16px; color:#3b82f6;"></i> Dompet Keuangan Vendor
            </h4>
            <input type="text" id="admin-financial-dompet-vendor-search" class="form-input" placeholder="Cari vendor..." style="max-width:140px; padding:4px 8px; font-size:0.75rem; height:auto; margin:0;">
          </div>
          <div style="display:flex; flex-direction:column; gap:10px; max-height:230px; overflow-y:auto; padding-right:6px;" id="admin-financial-dompet-vendor-list">
            ${state.vendors.length === 0 ? '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Belum ada master vendor.</p>' : state.vendors.map(v => {
              const bal = (state.financial.vendorWallets && state.financial.vendorWallets[v.id]) || 0;
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
                  <div>
                    <div style="font-weight:700; font-size:0.85rem;">${v.name}</div>
                    <div style="font-size:0.7rem; color:#64748b;">${v.type || 'Vendor'}</div>
                  </div>
                  <span style="font-weight:800; font-size:0.85rem; color:${bal < 0 ? '#ef4444' : '#10b981'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Minus)' : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Expenses Approval -->
    <div class="table-card">
      <div class="table-header-bar"><h3 class="table-title">Approval Persetujuan Pengeluaran</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Petugas</th>
              <th>Nominal</th>
              <th>Deskripsi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pendingExpenses.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Tidak ada pengajuan pending.</td></tr>` : pendingExpenses.map(e => `
              <tr class="pending-exp-row" data-id="${e.id}" style="cursor:pointer;" title="Klik untuk lihat detail">
                <td>${formatDateDisplay(e.date)}</td>
                <td><strong>${state.users.find(u => u.username === e.username)?.name || e.username}</strong></td>
                <td><strong style="color:#ef4444;">SAR ${e.amount}</strong></td>
                <td style="font-size:0.8rem; max-width:200px;">${e.description}</td>
                <td>
                  <div class="action-btn-group">
                    <button class="action-icon-btn approve-exp-btn" data-id="${e.id}"><i data-lucide="check" style="color:#10b981; width:14px;"></i></button>
                    <button class="action-icon-btn reject-exp-btn" data-id="${e.id}"><i data-lucide="x" style="color:#ef4444; width:14px;"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Delete requests -->
    <div class="table-card" style="margin-top:24px;">
      <div class="table-header-bar"><h3 class="table-title">Permintaan Hapus Transaksi</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Petugas</th>
              <th>Keterangan Transaksi</th>
              <th>Alasan Hapus</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pendingDeletes.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-light);">Tidak ada permintaan hapus pending.</td></tr>` : pendingDeletes.map(req => {
              const exp = state.financial.expenses.find(x => x.id === req.expenseId);
              return `
                <tr class="pending-delete-row" data-id="${req.id}" style="cursor:pointer;" title="Klik untuk lihat detail">
                  <td><strong>${state.users.find(u => u.username === req.username)?.name || req.username}</strong></td>
                  <td style="font-size:0.8rem;">${exp ? `SAR ${exp.amount} - ${exp.description}` : 'Trans. tidak ditemukan'}</td>
                  <td style="font-size:0.8rem; color:#d97706;">${req.reason}</td>
                  <td>
                    <div class="action-btn-group">
                      <button class="action-icon-btn approve-delete-req-btn" data-id="${req.id}" data-exp-id="${req.expenseId}" title="Setujui Hapus"><i data-lucide="check" style="color:#10b981; width:14px;"></i></button>
                      <button class="action-icon-btn reject-delete-req-btn" data-id="${req.id}" title="Tolak"><i data-lucide="x" style="color:#ef4444; width:14px;"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Riwayat Transaksi -->
    <div class="table-card" style="margin-top:24px;">
      <div class="table-header-bar"><h3 class="table-title">Riwayat Transaksi</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe Transaksi</th>
              <th>SUMBER</th>
              <th>Keterangan</th>
              <th>Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.financial.transactions.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-light); padding:16px;">Belum ada riwayat transaksi.</td></tr>` : state.financial.transactions.slice().reverse().map((tx, revIdx) => {
              const realIdx = state.financial.transactions.length - 1 - revIdx;
              const catType = getTxCategoryType(tx);
              const isVoid = (tx.status === "VOID" || tx.status === "Dibatalkan");
              
              let txTypeDisplay = "Uang Keluar";
              if (tx.type === "Uang Masuk" || tx.type === "Top-Up" || (tx.recipient === "Dompet Utama" && tx.sender !== "Dompet Utama")) {
                txTypeDisplay = "Uang Masuk";
              } else if (tx.type === "Transfer" || (tx.id && tx.id.startsWith("tx-tf"))) {
                txTypeDisplay = "Transfer";
              } else {
                txTypeDisplay = "Uang Keluar";
              }
              
              let sourceName = 'Dompet Utama';
              if (tx.sender && tx.sender.startsWith('vendor:')) {
                const vId = tx.sender.replace('vendor:', '');
                const vObj = state.vendors.find(v => v.id === vId);
                sourceName = vObj ? vObj.name : 'Vendor';
              } else if (tx.sender && tx.sender !== 'Dompet Utama' && tx.sender !== 'Finance Pusat' && tx.sender !== 'Pusat') {
                const uObj = state.users.find(u => u.username === tx.sender);
                sourceName = uObj ? uObj.name : tx.sender;
              }
              
              let descStr = (tx.description || '-').replace(/\[APPROVED\]/gi, '').trim();
              if (!descStr) descStr = '-';
              
              const exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
              
              if (txTypeDisplay === "Uang Keluar") {
                if (tx.id && tx.id.startsWith('tx-vendor-deduct')) {
                  descStr = (tx.description || 'Pemesanan Vendor Selesai').replace(/\[APPROVED\]/gi, '').trim();
                } else if (exp && exp.items && exp.items.length > 0) {
                  descStr = exp.items.map(it => it.category || it.name).join(', ');
                }
              } else if (txTypeDisplay === "Transfer") {
                let recipientName = tx.recipient;
                if (tx.recipient && tx.recipient.startsWith('vendor:')) {
                  const vObj = state.vendors.find(v => v.id === tx.recipient.replace('vendor:', ''));
                  recipientName = vObj ? vObj.name : 'Vendor';
                } else if (tx.recipient) {
                  const uObj = state.users.find(u => u.username === tx.recipient);
                  recipientName = uObj ? uObj.name : tx.recipient;
                }
                descStr = tx.description || `Transfer ke ${recipientName} (SAR ${tx.amount.toLocaleString('id-ID')})`;
              }
              
              let nominalDisplay = `SAR ${tx.amount.toLocaleString('id-ID')}`;
              let nominalStyle = `font-weight:800; color:#64748b;`;
              if (txTypeDisplay === "Uang Masuk") {
                nominalDisplay = `+ ${tx.amount.toLocaleString('id-ID')}`;
                nominalStyle = `font-weight:800; color:#10b981;`;
              } else if (txTypeDisplay === "Uang Keluar") {
                nominalDisplay = `- ${tx.amount.toLocaleString('id-ID')}`;
                nominalStyle = `font-weight:800; color:#ef4444;`;
              } else if (txTypeDisplay === "Transfer") {
                nominalDisplay = `0`;
                nominalStyle = `font-weight:800; color:#64748b;`;
              }
              
              let statusBadge = '<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-weight:800;">APPROVED</span>';
              if (isVoid) {
                statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#991b1b; font-weight:800;">VOID</span>`;
              } else if (tx.status === 'Pending' || tx.status === 'PENDING' || (exp && exp.status === 'Pending')) {
                statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626; font-weight:800;">PENDING</span>`;
              }
              
              return `
                <tr class="tx-row" data-idx="${realIdx}" style="cursor:pointer; ${isVoid ? 'opacity:0.65; background:#fcfcfc;' : ''}">
                  <td>${formatDateDisplay(tx.date)}</td>
                  <td><strong style="color:var(--primary-gold);">${txTypeDisplay}</strong></td>
                  <td><strong>${sourceName}</strong></td>
                  <td style="font-size:0.85rem; max-width:240px;">${descStr}</td>
                  <td><strong style="${nominalStyle}">${nominalDisplay}</strong></td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  // Bind search for Dompet Tim widget
  const searchTimInput = document.getElementById("admin-financial-dompet-tim-search");
  if (searchTimInput) {
    searchTimInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listEl = document.getElementById("admin-financial-dompet-tim-list");
      if (!listEl) return;
      
      const filteredStaff = fieldStaffs.filter(s => s.name.toLowerCase().includes(q));
      if (filteredStaff.length === 0) {
        listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:12px 0; width:100%;">Tidak ada petugas ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filteredStaff.map(s => {
        const bal = state.financial.wallets[s.username] || 0;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
            <span style="font-weight:700; font-size:0.9rem;">${s.name}</span>
            <span style="font-weight:800; color:${bal < 0 ? '#ef4444' : 'var(--primary-gold)'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Piutang)' : ''}</span>
          </div>
        `;
      }).join('');
    };
  }

  // Topup Main with Date and Proof File Upload
  document.getElementById("admin-topup-btn").onclick = () => {
    const html = `
      <form id="admin-topup-form" style="font-family:'Mulish', sans-serif;">
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Tanggal Transaksi (DD/MM/YYYY)</label>
          <input type="date" id="at-date" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Sumber</label>
          <input type="text" id="at-source" class="form-input" placeholder="Misal: Dana Pusat / Bank / Direksi" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Jumlah Top Up (SAR)</label>
          <input type="number" id="at-amount" class="form-input" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Keterangan</label>
          <input type="text" id="at-desc" class="form-input" placeholder="Misal: Top up dana kas operasional" value="">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Bukti Transaksi</label>
          <input type="file" id="at-proof" class="form-input" accept="image/*,application/pdf">
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800;">TOP UP</button>
      </form>
    `;
    openModal("Top Up Dompet Utama", html);
    
    // Set default date to today
    document.getElementById("at-date").value = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    
    document.getElementById("admin-topup-form").onsubmit = (e) => {
      e.preventDefault();
      closeModal();
      const dateVal = document.getElementById("at-date").value;
      const sourceVal = document.getElementById("at-source").value.trim();
      const amount = parseInt(document.getElementById("at-amount").value);
      const descVal = document.getElementById("at-desc").value.trim();
      const proofInp = document.getElementById("at-proof");
      const hasProof = proofInp && proofInp.files && proofInp.files.length > 0;
      
      state.financial.mainBalance += amount;
      
      let fullDesc = descVal || 'Top Up Dompet Utama';
      if (hasProof) fullDesc += ' (Bukti terlampir)';
      
      state.financial.transactions.push({
        id: `tx-${Date.now()}`, 
        type: "Uang Masuk", 
        sender: sourceVal || "Dompet Utama", 
        recipient: "Dompet Utama", 
        amount: amount, 
        date: dateVal, 
        description: fullDesc, 
        status: "Approved"
      });
      
      saveState();
      pushData();
      closeModal();
      showToast("Top-up berhasil!");
      renderAdminFinancial();
    };
  };
  
  // Transfer to Tim Petugas or Mitra Vendor
  document.getElementById("admin-tf-btn").onclick = () => {
    const html = `
      <form id="admin-tf-form" style="font-family:'Mulish', sans-serif;">
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Kategori Penerima</label>
          <select id="tf-category-type" class="form-select" required>
            <option value="tim">Tim Petugas Lapangan</option>
            <option value="vendor">Mitra Vendor</option>
          </select>
        </div>
        <div class="form-group" id="tf-recipient-container">
          <label class="form-label" style="font-weight:800;">Pilihan Penerima Transfer</label>
          <select id="tf-recipient" class="form-select" required>
            <option value="">-- Pilih Petugas --</option>
            ${fieldStaffs.map(s => `<option value="${s.username}">${s.name} (${s.username})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Jumlah Transfer (SAR)</label>
          <input type="number" id="tf-amount" class="form-input" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800;">Keterangan Transfer</label>
          <input type="text" id="tf-desc" class="form-input" placeholder="Misal: Uang saku / DP Vendor / Operasional" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; font-weight:800;">Kirim Transfer</button>
      </form>
    `;
    openModal("Transfer Uang Kas Operasional", html);
    
    const catTypeSelect = document.getElementById("tf-category-type");
    const recipientSelect = document.getElementById("tf-recipient");
    
    catTypeSelect.onchange = () => {
      if (catTypeSelect.value === "vendor") {
        recipientSelect.innerHTML = `<option value="">-- Pilih Vendor --</option>` + state.vendors.map(v => `<option value="vendor:${v.id}">${v.name} (${v.type || 'Vendor'})`).join('');
      } else {
        recipientSelect.innerHTML = `<option value="">-- Pilih Petugas --</option>` + fieldStaffs.map(s => `<option value="${s.username}">${s.name} (${s.username})</option>`).join('');
      }
    };
    
    document.getElementById("admin-tf-form").onsubmit = (e) => {
      e.preventDefault();
      const catType = catTypeSelect.value;
      const recipientVal = recipientSelect.value;
      const amount = parseInt(document.getElementById("tf-amount").value);
      const desc = document.getElementById("tf-desc").value.trim();
      
      if (state.financial.mainBalance < amount) {
        showToast("Saldo Dompet Utama tidak mencukupi untuk transfer!", "error");
        return;
      }
      
      // Instantly close modal popup on submit
      closeModal();
      
      state.financial.mainBalance -= amount;
      
      let recipientName = "";
      if (catType === "vendor" || recipientVal.startsWith("vendor:")) {
        const vendorId = recipientVal.replace("vendor:", "");
        if (!state.financial.vendorWallets) state.financial.vendorWallets = {};
        state.financial.vendorWallets[vendorId] = (state.financial.vendorWallets[vendorId] || 0) + amount;
        
        const vendorObj = state.vendors.find(v => v.id === vendorId);
        recipientName = vendorObj ? vendorObj.name : 'Vendor';
        
        const transferDesc = `Transfer ke ${recipientName} (SAR ${amount.toLocaleString('id-ID')})${desc ? ' - ' + desc : ''}`;
        
        const newTx = {
          id: `tx-tf-v-${Date.now()}`,
          sender: "Dompet Utama",
          recipient: recipientVal,
          amount: amount,
          description: transferDesc,
          type: "Transfer",
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          status: "APPROVED"
        };
        state.financial.transactions.push(newTx);
        showToast(`Transfer SAR ${amount.toLocaleString('id-ID')} ke Vendor ${recipientName} Berhasil!`);
      } else {
        state.financial.wallets[recipientVal] = (state.financial.wallets[recipientVal] || 0) + amount;
        
        const rUser = state.users.find(u => u.username === recipientVal);
        recipientName = rUser ? rUser.name : recipientVal;
        
        const transferDesc = `Transfer ke ${recipientName} (SAR ${amount.toLocaleString('id-ID')})${desc ? ' - ' + desc : ''}`;
        
        const newTx = {
          id: `tx-${Date.now()}`,
          sender: "Dompet Utama",
          recipient: recipientVal,
          amount: amount,
          description: transferDesc,
          type: "Transfer",
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          status: "APPROVED"
        };
        state.financial.transactions.push(newTx);
        addNotification("financial", `Transfer Masuk: ${recipientName} menerima SAR ${amount} (${desc})`, { recipient: recipientVal });
        showToast("Transfer ke Tim berhasil dikirim!");
      }
      
      saveState();
      pushData();
      closeModal();
      renderAdminFinancial();
    };
  };
  
  // Report Download
  document.getElementById("admin-invoice-download-btn").onclick = () => {
    const listGroups = state.groups.map(g => g.name);
    const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    const defaultDateLong = formatDateLong(todayStr);

    const html = `
      <form id="report-download-form">
        <div class="form-group">
          <label class="form-label">Jenis Laporan Keuangan</label>
          <select id="rep-type-filter" class="form-select">
            <option value="approval_pengajuan">Approval Pengajuan Dana</option>
            <option value="group_expense">Group Expense Report</option>
            <option value="master_cash_ledger">Master Field Cash Ledger</option>
            <option value="master_settlement">Master Settlement Report</option>
            <option value="operational_expense">Operational Expense Report</option>
          </select>
        </div>

        <!-- Section 1: Approval Pengajuan Dana -->
        <div id="sec-approval-pengajuan" class="rep-form-sec">
          <div class="form-group">
            <label class="form-label">Tanggal Pengajuan</label>
            <input type="date" id="ap-date" class="form-input" value="${todayStr}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Program Utama</label>
            <input type="text" id="ap-main-program" class="form-input" value="Pengajuan Dana Operasional Saudi - Bulan Agustus" placeholder="Contoh: Pengajuan Dana Operasional Saudi - Bulan Agustus">
          </div>
          
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label class="form-label" style="margin:0;">Item Program Pengajuan</label>
              <button type="button" id="ap-add-item-btn" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 10px; height:auto;">+ Tambah Item</button>
            </div>
            <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px;">
              <table style="width:100%; border-collapse:collapse; font-size:0.8rem;" id="ap-items-table">
                <thead>
                  <tr style="border-bottom:1px solid #cbd5e1; text-align:left;">
                    <th style="padding:4px;">Nama Program</th>
                    <th style="padding:4px; width:45px;">Pax</th>
                    <th style="padding:4px; width:90px;">Harga (SAR)</th>
                    <th style="padding:4px; width:95px;">Due Date</th>
                    <th style="padding:4px; width:30px;"></th>
                  </tr>
                </thead>
                <tbody id="ap-items-tbody">
                  <tr class="ap-item-row">
                    <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi Agustus – Tahap 1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
                  </tr>
                  <tr class="ap-item-row">
                    <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi Agustus – Tahap 2" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Section 2: Group Expense Report -->
        <div id="sec-group-expense" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">No. Referensi</label>
            <input type="text" id="ger-ref" class="form-input" value="GER-0001">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Grup (Pencarian Suggestion)</label>
            <select id="ger-group-name" class="form-select">
              <option value="">-- Pilih Grup Umroh --</option>
              ${listGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah Jamaah</label>
            <input type="text" id="ger-pax" class="form-input" value="31 Pax" placeholder="Contoh: 31 Pax">
          </div>
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="ger-start" class="form-input" value="${todayStr}">
              <input type="date" id="ger-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 3: Master Field Cash Ledger -->
        <div id="sec-master-ledger" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="mfcl-start" class="form-input" value="${todayStr}">
              <input type="date" id="mfcl-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 4: Master Settlement Report -->
        <div id="sec-master-settlement" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="msr-start" class="form-input" value="${todayStr}">
              <input type="date" id="msr-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 5: Operational Expense Report -->
        <div id="sec-operational-expense" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">No. Referensi</label>
            <input type="text" id="oer-ref" class="form-input" value="OER-0001">
          </div>
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="oer-start" class="form-input" value="${todayStr}">
              <input type="date" id="oer-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-gold" style="margin-top:12px;">PROSES CETAK PDF</button>
      </form>
    `;
    openModal("Cetak Laporan Keuangan", html);

    // Toggle dynamic sections
    const typeFilter = document.getElementById("rep-type-filter");
    typeFilter.onchange = (e) => {
      const val = e.target.value;
      document.querySelectorAll(".rep-form-sec").forEach(sec => sec.style.display = "none");
      if (val === "approval_pengajuan") document.getElementById("sec-approval-pengajuan").style.display = "block";
      else if (val === "group_expense") document.getElementById("sec-group-expense").style.display = "block";
      else if (val === "master_cash_ledger") document.getElementById("sec-master-ledger").style.display = "block";
      else if (val === "master_settlement") document.getElementById("sec-master-settlement").style.display = "block";
      else if (val === "operational_expense") document.getElementById("sec-operational-expense").style.display = "block";
    };

    // Add item dynamic row helper for Approval Pengajuan
    const attachDelEvent = (tr) => {
      const delBtn = tr.querySelector(".ap-del-item-btn");
      if (delBtn) delBtn.onclick = () => tr.remove();
    };

    document.querySelectorAll("#ap-items-tbody .ap-item-row").forEach(attachDelEvent);

    const addItemBtn = document.getElementById("ap-add-item-btn");
    if (addItemBtn) {
      addItemBtn.onclick = () => {
        const tbody = document.getElementById("ap-items-tbody");
        const tr = document.createElement("tr");
        tr.className = "ap-item-row";
        tr.innerHTML = `
          <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi – Tahap Baru" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
        `;
        tbody.appendChild(tr);
        attachDelEvent(tr);
      };
    }

    document.getElementById("report-download-form").onsubmit = (e) => {
      e.preventDefault();
      const reportType = typeFilter.value;

      if (reportType === "approval_pengajuan") {
        const apDateVal = document.getElementById("ap-date").value;
        const mainProgram = document.getElementById("ap-main-program").value.trim() || "Pengajuan Dana Operasional Saudi - Bulan Agustus";
        
        const items = [];
        document.querySelectorAll("#ap-items-tbody .ap-item-row").forEach(tr => {
          const name = tr.querySelector(".ap-item-name").value.trim() || "Dana Operasional";
          const qty = parseInt(tr.querySelector(".ap-item-qty").value) || 1;
          const price = parseInt(tr.querySelector(".ap-item-price").value) || 0;
          const duedate = tr.querySelector(".ap-item-duedate").value || apDateVal;
          items.push({ name, qty, price, total: qty * price, duedate, destination: "Cash Riyal Operasional Saudi" });
        });

        closeModal();
        printReportApprovalPengajuanDana({ apDate: apDateVal, mainProgram, items });

      } else if (reportType === "group_expense") {
        const gerRef = document.getElementById("ger-ref").value.trim() || "GER-0001";
        const groupName = document.getElementById("ger-group-name").value || "Umroh Ruby Onyx 6 Juli 2026 Makkah Awal (9 Hari)";
        const paxStr = document.getElementById("ger-pax").value.trim() || "31 Pax";
        const startDate = document.getElementById("ger-start").value;
        const endDate = document.getElementById("ger-end").value;

        closeModal();
        printReportGroupExpenseReport({ gerRef, groupName, paxStr, startDate, endDate });

      } else if (reportType === "master_cash_ledger") {
        const startDate = document.getElementById("mfcl-start").value;
        const endDate = document.getElementById("mfcl-end").value;

        closeModal();
        printReportMasterFieldCashLedger({ startDate, endDate });

      } else if (reportType === "master_settlement") {
        const startDate = document.getElementById("msr-start").value;
        const endDate = document.getElementById("msr-end").value;

        closeModal();
        printReportMasterSettlementReport({ startDate, endDate });

      } else if (reportType === "operational_expense") {
        const oerRef = document.getElementById("oer-ref").value.trim() || "OER-0001";
        const startDate = document.getElementById("oer-start").value;
        const endDate = document.getElementById("oer-end").value;

        closeModal();
        printReportOperationalExpenseReport({ oerRef, startDate, endDate });
      }
    };
  };

  // Approve expense action
  document.querySelectorAll(".approve-exp-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const exp = state.financial.expenses.find(x => x.id === id);
      if (exp) {
        exp.status = "APPROVED";
        // Deduct staff wallet upon Admin approval
        state.financial.wallets[exp.username] = (state.financial.wallets[exp.username] || 0) - exp.amount;
        
        const cleanDesc = (exp.description || 'Pengeluaran Tim').replace(/^\[APPROVED\]\s*/i, '');
        
        state.financial.transactions.push({
          id: `tx-${Date.now()}`,
          type: "Uang Keluar",
          sender: exp.username,
          recipient: "Operasional",
          amount: exp.amount,
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          description: cleanDesc,
          status: "APPROVED",
          refExpenseId: exp.id
        });
        saveState();
        pushData();
        showToast("Laporan pengeluaran disetujui!");
        renderAdminFinancial();
      }
    };
  });
  
  // Reject expense action
  document.querySelectorAll(".reject-exp-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const exp = state.financial.expenses.find(x => x.id === id);
      if (exp) {
        if (exp.status === "APPROVED" || exp.status === "Disetujui") {
          state.financial.wallets[exp.username] = (state.financial.wallets[exp.username] || 0) + exp.amount;
        }
        exp.status = "Ditolak";
        saveState();
        showToast("Laporan pengeluaran ditolak.", "error");
        renderAdminFinancial();
      }
    };
  });

  // Approve delete request action (VOID execution)
  document.querySelectorAll(".approve-delete-req-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute("data-id");
      const expId = btn.getAttribute("data-exp-id");
      const req = state.financial.deleteRequests.find(r => r.id === reqId);
      
      voidFinancialTransaction(expId, req ? req.reason : "Disetujui dari Permintaan Hapus Tim");
      if (req) req.status = "Approved";
      saveState();
      showToast("Transaksi berhasil dibatalkan (VOID)!");
      renderAdminFinancial();
    };
  });

  // Reject delete request action
  document.querySelectorAll(".reject-delete-req-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute("data-id");
      const req = state.financial.deleteRequests.find(r => r.id === reqId);
      if (req) req.status = "Rejected";
      saveState();
      showToast("Permintaan hapus ditolak.", "error");
      renderAdminFinancial();
    };
  });

  // Row clicks for pending expenses details
  document.querySelectorAll(".pending-exp-row").forEach(row => {
    row.onclick = (event) => {
      if (event.target.closest("button") || event.target.closest("i")) return;
      const id = row.getAttribute("data-id");
      openAdminPendingExpenseDetailPopup(id);
    };
  });
  
  // Row clicks for pending delete requests details
  document.querySelectorAll(".pending-delete-row").forEach(row => {
    row.onclick = (event) => {
      if (event.target.closest("button") || event.target.closest("i")) return;
      const id = row.getAttribute("data-id");
      openAdminPendingDeleteDetailPopup(id);
    };
  });

  // Read-only & Void transaction log row clicks
  document.querySelectorAll(".tx-row").forEach(row => {
    row.onclick = () => {
      const idx = parseInt(row.getAttribute("data-idx"));
      const tx = state.financial.transactions[idx];
      if (!tx) return;
      
      const catType = getTxCategoryType(tx);
      const txCode = generateTxCode(tx, idx, state.financial.transactions);
      const isVoid = (tx.status === "VOID" || tx.status === "Dibatalkan");
      
      const exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
      
      let sourceName = tx.sender === 'Dompet Utama' ? 'Finance Pusat' : (tx.sender === 'Finance Pusat' ? 'Finance Pusat' : (state.users.find(u => u.username === tx.sender)?.name || tx.sender));
      if (sourceName !== 'Finance Pusat' && !sourceName.startsWith('Dompet ')) {
        sourceName = `Dompet ${sourceName}`;
      }

      let senderName = state.users.find(u => u.username === tx.sender)?.name || tx.sender;
      let recipientName = state.users.find(u => u.username === tx.recipient)?.name || tx.recipient;
      if (senderName === 'Dompet Utama') senderName = 'Admin';
      if (recipientName === 'Dompet Utama') recipientName = 'Admin';

      let headerGraphicHtml = '';
      if (catType === 'Uang Masuk') {
        headerGraphicHtml = `<h2 style="font-size:1.9rem; font-weight:900; color:#000; text-align:center; margin:10px 0 20px 0;">+ SAR  ${tx.amount.toLocaleString('id-ID')}</h2>`;
      } else if (catType === 'Uang Keluar') {
        headerGraphicHtml = `<h2 style="font-size:1.9rem; font-weight:900; color:#000; text-align:center; margin:10px 0 20px 0;">- SAR  ${tx.amount.toLocaleString('id-ID')}</h2>`;
      } else {
        // Transfer
        headerGraphicHtml = `
          <div style="text-align:center; margin:10px 0 20px 0;">
            <div style="display:flex; justify-content:center; align-items:center; gap:20px; font-size:1.25rem; font-weight:800; color:#000; margin-bottom:8px;">
              <span>${senderName}</span>
              <span style="font-size:1.6rem; line-height:1; font-weight:900;">➔</span>
              <span>${recipientName}</span>
            </div>
            <div style="font-size:1.4rem; font-weight:900; color:#000;">SAR ${tx.amount.toLocaleString('id-ID')}</div>
          </div>
        `;
      }

      let rincianItemsHtml = '';
      if (catType === 'Uang Keluar') {
        let itemsRows = '';
        if (exp && exp.items && exp.items.length > 0) {
          itemsRows = exp.items.map((item, i) => `
            <tr style="height:32px; border-bottom:1px solid #f1f5f9;">
              <td style="color:#334155; width:90px;">OUT${String(i + 1).padStart(4, '0')}</td>
              <td style="font-weight:600;">${item.category || item.name}</td>
              <td style="color:#334155;">SAR ${item.price}</td>
              <td style="color:#334155; text-align:center;">${item.qty}</td>
              <td style="font-weight:700; text-align:right;">SAR ${(item.total || item.price * item.qty).toLocaleString('id-ID')}</td>
            </tr>
          `).join('');
        } else {
          itemsRows = `
            <tr style="height:32px; border-bottom:1px solid #f1f5f9;">
              <td style="color:#334155; width:90px;">${txCode}</td>
              <td style="font-weight:600;">${tx.description || 'Pengeluaran Tim'}</td>
              <td style="color:#334155;">SAR ${tx.amount.toLocaleString('id-ID')}</td>
              <td style="color:#334155; text-align:center;">1</td>
              <td style="font-weight:700; text-align:right;">SAR ${tx.amount.toLocaleString('id-ID')}</td>
            </tr>
          `;
        }
        
        rincianItemsHtml = `
          <div style="margin-top:16px; margin-bottom:20px;">
            <div style="font-weight:700; font-size:0.95rem; color:#1e293b; margin-bottom:10px;">Rincian Item</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.88rem; color:#1e293b;">
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>
        `;
      }

      let voidAuditHtml = '';
      if (isVoid) {
        voidAuditHtml = `
          <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:12px; margin-top:14px; font-size:0.82rem; color:#991b1b;">
            <div style="font-weight:900; margin-bottom:4px; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
              <i data-lucide="ban" style="width:16px; height:16px;"></i> TRANSAKSI DIBATALKAN (VOID)
            </div>
            <div><strong>Dibatalkan Oleh:</strong> ${tx.voidedBy || 'Admin'}</div>
            <div><strong>Waktu Pembatalan:</strong> ${tx.voidedAt || '-'}</div>
            <div style="margin-top:4px;"><strong>Alasan Pembatalan:</strong> <span style="font-style:italic;">"${tx.voidReason || '-'}"</span></div>
          </div>
        `;
      }

      const receiptUrl = exp ? exp.receipt : null;
      let receiptBtnText = catType === 'Uang Masuk' ? 'LIHAT KWITANSI' : 'LIHAT STRUK';

      let statusDisplayHtml = '';
      if (isVoid) {
        statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">VOID</span>`;
      } else if (catType === 'Uang Masuk') {
        statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">Diterima</span>`;
      } else if (catType === 'Uang Keluar') {
        if (tx.status === 'Pending' || (exp && exp.status === 'Pending')) {
          statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">PENDING</span>`;
        } else {
          statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">APPROVED</span>`;
        }
      } else {
        // Transfer
        if (tx.status === 'Pending') {
          statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">PENDING</span>`;
        } else {
          statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">APPROVED</span>`;
        }
      }

      const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : '-';

      const detailHtml = `
        ${headerGraphicHtml}
        
        <table style="width:100%; border-collapse:collapse; font-size:0.92rem; line-height:2.0; margin-bottom:16px; color:#1e293b;">
          <tbody>
            ${catType !== 'Uang Keluar' ? `
              <tr>
                <td style="width:130px; color:#334155; font-weight:500;">Kode Transaksi</td>
                <td style="width:15px;">:</td>
                <td style="font-weight:700; color:#000;">${txCode}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="width:130px; color:#334155; font-weight:500;">Status</td>
              <td style="width:15px;">:</td>
              <td>${statusDisplayHtml}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Tipe</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${catType}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Sumber</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${sourceName}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Tanggal</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${formatDateLong(tx.date)}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Keterangan</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${cleanDesc}</td>
            </tr>
          </tbody>
        </table>

        ${rincianItemsHtml}
        ${voidAuditHtml}

        <div style="display:flex; justify-content:${catType === 'Transfer' ? 'flex-end' : 'space-between'}; align-items:center; gap:16px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
          ${catType !== 'Transfer' ? `
            <button type="button" id="admin-view-receipt-btn" class="btn" style="flex:1; background:#dfc06b; color:#ffffff; font-weight:800; font-size:0.9rem; padding:12px 20px; border-radius:10px; border:none; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer;">
              ${receiptBtnText}
            </button>
          ` : ''}
          ${!isVoid ? `
            <button type="button" id="admin-void-tx-btn" class="btn" style="${catType === 'Transfer' ? 'width:180px;' : 'flex:1;'} background:#fee2e2; color:#dc2626; font-weight:800; font-size:0.9rem; padding:12px 20px; border-radius:10px; border:1px solid #fca5a5; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer;">
              VOID
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="closeModal()" style="width:120px; padding:10px 16px; border-radius:10px;">Tutup</button>
          `}
        </div>
      `;

      openModal("Detail Transaksi", detailHtml);
      lucide.createIcons();

      const receiptBtn = document.getElementById("admin-view-receipt-btn");
      if (receiptBtn) {
        receiptBtn.onclick = () => {
          if (catType === 'Uang Masuk') {
            openKwitansiModal(tx, txCode);
          } else if (receiptUrl) {
            const isImg = receiptUrl.startsWith('data:image') || receiptUrl.endsWith('.jpg') || receiptUrl.endsWith('.png') || receiptUrl.endsWith('.jpeg');
            if (isImg) {
              openModal("Bukti Struk / Nota", `<div style="text-align:center;"><img src="${receiptUrl}" style="max-width:100%; max-height:70vh; border-radius:8px;"></div>`);
            } else {
              window.open(receiptUrl, '_blank');
            }
          } else {
            showToast("Tidak ada bukti lampiran.", "info");
          }
        };
      }

      const voidBtn = document.getElementById("admin-void-tx-btn");
      if (voidBtn) {
        voidBtn.onclick = () => {
          closeModal();
          openVoidTransactionModal(tx.id, () => {
            renderAdminFinancial();
          });
        };
      }
    };
  });
}

// --- ADMIN SUB-VIEW: LAPORAN ---
function renderAdminLaporan() {
  const container = document.getElementById("admin-subview-content");
  
  // Mark all unread reports as read automatically
  let stateChanged = false;
  state.reports.attendance.forEach(a => {
    if (a.unread) {
      a.unread = false;
      stateChanged = true;
    }
  });
  state.reports.incidents.forEach(i => {
    if (i.unread) {
      i.unread = false;
      stateChanged = true;
    }
  });
  if (stateChanged) {
    saveState();
  }
  
  if (!window.adminLaporanTabMode) {
    window.adminLaporanTabMode = "absensi";
  }
  
  container.innerHTML = `
    <!-- Tab Navigation -->
    <div class="tab-header" style="margin-bottom:16px;">
      <div class="tab-btn ${window.adminLaporanTabMode === 'absensi' ? 'active' : ''}" id="tab-ll-absensi-btn" data-tab="absensi">Laporan Absensi</div>
      <div class="tab-btn ${window.adminLaporanTabMode === 'kejadian' ? 'active' : ''}" id="tab-ll-kejadian-btn" data-tab="kejadian">Laporan Kejadian</div>
    </div>

    <!-- Compact filter bar -->
    <div class="admin-card" style="margin-bottom:16px; padding:12px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input type="text" id="ll-filter-search" class="form-input" placeholder="Cari nama petugas, lokasi..." style="flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        
        <input type="text" id="ll-filter-group-input" list="ll-group-list" class="form-input" placeholder="Cari / Pilih Grup..." style="width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0; background:#fff;">
        <datalist id="ll-group-list">
          <option value="">Semua Grup Rombongan</option>
          ${state.groups.map(g => `<option value="${g.name}"></option>`).join('')}
        </datalist>

        <input type="text" id="ll-filter-staff-input" list="ll-staff-list" class="form-input" placeholder="Cari / Pilih Petugas..." style="width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0; background:#fff;">
        <datalist id="ll-staff-list">
          <option value="">Semua Petugas</option>
          ${state.users.filter(u => u.role === "user").map(u => `<option value="${u.name} (${u.username})"></option>`).join('')}
        </datalist>
      </div>
    </div>

    <div id="ll-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-header .tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      window.adminLaporanTabMode = btn.getAttribute("data-tab");
      loadLaporanTabContent();
    };
  });
  
  document.getElementById("ll-filter-search").oninput = loadLaporanTabContent;
  const gInp = document.getElementById("ll-filter-group-input");
  const sInp = document.getElementById("ll-filter-staff-input");
  if (gInp) { gInp.oninput = loadLaporanTabContent; gInp.onchange = loadLaporanTabContent; }
  if (sInp) { sInp.oninput = loadLaporanTabContent; sInp.onchange = loadLaporanTabContent; }
  
  loadLaporanTabContent();
}

function loadLaporanTabContent() {
  const contents = document.getElementById("ll-tab-contents");
  if (!contents) return;
  
  const query = document.getElementById("ll-filter-search").value.toLowerCase().trim();
  const grpValue = document.getElementById("ll-filter-group-input") ? document.getElementById("ll-filter-group-input").value.trim() : "";
  const petInput = document.getElementById("ll-filter-staff-input") ? document.getElementById("ll-filter-staff-input").value.trim() : "";
  let petValue = petInput;
  const matchUser = petInput.match(/\(([^)]+)\)/);
  if (matchUser && matchUser[1]) petValue = matchUser[1];
  
  if (window.adminLaporanTabMode === "absensi") {
    const filteredAbs = state.reports.attendance.filter(a => {
      const task = state.assignments.find(t => t.id === a.taskId);
      const user = state.users.find(u => u.username === a.username);
      const taskType = task ? task.type : "Umum";
      const grpName = task ? task.groupName : "Umum";
      const matchesQuery = (taskType.toLowerCase().includes(query) || 
                            (user ? user.name.toLowerCase().includes(query) : false) || 
                            a.coords.toLowerCase().includes(query));
      const matchesGrup = !grpValue || grpName === grpValue;
      const matchesPet = !petValue || a.username === petValue;
      return matchesQuery && matchesGrup && matchesPet;
    });
    
    contents.innerHTML = `
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Review Laporan Absensi Tim</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal/Jam</th>
                <th>Nama Petugas</th>
                <th>Penugasan</th>
                <th>Absen</th>
                <th>Foto Preview</th>
              </tr>
            </thead>
            <tbody id="ll-abs-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const tbody = document.getElementById("ll-abs-tbody");
    if (filteredAbs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada laporan absensi ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filteredAbs.map(a => {
      const task = state.assignments.find(t => t.id === a.taskId);
      const name = state.users.find(u => u.username === a.username)?.name || a.username;
      return `
        <tr>
          <td>${formatDateDisplay(a.date)} | ${a.time}</td>
          <td><strong>${name}</strong></td>
          <td><code>${task ? task.type : 'Umum'}</code></td>
          <td>
            <span class="badge ${a.type === 'Masuk' ? 'badge-success' : 'badge-gold'}">${a.type}</span>
            ${(() => {
              if (a.type === 'Keluar') {
                const checkIn = state.reports.attendance.find(x => x.username === a.username && x.taskId === a.taskId && x.type === 'Masuk');
                if (checkIn && checkIn.date && checkIn.time && a.date && a.time) {
                  const t1 = new Date(`${checkIn.date}T${checkIn.time}`);
                  const t2 = new Date(`${a.date}T${a.time}`);
                  if (!isNaN(t1) && !isNaN(t2)) {
                    let diffMs = t2 - t1;
                    if (diffMs > 0) {
                      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      return `<div style="font-size:0.72rem; color:#64748b; font-weight:700; margin-top:2px;">Durasi: ${diffHrs > 0 ? diffHrs + ' Jam ' : ''}${diffMins} Mnt</div>`;
                    }
                  }
                }
              }
              return '';
            })()}
          </td>
          <td>
            <span class="badge badge-info view-absen-preview-btn" style="cursor:pointer; font-size:0.7rem; padding:4px 8px; font-weight:800;" data-time="${a.time}" data-date="${formatDateDisplay(a.date)}" data-coords="${a.coords}">PREVIEW</span>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.querySelectorAll(".view-absen-preview-btn").forEach(btn => {
      btn.onclick = () => {
        const time = btn.getAttribute("data-time");
        const date = btn.getAttribute("data-date");
        const coords = btn.getAttribute("data-coords");
        const photoHtml = `
          <div class="photo-frame-container" style="margin-bottom:16px;">
            <img src="data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22240%22 style=%22background:%23ccd0d6;%22><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23555%22 text-anchor=%22middle%22>📸 FOTO ABSENSI VERIFIKASI</text></svg>" class="photo-frame-image">
            <div class="photo-frame-overlay">
              <div class="photo-frame-title">tim khidmat - jejak imani</div>
              <div>📅 Tanggal: ${date}</div>
              <div>⏰ Waktu: ${time} Waktu Saudi</div>
              <div>📍 GPS: ${coords}</div>
            </div>
          </div>
        `;
        openModal("Preview Foto Selfie Terbingkai", photoHtml);
      };
    });
    
  } else {
    // Kejadian (Incidents) tab
    const filteredIns = state.reports.incidents.filter(i => {
      const user = state.users.find(u => u.username === i.username);
      const matchesQuery = (i.category.toLowerCase().includes(query) || 
                            (user ? user.name.toLowerCase().includes(query) : false) || 
                            i.detail.toLowerCase().includes(query));
      const matchesGrup = !grpValue || i.groupName === grpValue;
      const matchesPet = !petValue || i.username === petValue;
      return matchesQuery && matchesGrup && matchesPet;
    });
    
    contents.innerHTML = `
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Review Laporan Kejadian Lapangan</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Petugas</th>
                <th>Rombongan</th>
                <th>Kategori</th>
                <th>Detail Kejadian</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="ll-ins-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const tbody = document.getElementById("ll-ins-tbody");
    if (filteredIns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada laporan kejadian ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filteredIns.map(i => {
      const name = state.users.find(u => u.username === i.username)?.name || i.username;
      const formattedDetail = i.detail.replace(/\n/g, '<br>');
      return `
        <tr>
          <td>${formatDateDisplay(i.date)}</td>
          <td><strong>${name}</strong></td>
          <td style="font-size:0.8rem; max-width:150px;">${(i.groupName || "").substring(0,30)}...</td>
          <td><span class="badge badge-gold">${i.category}</span></td>
          <td style="font-size:0.8rem; max-width:220px; line-height:1.4;">${formattedDetail}</td>
          <td><span class="badge badge-warning">${i.status}</span></td>
          <td>
            ${i.status === 'Request Hapus' ? `
              <button class="btn btn-danger approve-delete-inc-btn" data-id="${i.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Setujui Hapus</button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}
function renderAdminVendor() {
  const container = document.getElementById("admin-subview-content");
  container.innerHTML = `
    <div class="tab-header" style="margin-bottom:24px;">
      <div class="tab-btn active" id="tab-v-db-btn" data-tab="v-db">Database Master Vendor</div>
      <div class="tab-btn" id="tab-v-book-btn" data-tab="v-book">Pemesanan Vendor (Booking)</div>
    </div>
    <div id="vendor-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadVendorTab(btn.getAttribute("data-tab"));
    };
  });
  
  loadVendorTab("v-db");
  setTimeout(() => lucide.createIcons(), 50);
}

function loadVendorTab(tab) {
  const contents = document.getElementById("vendor-tab-contents");
  
  if (tab === "v-db") {
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px;">
        <input type="text" id="vendor-search-input" class="form-input" placeholder="Cari nama, tipe, kontak vendor..." style="max-width:300px;">
        <button id="add-vendor-popup-btn" class="btn btn-gold" title="Tambah Master Vendor" style="width:auto; padding:8px 12px; display:inline-flex; align-items:center; justify-content:center; gap:6px; flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg></button>
      </div>
      
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Daftar Master Vendor</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Nama Vendor</th>
                <th>Kontak</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="vendor-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const searchInp = document.getElementById("vendor-search-input");
    const renderVendorList = () => {
      const query = searchInp.value.toLowerCase().trim();
      const tbody = document.getElementById("vendor-tbody");
      const sortedVendors = [...state.vendors].reverse();
      const filtered = sortedVendors.filter(v => 
        v.name.toLowerCase().includes(query) || 
        v.type.toLowerCase().includes(query) || 
        v.contact.toLowerCase().includes(query) ||
        (v.notes && v.notes.toLowerCase().includes(query))
      );
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">Tidak ada vendor ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(v => `
        <tr>
          <td><span class="badge badge-gold">${v.type}</span></td>
          <td><strong>${v.name}</strong></td>
          <td><code>${v.contact}</code></td>
          <td>${v.notes || '-'}</td>
          <td>
            <div class="action-btn-group" style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-gold copy-vendor-link-btn" data-id="${v.id}" data-name="${v.name}" style="width:auto; padding:6px 10px;" title="Salin Link Portal Vendor">
                <i data-lucide="link" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn btn-secondary wa-vendor-link-btn" data-id="${v.id}" data-contact="${v.contact}" data-name="${v.name}" style="width:auto; padding:6px 10px; color:#10b981; border-color:#a7f3d0; box-shadow:none;" title="Share WA Vendor">
                <i data-lucide="message-circle" style="width:14px; height:14px;"></i>
              </button>
              <button class="action-icon-btn edit-vendor-btn" data-id="${v.id}" title="Edit Master Vendor"><i data-lucide="edit" style="width:14px;"></i></button>
              <button class="action-icon-btn delete-vendor-btn" data-id="${v.id}" title="Hapus Vendor"><i data-lucide="trash" style="width:14px; color:#ef4444;"></i></button>
            </div>
          </td>
        </tr>
      `).join('');
      
      lucide.createIcons();
      bindVendorActions();
    };
    
    const bindVendorActions = () => {
      document.querySelectorAll(".copy-vendor-link-btn").forEach(btn => {
        btn.onclick = () => {
          const vId = btn.getAttribute("data-id");
          const vName = btn.getAttribute("data-name");
          const origin = window.location.origin + window.location.pathname;
          const vendorUrl = `${origin}#vendor-view?name=${encodeURIComponent(vName)}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(vendorUrl);
          } else {
            const ta = document.createElement("textarea");
            ta.value = vendorUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          showToast(`Link Portal Jadwal Vendor "${vName}" berhasil disalin!`);
        };
      });

      document.querySelectorAll(".wa-vendor-link-btn").forEach(btn => {
        btn.onclick = () => {
          const vId = btn.getAttribute("data-id");
          const vName = btn.getAttribute("data-name");
          const rawContact = btn.getAttribute("data-contact") || "";
          const origin = window.location.origin + window.location.pathname;
          const vendorUrl = `${origin}#vendor-view?name=${encodeURIComponent(vName)}`;
          const cleanPhone = rawContact.replace(/[^0-9]/g, '');
          const msg = encodeURIComponent(`Assalamu'alaikum wr.wb,\nYth. ${vName}\n\nBerikut kami kirimkan link Halaman Jadwal Pemesanan (Booking Schedule) dari Tim Khidmat jejak imani saudi arabia:\n\n${vendorUrl}\n\nMohon dapat diperiksa dan dikonfirmasi. Terima kasih.`);
          window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
        };
      });

      document.querySelectorAll(".edit-vendor-btn").forEach(btn => {
        btn.onclick = () => openVendorFormPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".delete-vendor-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Hapus master vendor ini?")) {
            state.vendors = state.vendors.filter(v => v.id !== id);
            saveState();
            showToast("Vendor dihapus.");
            loadVendorTab("v-db");
          }
        };
      });
    };
    
    searchInp.oninput = renderVendorList;
    renderVendorList();
    document.getElementById("add-vendor-popup-btn").onclick = () => openVendorFormPopup();
    
  } else {
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px;">
        <input type="text" id="booking-search-input" class="form-input" placeholder="Cari booking grup, vendor..." style="max-width:300px;">
        <button id="add-booking-popup-btn" class="btn btn-gold" title="Plot Pemesanan Booking Vendor Baru" style="width:auto; padding:8px 12px; display:inline-flex; align-items:center; justify-content:center; gap:6px; flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg></button>
      </div>
      
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Daftar Pemesanan</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal dan Waktu</th>
                <th>Grup</th>
                <th>Tujuan Kegiatan</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="booking-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const searchInp = document.getElementById("booking-search-input");
    const renderBookingList = () => {
      const query = searchInp.value.toLowerCase().trim();
      const tbody = document.getElementById("booking-tbody");
      const sortedBookings = [...state.bookings].sort((a,b) => {
        const dateA = a.dateStart || a.date || '2026-01-01';
        const dateB = b.dateStart || b.date || '2026-01-01';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return (b.time || '00:00').localeCompare(a.time || '00:00');
      });
      const filtered = sortedBookings.filter(b => {
        const v = state.vendors.find(x => x.id === b.vendorId);
        const vName = v ? v.name : "";
        return b.groupName.toLowerCase().includes(query) || vName.toLowerCase().includes(query) || (b.notes && b.notes.toLowerCase().includes(query));
      });
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">Tidak ada pemesanan ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(b => {
        const v = state.vendors.find(x => x.id === b.vendorId);
        const dateText = formatDateDisplay(b.dateStart || b.date);
        const timeText = b.time ? b.time : '05:30';
        const dateAndTimeDisplay = `${dateText} | ${timeText}`;
        
        const currentStatus = b.status || 'Pesanan Baru';
        let statusBadge = '<span class="badge badge-info" style="background:#eff6ff; color:#1d4ed8; font-size:0.75rem; font-weight:800; padding:3px 9px; border-radius:10px;">Pesanan Baru</span>';
        if (currentStatus === 'Proses') {
          statusBadge = '<span class="badge badge-warning" style="background:#fffbe6; color:#d97706; font-size:0.75rem; font-weight:800; padding:3px 9px; border-radius:10px;">Proses</span>';
        } else if (currentStatus === 'Selesai') {
          statusBadge = '<span class="badge badge-success" style="background:#ecfdf5; color:#047857; font-size:0.75rem; font-weight:800; padding:3px 9px; border-radius:10px;">Selesai</span>';
        }
        
        const destinationGoal = b.activityGoal || b.location || b.hotel || b.notes || '-';
        
        return `
          <tr>
            <td style="font-size:0.8rem; font-weight:700; color:#1e293b;">${dateAndTimeDisplay}</td>
            <td style="font-size:0.8rem; max-width:140px;"><strong>${b.groupName}</strong></td>
            <td style="font-size:0.8rem; max-width:180px; font-weight:700;">${destinationGoal}</td>
            <td style="font-size:0.8rem;">${v ? `${v.name} (${v.type})` : 'Vendor Dihapus'}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="action-btn-group">
                <button class="action-icon-btn generate-booking-pdf-btn" data-id="${b.id}" title="Cetak PO / Booking Confirmation" style="color:var(--primary-gold); border-color:#fef3c7; background:#fffdf5;"><i data-lucide="file-text" style="width:14px;"></i></button>
                <button class="action-icon-btn edit-booking-btn" data-id="${b.id}"><i data-lucide="edit" style="width:14px;"></i></button>
                <button class="action-icon-btn delete-booking-btn" data-id="${b.id}"><i data-lucide="trash" style="width:14px; color:#ef4444;"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      lucide.createIcons();
      bindBookingActions();
    };
    
    const bindBookingActions = () => {
      document.querySelectorAll(".generate-booking-pdf-btn").forEach(btn => {
        btn.onclick = () => openBookingPdfPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".edit-booking-btn").forEach(btn => {
        btn.onclick = () => openBookingFormPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".delete-booking-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Hapus booking pemesanan ini?")) {
            state.bookings = state.bookings.filter(b => b.id !== id);
            saveState();
            showToast("Booking dihapus.");
            loadVendorTab("v-book");
          }
        };
      });
    };
    
    searchInp.oninput = renderBookingList;
    renderBookingList();
    document.getElementById("add-booking-popup-btn").onclick = () => openBookingFormPopup();
  }
}
function openVendorFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const v = isEdit ? state.vendors.find(x => x.id === editId) : null;
  const products = isEdit ? (v.products || []) : [];
  
  const popupHtml = `
    <form id="admin-vendor-form-popup">
      <div class="form-group">
        <label class="form-label">Tipe Vendor</label>
        <select id="av-type" class="form-select" required>
          <option value="Katering" ${isEdit && v.type === 'Katering' ? 'selected' : ''}>Katering</option>
          <option value="Truck" ${isEdit && v.type === 'Truck' ? 'selected' : ''}>Truck</option>
          <option value="Transportasi" ${isEdit && v.type === 'Transportasi' ? 'selected' : ''}>Transportasi</option>
          <option value="Hotel" ${isEdit && v.type === 'Hotel' ? 'selected' : ''}>Hotel</option>
          <option value="Lainnya" ${isEdit && v.type === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Nama Vendor</label><input type="text" id="av-name" class="form-input" value="${isEdit ? v.name : ''}" required></div>
      <div class="form-group"><label class="form-label">Kontak Telepon</label><input type="text" id="av-contact" class="form-input" value="${isEdit ? v.contact : ''}" required></div>
      <div class="form-group"><label class="form-label">Keterangan</label><input type="text" id="av-notes" class="form-input" value="${isEdit ? (v.notes || '') : ''}" placeholder="Keterangan tambahan vendor" required></div>
      
      <h5 style="margin-top:20px; margin-bottom:10px; font-weight:800;">Daftar Produk Vendor</h5>
      <div id="av-products-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;"></div>
      <button type="button" id="av-add-prod-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Produk</button>
      
      <button type="submit" class="btn btn-primary">SIMPAN VENDOR</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Master Vendor" : "Tambah Master Vendor", popupHtml);
  
  const prodContainer = document.getElementById("av-products-container");
  const addProdRow = (name = "", type = "Pcs", price = 0) => {
    const rowId = `v-prod-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-row av-prod-row";
    div.id = rowId;
    div.innerHTML = `
      <input type="text" class="form-input prod-name" placeholder="Nama Produk" value="${name}" required>
      <select class="form-select prod-type" style="max-width:120px;" required>
        <option value="Pcs" ${type === 'Pcs' || type === 'Layanan' ? 'selected' : ''}>Pcs</option>
        <option value="Box" ${type === 'Box' || type === 'Barang' ? 'selected' : ''}>Box</option>
        <option value="Pack" ${type === 'Pack' ? 'selected' : ''}>Pack</option>
        <option value="Lainnya" ${type === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
      </select>
      <input type="number" class="form-input prod-price" placeholder="Harga SAR" value="${price}" min="0" required style="max-width:100px;">
      <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
    `;
    prodContainer.appendChild(div);
  };
  
  if (isEdit && products.length > 0) {
    products.forEach(p => addProdRow(p.name, p.type, p.price));
  } else {
    addProdRow();
  }
  
  document.getElementById("av-add-prod-btn").onclick = () => addProdRow();
  
  document.getElementById("admin-vendor-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById("av-type").value;
    const name = document.getElementById("av-name").value.trim();
    const contact = document.getElementById("av-contact").value.trim();
    const notes = document.getElementById("av-notes").value.trim();
    
    const prodRows = prodContainer.querySelectorAll(".av-prod-row");
    const newProducts = Array.from(prodRows).map(row => ({
      name: row.querySelector(".prod-name").value.trim(),
      type: row.querySelector(".prod-type").value,
      price: parseInt(row.querySelector(".prod-price").value) || 0
    }));
    
    if (isEdit) {
      v.type = type; v.name = name; v.contact = contact; v.notes = notes; v.products = newProducts;
    } else {
      state.vendors.push({ id: `v-${Date.now()}`, type, name, contact, location: "", notes, products: newProducts });
    }
    
    saveState();
    closeModal();
    showToast("Master Vendor disimpan!");
    loadVendorTab("v-db");
  };
}
function openBookingFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const b = isEdit ? state.bookings.find(x => x.id === editId) : null;
  const bookedProducts = isEdit ? (b.products || []) : [];
  
  const popupHtml = `
    <form id="admin-booking-form-popup">
      <div class="form-group">
        <label class="form-label">Rombongan Grup</label>
        <select id="ab-group" class="form-select" required>
          <option value="">-- Pilih Rombongan Grup --</option>
          ${state.groups.map(g => `<option value="${g.name}" ${isEdit && b.groupName === g.name ? 'selected' : ''}>${g.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tujuan Kegiatan (Layanan Vendor)</label>
        <input type="text" id="ab-activity-goal" class="form-input" value="${isEdit ? (b.activityGoal || b.activity || '') : ''}" placeholder="Contoh: SNACK CITY TOUR MAKKAH" required>
      </div>

      <div class="grid-2col" style="gap:10px;">
        <div class="form-group">
          <label class="form-label">Muthowwif Rombongan</label>
          <select id="ab-muthawwif-select" class="form-select">
            <option value="">-- Otomatis / Pilih Muthowwif --</option>
          </select>
          <input type="text" id="ab-muthawwif-custom" class="form-input" style="margin-top:6px;" value="${isEdit ? (b.muthawwif || '') : ''}" placeholder="Atau ketik nama Muthowwif">
        </div>
        <div class="form-group">
          <label class="form-label">Lokasi / Hotel (Bus)</label>
          <input type="text" id="ab-location" class="form-input" value="${isEdit ? (b.location || '') : ''}" placeholder="Contoh: Hotel Al Marwa Rayhaan Rotana (Bus 1)" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Pilih Vendor</label>
        <select id="ab-vendor" class="form-select" required>
          <option value="">-- Pilih Vendor --</option>
          ${state.vendors.map(v => `<option value="${v.id}" ${isEdit && b.vendorId === v.id ? 'selected' : ''}>${v.name} (${v.type})</option>`).join('')}
        </select>
      </div>

      <div class="grid-2col" style="gap:10px;">
        <div class="form-group">
          <label class="form-label">Tanggal Layanan</label>
          <input type="date" id="ab-start" class="form-input" value="${isEdit ? (b.dateStart || b.date) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Jam / Waktu Layanan</label>
          <input type="time" id="ab-time" class="form-input" value="${isEdit ? (b.time || '05:30') : '05:30'}" required>
        </div>
      </div>
      
      <h5 style="margin-top:16px; margin-bottom:8px; font-weight:800; font-size:0.9rem;">Daftar Produk Booking</h5>
      <div id="ab-products-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="button" id="ab-add-prod-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-top:8px; margin-bottom:16px;">+ Tambah Produk</button>
      
      <div style="background:#f8fafc; padding:12px; border-radius:8px; font-weight:800; font-size:0.95rem; margin-bottom:16px; border:1px solid #e2e8f0; color:#0f172a;">
        Total Estimasi Harga: SAR <span id="ab-grand-total">0</span>
      </div>

      <div class="form-group">
        <label class="form-label">Catatan Tambahan</label>
        <input type="text" id="ab-notes" class="form-input" value="${isEdit ? (b.notes || '') : ''}" placeholder="Catatan tambahan untuk vendor">
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%; font-weight:800; padding:10px;">SIMPAN PEMESANAN BOOKING</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Pemesanan Booking Vendor" : "Plot Pemesanan Booking Vendor Baru", popupHtml);
  
  const gSelect = document.getElementById("ab-group");
  const mSelect = document.getElementById("ab-muthawwif-select");
  const mCustom = document.getElementById("ab-muthawwif-custom");
  const locInput = document.getElementById("ab-location");
  const vSelect = document.getElementById("ab-vendor");
  const prodContainer = document.getElementById("ab-products-container");
  const grandTotalLabel = document.getElementById("ab-grand-total");
  
  const updateGroupInfo = () => {
    const gn = gSelect.value;
    const group = state.groups.find(g => g.name === gn);
    mSelect.innerHTML = '<option value="">-- Otomatis dari Manifest Grup --</option>';
    if (group) {
      const muthList = [];
      if (group.mutawwif) muthList.push(group.mutawwif);
      if (Array.isArray(group.leaders)) muthList.push(...group.leaders);
      if (Array.isArray(group.manifest)) {
        group.manifest.forEach(m => {
          if (m.role && m.role.toLowerCase().includes("mutawwif") && m.name) {
            muthList.push(m.name);
          }
        });
      }
      const uniqueMuths = Array.from(new Set(muthList));
      uniqueMuths.forEach(mName => {
        mSelect.innerHTML += `<option value="${mName}">${mName}</option>`;
      });

// Location input auto-fill removed per user request
    }
  };

  gSelect.onchange = () => {
    updateGroupInfo();
    if (mSelect.options.length > 1) {
      mCustom.value = mSelect.options[1].value;
    }
  };

  mSelect.onchange = () => {
    if (mSelect.value) {
      mCustom.value = mSelect.value;
    }
  };

  if (isEdit) updateGroupInfo();
  
  const getSelectedVendorProducts = () => {
    const vId = vSelect.value;
    const vendor = state.vendors.find(x => x.id === vId);
    return vendor ? (vendor.products || []) : [];
  };
  
  const calculateBookingGrandTotal = () => {
    let grandTotal = 0;
    prodContainer.querySelectorAll(".row-total").forEach(inp => {
      grandTotal += parseFloat(inp.value) || 0;
    });
    grandTotalLabel.textContent = grandTotal.toLocaleString('id-ID');
  };
  
  const addBookingProdRow = (prodName = "", qty = 1, amount = 0) => {
    const rowId = `b-prod-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const div = document.createElement("div");
    div.className = "nested-form-card ab-prod-row";
    div.id = rowId;
    
    const vendorProds = getSelectedVendorProducts();
    const productOptions = vendorProds.map(p => `<option value="${p.name}" ${p.name === prodName ? 'selected' : ''}>${p.name} (SAR ${p.price})</option>`).join('');
    
    let initialType = "";
    let initialPrice = 0;
    if (prodName) {
      const match = vendorProds.find(p => p.name === prodName);
      if (match) {
        initialType = match.type || "Pcs";
        initialPrice = match.price || 0;
      }
    }
    
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>Item Produk Layanan</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateBookingGrandTotal();">&times;</button>
      </div>
      <div class="grid-3col" style="gap:8px;">
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Produk</label>
          <select class="form-select row-prod-select" required>
            <option value="">-- Pilih Produk --</option>
            ${productOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Satuan</label>
          <input type="text" class="form-input row-type" value="${initialType || 'Pcs'}" placeholder="Pcs/Box">
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Harga SAR</label>
          <input type="number" class="form-input row-price" value="${initialPrice}">
        </div>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <div class="form-group" style="margin-bottom:4px;">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input row-qty" value="${qty}" min="1" required>
        </div>
        <div class="form-group" style="margin-bottom:4px;">
          <label class="form-label">Subtotal SAR</label>
          <input type="number" class="form-input row-total" value="${amount || (initialPrice * qty)}" readonly disabled>
        </div>
      </div>
    `;
    prodContainer.appendChild(div);
    
    const prodSelect = div.querySelector(".row-prod-select");
    const typeInp = div.querySelector(".row-type");
    const priceInp = div.querySelector(".row-price");
    const qtyInp = div.querySelector(".row-qty");
    const totalInp = div.querySelector(".row-total");
    
    prodSelect.onchange = () => {
      const selectedName = prodSelect.value;
      const prods = getSelectedVendorProducts();
      const match = prods.find(p => p.name === selectedName);
      if (match) {
        typeInp.value = match.type || "Pcs";
        priceInp.value = match.price || 0;
        totalInp.value = (match.price || 0) * (parseInt(qtyInp.value) || 1);
      } else {
        totalInp.value = 0;
      }
      calculateBookingGrandTotal();
    };
    
    const recalculateRow = () => {
      const price = parseFloat(priceInp.value) || 0;
      const qtyVal = parseFloat(qtyInp.value) || 0;
      totalInp.value = price * qtyVal;
      calculateBookingGrandTotal();
    };

    priceInp.oninput = recalculateRow;
    qtyInp.oninput = recalculateRow;
  };
  
  vSelect.onchange = () => {
    prodContainer.innerHTML = "";
    addBookingProdRow();
    calculateBookingGrandTotal();
  };
  
  document.getElementById("ab-add-prod-btn").onclick = () => {
    if (!vSelect.value) {
      showToast("Silakan pilih Vendor terlebih dahulu.", "error");
      return;
    }
    addBookingProdRow();
  };
  
  if (isEdit) {
    if (bookedProducts.length > 0) {
      bookedProducts.forEach(p => addBookingProdRow(p.name, p.qty, p.amount || (p.price * p.qty)));
    } else {
      addBookingProdRow();
    }
    calculateBookingGrandTotal();
  } else {
    addBookingProdRow();
  }
  
  document.getElementById("admin-booking-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gSelect.value;
    const activityGoal = document.getElementById("ab-activity-goal").value.trim();
    const muthawwif = mCustom.value.trim() || mSelect.value || "Ust. Ahmad Saiful Haq";
    const location = document.getElementById("ab-location").value.trim();
    const vendorId = vSelect.value;
    const dateStart = document.getElementById("ab-start").value;
    const time = document.getElementById("ab-time").value || "05:30";
    const notes = document.getElementById("ab-notes").value.trim();
    
    const rows = prodContainer.querySelectorAll(".ab-prod-row");
    const products = Array.from(rows).map(row => {
      const name = row.querySelector(".row-prod-select").value || row.querySelector(".row-type").value || "Item Produk";
      const unit = row.querySelector(".row-type").value || "Pcs";
      const qty = parseInt(row.querySelector(".row-qty").value) || 1;
      const price = parseFloat(row.querySelector(".row-price").value) || 0;
      return {
        name,
        unit,
        qty,
        price,
        subtotal: qty * price,
        amount: qty * price
      };
    });

    const totalPrice = products.reduce((acc, p) => acc + p.subtotal, 0);

    if (isEdit) {
      b.groupName = groupName;
      b.activityGoal = activityGoal;
      b.muthawwif = muthawwif;
      b.location = location;
      b.vendorId = vendorId;
      b.dateStart = dateStart;
      b.time = time;
      b.notes = notes;
      b.products = products;
      b.totalPrice = totalPrice;
    } else {
      state.bookings.push({
        id: `b-${Date.now()}`,
        groupName,
        activityGoal,
        muthawwif,
        location,
        vendorId,
        dateStart,
        time,
        notes,
        products,
        totalPrice,
        status: "Aktif"
      });
    }

    saveState();
    closeModal();
    showToast(`Pemesanan booking vendor berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`);

    if (window.location.hash.startsWith("#admin/vendors")) {
      loadVendorTab("v-book");
    }
  };
}
// --- ADMIN SUB-VIEW: MANIFEST ---
function renderAdminManifest() {
  const container = document.getElementById("admin-subview-content");
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px;">
      <input type="text" id="manifest-search-input" class="form-input" placeholder="Cari rombongan grup manifest..." style="max-width:300px;">
      <button id="add-manifest-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Manifest Info</button>
    </div>
    <div id="manifest-list-cards" style="display:flex; flex-direction:column; gap:20px;"></div>
  `;
  
  const searchInp = document.getElementById("manifest-search-input");
  
  const urlParams = window.location.hash.split("?")[1];
  const searchName = (urlParams && urlParams.startsWith("search=")) ? decodeURIComponent(urlParams.replace("search=", "")) : "";
  
  if (searchName) {
    searchInp.value = searchName;
  }
  
  const applySearch = () => {
    const query = searchInp.value.toLowerCase().trim();
    renderManifestList(query);
  };
  
  searchInp.oninput = applySearch;
  
  lucide.createIcons();
  document.getElementById("add-manifest-popup-btn").onclick = () => openManifestFormPopup();
  
  applySearch();
}
function openManifestFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const g = isEdit ? state.groups[editIdx] : null;
  
  const popupHtml = `
    <form id="manifest-submit-form-popup">
      <!-- SEKSI 1: INFORMASI UTAMA GRUP -->
      <div class="repeater-section-title">Seksi 1: Informasi Utama Grup</div>
      <div class="form-group"><label class="form-label">Nama Grup</label><input type="text" id="m-group-name" class="form-input" value="${isEdit ? g.name : ''}" required></div>
      <div class="grid-2col">
        <div class="form-group"><label class="form-label">Rute Grup</label><input type="text" id="m-route" class="form-input" value="${isEdit ? g.rute : ''}" placeholder="Jakarta - Jeddah - Madinah - Makkah" required></div>
        <div class="form-group"><label class="form-label">Jumlah Bus</label><input type="text" id="m-bus" class="form-input" value="${isEdit ? (g.bus || '') : '1 Bus'}" placeholder="Contoh: 1 Bus / 2 Bus" required></div>
      </div>
      <div class="grid-2col">
        <div class="form-group"><label class="form-label">Tanggal Keberangkatan</label><input type="date" id="m-start-date" class="form-input" value="${isEdit ? g.dateStart : ''}" required></div>
        <div class="form-group"><label class="form-label">Tanggal Kepulangan</label><input type="date" id="m-end-date" class="form-input" value="${isEdit ? g.dateEnd : ''}" required></div>
      </div>
      
      <!-- SEKSI 2: PENERBANGAN -->
      <div class="repeater-section-title">Seksi 2: Penerbangan (Flight Details)</div>
      
      <div class="form-group">
        <label class="form-label">Maskapai Kedatangan (Transit)</label>
        <div id="m-arr-flights-container"></div>
        <button type="button" id="m-add-arr-flight-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Penerbangan</button>
      </div>

      <div class="form-group">
        <label class="form-label">Maskapai Kepulangan</label>
        <div id="m-dep-flights-container"></div>
        <button type="button" id="m-add-dep-flight-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Penerbangan</button>
      </div>

      <!-- SEKSI 3: PAKET LAYANAN & AKOMODASI -->
      <div class="repeater-section-title">Seksi 3: Paket Layanan & Akomodasi</div>
      <div id="m-packages-container"></div>
      <button type="button" id="m-add-package-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; margin-bottom:12px;">Tambah Paket</button>
      
      <!-- Auto Pax Sum Calculator -->
      <div style="background:#f1f3f5; padding:12px; border-radius:6px; font-weight:800; font-size:0.95rem; margin-bottom:20px; border:1px solid #ced4da;">
        Total Pax Keseluruhan: <span id="m-total-pax-calc">0</span> Pax
      </div>

      <!-- SEKSI 4: TIM LAPANGAN -->
      <div class="repeater-section-title">Seksi 4: Tim Lapangan</div>
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Tour Leader</label>
          <div id="m-leaders-container"></div>
          <button type="button" id="m-add-leader-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah TL</button>
        </div>
        <div class="form-group">
          <label class="form-label">Muthowwif</label>
          <div id="m-mutawwif-container"></div>
          <button type="button" id="m-add-mutawwif-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Muthowwif</button>
        </div>
      </div>

      <!-- SEKSI 5: RENCANA KONSUMSI (MEALPLAN) -->
      <div class="repeater-section-title">Seksi 5: Rencana Konsumsi (Mealplan)</div>
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Mealplan Kedatangan</label>
          <div id="m-meals-arr-container"></div>
          <button type="button" id="m-add-meal-arr-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Meal</button>
        </div>
        <div class="form-group">
          <label class="form-label">Mealplan Kepulangan</label>
          <div id="m-meals-dep-container"></div>
          <button type="button" id="m-add-meal-dep-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Meal</button>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="margin-top:20px;">SIMPAN MANIFEST GRUP</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Manifest Rombongan" : "Tambah Manifest Grup Baru", popupHtml);
  
  // Repeater row builders
  const addFlightRow = (containerId, date = "", code = "", takeoff = "", landing = "", remarks = "") => {
    const container = document.getElementById(containerId);
    const rowId = `f-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card f-item-row";
    div.id = rowId;
    div.innerHTML = `
      <div class="grid-2col" style="gap:8px;">
        <input type="date" class="form-input f-date" value="${date}" required>
        <input type="text" class="form-input f-code" value="${code}" placeholder="Kode (mis. SV819)" required>
      </div>
      <div class="grid-2col" style="gap:8px; margin-top:8px;">
        <input type="time" class="form-input f-takeoff" value="${takeoff}" required>
        <input type="time" class="form-input f-landing" value="${landing}" required>
      </div>
      <div style="display:flex; gap:8px; margin-top:8px; align-items:center;">
        <input type="text" class="form-input f-rem" value="${remarks}" placeholder="Keterangan / Catatan">
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
    `;
    container.appendChild(div);
  };
  
  const addPackageRow = (containerId, name = "Sapphire Plus", pax = 0, hotelMadinah = "", hotelMakkah = "") => {
    const container = document.getElementById(containerId);
    const rowId = `p-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card p-item-row";
    div.id = rowId;
    div.innerHTML = `
      <div class="grid-2col" style="gap:8px;">
        <select class="form-select p-name" required>
          <option value="Sapphire Plus" ${name === 'Sapphire Plus' ? 'selected' : ''}>Sapphire Plus</option>
          <option value="Sapphire" ${name === 'Sapphire' ? 'selected' : ''}>Sapphire</option>
          <option value="Ruby" ${name === 'Ruby' ? 'selected' : ''}>Ruby</option>
          <option value="Onyx" ${name === 'Onyx' ? 'selected' : ''}>Onyx</option>
          <option value="Best Deal" ${name === 'Best Deal' ? 'selected' : ''}>Best Deal</option>
          <option value="Yaqin" ${name === 'Yaqin' ? 'selected' : ''}>Yaqin</option>
        </select>
        <input type="number" class="form-input p-pax" value="${pax}" placeholder="Jumlah Pax" required min="1">
      </div>
      <div class="grid-2col" style="gap:8px; margin-top:8px;">
        <input type="text" class="form-input p-hotel-mad" value="${hotelMadinah}" placeholder="Hotel Madinah" required>
        <input type="text" class="form-input p-hotel-mak" value="${hotelMakkah}" placeholder="Hotel Makkah" required>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateOverallPax();">&times;</button>
      </div>
    `;
    container.appendChild(div);
    
    // Bind auto sum listener to pax inputs
    div.querySelector(".p-pax").oninput = calculateOverallPax;
  };
  
  const addSimpleTextRow = (containerId, placeholder, val = "") => {
    const container = document.getElementById(containerId);
    const rowId = `s-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-row s-item-row";
    div.id = rowId;
    div.innerHTML = `
      <input type="text" class="form-input s-val" value="${val}" placeholder="${placeholder}" required>
      <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
    `;
    container.appendChild(div);
  };
  
  // Overall Pax calculator function
  function calculateOverallPax() {
    let sum = 0;
    const inputs = document.querySelectorAll(".p-item-row .p-pax");
    inputs.forEach(inp => {
      sum += parseInt(inp.value) || 0;
    });
    const label = document.getElementById("m-total-pax-calc");
    if (label) label.textContent = sum;
  }
  
  // Binding repeater button actions
  document.getElementById("m-add-arr-flight-btn").onclick = () => addFlightRow("m-arr-flights-container");
  document.getElementById("m-add-dep-flight-btn").onclick = () => addFlightRow("m-dep-flights-container");
  document.getElementById("m-add-package-btn").onclick = () => addPackageRow("m-packages-container");
  
  document.getElementById("m-add-leader-btn").onclick = () => addSimpleTextRow("m-leaders-container", "Nama Tour Leader");
  document.getElementById("m-add-mutawwif-btn").onclick = () => addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif");
  document.getElementById("m-add-meal-arr-btn").onclick = () => addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu Kedatangan");
  document.getElementById("m-add-meal-dep-btn").onclick = () => addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu Kepulangan");
  
  // Prepopulate edit data
  if (isEdit) {
    g.flightArrival.forEach(f => addFlightRow("m-arr-flights-container", f.date, f.code, f.takeoff, f.landing, f.remarks));
    g.flightDeparture.forEach(f => addFlightRow("m-dep-flights-container", f.date, f.code, f.takeoff, f.landing, f.remarks));
    g.packages.forEach(p => addPackageRow("m-packages-container", p.name, p.pax, p.hotelMadinah, p.hotelMakkah));
    g.leaders.forEach(l => addSimpleTextRow("m-leaders-container", "Nama TL", l));
    g.mutawwif.forEach(m => addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif", m));
    g.mealArrival.forEach(m => addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu", m));
    g.mealDeparture.forEach(m => addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu", m));
    calculateOverallPax();
  } else {
    // defaults
    addFlightRow("m-arr-flights-container");
    addFlightRow("m-dep-flights-container");
    addPackageRow("m-packages-container");
    addSimpleTextRow("m-leaders-container", "Nama Tour Leader");
    addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif");
    addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu");
    addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu");
  }
  
  document.getElementById("manifest-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("m-group-name").value.trim();
    const rute = document.getElementById("m-route").value.trim();
    const bus = document.getElementById("m-bus") ? document.getElementById("m-bus").value.trim() : "1 Bus";
    const dateStart = document.getElementById("m-start-date").value;
    const dateEnd = document.getElementById("m-end-date").value;
    
    // Parse flight arrival repeater rows
    const arrRows = document.querySelectorAll("#m-arr-flights-container .f-item-row");
    const flightArrival = Array.from(arrRows).map(row => ({
      date: row.querySelector(".f-date").value,
      code: row.querySelector(".f-code").value.trim(),
      takeoff: row.querySelector(".f-takeoff").value,
      landing: row.querySelector(".f-landing").value,
      remarks: row.querySelector(".f-rem").value.trim()
    }));
    
    // Parse flight departure repeater rows
    const depRows = document.querySelectorAll("#m-dep-flights-container .f-item-row");
    const flightDeparture = Array.from(depRows).map(row => ({
      date: row.querySelector(".f-date").value,
      code: row.querySelector(".f-code").value.trim(),
      takeoff: row.querySelector(".f-takeoff").value,
      landing: row.querySelector(".f-landing").value,
      remarks: row.querySelector(".f-rem").value.trim()
    }));
    
    // Parse package repeater rows
    const pkgRows = document.querySelectorAll("#m-packages-container .p-item-row");
    const packages = Array.from(pkgRows).map(row => ({
      name: row.querySelector(".p-name").value,
      pax: parseInt(row.querySelector(".p-pax").value) || 0,
      hotelMadinah: row.querySelector(".p-hotel-mad").value.trim(),
      hotelMakkah: row.querySelector(".p-hotel-mak").value.trim()
    }));
    
    // Extract unique hotel list dinamis dari paket
    let hotels = [];
    packages.forEach(p => {
      if (p.hotelMadinah && !hotels.includes(p.hotelMadinah)) hotels.push(p.hotelMadinah);
      if (p.hotelMakkah && !hotels.includes(p.hotelMakkah)) hotels.push(p.hotelMakkah);
    });
    
    const leaders = Array.from(document.querySelectorAll("#m-leaders-container .s-item-row .s-val")).map(x => x.value.trim());
    const mutawwif = Array.from(document.querySelectorAll("#m-mutawwif-container .s-item-row .s-val")).map(x => x.value.trim());
    const mealArrival = Array.from(document.querySelectorAll("#m-meals-arr-container .s-item-row .s-val")).map(x => x.value.trim());
    const mealDeparture = Array.from(document.querySelectorAll("#m-meals-dep-container .s-item-row .s-val")).map(x => x.value.trim());
    
    if (isEdit) {
      state.groups[editIdx] = {
        name, rute, status: g.status, dateStart, dateEnd, flightArrival, flightDeparture, packages, hotels, leaders, mutawwif, mealArrival, mealDeparture
      };
    } else {
      state.groups.push({
        name, rute, status: "Aktif", dateStart, dateEnd, flightArrival, flightDeparture, packages, hotels, leaders, mutawwif, mealArrival, mealDeparture
      });
    }
    
    saveState();
    closeModal();
    showToast("Manifest grup disimpan!");
    renderAdminManifest();
  };
}


function renderManifestList(searchQuery = "") {
  const container = document.getElementById("manifest-list-cards");
  if (!container) return;
  
  let list = state.groups || [];
  if (searchQuery !== "") {
    list = list.filter(g => 
      (g.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (g.rute || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  if (list.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Tidak ada manifest grup yang ditemukan.</p>`;
    return;
  }
  
  container.innerHTML = list.map((g) => {
    const idx = state.groups.indexOf(g);
    const totalPax = g.packages ? g.packages.reduce((sum, item) => sum + (item.pax || 0), 0) : (parseInt(g.pax) || 0);
    const isHighlight = searchQuery !== "" && (g.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    // Flight arrival chips
    let flightArrHtml = '<span style="color:#94a3b8;">-</span>';
    if (g.flightArrival && Array.isArray(g.flightArrival) && g.flightArrival.length > 0) {
      flightArrHtml = g.flightArrival.map(f => `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700; font-size:0.75rem; margin-right:4px; margin-bottom:4px; display:inline-block;">✈️ ${f.code || '-'} (${f.takeoff || '-'}-${f.landing || '-'})</span>`).join('');
    }
    
    // Flight departure chips
    let flightDepHtml = '<span style="color:#94a3b8;">-</span>';
    if (g.flightDeparture && Array.isArray(g.flightDeparture) && g.flightDeparture.length > 0) {
      flightDepHtml = g.flightDeparture.map(f => `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; font-size:0.75rem; margin-right:4px; margin-bottom:4px; display:inline-block;">✈️ ${f.code || '-'} (${f.takeoff || '-'}-${f.landing || '-'})</span>`).join('');
    }
    
    // Hotels list
    let hotelsListStr = g.hotels && Array.isArray(g.hotels) ? g.hotels.join(' & ') : `${g.hotelMadinah || 'Madinah Hotel'} & ${g.hotelMakkah || 'Makkah Hotel'}`;
    
    // Meals list
    let allMeals = [];
    if (g.mealArrival && Array.isArray(g.mealArrival)) allMeals = allMeals.concat(g.mealArrival);
    if (g.mealDeparture && Array.isArray(g.mealDeparture)) allMeals = allMeals.concat(g.mealDeparture);
    let mealsStr = allMeals.length > 0 ? allMeals.join(', ') : 'Katering Standard Saudi';

    // Leaders & Muthowwif
    let leadersStr = (g.leaders && g.leaders.length > 0) ? g.leaders.join(', ') : (g.mutawwif || 'Ust. Ahmad Saiful Haq');
    
    const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    let statusText = "Akan Datang";
    let badgeBg = "#eff6ff";
    let badgeColor = "#1d4ed8";
    let badgeBorder = "#bfdbfe";

    if (todayStr >= g.dateStart && todayStr <= g.dateEnd) {
      statusText = "Aktif";
      badgeBg = "#ecfdf5";
      badgeColor = "#047857";
      badgeBorder = "#a7f3d0";
    } else if (todayStr > g.dateEnd) {
      statusText = "Selesai";
      badgeBg = "#f1f5f9";
      badgeColor = "#475569";
      badgeBorder = "#cbd5e1";
    }
    
    return `
      <div class="admin-card" style="border-radius:14px; border:1px solid ${isHighlight ? 'var(--primary-gold)' : '#e2e8f0'}; background:${isHighlight ? '#fffdf5' : '#ffffff'}; box-shadow: 0 4px 14px rgba(0,0,0,0.03); padding:18px; margin-bottom:12px; transition:all 0.2s;">
        
        <!-- Header Banner Card -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg, #dfc06b 0%, #b89230 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:1.1rem; box-shadow:0 2px 6px rgba(184,146,48,0.3);">
              <i data-lucide="users" style="width:20px; height:20px;"></i>
            </div>
            <div>
              <div style="font-size:1.1rem; font-weight:900; color:#0f172a; line-height:1.2;">${g.name || 'Grup Tanpa Nama'}</div>
              <div style="font-size:0.75rem; color:#64748b; margin-top:2px; font-weight:700;">${g.rute || 'Jakarta - Jeddah - Madinah - Makkah'}</div>
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="badge" style="background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder}; font-weight:800; font-size:0.78rem; padding:4px 10px; border-radius:12px;">${statusText}</span>
            <button class="btn btn-secondary edit-manifest-popup-btn" data-idx="${idx}" style="width:auto; padding:5px 12px; font-size:0.78rem; font-weight:800; border-radius:8px;">Sunting</button>
            <button class="btn btn-danger delete-manifest-btn" data-idx="${idx}" style="width:auto; padding:5px 10px; font-size:0.78rem; font-weight:800; border-radius:8px;" title="Hapus"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
          </div>
        </div>
        
        <!-- Key Metrics Grid -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:14px;">
          <div style="background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #f1f5f9;">
            <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">📅 Periode Keberangkatan</div>
            <div style="font-size:0.85rem; font-weight:800; color:#0f172a; margin-top:2px;">${formatDateDisplay(g.dateStart)} s/d ${formatDateDisplay(g.dateEnd)}</div>
          </div>
          <div style="background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #f1f5f9;">
            <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">👥 Jumlah Jamaah & Bus</div>
            <div style="font-size:0.85rem; font-weight:900; color:#b89230; margin-top:2px;">${totalPax} Jamaah <span style="font-weight:600; color:#64748b;">(${g.bus || '1 Bus'})</span></div>
          </div>
          <div style="background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #f1f5f9;">
            <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">🏢 Akomodasi Hotel</div>
            <div style="font-size:0.85rem; font-weight:800; color:#0f172a; margin-top:2px;">${hotelsListStr}</div>
          </div>
          <div style="background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #f1f5f9;">
            <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">👨‍💼 Tour Leader & Muthowwif</div>
            <div style="font-size:0.85rem; font-weight:800; color:#0f172a; margin-top:2px;">${leadersStr}</div>
          </div>
        </div>
        
        <!-- Structured 2-Column Grid for Flight & Catering -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; font-size:0.8rem; background:#ffffff; padding:12px 14px; border-radius:10px; border:1px solid #e2e8f0;">
          <!-- Left Column: Kedatangan -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div>
              <strong style="color:#0f172a; font-size:0.78rem; display:block; margin-bottom:4px;">🛬 Flight Kedatangan:</strong>
              <div>${flightArrHtml}</div>
            </div>
            <div>
              <strong style="color:#0f172a; font-size:0.78rem; display:block; margin-bottom:2px;">🍱 Mealplan Kedatangan:</strong>
              <span style="color:#334155; font-weight:700; font-size:0.78rem;">${(g.mealArrival && Array.isArray(g.mealArrival) && g.mealArrival.length > 0) ? g.mealArrival.join(', ') : 'Standard Katering'}</span>
            </div>
          </div>

          <!-- Right Column: Kepulangan -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div>
              <strong style="color:#0f172a; font-size:0.78rem; display:block; margin-bottom:4px;">🛫 Flight Kepulangan:</strong>
              <div>${flightDepHtml}</div>
            </div>
            <div>
              <strong style="color:#0f172a; font-size:0.78rem; display:block; margin-bottom:2px;">🍱 Mealplan Kepulangan:</strong>
              <span style="color:#334155; font-weight:700; font-size:0.78rem;">${(g.mealDeparture && Array.isArray(g.mealDeparture) && g.mealDeparture.length > 0) ? g.mealDeparture.join(', ') : 'Standard Katering'}</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }).join('');
  
  // Bind actions
  container.querySelectorAll(".edit-manifest-popup-btn").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      openManifestFormPopup(idx);
    };
  });
  
  container.querySelectorAll(".delete-manifest-btn").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      const group = state.groups[idx];
      if (group && confirm(`Hapus data manifest rombongan "${group.name}" beserta seluruh data terhubung (Itinerary, Roomlist, Tugas Tim, & Dokumen)?`)) {
        deleteGroupCascade(group.name);
        showToast("Grup dan seluruh data terhubung berhasil dihapus total!");
        renderAdminManifest();
      }
    };
  });
  
  lucide.createIcons();
}

function renderAdminManifestJamaah() {
  const container = document.getElementById("admin-subview-content");
  if (!container) return;
  
  const groupNames = state.groups.map(g => g.name);
  
  container.innerHTML = `
    <div style="background:#ffffff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:20px; border:1px solid #cbd5e1;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div style="flex:1; min-width:280px; position:relative;">
          <label class="form-label" style="font-weight:800; font-size:0.85rem; color:#1e293b; margin-bottom:6px; display:block;">Pilih Rombongan Grup Keberangkatan</label>
          <input type="text" id="jamaah-group-search" class="form-input" placeholder="Cari / Ketik Rombongan Grup..." style="width:100%;">
          <div id="jamaah-group-suggestions" class="suggestion-list hidden"></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-end;">
          <button id="add-jamaah-popup-btn" class="btn btn-gold" style="width:auto; padding:10px 16px; font-size:0.85rem; display:none;">
            <i data-lucide="user-plus"></i> Tambah Jamaah
          </button>
          <button id="print-jamaah-manifest-btn" class="btn btn-secondary" style="width:auto; padding:10px 16px; font-size:0.85rem; display:none;">
            <i data-lucide="printer"></i> Cetak Manifest
          </button>
        </div>
      </div>
      <div id="selected-group-summary-banner" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; font-size:0.85rem; color:#334155;">
      </div>
    </div>
    
    <div id="jamaah-manifest-table-container">
      <div style="text-align:center; padding:40px 20px; color:#94a3b8; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
        <i data-lucide="users" style="width:48px; height:48px; color:#cbd5e1; margin-bottom:12px; stroke-width:1.5;"></i>
        <h4 style="font-weight:800; color:#475569; margin-bottom:4px;">Belum Ada Grup Dipilih</h4>
        <p style="font-size:0.85rem; margin:0;">Silakan pilih atau cari rombongan grup keberangkatan di atas untuk menampilkan Manifest Jamaah terhubung.</p>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  const groupInput = document.getElementById("jamaah-group-search");
  const addBtn = document.getElementById("add-jamaah-popup-btn");
  const printBtn = document.getElementById("print-jamaah-manifest-btn");
  const summaryBanner = document.getElementById("selected-group-summary-banner");
  const tableContainer = document.getElementById("jamaah-manifest-table-container");
  
  let currentSelectedGroup = "";
  
  const renderGroupJamaahTable = (groupName) => {
    currentSelectedGroup = groupName;
    const groupObj = state.groups.find(g => g.name === groupName);
    
    if (!groupObj) {
      addBtn.style.display = "none";
      printBtn.style.display = "none";
      summaryBanner.style.display = "none";
      tableContainer.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#94a3b8; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <p style="font-size:0.85rem; margin:0;">Grup "${groupName}" tidak ditemukan.</p>
        </div>
      `;
      return;
    }
    
    addBtn.style.display = "inline-flex";
    printBtn.style.display = "inline-flex";
    summaryBanner.style.display = "block";
    
    const tlStr = (groupObj.leaders && groupObj.leaders.length > 0) ? groupObj.leaders.join(', ') : "Belum ditentukan";
    const muthStr = groupObj.mutawwif || "Belum ditentukan";
    const totalPaxVal = groupObj.packages ? groupObj.packages.reduce((sum, p) => sum + (p.pax || 0), 0) : 0;
    
    summaryBanner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <strong style="color:#0f172a; font-size:0.95rem;">${groupObj.name}</strong>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
            Rute: ${groupObj.rute || '-'} &bull; Tgl: ${groupObj.dateStart || '-'} s/d ${groupObj.dateEnd || '-'}
          </div>
        </div>
        <div style="display:flex; gap:16px; font-size:0.8rem; flex-wrap:wrap;">
          <div><span style="color:#64748b;">Tour Leader:</span> <strong>${tlStr}</strong></div>
          <div><span style="color:#64748b;">Muthowwif:</span> <strong>${muthStr}</strong></div>
          <div><span style="color:#64748b;">Total Target Pax:</span> <strong>${totalPaxVal} Jamaah</strong></div>
        </div>
      </div>
    `;
    
    const roomsForGroup = state.rooms.filter(r => r.groupName === groupName);
    
    let jamaahList = [];
    roomsForGroup.forEach(r => {
      if (r.guests && Array.isArray(r.guests)) {
        r.guests.forEach(g => {
          const uCode = g.uniqueCode || ("JIBB-" + String(g.guestNo || "1").padStart(4, "0"));
          jamaahList.push({
            guestNo: g.guestNo || "1",
            uniqueCode: uCode,
            name: g.name || "-",
            remark: g.remark || "Laki-laki",
            roomNumber: r.roomNumber,
            hotelName: r.hotelName,
            roomId: r.id
          });
        });
      }
    });
    
    if (jamaahList.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align:center; padding:36px 20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <p style="color:#64748b; font-size:0.88rem; margin-bottom:12px;">Belum ada data jamaah terdaftar di roomlist rombongan grup ini.</p>
          <button class="btn btn-gold" id="table-add-first-jamaah-btn" style="width:auto; padding:6px 14px; font-size:0.8rem;">+ Tambah Jamaah Pertama</button>
        </div>
      `;
      const firstBtn = document.getElementById("table-add-first-jamaah-btn");
      if (firstBtn) firstBtn.onclick = () => openAddJamaahPopup(groupName, () => renderGroupJamaahTable(groupName));
      return;
    }
    
    let tableHtml = `
      <div style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div style="padding:12px 16px; background:#f1f5f9; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.88rem; color:#1e293b;">Daftar Manifest Jamaah Terdaftar (${jamaahList.length} Jamaah)</strong>
          <span style="font-size:0.75rem; color:#64748b;">Terhubung dengan Database Roomlist & Manifest Grup</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="background:#f8fafc; color:#475569; text-align:left; border-bottom:1px solid #e2e8f0;">
                <th style="padding:10px 12px; width:60px;">No</th>
                <th style="padding:10px 12px; width:110px;">ID Kode Unik</th>
                <th style="padding:10px 12px;">Nama Lengkap Jamaah</th>
                <th style="padding:10px 12px;">Jenis Kelamin</th>
                <th style="padding:10px 12px;">No. Kamar</th>
                <th style="padding:10px 12px;">Hotel Layanan</th>
                <th style="padding:10px 12px; text-align:center; width:100px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${jamaahList.map((j) => {
                const genderTag = (j.remark && j.remark.toLowerCase().includes("perempuan")) 
                  ? `<span class="badge" style="background:#fce7f3; color:#be185d; font-size:0.72rem; padding:2px 8px; border-radius:10px;">Perempuan</span>`
                  : `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; padding:2px 8px; border-radius:10px;">Laki-laki</span>`;
                
                return `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 12px; font-weight:700;"><code>${j.guestNo}</code></td>
                    <td style="padding:10px 12px;"><span style="background:#eff6ff; color:#0070f3; font-weight:900; font-size:0.78rem; padding:3px 8px; border-radius:6px; border:1px solid #bfdbfe;">${j.uniqueCode}</span></td>
                    <td style="padding:10px 12px; font-weight:800; color:#0f172a;">${j.name}</td>
                    <td style="padding:10px 12px;">${genderTag}</td>
                    <td style="padding:10px 12px; font-weight:700; color:#334155;">Kamar ${j.roomNumber}</td>
                    <td style="padding:10px 12px; color:#475569;">${j.hotelName}</td>
                    <td style="padding:10px 12px; text-align:center;">
                      <button class="btn btn-gold detail-jamaah-btn" data-unique="${j.uniqueCode}" data-roomid="${j.roomId}" data-guestno="${j.guestNo}" style="padding:4px 12px; font-size:0.75rem; width:auto; font-weight:800;" title="Lihat Detail Jamaah"><i data-lucide="eye"></i> Detail</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    lucide.createIcons();
    
    tableContainer.querySelectorAll(".detail-jamaah-btn").forEach(btn => {
      btn.onclick = () => {
        const uCode = btn.getAttribute("data-unique");
        const rId = btn.getAttribute("data-roomid");
        const gNo = btn.getAttribute("data-guestno");
        openJamaahDetailPopup(uCode, rId, gNo, () => renderGroupJamaahTable(groupName));
      };
    });
  };
  
  initSuggestionInput("jamaah-group-search", "jamaah-group-suggestions", groupNames, (selectedName) => {
    renderGroupJamaahTable(selectedName);
  });
  
  addBtn.onclick = () => {
    if (currentSelectedGroup) {
      openAddJamaahPopup(currentSelectedGroup, () => renderGroupJamaahTable(currentSelectedGroup));
    }
  };
  
  printBtn.onclick = () => {
    if (currentSelectedGroup) {
      window.print();
    }
  };
  
  const urlParams = window.location.hash.split("?")[1];
  if (urlParams && urlParams.startsWith("group=")) {
    const grp = decodeURIComponent(urlParams.replace("group=", ""));
    groupInput.value = grp;
    renderGroupJamaahTable(grp);
  } else if (groupNames.length > 0) {
    groupInput.value = groupNames[0];
    renderGroupJamaahTable(groupNames[0]);
  }
}

function openAddJamaahPopup(groupName, onComplete) {
  const groupObj = state.groups.find(g => g.name === groupName);
  const hotels = groupObj ? groupObj.hotels : [];
  const hotelOptions = hotels.map(h => `<option value="${h}">${h}</option>`).join('');
  
  const popupHtml = `
    <form id="add-jamaah-form-popup">
      <div class="form-group">
        <label class="form-label">No. Urut / ID Jamaah</label>
        <input type="text" id="aj-num" class="form-input" placeholder="mis. 1, 2, atau X8582843" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nama Lengkap Jamaah</label>
        <input type="text" id="aj-name" class="form-input" placeholder="Nama Jamaah" required>
      </div>
      <div class="form-group">
        <label class="form-label">Jenis Kelamin / Remark</label>
        <select id="aj-remark" class="form-select" required>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Hotel Akomodasi</label>
        <select id="aj-hotel" class="form-select" required>
          ${hotelOptions || '<option value="Hotel Madinah">Hotel Madinah</option><option value="Hotel Makkah">Hotel Makkah</option>'}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor Kamar</label>
        <input type="text" id="aj-room" class="form-input" placeholder="mis. 1007 atau 2105" required>
      </div>
      <button type="submit" class="btn btn-gold" style="margin-top:16px;">+ TAMBAH JAMAAH KE MANIFEST</button>
    </form>
  `;
  
  openModal(`Tambah Jamaah - ${groupName}`, popupHtml);
  
  document.getElementById("add-jamaah-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const guestNo = document.getElementById("aj-num").value.trim();
    const name = document.getElementById("aj-name").value.trim();
    const remark = document.getElementById("aj-remark").value;
    const hotelName = document.getElementById("aj-hotel").value;
    const roomNumber = document.getElementById("aj-room").value.trim();
    
    let roomObj = state.rooms.find(r => r.groupName === groupName && r.hotelName === hotelName && r.roomNumber === roomNumber);
    if (!roomObj) {
      roomObj = {
        id: `rm-${Date.now()}-${Math.random()}`,
        groupName: groupName,
        hotelName: hotelName,
        roomlistNumber: "1",
        roomNumber: roomNumber,
        typeBed: "Quad",
        guests: []
      };
      state.rooms.push(roomObj);
    }
    
    roomObj.guests.push({ guestNo, name, remark });
    saveState();
    closeModal();
    showToast("Jamaah berhasil ditambahkan!");
    if (onComplete) onComplete();
  };
}

function openEditJamaahPopup(roomId, guestNo, onComplete) {
  const roomObj = state.rooms.find(r => r.id === roomId);
  if (!roomObj || !roomObj.guests) return;
  
  const g = roomObj.guests.find(x => x.guestNo === guestNo);
  if (!g) return;
  
  const popupHtml = `
    <form id="edit-jamaah-form-popup">
      <div class="form-group">
        <label class="form-label">No. Urut / ID Jamaah</label>
        <input type="text" id="ej-num" class="form-input" value="${g.guestNo}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nama Lengkap Jamaah</label>
        <input type="text" id="ej-name" class="form-input" value="${g.name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Jenis Kelamin / Remark</label>
        <select id="ej-remark" class="form-select" required>
          <option value="Laki-laki" ${g.remark === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
          <option value="Perempuan" ${g.remark === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor Kamar</label>
        <input type="text" id="ej-room" class="form-input" value="${roomObj.roomNumber}" required>
      </div>
      <button type="submit" class="btn btn-gold" style="margin-top:16px;">SIMPAN PERUBAHAN JAMAAH</button>
    </form>
  `;
  
  openModal(`Edit Jamaah - ${g.name}`, popupHtml);
  
  document.getElementById("edit-jamaah-form-popup").onsubmit = (e) => {
    e.preventDefault();
    g.guestNo = document.getElementById("ej-num").value.trim();
    g.name = document.getElementById("ej-name").value.trim();
    g.remark = document.getElementById("ej-remark").value;
    roomObj.roomNumber = document.getElementById("ej-room").value.trim();
    
    saveState();
    closeModal();
    showToast("Data jamaah berhasil diperbarui!");
    if (onComplete) onComplete();
  };
}

function openJamaahDetailPopup(uniqueCode, roomId, guestNo, onRefresh) {
  const data = findJamaahData(uniqueCode || guestNo);
  if (!data) {
    showToast("Data detail jamaah tidak ditemukan.", "error");
    return;
  }
  
  const popupHtml = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      
      <!-- Top Banner: Avatar, Name, Unique Code, Gender, Passport, Visa, Package Badge -->
      <div style="background:#f8fafc; border-radius:14px; padding:16px; border:1px solid #e2e8f0; display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
        <div style="width:54px; height:54px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:1.6rem; border:2px solid #c5a850;">
          <i data-lucide="user" style="width:28px; height:28px; color:#1e293b;"></i>
        </div>
        <div style="flex:1; min-width:200px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
            <div>
              <strong style="font-size:1.05rem; color:#0f172a; display:block;">${data.name}</strong>
              <span style="font-size:0.78rem; font-weight:900; color:#0070f3; background:#eff6ff; padding:2px 8px; border-radius:6px; border:1px solid #bfdbfe;">${data.uniqueCode}</span>
            </div>
            <span class="badge badge-info" style="background:#0070f3; color:#ffffff; font-size:0.75rem; padding:3px 10px; border-radius:12px; font-weight:800;">${data.package}</span>
          </div>
          <div style="font-size:0.8rem; color:#475569; margin-top:6px;">
            ${data.gender} &bull; ${data.bus} &bull; Paspor: <strong style="color:#1e293b;">${data.passport}</strong> &bull; Visa: <strong style="color:#1e293b;">${data.visa}</strong>
          </div>
        </div>
      </div>
      
      <!-- Body Grid: Live QR Code & Hotel Allocations Across Cities -->
      <div style="display:grid; grid-template-columns: 140px 1fr; gap:14px; align-items:center;">
        
        <!-- Live QR Code Card -->
        <div style="background:#ffffff; border:2px solid #c5a850; border-radius:12px; padding:10px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div id="detail-qrcode-canvas-target" style="width:110px; height:110px; display:flex; align-items:center; justify-content:center;"></div>
          <div style="font-size:0.65rem; font-weight:900; color:#0f172a; margin-top:6px; letter-spacing:0.02em;">QR ID JAMAAH</div>
        </div>
        
        <!-- Hotel Rooms Across All Cities -->
        <div style="display:flex; flex-direction:column; gap:8px;">
          <!-- Madinah -->
          <div style="border-radius:10px; border:1px solid #cbd5e1; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.72rem; font-weight:800; padding:4px 8px; text-transform:uppercase;">Hotel Madinah</div>
            <div style="padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; font-weight:700; color:#334155;">${data.madinahHotel}</span>
              <span style="font-size:1.1rem; font-weight:900; color:#0f172a;">Kmr ${data.madinahRoom}</span>
            </div>
          </div>
          <!-- Makkah -->
          <div style="border-radius:10px; border:1px solid #cbd5e1; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.72rem; font-weight:800; padding:4px 8px; text-transform:uppercase;">Hotel Makkah</div>
            <div style="padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; font-weight:700; color:#334155;">${data.makkahHotel}</span>
              <span style="font-size:1.1rem; font-weight:900; color:#0f172a;">Kmr ${data.makkahRoom}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Baggage details -->
      <div style="background:#f8fafc; border-radius:10px; padding:10px 14px; font-size:0.8rem; border:1px solid #e2e8f0;">
        <strong style="color:#475569; font-size:0.75rem; display:block; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Rincian Barang Bawaan (Bagasi) :</strong>
        <span style="color:#0f172a; font-weight:800;">${data.luggage}</span>
      </div>

      <!-- Action Buttons Footer inside Popup -->
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        <button id="detail-idcard-btn" class="btn btn-gold" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="qr-code"></i> ID Card</button>
        <button id="detail-edit-btn" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="edit"></i> Edit Data</button>
        <button id="detail-delete-btn" class="btn btn-danger" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="trash-2"></i> Hapus</button>
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:10px 14px;">Tutup</button>
      </div>

    </div>
  `;
  
  openModal(`Detail Informasi Jamaah - ${data.uniqueCode}`, popupHtml);
  lucide.createIcons();
  
  // Render dynamic QR code inside detail popup
  setTimeout(() => {
    const target = document.getElementById("detail-qrcode-canvas-target");
    if (target) {
      target.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(target, {
            text: data.uniqueCode,
            width: 105,
            height: 105,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: 2
          });
        } catch(e) {
          target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=105x105&data=${encodeURIComponent(data.uniqueCode)}" style="width:105px; height:105px;">`;
        }
      } else {
        target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=105x105&data=${encodeURIComponent(data.uniqueCode)}" style="width:105px; height:105px;">`;
      }
    }
  }, 100);
  
  // Bind Action Buttons inside Popup
  document.getElementById("detail-idcard-btn").onclick = () => {
    closeModal();
    openJamaahIdCardPopup(data.uniqueCode);
  };
  
  document.getElementById("detail-edit-btn").onclick = () => {
    closeModal();
    openEditJamaahPopup(roomId, guestNo, onRefresh);
  };
  
  document.getElementById("detail-delete-btn").onclick = () => {
    if (confirm(`Hapus jamaah ${data.name} (${data.uniqueCode}) dari grup ini?`)) {
      const roomObj = state.rooms.find(r => r.id === roomId);
      if (roomObj && roomObj.guests) {
        roomObj.guests = roomObj.guests.filter(x => x.guestNo !== guestNo);
        saveState();
        closeModal();
        showToast("Jamaah berhasil dihapus.");
        if (onRefresh) onRefresh();
      }
    }
  };
}

function openJamaahIdCardPopup(uniqueCode) {
  const data = findJamaahData(uniqueCode);
  if (!data) {
    showToast("Data jamaah tidak ditemukan.", "error");
    return;
  }
  
  const cardHtml = `
    <div id="jamaah-id-card-print-target" style="width:100%; max-width:380px; margin:0 auto; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:18px; padding:20px; color:#ffffff; font-family:'Mulish', sans-serif; border:2px solid #c5a850; box-shadow:0 10px 25px rgba(0,0,0,0.3); position:relative; overflow:hidden;">
      
      <div style="position:absolute; top:-30px; right:-30px; width:120px; height:120px; background:rgba(197,168,80,0.12); border-radius:50%; pointer-events:none;"></div>
      
      <!-- Card Header -->
      <div style="text-align:center; border-bottom:1px solid rgba(197,168,80,0.4); padding-bottom:12px; margin-bottom:14px;">
        <div style="font-size:0.7rem; font-weight:800; color:#c5a850; text-transform:uppercase; letter-spacing:0.12em;">KARTU IDENTITAS JAMAAH UMROH</div>
        <div style="font-size:1.15rem; font-weight:900; color:#ffffff; font-family:'Martel', serif; text-transform:lowercase; margin-top:2px;">jejak imani</div>
        <div style="font-size:0.65rem; color:#94a3b8;">SAUDI HANDLING OPERATIONS & MANAGEMENT</div>
      </div>
      
      <!-- Card Body -->
      <div style="display:flex; gap:14px; align-items:center;">
        <div style="flex:1;">
          <div style="font-size:0.68rem; color:#94a3b8; text-transform:uppercase;">Nama Jamaah</div>
          <div style="font-size:1rem; font-weight:900; color:#ffffff; margin-bottom:8px; line-height:1.2;">${data.name}</div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.75rem; color:#cbd5e1;">
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Kode Unik</span><strong style="color:#c5a850; font-size:0.85rem;">${data.uniqueCode}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Jenis Kelamin</span><strong>${data.gender}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Paket</span><strong>${data.package}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Bus</span><strong>${data.bus}</strong></div>
          </div>
        </div>
        
        <!-- Dynamic QR Code Container -->
        <div style="background:#ffffff; padding:8px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid #c5a850; width:100px; min-width:100px;">
          <div id="qrcode-canvas-target" style="width:90px; height:90px; display:flex; align-items:center; justify-content:center;"></div>
          <div style="font-size:0.55rem; color:#0f172a; font-weight:800; margin-top:4px; text-align:center;">SCAN ME</div>
        </div>
      </div>
      
      <!-- Hotel Summary -->
      <div style="margin-top:14px; background:rgba(255,255,255,0.06); border-radius:10px; padding:10px; font-size:0.72rem; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>📍 Madinah: <strong style="color:#ffffff;">${data.madinahHotel}</strong></span>
          <span style="color:#c5a850; font-weight:800;">Kmr ${data.madinahRoom}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>📍 Makkah: <strong style="color:#ffffff;">${data.makkahHotel}</strong></span>
          <span style="color:#c5a850; font-weight:800;">Kmr ${data.makkahRoom}</span>
        </div>
      </div>
      
      <!-- Card Footer -->
      <div style="margin-top:10px; font-size:0.68rem; color:#94a3b8; text-align:center;">
        Paspor: <strong style="color:#e2e8f0;">${data.passport}</strong> &bull; Visa: <strong style="color:#e2e8f0;">${data.visa}</strong>
      </div>
    </div>
    
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button id="print-single-idcard-btn" class="btn btn-gold" style="flex:1;"><i data-lucide="printer"></i> Cetak ID Card</button>
      <button class="btn btn-secondary" onclick="closeModal()" style="width:auto;">Tutup</button>
    </div>
  `;
  
  openModal(`Kartu Identitas Jamaah - ${data.uniqueCode}`, cardHtml);
  lucide.createIcons();
  
  setTimeout(() => {
    const target = document.getElementById("qrcode-canvas-target");
    if (target) {
      target.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(target, {
            text: data.uniqueCode,
            width: 88,
            height: 88,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: 2
          });
        } catch(e) {
          target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data.uniqueCode)}" style="width:88px; height:88px;">`;
        }
      } else {
        target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data.uniqueCode)}" style="width:88px; height:88px;">`;
      }
    }
  }, 100);
  
  const pBtn = document.getElementById("print-single-idcard-btn");
  if (pBtn) pBtn.onclick = () => window.print();
}

function renderAdminRoomlist() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <!-- Compact Top Filter -->
    <div class="admin-card" style="padding:12px; margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <select id="rl-filter-group" class="form-select" style="flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Rombongan Grup</option>
          ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
        </select>
        <select id="rl-filter-hotel" class="form-select" style="flex:1; min-width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Hotel</option>
        </select>
        <button id="add-rl-popup-btn" class="btn btn-gold" style="width:auto; padding:6px 14px; font-size:0.85rem; margin:0;"><i data-lucide="plus-circle"></i> Tambah Roomlist Baru</button>
      </div>
    </div>
    
    <!-- Render active filtered roomlists (Table) -->
    <div id="admin-filtered-roomlists-container">
      <p style="text-align:center; color:var(--text-light); font-size:0.9rem; padding:20px;">Silakan pilih filter Grup dan Nama Hotel di atas terlebih dahulu untuk memuat template roomlist.</p>
    </div>
  `;
  
  lucide.createIcons();
  
  const gSelect = document.getElementById("rl-filter-group");
  const hSelect = document.getElementById("rl-filter-hotel");
  const filteredContainer = document.getElementById("admin-filtered-roomlists-container");
  
  gSelect.onchange = () => {
    const groupName = gSelect.value;
    hSelect.innerHTML = `<option value="">Semua Hotel</option>`;
    filteredContainer.innerHTML = `<p style="text-align:center; color:var(--text-light); font-size:0.9rem; padding:20px;">Silakan pilih hotel untuk menampilkan data.</p>`;
    
    const group = state.groups.find(g => g.name === groupName);
    if (group && group.hotels) {
      group.hotels.forEach(h => {
        hSelect.innerHTML += `<option value="${h}">${h}</option>`;
      });
    }
  };
  
  const updateTableData = () => {
    const groupName = gSelect.value;
    const hotelName = hSelect.value;
    if (groupName && hotelName) {
      renderFilteredAdminRoomlists(groupName, hotelName);
    }
  };
  hSelect.onchange = updateTableData;
  
  document.getElementById("add-rl-popup-btn").onclick = () => openRoomlistFormPopup(gSelect.value, hSelect.value, updateTableData);
}

function renderFilteredAdminRoomlists(groupName, hotelName) {
  const container = document.getElementById("admin-filtered-roomlists-container");
  const filtered = state.rooms.filter(r => r.groupName === groupName && r.hotelName === hotelName);
  
  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:20px;">Belum ada template roomlist untuk filter ini. Silakan buat yang baru.</p>`;
    return;
  }
  
  container.innerHTML = `
    <div class="table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Roomlist</th>
              <th>Kamar</th>
              <th>Bed</th>
              <th>No. Jamaah</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((r, idx) => {
              const guestNumbersHtml = r.guests.map(g => `<div><code>${g.guestNo}</code></div>`).join('');
              const hasRemarks = r.guests.some(g => g.remark && g.remark.trim() !== "" && g.remark !== "none");
              
              let remarkIconHtml = '-';
              if (hasRemarks) {
                const gRem = r.guests.find(g => g.remark && g.remark !== "none");
                const firstRem = gRem?.remark;
                const remText = gRem?.remarkText;
                const titleAttr = remText ? `${firstRem}: ${remText}` : firstRem;
                if (firstRem === 'warning') {
                  remarkIconHtml = `<span style="color:#d97706; font-weight:bold;" title="${titleAttr}">⚠️ ${remText ? `(${remText})` : ''}</span>`;
                } else {
                  remarkIconHtml = `<span style="background:${getHexColor(firstRem)}; width:12px; height:12px; border-radius:50%; display:inline-block; margin-right:4px;" title="${titleAttr}"></span> <span style="font-size:0.75rem; color:#475569; font-weight:700;">${remText || firstRem}</span>`;
                }
              }
              
              let cleanBed = r.typeBed;
              if (cleanBed.includes("Double")) cleanBed = "Twin";
              else if (cleanBed.includes("Triple")) cleanBed = "Triple";
              else if (cleanBed.includes("Quad")) cleanBed = "Quad";

              return `
                <tr class="clickable-admin-room-row" data-idx="${idx}" style="cursor:pointer;">
                  <td><strong>${r.roomlistNumber}</strong></td>
                  <td><span style="color:var(--primary-gold); font-weight:700;">${r.roomNumber}</span></td>
                  <td>${cleanBed}</td>
                  <td>${guestNumbersHtml}</td>
                  <td style="text-align:center;">${remarkIconHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  // Bind row click to open popup details
  container.querySelectorAll(".clickable-admin-room-row").forEach(row => {
    row.onclick = () => {
      const idx = parseInt(row.getAttribute("data-idx"));
      const room = filtered[idx];
      if (!room) return;
      
      const popupDetailHtml = `
        <div style="font-size:0.95rem; margin-bottom:16px;">
          <p><strong>Grup:</strong> ${room.groupName}</p>
          <p><strong>Hotel:</strong> ${room.hotelName}</p>
          <p><strong>Roomlist No:</strong> ${room.roomlistNumber} | <strong>Bed:</strong> ${room.typeBed}</p>
          <p><strong>Nomor Kamar:</strong> <span style="color:var(--primary-gold); font-weight:800;">${room.roomNumber}</span></p>
          
          <h5 style="margin-top:20px; margin-bottom:8px; font-weight:800;">Daftar Tamu & Indikator Remark</h5>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${room.guests.map(g => {
              let remarkIndicator = "";
              const remDesc = g.remarkText ? ` (${g.remarkText})` : "";
              if (g.remark === "warning") remarkIndicator = `⚠️ Warning${remDesc}`;
              else if (g.remark && g.remark !== "none") {
                remarkIndicator = `<span style="background:${getHexColor(g.remark)}; width:12px; height:12px; border-radius:50%; display:inline-block; margin-right:4px;"></span> <strong>${g.remark}</strong>${remDesc}`;
              }
              return `<div><code>${g.guestNo}</code> ${g.name} ${remarkIndicator ? `| ${remarkIndicator}` : ''}</div>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="popup-detail-edit-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;">Edit Kamar</button>
          <button id="popup-detail-delete-btn" class="btn btn-danger" style="width:auto; padding:8px 16px;">Hapus Kamar</button>
        </div>
      `;
      
      openModal(`Detail Kamar ${room.roomNumber}`, popupDetailHtml);
      
      document.getElementById("popup-detail-edit-btn").onclick = () => {
        closeModal();
        openEditRoomlistRowPopup(room, () => renderFilteredAdminRoomlists(groupName, hotelName));
      };
      
      document.getElementById("popup-detail-delete-btn").onclick = () => {
        if (confirm(`Hapus kamar ${room.roomNumber} dari roomlist?`)) {
          state.rooms = state.rooms.filter(x => x.id !== room.id);
          saveState();
          closeModal();
          showToast("Kamar roomlist berhasil dihapus.");
          renderFilteredAdminRoomlists(groupName, hotelName);
        }
      };
    };
  });
}
function openEditRoomlistRowPopup(roomObj, onComplete) {
  const popupHtml = `
    <form id="edit-rl-row-form">
      <div class="form-group"><label class="form-label">No. Roomlist</label><input type="text" id="erl-num" class="form-input" value="${roomObj.roomlistNumber}" required></div>
      <div class="form-group"><label class="form-label">No. Kamar</label><input type="text" id="erl-room" class="form-input" value="${roomObj.roomNumber}" required></div>
      <div class="form-group">
        <label class="form-label">Tipe Kasur</label>
        <select id="erl-bed" class="form-select" required>
          <option value="Twin" ${roomObj.typeBed === 'Twin' || roomObj.typeBed === 'Double' ? 'selected' : ''}>Twin</option>
          <option value="King" ${roomObj.typeBed === 'King' ? 'selected' : ''}>King</option>
          <option value="Triple" ${roomObj.typeBed === 'Triple' ? 'selected' : ''}>Triple</option>
          <option value="Quad" ${roomObj.typeBed === 'Quad' ? 'selected' : ''}>Quad</option>
        </select>
      </div>
      
      <label class="form-label">Daftar Jamaah & Indikator Remark</label>
      <div id="erl-guests-rows" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"></div>
      <button type="button" id="erl-add-guest-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; margin-bottom:16px;">+ Tambah Jamaah</button>
      
      <button type="submit" class="btn btn-primary">SIMPAN PERUBAHAN KAMAR</button>
    </form>
  `;
  openModal(`Sunting Kamar ${roomObj.roomNumber}`, popupHtml);
  
  const guestsContainer = document.getElementById("erl-guests-rows");
  
  const addGuestRow = (num = "", name = "", rem = "none", remText = "") => {
    const rowId = `erl-g-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card erl-guest-item-row";
    div.id = rowId;
    
    const colors = ['none', 'Gold', 'Emerald', 'Ruby', 'Sapphire', 'Amber', 'Violet', 'Rose', 'Slate', 'Teal', 'Bronze', 'warning'];
    const dotsHtml = colors.map(c => {
      let isSel = (rem === c || (!rem && c === 'none'));
      if (c === 'warning' && (rem === 'warning' || rem === '⚠️')) isSel = true;
      
      let style = "";
      let text = "";
      if (c === 'none') style = "background:#e2e8f0; border:1px solid #aaa;";
      else if (c === 'warning') {
        style = "background:#fef08a; border:1px solid #d97706; color:#a16207; font-size:10px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;";
        text = "⚠️";
      } else {
        style = `background:${getHexColor(c)};`;
      }
      return `<span class="color-dot ${isSel ? 'selected' : ''}" data-val="${c}" style="${style} width:18px; height:18px; border-radius:50%; display:inline-block; cursor:pointer;" title="${c}">${text}</span>`;
    }).join('');

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Data Jamaah</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <input type="number" class="form-input g-num" placeholder="No." style="max-width:80px;" value="${num}" required>
        <input type="text" class="form-input g-name" placeholder="Nama Lengkap" value="${name}" required>
      </div>
      <div style="margin-top:8px;">
        <label class="form-label" style="font-size:0.75rem; font-weight:700;">Indikator Remark & Keterangan Arti Warna</label>
        <input type="hidden" class="g-rem" value="${rem}">
        <div class="color-picker-row" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px; margin-bottom:6px;">
          ${dotsHtml}
        </div>
        <input type="text" class="form-input g-rem-text" placeholder="Keterangan / Arti Warna (mis. Kursi Roda, Infan, Catatan Medis)..." value="${remText || ''}" style="font-size:0.8rem; padding:4px 8px; margin-top:4px;">
      </div>
    `;
    guestsContainer.appendChild(div);
    
    const dots = div.querySelectorAll(".color-dot");
    const hiddenInp = div.querySelector(".g-rem");
    dots.forEach(d => {
      d.onclick = () => {
        dots.forEach(dot => dot.classList.remove("selected"));
        d.classList.add("selected");
        hiddenInp.value = d.getAttribute("data-val");
      };
    });
  };
  
  roomObj.guests.forEach(g => addGuestRow(g.guestNo, g.name, g.remark, g.remarkText || ''));
  document.getElementById("erl-add-guest-btn").onclick = () => addGuestRow();
  
  document.getElementById("edit-rl-row-form").onsubmit = (e) => {
    e.preventDefault();
    roomObj.roomlistNumber = document.getElementById("erl-num").value;
    roomObj.roomNumber = document.getElementById("erl-room").value;
    roomObj.typeBed = document.getElementById("erl-bed").value;
    
    const rows = guestsContainer.querySelectorAll(".erl-guest-item-row");
    roomObj.guests = Array.from(rows).map(row => ({
      guestNo: row.querySelector(".g-num").value,
      name: row.querySelector(".g-name").value.trim(),
      remark: row.querySelector(".g-rem").value,
      remarkText: row.querySelector(".g-rem-text") ? row.querySelector(".g-rem-text").value.trim() : ""
    }));
    
    saveState();
    closeModal();
    showToast("Data Kamar diperbarui!");
    if (onComplete) onComplete();
  };
}
function openRoomlistFormPopup(prefillGroup = "", prefillHotel = "", onComplete) {
  const groupNames = state.groups.map(g => g.name);
  
  const popupHtml = `
    <form id="rl-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <select id="rl-group-select-popup" class="form-select" required>
          <option value="">-- Pilih Grup --</option>
          ${groupNames.map(g => `<option value="${g}" ${g === prefillGroup ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nama Hotel (Dinamis)</label>
        <select id="rl-hotel-select-popup" class="form-select" required>
          <option value="">-- Pilih Hotel --</option>
        </select>
      </div>
      
      <h5 style="margin-top:16px; margin-bottom:10px; font-weight:800;">Daftar Kamar Hotel</h5>
      <div id="rl-rooms-rows-popup"></div>
      <button type="button" id="rl-add-room-row-btn-popup" class="btn btn-secondary" style="width:auto; padding:6px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Kamar</button>
      
      <button type="submit" class="btn btn-gold">Simpan Template</button>
    </form>
  `;
  openModal("Tambah Template Roomlist (Pop Up)", popupHtml);
  
  const gSelect = document.getElementById("rl-group-select-popup");
  const hSelect = document.getElementById("rl-hotel-select-popup");
  
  const updateHotels = () => {
    const gn = gSelect.value;
    hSelect.innerHTML = `<option value="">-- Pilih Hotel --</option>`;
    const group = state.groups.find(g => g.name === gn);
    if (group && group.hotels) {
      group.hotels.forEach(h => {
        hSelect.innerHTML += `<option value="${h}" ${h === prefillHotel ? 'selected' : ''}>${h}</option>`;
      });
    }
  };
  gSelect.onchange = updateHotels;
  updateHotels();
  
  const rowsContainer = document.getElementById("rl-rooms-rows-popup");
  const addRoomRow = () => {
    const cardId = `rl-card-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card rl-room-card-row-popup";
    div.id = cardId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>Kamar Baru</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${cardId}').remove()">&times;</button>
      </div>
      <div class="grid-3col">
        <div class="form-group"><label class="form-label">No. Roomlist</label><input type="text" class="form-input rl-num" placeholder="RL-01" required></div>
        <div class="form-group"><label class="form-label">No. Kamar</label><input type="text" class="form-input room-num" placeholder="Kamar 101" required></div>
        <div class="form-group">
          <label class="form-label">Tipe Kasur</label>
          <select class="form-select bed-type" required>
            <option value="Twin">Twin</option>
            <option value="King">King</option>
            <option value="Triple">Triple</option>
            <option value="Quad">Quad</option>
          </select>
        </div>
      </div>
      
      <label class="form-label">Daftar Tamu & Indikator Remark</label>
      <div class="guests-rows-container-popup" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
      <button type="button" class="btn btn-secondary add-guest-row-popup-btn" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Tamu</button>
    `;
    rowsContainer.appendChild(div);
    
    const growContainer = div.querySelector(".guests-rows-container-popup");
    const addGuestBtn = div.querySelector(".add-guest-row-popup-btn");
    
    const addGuestFn = () => {
      const rId = `g-row-${Date.now()}-${Math.random()}`;
      const gdiv = document.createElement("div");
      gdiv.className = "nested-form-card rl-guest-row-popup";
      gdiv.id = rId;
      
      const colors = ['none', 'Gold', 'Emerald', 'Ruby', 'Sapphire', 'Amber', 'Violet', 'Rose', 'Slate', 'Teal', 'Bronze', 'warning'];
      const dotsHtml = colors.map(c => {
        let style = "";
        let text = "";
        if (c === 'none') style = "background:#e2e8f0; border:1px solid #aaa;";
        else if (c === 'warning') {
          style = "background:#fef08a; border:1px solid #d97706; color:#a16207; font-size:10px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;";
          text = "⚠️";
        } else {
          style = `background:${getHexColor(c)};`;
        }
        return `<span class="color-dot ${c === 'none' ? 'selected' : ''}" data-val="${c}" style="${style} width:18px; height:18px; border-radius:50%; display:inline-block; cursor:pointer;" title="${c}">${text}</span>`;
      }).join('');

      gdiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>Jamaah</strong>
          <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rId}').remove()">&times;</button>
        </div>
        <div class="grid-2col" style="gap:8px;">
          <input type="number" class="form-input g-num" placeholder="No." style="max-width:60px;" required>
          <input type="text" class="form-input g-name" placeholder="Nama Jamaah" required>
        </div>
        <div style="margin-top:8px;">
          <label class="form-label" style="font-size:0.75rem; font-weight:700;">Indikator Remark & Keterangan Arti Warna</label>
          <input type="hidden" class="g-rem" value="none">
          <div class="color-picker-row" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px; margin-bottom:6px;">
            ${dotsHtml}
          </div>
          <input type="text" class="form-input g-rem-text" placeholder="Isi Keterangan / Arti Warna (mis. Kursi Roda, Infan, Catatan Medis)..." style="font-size:0.8rem; padding:4px 8px; margin-top:4px;">
        </div>
      `;
      growContainer.appendChild(gdiv);
      
      const dots = gdiv.querySelectorAll(".color-dot");
      const hiddenInp = gdiv.querySelector(".g-rem");
      dots.forEach(d => {
        d.onclick = () => {
          dots.forEach(dot => dot.classList.remove("selected"));
          d.classList.add("selected");
          hiddenInp.value = d.getAttribute("data-val");
        };
      });
    };
    
    addGuestBtn.onclick = addGuestFn;
    addGuestFn();
  };
  
  document.getElementById("rl-add-room-row-btn-popup").onclick = addRoomRow;
  addRoomRow();
  
  document.getElementById("rl-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gSelect.value;
    const hotelName = hSelect.value;
    
    const roomCards = rowsContainer.querySelectorAll(".rl-room-card-row-popup");
    roomCards.forEach(row => {
      const roomlistNumber = row.querySelector(".rl-num").value;
      const roomNumber = row.querySelector(".room-num").value;
      const typeBed = row.querySelector(".bed-type").value;
      
      const guestRows = row.querySelectorAll(".rl-guest-row-popup");
      const guests = Array.from(guestRows).map(gr => ({
        guestNo: gr.querySelector(".g-num").value,
        name: gr.querySelector(".g-name").value.trim(),
        remark: gr.querySelector(".g-rem").value,
        remarkText: gr.querySelector(".g-rem-text") ? gr.querySelector(".g-rem-text").value.trim() : ""
      }));
      
      state.rooms.push({ id: `rm-${Date.now()}-${Math.random()}`, groupName, hotelName, roomlistNumber, roomNumber, typeBed, guests });
    });
    
    saveState();
    closeModal();
    showToast("Template Roomlist disimpan!");
    if (onComplete) onComplete();
  };
}
// --- ADMIN SUB-VIEW: DOKUMEN ---
function cleanDocName(name, groupName) {
  if (!name) return "Dokumen Tanpa Nama";
  let clean = name;
  if (groupName && groupName !== "Umum") {
    const escapedGroup = groupName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    clean = clean.replace(new RegExp(`\\s*[-–—:]?\\s*${escapedGroup}`, 'gi'), '');
    clean = clean.replace(new RegExp(`${escapedGroup}\\s*[-–—:]?\\s*`, 'gi'), '');
  }
  clean = clean.trim();
  return clean || name;
}

function renderAdminDokumen() {
  const container = document.getElementById("admin-subview-content");
  if (!container) return;
  
  let visibleDocs = state.documents || [];
  if (adminDocGroupFilter !== "") {
    visibleDocs = visibleDocs.filter(d => d && (d.groupName === adminDocGroupFilter || d.groupName === "Umum"));
  }

  // Group documents by groupName
  const groupedDocs = {};
  visibleDocs.forEach(d => {
    if (!d) return;
    const gN = d.groupName || "Umum";
    if (!groupedDocs[gN]) groupedDocs[gN] = [];
    groupedDocs[gN].push(d);
  });

  const sortedGroups = Object.keys(groupedDocs);
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:12px; flex-grow:1; max-width:400px; position:relative;">
        <label style="font-weight:700; font-size:0.85rem; flex-shrink:0;">Filter Grup:</label>
        <input type="text" id="doc-grup-filter-search" class="form-input" value="${adminDocGroupFilter || ''}" placeholder="Ketik nama grup...">
        <div id="doc-grup-filter-suggestions" class="suggestion-list hidden"></div>
      </div>
      <button id="add-doc-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Link Dokumen Baru</button>
    </div>
    
    <div id="admin-doc-accordion-container" style="display:flex; flex-direction:column; gap:12px;">
      ${sortedGroups.length === 0 ? `
        <p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:24px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">Belum ada link dokumen yang disimpan.</p>
      ` : sortedGroups.map((gName, idx) => {
        const docList = groupedDocs[gName];
        const headerId = `doc-acc-header-${idx}`;
        const bodyId = `doc-acc-body-${idx}`;
        const iconId = `doc-acc-icon-${idx}`;

        return `
          <div style="border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div id="${headerId}" style="padding:14px 18px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; border-bottom:1px solid #e2e8f0; transition:all 0.2s;">
              <div style="display:flex; align-items:center; gap:10px;">
                <i data-lucide="folder-open" style="width:18px; height:18px; color:#c5a850;"></i>
                <span style="font-weight:800; font-size:0.92rem; color:#0f172a;">${gName}</span>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge badge-gold" style="font-size:0.75rem; padding:3px 10px; border-radius:12px; font-weight:800;">${docList.length} Link Dokumen</span>
                <i data-lucide="chevron-down" id="${iconId}" style="width:18px; height:18px; color:#64748b; transform:rotate(-90deg); transition:transform 0.2s;"></i>
              </div>
            </div>
            
            <div id="${bodyId}" class="doc-accordion-body hidden" style="padding:0; display:none;">
              <div class="table-wrapper">
                <table class="data-table" style="margin:0; width:100%;">
                  <thead>
                    <tr style="background:#fafafa;">
                      <th style="padding-left:18px;">Nama Dokumen</th>
                      <th style="text-align:right; padding-right:18px;">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${docList.map(d => {
                      const targetUrl = d.linkUrl || d.link || d.fileUrl || "#";
                      return `
                        <tr>
                          <td style="padding-left:18px;">
                            <div style="font-weight:800; font-size:0.88rem; color:#0f172a;">${d.name || 'Dokumen Rombongan'}</div>
                          </td>
                          <td style="text-align:right; padding-right:18px;">
                            <div style="display:inline-flex; gap:6px; justify-content:flex-end;">
                              <a href="${targetUrl}" target="_blank" class="btn btn-gold" style="width:auto; padding:5px 10px; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:4px; text-decoration:none;">
                                <i data-lucide="external-link" style="width:13px; height:13px;"></i> Buka Link
                              </a>
                              <button class="btn btn-danger delete-doc-btn" data-id="${d.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                                <i data-lucide="trash-2" style="width:13px; height:13px;"></i> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  lucide.createIcons();
  
  initSuggestionInput("doc-grup-filter-search", "doc-grup-filter-suggestions", state.groups.map(g => g.name), (name) => {
    adminDocGroupFilter = name;
    renderAdminDokumen();
  });

  const filterInp = document.getElementById("doc-grup-filter-search");
  if (filterInp) {
    filterInp.oninput = (e) => {
      if (e.target.value === "") {
        adminDocGroupFilter = "";
        renderAdminDokumen();
      }
    };
  }

  // Bind Accordion Toggles
  sortedGroups.forEach((gName, idx) => {
    const headerEl = document.getElementById(`doc-acc-header-${idx}`);
    const bodyEl = document.getElementById(`doc-acc-body-${idx}`);
    const iconEl = document.getElementById(`doc-acc-icon-${idx}`);
    if (headerEl && bodyEl && iconEl) {
      headerEl.onclick = () => {
        const isHidden = (bodyEl.style.display === 'none' || bodyEl.classList.contains("hidden"));
        if (isHidden) {
          bodyEl.style.display = 'block';
          bodyEl.classList.remove("hidden");
          iconEl.style.transform = "rotate(0deg)";
        } else {
          bodyEl.style.display = 'none';
          bodyEl.classList.add("hidden");
          iconEl.style.transform = "rotate(-90deg)";
        }
      };
    }
  });

  // Bind Delete Buttons
  document.querySelectorAll(".delete-doc-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (confirm("Hapus link dokumen ini dari arsip?")) {
        const idx = state.documents.findIndex(d => d.id === id);
        if (idx !== -1) {
          state.documents.splice(idx, 1);
          saveState();
          showToast("Link dokumen dihapus.");
          renderAdminDokumen();
        }
      }
    };
  });
  
  document.getElementById("add-doc-popup-btn").onclick = () => {
    const popupHtml = `
      <form id="doc-submit-form-popup">
        <div class="form-group" style="position:relative;">
          <label class="form-label" style="font-size:0.82rem; font-weight:800;">1. Pilih / Ketik Grup</label>
          <input type="text" id="ad-group-search" class="form-input" placeholder="Ketik nama grup (atau 'Umum')..." required style="font-size:0.85rem;">
          <div id="ad-group-suggestions" class="suggestion-list hidden"></div>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.82rem; font-weight:800;">2. Nama Dokumen</label>
          <input type="text" id="ad-name" class="form-input" placeholder="Mis. Manifest Jamaah Umroh PDF / Rooming List" required style="font-size:0.85rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.82rem; font-weight:800;">3. Link Dokumen (URL)</label>
          <input type="url" id="ad-link-url" class="form-input" placeholder="https://drive.google.com/file/d/... atau https://..." required style="font-size:0.85rem;">
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%; padding:12px; font-weight:900; border-radius:12px;">
          SIMPAN LINK DOKUMEN
        </button>
      </form>
    `;
    openModal("Tambah Link Dokumen Baru", popupHtml);
    
    initSuggestionInput("ad-group-search", "ad-group-suggestions", ["Umum", ...state.groups.map(g => g.name)]);
    
    document.getElementById("doc-submit-form-popup").onsubmit = (e) => {
      e.preventDefault();
      const groupName = document.getElementById("ad-group-search").value.trim();
      const name = document.getElementById("ad-name").value.trim();
      let linkUrl = document.getElementById("ad-link-url").value.trim();
      
      if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
        linkUrl = 'https://' + linkUrl;
      }
      
      state.documents.push({
        id: `doc-${Date.now()}`,
        groupName,
        name,
        linkUrl,
        date: getSaudiDateTime().gregorianStr
      });
      saveState();
      closeModal();
      showToast("Link dokumen berhasil disimpan!");
      renderAdminDokumen();
    };
  };
}

function renderAdminAset() {
  const container = document.getElementById("admin-subview-content");
  if (!container) return;
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px;">
      <input type="text" id="asset-search-input" class="form-input" placeholder="Cari nama barang atau lokasi aset..." style="max-width:300px;">
      <button id="add-asset-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px; font-weight:800; display:inline-flex; align-items:center; gap:6px;"><i data-lucide="plus-circle" style="width:16px; height:16px; color:#fff;"></i> Tambah Aset Baru</button>
    </div>
    
    <div class="table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Barang</th>
              <th>Status</th>
              <th>Jumlah</th>
              <th>Lokasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="asset-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  
  const searchInp = document.getElementById("asset-search-input");
  const renderAssetList = () => {
    const query = searchInp ? searchInp.value.toLowerCase().trim() : "";
    const tbody = document.getElementById("asset-tbody");
    if (!tbody) return;

    if (!state.assets) state.assets = [];
    const filtered = state.assets.filter(a => 
      (a.name || "").toLowerCase().includes(query) || 
      (a.location || "").toLowerCase().includes(query) || 
      (a.status || "").toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light); padding:24px;">Tidak ada barang aset ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filtered.map((a, idx) => `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>
          <span class="badge ${a.status === 'Tersedia' ? 'badge-success' : (a.status === 'Digunakan' ? 'badge-gold' : 'badge-warning')}">
            ${a.status}
          </span>
        </td>
        <td><code>${a.qty} Pcs</code></td>
        <td>${a.location}</td>
        <td>
          <div class="action-btn-group" style="display:flex; gap:6px;">
            <button class="btn btn-secondary edit-asset-popup-btn" data-idx="${state.assets.indexOf(a)}" style="width:auto; padding:5px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; border-color:#cbd5e1; font-weight:700;">
              <i data-lucide="edit-3" style="width:14px; height:14px; color:#0f172a;"></i> Edit
            </button>
            <button class="btn btn-danger delete-asset-btn" data-idx="${state.assets.indexOf(a)}" style="width:auto; padding:5px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; font-weight:700;">
              <i data-lucide="trash-2" style="width:14px; height:14px; color:#ef4444;"></i> Hapus
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    bindAssetActions();
  };

  const bindAssetActions = () => {
    document.querySelectorAll(".edit-asset-popup-btn").forEach(btn => {
      btn.onclick = () => openAssetFormPopup(parseInt(btn.getAttribute("data-idx")));
    });
    document.querySelectorAll(".delete-asset-btn").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-idx"));
        if (confirm("Hapus barang aset ini?")) {
          state.assets.splice(idx, 1);
          saveState();
          showToast("Aset berhasil dihapus.");
          renderAdminAset();
          try { lucide.createIcons(); } catch(e) {}
        }
      };
    });
  };

  if (searchInp) searchInp.oninput = renderAssetList;
  renderAssetList();
  
  const addBtn = document.getElementById("add-asset-popup-btn");
  if (addBtn) addBtn.onclick = () => openAssetFormPopup();
}
function openAssetFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const a = isEdit ? state.assets[editIdx] : null;
  
  const popupHtml = `
    <form id="asset-submit-form-popup">
      <div class="form-group"><label class="form-label">Nama Barang</label><input type="text" id="aa-name" class="form-input" value="${isEdit ? a.name : ''}" required></div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="aa-status" class="form-select" required>
          <option value="Tersedia" ${isEdit && a.status === 'Tersedia' ? 'selected' : ''}>Tersedia di Gudang</option>
          <option value="Digunakan" ${isEdit && a.status === 'Digunakan' ? 'selected' : ''}>Sedang Digunakan Lapangan</option>
          <option value="Rusak" ${isEdit && a.status === 'Rusak' ? 'selected' : ''}>Rusak / Perlu Perbaikan</option>
        </select>
      </div>
      <div class="grid-2col">
        <div class="form-group"><label class="form-label">Jumlah (Pcs)</label><input type="number" id="aa-qty" class="form-input" value="${isEdit ? a.qty : 1}" min="1" required></div>
        <div class="form-group"><label class="form-label">Lokasi</label><input type="text" id="aa-loc" class="form-input" value="${isEdit ? a.location : ''}" required></div>
      </div>
      <button type="submit" class="btn btn-primary">SIMPAN ASET</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Aset (Pop Up)" : "Tambah Aset Baru (Pop Up)", popupHtml);
  
  document.getElementById("asset-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("aa-name").value.trim();
    const status = document.getElementById("aa-status").value;
    const qty = parseInt(document.getElementById("aa-qty").value);
    const location = document.getElementById("aa-loc").value.trim();
    
    if (isEdit) {
      state.assets[editIdx].name = name; state.assets[editIdx].status = status; state.assets[editIdx].qty = qty; state.assets[editIdx].location = location;
    } else {
      state.assets.push({ id: `ast-${Date.now()}`, name, status, qty, location });
    }
    
    saveState();
    closeModal();
    showToast("Aset disimpan!");
    renderAdminAset();
  };
}


function openBookingPdfPopup(bookingId) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return;
  
  const vendor = state.vendors.find(x => x.id === b.vendorId);
  const vName = vendor ? vendor.name : "Vendor Dihapus";
  const vType = vendor ? vendor.type : "Umum";
  const group = state.groups.find(x => x.name === b.groupName);
  const tlName = group && group.leaders ? group.leaders.join(', ') : "Belum Ditentukan";
  
  const totalAmount = b.products ? b.products.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
  
  const pdfHtml = `
    <div id="booking-po-print-area" style="font-family:'Mulish', sans-serif; color:#1e293b; padding:16px;">
      <!-- Corporate Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid var(--primary-gold); padding-bottom:12px; margin-bottom:20px;">
        <div>
          <h2 style="font-family:'Martel', serif; text-transform:lowercase; font-weight:900; color:var(--text-main); font-size:1.4rem; margin:0;">jejak imani</h2>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:2px 0 0 0;">Saudi Operations & Handling Department</p>
        </div>
        <div style="text-align:right;">
          <h3 style="font-size:0.95rem; font-weight:800; margin:0; text-transform:uppercase; color:var(--primary-gold);">Pemesanan Vendor (Booking)</h3>
          <p style="font-size:0.75rem; margin:4px 0 0 0;">No. Dokumen: <code>BOK-${(b.id || "").substring(2,8).toUpperCase()}</code></p>
        </div>
      </div>
      
      <!-- Grid Details -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:0.8rem; margin-bottom:20px; background:#f8f9fa; padding:12px; border-radius:6px;">
        <div>
          <strong>Informasi Operasional:</strong>
          <div style="margin-top:6px;">Grup: <strong>${b.groupName}</strong></div>
          <div style="margin-top:2px;">Tour Leader: ${tlName}</div>
          <div style="margin-top:2px;">Kegiatan: ${b.activity || '-'}</div>
        </div>
        <div>
          <strong>Detail Vendor & Tanggal:</strong>
          <div style="margin-top:6px;">Vendor: <strong>${vName} (${vType})</strong></div>
          <div style="margin-top:2px;">Tanggal Mulai: ${formatDateDisplay(b.dateStart)}</div>
          <div style="margin-top:2px;">Catatan: ${b.notes || '-'}</div>
        </div>
      </div>
      
      <!-- Products Table -->
      <h4 style="font-size:0.85rem; font-weight:800; margin-bottom:8px;">Rincian Item Layanan / Produk:</h4>
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:20px; border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1; text-align:left;">
            <th style="padding:8px;">Nama Produk</th>
            <th style="padding:8px; text-align:center;">Harga SAR</th>
            <th style="padding:8px; text-align:center;">Qty</th>
            <th style="padding:8px; text-align:right;">Jumlah SAR</th>
          </tr>
        </thead>
        <tbody>
          ${b.products ? b.products.map(p => `
            <tr style="border-bottom:1px solid #f1f3f5;">
              <td style="padding:8px;"><strong>${p.name}</strong></td>
              <td style="padding:8px; text-align:center;">SAR ${p.price.toLocaleString('id-ID')}</td>
              <td style="padding:8px; text-align:center;">${p.qty} Pcs</td>
              <td style="padding:8px; text-align:right; font-weight:700;">SAR ${(p.amount || (p.price * p.qty)).toLocaleString('id-ID')}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" style="text-align:center; padding:8px;">Tidak ada item.</td></tr>'}
          <tr style="background:#f8fafc; font-weight:800; border-top:2px solid var(--primary-gold);">
            <td colspan="3" style="padding:10px; text-align:right;">TOTAL HARGA PEMESANAN:</td>
            <td style="padding:10px; text-align:right; color:var(--primary-gold); font-size:0.95rem;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Footer Signature -->
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:32px;">
        <div style="text-align:center; width:150px;">
          Disiapkan Oleh,<br><br><br><br>
          <strong>( handling team )</strong>
        </div>
        <div style="text-align:center; width:150px;">
          Pihak Vendor Penerima,<br><br><br><br>
          <strong>( ${vName} )</strong>
        </div>
      </div>
    </div>
    
    <!-- Action buttons -->
    <div style="display:flex; gap:10px; margin-top:20px; justify-content:flex-end;">
      <button id="po-print-download-btn" class="btn btn-primary" style="width:auto; padding:8px 16px;"><i data-lucide="printer"></i> Cetak / Simpan PDF</button>
      <button id="po-share-wa-btn" class="btn btn-secondary" style="width:auto; padding:8px 16px; color:#10b981; border-color:#a7f3d0;"><i data-lucide="message-square"></i> Share ke WhatsApp</button>
    </div>
  `;
  openModal("Purchase Order / Booking Voucher", pdfHtml);
  
  document.getElementById("po-print-download-btn").onclick = () => {
    const printContent = document.getElementById("booking-po-print-area").innerHTML;
    const originalContent = document.body.innerHTML;
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>PO Booking - ${bookingId}</title>
          <style>
            body { font-family: sans-serif; color: #1e293b; padding: 40px; }
            :root { --primary-gold: #c5a850; --text-main: #111; --text-muted: #666; --border-light: 1px solid #e2e8f0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  document.getElementById("po-share-wa-btn").onclick = () => {
    const waText = encodeURIComponent(`*KONFIRMASI PEMESANAN VENDOR - JEJAK IMANI*\n\n` +
      `• No. Booking: BOK-${(b.id || "").substring(2,8).toUpperCase()}\n` +
      `• Grup: ${b.groupName}\n` +
      `• Vendor: ${vName}\n` +
      `• Tanggal Mulai: ${formatDateDisplay(b.dateStart)}\n` +
      `• Rincian Item:\n` +
      b.products.map(p => `- ${p.name} (Qty: ${p.qty})`).join('\n') +
      `\n\n*TOTAL ESTIMASI: SAR ${totalAmount.toLocaleString('id-ID')}*`
    );
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };
  
  lucide.createIcons();
}




function openUserTaskDetailModal(taskId) {
  const t = state.assignments.find(x => x.id === taskId);
  if (!t) return;
  
  const staffNames = t.staff.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
  const reqStaff = t.requiredStaff || 1;
  const currentStaffCount = t.staff ? t.staff.length : 0;
  const isFulfilled = (currentStaffCount >= reqStaff);
  const staffingStatusHtml = isFulfilled 
    ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
    : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;

  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span class="badge badge-gold" style="font-size:0.85rem;">${t.type}</span>
        ${staffingStatusHtml}
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:20px;">
        <tr><td style="padding:6px 0; font-weight:700; width:120px; color:var(--text-muted);">Grup Rombongan:</td><td style="font-weight:800;">${t.groupName}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Tanggal / Waktu:</td><td>${formatDateDisplay(t.date)} | ${t.time} Saudi</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah:</td><td>${t.region}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td>${t.details.hotelName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${t.details.eta || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${t.details.totalPax || '-'} Pax</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Layanan:</td><td>${t.details.service || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan / Rincian:</td><td>${t.details.remarks || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Petugas di-Plot:</td><td><strong>${staffNames || 'Belum diplot'}</strong></td></tr>
      </table>
      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
      </div>
    </div>
  `;
  openModal("Rincian Penugasan", detailHtml);
}



function renderUserApplyTugas() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;
  
  const username = state.currentUser ? state.currentUser.username : '';
  
  // Set defaults
  if (typeof state.userApplyViewMode === 'undefined') {
    state.userApplyViewMode = "grup";
  }
  if (typeof state.userApplyActiveDate === 'undefined') {
    state.userApplyActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  }
  
  const activeDateObj = new Date(state.userApplyActiveDate);
  const monthYearStr = activeDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  // Weekly strip around active date (for Tanggal view mode)
  let dateCardsHtml = "";
  for (let i = -3; i <= 3; i++) {
    const d = new Date(activeDateObj);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isTodayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    const isRealToday = (dateStr === isTodayStr);
    const isActive = (dateStr === state.userApplyActiveDate);
    
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayNum = d.getDate();
    
    dateCardsHtml += `
      <div class="iti-cal-date-card ${isActive ? 'active' : ''}" data-date="${dateStr}" style="flex:1; min-width:52px; max-width:65px; padding:8px 4px; text-align:center; border:1px solid ${isActive ? 'var(--primary-gold)' : (isRealToday ? 'var(--primary-gold)' : '#cbd5e1')}; border-radius:8px; background:${isActive ? 'var(--primary-gold)' : '#fff'}; cursor:pointer; color:${isActive ? '#fff' : '#475569'}; box-shadow:${isActive ? '0 4px 6px -1px rgba(197, 168, 80, 0.4)' : 'none'};">
        <div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; ${isActive ? 'color:#fff;' : 'color:#94a3b8;'}">${dayName}</div>
        <div style="font-size:1.15rem; font-weight:900; margin:2px 0; ${isActive ? 'color:#fff;' : 'color:var(--text-main);'}">${dayNum}</div>
        ${isRealToday ? `<div style="font-size:0.5rem; font-weight:800; ${isActive ? 'color:#fff;' : 'color:var(--primary-gold);'}">HARI INI</div>` : ''}
      </div>
    `;
  }
  
  const calendarSliderHtml = `
    <div class="admin-card" style="margin-bottom:16px; padding:12px; border-radius:8px; width:100%; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h4 style="font-weight:800; font-size:0.85rem; color:var(--text-main); margin:0;">${monthYearStr}</h4>
        <div style="display:flex; gap:6px;">
          <button id="user-apply-prev-week" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&larr;</button>
          <button id="user-apply-today" class="btn btn-gold" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hari Ini</button>
          <button id="user-apply-next-week" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&rarr;</button>
        </div>
      </div>
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px;">
        ${dateCardsHtml}
      </div>
    </div>
  `;

  container.innerHTML = `
    <!-- Filter bar (Search, City Filter, Quota Filter, & Summary Button) -->
    <div class="admin-card" style="margin-bottom:16px; padding:12px; width:100%; box-sizing:border-box;">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; width:100%;">
        <input type="text" id="user-apply-search" class="form-input" placeholder="Cari penugasan..." style="flex:1; min-width:140px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <select id="user-apply-city-filter" class="form-select" style="width:130px; padding:6px 10px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Kota</option>
          <option value="Jeddah">Jeddah</option>
          <option value="Madinah">Madinah</option>
          <option value="Makkah">Makkah</option>
        </select>
        <select id="user-apply-quota-filter" class="form-select" style="width:140px; padding:6px 10px; font-size:0.85rem; height:auto; margin:0;">
          <option value="all">Semua Status</option>
          <option value="fulfilled">Terpenuhi</option>
          <option value="unfulfilled">Belum Terpenuhi</option>
        </select>
        <button id="user-task-summary-btn" class="btn btn-gold" style="width:auto; padding:6px 14px; font-size:0.8rem; font-weight:800; display:inline-flex; align-items:center; gap:6px;">
          <i data-lucide="share-2" style="width:14px; height:14px;"></i> Rangkuman
        </button>
      </div>
    </div>
    
    <!-- View Switcher (Grup vs Tanggal) -->
    <div class="tab-header" style="margin-bottom:16px; border-bottom:none; display:flex; gap:10px; width:100%;">
      <button class="btn btn-secondary tab-btn ${state.userApplyViewMode === 'grup' ? 'active' : ''}" id="user-apply-mode-grup" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid ${state.userApplyViewMode === 'grup' ? 'var(--primary-gold)' : '#cbd5e1'}; background:${state.userApplyViewMode === 'grup' ? 'var(--primary-gold)' : '#fff'}; color:${state.userApplyViewMode === 'grup' ? '#fff' : '#475569'}; font-weight:700;">Berdasarkan Grup</button>
      <button class="btn btn-secondary tab-btn ${state.userApplyViewMode === 'tanggal' ? 'active' : ''}" id="user-apply-mode-tanggal" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid ${state.userApplyViewMode === 'tanggal' ? 'var(--primary-gold)' : '#cbd5e1'}; background:${state.userApplyViewMode === 'tanggal' ? 'var(--primary-gold)' : '#fff'}; color:${state.userApplyViewMode === 'tanggal' ? '#fff' : '#475569'}; font-weight:700;">Berdasarkan Tanggal</button>
    </div>
    
    <!-- Calendar Slider (Only rendered if mode is Tanggal) -->
    <div id="user-apply-calendar-slider-container" style="width:100%;"></div>
    
    <!-- Main content list -->
    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px; width:100%;" id="user-apply-list-container"></div>
  `;

  // Bind WhatsApp summary button
  const summaryBtn = document.getElementById("user-task-summary-btn");
  if (summaryBtn) {
    summaryBtn.onclick = () => openTaskSummaryPopup();
  }

  if (state.userApplyViewMode === "tanggal") {
    document.getElementById("user-apply-calendar-slider-container").innerHTML = calendarSliderHtml;
    
    // Bind weekly events
    document.getElementById("user-apply-prev-week").onclick = () => {
      const d = new Date(state.userApplyActiveDate);
      d.setDate(d.getDate() - 7);
      state.userApplyActiveDate = d.toISOString().split('T')[0];
      renderUserApplyTugas();
    };
    document.getElementById("user-apply-next-week").onclick = () => {
      const d = new Date(state.userApplyActiveDate);
      d.setDate(d.getDate() + 7);
      state.userApplyActiveDate = d.toISOString().split('T')[0];
      renderUserApplyTugas();
    };
    document.getElementById("user-apply-today").onclick = () => {
      state.userApplyActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      renderUserApplyTugas();
    };
    document.querySelectorAll(".iti-cal-date-card").forEach(card => {
      card.onclick = () => {
        state.userApplyActiveDate = card.getAttribute("data-date");
        renderUserApplyTugas();
      };
    });
  }
  
  // Bind tab mode switchers
  document.getElementById("user-apply-mode-grup").onclick = () => {
    state.userApplyViewMode = "grup";
    renderUserApplyTugas();
  };
  document.getElementById("user-apply-mode-tanggal").onclick = () => {
    state.userApplyViewMode = "tanggal";
    renderUserApplyTugas();
  };
  
  const drawList = () => {
    const q = document.getElementById("user-apply-search") ? document.getElementById("user-apply-search").value.toLowerCase().trim() : "";
    const cityVal = document.getElementById("user-apply-city-filter") ? document.getElementById("user-apply-city-filter").value.toLowerCase().trim() : "";
    const quotaVal = document.getElementById("user-apply-quota-filter") ? document.getElementById("user-apply-quota-filter").value : "all";
    
    const listEl = document.getElementById("user-apply-list-container");
    if (!listEl) return;
    
    let filtered = state.assignments.filter(t => t.published !== false && t.status !== "Selesai");
    if (q) {
      filtered = filtered.filter(t => 
        t.type.toLowerCase().includes(q) || 
        (t.details.customTaskName || '').toLowerCase().includes(q) ||
        t.groupName.toLowerCase().includes(q)
      );
    }
    if (cityVal) {
      filtered = filtered.filter(t => (t.region || t.city || '').toLowerCase().includes(cityVal));
    }
    if (quotaVal === "fulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) >= (t.requiredStaff || 1));
    } else if (quotaVal === "unfulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) < (t.requiredStaff || 1));
    }
    
    if (state.userApplyViewMode === "tanggal") {
      filtered = filtered.filter(t => t.date === state.userApplyActiveDate);
    }
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:20px; background:#fff; border-radius:8px; border:var(--border-light); width:100%; box-sizing:border-box;">Tidak ada penugasan dipublikasikan ditemukan.</p>`;
      return;
    }
    
    const makeCardHtml = (t, hideGroupName = false) => {
      const reqStaff = t.requiredStaff || 1;
      const currentStaffCount = t.staff ? t.staff.length : 0;
      const isFulfilled = (currentStaffCount >= reqStaff);
      
      // Format staffing status badge to numbers only e.g. "(0/1)"
      const staffingStatusHtml = isFulfilled 
        ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.72rem; padding:2px 6px; font-weight:800;">(${currentStaffCount}/${reqStaff})</span>` 
        : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.72rem; padding:2px 6px; font-weight:800;">(${currentStaffCount}/${reqStaff})</span>`;
      
      t.applicants = t.applicants || [];
      const hasApplied = t.applicants.includes(username);
      
      // User status badge: REMOVED "Anda Bertugas" per user directive! Show only Pending Approval if applied
      let userStatusBadgeHtml = "";
      if (hasApplied) {
        userStatusBadgeHtml = `<span class="badge" style="background:#64748b; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:6px; font-weight:800;">Pending Approval</span>`;
      }
      
      const dayNameFormatted = new Date(t.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      // Hotel name display for Check In / Check Out tasks (direct value without column title)
      const typeStr = (t.type || '').toLowerCase();
      const isHotelTask = typeStr.includes('check in') || typeStr.includes('check out') || typeStr.includes('hotel');
      const details = t.details || {};
      const group = state.groups.find(g => g && g.name === t.groupName);
      const hotelNameVal = details.hotelName || (group ? (group.hotelMadinah || group.hotelMakkah) : null);
      const hotelDisplayHtml = (isHotelTask && hotelNameVal) 
        ? `<div style="font-weight:800; color:#1e293b; font-size:0.83rem;">${hotelNameVal}</div>` 
        : '';

      const regionFormatted = t.region ? `(${t.region})` : '(Saudi Arabia)';

      return `
        <div class="assignment-card" onclick="openUserTaskDetailPopup('${t.id}')" style="border-left:4px solid var(--primary-gold); background:#fff; padding:14px 16px; width:100%; box-sizing:border-box; border-radius:10px; border-top:1px solid #e2e8f0; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; display:flex; flex-direction:column; gap:8px; margin-bottom:0; cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease;" title="Klik untuk melihat Detail Penugasan">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; width:100%;">
            <span style="font-weight:900; font-size:0.92rem; color:var(--text-main);">${t.type} ${t.details.customTaskName ? `(${t.details.customTaskName})` : ''}</span>
            <div style="display:flex; align-items:center; gap:6px;">
              ${userStatusBadgeHtml}
              ${staffingStatusHtml}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:3px; font-size:0.8rem; color:#475569;">
            ${hideGroupName ? '' : `<div><strong style="color:var(--text-main); font-size:0.85rem;">${t.groupName}</strong></div>`}
            ${hotelDisplayHtml}
            <div><strong>${dayNameFormatted} | ${t.time}</strong> ${regionFormatted}</div>
          </div>
        </div>
      `;
    };
    
    if (state.userApplyViewMode === "grup") {
      const grouped = {};
      filtered.forEach(t => {
        if (!grouped[t.groupName]) grouped[t.groupName] = [];
        grouped[t.groupName].push(t);
      });
      
      listEl.innerHTML = `<div id="user-task-apply-accordion" style="display:flex; flex-direction:column; gap:10px; width:100%;"></div>`;
      const accList = document.getElementById("user-task-apply-accordion");
      
      Object.keys(grouped).forEach((gName, idx) => {
        const groupTasks = grouped[gName];
        
        const groupObj = state.groups.find(g => g && g.name === gName);
        const tlName = (groupObj && groupObj.leaders && groupObj.leaders.length > 0) 
          ? groupObj.leaders.join(', ') 
          : (groupObj && groupObj.tourLeader ? groupObj.tourLeader : 'Ust. H. Dinar Zul Akbar, Lc., M.A.');

        const headerId = 'user-acc-header-' + idx;
        const bodyId = 'user-acc-body-' + idx;
        const iconId = 'user-acc-icon-' + idx;
        
        const accordionRow = document.createElement("div");
        accordionRow.style.display = "flex";
        accordionRow.style.flexDirection = "column";
        accordionRow.style.width = "100%";
        
        accordionRow.innerHTML = `
          <div class="group-accordion-header" id="${headerId}" style="padding:10px 14px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; margin-bottom:4px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong style="font-size:0.85rem; color:#0f172a; font-weight:900;">${gName}</strong>
              <span style="font-size:0.75rem; color:#64748b; font-weight:700;">• ${tlName}</span>
              <span class="badge" style="background:#f1f5f9; color:#475569; font-weight:800; font-size:0.72rem; padding:2px 7px; border-radius:12px; border:1px solid #cbd5e1; margin-left:4px;">${groupTasks.length}</span>
            </div>
            <i data-lucide="chevron-down" id="${iconId}" style="width:18px; height:18px; color:#64748b; transform:rotate(-90deg); transition:transform 0.2s ease;"></i>
          </div>
          <div id="${bodyId}" style="display:none; flex-direction:column; gap:8px; padding-left:8px; border-left:2px solid var(--primary-gold); margin-top:4px; margin-bottom:8px;">
            ${groupTasks.map(t => makeCardHtml(t, true)).join('')}
          </div>
        `;
        
        accList.appendChild(accordionRow);
        
        const hEl = document.getElementById(headerId);
        const bEl = document.getElementById(bodyId);
        const iEl = document.getElementById(iconId);
        
        if (hEl && bEl && iEl) {
          hEl.onclick = () => {
            if (bEl.style.display === "none") {
              bEl.style.display = "flex";
              iEl.style.transform = "rotate(0deg)";
            } else {
              bEl.style.display = "none";
              iEl.style.transform = "rotate(-90deg)";
            }
          };
        }
      });
    } else {
      listEl.innerHTML = filtered.map(t => makeCardHtml(t, false)).join('');
    }
    
    lucide.createIcons();
  };
  
  if (document.getElementById("user-apply-search")) document.getElementById("user-apply-search").oninput = drawList;
  if (document.getElementById("user-apply-city-filter")) document.getElementById("user-apply-city-filter").onchange = drawList;
  if (document.getElementById("user-apply-quota-filter")) document.getElementById("user-apply-quota-filter").onchange = drawList;
  
  drawList();
  lucide.createIcons();
}

let activeTaskDetailTab = "tugas";







function renderUserTaskDetailFull() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;

  try {
    // Ensure state safety
    if (typeof state === 'undefined' || !state) {
      if (typeof DEFAULT_STATE !== 'undefined') state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      else state = { groups: [], assignments: [], users: [] };
    }
    if (!Array.isArray(state.assignments)) state.assignments = [];
    if (!Array.isArray(state.groups)) state.groups = [];
    if (!Array.isArray(state.users)) state.users = [];

    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const taskId = params.get("id");
    let task = taskId ? state.assignments.find(x => x && x.id === taskId) : null;

    // Fallback 1: Pick current user's assigned task
    if (!task && state.currentUser) {
      const username = state.currentUser.username;
      task = state.assignments.find(a => a && a.staff && Array.isArray(a.staff) && a.staff.includes(username));
    }

    // Fallback 2: Pick first available assignment in state
    if (!task && state.assignments.length > 0) {
      task = state.assignments[0];
    }

    // Fallback 3: Construct clean mock task so view ALWAYS renders 100%
    if (!task) {
      const firstGroup = state.groups[0];
      task = {
        id: 'task-default',
        type: 'Handling Operasional Lapangan',
        groupName: firstGroup ? firstGroup.name : 'Umroh Sapphire dan Ruby 29 Juli 2026 (9 hari)',
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
        time: '08:00',
        region: 'Madinah Awal',
        status: 'Aktif',
        staff: [state.currentUser ? state.currentUser.username : 'yusuf'],
        details: {
          totalPax: firstGroup ? (firstGroup.pax || '48 Pax') : '48 Pax',
          hotelName: firstGroup ? (firstGroup.hotelMadinah || firstGroup.hotelMakkah || 'Hotel Saudi Standard') : 'Hotel Madinah / Makkah',
          eta: 'SV-816 (14:30 Saudi)',
          remarks: 'Handling Rombongan Jamaah'
        }
      };
    }

    const group = state.groups.find(g => g && g.name === task.groupName) || (state.groups.length > 0 ? state.groups[0] : null);
    const staffList = Array.isArray(task.staff) ? task.staff : [];
    const staffNames = staffList.map(s => {
      const u = state.users.find(usr => usr && usr.username === s);
      return u ? u.name : s;
    }).join(', ');
    const details = task.details || {};

    const totalPaxStr = group ? (group.pax || '48 Pax') : (details.totalPax ? (details.totalPax.includes('Pax') ? details.totalPax : details.totalPax + ' Pax') : '48 Pax');
    const dateRangeStr = group ? `${formatDateShortMonth(group.dateStart)} – ${formatDateShortMonth(group.dateEnd)}` : formatDateShortMonth(task.date);
    const routeOrRegion = group ? (group.rute || task.region || 'Madinah Awal') : (task.region || 'Madinah Awal');

    container.innerHTML = `
      <div style="font-family:'Mulish', sans-serif; padding-top:10px; padding-bottom:40px; max-width:600px; margin:0 auto;">
        
        <!-- WIDGET 1: INFORMASI KEBERANGKATAN & PENUGASAN (TOP COMBINED CARD) -->
        <div style="background:#ffffff; border-radius:18px; border:1px solid #e2e8f0; padding:18px; margin-bottom:18px; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
          
          <!-- Region / Route Badge -->
          <div style="margin-bottom:8px;">
            <span style="background:#fffbe6; color:#b89230; border:1px solid #fde68a; font-weight:800; font-size:0.75rem; padding:4px 10px; border-radius:14px; display:inline-flex; align-items:center; gap:4px;">
              🌙 ${routeOrRegion}
            </span>
          </div>

          <!-- Group Name & Date Range -->
          <h3 style="font-size:1.15rem; font-weight:900; color:#0f172a; margin:0 0 4px 0; line-height:1.3;">${task.groupName}</h3>
          <div style="font-size:0.8rem; color:#64748b; font-weight:700; margin-bottom:14px;">${dateRangeStr}</div>

          <div style="border-top:1px solid #f1f5f9; margin:12px 0;"></div>

          <!-- Total Jamaah Row -->
          <div style="display:flex; align-items:center; gap:12px; padding:6px 0;">
            <div style="width:42px; height:42px; border-radius:12px; background:#fffdf5; border:1px solid #fef3c7; display:flex; align-items:center; justify-content:center; color:#b89230;">
              <i data-lucide="users" style="width:22px; height:22px;"></i>
            </div>
            <div>
              <div style="font-size:0.68rem; color:#64748b; font-weight:800; text-transform:uppercase;">TOTAL JAMAAH</div>
              <div style="font-size:1.1rem; font-weight:900; color:#b89230;">${totalPaxStr}</div>
            </div>
          </div>

          <div style="border-top:1px solid #f1f5f9; margin:12px 0;"></div>

          <!-- Collapsible Accordion: Rincian Keberangkatan & Penugasan -->
          <div id="utd-accordion-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; padding:4px 0;">
            <span style="font-size:0.9rem; font-weight:800; color:#0f172a;">Rincian Keberangkatan & Penugasan</span>
            <i data-lucide="chevron-down" id="utd-accordion-icon" style="width:18px; height:18px; color:#64748b; transition:transform 0.2s;"></i>
          </div>

          <div id="utd-accordion-body" style="margin-top:12px; border-top:1px solid #f1f5f9; padding-top:10px; font-size:0.82rem; line-height:1.7;">
            <table style="width:100%; border-collapse:collapse;">
              <tr><td style="color:#64748b; font-weight:700; width:130px;">Jenis Kegiatan:</td><td style="font-weight:800; color:#0f172a;">${task.type || 'Handling Lapangan'}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Status Task:</td><td><span class="badge badge-gold" style="font-size:0.7rem;">${task.status || 'Aktif'}</span></td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Waktu & Tanggal:</td><td style="font-weight:700;">${formatDateDisplay(task.date)} | Pukul ${task.time || '-'}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Wilayah:</td><td>${task.region || '-'}</td></tr>
              ${details.origin || details.asal ? `<tr><td style="color:#64748b; font-weight:700;">Asal / Dari:</td><td>${details.origin || details.asal}</td></tr>` : ''}
              ${details.destination || details.tujuan ? `<tr><td style="color:#64748b; font-weight:700;">Tujuan:</td><td>${details.destination || details.tujuan}</td></tr>` : ''}
              ${details.hotelName || details.hotel ? `<tr><td style="color:#64748b; font-weight:700;">Nama Hotel:</td><td style="font-weight:800;">${details.hotelName || details.hotel}</td></tr>` : ''}
              ${details.roomComposition || details.komposisiKamar || details.rooms ? `<tr><td style="color:#64748b; font-weight:700;">Komposisi Kamar:</td><td>${details.roomComposition || details.komposisiKamar || details.rooms}</td></tr>` : ''}
              ${details.complimentary || details.comp ? `<tr><td style="color:#64748b; font-weight:700;">Complimentary:</td><td>${details.complimentary || details.comp}</td></tr>` : ''}
              ${details.pickupRoute || details.rute ? `<tr><td style="color:#64748b; font-weight:700;">Rute Penjemputan:</td><td>${details.pickupRoute || details.rute}</td></tr>` : ''}
              ${details.flight || details.eta ? `<tr><td style="color:#64748b; font-weight:700;">Flight & ETA:</td><td>${details.flight || details.eta}</td></tr>` : ''}
              ${details.mealplan || details.meal ? `<tr><td style="color:#64748b; font-weight:700;">Mealplan:</td><td>${details.mealplan || details.meal}</td></tr>` : ''}
              ${details.remarks || details.notes ? `<tr><td style="color:#64748b; font-weight:700;">Catatan Tambahan:</td><td>${details.remarks || details.notes}</td></tr>` : ''}
              ${group && group.leaders ? `<tr><td style="color:#64748b; font-weight:700;">Tour Leader:</td><td style="font-weight:800;">${group.leaders.join(', ')}</td></tr>` : ''}
              ${group && group.mutawwif ? `<tr><td style="color:#64748b; font-weight:700;">Muthowwif:</td><td>${group.mutawwif}</td></tr>` : ''}
              <tr><td style="color:#64748b; font-weight:700;">Tim Petugas:</td><td><strong style="color:#047857;">${staffNames || 'Tim Handling Lapangan'}</strong></td></tr>
            </table>
          </div>

        </div>

        <!-- WIDGET 2: MENU OPERASIONAL (3 MENU ONLY: ROOM LIST, ABSENSI, DOKUMEN) -->
        <div style="background:#ffffff; border-radius:18px; border:1px solid #e2e8f0; padding:18px; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
          
          <div style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:14px; letter-spacing:0.5px;">
            MENU OPERASIONAL
          </div>

          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
            
            <!-- Menu 1: Room List -->
            <div onclick="window.location.hash='#user/roomlist?group=' + encodeURIComponent('${task.groupName}')" style="background:#fffdf5; border:1px solid #fef3c7; border-radius:14px; padding:16px 8px; text-align:center; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
              <div style="width:44px; height:44px; border-radius:12px; background:#fef3c7; display:flex; align-items:center; justify-content:center; margin:0 auto 8px auto; color:#b89230;">
                <i data-lucide="bed" style="width:22px; height:22px;"></i>
              </div>
              <div style="font-size:0.85rem; font-weight:800; color:#0f172a;">Room List</div>
            </div>

            <!-- Menu 2: Absensi -->
            <div onclick="openAttendanceFormPopup('${task.id}')" style="background:#fffdf5; border:1px solid #fef3c7; border-radius:14px; padding:16px 8px; text-align:center; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
              <div style="width:44px; height:44px; border-radius:12px; background:#fef3c7; display:flex; align-items:center; justify-content:center; margin:0 auto 8px auto; color:#b89230;">
                <i data-lucide="camera" style="width:22px; height:22px;"></i>
              </div>
              <div style="font-size:0.85rem; font-weight:800; color:#0f172a;">Absensi</div>
            </div>

            <!-- Menu 3: Dokumen -->
            <div onclick="window.location.hash='#user/documents?group=' + encodeURIComponent('${task.groupName}')" style="background:#fffdf5; border:1px solid #fef3c7; border-radius:14px; padding:16px 8px; text-align:center; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
              <div style="width:44px; height:44px; border-radius:12px; background:#fef3c7; display:flex; align-items:center; justify-content:center; margin:0 auto 8px auto; color:#b89230;">
                <i data-lucide="folder" style="width:22px; height:22px;"></i>
              </div>
              <div style="font-size:0.85rem; font-weight:800; color:#0f172a;">Dokumen</div>
            </div>

          </div>

        </div>

      </div>
    `;

    lucide.createIcons();

    // Bind top accordion toggle
    const accHeader = document.getElementById("utd-accordion-header");
    const accBody = document.getElementById("utd-accordion-body");
    const accIcon = document.getElementById("utd-accordion-icon");

    if (accHeader && accBody && accIcon) {
      accHeader.onclick = () => {
        if (accBody.style.display === "none") {
          accBody.style.display = "block";
          accIcon.style.transform = "rotate(180deg)";
        } else {
          accBody.style.display = "none";
          accIcon.style.transform = "rotate(0deg)";
        }
      };
    }
  } catch(err) {
    console.error("Error in renderUserTaskDetailFull:", err);
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;">Gagal memuat rincian tugas & grup. Silakan muat ulang.</div>`;
  }
}


function printPublicVendorPDF(vendorId, mode = 'rekap', dateStart = '', dateEnd = '', statusFilter = '') {
  const vendor = (state.vendors || []).find(v => v.id === vendorId);
  if (!vendor) {
    showToast("Vendor tidak ditemukan.", "error");
    return;
  }

  // Date normalizer to handle any format (YYYY-MM-DD, DD/MM/YYYY, ISO)
  const normalizeDateStr = (dStr) => {
    if (!dStr) return '';
    const str = String(dStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    const parts = str.split(/[\/\-\s]/);
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return str;
  };

  const normStart = normalizeDateStr(dateStart);
  const normEnd = normalizeDateStr(dateEnd);

  let tableContentHtml = "";
  let documentTitle = mode === 'keuangan' ? 'LAPORAN KEUANGAN VENDOR' : 'REKAPITULASI PEMESANAN VENDOR';

  if (mode === 'keuangan') {
    let finItems = [];
    
    // Transfers from Dompet Utama to vendor
    (state.financial.transactions || []).forEach(tx => {
      if (tx.recipient === `vendor:${vendorId}` || tx.recipient === vendor.name) {
        finItems.push({
          date: tx.date,
          type: 'debit',
          groupName: 'Uang Masuk',
          goal: '',
          products: '',
          debit: tx.amount || 0,
          kredit: 0
        });
      }
    });

    // Completed bookings
    (state.bookings || []).forEach(b => {
      if (b.vendorId === vendorId && b.status === 'Selesai') {
        const goal = b.activityGoal || b.location || b.hotel || b.notes || 'Operasional';
        const prods = (b.products && b.products.length > 0) ? b.products.map(p => `${p.name || 'Snack'} (${p.qty || 1} ${p.unit || 'Pcs'})`).join(', ') : (b.notes || 'Snack');
        const cost = b.totalPrice || (b.products ? b.products.reduce((s, p) => s + ((p.amount || p.price || 0) * (p.qty || 1)), 0) : 0) || 0;
        
        finItems.push({
          date: b.dateStart || b.date,
          type: 'kredit',
          groupName: b.groupName || 'Rombongan',
          goal: goal,
          products: prods,
          debit: 0,
          kredit: cost
        });
      }
    });

    if (normStart) finItems = finItems.filter(x => normalizeDateStr(x.date) >= normStart);
    if (normEnd) finItems = finItems.filter(x => normalizeDateStr(x.date) <= normEnd);
    finItems.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let runningBal = 0;
    let totalDebit = 0;
    let totalKredit = 0;

    tableContentHtml = `
      <table class="booking-table">
        <thead>
          <tr>
            <th style="width:5%; text-align:center;">No</th>
            <th style="width:14%; text-align:center;">Tanggal</th>
            <th style="width:45%; text-align:center;">Keterangan</th>
            <th style="width:12%; text-align:center;">Debit (SAR)</th>
            <th style="width:12%; text-align:center;">Kredit (SAR)</th>
            <th style="width:12%; text-align:center;">Saldo (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${finItems.length === 0 ? `
            <tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">Belum ada riwayat transaksi keuangan vendor.</td></tr>
          ` : finItems.map((item, idx) => {
            runningBal += (item.debit - item.kredit);
            totalDebit += item.debit;
            totalKredit += item.kredit;
            
            const dateShort = formatDateShortMonth(item.date);

            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td style="text-align:center; white-space:nowrap; font-weight:700;">${dateShort}</td>
                <td style="text-align:left; line-height:1.45;">
                  <div style="font-weight:800; color:#0f172a;">${item.groupName}</div>
                  <div style="color:#334155; font-size:8.5pt;">${item.goal}</div>
                  ${item.products ? `<div style="color:#475569; font-size:8pt; margin-top:2px;">${item.products}</div>` : ''}
                </td>
                <td style="text-align:center; white-space:nowrap; font-weight:700; color:#10b981;">${item.debit > 0 ? '+ ' + item.debit.toLocaleString('id-ID') : '-'}</td>
                <td style="text-align:center; white-space:nowrap; font-weight:700; color:#ef4444;">${item.kredit > 0 ? '- ' + item.kredit.toLocaleString('id-ID') : '-'}</td>
                <td style="text-align:center; white-space:nowrap; font-weight:900; color:${runningBal < 0 ? '#ef4444' : '#0f172a'};">${runningBal.toLocaleString('id-ID')}</td>
              </tr>
            `;
          }).join('')}
          <tr style="font-weight:900; background:#f8fafc;">
            <td colspan="3" style="text-align:center;">TOTAL MUTASI & SALDO AKHIR</td>
            <td style="text-align:center; white-space:nowrap; color:#10b981;">+ SAR ${totalDebit.toLocaleString('id-ID')}</td>
            <td style="text-align:center; white-space:nowrap; color:#ef4444;">- SAR ${totalKredit.toLocaleString('id-ID')}</td>
            <td style="text-align:center; white-space:nowrap; font-size:9pt; color:${runningBal < 0 ? '#ef4444' : '#065f46'};">SAR ${runningBal.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>
    `;

  } else {
    // Mode === 'rekap'
    let vendorBookings = (state.bookings || []).filter(b => b.vendorId === vendor.id);
    
    if (normStart) {
      vendorBookings = vendorBookings.filter(b => normalizeDateStr(b.dateStart || b.date) >= normStart);
    }
    if (normEnd) {
      vendorBookings = vendorBookings.filter(b => normalizeDateStr(b.dateStart || b.date) <= normEnd);
    }

    tableContentHtml = `
      <table class="booking-table">
        <thead>
          <tr>
            <th style="width:5%; text-align:center;">No</th>
            <th style="width:18%; text-align:center;">Tanggal & Waktu</th>
            <th style="width:25%; text-align:center;">Grup & Muthowwif</th>
            <th style="width:20%; text-align:center;">Lokasi</th>
            <th style="width:20%; text-align:center;">Rincian Produk</th>
            <th style="width:12%; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${vendorBookings.length === 0 ? `
            <tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">Belum ada rekapitulasi pemesanan vendor.</td></tr>
          ` : vendorBookings.map((b, idx) => {
            const group = state.groups.find(g => g.name === b.groupName);
            const muth = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
            const loc = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Rotana Makkah') : 'Hotel Rotana Makkah');
            const dt = formatDateShortMonth(b.dateStart || b.date) + ' | ' + (b.time || '05:30');
            const st = b.status || 'Pesanan Baru';
            let badgeClass = 'badge-baru';
            let displayStatus = 'Akan Datang';
            if (st === 'Proses') {
              badgeClass = 'badge-proses';
              displayStatus = 'Proses';
            } else if (st === 'Selesai') {
              badgeClass = 'badge-selesai';
              displayStatus = 'Selesai';
            } else {
              badgeClass = 'badge-baru';
              displayStatus = 'Akan Datang';
            }

            const prods = (b.products && b.products.length > 0) ? b.products : [
              { name: b.notes || 'Snack Kering', qty: b.qty || 1, unit: b.unit || 'Pcs', amount: b.amount || (b.totalPrice || 242) }
            ];

            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td style="text-align:center; font-weight:700; white-space:nowrap;">${dt}</td>
                <td style="text-align:left;">
                  <strong>${b.groupName}</strong>
                  <div style="font-size:8pt; color:#475569; margin-top:2px;">Ust. ${muth}</div>
                </td>
                <td style="text-align:center;">${loc}</td>
                <td style="text-align:left;">
                  ${prods.map(p => `<div>• ${p.name} (${p.qty} ${p.unit})</div>`).join('')}
                  <div style="font-weight:800; margin-top:3px; color:#0f172a;">Total: SAR ${(b.totalPrice || 0).toLocaleString('id-ID')}</div>
                </td>
                <td style="text-align:center;">
                  <span class="status-badge ${badgeClass}">${displayStatus}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  let periodText = "";
  if (dateStart && dateEnd) {
    periodText = `Periode: ${formatDateLongIndo(dateStart)} s/d ${formatDateLongIndo(dateEnd)}`;
  } else if (dateStart) {
    periodText = `Periode Mulai: ${formatDateLongIndo(dateStart)}`;
  } else if (dateEnd) {
    periodText = `Periode s/d: ${formatDateLongIndo(dateEnd)}`;
  }

  const fullDocumentHtml = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${documentTitle} - ${vendor.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Martel:wght@400;700;900&family=Mulish:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Mulish', sans-serif; color: #0f172a; background: #ffffff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .page-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: url('assets/vendor_pdf_bg.png') no-repeat center top;
          background-size: 100% 100%;
          padding: 145px 44px 44px 44px;
          position: relative;
        }
        .header-title { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #dfc06b; padding-bottom: 10px; }
        .header-title h1 { font-family: 'Martel', serif; font-size: 1.3rem; margin: 0; color: #0f172a; text-transform: uppercase; }
        .header-title p { margin: 4px 0 0 0; font-size: 0.85rem; color: #d97706; font-weight: 800; }
        .vendor-info-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 9pt; background: rgba(248,250,252,0.9); border-radius: 8px; }
        .vendor-info-table td { padding: 7px 12px; border: 1px solid #cbd5e1; font-size: 9pt; }
        .booking-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 9pt; }
        .booking-table th { background: #0f172a; color: #ffffff; padding: 8px 10px; text-align: center; font-weight: 800; font-size: 9pt; border: 1px solid #0f172a; }
        .booking-table td { padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: top; background: #ffffff; font-size: 9pt; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-size: 8pt; text-align: center; }
        .badge-baru { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .badge-proses { background: #fffbe6; color: #d97706; border: 1px solid #fde68a; }
        .badge-selesai { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .footer-note { margin-top: 30px; text-align: center; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body onload="window.print();">
      <div class="page-container">
        <div class="header-title">
          <h1>${documentTitle}</h1>
          ${periodText ? `<p style="color:#d97706; font-size:0.85rem; font-weight:800; margin-top:4px;">${periodText}</p>` : ''}
        </div>
        <table class="vendor-info-table">
          <tr>
            <td style="width:18%; color:#64748b;">Mitra Vendor</td>
            <td style="width:32%;"><strong>${vendor.name}</strong></td>
            <td style="width:18%; color:#64748b;">Tipe Layanan</td>
            <td style="width:32%;"><strong>${vendor.type || 'Mitra Layanan'}</strong></td>
          </tr>
          <tr>
            <td style="color:#64748b;">Kontak</td>
            <td><strong>${vendor.contact || '-'}</strong></td>
            <td style="color:#64748b;">Keterangan</td>
            <td><strong>${vendor.notes || vendor.description || '-'}</strong></td>
          </tr>
        </table>
        ${tableContentHtml}
        <div class="footer-note">
          Dokumen resmi terverifikasi secara sistem oleh Tim Khidmat jejak imani Saudi Arabia
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast("Gagal membuka jendela cetak. Izinkan pop-up di browser.", "error");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(fullDocumentHtml);
  printWindow.document.close();

  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch(e) {
      console.warn("Print window error:", e);
    }
  }, 350);
}

window.printPublicVendorPDF = printPublicVendorPDF;


window.activeVendorCamStream = null;

function openVendorProcessModal(bookingId) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return;

  const vendor = state.vendors.find(v => v.id === b.vendorId);
  const vName = vendor ? vendor.name : 'Mitra Vendor';
  const group = state.groups.find(g => g.name === b.groupName);
  const muthawwifName = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
  const locationName = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Al Marwa Rayhaan Rotana (Bus 1)') : 'Hotel Al Marwa Rayhaan Rotana (Bus 1)');
  const activityTitle = (b.activityGoal || b.activity || b.notes || 'SNACK CITY TOUR MAKKAH').toUpperCase();
  const dateFormatted = formatDateIndonesian(b.dateStart || b.date);
  const timeFormatted = b.time ? b.time : '05:30';

  const status = b.status || 'Pesanan Baru';

  if (status === 'Pesanan Baru' || status === 'Aktif') {
    openModal("Konfirmasi Proses Pemesanan", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#3b82f6; color:#fff; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px;">Pesanan Baru</span>
            <span style="font-size:0.8rem; font-weight:700; color:#1d4ed8;">${dateFormatted} | ${timeFormatted}</span>
          </div>
          <h3 style="font-size:1rem; font-weight:900; color:#0f172a; margin:0 0 4px 0;">${activityTitle}</h3>
          <div style="font-size:0.85rem; color:#475569; font-weight:600;">${b.groupName}</div>
        </div>

        <div style="font-size:0.85rem; line-height:1.7; margin-bottom:18px;">
          <div>Muthowwif: <strong>Ust. ${muthawwifName}</strong></div>
          <div>Lokasi Pengantaran: <strong>${locationName}</strong></div>
          <div style="margin-top:6px; background:#f8fafc; padding:8px 12px; border-radius:8px; border-left:3px solid #dfc06b; font-size:0.82rem;">
            <strong>Keterangan / Catatan:</strong> ${b.notes || b.remarks || b.customText || '-'}
          </div>
          <div style="margin-top:10px; border-top:1px dashed #cbd5e1; padding-top:8px;">
            <strong>Daftar Item Pemesanan:</strong>
            ${(b.products && b.products.length > 0 ? b.products : [{name: 'Item Produk', qty: 1, unit: 'Pcs', amount: b.totalPrice}]).map(p => `
              <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-top:2px;">
                <span>• ${p.name}</span>
                <strong>${p.qty} ${p.unit} (SAR ${(p.amount || p.price || 0).toLocaleString('id-ID')})</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <button id="btn-confirm-to-proses" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; background:#d97706; color:#fff; border:none; box-shadow:0 4px 14px rgba(217,119,6,0.3);">
          Konfirmasi Proses Pemesanan
        </button>
      </div>
    `);

    document.getElementById("btn-confirm-to-proses").onclick = () => {
      const btn = document.getElementById("btn-confirm-to-proses");
      if (btn) {
        btn.innerHTML = "✓ Pesanan Telah Dikonfirmasi";
        btn.disabled = true;
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.7";
      }
      b.status = "Proses";
      saveState();
      pushData();
      closeModal();
      showToast("Status pesanan berhasil diperbarui menjadi PROSES!");
      if (window.location.hash.startsWith("#vendor-view")) renderPublicVendorPortal();
    };

  } else if (status === 'Proses') {
    let currentFacingMode = 'environment';
    let capturedWatermarkDataUrl = null;

    openModal("Foto Bukti Pengantaran", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        
        <!-- Live Camera Container with 1:1 Square Aspect Ratio -->
        <div id="v-cam-box" style="position:relative; width:100%; aspect-ratio:1/1; max-height:360px; background:#0f172a; border-radius:14px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center;">
          <video id="v-cam-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
        </div>

        <!-- Camera Control Bar: Ambil Foto & Flip Kamera side by side -->
        <div style="display:flex; gap:10px; margin-bottom:14px;">
          <button id="v-cam-snap-btn" class="btn btn-gold" style="flex:1; padding:12px; font-weight:800; font-size:0.88rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
            Ambil Foto
          </button>
          <button id="v-cam-flip-btn" class="btn btn-secondary" style="flex:1; padding:12px; font-weight:800; font-size:0.88rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:6px; background:#e2e8f0; color:#1e293b; border:none;">
            Flip Kamera
          </button>
        </div>

        <!-- Preview Container with Fullscreen Fit Object-Contain -->
        <div id="v-preview-box" style="display:none; margin-bottom:14px; text-align:center;">
          <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Preview Foto</div>
          <img id="v-preview-img" style="width:100%; max-height:65vh; object-fit:contain; border-radius:14px; border:2px solid #000; box-shadow:0 8px 24px rgba(0,0,0,0.25); background:#000;">
        </div>

        <button id="btn-submit-delivery" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:12px; display:none; background:#10b981; color:#fff; border:none; box-shadow:0 4px 14px rgba(16,185,129,0.3);">
          Selesaikan Pemesanan
        </button>
      </div>
    `);

    const videoEl = document.getElementById("v-cam-video");
    const snapBtn = document.getElementById("v-cam-snap-btn");
    const flipBtn = document.getElementById("v-cam-flip-btn");
    const previewBox = document.getElementById("v-preview-box");
    const previewImg = document.getElementById("v-preview-img");
    const submitBtn = document.getElementById("btn-submit-delivery");

    const stopCamera = () => {
      if (window.activeVendorCamStream) {
        window.activeVendorCamStream.getTracks().forEach(track => track.stop());
        window.activeVendorCamStream = null;
      }
    };

    const startCamera = async (mode) => {
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false
        });
        window.activeVendorCamStream = stream;
        if (videoEl) videoEl.srcObject = stream;
      } catch (err) {
        console.warn("Kamera tidak dapat diakses langsung:", err);
      }
    };

    startCamera(currentFacingMode);

    flipBtn.onclick = () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      startCamera(currentFacingMode);
    };

    const generateWatermark = (sourceImgOrVideo) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Total Canvas: 4:5 Portrait Ratio (1080 x 1350 px)
      const targetWidth = 1080;
      const targetHeight = 1350;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // 1:1 Square Photo Section at Top (1080 x 1080 px)
      const photoHeight = 1080;

      // Crop input image/video to 1:1 Square aspect ratio for top photo area
      let srcW = sourceImgOrVideo.videoWidth || sourceImgOrVideo.naturalWidth || 1080;
      let srcH = sourceImgOrVideo.videoHeight || sourceImgOrVideo.naturalHeight || 1080;

      let cropSize = Math.min(srcW, srcH);
      let cropX = Math.round((srcW - cropSize) / 2);
      let cropY = Math.round((srcH - cropSize) / 2);

      // Draw cropped 1:1 photo in the top 1080x1080 square section
      ctx.drawImage(sourceImgOrVideo, cropX, cropY, cropSize, cropSize, 0, 0, targetWidth, photoHeight);

      // Bottom Black Watermark Banner (1080 x 270 px) -> Total Canvas 1080x1350 (4:5 Portrait)
      const bannerHeight = 270;
      const bannerY = photoHeight; // y = 1080

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, bannerY, targetWidth, bannerHeight);

      // 1. Centered Vendor Name (Serif Font 'Martel', serif)
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "normal 36px 'Martel', serif";
      ctx.fillText(vName, targetWidth / 2, bannerY + 52);

      // 2. Activity Goal (Bold Uppercase) - Left Aligned
      ctx.textAlign = "left";
      ctx.font = "900 28px 'Mulish', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(activityTitle, 36, bannerY + 115);

      // 3. Group Name - Left Aligned
      ctx.font = "500 23px 'Mulish', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(b.groupName, 36, bannerY + 160);

      // 4. Location Name - Left Aligned
      ctx.font = "500 23px 'Mulish', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(locationName, 36, bannerY + 205);

      capturedWatermarkDataUrl = canvas.toDataURL("image/jpeg", 0.90);
      previewImg.src = capturedWatermarkDataUrl;
      previewBox.style.display = "block";
      submitBtn.style.display = "block";

      stopCamera();
    };

    snapBtn.onclick = () => {
      generateWatermark(videoEl);
    };

    submitBtn.onclick = () => {
      if (!capturedWatermarkDataUrl) {
        showToast("Ambil foto bukti terlebih dahulu.", "error");
        return;
      }
      submitBtn.innerHTML = "✓ Pemesanan Telah Selesai";
      submitBtn.disabled = true;
      submitBtn.style.pointerEvents = "none";
      submitBtn.style.opacity = "0.7";
      b.deliveryPhoto = capturedWatermarkDataUrl;
      b.status = "Selesai";
      processCompletedBookingFinancial(b);
      saveState();
      pushData();
      stopCamera();
      closeModal();
      showToast("Pemesanan Selesai disubmit!");
      if (window.location.hash.startsWith("#vendor-view")) renderPublicVendorPortal();
    };

  } else if (status === 'Selesai') {
    openModal("Bukti Pengantaran", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px;">Pesanan Selesai</span>
          <span style="font-size:0.8rem; font-weight:700; color:#64748b;">${dateFormatted} | ${timeFormatted}</span>
        </div>

        <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin:0 0 4px 0;">${activityTitle}</h3>
        <div style="font-size:0.85rem; color:#475569; font-weight:600; margin-bottom:14px;">${b.groupName}</div>

        ${b.deliveryPhoto ? `
          <div style="margin-bottom:16px; text-align:center;">
            <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Foto Bukti Pengantaran Terverifikasi</div>
            <img src="${b.deliveryPhoto}" style="width:100%; max-height:65vh; object-fit:contain; border-radius:14px; border:2px solid #000; box-shadow:0 8px 24px rgba(0,0,0,0.25); background:#000;">
          </div>
        ` : `
          <div style="padding:20px; text-align:center; background:#f8fafc; border-radius:12px; color:#64748b; font-size:0.85rem; margin-bottom:16px;">
            Bukti foto pengantaran diselesaikan langsung oleh muthowwif & vendor.
          </div>
        `}

        <div style="display:flex; gap:10px; margin-top:12px;">
          <button id="btn-share-delivery-img" class="btn btn-gold" style="flex:1; padding:12px; font-weight:800; font-size:0.92rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; background:#25d366; color:#fff; border:none; box-shadow:0 4px 14px rgba(37,211,102,0.3);">
            <i data-lucide="share-2"></i> Share
          </button>
          <button id="btn-delete-completed-booking" class="btn btn-danger" style="width:auto; padding:12px 16px; font-weight:800; font-size:0.92rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i data-lucide="trash-2" style="width:16px; height:16px;"></i> Hapus
          </button>
        </div>
      </div>
    `);

    lucide.createIcons();

    const delCompletedBtn = document.getElementById("btn-delete-completed-booking");
    if (delCompletedBtn) {
      delCompletedBtn.onclick = () => {
        if (confirm("Hapus data pemesanan selesai ini secara permanen?")) {
          state.bookings = state.bookings.filter(x => x.id !== b.id);
          saveState();
          closeModal();
          showToast("Data pemesanan berhasil dihapus!");
          if (window.location.hash.startsWith("#vendor-view")) renderPublicVendorPortal();
          else if (window.location.hash.startsWith("#admin/vendor")) renderAdminVendor();
        }
      };
    }

    document.getElementById("btn-share-delivery-img").onclick = async () => {
      if (!b.deliveryPhoto) {
        showToast("Tidak ada foto untuk dibagikan", "error");
        return;
      }
      try {
        // Convert Base64 dataUrl to Blob file for direct native image sharing
        const res = await fetch(b.deliveryPhoto);
        const blob = await res.blob();
        const file = new File([blob], `bukti_pengantaran_${b.id}.jpg`, { type: "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Bukti Pengantaran",
            text: `Foto Bukti Pengantaran Vendor - ${activityTitle}`
          });
        } else {
          // Fallback: Open image in new window / tab for direct saving / sharing
          const win = window.open();
          if (win) {
            win.document.write(`<img src="${b.deliveryPhoto}" style="max-width:100%; border-radius:12px;" alt="Bukti Pengantaran">`);
            showToast("Foto Bukti Pengantaran berhasil dibuka untuk dibagikan!");
          } else {
            showToast("Izinkan pop-up untuk membagikan foto.", "error");
          }
        }
      } catch (err) {
        console.warn("Share image error:", err);
        const win = window.open();
        if (win) {
          win.document.write(`<img src="${b.deliveryPhoto}" style="max-width:100%;" alt="Bukti Pengantaran">`);
        }
      }
    };
  }
}

function formatDateIndonesian(dateStr) {
  if (!dateStr) return "-";
  try {
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agust", "Sep", "Okt", "Nov", "Des"];
    const parts = String(dateStr).split("-");
    if (parts.length === 3) {
      const day = parts[2];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const m = months[d.getMonth()];
      const y = d.getFullYear();
      return `${day} ${m} ${y}`;
    }
  } catch(e) {}
  return dateStr;
}


function openVendorPdfOptionsModal(vendorId) {
  const vendor = (state.vendors || []).find(v => v.id === vendorId);
  if (!vendor) {
    showToast("Data vendor tidak ditemukan.", "error");
    return;
  }

  const modalHtml = `
    <form id="vendor-pdf-options-form" style="font-family:'Mulish', sans-serif; color:#1e293b;">
      <div style="background:#fffdf5; border:1px solid #fef3c7; border-radius:12px; padding:12px 14px; margin-bottom:16px;">
        <div style="font-size:0.75rem; font-weight:800; color:#b89230; text-transform:uppercase; margin-bottom:2px;">MITRA VENDOR SAUDI ARABIA</div>
        <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin:0;">${vendor.name}</h3>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:800; font-size:0.85rem;">1. Pilihan Jenis Laporan PDF</label>
        <select id="pdf-report-type" class="form-select" required style="font-size:0.88rem; font-weight:700;">
          <option value="rekap">Rekapitulasi Pemesanan Vendor</option>
          <option value="keuangan">Laporan Keuangan & Mutasi Saldo</option>
        </select>
      </div>

      <div class="grid-2col" style="margin-bottom:18px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:800; font-size:0.82rem;">2. Tanggal Mulai (Opsional)</label>
          <input type="date" id="pdf-date-start" class="form-input" style="font-size:0.85rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:800; font-size:0.82rem;">3. Tanggal Selesai (Opsional)</label>
          <input type="date" id="pdf-date-end" class="form-input" style="font-size:0.85rem;">
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="width:100%; padding:14px; font-weight:900; font-size:0.95rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px;">
        <i data-lucide="printer" style="width:18px; height:18px;"></i> CETAK DOKUMEN PDF
      </button>
    </form>
  `;

  openModal("Cetak PDF Laporan Vendor", modalHtml);
  lucide.createIcons();

  document.getElementById("vendor-pdf-options-form").onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById("pdf-report-type").value;
    const dateStart = document.getElementById("pdf-date-start").value;
    const dateEnd = document.getElementById("pdf-date-end").value;

    closeModal();
    printPublicVendorPDF(vendorId, type, dateStart, dateEnd);
  };
}

function renderPublicVendorPortal() {
  const hash = window.location.hash;
  const queryString = hash.includes("?") ? hash.split("?")[1] : "";
  const params = new URLSearchParams(queryString);
  
  const nameParam = params.get("name") || params.get("vendor");
  const idParam = params.get("id");

  let vendor = null;

  // Search vendor by Name (Supports encoded names or slugified names e.g. name=Katering+Madinah or name=katering-madinah)
  if (nameParam) {
    const cleanParam = decodeURIComponent(nameParam).toLowerCase().trim().replace(/[-+]/g, ' ');
    vendor = (state.vendors || []).find(v => {
      if (!v || !v.name) return false;
      const vName = v.name.toLowerCase().trim();
      return vName === cleanParam || vName.replace(/\s+/g, '-') === cleanParam.replace(/\s+/g, '-');
    });
  }

  // Fallback 1: Search by ID if name param not provided
  if (!vendor && idParam) {
    vendor = (state.vendors || []).find(v => v.id === idParam);
  }

  // Fallback 2: Default to first vendor in state.vendors if no param provided or vendor not found
  if (!vendor && state.vendors && state.vendors.length > 0) {
    vendor = state.vendors[0];
  }

  if (!vendor) {
    APP_CONTAINER.innerHTML = `
      <div style="max-width:500px; margin:60px auto; padding:32px 20px; text-align:center; background:#fff; border-radius:20px; box-shadow:0 15px 35px rgba(0,0,0,0.06); font-family:'Mulish', sans-serif;">
        <div style="font-size:3.5rem; margin-bottom:12px;">⚠️</div>
        <h2 style="font-weight:900; color:#1e293b; margin-bottom:8px;">Portal Vendor Tidak Ditemukan</h2>
        <p style="color:#64748b; font-size:0.9rem; line-height:1.5;">Link halaman jadwal pemesanan vendor ini tidak valid atau telah diperbarui.</p>
        <button onclick="window.location.hash='#login'" class="btn btn-gold" style="margin-top:20px; width:auto; padding:10px 24px; font-weight:800; border-radius:12px;">Halaman Utama</button>
      </div>
    `;
    return;
  }

  // Dynamic Vendor PWA Metadata & Manifest
  document.title = `Vendor JI - ${vendor.name}`;

  const vendorBookings = state.bookings
    .filter(b => b.vendorId === vendor.id)
    .sort((a, b) => (b.dateStart || b.date || '').localeCompare(a.dateStart || a.date || ''));
  const totalOrders = vendorBookings.length;
  const newOrders = vendorBookings.filter(b => !b.status || b.status === 'Pesanan Baru' || b.status === 'Aktif').length;
  const processOrders = vendorBookings.filter(b => b.status === 'Proses').length;
  const completedOrders = vendorBookings.filter(b => b.status === 'Selesai').length;

  let currentStatusFilter = "semua";

  const makeVendorBookingCard = (b) => {
    const group = state.groups.find(g => g.name === b.groupName);
    const muthawwifName = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
    const locationName = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Al Marwa Rayhaan Rotana (Bus 1)') : 'Hotel Al Marwa Rayhaan Rotana (Bus 1)');
    const activityTitle = (b.activityGoal || b.activity || b.notes || 'SNACK CITY TOUR MAKKAH').toUpperCase();
    const dateFormatted = formatDateIndonesian(b.dateStart || b.date);
    const timeFormatted = b.time ? b.time : '05:30';

    const productsList = (b.products && b.products.length > 0) ? b.products : [
      { name: b.notes || 'Snack Kering', qty: b.qty || 1, unit: b.unit || 'Pcs', amount: b.amount || (b.totalPrice || 242) }
    ];

    const currentStatus = b.status || 'Pesanan Baru';
    let badgeStyle = "background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
    let badgeText = "Pesanan Baru";

    if (currentStatus === 'Proses') {
      badgeStyle = "background:#fffbe6; color:#d97706; border:1px solid #fde68a; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
      badgeText = "Proses";
    } else if (currentStatus === 'Selesai') {
      badgeStyle = "background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
      badgeText = "Selesai";
    }

    return `
      <div onclick="openVendorProcessModal('${b.id}')" class="vendor-card-row" style="cursor:pointer; background:#ffffff; border-radius:14px; padding:16px 18px; margin-bottom:14px; border:1px solid #f1f5f9; box-shadow:0 4px 14px rgba(0,0,0,0.03); border-bottom:3px solid #dfc06b; font-family:'Mulish', sans-serif; transition:transform 0.15s ease;">
        
        <!-- Top Row: Activity Goal, Status Badge, & Date/Time -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
          <div style="font-weight:900; font-size:0.95rem; color:#000; letter-spacing:0.01em; text-transform:uppercase; flex:1;">
            ${activityTitle}
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span style="${badgeStyle}">${badgeText}</span>
            <div style="font-size:0.78rem; font-weight:700; color:#334155; white-space:nowrap; margin-top:2px;">
              ${dateFormatted} | ${timeFormatted}
            </div>
          </div>
        </div>

        <!-- Group Name -->
        <div style="font-size:0.85rem; color:#475569; margin-bottom:4px; font-weight:600;">
          ${b.groupName}
        </div>

        <!-- Muthowwif -->
        <div style="font-size:0.83rem; color:#334155; margin-bottom:3px;">
          <span style="display:inline-block; width:85px; color:#64748b;">Muthowwif</span> : <strong style="color:#1e293b;">${muthawwifName}</strong>
        </div>

        <!-- Lokasi -->
        <div style="font-size:0.83rem; color:#334155; margin-bottom:4px;">
          <span style="display:inline-block; width:85px; color:#64748b;">Lokasi</span> : <strong style="color:#0f172a; font-weight:900;">${locationName}</strong>
        </div>

        <!-- Catatan Tambahan -->
        <div style="font-size:0.8rem; color:#475569; margin-bottom:10px; background:#f8fafc; padding:6px 10px; border-radius:8px; border-left:3px solid #dfc06b;">
          <strong>Catatan Tambahan:</strong> ${b.notes || b.remarks || b.customText || '-'}
        </div>

        <!-- Products Lines -->
        <div style="border-top:1px dashed #e2e8f0; padding-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${productsList.map(prod => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:#1e293b;">
              <div style="flex:1; color:#334155; padding-left:12px;">${prod.name || 'Snack Kering'}</div>
              <div style="width:90px; text-align:center; font-weight:700; color:#475569;">${prod.qty || 1} ${prod.unit || 'Pcs'}</div>
              <div style="width:100px; text-align:right; font-weight:900; color:#0f172a;">SAR ${(prod.amount || prod.price || 0).toLocaleString('id-ID')}</div>
            </div>
          `).join('')}
        </div>

        <!-- Tap Hint -->
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #f1f5f9; text-align:right; font-size:0.75rem; font-weight:800; color:#b45309;">
          Klik untuk kelola / upload foto pengantaran ➔
        </div>

      </div>
    `;
  };

  APP_CONTAINER.innerHTML = `
    <div style="height:100vh; background:#f4f6f9; font-family:'Mulish', sans-serif; padding:12px 10px 12px 10px; box-sizing:border-box; overflow:hidden;">
      <div style="max-width:700px; margin:0 auto; height:100%; display:flex; flex-direction:column;">
        
        <!-- FIXED TOP HEADER & CONTROLS -->
        <div style="flex-shrink:0;">
          
          <!-- Header Bar: Soft UI / Glassmorphism -->
          <div style="background:rgba(255,255,255,0.85); backdrop-filter:blur(16px); border-radius:18px; padding:12px 16px; border:1px solid rgba(255,255,255,0.9); box-shadow:0 8px 24px rgba(0,0,0,0.04); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <img src="assets/logo.png" style="height:38px; object-fit:contain;" alt="Jejak Imani Logo" onerror="this.style.display='none';">
              <div style="min-width:0;">
                <div style="font-size:0.68rem; color:#b45309; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">PORTAL MITRA VENDOR & SUPPLIER</div>
                <div style="font-size:0.82rem; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">PT. JEJAK IMANI BERKAH BERSAMA</div>
              </div>
            </div>

            <!-- Real-Time Status Indicator -->
            <div style="display:flex; align-items:center; padding-left:4px;">
              <span style="width:12px; height:12px; background:#10b981; border-radius:50%; display:inline-block; box-shadow:0 0 10px #10b981;" title="Connected Real-Time"></span>
            </div>
          </div>

          <!-- Calculate Vendor Wallet Balance -->
          ${(() => {
            const vendorBal = (state.financial.vendorWallets && state.financial.vendorWallets[vendor.id]) || 0;
            return `
              <!-- Biodata Vendor & Widget Area (Collapsible) -->
              <div style="background:linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.85) 100%); backdrop-filter:blur(12px); border-radius:18px; padding:14px 16px; border:1px solid rgba(255,255,255,0.9); box-shadow:0 8px 20px rgba(0,0,0,0.02); margin-bottom:12px;">
                
                <!-- Header Bar of Card (Always Visible) -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                  <div style="flex:1; min-width:180px; display:flex; align-items:center; gap:8px;">
                    <span style="background:#fef3c7; color:#92400e; font-weight:900; font-size:0.7rem; padding:3px 9px; border-radius:20px; text-transform:uppercase;">${vendor.type || 'Mitra Layanan'}</span>
                    <h1 style="margin:0; font-size:1.25rem; font-weight:900; color:#0f172a; display:inline-block;">${vendor.name}</h1>
                  </div>

                  <div style="display:flex; align-items:center; gap:8px;">
                    <!-- Toggle Expand/Collapse Button -->
                    <button id="pv-toggle-header-btn" class="btn" style="width:36px; height:36px; padding:0; border-radius:10px; background:#ffffff; color:#334155; border:1px solid #cbd5e1; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" title="Sembunyikan / Tampilkan Widget">
                      <i id="pv-toggle-icon" data-lucide="chevron-up" style="width:18px; height:18px;"></i>
                      <span id="pv-toggle-text" class="hidden"></span>
                    </button>

                    <button id="pv-print-pdf-btn" class="btn btn-gold" style="width:36px; height:36px; padding:0; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(223,192,107,0.3);" title="Cetak PDF">
                      <i data-lucide="printer" style="width:18px; height:18px;"></i>
                    </button>
                  </div>
                </div>

                <!-- Collapsible Body (Contact, Notes, & 2 Widgets) -->
                <div id="pv-collapsible-body" style="margin-top:10px; transition:all 0.3s ease;">
                  <div style="font-size:0.82rem; color:#475569; margin-bottom:2px;">📞 Contact: <strong>${vendor.contact || '-'}</strong></div>
                  <div style="font-size:0.78rem; color:#64748b;">📝 Keterangan: <em>${vendor.notes || vendor.description || 'Mitra Penyelenggara Layanan Operational Tim Khidmat jejak imani Saudi Arabia'}</em></div>

                  <!-- Vendor Financial & Estimate Grid (2 Cards Side-by-Side) -->
                  ${(() => {
                    const estimatedBudgetCost = vendorBookings
                      .filter(b => {
                        const st = b.status || 'Pesanan Baru';
                        return st === 'Pesanan Baru' || st === 'Proses' || st === 'Aktif';
                      })
                      .reduce((sum, b) => {
                        const cost = b.totalPrice || (b.products ? b.products.reduce((s, p) => s + ((p.amount || p.price || 0) * (p.qty || 1)), 0) : 0) || 0;
                        return sum + cost;
                      }, 0);

                    return `
                      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:12px;">
                        
                        <!-- Widget 1: SALDO DOMPET VENDOR -->
                        <div style="background:rgba(255,255,255,0.85); backdrop-filter:blur(12px); border-radius:14px; padding:12px 18px; display:flex; flex-direction:column; justify-content:center; border:1px solid #dfc06b; box-shadow:0 4px 12px rgba(223,192,107,0.15);">
                          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; color:#b45309; font-weight:900; margin-bottom:2px;">
                            SALDO DOMPET VENDOR
                          </div>
                          <div style="font-size:1.35rem; font-weight:900; color:${vendorBal < 0 ? '#dc2626' : '#0f172a'}; display:flex; align-items:center; gap:8px;">
                            SAR ${vendorBal.toLocaleString('id-ID')}
                            ${vendorBal < 0 ? '<span style="font-size:0.7rem; background:#ef4444; color:#ffffff; padding:2px 6px; border-radius:8px; font-weight:800;">MINUS</span>' : ''}
                          </div>
                        </div>

                        <!-- Widget 2: ESTIMASI KEBUTUHAN -->
                        <div style="background:rgba(255,255,255,0.85); backdrop-filter:blur(12px); border-radius:14px; padding:12px 18px; display:flex; flex-direction:column; justify-content:center; border:1px solid #dfc06b; box-shadow:0 4px 12px rgba(223,192,107,0.15);">
                          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; color:#b45309; font-weight:900; margin-bottom:2px;">
                            ESTIMASI KEBUTUHAN
                          </div>
                          <div style="font-size:1.35rem; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:8px;">
                            SAR ${estimatedBudgetCost.toLocaleString('id-ID')}
                          </div>
                        </div>

                      </div>
                    `;
                  })()}
                </div>

              </div>
            `;
          })()}

          <!-- Filter Tab Bar: Semua, Pesanan Baru, Proses, Selesai -->
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px; scrollbar-width:none;">
            <button id="pv-tab-semua" class="pv-filter-btn active" data-filter="semua" style="flex:1; min-width:90px; padding:9px 6px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #0f172a; background:#0f172a; color:#ffffff; cursor:pointer; text-align:center; transition:all 0.2s;">
              Semua (${totalOrders})
            </button>
            <button id="pv-tab-baru" class="pv-filter-btn" data-filter="baru" style="flex:1; min-width:110px; padding:9px 6px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#1d4ed8; cursor:pointer; text-align:center; transition:all 0.2s;">
              Pesanan Baru (${newOrders})
            </button>
            <button id="pv-tab-proses" class="pv-filter-btn" data-filter="proses" style="flex:1; min-width:95px; padding:9px 6px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#d97706; cursor:pointer; text-align:center; transition:all 0.2s;">
              Proses (${processOrders})
            </button>
            <button id="pv-tab-selesai" class="pv-filter-btn" data-filter="selesai" style="flex:1; min-width:95px; padding:9px 6px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#10b981; cursor:pointer; text-align:center; transition:all 0.2s;">
              Selesai (${completedOrders})
            </button>
          </div>

          <!-- Search Bar & Date Filter Row -->
          <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
            <input type="text" id="pv-search" class="form-input" placeholder="Cari pemesanan (kegiatan, grup, muthowwif)..." style="flex:1; font-size:0.85rem; padding:9px 12px; border-radius:12px; background:#fff; border:1px solid #cbd5e1; box-sizing:border-box;">
            <input type="date" id="pv-date-filter" class="form-input" title="Filter Tanggal Pemesanan" style="width:135px; font-size:0.8rem; padding:8px 10px; border-radius:12px; background:#fff; border:1px solid #cbd5e1; box-sizing:border-box; color:#0f172a; font-weight:700;">
          </div>

        </div>

        <!-- ONLY THIS AREA CAN BE SCROLLED -->
        <div id="pv-cards-container" style="flex:1; overflow-y:auto; padding-right:2px; scrollbar-width:thin;">
          ${vendorBookings.length === 0 ? `
            <div style="text-align:center; padding:30px; background:#fff; border-radius:14px; color:#94a3b8; font-size:0.85rem; border:1px solid #e2e8f0;">Belum ada jadwal pemesanan untuk vendor ini.</div>
          ` : vendorBookings.map(b => makeVendorBookingCard(b)).join('')}
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();

  // Restore initial collapsed state if saved
  if (typeof localStorage !== 'undefined' && localStorage.getItem("pv_collapsed_" + vendor.id) === "true") {
    const collBody = document.getElementById("pv-collapsible-body");
    const toggleIcon = document.getElementById("pv-toggle-icon");
    const toggleText = document.getElementById("pv-toggle-text");
    if (collBody) collBody.style.display = "none";
    if (toggleIcon) toggleIcon.setAttribute("data-lucide", "chevron-down");
    if (toggleText) toggleText.textContent = "Tampilkan Widget";
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  const applyVendorFilters = () => {
    const q = (document.getElementById("pv-search")?.value || "").toLowerCase().trim();
    const dateVal = document.getElementById("pv-date-filter")?.value || "";

    const filtered = vendorBookings.filter(b => {
      const st = b.status || "Pesanan Baru";
      let matchTab = true;
      if (currentStatusFilter === "baru") matchTab = (st === "Pesanan Baru" || st === "Aktif");
      else if (currentStatusFilter === "proses") matchTab = (st === "Proses");
      else if (currentStatusFilter === "selesai") matchTab = (st === "Selesai");

      const goal = (b.activityGoal || b.activity || '').toLowerCase();
      const grp = (b.groupName || '').toLowerCase();
      const muth = (b.muthawwif || '').toLowerCase();
      const notes = (b.notes || '').toLowerCase();
      const matchSearch = !q || (goal.includes(q) || grp.includes(q) || muth.includes(q) || notes.includes(q));

      let matchDate = true;
      if (dateVal) {
        const bDate = b.dateStart || b.date || "";
        matchDate = bDate.startsWith(dateVal);
      }

      return matchTab && matchSearch && matchDate;
    });

    const container = document.getElementById("pv-cards-container");
    if (container) {
      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; background:#fff; border-radius:14px; color:#94a3b8; font-size:0.85rem; border:1px solid #e2e8f0;">Tidak ada pemesanan dalam kategori ini.</div>`;
      } else {
        container.innerHTML = filtered.map(b => makeVendorBookingCard(b)).join('');
      }
    }
  };

  // Tab Filtering Handler
  document.querySelectorAll(".pv-filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".pv-filter-btn").forEach(b => {
        b.style.background = "#ffffff";
        b.style.border = "1px solid #e2e8f0";
        const f = b.getAttribute("data-filter");
        if (f === "baru") b.style.color = "#1d4ed8";
        else if (f === "proses") b.style.color = "#d97706";
        else if (f === "selesai") b.style.color = "#10b981";
        else b.style.color = "#0f172a";
      });

      btn.style.background = "#0f172a";
      btn.style.color = "#ffffff";
      btn.style.border = "1px solid #0f172a";

      currentStatusFilter = btn.getAttribute("data-filter");
      applyVendorFilters();
    };
  });

  // Search & Date Filter Handlers
  const pvSearch = document.getElementById("pv-search");
  if (pvSearch) pvSearch.oninput = () => applyVendorFilters();

  const pvDateFilter = document.getElementById("pv-date-filter");
  if (pvDateFilter) pvDateFilter.onchange = () => applyVendorFilters();

  const pvPrintBtn = document.getElementById("pv-print-pdf-btn");
  if (pvPrintBtn) {
    pvPrintBtn.onclick = () => openVendorPdfOptionsModal(vendor.id);
  }
  const pvToggleBtn = document.getElementById("pv-toggle-header-btn");
  if (pvToggleBtn) {
    pvToggleBtn.onclick = () => {
      const widgetContent = document.getElementById("pv-widget-header-content") || document.querySelector(".vendor-widget-body");
      const icon = document.getElementById("pv-toggle-icon");
      if (widgetContent) {
        if (widgetContent.style.display === "none") {
          widgetContent.style.display = ""; // Tampilkan widget
          if (icon) icon.setAttribute("data-lucide", "chevron-up");
        } else {
          widgetContent.style.display = "none"; // Sembunyikan widget
          if (icon) icon.setAttribute("data-lucide", "chevron-down");
        }
        
        if (window.lucide && lucide.createIcons) {
          lucide.createIcons();
        }
      }
    }
  }

}


// Utility to reset database to 100% clean production launch state
function resetDatabaseToFreshLaunchState() {
}

// Helper to cascade delete a group and all connected data (Itinerary, Roomlist, Assignments, Documents, Bookings)
function deleteGroupCascade(groupName) {
}


function renderUserScanQr() {
}



function openAdminSettingsPopup() {
  const currentFontSize = localStorage.getItem("jejak_imani_font_size") || "normal";
  const currentUser = state.currentUser || {};
  
  const formHtml = `
    <form id="admin-profile-settings-form">
      <div class="form-group">
        <label class="form-label">Nama Administrator</label>
        <input type="text" id="adm-prof-name" class="form-input" value="${currentUser.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor WhatsApp</label>
        <input type="text" id="adm-prof-wa" class="form-input" value="${currentUser.whatsapp || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Ubah Password Baru</label>
        <input type="password" id="adm-prof-pass" class="form-input" placeholder="Kosongkan jika tidak diubah" autocomplete="new-password">
      </div>
      
      <div class="form-group" style="margin-top:16px; margin-bottom:16px; border-top:1px solid #f1f5f9; padding-top:14px;">
        <label class="form-label" style="font-weight:800; color:#0f172a; display:flex; align-items:center; gap:6px;">
          <i data-lucide="type" style="width:16px; height:16px; color:#c5a850;"></i> Ukuran Font Tampilan (Font Size)
        </label>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-top:6px;">
          <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'small' ? 'btn-gold' : 'btn-secondary'}" data-size="small" style="padding:8px 2px; font-size:0.75rem;">Kecil</button>
          <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'normal' ? 'btn-gold' : 'btn-secondary'}" data-size="normal" style="padding:8px 2px; font-size:0.75rem;">Normal</button>
          <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'large' ? 'btn-gold' : 'btn-secondary'}" data-size="large" style="padding:8px 2px; font-size:0.75rem;">Besar</button>
          <button type="button" class="btn font-size-setting-btn ${currentFontSize === 'xlarge' ? 'btn-gold' : 'btn-secondary'}" data-size="xlarge" style="padding:8px 2px; font-size:0.75rem;">Sangat Besar</button>
        </div>
      </div>

      <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 14px;">Batal</button>
        <button type="submit" class="btn btn-gold" style="width:auto; padding:6px 16px;">Simpan</button>
      </div>
    </form>
  `;
  openModal("Pengaturan Akun & Tampilan Admin", formHtml);
  lucide.createIcons();

  document.querySelectorAll(".font-size-setting-btn").forEach(btn => {
    btn.onclick = () => {
      const sz = btn.getAttribute("data-size");
      applyGlobalFontSize(sz);
      document.querySelectorAll(".font-size-setting-btn").forEach(b => {
        if (b.getAttribute("data-size") === sz) {
          b.className = "btn font-size-setting-btn btn-gold";
        } else {
          b.className = "btn font-size-setting-btn btn-secondary";
        }
      });
      const labelMap = { small: 'Kecil', normal: 'Normal', large: 'Besar', xlarge: 'Sangat Besar' };
      showToast("Ukuran font diubah ke: " + (labelMap[sz] || 'Normal'));
    };
  });

  document.getElementById("admin-profile-settings-form").onsubmit = (e) => {
    e.preventDefault();
    const nName = document.getElementById("adm-prof-name").value.trim();
    const nWa = document.getElementById("adm-prof-wa").value.trim();
    const nPass = document.getElementById("adm-prof-pass").value;

    const idx = state.users.findIndex(u => u.username === currentUser.username);
    if (idx !== -1) {
      state.users[idx].name = nName;
      state.users[idx].whatsapp = nWa;
      if (nPass) state.users[idx].password = nPass;
      state.currentUser.name = nName;
      state.currentUser.whatsapp = nWa;
      saveState();
      closeModal();
      showToast("Pengaturan profil berhasil disimpan.");
      router();
    }
  };
}



function openTimerReportPopup() {
  const username = state.currentUser ? state.currentUser.username : '';
  const popupHtml = `
    <div style="font-family:'Mulish', sans-serif;">
      <form id="timer-report-form">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Pilih / Ketik Nama Grup</label>
          <input type="text" id="timer-group-input" class="form-input" placeholder="Ketik atau pilih nama grup..." required style="font-size:0.85rem; padding:8px 12px;">
          <div id="timer-group-suggestions" class="suggestion-list hidden"></div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Kategori Timer Operational</label>
          <select id="timer-category-select" class="form-select" required style="font-size:0.85rem; padding:8px 12px;">
            <option value="Waktu Kedatangan Bandara Jeddah">Waktu Kedatangan Bandara Jeddah</option>
            <option value="Waktu Kepulangan Bandara Jeddah">Waktu Kepulangan Bandara Jeddah</option>
            <option value="Waktu Kedatangan Bandara Madinah">Waktu Kedatangan Bandara Madinah</option>
            <option value="Waktu Kepulangan Bandara Madinah">Waktu Kepulangan Bandara Madinah</option>
          </select>
        </div>

        <!-- Big Circle SET Button & Milestone Tracker -->
        <div style="text-align:center; padding:16px 10px; background:#f8fafc; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:16px;">
          
          <div id="timer-milestones-container" style="text-align:left; font-size:0.8rem; display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
            <div id="milestone-1-label" style="color:#64748b; font-weight:700;">1. Milestone 1: <span id="m1-time" style="color:#0f172a; font-weight:900;">Belum di-set</span></div>
            <div id="milestone-2-label" style="color:#64748b; font-weight:700;">2. Milestone 2: <span id="m2-time" style="color:#0f172a; font-weight:900;">Belum di-set</span></div>
            <div id="milestone-3-label" style="color:#64748b; font-weight:700;">3. Milestone 3: <span id="m3-time" style="color:#0f172a; font-weight:900;">Belum di-set</span></div>
          </div>

          <div id="timer-duration-display" class="hidden" style="background:#e0f2fe; color:#0369a1; padding:10px; border-radius:10px; font-weight:900; font-size:0.85rem; margin-bottom:16px;"></div>

          <button type="button" id="timer-big-set-btn" style="width:96px; height:96px; border-radius:50%; background:linear-gradient(135deg, #c5a850 0%, #b89230 100%); color:#fff; border:4px solid #fff; box-shadow:0 8px 20px rgba(197,168,80,0.4); font-size:1.3rem; font-weight:900; cursor:pointer; transition:transform 0.15s ease; margin:0 auto; display:inline-flex; align-items:center; justify-content:center;">
            SET
          </button>

          <button type="submit" id="timer-submit-btn" class="btn btn-gold hidden" style="width:100%; padding:12px; font-size:0.9rem; font-weight:900; border-radius:12px; margin-top:8px;">
            SUBMIT LAPORAN TIMER
          </button>
        </div>
      </form>
    </div>
  `;

  openModal("Timer Operasional Bandara", popupHtml);
  initSuggestionInput("timer-group-input", "timer-group-suggestions", state.groups.map(g => g.name));

  const categorySelect = document.getElementById("timer-category-select");
  const m1Label = document.getElementById("milestone-1-label");
  const m2Label = document.getElementById("milestone-2-label");
  const m3Label = document.getElementById("milestone-3-label");
  const m1Time = document.getElementById("m1-time");
  const m2Time = document.getElementById("m2-time");
  const m3Time = document.getElementById("m3-time");
  const bigSetBtn = document.getElementById("timer-big-set-btn");
  const submitBtn = document.getElementById("timer-submit-btn");
  const durationDiv = document.getElementById("timer-duration-display");

  let step = 0;
  let t1Val = "", t2Val = "", t3Val = "";
  let durationMinutes = 0;

  const updateMilestoneLabels = () => {
    const isKedatangan = categorySelect.value.toLowerCase().includes('kedatangan');
    m1Label.innerHTML = `1. ${isKedatangan ? 'Waktu Landing' : 'Bus Masuk Check Point'}: <span id="m1-time" style="color:#0f172a; font-weight:900;">${t1Val || 'Belum di-set'}</span>`;
    m2Label.innerHTML = `2. ${isKedatangan ? 'Keluar Imigrasi' : 'Bus Naik'}: <span id="m2-time" style="color:#0f172a; font-weight:900;">${t2Val || 'Belum di-set'}</span>`;
    m3Label.innerHTML = `3. ${isKedatangan ? 'Bus Berangkat' : 'Jamaah Masuk Imigrasi'}: <span id="m3-time" style="color:#0f172a; font-weight:900;">${t3Val || 'Belum di-set'}</span>`;
  };

  categorySelect.onchange = () => {
    step = 0;
    t1Val = ""; t2Val = ""; t3Val = "";
    bigSetBtn.classList.remove("hidden");
    submitBtn.classList.add("hidden");
    durationDiv.classList.add("hidden");
    updateMilestoneLabels();
  };

  updateMilestoneLabels();

  bigSetBtn.onclick = () => {
    const saudiTime = getSaudiDateTime().timeStr;
    step++;
    if (step === 1) {
      t1Val = saudiTime;
      showToast("Klik 1: Milestone 1 dicatat.");
    } else if (step === 2) {
      t2Val = saudiTime;
      showToast("Klik 2: Milestone 2 dicatat.");
    } else if (step === 3) {
      t3Val = saudiTime;
      showToast("Klik 3: Milestone 3 dicatat.");
      bigSetBtn.classList.add("hidden");
      submitBtn.classList.remove("hidden");

      // Calculate duration between Milestone 2 & Milestone 3
      const parseMinutes = (tStr) => {
        if (!tStr) return 0;
        const p = tStr.split(':');
        return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
      };
      const m2 = parseMinutes(t2Val);
      const m3 = parseMinutes(t3Val);
      durationMinutes = m3 >= m2 ? (m3 - m2) : (m3 + 1440 - m2);

      const isKedatangan = categorySelect.value.toLowerCase().includes('kedatangan');
      const durationTitle = isKedatangan ? 'Durasi Keluar Imigrasi s/d Bus Berangkat' : 'Durasi Bus Naik s/d Jamaah Masuk Imigrasi';
      durationDiv.innerHTML = `⏱️ ${durationTitle}: <strong>${durationMinutes} Menit</strong>`;
      durationDiv.classList.remove("hidden");
    }
    updateMilestoneLabels();
  };

  document.getElementById("timer-report-form").onsubmit = (e) => {
    e.preventDefault();
    const gName = document.getElementById("timer-group-input").value.trim();
    const cat = categorySelect.value;
    const isKedatangan = cat.toLowerCase().includes('kedatangan');
    const catTitle = cat.toUpperCase();

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationFormatted = `${hours} Jam ${mins} Menit`;

    let waText = `*${catTitle}*\n`;
    if (isKedatangan) {
      waText += `Landing : ${t1Val || '12.00'}\n`;
      waText += `Keluar Imigrasi : ${t2Val || '13.00'}\n`;
      waText += `Bus Berangkat : ${t3Val || '14.00'}\n\n`;
    } else {
      waText += `Check Point Bus : ${t1Val || '12.00'}\n`;
      waText += `Bus Naik : ${t2Val || '13.00'}\n`;
      waText += `Masuk Imigrasi : ${t3Val || '14.00'}\n\n`;
    }
    waText += `Total Waktu : *${durationFormatted}*\n\n`;
    waText += `Barokallahu fiikum\n`;
    waText += `_*Pesan dikirim melalui sistem '''jejak imani'''*_`;

    const newInc = {
      id: `inc-${Date.now()}`,
      username,
      groupName: gName,
      category: `Timer: ${cat}`,
      detail: waText,
      date: getSaudiDateTime().gregorianStr,
      status: "Diproses"
    };

    state.reports.incidents.push(newInc);
    saveState();
    closeModal();
    showToast("Laporan Timer Operasional disubmit!");
    
    // Push notification to device
    const uName = state.currentUser ? state.currentUser.name : username;
    sendPushNotification(`Timer ${cat}`, `${uName} berhasil kirim laporan ${cat} (${gName})\n${getSaudiDateTime().timeStr}`);
    loadUserTab("insiden");
  };
}



function openGridPhotoReportPopup() {
  const username = state.currentUser ? state.currentUser.username : '';
  let uploadedPhotos = ["", "", "", ""];

  const popupHtml = `
    <div style="font-family:'Mulish', sans-serif;">
      <form id="grid-photo-step1-form">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Pilih / Ketik Nama Grup</label>
          <input type="text" id="grid-group-input" class="form-input" placeholder="Ketik nama grup..." required style="font-size:0.85rem; padding:8px 12px;">
          <div id="grid-group-suggestions" class="suggestion-list hidden"></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Kategori Inspektif</label>
          <select id="grid-category-select" class="form-select" required style="font-size:0.85rem; padding:8px 12px;">
            <option value="Kondisi Bus">Kondisi Bus</option>
            <option value="Kondisi Kamar">Kondisi Kamar</option>
          </select>
        </div>

        <div class="form-group" id="grid-bus-no-container" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Nomor Bus</label>
          <input type="text" id="grid-bus-no-input" class="form-input" placeholder="Contoh: Bus 01 / Plate 4821" style="font-size:0.85rem; padding:8px 12px;">
        </div>

        <div class="form-group hidden" id="grid-room-no-container" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">Nomor Kamar</label>
          <input type="text" id="grid-room-no-input" class="form-input" placeholder="Contoh: Kamar 402 / Hotel Maden" style="font-size:0.85rem; padding:8px 12px;">
        </div>

        <!-- 4 Photo Grid (Rasio 1:1) -->
        <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:8px;">Dokumentasi Foto (Minimal 4 Foto - Rasio 1:1)</div>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:16px;">
          ${[0,1,2,3].map(i => `
            <div style="aspect-ratio:1/1; background:#f8fafc; border:2px dashed #cbd5e1; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; overflow:hidden;" id="grid-slot-box-${i}">
              <img id="grid-slot-img-${i}" class="hidden" style="width:100%; height:100%; object-fit:cover;">
              <div id="grid-slot-empty-${i}" style="text-align:center; padding:8px;">
                <i data-lucide="camera" style="width:24px; height:24px; color:#c5a850; margin-bottom:4px;"></i>
                <div style="font-size:0.7rem; font-weight:800; color:#64748b;">Foto ${i+1}</div>
              </div>
              <input type="file" id="grid-file-input-${i}" accept="image/*" style="position:absolute; width:100%; height:100%; opacity:0; cursor:pointer;">
            </div>
          `).join('')}
        </div>

        <button type="submit" class="btn btn-gold" style="width:100%; padding:12px; font-size:0.9rem; font-weight:900; border-radius:12px;">
          ISI FORM CHECKLIST &rarr;
        </button>
      </form>
    </div>
  `;

  openModal("Grid Foto Dokumentasi", popupHtml);
  lucide.createIcons();
  initSuggestionInput("grid-group-input", "grid-group-suggestions", state.groups.map(g => g.name));

  const catSelect = document.getElementById("grid-category-select");
  const busContainer = document.getElementById("grid-bus-no-container");
  const roomContainer = document.getElementById("grid-room-no-container");

  catSelect.onchange = () => {
    if (catSelect.value === "Kondisi Kamar") {
      busContainer.classList.add("hidden");
      roomContainer.classList.remove("hidden");
    } else {
      busContainer.classList.remove("hidden");
      roomContainer.classList.add("hidden");
    }
  };

  // Bind 4 photo inputs
  [0,1,2,3].forEach(i => {
    const fileInp = document.getElementById(`grid-file-input-${i}`);
    const imgEl = document.getElementById(`grid-slot-img-${i}`);
    const emptyEl = document.getElementById(`grid-slot-empty-${i}`);

    fileInp.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          uploadedPhotos[i] = evt.target.result;
          imgEl.src = evt.target.result;
          imgEl.classList.remove("hidden");
          emptyEl.classList.add("hidden");
        };
        reader.readAsDataURL(file);
      }
    };
  });

  document.getElementById("grid-photo-step1-form").onsubmit = (e) => {
    e.preventDefault();
    const gName = document.getElementById("grid-group-input").value.trim();
    const cat = catSelect.value;
    const busNo = document.getElementById("grid-bus-no-input").value.trim();
    const roomNo = document.getElementById("grid-room-no-input").value.trim();

    const filledCount = uploadedPhotos.filter(p => !!p).length;
    if (filledCount < 4) {
      showToast("Mohon unggah/ambil minimal 4 foto dokumentasi!", "error");
      return;
    }

    showToast("Menggabungkan 4 foto menjadi 1 Grid Composite 1:1...");
    generateComposite2x2Grid(uploadedPhotos, (compositePhotos) => {
      openChecklistFormPopup(gName, cat, cat === "Kondisi Bus" ? busNo : roomNo, compositePhotos);
    });
  };
}

function openChecklistFormPopup(groupName, category, targetNo, photos) {
  const isBus = (category === "Kondisi Bus");
  
  const checklistItems = isBus 
    ? ["Bersih", "Wangi", "AC", "WC", "Mic"]
    : ["Bersih", "Wangi", "AC", "WC", "TV", "Handuk", "Amenities"];

  const popupHtml = `
    <div style="font-family:'Mulish', sans-serif;">
      <form id="grid-checklist-step2-form">
        <div style="background:#f8fafc; border-radius:12px; padding:12px; border:1px solid #e2e8f0; margin-bottom:16px; font-size:0.82rem;">
          <div>Grup: <strong>${groupName}</strong></div>
          <div>Kategori: <strong>${category}</strong> (${isBus ? 'No Bus' : 'No Kamar'}: <strong>${targetNo || '-'}</strong>)</div>
          <div>Foto Terunggah: <strong>${photos.length} Foto 1:1</strong></div>
        </div>

        <div style="font-size:0.85rem; font-weight:800; color:#0f172a; margin-bottom:10px;">Checklist Kelayakan & Kondisi:</div>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:16px;">
          ${checklistItems.map(item => `
            <label style="display:flex; align-items:center; gap:8px; background:#fff; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-size:0.82rem; font-weight:700;">
              <input type="checkbox" class="chk-item" value="${item}" checked style="width:16px; height:16px; accent-color:#c5a850;">
              ${item}
            </label>
          `).join('')}
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:800;">${isBus ? 'Catatan Tambahan' : 'Keterangan Tambahan'}</label>
          <textarea id="chk-notes-input" class="form-textarea" rows="3" placeholder="Tuliskan catatan kondisi detail..." style="font-size:0.85rem;"></textarea>
        </div>

        <button type="submit" class="btn btn-gold" style="width:100%; padding:12px; font-size:0.9rem; font-weight:900; border-radius:12px;">
          SUBMIT LAPORAN CHECKLIST
        </button>
      </form>
    </div>
  `;

  openModal(`Form Checklist ${category}`, popupHtml);

  setTimeout(() => {
    const formEl = document.getElementById("grid-checklist-step2-form");
    if (formEl) {
      formEl.onsubmit = (e) => {
        e.preventDefault();
        const username = state.currentUser ? state.currentUser.username : '';
        const checkedItems = Array.from(document.querySelectorAll(".chk-item:checked")).map(c => c.value);
        const notes = document.getElementById("chk-notes-input").value.trim();

        const allItems = isBus 
          ? ["Bersih", "Wangi", "AC", "WC", "Mic"]
          : ["Bersih", "Wangi", "AC", "WC", "TV", "Handuk", "Amenities"];

        let waText = `*${category.toUpperCase()}* (Nomor : ${targetNo || '-'})\n\n`;
        allItems.forEach(item => {
          const isChecked = checkedItems.includes(item);
          waText += `${item} ${isChecked ? '✅' : '❌'}\n`;
        });
        waText += `Catatan : ${notes || '-'}\n\n`;
        waText += `Barokallahu fiikum\n`;
        waText += `_*Pesan dikirim melalui sistem '''jejak imani'''*_`;

        const newInc = {
          id: `inc-${Date.now()}`,
          username,
          groupName,
          category: `Grid Foto: ${category}`,
          detail: waText,
          photos,
          date: getSaudiDateTime().gregorianStr,
          status: "Diproses"
        };

        state.reports.incidents.push(newInc);
        saveState();
        closeModal();
        showToast("Laporan Grid Foto & Checklist disubmit!");
        
        const uName = state.currentUser ? state.currentUser.name : username;
        sendPushNotification(`Checklist ${category}`, `${uName} berhasil kirim laporan ${category} (${groupName})\n${getSaudiDateTime().timeStr}`);
        loadUserTab("insiden");
      };
    }
  }, 50);
}



function renderUserRoomlist() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const groupNameParam = params.get("group") || (state.groups.length > 0 ? state.groups[0].name : "");

  const groupObj = state.groups.find(g => g && g.name === groupNameParam) || (state.groups.length > 0 ? state.groups[0] : null);
  const selectedGroupName = groupObj ? groupObj.name : "";

  const tlName = groupObj ? (Array.isArray(groupObj.leaders) ? groupObj.leaders.join(', ') : (groupObj.tourLeader || 'Belum diisi')) : 'Belum diisi';
  const hotelMadinah = groupObj ? (groupObj.hotelMadinah || 'Hotel Madinah') : 'Hotel Madinah';
  const hotelMakkah = groupObj ? (groupObj.hotelMakkah || 'Hotel Makkah') : 'Hotel Makkah';

  container.innerHTML = `
    <div style="font-family:'Mulish', sans-serif; padding-top:4px; padding-bottom:40px; max-width:600px; margin:0 auto;">
      
      <!-- Group Info Header -->
      <div style="background:#ffffff; border-radius:18px; border:1px solid #e2e8f0; padding:16px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="font-size:0.7rem; font-weight:800; color:#b89230; text-transform:uppercase; margin-bottom:4px;">ROOMLIST JAMAAH (ADMIN SYNC)</div>
        <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin:0 0 6px 0;">${selectedGroupName || 'Pilih Rombongan Grup'}</h3>
        <div style="font-size:0.8rem; color:#64748b; font-weight:700;">👨‍💼 Tour Leader: ${tlName}</div>
      </div>

      <!-- Hotel Selector Tabs -->
      <div style="display:flex; gap:10px; margin-bottom:16px;">
        <button id="user-rl-tab-madinah" class="btn btn-gold" style="flex:1; padding:10px; font-size:0.8rem; font-weight:800; border-radius:12px;">🏨 Madinah: ${hotelMadinah}</button>
        <button id="user-rl-tab-makkah" class="btn btn-secondary" style="flex:1; padding:10px; font-size:0.8rem; font-weight:800; border-radius:12px;">🕋 Makkah: ${hotelMakkah}</button>
      </div>

      <!-- Search bar & Summary -->
      <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:14px; margin-bottom:16px;">
        <input type="text" id="user-rl-search" class="form-input" placeholder="Cari nama jamaah, no kamar, atau tipe..." style="padding:8px 12px; font-size:0.85rem; margin-bottom:10px;">
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; text-align:center; font-size:0.75rem;">
          <div style="background:#fffdf5; border:1px solid #fef3c7; padding:8px; border-radius:10px;">
            <div style="color:#64748b; font-weight:700;">QUAD</div>
            <div id="rl-cnt-quad" style="font-size:1rem; font-weight:900; color:#b89230;">0</div>
          </div>
          <div style="background:#fffdf5; border:1px solid #fef3c7; padding:8px; border-radius:10px;">
            <div style="color:#64748b; font-weight:700;">TRIPLE</div>
            <div id="rl-cnt-triple" style="font-size:1rem; font-weight:900; color:#b89230;">0</div>
          </div>
          <div style="background:#fffdf5; border:1px solid #fef3c7; padding:8px; border-radius:10px;">
            <div style="color:#64748b; font-weight:700;">DOUBLE</div>
            <div id="rl-cnt-double" style="font-size:1rem; font-weight:900; color:#b89230;">0</div>
          </div>
          <div style="background:#fffdf5; border:1px solid #fef3c7; padding:8px; border-radius:10px;">
            <div style="color:#64748b; font-weight:700;">TOTAL</div>
            <div id="rl-cnt-total" style="font-size:1rem; font-weight:900; color:#0f172a;">0</div>
          </div>
        </div>
      </div>

      <!-- Room Cards List -->
      <div id="user-rl-cards-container" style="display:flex; flex-direction:column; gap:12px;"></div>
    </div>
  `;

  let activeHotel = hotelMadinah;
  const btnMadinah = document.getElementById("user-rl-tab-madinah");
  const btnMakkah = document.getElementById("user-rl-tab-makkah");

  if (btnMadinah && btnMakkah) {
    btnMadinah.onclick = () => {
      activeHotel = hotelMadinah;
      btnMadinah.className = "btn btn-gold";
      btnMakkah.className = "btn btn-secondary";
      renderRooms();
    };
    btnMakkah.onclick = () => {
      activeHotel = hotelMakkah;
      btnMakkah.className = "btn btn-gold";
      btnMadinah.className = "btn btn-secondary";
      renderRooms();
    };
  }

  const renderRooms = () => {
    const q = (document.getElementById("user-rl-search")?.value || "").toLowerCase().trim();
    const containerEl = document.getElementById("user-rl-cards-container");
    if (!containerEl) return;

    // Filter strictly REAL ADMIN DATA from state.rooms
    const allRooms = (state.rooms || []).filter(r => 
      r && r.groupName && r.groupName.toLowerCase() === selectedGroupName.toLowerCase() &&
      (!activeHotel || (r.hotelName || '').toLowerCase().includes(activeHotel.toLowerCase()))
    );

    // Calculate room type counters dynamically
    let cntQuad = 0, cntTriple = 0, cntDouble = 0;
    allRooms.forEach(r => {
      const type = (r.typeBed || r.type || '').toLowerCase();
      if (type.includes('quad')) cntQuad++;
      else if (type.includes('triple')) cntTriple++;
      else if (type.includes('double')) cntDouble++;
    });

    if (document.getElementById("rl-cnt-quad")) document.getElementById("rl-cnt-quad").textContent = cntQuad;
    if (document.getElementById("rl-cnt-triple")) document.getElementById("rl-cnt-triple").textContent = cntTriple;
    if (document.getElementById("rl-cnt-double")) document.getElementById("rl-cnt-double").textContent = cntDouble;
    if (document.getElementById("rl-cnt-total")) document.getElementById("rl-cnt-total").textContent = allRooms.length;

    const filtered = allRooms.filter(r => {
      const roomNum = (r.roomNumber || r.roomNo || '').toLowerCase();
      const typeBed = (r.typeBed || r.type || '').toLowerCase();
      const guests = Array.isArray(r.guests) ? r.guests.join(' ').toLowerCase() : (r.occupants ? r.occupants.join(' ').toLowerCase() : '');
      return roomNum.includes(q) || typeBed.includes(q) || guests.includes(q);
    });

    if (filtered.length === 0) {
      containerEl.innerHTML = `<div style="text-align:center; padding:28px 16px; color:#64748b; background:#fff; border-radius:16px; border:1px solid #e2e8f0; font-size:0.85rem;">
        <i data-lucide="hotel" style="width:32px; height:32px; color:#cbd5e1; display:block; margin:0 auto 8px auto;"></i>
        Belum ada data template roomlist yang diunggah Admin untuk hotel dan grup ini.
      </div>`;
      lucide.createIcons();
      return;
    }

    containerEl.innerHTML = filtered.map(r => {
      const occupantsList = Array.isArray(r.guests) ? r.guests : (r.occupants || []);
      return `
        <div style="background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; padding:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:900; font-size:0.95rem; color:#0f172a;">Kamar No. ${r.roomNumber || r.roomNo || '-'}</div>
            <span class="badge badge-gold" style="font-size:0.75rem; padding:3px 8px;">Tipe ${r.typeBed || r.type || 'Standard'}</span>
          </div>
          <div style="font-size:0.8rem; color:#475569; line-height:1.6;">
            ${occupantsList.length > 0 ? occupantsList.map((occ, i) => `<div>${i+1}. <strong>${occ}</strong></div>`).join('') : '<div style="color:#94a3b8; font-style:italic;">Belum ada nama penghuni di-plot</div>'}
          </div>
        </div>
      `;
    }).join('');
  };

  const sInp = document.getElementById("user-rl-search");
  if (sInp) sInp.oninput = renderRooms;
  renderRooms();
  lucide.createIcons();
}

function renderUserDocuments() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const groupNameParam = params.get("group") || (state.groups.length > 0 ? state.groups[0].name : "");

  const groupObj = state.groups.find(g => g && g.name === groupNameParam) || (state.groups.length > 0 ? state.groups[0] : null);
  const selectedGroupName = groupObj ? groupObj.name : "";

  // Filter strictly REAL ADMIN LINK DATA from state.documents
  const realDocs = (state.documents || []).filter(d => 
    d && d.groupName && d.groupName.toLowerCase() === selectedGroupName.toLowerCase()
  );

  let docListHtml = "";
  if (realDocs.length === 0) {
    docListHtml = `
      <div style="text-align:center; padding:32px 16px; color:#64748b; background:#fff; border-radius:16px; border:1px solid #e2e8f0; font-size:0.85rem;">
        <i data-lucide="folder-open" style="width:36px; height:36px; color:#cbd5e1; display:block; margin:0 auto 10px auto;"></i>
        Belum ada link dokumen yang diunggah Admin untuk rombongan grup ini.
      </div>
    `;
  } else {
    docListHtml = realDocs.map(d => {
      const targetUrl = d.linkUrl || d.link || d.fileUrl || "#";
      return `
        <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit; display:block;">
          <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:16px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:transform 0.15s ease, box-shadow 0.15s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:42px; height:42px; border-radius:12px; background:#fffdf5; border:1px solid #fef3c7; display:flex; align-items:center; justify-content:center; color:#b89230; flex-shrink:0;">
                <i data-lucide="file-text" style="width:22px; height:22px;"></i>
              </div>
              <div>
                <strong style="font-size:0.92rem; color:#0f172a; display:block;">${d.name || 'Dokumen Rombongan'}</strong>
                <span style="font-size:0.75rem; color:#64748b;">Klik untuk membuka link dokumen</span>
              </div>
            </div>
            <div style="width:36px; height:36px; border-radius:10px; background:#fffdf5; border:1px solid #fef3c7; display:flex; align-items:center; justify-content:center; color:#b89230;">
              <i data-lucide="external-link" style="width:18px; height:18px;"></i>
            </div>
          </div>
        </a>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div style="font-family:'Mulish', sans-serif; padding-top:4px; padding-bottom:40px; max-width:600px; margin:0 auto;">
      
      <!-- Group Info Header -->
      <div style="background:#ffffff; border-radius:18px; border:1px solid #e2e8f0; padding:16px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="font-size:0.7rem; font-weight:800; color:#b89230; text-transform:uppercase; margin-bottom:4px;">DOKUMEN PENUGASAN & ROMBONGAN</div>
        <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin:0;">${selectedGroupName || 'Pilih Rombongan Grup'}</h3>
      </div>

      <!-- Document Cards List -->
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${docListHtml}
      </div>

    </div>
  `;

  lucide.createIcons();
}

function toggleVendorWidgetHeader() {
  const body = document.getElementById("pv-widget-header-content");
  const icon = document.getElementById("pv-toggle-icon");
  if (!body) return;

  if (body.classList.contains("hidden")) {
    body.classList.remove("hidden");
    if (icon) icon.setAttribute("data-lucide", "chevron-up");
  } else {
    body.classList.add("hidden");
    if (icon) icon.setAttribute("data-lucide", "chevron-down");
  }
  
  if (window.lucide) {
    lucide.createIcons();
  }
}
