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
