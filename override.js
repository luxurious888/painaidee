// ══════════════════════════════════════════════════════
// override.js — โหลดหลัง app.js เพื่อ replace renderUI + renderCards
// ══════════════════════════════════════════════════════

// ── renderUI: categories เป็น chip buttons ──
function renderUI() {
    const cData    = appData.categories     || [];
    const sData    = appData.services       || [];
    const mainCats = appData.mainCategories || [];

    // Category chips
    const catContainer = document.getElementById('dynamic-category-container');
    if (catContainer) {
        catContainer.innerHTML = mainCats.map((m, i) =>
            `<button class="cat-chip${i === 0 ? ' active' : ''}"
                     onclick="catChipSelect(this,'${m.id}')">
                ${m.label}
             </button>`
        ).join('');
    }

    // Promo + Service selects (หน้า Partner — ไม่เปลี่ยน)
    const pCat = document.getElementById('promoStoreCategory');
    if (pCat) {
        pCat.innerHTML = mainCats.map(m =>
            `<optgroup label="${m.label}">
                ${cData.filter(c => c.group === m.id).map(c =>
                    `<option value="${c.label}">${c.label}</option>`).join('')}
             </optgroup>`
        ).join('');
    }
    const sSel = document.getElementById('promoServiceSelect');
    if (sSel) {
        sSel.innerHTML = sData.map(s =>
            `<option value="${s.name} - ${s.price}฿">${s.name} - ${s.price}฿</option>`
        ).join('');
    }
}

function catChipSelect(btn, catId) {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (document.getElementById('searchBox')) document.getElementById('searchBox').value = '';
    executeSearch(catId);
}

