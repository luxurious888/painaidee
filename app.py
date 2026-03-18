import streamlit as st
from streamlit_js_eval import get_geolocation
import googlemaps
import folium
from streamlit_folium import st_folium
import pandas as pd
from streamlit_gsheets import GSheetsConnection
from datetime import datetime

# --- 1. การตั้งค่าหน้าเว็บ (Config) ---
st.set_page_config(
    page_title="ไปไหนดี? | แนะนำร้านอาหารใกล้คุณ", 
    layout="wide", 
    page_icon="📍"
)

# ส่วนการดึงข้อมูลจาก Secrets (.streamlit/secrets.toml)
try:
    GOOGLE_API_KEY = st.secrets["G_MAPS_API_KEY"]
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    # เชื่อมต่อ Google Sheets (ใช้ URL จาก secrets)
    conn = st.connection("gsheets", type=GSheetsConnection)
except Exception as e:
    st.error("⚠️ ตรวจสอบการตั้งค่า Secrets (API Key หรือ Google Sheets URL) ให้ถูกต้อง")
    st.stop()

# --- 2. ฟังก์ชันจัดการข้อมูล (Functions) ---

def get_google_shops(lat, lng, radius_km, keyword):
    """ดึงข้อมูลร้านจาก Google Places API"""
    try:
        res = gmaps.places_nearby(
            location=(lat, lng),
            radius=radius_km * 1000,
            keyword=keyword,
            type='restaurant',
            language='th'
        )
        return res.get('results', [])
    except:
        return []

def get_premium_shops(province, category):
    """ดึงร้านพรีเมียมจาก Google Sheets"""
    try:
        # อ่านข้อมูลจาก Sheet1
        df = conn.read(worksheet="Sheet1")
        # กรองร้าน: ต้องเป็น Premium + จังหวัดตรง + หมวดหมู่ตรง
        premium = df[
            (df['IsPremium'].astype(str).str.upper() == 'TRUE') & 
            (df['Province'] == province) & 
            (df['Category'] == category)
        ]
        return premium.to_dict('records')
    except Exception as e:
        return []

# --- 3. ส่วนควบคุมด้านข้าง (Sidebar) ---
with st.sidebar:
    st.title("📍 ไปไหนดี?")
    st.write("แพลตฟอร์มค้นหาร้านอาหารเด็ด")
    menu = st.radio("เลือกหน้าบริการ", ["🔍 ค้นหาร้านอาหาร", "🏪 ลงทะเบียนเจ้าของร้าน"])
    
    st.divider()
    if menu == "🔍 ค้นหาร้านอาหาร":
        st.subheader("⚙️ ตัวกรอง")
        sel_province = st.selectbox("จังหวัดที่ต้องการ", ["อุบลราชธานี", "กรุงเทพฯ", "เชียงใหม่", "ขอนแก่น"])
        sel_category = st.selectbox("ประเภทอาหาร", ["หมูกระทะ", "แจ่วฮ้อน", "ชาบู", "ภัตตาคาร", "จัดเลี้ยง"])
        sel_radius = st.slider("รัศมีค้นหา (กิโลเมตร)", 1, 30, 5)

# --- 4. หน้าแรก: ค้นหาและแสดงผล (Search Page) ---
if menu == "🔍 ค้นหาร้านอาหาร":
    st.header(f"🔎 กำลังดูร้าน: {sel_category} ({sel_province})")
    
    # ดึงพิกัดจาก Browser ผู้ใช้
    location = get_geolocation()
    
    if location:
        u_lat = location['coords']['latitude']
        u_lng = location['coords']['longitude']
        
        # --- [SECTION A] ร้านแนะนำ (Premium Ads) ---
        st.subheader("✨ ร้านแนะนำพิเศษ (Top 3)")
        ads = get_premium_shops(sel_province, sel_category)
        
        if ads:
            cols = st.columns(len(ads[:3]))
            for i, shop in enumerate(ads[:3]):
                with cols[i]:
                    st.success(f"🏆 {shop['ShopName']}")
                    st.write(f"📞 เบอร์โทร: {shop['Phone']}")
                    if str(shop['LineID']) != 'nan':
                        st.link_button(f"🟢 แอดไลน์ {shop['ShopName']}", f"https://line.me/R/ti/p/~{shop['LineID']}")
        else:
            st.info("ยังไม่มีร้านแนะนำในพื้นที่นี้ (เจ้าของร้านสมัครได้ที่เมนูซ้ายมือ)")

        st.divider()

        # --- [SECTION B] แผนที่และร้านทั่วไป (Google Maps) ---
        st.subheader("🗺️ ร้านค้าใกล้เคียงรอบตัวคุณ")
        g_shops = get_google_shops(u_lat, u_lng, sel_radius, sel_category)
        
        # วาดแผนที่
        m = folium.Map(location=[u_lat, u_lng], zoom_start=14)
        folium.Marker([u_lat, u_lng], popup="ตำแหน่งของคุณ", icon=folium.Icon(color='red', icon='user', prefix='fa')).add_to(m)
        
        for s in g_shops:
            folium.Marker(
                [s['geometry']['location']['lat'], s['geometry']['location']['lng']],
                popup=s['name'],
                icon=folium.Icon(color='blue', icon='utensils', prefix='fa')
            ).add_to(m)
        
        st_folium(m, width="100%", height=450)

        # แสดงรายการร้าน Google พร้อมข้อมูลติดต่อพื้นฐาน
        for s in g_shops[:10]:
            with st.expander(f"🔹 {s['name']} (⭐ {s.get('rating', 'N/A')})"):
                st.write(f"📍 ที่ตั้ง: {s.get('vicinity', 'ไม่ระบุ')}")
                # ลิงก์นำทาง
                nav_url = f"https://www.google.com/maps/dir/?api=1&destination={s['geometry']['location']['lat']},{s['geometry']['location']['lng']}"
                st.link_button("🚀 นำทางไปยังร้าน", nav_url)
    else:
        st.warning("⚠️ กรุณากดปุ่ม 'Allow' เพื่อให้แอปเข้าถึงตำแหน่งของคุณ")

