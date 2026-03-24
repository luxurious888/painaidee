// 1. ข้อมูลสถานที่ (รวมเป็นชุดเดียว)
const places = [
    { id: 1, name: "G2 Snooker", type: "Sport", image: "g2.jpg", desc: "สนุกเกอร์คลับระดับพรีเมียมในอุบล" },
    { id: 2, name: "Larn Sook Camp", type: "Camping", image: "camp.jpg", desc: "ลานกางเต็นท์ บรรยากาศดี ดนตรีสด" },
    { id: 3, name: "AutoGlow Ubon", type: "Service", image: "car.jpg", desc: "ศูนย์ดูแลรถยนต์ครบวงจร" },
    { id: 4, name: "Master Maid", type: "Service", image: "https://via.placeholder.com/300x180?text=Master+Maid", desc: "บริการทำความสะอาดมืออาชีพ" }
];

// ดึง Element จาก HTML
const placeList = document.getElementById('placeList');
const searchInput = document.getElementById('searchInput');

// 2. ฟังก์ชันแสดงผลการ์ด (ใส่ data เข้าไปเพื่อให้กรองข้อมูลได้)
function displayPlaces(dataToShow) {
    if (!placeList) return; // กัน Error ถ้าหา Element ไม่เจอ

    placeList.innerHTML = dataToShow.map(place => `
        <div class="card">
            <img src="${place.image || place.img}" alt="${place.name}" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">
            <div class="card-content">
                <h3>${place.name}</h3>
                <span class="tag">${place.type}</span>
                <p>${place.desc}</p>
            </div>
        </div>
    `).join('');
}

// 3. ระบบค้นหา (กรองจากชื่อ หรือ ประเภท)
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = places.filter(p => 
            p.name.toLowerCase().includes(term) || 
            p.type.toLowerCase().includes(term)
        );
        displayPlaces(filtered);
    });
}

// 4. สั่งให้แสดงผลครั้งแรกทันทีที่โหลดหน้าเว็บ
displayPlaces(places);
