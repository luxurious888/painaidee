// override.js v226 — clean, no circular refs
// โหลดหลัง app.js — override renderUI, renderCards, เพิ่ม Bottom Nav

// ══════════════════════════════════════════
// 1. BOTTOM NAV
// ══════════════════════════════════════════
function showBottomNav() {
    const bn = document.getElementById('bottom-nav');
    if (bn) bn.style.display = 'flex';
}

function bnSwitch(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bn').forEach(b => {
        b.classList.remove('active');
        const dot = b.querySelector('.bn-dot');
        const lb  = b.querySelector('.bn-lb');
        if (dot) dot.style.display = 'none';
        if (lb)  lb.style.color = '#bbb';
    });

    const pageEl = document.getElementById('page-' + page);
    const bnEl   = document.getElementById('bn-' + page);

    if (page === 'map') {
        if (pageEl) pageEl.classList.add('active');
        if (bnEl) { bnEl.classList.add('active'); bnEl.querySelector('.bn-dot').style.display='block'; bnEl.querySelector('.bn-lb').style.color='#C85A1A'; }
        setTimeout(() => {
            if (typeof map !== 'undefined' && map && window.google) {
                google.maps.event.trigger(map, 'resize');
                if (typeof currentCoords !== 'undefined') map.setCenter(currentCoords);
            }
        }, 100);
        renderMapHCards();
        return;
    }
    if (page === 'deal') {
        document.getElementById('page-home')?.classList.add('active');
        const bnh = document.getElementById('bn-home');
        if (bnh) { bnh.classList.add('active'); bnh.querySelector('.bn-dot').style.display='block'; bnh.querySelector('.bn-lb').style.color='#C85A1A'; }
        openMyRewards();
        return;
    }
    if (page === 'affiliate') {
        if (pageEl) { pageEl.classList.add('active'); window.scrollTo(0,0); }
        if (bnEl)   { bnEl.classList.add('active'); bnEl.querySelector('.bn-dot').style.display='block'; bnEl.querySelector('.bn-lb').style.color='#C85A1A'; }
        return;
    }
    if (page === 'partner') {
        if (pageEl) { pageEl.classList.add('active'); window.scrollTo(0,0); }
        if (bnEl)   { bnEl.classList.add('active'); bnEl.querySelector('.bn-dot').style.display='block'; bnEl.querySelector('.bn-lb').style.color='#C85A1A'; }
        return;
    }
    // default: home
    document.getElementById('page-home')?.classList.add('active');
    const bnh = document.getElementById('bn-home');
    if (bnh) { bnh.classList.add('active'); bnh.querySelector('.bn-dot').style.display='block'; bnh.querySelector('.bn-lb').style.color='#C85A1A'; }
    window.scrollTo(0,0);
}

// ══════════════════════════════════════════
// 2. HOOK enterApp / liff login → show bottom nav
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // watch appContent visibility
    const ac = document.getElementById('appContent');
    if (ac) {
        const obs = new MutationObserver(() => {
            if (ac.style.display !== 'none' && ac.style.display !== '') showBottomNav();
        });
        obs.observe(ac, { attributes: true, attributeFilter: ['style'] });
    }
});

// patch enterApp
window.addEventListener('load', () => {
    const origEnter = window.enterApp;
    if (origEnter) {
        window.enterApp = function() {
            origEnter();
            showBottomNav();
        };
    }
    const origNavAff = window.navigateToAffiliate;
    if (origNavAff) {
        window.navigateToAffiliate = function() { bnSwitch('affiliate'); };
    }
    const origNavPart = window.navigateToPartner;
    if (origNavPart) {
        window.navigateToPartner = function() { bnSwitch('partner'); };
    }
});

