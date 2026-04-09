// ==========================================
// 🛡️ Global Error Handler
// ==========================================
window.addEventListener('error', function (event) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.innerHTML = 'พบปัญหา: ' + event.message + '<br><span style="font-size:12px;color:#aaa;">กรุณารีเฟรชหน้าจอใหม่อีกครั้ง</span>';
        loadingText.style.color = '#D9534F';
        const spinner = document.querySelector('#loadingSpinner svg');
        if (spinner) spinner.style.display = 'none';
    }
});

// ==========================================
// 🔧 Config & Firebase
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwojqh2ry1b_xkuVp28w5q8Cs0CX9xBcI-upICxz98NtRrwnJ99GwLneWXFGQJySN1T/exec';

const firebaseConfig = {
    apiKey: 'AIzaSyBSFWKdLCjLWqzo2_mzUE95CyoiUv5TdnY',
    authDomain: 'painaid-88c53.firebaseapp.com',
    projectId: 'painaid-88c53',
    storageBucket: 'painaid-88c53.firebasestorage.app',
    messagingSenderId: '229290700458',
    appId: '1:229290700458:web:74a57d0be5df9326c5ead3',
};

let db, storage;
try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    storage = firebase.storage();
} catch (e) {
    console.error('Firebase init failed:', e);
}

// ==========================================
// 🧠 Global State Variables
// ==========================================
let appData = {
    registrationRequests: [], registeredStores: [], pendingPromotions: [],
    activePromotions: [], mainCategories: [], categories: [],
    closedReports: [], blacklistedPlaces: [], services: [],
    pendingVipRequests: [], affiliateWallets: [], withdrawalRequests: [], deals: [],
};

let myLineUid = '';
let userCurrentPoints = 0;
let userFreeSpins = 0;
let userRewardsInventory = [];
let isCheckedInToday = false;
let pointSettings = { checkIn: 10, view: 1, dir: 5, share: 5, viewLimit: 10, dirLimit: 2, shareLimit: 2 };
let isAppReady = false;

let wheelRewards = [];
let wheelSpinCost = 50;
let isSpinning = false;
let wheelRestaurants = [];
let selectedWheelItem = null;
let currentGalleryImages = [];
let currentGalleryIndex = 0;
let vipMarkers = [];

let map, service, infoWindow;
let currentCoords = { lat: 15.2287, lng: 104.8564 };
let googlePlaces = [];
let currentPagination = null;
let gpsMarker = null;
let activeMarker = null;
let regMiniMap = null;
let regMiniMarker = null;
let html5QrcodeScanner = null;

// ==========================================
// 🎨 Theme Engine
// ==========================================
let currentTheme = {
    bgColor: '#121418', primaryColor: '#C5A059', vipBorderColor: '#FFD700',
    vipEffect: 'none', logoEffect: 'shine', profileEffect: 'none', logoUrl: '',
};

function applyThemeToApp(data) {
    if (!data) return;
    currentTheme = { ...currentTheme, ...data };
    const root = document.documentElement;
    root.style.setProperty('--primary', currentTheme.primaryColor || '#C5A059');
    root.style.setProperty('--prev-primary', currentTheme.primaryColor || '#C5A059');
    root.style.setProperty('--bg-light', currentTheme.bgColor || '#121418');
    root.style.setProperty('--dark', currentTheme.bgColor || '#121418');
    root.style.setProperty('--surface', adjustColor(currentTheme.bgColor || '#121418', 15));
    root.style.setProperty('--prev-vip', currentTheme.vipBorderColor || '#FFD700');

    document.querySelectorAll('.gold-logo').forEach(logo => {
        const parent = logo.parentElement;
        let customImg = parent.querySelector('.custom-logo-img');
        if (currentTheme.logoUrl && currentTheme.logoUrl !== '') {
            logo.style.display = 'none';
            if (!customImg) {
                customImg = document.createElement('img');
                customImg.className = 'custom-logo-img logo-' + (currentTheme.logoEffect || 'none');
                customImg.style.width = logo.style.width || '150px';
                customImg.style.height = 'auto';
                customImg.style.marginBottom = logo.style.marginBottom || '10px';
                customImg.style.borderRadius = '12px';
                parent.insertBefore(customImg, logo);
            }
            customImg.src = currentTheme.logoUrl;
            customImg.className = 'custom-logo-img logo-' + (currentTheme.logoEffect || 'none');
        } else {
            logo.style.display = 'inline-block';
            logo.setAttribute('class', 'gold-logo logo-' + (currentTheme.logoEffect || 'none'));
            if (customImg) customImg.remove();
        }
    });

    const profileBox = document.getElementById('header-profile');
    if (profileBox) {
        profileBox.className = Array.from(profileBox.classList).filter(c => !c.startsWith('prof-')).join(' ');
        if (currentTheme.profileEffect && currentTheme.profileEffect !== 'none') {
            profileBox.classList.add('prof-' + currentTheme.profileEffect);
        }
    }
}

function adjustColor(hex, amt) {
    if (!hex) return '#1A1D23';
    let usePound = false;
    if (hex[0] === '#') { hex = hex.slice(1); usePound = true; }
    const num = parseInt(hex, 16);
    let r = (num >> 16) + amt; r = Math.min(255, Math.max(0, r));
    let b = ((num >> 8) & 0x00FF) + amt; b = Math.min(255, Math.max(0, b));
    let g = (num & 0x0000FF) + amt; g = Math.min(255, Math.max(0, g));
    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// ==========================================
// 🖼️ Image Utilities & Uploads
// ==========================================
const resizeImg = (file) =>
    new Promise((resolve) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const max = 1200;
                if (width > max || height > max) {
                    if (width > height) { height = Math.round(height * max / width); width = max; }
                    else { width = Math.round(width * max / height); height = max; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve('');
        };
        reader.onerror = () => resolve('');
    });

async function uploadImageToStorage(dataUrl, folder) {
    if (!dataUrl) return '';
    if (dataUrl.startsWith('http')) return dataUrl;
    const ref = storage.ref(`${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`);
    await ref.putString(dataUrl, 'data_url');
    return await ref.getDownloadURL();
}

async function sendTelegramNotify(msg) {
    try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ telegramMsg: msg }) }); } catch (e) { }
}

function openImageModal(src) {
    document.getElementById('viewerImg').src = src;
    document.getElementById('imageViewerModal').style.display = 'flex';
}

// ==========================================
// 🚀 Boot Sequence & Cloud Sync
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initSystem();
    setTimeout(() => {
        if (!isAppReady) {
            const spinner = document.getElementById('loadingSpinner');
            const card = document.getElementById('loginCard');
            if (spinner) spinner.style.display = 'none';
            if (card) card.style.display = 'block';
        }
    }, 6000);
});

function loadFromCloud() {
    return new Promise((resolve) => {
        if (!db) return resolve();
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };
        setTimeout(done, 5000);

        db.collection('painaidee').doc('systemData').onSnapshot((doc) => {
            if (doc.exists) appData = { ...appData, ...doc.data() };
            ['registeredStores', 'activePromotions', 'mainCategories', 'categories', 'services',
                'affiliateWallets', 'withdrawalRequests', 'registrationRequests',
                'pendingPromotions', 'pendingVipRequests', 'deals'].forEach(k => {
                    if (!appData[k]) appData[k] = [];
                });
            renderUI();
            updateWalletUI();
            renderPromos();
            if (googlePlaces.length > 0) renderCards(document.getElementById('searchBox').value || 'ร้านอาหาร');
            if (document.getElementById('lockedFeatures')?.style.display === 'block') {
                verifyStore(true);
            }
            done();
        });

        db.collection('painaidee').doc('themeSettings').onSnapshot((doc) => {
            if (doc.exists) applyThemeToApp(doc.data());
        });

        db.collection('painaidee').doc('pointSettings').onSnapshot((doc) => {
            if (doc.exists) {
                pointSettings = { ...pointSettings, ...doc.data() };
                const el = document.getElementById('display-checkin-pts');
                if (el) el.innerText = pointSettings.checkIn || 10;
            }
        });

        db.collection('painaidee').doc('wheelSettings').onSnapshot((doc) => {
            if (doc.exists) {
                wheelRewards = doc.data().rewards || [];
                wheelSpinCost = doc.data().spinCost || 50;
                const costEl = document.getElementById('display-spin-cost');
                if (costEl) costEl.innerText = wheelSpinCost;
                updateSpinButtonUI();
            }
        });
    });
}

async function saveToCloud() {
    if (db) await db.collection('painaidee').doc('systemData').set(appData);
}

// ==========================================
// 🔐 LIFF & Navigation
// ==========================================
async function initSystem() {
    try {
        await liff.init({ liffId: '2009598846-wiCUeV35' });
        await loadFromCloud();

        const urlParams = new URLSearchParams(window.location.search);
        const targetPage = urlParams.get('page');
        const refParam = urlParams.get('ref');
        if (refParam) sessionStorage.setItem('savedRefCode', refParam);

        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const pf = document.getElementById('header-profile');
            if (pf) pf.innerHTML = `<img src="${profile.pictureUrl}" style="width:100%; height:100%; object-fit:cover;">`;

            myLineUid = profile.userId;
            await Promise.race([
                loadUserPoints(myLineUid),
                new Promise(resolve => setTimeout(resolve, 5000))
            ]);

            const myCode = 'AFF' + profile.userId.substring(0, 5).toUpperCase();
            window.myAffCode = myCode;
            const affEl = document.getElementById('myAffiliateCode');
            if (affEl) affEl.innerText = myCode;

            document.getElementById('affiliate-actual-content').style.display = 'block';
            document.getElementById('affiliate-guest-view').style.display = 'none';
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('appContent').style.display = 'block';

            const widget = document.getElementById('points-widget');
            if (widget) widget.style.display = 'flex';

            updateWalletUI();

            const savedRef = sessionStorage.getItem('savedRefCode');
            const refInput = document.getElementById('regRefCode');
            if (savedRef && refInput && savedRef.toUpperCase() !== myCode.toUpperCase()) {
                refInput.value = savedRef;
            }

            setTimeout(() => switchPage(targetPage || 'home'), 300);
        } else {
            const pf = document.getElementById('header-profile');
            if (pf) pf.innerHTML = `<div style="font-size:50px; line-height:100px; text-align:center;">👤</div>`;
            document.getElementById('affiliate-actual-content').style.display = 'none';
            document.getElementById('affiliate-guest-view').style.display = 'block';

            const spinner = document.getElementById('loadingSpinner');
            const card = document.getElementById('loginCard');
            if (spinner) spinner.style.display = 'none';
            if (card) card.style.display = 'block';
        }
        isAppReady = true;
    } catch (err) {
        console.error('LIFF Init Error:', err);
        isAppReady = true;
        const spinner = document.getElementById('loadingSpinner');
        const card = document.getElementById('loginCard');
        if (spinner) spinner.style.display = 'none';
        if (card) card.style.display = 'block';
    }
}

function smartLogin(targetPage) {
    const baseUrl = window.location.href.split('?')[0];
    const pageParam = targetPage ? '?page=' + targetPage : '';
    try {
        if (liff.isLoggedIn()) { if (targetPage) switchPage(targetPage); return; }
        const os = liff.getOS();
        if (os === 'web') {
            liff.login({ redirectUri: baseUrl + pageParam });
        } else if (liff.isInClient()) {
            liff.login();
        } else {
            window.location.href = 'https://liff.line.me/2009598846-wiCUeV35' + pageParam;
        }
    } catch (e) {
        window.location.href = 'https://liff.line.me/2009598846-wiCUeV35' + pageParam;
    }
}

function enterApp() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    const pf = document.getElementById('header-profile');
    if (pf && pf.innerHTML.trim() === '') {
        pf.innerHTML = '<div style="font-size:50px; line-height:100px; text-align:center;">👤</div>';
    }
    setTimeout(() => {
        if (typeof map !== 'undefined' && map) {
            google.maps.event.trigger(map, 'resize');
            map.setCenter(currentCoords);
        }
    }, 150);
}

function switchPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav div').forEach(el => el.classList.remove('active'));
    const page = document.getElementById('page-' + p);
    const tab = document.getElementById('tab-' + p);
    if (page) page.classList.add('active');
    if (tab) tab.classList.add('active');
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', p);
        window.history.replaceState({}, '', url);
    } catch (e) { }
}

function navigateToAffiliate() { switchPage('affiliate'); }

async function navigateToPartner() {
    switchPage('partner');
    try {
        if (!liff.isLoggedIn()) {
            const blocker = document.getElementById('partner-friend-blocker');
            const content = document.getElementById('partner-actual-content');
            if (blocker) { blocker.style.display = 'flex'; blocker.innerHTML = '<div class="spinner"></div><p style="color:#FFF;">กำลังตรวจสอบสถานะการเป็นเพื่อน...</p>'; }
            if (content) content.style.display = 'none';
            renderFriendBlocker();
            return;
        }
        checkFriendshipForPartner(false);
    } catch (e) {
        const blocker = document.getElementById('partner-friend-blocker');
        const content = document.getElementById('partner-actual-content');
        if (blocker) blocker.style.display = 'none';
        if (content) content.style.display = 'block';
    }
}

async function checkFriendshipForPartner(showAlert) {
    const blocker = document.getElementById('partner-friend-blocker');
    const content = document.getElementById('partner-actual-content');
    if (showAlert && blocker) blocker.innerHTML = '<div class="spinner"></div><p style="color:#FFF;">กำลังตรวจสอบ...</p>';
    try {
        if (liff.isLoggedIn()) {
            const friend = await liff.getFriendship();
            if (friend.friendFlag) {
                if (blocker) blocker.style.display = 'none';
                if (content) content.style.display = 'block';
                if (showAlert) alert('✅ ตรวจสอบสำเร็จ');
            } else {
                if (blocker) blocker.style.display = 'flex';
                if (content) content.style.display = 'none';
                renderFriendBlocker();
                if (showAlert) alert('⚠️ ระบบตรวจไม่พบความเป็นเพื่อน');
            }
        }
    } catch (e) {
        if (blocker) blocker.style.display = 'flex';
        if (content) content.style.display = 'none';
        renderFriendBlocker();
    }
}