// ── renderCards: clean card HTML matching mockup ──
function renderCards(keywordSearched) {
    resolveCurrentProvince();
    const list        = document.getElementById('placeList');
    const originPoint = new google.maps.LatLng(currentCoords.lat, currentCoords.lng);
    const stores      = appData.registeredStores || [];
    const now         = Date.now();

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
        const store  = stores.find(s => s.name === p.name);
        const isVIP  = !!(store?.isVIP && (!store.vipExpireTimestamp || store.vipExpireTimestamp > now || store.vipAutoRenew));
        const navUrl = `https://www.google.com/maps/search/?api=1&query=${p.geometry.location.lat()},${p.geometry.location.lng()}`;
        const distKm = window.google?.maps?.geometry
            ? (google.maps.geometry.spherical.computeDistanceBetween(originPoint, p.geometry.location) / 1000).toFixed(1)
            : '0.0';
        const safeName = p.name.replace(/'/g, "\\'");

        // ── Status ──
        let statusHtml = '';
        const cs = store?.operatingHours ? getCustomStoreStatus(store.operatingHours) : null;
        if (cs) {
            if (cs.isOpen) statusHtml = '<span class="c-open">🟢 เปิด</span>';
            else           statusHtml = '<span class="c-close">🔴 ปิด</span>';
        } else if (p.business_status === 'CLOSED_PERMANENTLY' || p.business_status === 'CLOSED_TEMPORARILY') {
            statusHtml = '<span class="c-close">🔴 ปิด</span>';
        } else if (p.opening_hours) {
            const io = typeof p.opening_hours.isOpen === 'function' ? p.opening_hours.isOpen() : p.opening_hours.open_now;
            if (io === true)  statusHtml = '<span class="c-open">🟢 เปิด</span>';
            if (io === false) statusHtml = '<span class="c-close">🔴 ปิด</span>';
        }

        // ── Image ──
        const galleryImgs = store?.gallery?.length > 0 ? store.gallery : [];
        const mainImg     = p.photos ? p.photos[0].getUrl({ maxWidth: 500 }) : '';
        const allImgs     = galleryImgs.length > 0
            ? [...galleryImgs, ...(mainImg ? [mainImg] : [])]
            : (mainImg ? [mainImg] : ['https://placehold.co/500x220/f0ede6/C85A1A?text=Painaidee']);
        const uid = p.place_id.slice(-6);

        let imgHtml = '';
        if (allImgs.length === 1) {
            imgHtml = `<img src="${allImgs[0]}" class="c-img" onclick="event.stopPropagation();openImageModal(this.src)">`;
        } else {
            imgHtml = `<div style="position:relative;overflow:hidden;">
                <div id="cs_${uid}" style="display:flex;transition:transform 0.3s;">
                    ${allImgs.map(img => `<img src="${img}" class="c-img" style="min-width:100%;" onclick="event.stopPropagation();openImageModal(this.src)">`).join('')}
                </div>
                <div class="c-slide-count" id="ci_${uid}">1/${allImgs.length} 📸</div>
                <button class="c-slide-btn" style="left:6px;" onclick="event.stopPropagation();cardSlide('${uid}',${allImgs.length},-1)">‹</button>
                <button class="c-slide-btn" style="right:6px;" onclick="event.stopPropagation();cardSlide('${uid}',${allImgs.length},1)">›</button>
            </div>`;
        }

        // ── Active deals ──
        const activeDeals = (appData.deals || []).filter(d =>
            d.storeName === p.name && d.isActive &&
            (!d.expiryDate || new Date(d.expiryDate) > new Date()) &&
            (d.maxUses === 0 || d.usedCount < d.maxUses)
        );

        // ── Tag pills ──
        let tags = '';
        if (activeDeals.length > 0)
            tags += `<span class="c-tag c-tag-deal" onclick="event.stopPropagation();showStoreDealsModal('${safeName}');">🎫 ${activeDeals.length} ดีล</span>`;
        if (store?.coupon?.trim())
            tags += `<span class="c-tag c-tag-coupon" onclick="event.stopPropagation();showCustomerDetail('coupon','${safeName}');">🎟️ คูปอง</span>`;
        if (store?.event?.trim())
            tags += `<span class="c-tag c-tag-event" onclick="event.stopPropagation();showCustomerDetail('event','${safeName}');">🎉 กิจกรรม</span>`;

        // ── Contact buttons ──
        const hasLine = !!(store?.lineUrl?.trim());
        const hasFb   = !!(store?.fbUrl?.trim());

        return `
<div class="c-card${isVIP ? ' c-vip' : ''}"
     onclick="const _b=event.composedPath().find(n=>n instanceof Element&&(n.tagName==='BUTTON'||n.classList.contains('c-tag')));if(!_b){focusPlace('${p.place_id}');trackAction('${safeName}','view');}">

  <div class="c-img-wrap">
    ${imgHtml}
    ${isVIP ? '<div class="c-badge c-badge-vip">★ VIP</div>' : ''}
    ${activeDeals.length > 0 ? `<div class="c-badge c-badge-deal">🎫 ดีล</div>` : ''}
    <div class="c-badge c-badge-dist">${distKm} กม.</div>
  </div>

  <div class="c-body">
    <div class="c-row-top">
      <div class="c-name${isVIP ? ' c-name-vip' : ''}">${p.name}</div>
      ${statusHtml}
    </div>
    <div class="c-meta">
      <span class="c-star">★ ${p.rating || 'ใหม่'}</span>
      <span class="c-dot">·</span>
      <span>${distKm} กม.</span>
      <span class="c-dot">·</span>
      <span class="c-addr">${p.vicinity}</span>
    </div>
    ${tags ? `<div class="c-tags">${tags}</div>` : ''}
    <div class="c-btns">
      <button class="c-btn c-btn-nav" onclick="event.stopPropagation();window.open('${navUrl}','_blank');trackAction('${safeName}','dir');">🗺️ นำทาง</button>
      <button class="c-btn c-btn-sec" onclick="event.stopPropagation();callPlace('${p.place_id}',event);">📞 โทร</button>
      ${hasLine ? `<button class="c-btn c-btn-line" onclick="event.stopPropagation();window.open('${store.lineUrl.startsWith('http')?store.lineUrl:'https://'+store.lineUrl}','_blank');">LINE</button>` : ''}
      ${hasFb   ? `<button class="c-btn c-btn-fb"   onclick="event.stopPropagation();window.open('${store.fbUrl.startsWith('http')?store.fbUrl:'https://'+store.fbUrl}','_blank');">FB</button>` : ''}
      <button class="c-btn c-btn-sec" onclick="event.stopPropagation();sharePlace('${safeName}',${p.geometry.location.lat()},${p.geometry.location.lng()},event);">แชร์</button>
      <button class="c-btn c-btn-report" onclick="event.stopPropagation();reportClosed('${p.place_id}');" data-pid="${p.place_id}">🚩</button>
    </div>
  </div>
</div>`;
    }).join('');

    if (currentPagination?.hasNextPage && googlePlaces.length < 80)
        html += `<div style="text-align:center;padding:8px 0;">
            <button class="c-btn c-btn-nav" style="width:180px;"
                    onclick="this.textContent='โหลด...';currentPagination.nextPage()">
                ⬇️ ดูเพิ่มเติม
            </button></div>`;

    list.innerHTML = html;
    renderPromos();
    refreshVIPMarkers();
}

// cardSlide ใช้ id prefix cs_ แทน gslide_
function cardSlide(uid, total, dir) {
    const track = document.getElementById('cs_' + uid);
    const indEl = document.getElementById('ci_'  + uid);
    if (!track) return;
    const cur  = parseInt(track.dataset.cur || '0');
    const next = (cur + dir + total) % total;
    track.dataset.cur     = next;
    track.style.transform = `translateX(-${next * 100}%)`;
    if (indEl) indEl.textContent = `${next + 1}/${total} 📸`;
}
