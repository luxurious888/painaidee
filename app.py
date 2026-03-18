import streamlit as st
from streamlit_js_eval import get_geolocation
import googlemaps
import folium
from streamlit_folium import st_folium
import pandas as pd
from streamlit_gsheets import GSheetsConnection
import requests
from datetime import datetime

# --- 1. การตั้งค่าหน้าเว็บ (Config) ---
st.set_page_config(
    page_title="ไปไหนดี? | แนะนำร้านอาหารใกล้คุณ", 
    layout="wide", 
    page_icon="📍"
)

# ดึงข้อมูลจาก Secrets (ใช้ชื่อตัวแปรที่ตั้งไว้ในไฟล์ Secrets เท่านั้น)
try:
    # แก้ไข: ดึงจากชื่อ Key ที่เราตั้งไว้ใน Secrets
    GOOGLE_API_KEY = st.secrets["G_MAPS_API_KEY"] 
    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    
    # แก้ไข: ใช้ชื่อ "gsheets" ตามที่ตั้งไว้ใน [connections.gsheets]
    conn = st.connection("gsheets", type=GSheetsConnection)
    
    LINE_CLIENT_ID = st.secrets["line_login"]["client_id"]
    LINE_CLIENT_SECRET = st.secrets["line_login"]["client_secret"]
    
    # URL ของแอปคุณบน Streamlit Cloud
    REDIRECT_URI = "https://painaidee.streamlit.app/" 
except Exception as e:
    st.error(f"⚠️ ตรวจสอบการตั้งค่า Secrets ให้ครบถ้วน: {e}")
    st.stop()

# --- 2. ระบบ LINE LOGIN ---
def get_line_login_url():
    return f"https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id={LINE_CLIENT_ID}&redirect_uri={REDIRECT_URI}&state=12345abcde&scope=profile%20openid"

# ตรวจสอบการ Login จาก URL Query Parameters
query_params = st.query_params
if "code" in query_params and not st.session_state.get("is_logged_in"):
    code = query_params["code"]
    token_url = "https://api.line.me/oauth2/v2.1/token"
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': LINE_CLIENT_ID,
        'client_secret': LINE_CLIENT_SECRET
    }
    res = requests.post(token_url, data=data).json()
    
    if "access_token" in res:
        p_headers = {'Authorization': f"Bearer {res['access_token']}"}
        profile = requests.get("https://api.line.me/v2/profile", headers=p_headers).json()
        st.session_state.is_logged_in = True
        st.session_state.user_name = profile.get('displayName')
        st.session_state.user_pic = profile.get('pictureUrl')
        # ล้าง query params เพื่อให้ URL สะอาด
        st.query_params.clear()
        st.rerun()