function renderFriendBlocker() {
    const blocker = document.getElementById('partner-friend-blocker');
    if (!blocker) return;
    blocker.innerHTML = `
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" style="width:80px; margin-bottom:25px;">
        <div class="friend-note"><span style="color:var(--primary); font-weight:600;">⚠️ สำคัญมาก</span><br>สำหรับร้านค้าจำเป็นต้องเพิ่มเพื่อนก่อน เพื่อรับรหัสผ่านในการใช้งานครับ</div>
        <button class="btn-line-glow" style="width:auto; padding:14px 24px; border:none; border-radius:12px; font-family:'Kanit'; font-weight:600; font-size:16px; cursor:pointer; animation:none;" onclick="window.location.href='https://lin.ee/5SBoptj'">➕ เพิ่มเพื่อน LINE OA ของเรา</button>
        <button class="btn-outline" style="margin-top:20px; font-size:13px; border-color:var(--dark-muted); color:var(--text-muted);" onclick="checkFriendshipForPartner(true)">ฉันเพิ่มเพื่อนแล้ว ตรวจสอบอีกครั้ง</button>`;
}

// ==========================================
// 💰 Affiliate & Wallet
// ==========================================
function updateWalletUI() {
    if (!window.myAffCode) return;
    const wallets = appData.affiliateWallets || [];
    const myWallet = wallets.find(w => w.refCode === window.myAffCode);
    const balance = myWallet ? myWallet.balance : 0;
    const settings = appData.affiliateSettings || { minWithdrawal: 300 };
    const minW = settings.minWithdrawal || 300;

    const balEl = document.getElementById('aff-page-balance');
    if (balEl) balEl.innerText = balance.toLocaleString() + ' ฿';
    const minEl = document.getElementById('aff-min-text');
    if (minEl) minEl.innerText = `*(ถอนขั้นต่ำ ${minW} บาท)*`;

    const btn = document.getElementById('btn-page-withdraw');
    if (btn) {
        btn.innerText = `ถอนเงินเข้าบัญชี (ขั้นต่ำ ${minW})`;
        if (balance >= minW) {
            btn.style.background = 'linear-gradient(90deg,#06C755,#05A044)';
            btn.style.color = '#FFF'; btn.style.borderColor = '#06C755'; btn.style.cursor = 'pointer'; btn.disabled = false;
        } else {
            btn.style.background = 'var(--dark-muted)'; btn.style.color = 'var(--text-muted)';
            btn.style.borderColor = 'var(--border)'; btn.style.cursor = 'not-allowed'; btn.disabled = true;
        }
    }

    const historyList = document.getElementById('affiliate-history-list');
    if (historyList) {
        const referredStores = (appData.registeredStores || []).filter(s => s.refCode && s.refCode.toUpperCase() === window.myAffCode.toUpperCase());
        historyList.innerHTML = referredStores.length > 0
            ? referredStores.map((s, i) => `
                <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(197,160,89,0.1);">
                    <div>
                        <p style="margin:0; color:#FFF; font-weight:500;">${i + 1}. ${s.name}</p>
                        <p style="margin:0; font-size:11px; color:${s.hasPaidFirstComm ? '#06C755' : '#999'};">${s.hasPaidFirstComm ? '✅ สร้างรายได้แล้ว' : '⏳ รอร้านค้าอัปเกรด'}</p>
                    </div>
                    ${s.isVIP ? `<span style="background:var(--prev-vip); color:#000; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">VIP</span>` : ''}
                </div>`).join('')
            : `<p style="text-align:center; color:#777; margin:10px 0;">ยังไม่มีประวัติการแนะนำ</p>`;
    }
}

async function requestWithdraw() {
    const wallets = appData.affiliateWallets || [];
    const myWallet = wallets.find(w => w.refCode === window.myAffCode);
    if (!myWallet) return;
    const settings = appData.affiliateSettings || { minWithdrawal: 300 };
    if (myWallet.balance < settings.minWithdrawal) return;

    const bankInfo = prompt(`ยอดเงินที่สามารถถอนได้คือ ${myWallet.balance.toLocaleString()} บาท\n\nกรุณากรอกข้อมูลบัญชีรับเงิน\n(รูปแบบ: ชื่อธนาคาร / เลขบัญชี / ชื่อ-สกุล):`);
    if (!bankInfo || bankInfo.trim() === '') return;

    if (!appData.withdrawalRequests) appData.withdrawalRequests = [];
    const reqAmount = myWallet.balance;
    myWallet.balance = 0;
    let uid = '';
    try { if (liff.isLoggedIn()) uid = (await liff.getProfile()).userId; } catch (e) { }

    appData.withdrawalRequests.push({
        id: Date.now().toString(), refCode: window.myAffCode, userId: uid,
        amount: reqAmount, bankDetails: bankInfo, status: 'pending', requestDate: new Date().toLocaleString(),
    });

    const btn = document.getElementById('btn-page-withdraw');
    try {
        if (btn) { btn.innerText = 'กำลังส่งเรื่อง...'; btn.disabled = true; }
        await saveToCloud();
        sendTelegramNotify(`💸 <b>มีคำร้องขอถอนเงินค่าคอม!</b>\n\nรหัสตัวแทน: ${window.myAffCode}\nยอดถอน: <b>${reqAmount.toLocaleString()} บาท</b>\nบัญชี: ${bankInfo}\n\n👉 กรุณาโอนเงินและกดอนุมัติในหน้าแอดมินครับ`);
        alert('ส่งคำร้องขอถอนเงินเรียบร้อยแล้ว! แอดมินจะตรวจสอบและโอนเงินให้ท่านในเร็วๆ นี้ครับ');
        updateWalletUI();
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
        myWallet.balance = reqAmount;
        updateWalletUI();
    }
}

function copyHeaderAffCode() {
    if (!window.myAffCode) return;
    navigator.clipboard.writeText(window.myAffCode).then(() => alert('คัดลอกรหัส ' + window.myAffCode + ' สำเร็จ!'));
}

function copyAffLink() {
    if (!window.myAffCode) return;
    navigator.clipboard.writeText('https://liff.line.me/2009598846-wiCUeV35?ref=' + window.myAffCode).then(() => alert('คัดลอกลิงก์แนะนำเพื่อนสำเร็จ!'));
}

// ==========================================
// 🪙 Points System
// ==========================================
async function loadUserPoints(uid) {
    if (!uid || !db) return;
    try {
        const doc = await db.collection('userPoints').doc(uid).get();
        const today = new Date().toLocaleDateString('en-CA');
        if (doc.exists) {
            const data = doc.data();
            userCurrentPoints = data.points || 0;
            userFreeSpins = data.freeSpins || 0;
            userRewardsInventory = data.rewards || [];
            if (data.history?.[today]?.checkedIn) {
                isCheckedInToday = true;
                const btn = document.getElementById('btn-daily-checkin');
                if (btn) {
                    btn.innerText = '✅ วันนี้เช็คอินแล้ว'; btn.disabled = true; btn.style.background = '#555'; btn.style.color = '#ccc';
                }
            }
        } else {
            await db.collection('userPoints').doc(uid).set({ points: 0, freeSpins: 0, rewards: [], history: {} });
        }
        const ptEl = document.getElementById('user-points-display');
        if (ptEl) ptEl.innerText = userCurrentPoints;
    } catch (e) { console.log(e); }
}

function showPointToast(text) {
    const toast = document.getElementById('point-toast');
    if (!toast) return;
    document.getElementById('point-toast-text').innerText = text;
    toast.style.bottom = '80px';
    setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
}

async function earnPoints(actionType, targetId = null) {
    if (!myLineUid || !db) return;
    const today = new Date().toLocaleDateString('en-CA');
    const userRef = db.collection('userPoints').doc(myLineUid);
    try {
        const doc = await userRef.get();
        let data = doc.exists ? doc.data() : { points: 0, history: {} };
        if (!data.history) data.history = {};
        if (!data.history[today]) {
            data.history[today] = { viewed: [], dir: [], share: [], checkedIn: false };
        } else {
            if (!Array.isArray(data.history[today].viewed)) data.history[today].viewed = [];
            if (!Array.isArray(data.history[today].dir)) data.history[today].dir = [];
            if (!Array.isArray(data.history[today].share)) data.history[today].share = [];
        }

        let pointsToAdd = 0; let actionName = '';
        if (actionType === 'checkin') {
            if (data.history[today].checkedIn) return alert('วันนี้คุณเช็คอินรับแต้มไปแล้วครับ พรุ่งนี้มาใหม่นะ!');
            pointsToAdd = parseInt(pointSettings.checkIn) || 10;
            data.history[today].checkedIn = true; actionName = 'เช็คอินรายวัน';
            alert(`🎉 เช็คอินสำเร็จ! รับฟรี ${pointsToAdd} แต้ม`);
            const btn = document.getElementById('btn-daily-checkin');
            if (btn) { btn.innerText = '✅ วันนี้เช็คอินแล้ว'; btn.disabled = true; btn.style.background = '#555'; btn.style.color = '#ccc'; }
        } else if (actionType === 'view' && targetId) {
            if (data.history[today].viewed.includes(targetId)) return;
            if (data.history[today].viewed.length >= (parseInt(pointSettings.viewLimit) || 10)) return;
            pointsToAdd = parseInt(pointSettings.view) || 1;
            data.history[today].viewed.push(targetId); actionName = 'ส่องร้านค้า';
        } else if (actionType === 'dir' && targetId) {
            if (data.history[today].dir.includes(targetId)) return;
            if (data.history[today].dir.length >= (parseInt(pointSettings.dirLimit) || 2)) return;
            pointsToAdd = parseInt(pointSettings.dir) || 5;
            data.history[today].dir.push(targetId); actionName = 'กดนำทาง';
        } else if (actionType === 'share' && targetId) {
            if (data.history[today].share.includes(targetId)) return;
            if (data.history[today].share.length >= (parseInt(pointSettings.shareLimit) || 2)) return;
            pointsToAdd = parseInt(pointSettings.share) || 5;
            data.history[today].share.push(targetId); actionName = 'บอกต่อเพื่อน';
        } else if (actionType === 'wheel_bonus' && targetId) {
            pointsToAdd = parseInt(targetId); actionName = 'หมุนกงล้อ';
        }

        if (pointsToAdd > 0) {
            data.points += pointsToAdd;
            userCurrentPoints = data.points;
            await userRef.set(data);
            const ptEl = document.getElementById('user-points-display');
            if (ptEl) ptEl.innerText = userCurrentPoints;
            if (actionType !== 'checkin') showPointToast(`+${pointsToAdd} แต้ม จากการ${actionName}!`);
        }
    } catch (e) { console.log(e); }
}

// ==========================================
// 📸 VIP Store Gallery
// ==========================================
function viewStoreGallery(placeId, storeName, isVIP, event) {
    event.stopPropagation();
    if (!isVIP) return;

    const btn = event.currentTarget.querySelector('div');
    const oldText = btn.innerText;
    btn.innerText = '⏳ กำลังโหลด...';

    service.getDetails({ placeId: placeId, fields: ['name', 'photos'] }, (place, status) => {
        btn.innerText = oldText;
        if (status === google.maps.places.PlacesServiceStatus.OK && place.photos) {
            currentGalleryImages = place.photos.slice(0, 10).map(p => p.getUrl({ maxWidth: 800 }));
            currentGalleryIndex = 0;
            if (currentGalleryImages.length > 0) {
                openGalleryModal(storeName);
            } else {
                alert('ร้านนี้ไม่มีรูปภาพเพิ่มเติมครับ');
            }
        } else {
            alert('ไม่สามารถดึงรูปภาพเพิ่มเติมได้ในขณะนี้');
        }
    });
}

