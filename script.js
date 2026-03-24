/**
 * โปรเจกต์: ไปไหนดี (Painaidee)
 * ฟังก์ชัน: ดึงข้อมูลร้านอาหาร/ร้านนั่งชิลล์ จาก Google Maps API
 */

let map;
let service;
let infowindow;
let allPlaces = []; // เก็บข้อมูลร้านทั้งหมดที่ดึงมาได้เพื่อใช้ในการค้นหา (Search)

/**
 * 1. ฟังก์ชันเริ่มต้นแผนที่
 */
function initMap() {
    // กำหนดพิกัดเริ่มต้น (ตัวอย่าง: ตัวเมืองอุบลราชธานี)
    const ubonCoord = new google.maps.LatLng(15.2287, 104.8564);

    // สร้างแผนที่
    map = new google.maps.Map(document.getElementById("map"), {
        center: ubonCoord,
        zoom: 15,
        mapTypeControl: false // ปิดปุ่มเปลี่ยนประเภทแผนที่เพื่อความสะอาด
    });

    // ตั้งค่าคำขอข้อมูล (ค้นหาร้านอาหาร, บาร์, คาเฟ่ ในรัศมี 3 กม.)
    const request = {
        location: ubonCoord,
        radius: '3000', 
        type: ['restaurant', 'bar', 'cafe']
    };

    infowindow = new google.maps.InfoWindow();
    service = new google.maps.places.PlacesService(map);
    
    // เรียกใช้คำขอค้นหาสถานที่รอบข้าง
    service.nearbySearch(request, callback);
}

/**
 * 2. ฟังก์ชัน Callback เมื่อได้รับข้อมูลจาก Google
 */
function callback(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
        allPlaces = results; // บันทึกข้อมูลเข้าตัวแปรหลัก
        renderPlaces(results); // แสดงผลรายการการ์ด
        
        // ปักหมุด (Marker) ทุกร้านลงบนแผนที่
        for (let i = 0; i < results.length; i++) {
            createMarker(results[i]);
        }
    } else {
        console.error("Google Places Service Error:", status);
    }
}

/**
 * 3. ฟังก์ชันสร้างการ์ดรายการ (Card) แสดงผลด้านล่างแผนที่
 */
function renderPlaces(places) {
    const listDiv = document.getElementById('placeList');
    if (!listDiv) return;

    if (places.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; width:100%;">ไม่พบสถานที่ที่ระบุ...</p>';
        return;
    }

    listDiv.innerHTML = places.map(p => {
        // ดึงรูปภาพ (ถ้าไม่มีให้ใช้รูปสำรอง)
        const photoUrl = p.photos ? p.photos[0].getUrl({ maxWidth: 400, maxHeight: 250 }) : 'https://via.placeholder.com/300x180?text=No+Image';
        
        // เช็กว่าเป็นร้านประเภทไหน (นั่งชิลล์ หรือ ร้านอาหาร)
        const isBar = p.types.includes('bar') || p.types.includes('night_club');
        const tagLabel = isBar ? '🍺 ร้านนั่งชิลล์' : '🍽️ ร้านอาหาร/คาเฟ่';

        return `
            <div class="card" onclick="focusMap(${p.geometry.location.lat()}, ${p.geometry.location.lng()})">
                <img src="${photoUrl}" alt="${p.name}">
                <div class="card-info">
                    <h3>${p.name}</h3>
                    <p class="rating">⭐ ${p.rating || 'N/A'} (${p.user_ratings_total || 0} รีวิว)</p>
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

    // เมื่อคลิกที่หมุด ให้แสดงชื่อร้าน
    google.maps.event.addListener(marker, "click", () => {
        infowindow.setContent(`<strong>${place.name}</strong><br>${place.vicinity}`);
        infow