# หน้าจอ Login (ถ้ายังไม่ได้เข้าสู่ระบบ)
if not st.session_state.get("is_logged_in"):
    st.markdown("<h1 style='text-align: center;'>📍 ไปไหนดี?</h1>", unsafe_allow_html=True)
    st.write("<p style='text-align: center;'>ค้นหาร้านอาหารเด็ดรอบตัวคุณ ง่ายๆ แค่ปลายนิ้ว</p>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1,2,1])
    with col2:
        st.link_button("🟢 เข้าสู่ระบบด้วย LINE", get_line_login_url(), use_container_width=True)
    st.stop()

# --- 3. ฟังก์ชันดึงข้อมูลร้านอาหาร ---
def get_google_shops(lat, lng, radius_km, keyword):
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
    try:
        # อ่านข้อมูลจาก Sheet1
        df = conn.read(worksheet="Sheet1")
        premium = df[
            (df['IsPremium'].astype(str).str.upper() == 'TRUE') & 
            (df['Province'] == province) & 
            (df['Category'] == category)
        ]
        return premium.to_dict('records')
    except:
        return []

# --- 4. ส่วนแสดงผลหลัก (Main App) ---
with st.sidebar:
    if st.session_state.user_pic:
        st.image(st.session_state.user_pic, width=100)
    st.title(f"สวัสดีคุณ {st.session_state.user_name}")
    menu = st.radio("เมนูหลัก", ["🔍 ค้นหาร้านอาหาร", "🏪 ลงทะเบียนเจ้าของร้าน"])
    if st.button("ออกจากระบบ"):
        st.session_state.clear()
        st.rerun()

if menu == "🔍 ค้นหาร้านอาหาร":
    st.header("🔎 ค้นหาร้านอาหารใกล้ตัว")
    
    col_a, col_b = st.columns(2)
    with col_a:
        sel_province = st.selectbox("เลือกจังหวัด", ["อุบลราชธานี", "กรุงเทพฯ", "เชียงใหม่"])
    with col_b:
        sel_category = st.selectbox("ประเภทอาหาร", ["หมูกระทะ", "แจ่วฮ้อน", "ชาบู", "ร้านอาหารทั่วไป"])
    
    sel_radius = st.slider("ระยะทาง (กิโลเมตร)", 1, 20, 5)

    # ดึงพิกัดผู้ใช้
    location = get_geolocation()
    if location:
        u_lat = location['coords']['latitude']
        u_lng = location['coords']['longitude']

        # --- ส่วนร้านพรีเมียม ---
        st.subheader("✨ ร้านแนะนำพิเศษ")
        ads = get_premium_shops(sel_province, sel_category)
        if ads:
            cols = st.columns(len(ads[:3]))
            for i, shop in enumerate(ads[:3]):
                with cols[i]:
                    st.success(f"🏆 {shop['ShopName']}")
                    st.write(f"📞 {shop['Phone']}")
                    if str(shop['LineID']) != 'nan' and shop['LineID']:
                        st.link_button("แอดไลน์ร้าน", f"https://line.me/R/ti/p/~{shop['LineID']}")
        else:
            st.info("ยังไม่มีร้านแนะนำในหมวดนี้")

        # --- แผนที่และร้านจาก Google Maps ---
        st.divider()
        st.subheader("🗺️ ร้านค้าในพื้นที่")
        g_shops = get_google_shops(u_lat, u_lng, sel_radius, sel_category)
        
        m = folium.Map(location=[u_lat, u_lng], zoom_start=14)
        folium.Marker([u_lat, u_lng], popup="คุณอยู่ที่นี่", icon=folium.Icon(color='red')).add_to(m)
        
        for s in g_shops:
            folium.Marker(
                [s['geometry']['location']['lat'], s['geometry']['location']['lng']],
                popup=s['name'],
                icon=folium.Icon(color='blue', icon='cutlery', prefix='fa')
            ).add_to(m)
        
        st_folium(m, width="100%", height=400)

        for s in g_shops[:5]:
            with st.expander(f"🔹 {s['name']} (⭐ {s.get('rating', 'ไม่มีคะแนน')})"):
                st.write(f"📍 {s.get('vicinity')}")
                nav_url = f"https://www.google.com/maps/dir/?api=1&destination={s['geometry']['location']['lat']},{s['geometry']['location']['lng']}"
                st.link_button("🚀 นำทาง", nav_url)
    else:
        st.warning("📍 กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location) เพื่อดูร้านใกล้ตัว")

elif menu == "🏪 ลงทะเบียนเจ้าของร้าน":
    st.header("🏪 ลงทะเบียนร้านของคุณ")
    with st.form("reg_form", clear_on_submit=True):
        f_name = st.text_input("ชื่อร้าน*")
        f_phone = st.text_input("เบอร์โทรศัพท์*")
        f_prov = st.selectbox("จังหวัด", ["อุบลราชธานี", "กรุงเทพฯ", "เชียงใหม่"])
        f_cat = st.selectbox("ประเภทอาหาร", ["หมูกระทะ", "แจ่วฮ้อน", "ชาบู", "ร้านอาหารทั่วไป"])
        f_line = st.text_input("Line ID")
        f_ad = st.checkbox("สนใจพื้นที่โฆษณาพรีเมียม")
        
        if st.form_submit_button("ส่งข้อมูล"):
            if f_name and f_phone:
                new_data = pd.DataFrame([{
                    "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "ShopName": f_name, "Category": f_cat, "Phone": f_phone,
                    "LineID": f_line, "Province": f_prov, "IsPremium": f_ad
                }])
                try:
                    old_df = conn.read(worksheet="Sheet1")
                    updated_df = pd.concat([old_df, new_data], ignore_index=True)
                    conn.update(worksheet="Sheet1", data=updated_df)
                    st.success("บันทึกข้อมูลสำเร็จ! ทีมงานจะตรวจสอบและนำขึ้นระบบโดยเร็ว")
                except:
                    st.error("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล")
            else:
                st.error("กรุณากรอกชื่อร้านและเบอร์โทรศัพท์")