function openGalleryModal(storeName) {
    if (!document.getElementById('galleryModal')) {
        const modalHtml = `
            <div id="galleryModal" class="feature-modal" style="display:none; position:fixed; z-index:999999; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); justify-content:center; align-items:center; flex-direction:column;">
                <div style="position:absolute; top:20px; right:20px; color:#FFF; font-size:30px; cursor:pointer; z-index:10; width:40px; height:40px; text-align:center; line-height:35px; background:rgba(255,255,255,0.2); border-radius:50%;" onclick="closeGallery()">×</div>
                <h3 id="galleryTitle" style="color:var(--prev-vip); margin-top:20px; text-align:center; font-size:18px;"></h3>
                <div style="position:relative; width:100%; max-width:500px; display:flex; justify-content:center; align-items:center; flex:1; padding:0 10px;">
                    <button onclick="changeGalleryImage(-1); event.stopPropagation();" style="position:absolute; left:10px; background:rgba(0,0,0,0.6); color:#FFF; border:1px solid #C5A059; font-size:20px; width:40px; height:40px; border-radius:50%; cursor:pointer; z-index:5; display:flex; justify-content:center; align-items:center;">❮</button>
                    <img id="galleryMainImg" src="" style="max-width:100%; max-height:65vh; border-radius:12px; object-fit:contain; transition:0.2s;">
                    <button onclick="changeGalleryImage(1); event.stopPropagation();" style="position:absolute; right:10px; background:rgba(0,0,0,0.6); color:#FFF; border:1px solid #C5A059; font-size:20px; width:40px; height:40px; border-radius:50%; cursor:pointer; z-index:5; display:flex; justify-content:center; align-items:center;">❯</button>
                </div>
                <div id="galleryCounter" style="color:#FFF; margin-bottom:30px; font-size:14px; background:rgba(0,0,0,0.5); padding:5px 15px; border-radius:15px; border:1px solid #C5A059; font-weight:bold;"></div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    document.getElementById('galleryTitle').innerText = '📸 ' + storeName;
    updateGalleryUI();
    document.getElementById('galleryModal').style.display = 'flex';
}

function closeGallery() {
    document.getElementById('galleryModal').style.display = 'none';
}

function changeGalleryImage(step) {
    currentGalleryIndex += step;
    if (currentGalleryIndex < 0) currentGalleryIndex = currentGalleryImages.length - 1;
    if (currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex = 0;
    updateGalleryUI();
}

function updateGalleryUI() {
    document.getElementById('galleryMainImg').src = currentGalleryImages[currentGalleryIndex];
    document.getElementById('galleryCounter').innerText = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
}


// ==========================================
// 🎡 Restaurant Wheel (กงล้อสุ่ม)
// ==========================================
function openLuckyWheel() {
    if (!myLineUid) return alert('กรุณาล็อคอินด้วย LINE ก่อนครับ!');
    if (googlePlaces.length === 0) return alert('กรุณาค้นหาร้านอาหารในพื้นที่ก่อนครับ!\n(เลือกจังหวัดหรือค้นหาบนหน้าแรก)');
    buildRestaurantWheel();
    document.getElementById('luckyWheelModal').style.display = 'flex';
}

function buildRestaurantWheel() {
    const stores = appData.registeredStores || [];
    const now = Date.now();

    let vipItems = [];
    let normalItems = [];

    googlePlaces.forEach(p => {
        const store = stores.find(s => s.name === p.name);
        const isVIP = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        if (isVIP) vipItems.push({ place: p, isVIP: true });
        else normalItems.push({ place: p, isVIP: false });
    });

    const shuffleArr = arr => arr.sort(() => Math.random() - 0.5);
    shuffleArr(vipItems);
    shuffleArr(normalItems);

    const selectedVips = vipItems.slice(0, 2);
    const selectedNormals = normalItems.slice(0, 8 - selectedVips.length);

    wheelRestaurants = [...selectedVips, ...selectedNormals];
    shuffleArr(wheelRestaurants);

    renderRestaurantWheel();
    const countEl = document.getElementById('wheel-store-count');
    if (countEl) countEl.innerText = wheelRestaurants.length + ' ร้าน';
    const spinBtn = document.getElementById('btn-spin-wheel');
    if (spinBtn) { spinBtn.innerText = '🎯 หมุนเลย!'; spinBtn.disabled = false; }
}

function renderRestaurantWheel() {
    const wheel = document.getElementById('wheel-spinner');
    if (!wheel || wheelRestaurants.length === 0) return;

    const segDeg = 360 / wheelRestaurants.length;
    const colors = ['#1A1D23', '#8B0000', '#2A2D34', '#C5A059'];

    const parts = wheelRestaurants.map((item, i) => {
        const c = colors[i % colors.length];
        return `${c} ${i * segDeg}deg ${(i + 1) * segDeg}deg`;
    }).join(', ');
    wheel.style.background = `conic-gradient(${parts})`;
    wheel.innerHTML = '';

    wheelRestaurants.forEach((item, idx) => {
        const angle = idx * segDeg + segDeg / 2;
        const label = document.createElement('div');
        Object.assign(label.style, {
            position: 'absolute', top: '50%', left: '50%', width: '95px',
            transformOrigin: '0 0', transform: `rotate(${angle - 90}deg) translate(20px,-50%)`,
            color: '#FFF', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Kanit',
            textShadow: '1px 1px 3px rgba(0,0,0,0.9)', textAlign: 'left', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
        });
        label.innerHTML = (item.isVIP ? '<span style="color:#FFD700">⭐</span> ' : '') + item.place.name;
        wheel.appendChild(label);
    });
}

function updateSpinButtonUI() {
    const btn = document.getElementById('btn-spin-wheel');
    if (!btn) return;
    if (userFreeSpins > 0) {
        btn.innerText = `🎯 กดหมุนเลย (ฟรี ${userFreeSpins} ครั้ง!)`;
        btn.style.background = 'linear-gradient(135deg,#06C755,#05A044)';
        btn.style.color = '#FFF';
    } else {
        btn.innerText = `🎯 กดหมุนเลย (${wheelSpinCost} แต้ม)`;
        btn.style.background = 'linear-gradient(135deg,var(--primary),var(--primary-hover))';
        btn.style.color = '#000';
    }
}

async function spinRestaurantWheel() {
    if (isSpinning) return;
    if (wheelRestaurants.length === 0) return alert('ไม่มีร้านในกงล้อครับ');

    const isUsingFreeSpin = userFreeSpins > 0;
    if (!isUsingFreeSpin && userCurrentPoints < wheelSpinCost) {
        return alert(`แต้มของคุณไม่พอครับ 😢\n(มีอยู่ ${userCurrentPoints} แต้ม / ต้องใช้ ${wheelSpinCost} แต้ม)`);
    }

    isSpinning = true;
    const btn = document.getElementById('btn-spin-wheel');
    const wheel = document.getElementById('wheel-spinner');
    btn.innerText = 'กำลังสุ่ม... 🎡'; btn.disabled = true;

    try {
        const userRef = db.collection('userPoints').doc(myLineUid);
        if (isUsingFreeSpin) {
            userFreeSpins -= 1;
            await userRef.update({ freeSpins: userFreeSpins });
        } else {
            userCurrentPoints -= wheelSpinCost;
            await userRef.update({ points: userCurrentPoints });
            const ptEl = document.getElementById('user-points-display');
            if (ptEl) ptEl.innerText = userCurrentPoints;
        }
        updateSpinButtonUI();
    } catch (e) {
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่ครับ');
        isSpinning = false; btn.disabled = false; updateSpinButtonUI(); return;
    }

    const weights = wheelRestaurants.map(item => item.isVIP ? 2 : 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let selectedIdx = wheelRestaurants.length - 1;
    for (let i = 0; i < weights.length; i++) {
        rand -= weights[i];
        if (rand <= 0) { selectedIdx = i; break; }
    }

    const segDeg = 360 / wheelRestaurants.length;
    const targetDeg = 3600 + (360 - selectedIdx * segDeg) - segDeg / 2;
    wheel.style.transition = 'transform 4s cubic-bezier(0.25,0.1,0.15,1)';
    wheel.style.transform = `rotate(${targetDeg}deg)`;

    setTimeout(() => {
        isSpinning = false;
        updateSpinButtonUI();
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(${targetDeg % 360}deg)`;
        selectedWheelItem = wheelRestaurants[selectedIdx];
        document.getElementById('luckyWheelModal').style.display = 'none';
        showSpinResult(selectedWheelItem);
    }, 4000);
}

