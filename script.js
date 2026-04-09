/**
 * โปรเจกต์: ไปไหนดี (Painaidee)
 * ไฟล์: JavaScript สำหรับจัดการแผนที่และดึงข้อมูลร้านค้า
 */

let map;
let service;
let infowindow;
let allPlaces = []; // ตัวแปรหลักสำหรับเก็บข้อมูลร้านทั้งหมดเพื่อใช้ทำระบบค้นหา (Search)

/**
 * 1. ฟังก์ชันเริ่มต้นแผนที่ (จะถูกเรียกใช้อัตโนมัติเมื่อ Google Maps API โหลดเสร็จ)
 */
function initMap() {
    // พิกัดเริ่มต้น: ตัวเมืองอุบลราชธานี
    const centerCoord = new google.maps.LatLng(15.2287, 104.8564);

    // สร้างแผนที่ไปใส่ใน <div id="map">
    map = new google.maps.Map(document.getElementById("map"), {
        center: centerCoord,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false // ปิดปุ่ม Street View ให้หน้าจอไม่รก
    });

    // ตั้งค่าคำขอข้อมูล (ค้นหาร้านอาหาร, บาร์, คาเฟ่ ในรัศมี 3 กม.)
    const request = {
        location: centerCoord,
        radius: '3000', 
        type: ['restaurant', 'bar', 'cafe']
    };

    infowindow = new google.maps.InfoWindow();
    service = new google.maps.places.PlacesService(map);
    
    // ส่งคำขอไปที่ Google Maps API
    service.nearbySearch(request, callback);
}

/**
 * 2. ฟังก์ชัน Callback เมื่อได้รับข้อมูลกลับมาจาก Google
 */
function callback(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
        allPlaces = results; // เก็บข้อมูลไว้ในตัวแปรหลักสำหรับ Search
        renderPlaces(results); // วาดการ์ดแสดงผล
        
        // ปักหมุดทุกร้านลงแผนที่
        for (let i = 0; i < results.length; i++) {
            createMarker(results[i]);
        }
    } else {
        console.error("Google Places Error:", status);
        const listDiv = document.getElementById('placeList');
        if (listDiv) {
            listDiv.innerHTML = '<p style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลสถานที่ได้ กรุณาลองใหม่</p>';
        }
    }
}

/**
 * 3. ฟังก์ชันสร้างการ์ดรายการ (Card) แสดงผลด้านล่างแผนที่
 */
function renderPlaces(places) {
    const listDiv = document.getElementById('placeList');
    if (!listDiv) return;

    if (places.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:#888;">ไม่พบสถานที่ที่ค้นหา...</p>';
        return;
    }

    // สร้าง HTML การ์ดจากข้อมูลที่ได้มา
    listDiv.innerHTML = places.map(p => {
        // ดึงรูป ถ้าไม่มีให้ใช้รูป Placeholder 
        const photoUrl = p.photos ? p.photos[0].getUrl({ maxWidth: 400, maxHeight: 250 }) : 'https://via.placeholder.com/400x180?text=Painaidee';
        
        // แยกประเภทป้ายกำกับ
        const isBar = p.types.includes('bar') || p.types.includes('night_club');
        const tagLabel = isBar ? '🍺 ร้านนั่งชิลล์' : '🍽️ ร้านอาหาร/คาเฟ่';

        // ผูกฟังก์ชัน onclick="focusMap(...)" ไว้ที่การ์ดแต่ละใบ
        return `
            <div class="card" onclick="focusMap(${p.geometry.location.lat()}, ${p.geometry.location.lng()})">
                <img src="${photoUrl}" alt="${p.name}">
                <div class="card-info">
                    <h3>${p.name}</h3>
                    <p class="rating">⭐ ${p.rating || 'ยังไม่มีคะแนน'} (${p.user_ratings_total || 0} รีวิว)</p>
                    <p>📍 ${p.vicinity}</p>
                    <span class="tag">${tagLabel}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 4. ฟังก์ชันสร้างหมุด (Marker) บนแผนที่
 */
function createMarker(place) {
    const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name
    });

    // เมื่อกดที่หมุดแล้วให้ขึ้นหน้าต่างป๊อปอัปชื่อร้าน
    google.maps.event.addListener(marker, "click", () => {
        infowindow.setContent(`<div style="padding:5px;"><strong>${place.name}</strong><br>${place.vicinity}</div>`);
        infowindow.open(map, marker);
    });
}

/**
 * 5. ฟังก์ชันเลื่อนและซูมแผนที่ (เรียกใช้เมื่อผู้ใช้กดที่การ์ดรายการ)
 */
function focusMap(lat, lng) {
    const newPos = new google.maps.LatLng(lat, lng);
    map.panTo(newPos); // เลื่อนแผนที่ไปที่พิกัดนั้น
    map.setZoom(17);   // ซูมเข้าไปใกล้ๆ
    
    // เลื่อนหน้าจอเบราว์เซอร์กลับขึ้นไปดูแผนที่ด้านบนสุดแบบนุ่มนวล
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 6. ฟังก์ชันค้นหาร้าน (Search / Filter)
 * ใช้ผูกกับช่อง Input บนหน้าเว็บ เช่น onkeyup="searchPlace(this.value)"
 */
function searchPlace(keyword) {
    if (!keyword || keyword.trim() === "") {
        // ถ้าไม่ได้พิมพ์อะไร ให้โชว์ร้านทั้งหมด
        renderPlaces(allPlaces); 
        return;
    }
    
    const lowerKeyword = keyword.toLowerCase();
    
    // กรองเอาร้านที่มีชื่อหรือที่อยู่ตรงกับคำที่พิมพ์
    const filteredPlaces = allPlaces.filter(p => 
        p.name.toLowerCase().includes(lowerKeyword) || 
        p.vicinity.toLowerCase().includes(lowerKeyword) 
    );
    
    renderPlaces(filteredPlaces); 
}