// ══════════════════════════════════════════
// 3. renderUI — chips แทน select
// ══════════════════════════════════════════
function renderUI() {
    const cData    = appData.categories     || [];
    const sData    = appData.services       || [];
    const mainCats = appData.mainCategories || [];

    const catEl = document.getElementById('dynamic-category-container');
    if (catEl) {
        catEl.innerHTML = mainCats.map((m, i) =>
            `<button class="cat-chip${i===0?' active':''}" onclick="catChipSelect(this,'${m.id}')">${m.label}</button>`
        ).join('');
    }
    const pCat = document.getElementById('promoStoreCategory');
    if (pCat) pCat.innerHTML = mainCats.map(m => `<optgroup label="${m.label}">${cData.filter(c=>c.group===m.id).map(c=>`<option value="${c.label}">${c.label}</option>`).join('')}</optgroup>`).join('');
    const sSel = document.getElementById('promoServiceSelect');
    if (sSel) sSel.innerHTML = sData.map(s=>`<option value="${s.name} - ${s.price}฿">${s.name} - ${s.price}฿</option>`).join('');
}

function catChipSelect(btn, catId) {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sb = document.getElementById('searchBox');
    if (sb) sb.value = '';
    executeSearch(catId);
}

// ══════════════════════════════════════════
// 4. renderCards — card ใหม่ทั้งหมด
// ══════════════════════════════════════════
function renderCards(keywordSearched) {
    try { resolveCurrentProvince(); } catch(e) {}

    const list = document.getElementById('placeList');
    if (!list) return;

    const stores      = (typeof appData !== 'undefined' ? appData.registeredStores : null) || [];
    const allDeals    = (typeof appData !== 'undefined' ? appData.deals : null) || [];
    const now         = Date.now();
    const places      = googlePlaces || [];

    if (places.length === 0) {
        list.innerHTML = '<p style="text-align:center;padding:40px;color:#888;">ไม่พบร้านอาหารในบริเวณนี้</p>';
        return;
    }

    let originPoint = null;
    try {
        if (window.google?.maps?.geometry && currentCoords)
            originPoint = new google.maps.LatLng(currentCoords.lat, currentCoords.lng);
    } catch(e) {}

    const getDist = (p) => {
        if (!originPoint || !window.google?.maps?.geometry) return 0;
        try { return google.maps.geometry.spherical.computeDistanceBetween(originPoint, p.geometry.location); }
        catch(e) { return 0; }
    };

    const sorted = [...places].sort((a, b) => {
        const vA = stores.find(s => s.name === a.name)?.isVIP ? 1 : 0;
        const vB = stores.find(s => s.name === b.name)?.isVIP ? 1 : 0;
        if (vA !== vB) return vB - vA;
        return getDist(a) - getDist(b);
    });

    const html = sorted.slice(0, 80).map(p => {
        const store    = stores.find(s => s.name === p.name);
        const isVIP    = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        const distM    = getDist(p);
        const distKm   = distM > 0 ? (distM / 1000).toFixed(1) : '–';
        const safeName = p.name.replace(/'/g, "\\'");
        const navUrl   = `https://www.google.com/maps/search/?api=1&query=${p.geometry.location.lat()},${p.geometry.location.lng()}`;
        const hasLine  = !!(store?.lineUrl?.trim());
        const hasFb    = !!(store?.fbUrl?.trim());

        // ── สถานะ ──
        let statusHtml = '';
        try {
            const cs = store?.operatingHours ? getCustomStoreStatus(store.operatingHours) : null;
            if (cs) {
                statusHtml = cs.isOpen ? '<span class="c-open">🟢 เปิด</span>' : '<span class="c-close">🔴 ปิด</span>';
            } else if (p.opening_hours) {
                const io = typeof p.opening_hours.isOpen === 'function' ? p.opening_hours.isOpen() : p.opening_hours.open_now;
                if (io === true)  statusHtml = '<span class="c-open">🟢 เปิด</span>';
                if (io === false) statusHtml = '<span class="c-close">🔴 ปิด</span>';
            }
        } catch(e) {}

        // ── รูปภาพ ──
        const galleryImgs = store?.gallery?.length > 0 ? store.gallery : [];
        let mainImg = '';
        try { mainImg = p.photos ? p.photos[0].getUrl({ maxWidth: 500 }) : ''; } catch(e) {}
        const allImgs = galleryImgs.length > 0
            ? [...galleryImgs, ...(mainImg ? [mainImg] : [])]
            : (mainImg ? [mainImg] : ['https://placehold.co/500x200/f0ede6/C85A1A?text=Painaidee']);
        const uid = p.place_id.slice(-6);

        let imgHtml = '';
        if (allImgs.length === 1) {
            imgHtml = `<img src="${allImgs[0]}" class="c-img" onclick="event.stopPropagation();openImageModal(this.src)">`;
        } else {
            imgHtml = `<div style="position:relative;overflow:hidden;">
                <div id="cs_${uid}" style="display:flex;transition:transform .3s;height:170px;">
                    ${allImgs.map(img=>`<img src="${img}" style="min-width:100%;height:170px;object-fit:cover;" onclick="event.stopPropagation();openImageModal(this.src)">`).join('')}
                </div>
                <div class="c-slide-count" id="ci_${uid}">1/${allImgs.length} 📸</div>
                <button class="c-slide-btn" style="left:6px;" onclick="event.stopPropagation();cSlide('${uid}',${allImgs.length},-1)">‹</button>
                <button class="c-slide-btn" style="right:6px;" onclick="event.stopPropagation();cSlide('${uid}',${allImgs.length},1)">›</button>
            </div>`;
        }

        // ── Tags ──
        const activeDeals = allDeals.filter(d =>
            d.storeName === p.name && d.isActive &&
            (!d.expiryDate || new Date(d.expiryDate) > new Date()) &&
            (d.maxUses === 0 || d.usedCount < d.maxUses)
        );
        let tags = '';
        if (activeDeals.length > 0) tags += `<span class="c-tag c-tag-deal" onclick="event.stopPropagation();showStoreDealsModal('${safeName}');">🎫 ${activeDeals.length} ดีล</span>`;
        if (store?.coupon?.trim()) tags += `<span class="c-tag c-tag-coupon" onclick="event.stopPropagation();showCustomerDetail('coupon','${safeName}');">🎟️ คูปอง</span>`;
        if (store?.event?.trim())  tags += `<span class="c-tag c-tag-event" onclick="event.stopPropagation();showCustomerDetail('event','${safeName}');">🎉 กิจกรรม</span>`;

        return `
<div class="c-card${isVIP?' c-vip':''}"
     onclick="const _b=event.composedPath().find(n=>n instanceof Element&&(n.tagName==='BUTTON'||n.classList.contains('c-tag')));if(!_b){focusPlace('${p.place_id}');trackAction('${safeName}','view');}">
  <div class="c-img-wrap">
    ${imgHtml}
    ${isVIP?'<div class="c-badge c-badge-vip">★ VIP</div>':''}
    ${activeDeals.length>0?`<div class="c-badge c-badge-deal">🎫 ดีล</div>`:''}
    <div class="c-badge c-badge-dist">${distKm} กม.</div>
  </div>
  <div class="c-body">
    <div class="c-row-top">
      <div class="c-name${isVIP?' c-name-vip':''}">${p.name}</div>
      ${statusHtml}
    </div>
    <div class="c-meta">
      <span class="c-star">★ ${p.rating||'ใหม่'}</span>
      <span class="c-dot">·</span>
      <span>${distKm} กม.</span>
      <span class="c-dot">·</span>
      <span class="c-addr">${p.vicinity||''}</span>
    </div>
    ${tags?`<div class="c-tags">${tags}</div>`:''}
    <div class="c-btns">
      <button class="c-btn c-btn-nav" onclick="event.stopPropagation();window.open('${navUrl}','_blank');trackAction('${safeName}','dir');">🗺️ นำทาง</button>
      <button class="c-btn c-btn-sec" onclick="event.stopPropagation();callPlace('${p.place_id}',event);">📞 โทร</button>
      ${hasLine?`<button class="c-btn c-btn-line" onclick="event.stopPropagation();window.open('${store.lineUrl.startsWith('http')?store.lineUrl:'https://'+store.lineUrl}','_blank');">LINE</button>`:''}
      ${hasFb?`<button class="c-btn c-btn-fb" onclick="event.stopPropagation();window.open('${store.fbUrl.startsWith('http')?store.fbUrl:'https://'+store.fbUrl}','_blank');">FB</button>`:''}
      <button class="c-btn c-btn-sec" onclick="event.stopPropagation();sharePlace('${safeName}',${p.geometry.location.lat()},${p.geometry.location.lng()},event);">แชร์</button>
      <button class="c-btn c-btn-report" onclick="event.stopPropagation();reportClosed('${p.place_id}');" data-pid="${p.place_id}">🚩</button>
    </div>
  </div>
</div>`;
    }).join('');

    let extra = '';
    if (typeof currentPagination !== 'undefined' && currentPagination?.hasNextPage && places.length < 80)
        extra = `<div style="text-align:center;padding:8px 0;"><button class="c-btn c-btn-nav" style="width:180px;" onclick="this.textContent='กำลังโหลด...';currentPagination.nextPage()">⬇️ ดูเพิ่มเติม</button></div>`;

    list.innerHTML = html + extra;

    try { renderPromos(); } catch(e) {}
    try { refreshVIPMarkers(); } catch(e) {}
    renderMapHCards();
}

// ── image slider ──
function cSlide(uid, total, dir) {
    const track = document.getElementById('cs_' + uid);
    const ind   = document.getElementById('ci_'  + uid);
    if (!track) return;
    const cur  = parseInt(track.dataset.cur || '0');
    const next = (cur + dir + total) % total;
    track.dataset.cur     = next;
    track.style.transform = `translateX(-${next * 100}%)`;
    if (ind) ind.textContent = `${next+1}/${total} 📸`;
}

// ══════════════════════════════════════════
// 5. MAP PAGE horizontal cards
// ══════════════════════════════════════════
function renderMapHCards() {
    const container = document.getElementById('map-h-cards');
    const countEl   = document.getElementById('map-store-count');
    if (!container) return;
    const places = googlePlaces || [];
    if (countEl) countEl.textContent = places.length;
    if (places.length === 0) {
        container.innerHTML = '<p style="color:#bbb;font-size:13px;padding:10px 0;">ค้นหาร้านบนหน้าแรกก่อนนะครับ 🔍</p>';
        return;
    }
    const stores = (typeof appData !== 'undefined' ? appData.registeredStores : null) || [];
    const now    = Date.now();
    let originPoint = null;
    try { if (window.google?.maps?.geometry && currentCoords) originPoint = new google.maps.LatLng(currentCoords.lat, currentCoords.lng); } catch(e) {}

    container.innerHTML = places.slice(0, 20).map(p => {
        const store  = stores.find(s => s.name === p.name);
        const isVIP  = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        const galleryImg = store?.gallery?.[0] || '';
        let mainImg = '';
        try { mainImg = p.photos ? p.photos[0].getUrl({ maxWidth: 300 }) : ''; } catch(e) {}
        const imgSrc = galleryImg || mainImg;
        let distKm = '';
        try {
            if (originPoint && window.google?.maps?.geometry)
                distKm = (google.maps.geometry.spherical.computeDistanceBetween(originPoint, p.geometry.location)/1000).toFixed(1) + ' กม.';
        } catch(e) {}
        return `<div class="h-card${isVIP?' h-card-vip':''}" onclick="focusPlace('${p.place_id}');trackAction('${p.name.replace(/'/g,"\\'")}','view');">
  <div class="h-card-img">${imgSrc?`<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover;">`:'<span style="font-size:28px;">🍽️</span>'}</div>
  <div class="h-card-body">
    <div class="h-card-name">${p.name}</div>
    <div class="h-card-meta"><span class="s">★ ${p.rating||'ใหม่'}</span>${distKm?' · '+distKm:''}${isVIP?' · <span style="color:#F59C3A;font-size:10px;font-weight:700;">VIP</span>':''}</div>
  </div>
</div>`;
    }).join('');
}