function showSpinResult(item) {
    const p = item.place;
    const stores = appData.registeredStores || [];
    const store = stores.find(s => s.name === p.name);
    const isVIP = item.isVIP;
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.geometry.location.lat()},${p.geometry.location.lng()}`;
    const imgUrl = p.photos ? p.photos[0].getUrl({ maxWidth: 500 }) : 'https://via.placeholder.com/500x250?text=Painaidee';

    let statusHtml = '';
    const cs = store?.operatingHours ? getCustomStoreStatus(store.operatingHours) : null;
    if (cs) statusHtml = cs.html;
    else if (p.opening_hours) {
        const isOpen = typeof p.opening_hours.isOpen === 'function' ? p.opening_hours.isOpen() : p.opening_hours.open_now;
        if (isOpen === true) statusHtml = '<span style="background:#06C755;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;">เปิดอยู่</span>';
        if (isOpen === false) statusHtml = '<span style="background:#D9534F;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;">ปิดแล้ว</span>';
    }

    const activeDeals = (appData.deals || []).filter(d =>
        d.storeName === p.name && d.isActive && (!d.expiryDate || new Date(d.expiryDate) > new Date()) && (d.maxUses === 0 || d.usedCount < d.maxUses)
    );

    let dealHtml = '';
    if (activeDeals.length > 0) {
        dealHtml = `<div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.15);">
            <p style="font-size:12px;color:#FFD700;margin:0 0 8px;font-weight:600;">🎟️ ดีลพิเศษจากร้านนี้!</p>
            ${activeDeals.map(d => `
                <div style="background:rgba(217,83,79,0.1);border:1px solid rgba(217,83,79,0.4);border-radius:10px;padding:10px;margin-bottom:8px;text-align:left;">
                    <p style="margin:0 0 4px;color:#FFF;font-weight:600;font-size:13px;">${d.title}</p>
                    <p style="margin:0 0 8px;font-size:11px;color:#aaa;">${d.description}</p>
                    <button onclick="claimDeal('${d.id}'); document.getElementById('spinResultModal').style.display='none';"
                            style="background:#D9534F;color:#FFF;border:none;padding:7px 14px;border-radius:8px;font-family:'Kanit';font-size:12px;cursor:pointer;width:100%;">
                        🎟️ กดรับ QR Code สิทธิ์นี้
                    </button>
                </div>`).join('')}
        </div>`;
    }

    let imageBlock = '';
    const safeName = p.name ? p.name.replace(/'/g, "\\'").replace(/"/g, '"') : 'ร้านค้า';
    if (isVIP && p.photos) {
        imageBlock = `
        <div style="position:relative; cursor:pointer;" onclick="viewStoreGallery('${p.place_id}', '${safeName}', true, event)">
            <img src="${imgUrl}" style="width:100%;height:170px;object-fit:cover;border-radius:12px;margin-bottom:12px;">
            <div style="position:absolute; bottom:20px; right:10px; background:rgba(0,0,0,0.75); color:#FFD700; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:bold; border:1px solid #C5A059; pointer-events:none; box-shadow:0 2px 5px rgba(0,0,0,0.5);">
                📸 ดูรูปเพิ่มเติม 10 รูป
            </div>
        </div>`;
    } else {
        imageBlock = `<img src="${imgUrl}" style="width:100%;height:170px;object-fit:cover;border-radius:12px;margin-bottom:12px;" onclick="event.stopPropagation(); openImageModal(this.src)">`;
    }

    const hasLine = !!(store?.lineUrl?.trim());
    const hasFb = !!(store?.fbUrl?.trim());
    let contactHtml = '';
    if (hasLine) contactHtml += `<button onclick="window.open('${store.lineUrl.startsWith('http') ? store.lineUrl : 'https://' + store.lineUrl}','_blank')" style="flex:1;background:#06C755;color:#FFF;border:none;padding:10px;border-radius:8px;font-family:'Kanit';font-size:13px;font-weight:600;cursor:pointer;">💬 LINE</button>`;
    if (hasFb) contactHtml += `<button onclick="window.open('${store.fbUrl.startsWith('http') ? store.fbUrl : 'https://' + store.fbUrl}','_blank')" style="flex:1;background:#1877F2;color:#FFF;border:none;padding:10px;border-radius:8px;font-family:'Kanit';font-size:13px;font-weight:600;cursor:pointer;">👍 FB</button>`;

    document.getElementById('spinResultContent').innerHTML = `
        ${isVIP ? '<div style="text-align:center;color:#FFD700;font-weight:700;font-size:13px;margin-bottom:10px;letter-spacing:1px;">⭐ VIP RECOMMEND ⭐</div>' : ''}
        ${imageBlock}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h3 style="margin:0;font-size:17px;color:${isVIP ? '#FFD700' : 'var(--primary)'};flex:1;">${p.name}</h3>
            <div>${statusHtml}</div>
        </div>
        <p style="font-size:12px;color:#aaa;margin:0 0 4px;">${p.vicinity}</p>
        <p style="color:var(--primary);font-size:13px;margin:0 0 12px;">⭐ ${p.rating || 'ใหม่'} ${p.user_ratings_total ? '(' + p.user_ratings_total + ' รีวิว)' : ''}</p>
        ${dealHtml}
        <div style="display:flex;gap:8px;margin-top:14px;">
            <button onclick="window.open('${navUrl}','_blank'); trackAction('${p.name}','dir');"
                    style="flex:2;background:linear-gradient(135deg,var(--primary),#a8813c);color:#000;border:none;padding:12px;border-radius:10px;font-family:'Kanit';font-weight:700;font-size:14px;cursor:pointer;">
                📍 นำทางไปเลย!
            </button>
            <button onclick="focusPlace('${p.place_id}'); document.getElementById('spinResultModal').style.display='none'; document.getElementById('appContent').scrollTo({top:0,behavior:'smooth'});"
                    style="flex:1;background:rgba(255,255,255,0.08);color:#FFF;border:1px solid #555;padding:12px;border-radius:10px;font-family:'Kanit';font-size:13px;cursor:pointer;">
                🗺️ แผนที่
            </button>
        </div>
        ${contactHtml ? `<div style="display:flex;gap:8px;margin-top:8px;">${contactHtml}</div>` : ''}
    `;
    document.getElementById('spinResultModal').style.display = 'flex';
}

// ==========================================
// 🎟️ Deal & QR Code System
// ==========================================
function openDealCreator() {
    const pin = document.getElementById('storePinInput').value;
    if (!pin) return alert('กรุณาใส่ PIN ร้านค้าก่อนครับ');
    document.getElementById('dealCreatorModal').style.display = 'flex';
}

async function saveDeal() {
    const pin = document.getElementById('storePinInput').value;
    const storeIndex = (appData.registeredStores || []).findIndex(s => s.pin === pin);
    if (storeIndex === -1) return alert('กรุณาเข้าสู่ระบบด้วย PIN ก่อนครับ');

    const store = appData.registeredStores[storeIndex];
    const title = document.getElementById('dealTitle').value.trim();
    const desc = document.getElementById('dealDesc').value.trim();
    const maxUses = parseInt(document.getElementById('dealMaxUses').value) || 0;
    const expiry = document.getElementById('dealExpiry').value;

    if (!title) return alert('กรุณาใส่ชื่อดีลครับ');

    if (!appData.deals) appData.deals = [];
    appData.deals.push({
        id: 'DEAL' + Date.now(), storeName: store.name, title, description: desc,
        maxUses, usedCount: 0, expiryDate: expiry, isActive: true,
        createdAt: new Date().toLocaleString('th-TH'), claimedBy: [],
    });

    const btn = document.getElementById('btnSaveDeal');
    btn.innerText = 'กำลังบันทึก...'; btn.disabled = true;
    try {
        await saveToCloud();
        document.getElementById('dealCreatorModal').style.display = 'none';
        alert('✅ สร้างดีลเรียบร้อยแล้ว! ลูกค้าจะเห็นบนการ์ดร้านทันที');
        renderStoreDeals();
    } catch (e) {
        alert('❌ เกิดข้อผิดพลาด: ' + e.message);
        appData.deals.pop();
    } finally {
        btn.innerText = '✅ บันทึกดีล'; btn.disabled = false;
    }
}

async function toggleDealActive(dealId) {
    const deal = (appData.deals || []).find(d => d.id === dealId);
    if (!deal) return;
    deal.isActive = !deal.isActive;
    try { await saveToCloud(); renderStoreDeals(); } catch (e) { deal.isActive = !deal.isActive; }
}

async function deleteDeal(dealId) {
    if (!confirm('ยืนยันลบดีลนี้?')) return;
    const idx = (appData.deals || []).findIndex(d => d.id === dealId);
    if (idx === -1) return;
    appData.deals.splice(idx, 1);
    try { await saveToCloud(); renderStoreDeals(); } catch (e) { }
}

function renderStoreDeals() {
    const pin = document.getElementById('storePinInput').value;
    const store = (appData.registeredStores || []).find(s => s.pin === pin);
    const listEl = document.getElementById('storeDealsList');
    if (!listEl || !store) return;

    const myDeals = (appData.deals || []).filter(d => d.storeName === store.name);
    if (myDeals.length === 0) {
        listEl.innerHTML = '<p style="color:#777;text-align:center;margin:10px 0;">ยังไม่มีดีล กดปุ่มด้านบนเพื่อสร้างดีลแรก!</p>';
        return;
    }
    listEl.innerHTML = myDeals.map(d => `
        <div style="background:rgba(0,0,0,0.3);border:1px solid ${d.isActive ? 'rgba(6,199,85,0.3)' : 'rgba(255,255,255,0.1)'};border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;">
                    <p style="margin:0 0 3px;color:#FFF;font-weight:600;font-size:14px;">${d.title}</p>
                    <p style="margin:0 0 6px;font-size:12px;color:#aaa;">${d.description}</p>
                    <p style="margin:0;font-size:11px;color:#777;">ใช้ไปแล้ว: ${d.usedCount || 0}${d.maxUses > 0 ? '/' + d.maxUses : ''} ครั้ง ${d.expiryDate ? '| หมดเขต: ' + d.expiryDate : ''}</p>
                </div>
                <span style="background:${d.isActive ? '#06C755' : '#555'};color:#FFF;padding:3px 8px;border-radius:8px;font-size:11px;white-space:nowrap;">${d.isActive ? 'เปิดใช้' : 'ปิดแล้ว'}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:10px;">
                <button onclick="toggleDealActive('${d.id}')" style="flex:1;padding:7px;border-radius:7px;border:1px solid #555;background:transparent;color:#aaa;font-family:'Kanit';font-size:12px;cursor:pointer;">${d.isActive ? '⏸ ปิดดีล' : '▶ เปิดดีล'}</button>
                <button onclick="deleteDeal('${d.id}')" style="flex:1;padding:7px;border-radius:7px;border:1px solid rgba(217,83,79,0.4);background:rgba(217,83,79,0.1);color:#D9534F;font-family:'Kanit';font-size:12px;cursor:pointer;">🗑️ ลบ</button>
            </div>
        </div>`).join('');
}

function showStoreDealsModal(storeName) {
    const activeDeals = (appData.deals || []).filter(d =>
        d.storeName === storeName && d.isActive &&
        (!d.expiryDate || new Date(d.expiryDate) > new Date()) &&
        (d.maxUses === 0 || d.usedCount < d.maxUses)
    );

    const title = document.getElementById('cdTitle');
    const claimBtn = document.getElementById('btnClaim');

    title.innerText = '🎟️ ดีลส่วนลดพิเศษจากร้าน';
    title.style.color = '#D9534F';
    if (claimBtn) claimBtn.style.display = 'none';

    let html = activeDeals.map(d => `
        <div style="background:rgba(217,83,79,0.1);border:1px solid rgba(217,83,79,0.4);border-radius:10px;padding:15px;margin-bottom:10px;text-align:left;">
            <p style="margin:0 0 5px;color:#FFF;font-weight:600;font-size:15px;">${d.title}</p>
            <p style="margin:0 0 10px;font-size:12px;color:#ccc;">${d.description}</p>
            <div style="font-size:11px; color:#888; margin-bottom:10px;">
                เหลือสิทธิ์: ${d.maxUses === 0 ? 'ไม่จำกัด' : (d.maxUses - d.usedCount) + ' สิทธิ์'}
            </div>
            <button onclick="claimDeal('${d.id}'); document.getElementById('customerDetailModal').style.display='none';"
                    style="background:#D9534F;color:#FFF;border:none;padding:10px 14px;border-radius:8px;font-family:'Kanit';font-size:13px;cursor:pointer;width:100%;font-weight:bold;box-shadow:0 4px 10px rgba(217,83,79,0.3);">
                🎫 กดรับ QR Code สิทธิ์นี้
            </button>
        </div>`).join('');

    document.getElementById('cdStoreName').innerText = storeName;
    document.getElementById('cdText').innerHTML = html;
    document.getElementById('customerDetailModal').style.display = 'flex';
}

function claimDeal(dealId) {
    if (!myLineUid) return alert('กรุณาล็อคอินด้วย LINE ก่อนครับ!');
    const deal = (appData.deals || []).find(d => d.id === dealId);
    if (!deal) return alert('ไม่พบดีลนี้ครับ');
    if (!deal.isActive) return alert('ดีลนี้ปิดใช้งานแล้วครับ');
    if (deal.expiryDate && new Date(deal.expiryDate) < new Date()) return alert('ดีลนี้หมดเขตไปแล้วครับ');
    if (deal.maxUses > 0 && deal.usedCount >= deal.maxUses) return alert('ขออภัย สิทธิ์ดีลนี้เต็มแล้วครับ');
    if ((deal.claimedBy || []).includes(myLineUid)) return alert('คุณเคยกดรับสิทธิ์ดีลนี้ไปแล้วครับ!');

    const shortClaimId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const qrPayload = `V1-${deal.id}-${myLineUid}-C${Date.now()}${shortClaimId}`;

    document.getElementById('qrDealTitle').innerText = deal.title;
    document.getElementById('qrDealDesc').innerText = deal.description;
    document.getElementById('qrDealStore').innerText = '🏪 ' + deal.storeName;
    document.getElementById('qrDealExpiry').innerText = deal.expiryDate ? 'หมดเขต: ' + deal.expiryDate : 'ไม่มีวันหมดอายุ';

    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: qrPayload, width: 220, height: 220, colorDark: '#000000', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M,
    });
    document.getElementById('dealQRModal').style.display = 'flex';
}

function openQRScanner() {
    document.getElementById('qrScannerModal').style.display = 'flex';
    document.getElementById('qrScanInput').value = '';
    document.getElementById('qrScanResult').innerHTML = '';
    document.getElementById('qrScanResult').style.display = 'none';
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeQRScanner() {
    document.getElementById('qrScannerModal').style.display = 'none';
    if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(error => console.error("Failed to clear scanner.", error));
}

function onScanSuccess(decodedText, decodedResult) {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    document.getElementById('qrScanInput').value = decodedText;
    verifyAndUseDeal(decodedText);
}

function onScanFailure(error) { }

async function verifyAndUseDeal(scannedText = null) {
    const rawText = scannedText || document.getElementById('qrScanInput').value.trim();
    const resultEl = document.getElementById('qrScanResult');
    if (!rawText) return alert('กรุณาสแกนหรือกรอกข้อความ QR Code ของลูกค้าครับ');

    resultEl.style.display = 'block';
    resultEl.innerHTML = '<p style="color:#aaa;text-align:center;">กำลังตรวจสอบ...</p>';

    try {
        const parts = rawText.split('-');
        if (parts.length < 4 || parts[0] !== 'V1') throw new Error('Invalid Format');

        const scanDealId = parts[1];
        const scanUserId = parts[2];
        const deal = (appData.deals || []).find(d => d.id === scanDealId);

        if (!deal) return resultEl.innerHTML = `<div style="text-align:center;padding:15px;background:rgba(217,83,79,0.1);border:1px solid #D9534F;border-radius:10px;"><p style="color:#D9534F;font-size:18px;font-weight:700;margin:0;">❌ ไม่พบดีลในระบบ</p></div>`;
        if (!deal.isActive) return resultEl.innerHTML = `<div style="text-align:center;padding:15px;background:rgba(217,83,79,0.1);border:1px solid #D9534F;border-radius:10px;"><p style="color:#D9534F;font-weight:700;margin:0;">❌ ดีลนี้ปิดใช้งานแล้ว</p></div>`;
        if ((deal.claimedBy || []).includes(scanUserId)) return resultEl.innerHTML = `<div style="text-align:center;padding:15px;background:rgba(217,83,79,0.1);border:1px solid #D9534F;border-radius:10px;"><p style="color:#D9534F;font-weight:700;margin:0;">❌ QR นี้ถูกใช้งานไปแล้ว!</p></div>`;
        if (deal.maxUses > 0 && deal.usedCount >= deal.maxUses) return resultEl.innerHTML = `<div style="text-align:center;padding:15px;background:rgba(217,83,79,0.1);border:1px solid #D9534F;border-radius:10px;"><p style="color:#D9534F;font-weight:700;margin:0;">❌ สิทธิ์เต็มแล้ว (ครบจำนวน)</p></div>`;

        if (!deal.claimedBy) deal.claimedBy = [];
        deal.claimedBy.push(scanUserId);
        deal.usedCount = (deal.usedCount || 0) + 1;
        await saveToCloud();

        const usedTime = new Date().toLocaleString('th-TH');
        resultEl.innerHTML = `
            <div style="text-align:center;padding:20px;background:rgba(6,199,85,0.1);border:2px solid #06C755;border-radius:12px;">
                <p style="color:#06C755;font-size:22px;font-weight:700;margin:0 0 8px;">✅ ยืนยันสิทธิ์สำเร็จ!</p>
                <p style="color:#FFF;font-size:15px;font-weight:600;margin:0 0 5px;">${deal.title}</p>
                <p style="color:#aaa;font-size:12px;margin:0 0 12px;">ร้าน: ${deal.storeName}</p>
                <p style="color:#777;font-size:11px;margin:0;">เวลาใช้งาน: ${usedTime}<br>ใช้ไปแล้ว: ${deal.usedCount}${deal.maxUses > 0 ? '/' + deal.maxUses : ''} ครั้ง</p>
            </div>`;
    } catch (e) {
        resultEl.innerHTML = `<div style="text-align:center;padding:15px;background:rgba(217,83,79,0.1);border:1px solid #D9534F;border-radius:10px;"><p style="color:#D9534F;font-weight:700;margin:0;">❌ QR Code ไม่ถูกต้อง</p></div>`;
    }
}

// ==========================================
// 🎟️ Rewards Inventory
// ==========================================
function openMyRewards() {
    const list = document.getElementById('my-rewards-list');
    const available = userRewardsInventory.filter(r => !r.used);
    list.innerHTML = available.length === 0
        ? '<p style="text-align:center; color:#888; padding:20px;">ไม่มีของรางวัลที่สามารถใช้งานได้ในขณะนี้ 😢</p>'
        : available.map(r => `
            <div style="background:rgba(0,0,0,0.4); border:1px solid var(--info); padding:15px; border-radius:12px; margin-bottom:12px; text-align:left; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                <h4 style="margin:0 0 5px; color:#FFF; font-size:16px;">🎁 ${r.name}</h4>
                <p style="margin:0 0 12px; font-size:12px; color:#888;">ได้รับเมื่อ: ${r.date}</p>
                <button class="btn-primary" style="background:linear-gradient(135deg,#17a2b8,#00d2ff); color:#FFF; width:100%; border:none; padding:10px; font-size:14px; border-radius:8px;" onclick="claimReward('${r.id}')">กดใช้สิทธิ์ (แสดงหน้าจอให้ร้านดู)</button>
            </div>`).join('');
    document.getElementById('myRewardsModal').style.display = 'flex';
}

async function claimReward(rewardId) {
    if (!confirm('⚠️ คำเตือน!\n\nกรุณากดใช้สิทธิ์นี้ \'ต่อหน้าพนักงานที่ร้าน\' เท่านั้น!\nหากกดยืนยันแล้ว คูปองจะหายไปทันที\n\nคุณต้องการยืนยันการใช้สิทธิ์ใช่หรือไม่?')) return;
    const idx = userRewardsInventory.findIndex(r => r.id === rewardId);
    if (idx > -1) {
        userRewardsInventory[idx].used = true;
        userRewardsInventory[idx].usedDate = new Date().toLocaleString('th-TH');
        try {
            await db.collection('userPoints').doc(myLineUid).update({ rewards: userRewardsInventory });
            alert(`✅ ใช้สิทธิ์เรียบร้อยแล้ว!\n\n🎁 ${userRewardsInventory[idx].name}\nเวลา: ${userRewardsInventory[idx].usedDate}\n\nพนักงานสามารถตรวจสอบหน้าจอนี้ได้เลยครับ`);
            openMyRewards();
        } catch (e) { alert('เกิดข้อผิดพลาดในการใช้งานคูปอง กรุณาลองใหม่'); }
    }
}
// ==========================================
// 🔗 Interaction Tracking
// ==========================================
function callPlace(placeId, event) {
    event.stopPropagation();
    service.getDetails({ placeId, fields: ['formatted_phone_number'] }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place.formatted_phone_number) {
            window.location.href = 'tel:' + place.formatted_phone_number.replace(/[^0-9+]/g, '');
        } else {
            alert('ขออภัยครับ ไม่พบเบอร์โทรศัพท์ของสถานที่นี้ในระบบแผนที่');
        }
    });
}

function sharePlace(name, lat, lng, event) {
    event.stopPropagation();
    earnPoints('share', name);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (navigator.share) {
        navigator.share({ title: 'แอปไปไหนดี', text: `ลองดูร้าน "${name}" สิ! น่าสนใจมากเลย 📍 ดูพิกัดได้ที่นี่: `, url: mapUrl }).catch(err => console.log('Share failed:', err));
    } else {
        navigator.clipboard.writeText(mapUrl).then(() => alert('คัดลอกลิงก์พิกัดเรียบร้อยแล้ว! สามารถนำไปวาง (Paste) ส่งให้เพื่อนได้เลยครับ'));
    }
}

async function trackAction(storeName, actionType) {
    if (!storeName || !db) return;
    try {
        earnPoints(actionType, storeName);
        const statRef = db.collection('storeStats').doc(storeName);
        if (actionType === 'view') await statRef.set({ views: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        else if (actionType === 'dir') await statRef.set({ directions: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    } catch (e) {}
}

// ==========================================
// 📍 Map & UI Rendering
// ==========================================
const provinces = [
    {id:'bkk',name:'กรุงเทพมหานคร',lat:13.7563,lng:100.5018},{id:'krabi',name:'กระบี่',lat:8.0863,lng:98.9063},{id:'kanchanaburi',name:'กาญจนบุรี',lat:14.0159,lng:99.5336},{id:'kalasin',name:'กาฬสินธุ์',lat:16.4322,lng:103.5061},{id:'kamphaengphet',name:'กำแพงเพชร',lat:16.4828,lng:99.5227},{id:'khonkaen',name:'ขอนแก่น',lat:16.4322,lng:102.8236},{id:'chanthaburi',name:'จันทบุรี',lat:12.6114,lng:102.1039},{id:'chachoengsao',name:'ฉะเชิงเทรา',lat:13.6904,lng:101.0718},{id:'chonburi',name:'ชลบุรี',lat:13.3611,lng:100.9847},{id:'chainat',name:'ชัยนาท',lat:15.1852,lng:100.1251},{id:'chaiyaphum',name:'ชัยภูมิ',lat:15.8066,lng:102.0315},{id:'chumphon',name:'ชุมพร',lat:10.4930,lng:99.1800},{id:'chiangrai',name:'เชียงราย',lat:19.9105,lng:99.8406},{id:'chiangmai',name:'เชียงใหม่',lat:18.7883,lng:98.9853},{id:'trang',name:'ตรัง',lat:7.5563,lng:99.6114},{id:'trat',name:'ตราด',lat:12.2428,lng:102.5175},{id:'tak',name:'ตาก',lat:16.8840,lng:99.1258},{id:'nakhonnayok',name:'นครนายก',lat:14.2069,lng:101.2131},{id:'nakhonpathom',name:'นครปฐม',lat:13.8199,lng:100.0601},{id:'nakhonphanom',name:'นครพนม',lat:17.4048,lng:104.7816},{id:'nakhonratchasima',name:'นครราชสีมา',lat:14.9799,lng:102.0978},{id:'nakhonsithammarat',name:'นครศรีธรรมราช',lat:8.4304,lng:99.9631},{id:'nakhonsawan',name:'นครสวรรค์',lat:15.6987,lng:100.1221},{id:'nonthaburi',name:'นนทบุรี',lat:13.8591,lng:100.5217},{id:'narathiwat',name:'นราธิวาส',lat:6.4255,lng:101.8253},{id:'nan',name:'น่าน',lat:18.7828,lng:100.7787},{id:'buengkan',name:'บึงกาฬ',lat:18.3609,lng:103.6508},{id:'buriram',name:'บุรีรัมย์',lat:14.9930,lng:103.1029},{id:'pathumthani',name:'ปทุมธานี',lat:14.0208,lng:100.5250},{id:'prachuapkhirikhan',name:'ประจวบคีรีขันธ์',lat:11.8105,lng:99.7971},{id:'prachinburi',name:'ปราจีนบุรี',lat:14.0510,lng:101.3736},{id:'pattani',name:'ปัตตานี',lat:6.8673,lng:101.2501},{id:'phranakhonsiayutthaya',name:'พระนครศรีอยุธยา',lat:14.3532,lng:100.5684},{id:'phayao',name:'พะเยา',lat:19.1666,lng:99.9022},{id:'phangnga',name:'พังงา',lat:8.4501,lng:98.5283},{id:'phatthalung',name:'พัทลุง',lat:7.6166,lng:100.0740},{id:'phichit',name:'พิจิตร',lat:16.4411,lng:100.3488},{id:'phitsanulok',name:'พิษณุโลก',lat:16.8211,lng:100.2659},{id:'phetchaburi',name:'เพชรบุรี',lat:13.1112,lng:99.9405},{id:'phetchabun',name:'เพชรบูรณ์',lat:16.4184,lng:101.1554},{id:'phrae',name:'แพร่',lat:18.1446,lng:100.1403},{id:'phuket',name:'ภูเก็ต',lat:7.9519,lng:98.3381},{id:'mahasarakham',name:'มหาสารคาม',lat:16.1852,lng:103.3007},{id:'mukdahan',name:'มุกดาหาร',lat:16.5453,lng:104.7195},{id:'maehongson',name:'แม่ฮ่องสอน',lat:19.3020,lng:97.9654},{id:'yala',name:'ยะลา',lat:6.5411,lng:101.2804},{id:'yasothon',name:'ยโสธร',lat:15.7926,lng:104.1453},{id:'roiet',name:'ร้อยเอ็ด',lat:16.0538,lng:103.6520},{id:'ranong',name:'ระนอง',lat:9.9658,lng:98.6348},{id:'rayong',name:'ระยอง',lat:12.6814,lng:101.2816},{id:'ratchaburi',name:'ราชบุรี',lat:13.5283,lng:99.8134},{id:'lopburi',name:'ลพบุรี',lat:14.7995,lng:100.6534},{id:'lampang',name:'ลำปาง',lat:18.2888,lng:99.4930},{id:'lamphun',name:'ลำพูน',lat:18.5745,lng:99.0087},{id:'loei',name:'เลย',lat:17.4860,lng:101.7223},{id:'sisaket',name:'ศรีสะเกษ',lat:15.1151,lng:104.3220},{id:'sakonnakon',name:'สกลนคร',lat:17.1664,lng:104.1486},{id:'songkhla',name:'สงขลา',lat:7.1897,lng:100.5954},{id:'satun',name:'สตูล',lat:6.6238,lng:100.0674},{id:'samutprakan',name:'สมุทรปราการ',lat:13.5993,lng:100.5968},{id:'samutsongkhram',name:'สมุทรสงคราม',lat:13.4098,lng:100.0023},{id:'samutsakhon',name:'สมุทรสาคร',lat:13.5475,lng:100.2736},{id:'sakaeo',name:'สระแก้ว',lat:13.8240,lng:102.0646},{id:'saraburi',name:'สระบุรี',lat:14.5289,lng:100.9101},{id:'singburi',name:'สิงห์บุรี',lat:14.8936,lng:100.3967},{id:'sukhothai',name:'สุโขทัย',lat:17.0116,lng:99.8253},{id:'suphanburi',name:'สุพรรณบุรี',lat:14.4742,lng:100.1123},{id:'suratthani',name:'สุราษฎร์ธานี',lat:9.1342,lng:99.3215},{id:'surin',name:'สุรินทร์',lat:14.8818,lng:103.4936},{id:'nongkhai',name:'หนองคาย',lat:17.8783,lng:102.7420},{id:'nongbualamphu',name:'หนองบัวลำภู',lat:17.2045,lng:102.4339},{id:'angthong',name:'อ่างทอง',lat:14.5896,lng:100.4551},{id:'amnatdharoen',name:'อำนาจเจริญ',lat:15.8657,lng:104.6258},{id:'udonthani',name:'อุดรธานี',lat:17.4138,lng:102.7872},{id:'uttaradit',name:'อุตรดิตถ์',lat:17.6201,lng:100.0993},{id:'uthaithani',name:'อุทัยธานี',lat:15.3730,lng:100.0243},{id:'ubon',name:'อุบลราชธานี',lat:15.2287,lng:104.8564},
];

function initMap() {
    const pSel = document.getElementById('provinceSelect');
    const prSel = document.getElementById('promoProvinceSelect');
    if (pSel) pSel.innerHTML = '<option value="current">📍 ตำแหน่งปัจจุบัน</option>';
    if (prSel) prSel.innerHTML = '';
    provinces.sort((a, b) => a.name.localeCompare(b.name, 'th')).forEach(p => {
        if (pSel) pSel.appendChild(new Option(p.name, p.id));
        if (prSel) prSel.appendChild(new Option(p.name, p.id));
    });
    if (pSel) pSel.value = 'current';
    map = new google.maps.Map(document.getElementById('map'), {
        center: currentCoords, zoom: 14, mapTypeControl: false, streetViewControl: false,
    });
    service = new google.maps.places.PlacesService(map);
    infoWindow = new google.maps.InfoWindow();
    changeLocation();
}

function changeLocation() {
    const val = document.getElementById('provinceSelect').value;
    if (gpsMarker) gpsMarker.setMap(null);
    if (activeMarker) activeMarker.setMap(null);

    if (val === 'current') {
        document.getElementById('placeList').innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:50px; color:var(--text-muted);">📍 กำลังขอพิกัด GPS...</p>';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    gpsMarker = new google.maps.Marker({ position: currentCoords, map });
                    map.setCenter(currentCoords);
                    executeSearch('food');
                },
                () => {
                    document.getElementById('placeList').innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:50px; color:var(--danger);">📍 ไม่สามารถดึงพิกัดปัจจุบันได้<br><span style="font-size:13px; color:var(--text-muted);">สลับไปอุบลราชธานี...</span></p>';
                    setTimeout(() => { document.getElementById('provinceSelect').value = 'ubon'; changeLocation(); }, 1500);
                },
                { timeout: 10000, enableHighAccuracy: true }
            );
        }
    } else {
        const sel = provinces.find(p => p.id === val);
        if (sel) {
            currentCoords = { lat: sel.lat, lng: sel.lng };
            map.setCenter(currentCoords);
            executeSearch('food');
        }
    }
}

function getVIPMarkerIcon() {
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
                <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32S40 35 40 20C40 9 31 0 20 0z" fill="#FFD700" stroke="#C5A059" stroke-width="2"/>
                <circle cx="20" cy="19" r="11" fill="#1A1D23"/>
                <text x="20" y="24" text-anchor="middle" font-size="14" fill="#FFD700" font-family="Arial">★</text>
            </svg>`),
        scaledSize: new google.maps.Size(40, 52), anchor: new google.maps.Point(20, 52),
    };
}