# --- 5. หน้าลงทะเบียน (Registration Page) ---
elif menu == "🏪 ลงทะเบียนเจ้าของร้าน":
    st.header("🏪 ลงทะเบียนร้านค้าเข้าสู่ระบบ")
    st.write("กรอกข้อมูลติดต่อเพื่อให้ลูกค้าค้นหาคุณเจอได้ง่ายขึ้น")
    
    with st.form("reg_form", clear_on_submit=True):
        f_name = st.text_input("ชื่อร้านอาหาร*")
        f_cat = st.selectbox("ประเภทอาหาร*", ["หมูกระทะ", "แจ่วฮ้อน", "ชาบู", "ภัตตาคาร", "จัดเลี้ยง"])
        f_phone = st.text_input("เบอร์โทรศัพท์ร้าน*")
        f_line = st.text_input("Line ID (ถ้ามี)")
        f_prov = st.selectbox("จังหวัด*", ["อุบลราชธานี", "กรุงเทพฯ", "เชียงใหม่", "ขอนแก่น"])
        f_ad = st.checkbox("สนใจเช่าพื้นที่โฆษณาอันดับ 1-3")
        
        submit_btn = st.form_submit_button("บันทึกข้อมูลและส่งให้ Admin")
        
        if submit_btn:
            if f_name and f_phone:
                # บันทึกข้อมูลใหม่ลง DataFrame
                new_entry = pd.DataFrame([{
                    "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "ShopName": f_name,
                    "Category": f_cat,
                    "Phone": f_phone,
                    "LineID": f_line,
                    "Province": f_prov,
                    "IsPremium": f_ad
                }])
                
                try:
                    # ดึงข้อมูลเก่ามาต่อกับข้อมูลใหม่
                    current_df = conn.read(worksheet="Sheet1")
                    final_df = pd.concat([current_df, new_entry], ignore_index=True)
                    # อัปเดตกลับไปที่ Google Sheets
                    conn.update(worksheet="Sheet1", data=final_df)
                    st.success("✅ ลงทะเบียนสำเร็จ! ข้อมูลของคุณจะแสดงผลหลังการตรวจสอบ")
                except:
                    st.error("❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่")
            else:
                st.error("⚠️ กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน")

# --- 6. ส่วนล่างของแอป (Footer & Share) ---
st.divider()
foot_c1, foot_c2 = st.columns(2)
with foot_c1:
    # สร้างลิงก์แชร์ไป LINE
    app_url = "https://painaidee.streamlit.app" # เปลี่ยนเป็น URL จริงหลัง Deploy
    msg = f"หิวรึยัง? หาหมูกระทะใกล้ตัวกับแอป 'ไปไหนดี?' สิ! {app_url}"
    st.link_button("🟢 แชร์ให้เพื่อนทาง LINE", f"https://social-plugins.line.me/lineit/share?text={msg}")

with foot_c2:
    st.link_button("💬 ติดต่อสอบถาม / แจ้งปัญหา", "https://line.me/R/ti/p/~@youradminline")

st.caption("© 2026 'ไปไหนดี?' - ค้นหาร้านอาหารตามพิกัด พัฒนาโดย Python")
