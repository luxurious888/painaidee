// ข้อมูลจำลอง (Mock Data)
const places = [
    { id: 1, name: "G2 Snooker", type: "Sport", img: "https://via.placeholder.com/300x180", desc: "สนุกเกอร์คลับระดับพรีเมียมในอุบล" },
    { id: 2, name: "Larn Sook Camp", type: "Camping", img: "https://via.placeholder.com/300x180", desc: "ลานกางเต็นท์ บรรยากาศดี ดนตรีสด" },
    { id: 3, name: "AutoGlow Ubon", type: "Service", img: "https://via.placeholder.com/300x180", desc: "ศูนย์ดูแลรถยนต์ครบวงจร" },
    { id: 4, name: "Master Maid", type: "Service", img: "https://via.placeholder.com/300x180", desc: "บริการทำความสะอาดมืออาชีพ" }
];

const placeList = document.getElementById('placeList');
const searchInput = document.getElementById('searchInput');

// ฟังก์ชันแสดงผลการ์ด
function displayPlaces(data) {
    placeList.innerHTML = data.map(place => `
        <div class="card">
            <img src="${place.img}" alt="${place.name}">
            <div class="card-content">
                <h3>${place.name}</h3>
                <span class="tag">${place.type}</span>
                <p>${place.desc}</p>
            </div>
        </div>
    `).join('');
}

// ระบบค้นหา
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = places.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.type.toLowerCase().includes(term)
    );
    displayPlaces(filtered);
});

// รันครั้งแรก
displayPlaces(places);
// 1. ข้อมูลสถานที่
const places = [
  { id: 1, name: "G2 Snooker", type: "Sport", image: "g2.jpg", desc: "สนุกเกอร์คลับพรีเมียม" },
  { id: 2, name: "Larn Sook Camp", type: "Camping", image: "camp.jpg", desc: "ลานกางเต็นท์บรรยากาศดี" },
  { id: 3, name: "AutoGlow Ubon", type: "Service", image: "car.jpg", desc: "ศูนย์เคลือบแก้วรถยนต์" }
];

// 2. ฟังก์ชันสำหรับสร้างการ์ดสถานที่
function displayPlaces() {
    const placeList = document.getElementById('placeList');
    
    placeList.innerHTML = places.map(place => `
        <div class="card">
            <img src="${place.image}" alt="${place.name}" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">
            <div class="card-content">
                <h3>${place.name}</h3>
                <span class="tag">${place.type}</span>
                <p>${place.desc}</p>
            </div>
        </div>
    `).join('');
}

// 3. สั่งให้ทำงานทันทีที่เปิดหน้าเว็บ
displayPlaces();