function refreshVIPMarkers() {
    vipMarkers.forEach(m => m.setMap(null));
    vipMarkers = [];
    if (!map) return;
    const stores = appData.registeredStores || [];
    const now = Date.now();
    const icon = getVIPMarkerIcon();

    stores.forEach(store => {
        if (!(store.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew))) return;
        const place = googlePlaces.find(p => p.name === store.name);
        if (!place) return;
        const marker = new google.maps.Marker({
            position: place.geometry.location, map: map, icon: icon, title: '⭐ ' + store.name + ' (VIP)', zIndex: 1000, animation: google.maps.Animation.DROP,
        });
        marker.addListener('click', () => focusPlace(place.place_id));
        vipMarkers.push(marker);
    });
}

function getCustomStoreStatus(hoursObj) {
    if (!hoursObj) return null;
    const now = new Date(); const day = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayHours = hoursObj[day];
    if (!todayHours) return null;

    const timeText = todayHours.isClosed ? 'ปิดทำการ' : `${todayHours.open} - ${todayHours.close}`;
    if (todayHours.isClosed || !todayHours.open || !todayHours.close) {
        return {
            html: '<span class="status-tag" style="background:#FFF3F3;color:var(--danger);border:1px solid rgba(217,83,79,0.2);">🔴 ปิดแล้ว</span>',
            text: timeText, isOpen: false, label: '<span style="background:#D9534F;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;margin-left:6px;">ปิดแล้ว</span>',
        };
    }

    const [oH, oM] = todayHours.open.split(':').map(Number);
    const [cH, cM] = todayHours.close.split(':').map(Number);
    const openMins = oH * 60 + oM;
    let closeMins = cH * 60 + cM;
    if (closeMins < openMins) closeMins += 1440;
    let evalMins = currentMinutes;
    if (closeMins > 1440 && currentMinutes < (closeMins - 1440)) evalMins += 1440;

    const isOpen = evalMins >= openMins && evalMins < closeMins;
    const minsToClose = isOpen ? closeMins - evalMins : 0;
    const minsToOpen = !isOpen && evalMins < openMins ? openMins - evalMins : 0;

    if (isOpen) {
        if (minsToClose <= 30) return { html: '<span class="status-tag" style="background:#FFF8E1;color:#F57C00;border:1px solid rgba(245,124,0,0.2);">🟠 กำลังจะปิด</span>', text: timeText, isOpen: true, label: '<span style="background:#F57C00;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;margin-left:6px;">กำลังจะปิด</span>' };
        return { html: '<span class="status-tag" style="background:#F4FBF4;color:#2E7D32;border:1px solid rgba(46,125,50,0.2);">🟢 เปิดอยู่ตอนนี้</span>', text: timeText, isOpen: true, label: '<span style="background:#06C755;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;margin-left:6px;">เปิดอยู่</span>' };
    } else {
        if (minsToOpen > 0 && minsToOpen <= 30) return { html: '<span class="status-tag" style="background:#E1F5FE;color:#17A2B8;border:1px solid rgba(23,162,184,0.2);">🔵 กำลังจะเปิด</span>', text: timeText, isOpen: false, label: '<span style="background:#17A2B8;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;margin-left:6px;">กำลังจะเปิด</span>' };
        return { html: '<span class="status-tag" style="background:#FFF3F3;color:var(--danger);border:1px solid rgba(217,83,79,0.2);">🔴 ปิดแล้ว</span>', text: timeText, isOpen: false, label: '<span style="background:#D9534F;color:#FFF;padding:3px 8px;border-radius:10px;font-size:11px;margin-left:6px;">ปิดแล้ว</span>' };
    }
}

function renderUI() {
    const cData = appData.categories || [];
    const sData = appData.services || [];
    const mainCats = appData.mainCategories || [];

    const catContainer = document.getElementById('dynamic-category-container');
    if (catContainer) {
        catContainer.innerHTML = mainCats.map(m =>
            `<select id="${m.id}Select" class="input-dark" style="width:100%;" onchange="executeSearch('${m.id}')">
                <option value="${m.keyword}">${m.label}</option>
                ${cData.filter(c => c.group === m.id).map(c => `<option value="${c.keyword}">${c.label}</option>`).join('')}
             </select>`
        ).join('');
    }

    const pCat = document.getElementById('promoStoreCategory');
    if (pCat) {
        pCat.innerHTML = mainCats.map(m =>
            `<optgroup label="${m.label}">
                ${cData.filter(c => c.group === m.id).map(c => `<option value="${c.label}">${c.label}</option>`).join('')}
             </optgroup>`
        ).join('');
    }

    const sSel = document.getElementById('promoServiceSelect');
    if (sSel) {
        sSel.innerHTML = sData.map(s => `<option value="${s.name} - ${s.price}฿">${s.name} - ${s.price}฿</option>`).join('');
    }
}

function executeSearch(type) {
    if (!currentCoords) return;
    const searchBox = document.getElementById('searchBox');
    const searchVal = searchBox ? searchBox.value.trim() : '';
    const mainCats = appData.mainCategories || [];
    let kw = 'ร้านอาหาร';

    if (searchVal !== '' && type === 'text') {
        kw = searchVal;
        mainCats.forEach(m => { const s = document.getElementById(m.id + 'Select'); if (s) s.selectedIndex = 0; });
    } else {
        const targetCat = mainCats.find(m => m.id === type);
        if (targetCat) {
            const sel = document.getElementById(targetCat.id + 'Select');
            kw = sel?.value || targetCat.keyword;
            mainCats.forEach(m => { if (m.id !== type) { const s = document.getElementById(m.id + 'Select'); if (s) s.selectedIndex = 0; } });
            if (searchBox) searchBox.value = '';
        } else {
            let found = false;
            for (const m of mainCats) {
                const sel = document.getElementById(m.id + 'Select');
                if (sel && sel.selectedIndex > 0) { kw = sel.value; found = true; break; }
            }
            if (!found && mainCats.length > 0) kw = mainCats[0].keyword;
        }
    }

    googlePlaces = [];
    document.getElementById('placeList').innerHTML = `<p style="text-align:center;grid-column:1/-1;padding:50px;color:var(--text-muted);">กำลังค้นหา <b>"${kw}"</b>...</p>`;

    service.nearbySearch({ location: currentCoords, radius: 10000, keyword: kw }, (res, status, pag) => {
        if (status === 'OK') {
            const blacklisted = appData.blacklistedPlaces || [];
            googlePlaces = res.filter(p => !blacklisted.includes(p.place_id));
            currentPagination = pag;
            renderCards(kw);
        } else {
            document.getElementById('placeList').innerHTML = `<p style="text-align:center;grid-column:1/-1;padding:50px;color:var(--text-muted);">ไม่พบ <b>"${kw}"</b> ในบริเวณนี้</p>`;
        }
    });
}

function renderCards(keywordSearched) {
    const list = document.getElementById('placeList');
    const originPoint = new google.maps.LatLng(currentCoords.lat, currentCoords.lng);
    const stores = appData.registeredStores || [];
    const now = Date.now();

    const sorted = [...googlePlaces].sort((a, b) => {
        const vipA = stores.find(s => s.name === a.name)?.isVIP ? 1 : 0;
        const vipB = stores.find(s => s.name === b.name)?.isVIP ? 1 : 0;
        if (vipA !== vipB) return vipB - vipA;
        if (window.google?.maps?.geometry)
            return google.maps.geometry.spherical.computeDistanceBetween(originPoint, a.geometry.location)
                - google.maps.geometry.spherical.computeDistanceBetween(originPoint, b.geometry.location);
        return 0;
    });

    let html = sorted.slice(0, 80).map(p => {
        const store = stores.find(s => s.name === p.name);
        const isVIP = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.geometry.location.lat()},${p.geometry.location.lng()}`;
        const distKm = window.google?.maps?.geometry ? (google.maps.geometry.spherical.computeDistanceBetween(originPoint, p.geometry.location) / 1000).toFixed(1) : '0.0';

        let statusHtml = '<span class="status-tag" style="background:rgba(0,0,0,0.5);color:var(--text-muted);border:1px solid var(--border);">⚪ เวลา: ทางร้านไม่ได้ระบุ</span>';
        const customStatus = store?.operatingHours ? getCustomStoreStatus(store.operatingHours) : null;
        if (customStatus) {
            statusHtml = customStatus.html;
        } else if (p.business_status === 'CLOSED_TEMPORARILY') {
            statusHtml = '<span class="status-tag" style="background:#FFF3F3;color:var(--danger);border:1px solid rgba(217,83,79,0.2);">🔴 ปิดชั่วคราว</span>';
        } else if (p.business_status === 'CLOSED_PERMANENTLY') {
            statusHtml = '<span class="status-tag" style="background:#FFF3F3;color:var(--danger);border:1px solid rgba(217,83,79,0.2);">🔴 ปิดถาวร</span>';
        } else if (p.opening_hours) {
            const isOpen = typeof p.opening_hours.isOpen === 'function' ? p.opening_hours.isOpen() : p.opening_hours.open_now;
            if (isOpen === true) statusHtml = '<span class="status-tag" style="background:#F4FBF4;color:#2E7D32;border:1px solid rgba(46,125,50,0.2);">🟢 เปิดอยู่ตอนนี้</span>';
            if (isOpen === false) statusHtml = '<span class="status-tag" style="background:#FFF3F3;color:var(--danger);border:1px solid rgba(217,83,79,0.2);">🔴 ปิดแล้ว</span>';
        }

        const hasLine = !!(store?.lineUrl?.trim());
        const hasFb = !!(store?.fbUrl?.trim());
        const imgUrl = p.photos ? p.photos[0].getUrl({ maxWidth: 400 }) : 'https://via.placeholder.com/400x200?text=Painaidee';
        const safeName = p.name ? p.name.replace(/'/g, "\\'").replace(/"/g, '"') : 'ร้านค้า';

        let imageBlock = '';
        if (isVIP && p.photos) {
            imageBlock = `
            <div style="position:relative; cursor:pointer;" onclick="viewStoreGallery('${p.place_id}', '${safeName}', true, event)">
                <img src="${imgUrl}" class="main-img" style="display:block; width:100%;">
                <div style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.75); color:#FFD700; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:bold; border:1px solid #C5A059; pointer-events:none; box-shadow:0 2px 5px rgba(0,0,0,0.5);">
                    📸 ดูรูปเพิ่มเติม (VIP)
                </div>
            </div>`;
        } else {
            imageBlock = `<img src="${imgUrl}" class="main-img" onclick="event.stopPropagation(); openImageModal(this.src)">`;
        }

        const activeDeals = (appData.deals || []).filter(d => d.storeName === p.name && d.isActive && (!d.expiryDate || new Date(d.expiryDate) > new Date()) && (d.maxUses === 0 || d.usedCount < d.maxUses));

        let extraTags = '';
        if (activeDeals.length > 0) {
            extraTags += `<span onclick="showStoreDealsModal('${safeName}'); event.stopPropagation();" style="background:rgba(217,83,79,0.1);color:var(--danger);padding:5px 12px;border-radius:10px;font-size:11px;font-weight:bold;margin-right:5px;display:inline-block;margin-bottom:5px;cursor:pointer;border:1px solid rgba(217,83,79,0.3);pointer-events:auto;box-shadow:0 2px 5px rgba(217,83,79,0.2);">🎟️ มี ${activeDeals.length} ดีลพิเศษ!</span>`;
        }
        if (store?.event?.trim()) {
            extraTags += `<span onclick="showCustomerDetail('event','${safeName}'); event.stopPropagation();" style="background:rgba(23,162,184,0.1);color:var(--info);padding:5px 12px;border-radius:10px;font-size:11px;font-weight:bold;display:inline-block;margin-bottom:5px;cursor:pointer;border:1px solid rgba(23,162,184,0.3);pointer-events:auto;">🎉 ดูกิจกรรม</span>`;
        }

        const vipEffectClass = isVIP && currentTheme.vipEffect && currentTheme.vipEffect !== 'none' ? ' vip-' + currentTheme.vipEffect : '';

        return `
        <div class="place-card ${isVIP ? 'card-vip' + vipEffectClass : ''}" onclick="focusPlace('${p.place_id}'); trackAction('${p.name}','view')">
            ${isVIP ? '<div class="vip-crown-badge">👑 VIP RECOMMEND</div>' : ''}
            <div class="distance-badge">${distKm} กม.</div>
            ${imageBlock}
            <div class="place-info">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;">
                    <h3 style="margin:0;font-size:16px;flex:1;color:${isVIP ? 'var(--prev-vip)' : 'var(--primary)'};font-weight:600;line-height:1.2;">${p.name}</h3>
                    <div style="text-align:right;flex-shrink:0;">${statusHtml}</div>
                </div>
                <div style="margin-bottom:5px;">${extraTags}</div>
                <p style="font-size:13px;color:var(--text-muted);margin:0 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.vicinity}</p>
                <div><span style="color:var(--primary);font-weight:600;">⭐ ${p.rating || 'ใหม่'}</span></div>
                <div class="action-buttons">
                    <button class="btn-action btn-nav" onclick="window.open('${navUrl}','_blank'); trackAction('${p.name}','dir'); event.stopPropagation();">นำทาง</button>
                    <button class="btn-action btn-call" onclick="callPlace('${p.place_id}',event)">โทร</button>
                    ${hasLine ? `<button class="btn-action btn-line" onclick="window.open('${store.lineUrl.startsWith('http') ? store.lineUrl : 'https://' + store.lineUrl}','_blank'); event.stopPropagation();">LINE</button>` : ''}
                    ${hasFb ? `<button class="btn-action btn-fb" onclick="window.open('${store.fbUrl.startsWith('http') ? store.fbUrl : 'https://' + store.fbUrl}','_blank'); event.stopPropagation();">FB</button>` : ''}
                    <button class="btn-action btn-share" onclick="sharePlace('${safeName}',${p.geometry.location.lat()},${p.geometry.location.lng()},event)">แชร์</button>
                </div>
                <div style="margin-top:15px; text-align:right; position:relative; z-index:10;">
                    <button onclick="reportClosed('${p.place_id}', '${safeName}'); event.stopPropagation();" style="background:none; border:none; color:var(--danger); font-size:12px; cursor:pointer; opacity:0.8; font-family:'Kanit'; text-decoration:underline; padding:5px;">🚩 แจ้งร้านปิดถาวร</button>
                </div>
            </div>
        </div>`;
    }).join('');

    if (currentPagination?.hasNextPage && googlePlaces.length < 80)
        html += `<div style="grid-column:1/-1;text-align:center;"><button class="btn-outline" style="width:200px;border-color:var(--primary);" onclick="this.innerHTML='โหลดเพิ่ม...'; currentPagination.nextPage()">⬇️ ดูเพิ่มเติม</button></div>`;

    list.innerHTML = html;
    renderPromos();
    refreshVIPMarkers();
}

function renderPromos() {
    let curProv = document.getElementById('provinceSelect').value;
    const now = Date.now();
    const activePromos = (appData.activePromotions || []).filter(p => {
        if (p.expireTimestamp && now > p.expireTimestamp && !p.autoRenew) return false;
        return true;
    });

    if (curProv === 'current') {
        if (currentCoords && window.google?.maps?.geometry) {
            const originPoint = new google.maps.LatLng(currentCoords.lat, currentCoords.lng);
            let minDist = Infinity;
            provinces.forEach(p => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(originPoint, new google.maps.LatLng(p.lat, p.lng));
                if (dist < minDist) { minDist = dist; curProv = p.id; }
            });
        } else {
            curProv = 'ubon';
        }
    }

    const promos = activePromos.filter(p => p.province === curProv).sort(() => Math.random() - 0.5);
    const banner = document.getElementById('promoBanner');
    if (promos.length === 0) { banner.style.display = 'none'; return; }

    banner.style.display = 'block';
    document.getElementById('approvedPromoList').innerHTML = promos.map(p => {
        const store = (appData.registeredStores || []).find(s => s.name === p.storeName);
        const isVIP = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        const hasLine = !!(store?.lineUrl?.trim());
        const hasFb = !!(store?.fbUrl?.trim());

        let timeHtml = '<span style="background:rgba(255,255,255,0.1);color:#aaa;padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid rgba(255,255,255,0.2);">⚪ ไม่ระบุเวลา</span>';
        if (store?.operatingHours) {
            const cs = getCustomStoreStatus(store.operatingHours);
            if (cs) timeHtml = cs.html;
        }

        const imgs = p.images?.length > 0 ? p.images : [p.image];
        let sliderHtml = `<div class="promo-slider-container shine-effect">`;
        imgs.forEach((img, idx) => {
            sliderHtml += `<img src="${img}" class="slide-item" onclick="event.stopPropagation(); openImageModal(this.src)" style="opacity:${idx === 0 ? '1' : '0'};pointer-events:${idx === 0 ? 'auto' : 'none'};">`;
        });
        if (imgs.length > 1) sliderHtml += `<div class="slide-indicator">1/${imgs.length} 📸</div>`;
        sliderHtml += '</div>';

        const safeStore = p.storeName.replace(/'/g, "\\'");
        const activeDeals = (appData.deals || []).filter(d => d.storeName === p.storeName && d.isActive && (!d.expiryDate || new Date(d.expiryDate) > new Date()) && (d.maxUses === 0 || d.usedCount < d.maxUses));

        let extraHtml = '';
        if (activeDeals.length > 0) extraHtml += `<span onclick="showStoreDealsModal('${safeStore}'); event.stopPropagation();" style="background:rgba(217,83,79,0.1);color:var(--danger);padding:4px 8px;border-radius:10px;font-size:10px;font-weight:bold;margin-right:5px;display:inline-block;margin-bottom:5px;cursor:pointer;border:1px solid rgba(217,83,79,0.3);pointer-events:auto;">🎟️ มี ${activeDeals.length} ดีล!</span>`;
        if (store?.event?.trim()) extraHtml += `<span onclick="showCustomerDetail('event','${safeStore}'); event.stopPropagation();" style="background:rgba(23,162,184,0.1);color:var(--info);padding:4px 8px;border-radius:10px;font-size:10px;font-weight:bold;display:inline-block;margin-bottom:5px;cursor:pointer;border:1px solid rgba(23,162,184,0.3);pointer-events:auto;">🎉 กิจกรรม</span>`;

        return `
        <div class="promo-item place-card" style="border:2px solid var(--primary);box-shadow:0 0 20px rgba(0,0,0,0.2);">
            <div style="position:absolute;top:12px;right:-28px;background:#D9534F;color:#FFF; padding:4px 30px;transform:rotate(45deg);font-size:11px;font-weight:800; z-index:20;box-shadow:0 2px 5px rgba(0,0,0,0.3);pointer-events:none;">HOT 🔥</div>
            ${sliderHtml}
            <div style="padding:18px;display:flex;flex-direction:column;flex-grow:1;">
                <div style="margin-bottom:8px;">${p.category ? `<span style="background:var(--primary);color:#000;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block;margin-right:5px;">📌 ${p.category}</span>` : ''}${extraHtml}</div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <h3 style="margin:0;font-size:18px;color:var(--prev-vip);font-weight:600;text-shadow:0 0 5px rgba(0,0,0,0.3);flex:1;">✨ ${p.storeName}</h3>
                    <div style="flex-shrink:0;transform:scale(0.9);transform-origin:right top;">${timeHtml}</div>
                </div>
                <div style="background:rgba(0,0,0,0.2);padding:12px;border-radius:8px;border:1px dashed var(--primary);margin-bottom:15px;">
                    <p style="font-size:14px;color:var(--text-main);margin:0;">${p.detail}</p>
                </div>
                <div style="display:flex;gap:8px;margin-top:auto;">
                    ${hasLine ? `<button onclick="window.open('${store.lineUrl.startsWith('http') ? store.lineUrl : 'https://' + store.lineUrl}','_blank')" class="promo-btn-hover" style="flex:1;background:var(--line-green);color:white;border:none;padding:10px;border-radius:8px;font-family:'Kanit';font-weight:600;font-size:13px;cursor:pointer;">💬 LINE</button>` : ''}
                    ${hasFb ? `<button onclick="window.open('${store.fbUrl.startsWith('http') ? store.fbUrl : 'https://' + store.fbUrl}','_blank')" class="promo-btn-hover" style="flex:1;background:var(--fb-blue);color:white;border:none;padding:10px;border-radius:8px;font-family:'Kanit';font-weight:600;font-size:13px;cursor:pointer;">👍 FB</button>` : ''}
                    <button onclick="searchAndFocusStore('${p.storeName}'); trackAction('${p.storeName}','view')" class="promo-btn-hover" style="flex:1;background:var(--primary);color:#000;border:none;padding:10px;border-radius:8px;font-family:'Kanit';font-weight:600;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.2);">📍 ดูพิกัดร้าน</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

setInterval(() => {
    document.querySelectorAll('.promo-slider-container').forEach(slider => {
        const imgs = slider.querySelectorAll('.slide-item');
        if (imgs.length <= 1) return;
        let activeIdx = Array.from(imgs).findIndex(img => img.style.opacity === '1');
        if (activeIdx === -1) activeIdx = 0;
        imgs[activeIdx].style.opacity = '0'; imgs[activeIdx].style.pointerEvents = 'none';
        const nextIdx = (activeIdx + 1) % imgs.length;
        imgs[nextIdx].style.opacity = '1'; imgs[nextIdx].style.pointerEvents = 'auto';
        const indicator = slider.querySelector('.slide-indicator');
        if (indicator) indicator.innerText = `${nextIdx + 1}/${imgs.length} 📸`;
    });
}, 3500);

// ==========================================
// ⚙️ Store Management Forms
// ==========================================
function reportClosed(id, n) {
    if (!confirm('ยืนยันแจ้งปิดร้าน "' + n + '" ถาวร?')) return;
    if (!appData.closedReports) appData.closedReports = [];
    const alreadyReported = appData.closedReports.find(r => r.placeId === id);
    if (alreadyReported) return alert('ร้านนี้มีการแจ้งปิดถาวรเข้ามาแล้ว แอดมินกำลังตรวจสอบครับ 🙏');
    appData.closedReports.push({ placeId: id, storeName: n, date: new Date().toLocaleString('th-TH') });
    saveToCloud();
    alert('ขอบคุณครับ แอดมินจะตรวจสอบและลบออกจากระบบครับ');
}

function searchRegStore() {
    const q = document.getElementById('regStoreName').value;
    if (!q) return alert('ระบุชื่อร้านก่อนครับ');
    service.textSearch({ query: q, location: currentCoords, radius: 50000 }, (res, status) => {
        if (status === 'OK') {
            const p = res[0];
            document.getElementById('regStoreVerifyCard').style.display = 'block';
            document.getElementById('regVerifyStoreName').innerText = '✅ ' + p.name;
            document.getElementById('regStoreName').value = p.name;
            if (!regMiniMap) regMiniMap = new google.maps.Map(document.getElementById('regMiniMap'), { zoom: 16, mapTypeControl: false });
            regMiniMap.setCenter(p.geometry.location);
            if (regMiniMarker) regMiniMarker.setMap(null);
            regMiniMarker = new google.maps.Marker({ position: p.geometry.location, map: regMiniMap });
        } else alert('ไม่พบพิกัดร้านครับ');
    });
}

async function submitStoreRegistration() {
    const btn = document.getElementById('btnSubmitReg');
    const n = document.getElementById('regStoreName').value;
    const p1 = document.getElementById('regStorePhoto').files[0];
    const p2 = document.getElementById('regIdCard').files[0];
    const phone = document.getElementById('regPhone').value;
    const refCode = document.getElementById('regRefCode').value;

    if (!n || !p1 || !p2 || !phone) return alert('กรุณากรอกข้อมูลและแนบรูปให้ครบครับ');
    if (refCode && window.myAffCode && refCode.toUpperCase() === window.myAffCode.toUpperCase()) return alert('⚠️ ไม่สามารถใช้รหัสแนะนำของตัวเองได้ครับ');

    btn.innerText = 'กำลังประมวลผลรูปภาพ... ⏳'; btn.disabled = true;
    try {
        let userId = '';
        try { if (liff.isLoggedIn()) userId = (await liff.getProfile()).userId; } catch (e) { }

        const photo64 = await resizeImg(p1);
        const idCard64 = await resizeImg(p2);
        let comm64 = '';
        const commFile = document.getElementById('regCommercial').files[0];
        if (commFile) comm64 = await resizeImg(commFile);

        btn.innerText = 'กำลังอัปโหลดข้อมูล... 🚀';
        const photo = await uploadImageToStorage(photo64, 'stores');
        const idCard = await uploadImageToStorage(idCard64, 'documents');
        const comm = await uploadImageToStorage(comm64, 'documents');

        if (!appData.registrationRequests) appData.registrationRequests = [];
        appData.registrationRequests.push({ id: Date.now(), storeName: n, phone, userId, refCode, storePhoto: photo, idCard, commercial: comm });
        await saveToCloud();
        sendTelegramNotify(`🚨 <b>มีคำร้องลงทะเบียนร้านค้าใหม่!</b>\n\n🏬 ร้าน: <b>${n}</b>\n📞 โทร: ${phone}\n${refCode ? `🤝 แนะนำโดย: ${refCode}\n` : ''}\n👉 กรุณาเข้าหน้าแอดมินเพื่ออนุมัติ PIN ครับ`);
        alert('ส่งข้อมูลสำเร็จ! รอรับรหัส PIN จากแอดมิน (แจ้งเตือนผ่านช่องทาง LINE) ครับ');
        ['regStoreName', 'regPhone', 'regStorePhoto', 'regIdCard', 'regCommercial', 'regRefCode'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('regStoreVerifyCard').style.display = 'none';
        document.getElementById('regStoreDetails').style.display = 'none';
    } catch (error) {
        alert('❌ ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้งครับ');
        if (appData.registrationRequests.length > 0 && appData.registrationRequests[appData.registrationRequests.length - 1].storeName === n) appData.registrationRequests.pop();
    } finally { btn.innerText = '🚀 ส่งข้อมูลเพื่อรับ PIN'; btn.disabled = false; }
}

async function forgotPin() {
    const storeName = prompt('กรุณาพิมพ์ \'ชื่อร้าน\' ของคุณให้ถูกต้องตามที่ลงทะเบียนไว้:');
    if (!storeName) return;
    const store = (appData.registeredStores || []).find(s => s.name === storeName);
    if (store?.userId) {
        alert('กำลังส่งรหัส PIN ไปยัง LINE ของคุณ... ⏳');
        try {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'SEND_LINE_PIN', targetUserId: store.userId, message: `🔑 แจ้งเตือนจากระบบไปไหนดี\nรหัส PIN ของร้าน ${store.name} คือ: ${store.pin}` }) });
            alert('✅ ส่งรหัส PIN ไปทาง LINE สำเร็จ กรุณาตรวจสอบในแชทครับ');
        } catch (e) { alert('❌ เกิดข้อผิดพลาดในการส่ง LINE'); }
    } else if (store) alert('⚠️ ร้านนี้ไม่ได้เชื่อมโยงกับระบบ LINE ไว้ กรุณาติดต่อแอดมินโดยตรงครับ');
    else alert('❌ ไม่พบชื่อร้านนี้ในระบบ กรุณาตรวจสอบตัวสะกดอีกครั้งครับ');
}

function verifyStore(silent = false) {
    const pin = document.getElementById('storePinInput').value;
    const store = (appData.registeredStores || []).find(s => s.pin === pin);
    if (!store) { if (!silent) alert('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'); return; }

    document.getElementById('lockedFeatures').style.display = 'block';
    document.getElementById('storeVerifyCard').style.display = 'none';
    document.getElementById('storeRegistrationCard').style.display = 'none';
    const nameEl = document.getElementById('loggedInStoreName');
    if (nameEl) nameEl.innerHTML = `🏪 ยินดีต้อนรับร้าน:<br><span style="color:#FFF;">${store.name}</span>`;

    const now = Date.now();
    const isVIP = !!(store.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));

    document.getElementById('displayVipPrice').innerText = appData.vipSettings?.price || 500;
    document.getElementById('displayBankAcc').innerText = appData.vipSettings?.bankAccount || 'กรุณาติดต่อแอดมินเพื่อขอเลขบัญชี';

    if (isVIP) {
        document.getElementById('vipHoursSection').style.display = 'block';
        document.getElementById('vipUpdateSection').style.display = 'block';
        document.getElementById('vipSubscribeTitle').innerHTML = '👑 สถานะร้านค้า: <span style="color:#06C755;">VIP Active</span>';
        let expireText = 'ตลอดชีพ';
        if (store.vipExpireTimestamp) {
            const d = new Date(store.vipExpireTimestamp);
            expireText = d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
        }
        const expEl = document.getElementById('vipExpiryDisplay');
        if (expEl) expEl.innerHTML = `⏳ สิทธิ์ VIP หมดอายุ: ${expireText}`;
        document.getElementById('nonVipStatsBlock').style.display = 'none';
        document.getElementById('btnShowRenewVip').style.display = 'block';
        document.getElementById('vipPaymentArea').style.display = 'none';

        if (db) {
            db.collection('storeStats').doc(store.name).get().then(doc => {
                const d = doc.exists ? doc.data() : { views: 0, directions: 0 };
                document.getElementById('statViews').innerText = d.views || 0;
                document.getElementById('statDirections').innerText = d.directions || 0;
            });
        }
        if (!silent) {
            document.getElementById('vipLineInput').value = store.lineUrl || '';
            document.getElementById('vipFbInput').value = store.fbUrl || '';
            renderHoursGrid(store);
        }
    } else {
        document.getElementById('vipHoursSection').style.display = 'none';
        document.getElementById('vipUpdateSection').style.display = 'none';
        document.getElementById('vipSubscribeTitle').innerHTML = '👑 สนใจรับสิทธิพิเศษ VIP?';
        const expEl = document.getElementById('vipExpiryDisplay');
        if (expEl) expEl.innerHTML = '';
        document.getElementById('nonVipStatsBlock').style.display = 'block';
        document.getElementById('btnShowRenewVip').style.display = 'none';
        document.getElementById('vipPaymentArea').style.display = 'block';
    }

    const activePromo = (appData.activePromotions || []).find(p => p.storeName === store.name);
    if (activePromo) {
        document.getElementById('editPromoSection').style.display = 'block';
        document.getElementById('buyPromoSection').style.display = 'none';
        let pExpire = 'ไม่มีกำหนด';
        if (activePromo.expireTimestamp) {
            const d = new Date(activePromo.expireTimestamp);
            pExpire = d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
        }
        const pExpEl = document.getElementById('promoExpiryDisplay');
        if (pExpEl) pExpEl.innerHTML = `⏳ หมดอายุแพ็กเกจ: ${pExpire}`;
        if (!silent) document.getElementById('editPromoDetailInput').value = activePromo.detail || '';
    } else {
        document.getElementById('editPromoSection').style.display = 'none';
        document.getElementById('buyPromoSection').style.display = 'block';
    }

    if (!silent) alert('ยินดีต้อนรับร้าน ' + store.name);
    renderStoreDeals();
}

function logoutStore() {
    document.getElementById('lockedFeatures').style.display = 'none';
    document.getElementById('storeVerifyCard').style.display = 'block';
    document.getElementById('storeRegistrationCard').style.display = 'block';
    document.getElementById('storePinInput').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHoursGrid(store) {
    const daysTH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    document.getElementById('hoursGrid').innerHTML = Array.from({ length: 7 }, (_, i) => {
        const d = store.operatingHours?.[i] || { open: '08:00', close: '17:00', isClosed: false };
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:5px; background:rgba(0,0,0,0.3);padding:10px;border-radius:8px; border:1px solid rgba(255,255,255,0.1);margin-bottom:5px;">
            <span style="width:60px;font-size:14px;color:#FFF;font-weight:bold;">${daysTH[i]}</span>
            <div style="display:flex;align-items:center;gap:5px;">
                <input type="time" id="open_${i}" value="${d.open}" style="padding:8px;font-size:14px;width:100px;border-radius:5px;" ${d.isClosed ? 'disabled' : ''}>
                <span style="color:#999;">-</span>
                <input type="time" id="close_${i}" value="${d.close}" style="padding:8px;font-size:14px;width:100px;border-radius:5px;" ${d.isClosed ? 'disabled' : ''}>
            </div>
            <label style="font-size:13px;display:flex;align-items:center;gap:5px;color:var(--danger);font-weight:bold;margin-left:5px;">
                <input type="checkbox" id="closed_${i}" ${d.isClosed ? 'checked' : ''} onchange="toggleDayStatus(${i})" style="width:18px;height:18px;"> ปิด
            </label>
        </div>`;
    }).join('');
}

function toggleDayStatus(dayIndex) {
    const isClosed = document.getElementById(`closed_${dayIndex}`).checked;
    document.getElementById(`open_${dayIndex}`).disabled = isClosed;
    document.getElementById(`close_${dayIndex}`).disabled = isClosed;
}
function applyBulkTime() {
    const op = document.getElementById('bulk_open').value;
    const cl = document.getElementById('bulk_close').value;
    for (let i = 0; i < 7; i++) {
        if (document.getElementById('day_' + i).checked) {
            document.getElementById('open_' + i).value = op; document.getElementById('close_' + i).value = cl;
            document.getElementById('closed_' + i).checked = false; toggleDayStatus(i);
        }
    }
}
function applyBulk24h() {
    for (let i = 0; i < 7; i++) {
        if (document.getElementById('day_' + i).checked) {
            document.getElementById('open_' + i).value = '00:00'; document.getElementById('close_' + i).value = '23:59';
            document.getElementById('closed_' + i).checked = false; toggleDayStatus(i);
        }
    }
}
function applyBulkClosed() {
    for (let i = 0; i < 7; i++) {
        if (document.getElementById('day_' + i).checked) {
            document.getElementById('closed_' + i).checked = true; toggleDayStatus(i);
        }
    }
}

async function saveOperatingHours() {
    const pin = document.getElementById('storePinInput').value;
    const storeIndex = appData.registeredStores.findIndex(s => s.pin === pin);
    if (storeIndex === -1) return alert('ไม่พบข้อมูลร้านค้า กรุณาตรวจสอบรหัส PIN');

    const newHours = {};
    for (let i = 0; i < 7; i++) {
        newHours[i] = { open: document.getElementById(`open_${i}`).value, close: document.getElementById(`close_${i}`).value, isClosed: document.getElementById(`closed_${i}`).checked };
    }
    appData.registeredStores[storeIndex].operatingHours = newHours;
    const btn = document.querySelector('#vipHoursSection button.btn-primary');
    if (btn) { btn.innerText = 'กำลังบันทึกข้อมูล... ⏳'; btn.disabled = true; }
    try { await saveToCloud(); alert('💾 บันทึกเวลาเปิด-ปิดร้านเรียบร้อยแล้ว!\n(ข้อมูลถูกซิงค์กับระบบเรียบร้อย)'); }
    catch (e) { alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่'); }
    finally { if (btn) { btn.innerText = '💾 บันทึกเวลาลงระบบ'; btn.disabled = false; } }
}

async function updateVipData() {
    const pin = document.getElementById('storePinInput').value;
    const storeIndex = appData.registeredStores.findIndex(s => s.pin === pin);
    if (storeIndex === -1) return;
    appData.registeredStores[storeIndex].lineUrl = document.getElementById('vipLineInput').value;
    appData.registeredStores[storeIndex].fbUrl = document.getElementById('vipFbInput').value;
    await saveToCloud(); alert('บันทึกข้อมูลติดต่อแล้ว ลูกค้าสามารถกดเข้า LINE/FB ได้ทันที');
}

function openRenewPromo() {
    const store = appData.registeredStores.find(s => s.pin === document.getElementById('storePinInput').value);
    document.getElementById('editPromoSection').style.display = 'none';
    document.getElementById('buyPromoSection').style.display = 'block';
    if (store?.freePromoDays > 0) {
        document.getElementById('promoSlipArea').style.display = 'none';
        document.getElementById('buyPromoTitle').innerHTML = '🎁 สิทธิพิเศษ VIP: ฟรีพื้นที่โปรโมท 7 วัน!';
        document.getElementById('promoServiceSelect').innerHTML = `<option value="ฟรี 7 วัน (สิทธิ์ VIP)">ใช้สิทธิ์โปรโมทฟรี 7 วัน</option>`;
    } else {
        document.getElementById('promoSlipArea').style.display = 'block';
        document.getElementById('buyPromoTitle').innerHTML = '⏳ ต่ออายุแพ็กเกจพื้นที่โปรโมท';
        const sData = appData.services || [];
        document.getElementById('promoServiceSelect').innerHTML = sData.map(s => `<option value="${s.name} - ${s.price}฿">${s.name} - ${s.price}฿</option>`).join('');
    }
}

async function submitVipRequest() {
    const store = appData.registeredStores.find(s => s.pin === document.getElementById('storePinInput').value);
    const slipFile = document.getElementById('vipSlipInput').files[0];
    if (!store) return alert('กรุณาเข้าสู่ระบบด้วยรหัส PIN ก่อนครับ');
    if (!slipFile) return alert('กรุณาแนบสลิปการโอนเงินครับ');
    const btn = document.getElementById('btnSubmitVip');
    btn.innerText = 'กำลังส่งสลิป... ⏳'; btn.disabled = true;
    try {
        const slipUrl = await uploadImageToStorage(await resizeImg(slipFile), 'slips');
        if (!appData.pendingVipRequests) appData.pendingVipRequests = [];
        appData.pendingVipRequests = appData.pendingVipRequests.filter(r => r.storeName !== store.name);
        appData.pendingVipRequests.push({ id: Date.now().toString(), storeName: store.name, slipImage: slipUrl, requestDate: new Date().toLocaleString() });
        await saveToCloud();
        sendTelegramNotify(`👑 <b>มีร้านค้าส่งสลิปขอเปิด VIP!</b>\n\n🏬 ร้าน: <b>${store.name}</b>\n\n👉 กรุณาเข้าหน้าแอดมินเพื่อตรวจสอบสลิปครับ`);
        alert('ส่งสลิปสำเร็จ! กรุณารอแอดมินอนุมัติสถานะ VIP ครับ');
        document.getElementById('vipSlipInput').value = '';
    } catch (e) { alert('❌ ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง'); }
    finally { btn.innerText = 'ส่งสลิปเพื่ออัปเกรด VIP'; btn.disabled = false; }
}

async function submitPromoWithPIN() {
    const btn = document.getElementById('btnSubmitPromo');
    const pin = document.getElementById('storePinInput').value;
    const storeIndex = appData.registeredStores.findIndex(s => s.pin === pin);
    if (storeIndex === -1) return alert('กรุณายืนยัน PIN ก่อน');
    const store = appData.registeredStores[storeIndex];
    const pImgFiles = document.getElementById('promoImageInput').files;
    const pSlipFile = document.getElementById('promoSlipInput').files[0];
    const isFree = store.freePromoDays > 0;

    if (pImgFiles.length === 0) return alert('กรุณาแนบรูปป้ายโปรโมทอย่างน้อย 1 รูปครับ');
    if (pImgFiles.length > 3) return alert('อัปโหลดรูปได้สูงสุด 3 รูปเท่านั้นครับ');
    if (!isFree && !pSlipFile) return alert('กรุณาแนบสลิปชำระเงินครับ');

    btn.innerText = 'กำลังอัปโหลดข้อมูล... ⏳'; btn.disabled = true;
    try {
        const imgUrls = [];
        for (let i = 0; i < pImgFiles.length; i++) imgUrls.push(await uploadImageToStorage(await resizeImg(pImgFiles[i]), 'promos'));
        let slipUrl = '';
        if (pSlipFile) slipUrl = await uploadImageToStorage(await resizeImg(pSlipFile), 'slips');

        if (!appData.pendingPromotions) appData.pendingPromotions = [];
        appData.pendingPromotions = appData.pendingPromotions.filter(p => p.storeName !== store.name);
        appData.pendingPromotions.push({
            id: Date.now().toString(), storeName: store.name, province: document.getElementById('promoProvinceSelect').value,
            detail: document.getElementById('promoDetail').value, image: imgUrls[0], images: imgUrls, slipImage: slipUrl,
            service: document.getElementById('promoServiceSelect').value, category: document.getElementById('promoStoreCategory').value,
            lineUrl: store.lineUrl || '', fbUrl: store.fbUrl || '', isUpdateOnly: false, isFreeRedeem: isFree,
        });
        if (isFree) appData.registeredStores[storeIndex].freePromoDays = 0;
        await saveToCloud();
        sendTelegramNotify(`🔥 <b>มีการสั่งซื้อ/ต่ออายุแบนเนอร์!</b>\n\n🏬 ร้าน: <b>${store.name}</b>\n📌 หมวด: ${document.getElementById('promoStoreCategory').value}\n\n👉 กรุณาตรวจสอบและอนุมัติในหน้าแอดมินครับ`);
        alert(isFree ? 'ใช้สิทธิ์โปรโมทฟรีสำเร็จ! รอแอดมินอนุมัติแบนเนอร์ขึ้นระบบครับ' : 'สั่งซื้อสำเร็จ! รอแอดมินตรวจสอบสลิปและอนุมัติครับ');
        document.getElementById('promoImageInput').value = '';
    } catch (e) { alert('❌ ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง'); }
    finally { btn.innerText = '🚀 สั่งซื้อและส่งเรื่องตรวจสอบ'; btn.disabled = false; }
}

async function submitEditPromo() {
    const btn = document.getElementById('btnEditPromo');
    const pin = document.getElementById('storePinInput').value;
    const store = appData.registeredStores.find(s => s.pin === pin);
    const activePromo = (appData.activePromotions || []).find(p => p.storeName === store?.name);
    if (!store || !activePromo) return alert('ไม่พบโปรโมชั่นที่กำลังแสดงผลให้แก้ไขครับ');
    const pImgFiles = document.getElementById('editPromoImageInput').files;
    if (pImgFiles.length > 3) return alert('อัปโหลดรูปได้สูงสุด 3 รูปเท่านั้นครับ');

    btn.innerText = 'กำลังอัปโหลดข้อมูล... 🚀'; btn.disabled = true;
    try {
        let imgUrls = [];
        if (pImgFiles.length > 0) {
            for (let i = 0; i < pImgFiles.length; i++) imgUrls.push(await uploadImageToStorage(await resizeImg(pImgFiles[i]), 'promos'));
        } else imgUrls = activePromo.images?.length > 0 ? activePromo.images : [activePromo.image];

        if (!appData.pendingPromotions) appData.pendingPromotions = [];
        appData.pendingPromotions = appData.pendingPromotions.filter(p => p.storeName !== store.name);
        appData.pendingPromotions.push({
            id: Date.now().toString(), storeName: store.name, province: activePromo.province, detail: document.getElementById('editPromoDetailInput').value,
            image: imgUrls[0], images: imgUrls, service: activePromo.service, category: activePromo.category,
            lineUrl: store.lineUrl || '', fbUrl: store.fbUrl || '', isUpdateOnly: true,
        });
        await saveToCloud();
        sendTelegramNotify(`📝 <b>มีการขอแก้ไขแบนเนอร์!</b>\n\n🏬 ร้าน: <b>${store.name}</b>\n\n👉 กรุณาตรวจสอบในหน้าแอดมินครับ`);
        alert('ส่งข้อมูลขอแก้ไขเรียบร้อย! รอแอดมินตรวจสอบการเปลี่ยนแปลงครับ (วันหมดอายุจะคงเดิม)');
        document.getElementById('editPromoImageInput').value = '';
    } catch (e) { alert('❌ ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง'); }
    finally { btn.innerText = '🔄 ส่งเรื่องขอแก้ไขข้อมูล'; btn.disabled = false; }
}
