from flask import Flask, render_template, jsonify, request
from database import get_db_connection, ALL_PERMISSIONS, SUPER_ROLES, init_db
from datetime import datetime, timedelta
import math, json

app = Flask(__name__)
app.secret_key = 'g2snooker_v5_enterprise'

# ── SESSION PERSISTENCE ───────────────────────────────────────
def load_sessions():
    """โหลด session จาก DB เข้า memory ตอน startup"""
    sessions = {}
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM active_sessions_db").fetchall()
    conn.close()
    for r in rows:
        try:
            sessions[r['table_id']] = {
                "active":     True,
                "start":      datetime.fromisoformat(r['start_time']) if r['start_time'] else None,
                "orders":     json.loads(r['orders'] or '[]'),
                "total_food": r['total_food'] or 0,
                "limit_mins": r['limit_mins'] or 0,
            }
        except Exception as e:
            print(f"[WARN] load session table {r['table_id']}: {e}")
    print(f"✅ Loaded {len(sessions)} active table sessions from DB")
    return sessions

def save_session(table_id, sess):
    """บันทึก session ลง DB ทุกครั้งที่มีการเปลี่ยนแปลง"""
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO active_sessions_db (table_id,start_time,orders,total_food,limit_mins) VALUES (?,?,?,?,?)",
        (table_id,
         sess['start'].isoformat() if sess.get('start') else None,
         json.dumps(sess.get('orders', []), ensure_ascii=False),
         sess.get('total_food', 0),
         sess.get('limit_mins', 0))
    )
    conn.commit(); conn.close()

def delete_session(table_id):
    """ลบ session ออกจาก DB"""
    conn = get_db_connection()
    conn.execute("DELETE FROM active_sessions_db WHERE table_id=?", (table_id,))
    conn.commit(); conn.close()

# Sessions loaded lazily on first request
active_sessions = {}
_initialized = False

# ─────────────────────────────────────────────
@app.before_request
def startup():
    global active_sessions, _initialized
    if not _initialized:
        init_db()
        active_sessions = load_sessions()
        _initialized = True

@app.route("/")
def index(): return render_template("index.html")

# ── AUTH ──────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM employees WHERE pin = ?", (request.json.get('pin'),)).fetchone()
    if not user: conn.close(); return jsonify({"status":"error"}), 401
    perms = {}
    if user['role'] not in SUPER_ROLES:
        rows  = conn.execute("SELECT permission_key,allowed FROM employee_permissions WHERE emp_id=?", (user['id'],)).fetchall()
        perms = {r['permission_key']: bool(r['allowed']) for r in rows}
    conn.close()
    return jsonify({"status":"success","name":user['name'],"role":user['role'],"emp_id":user['id'],"permissions":perms})

# ── PERMISSIONS ───────────────────────────────────────────────
@app.route("/api/permissions/list")
def list_permissions():
    return jsonify([{"key":k,"label":l,"group":g} for k,l,g in ALL_PERMISSIONS])

@app.route("/api/permissions", methods=["GET","POST"])
def manage_permissions():
    conn = get_db_connection()
    if request.method == "GET":
        eid  = request.args.get('emp_id')
        rows = conn.execute("SELECT permission_key,allowed FROM employee_permissions WHERE emp_id=?", (eid,)).fetchall()
        conn.close(); return jsonify({r['permission_key']:bool(r['allowed']) for r in rows})
    d = request.json; eid = int(d['emp_id'])
    for k,v in d['permissions'].items():
        conn.execute("INSERT OR REPLACE INTO employee_permissions (emp_id,permission_key,allowed) VALUES (?,?,?)", (eid,k,1 if v else 0))
    conn.commit(); conn.close(); return jsonify({"status":"success"})

# ── TABLES ────────────────────────────────────────────────────
@app.route("/api/tables")
def get_tables():
    conn  = get_db_connection()
    tabs  = conn.execute("SELECT * FROM tables_config").fetchall()
    rates = conn.execute("SELECT * FROM rate_settings").fetchall()
    conn.close(); res = {}
    for t in tabs:
        tid = t['id']
        s   = active_sessions.get(tid, {"active":False,"orders":[],"total_food":0,"start":None,"limit_mins":0})
        fee = 0
        if t['type']=='snooker' and s['active'] and s['start']:
            curr=s['start']; now=datetime.now()
            if s['limit_mins']>0:
                cap=s['start']+timedelta(minutes=s['limit_mins'])
                if now>cap: now=cap
            while curr<now:
                hr=curr.hour; r_=180.0
                for r in rates:
                    if r['start_hour']<r['end_hour']:
                        if r['start_hour']<=hr<r['end_hour']: r_=r['hourly_rate']
                    else:
                        if hr>=r['start_hour'] or hr<r['end_hour']: r_=r['hourly_rate']
                fee+=r_/60.0; curr+=timedelta(minutes=1)
        res[tid]={"id":tid,"name":t['name'],"type":t['type'],"active":s['active'],"orders":s['orders'],
                  "total_food":s.get('total_food',0),
                  "start":s['start'].isoformat() if s['start'] else None,
                  "start_ts":s['start'].timestamp() if s['start'] else None,
                  "limit_mins":s.get('limit_mins',0),"current_time_fee":round(fee,2)}
    return jsonify(res)

@app.route("/api/start/<int:tid>", methods=["POST"])
def start_table(tid):
    sess = {"active":True,"start":datetime.now(),"orders":[],"total_food":0,"limit_mins":0}
    active_sessions[tid] = sess
    save_session(tid, sess)
    return jsonify({"status":"success"})

@app.route("/api/table/set_time", methods=["POST"])
def set_time():
    d=request.json; tid=int(d['table_id'])
    if tid in active_sessions:
        active_sessions[tid]['limit_mins']=int(d['minutes'])
        save_session(tid, active_sessions[tid])
        return jsonify({"status":"success"})
    return jsonify({"status":"error"}),400

@app.route("/api/table/action", methods=["POST"])
def table_action():
    d=request.json; action=d.get('action'); src=int(d.get('source')); dst=int(d.get('target',0))
    if action=='cancel' and src in active_sessions:
        conn=get_db_connection()
        for o in active_sessions[src]['orders']:
            conn.execute("UPDATE inventory SET stock_qty=stock_qty+? WHERE id=?",(o['qty'],int(o['id'])))
        conn.commit(); conn.close()
        active_sessions.pop(src); delete_session(src)
        return jsonify({"status":"success"})
    elif action=='move' and src in active_sessions and dst not in active_sessions:
        active_sessions[dst]=active_sessions.pop(src)
        delete_session(src); save_session(dst, active_sessions[dst])
        return jsonify({"status":"success"})
    elif action=='merge' and src in active_sessions and dst in active_sessions:
        if active_sessions[src]['start'] and active_sessions[dst]['start']:
            active_sessions[dst]['start']-=(datetime.now()-active_sessions[src]['start'])
        for so in active_sessions[src]['orders']:
            fd=next((d for d in active_sessions[dst]['orders'] if int(d['id'])==int(so['id'])),None)
            if fd: fd['qty']+=so['qty']; fd['total_price']+=so['total_price']
            else: active_sessions[dst]['orders'].append(so)
        active_sessions[dst]['total_food']+=active_sessions[src].get('total_food',0)
        active_sessions.pop(src); delete_session(src); save_session(dst, active_sessions[dst])
        return jsonify({"status":"success"})
    return jsonify({"status":"error"}),400

# ── CHECKOUT ─────────────────────────────────────────────────
@app.route("/api/table/checkout", methods=["POST"])
def checkout():
    d=request.json; tid=int(d['table_id']); cashier=d['cashier']
    if tid not in active_sessions: return jsonify({"status":"error"}),400
    conn=get_db_connection()
    ti=conn.execute("SELECT * FROM tables_config WHERE id=?",(tid,)).fetchone()
    rates=conn.execute("SELECT * FROM rate_settings").fetchall()
    sess=active_sessions[tid]; fee=0; end=datetime.now()
    if sess['limit_mins']>0:
        el=math.ceil((end-sess['start']).total_seconds()/60)
        if el>sess['limit_mins']: end=sess['start']+timedelta(minutes=sess['limit_mins'])
    if ti['type']=='snooker' and sess['start']:
        curr=sess['start']
        while curr<end:
            hr=curr.hour; r_=180.0
            for r in rates:
                if r['start_hour']<r['end_hour']:
                    if r['start_hour']<=hr<r['end_hour']: r_=r['hourly_rate']
                else:
                    if hr>=r['start_hour'] or hr<r['end_hour']: r_=r['hourly_rate']
            fee+=r_/60.0; curr+=timedelta(minutes=1)
    fee=round(fee,2); total=fee+sess['total_food']
    bno=f"B{datetime.now().strftime('%y%m%d%H%M%S')}"
    cur=conn.cursor()
    cur.execute("INSERT INTO bills (bill_no,table_name,start_time,end_time,time_fee,food_fee,total,cashier,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,'ชำระแล้ว')",
                (bno,ti['name'],sess['start'].isoformat() if sess['start'] else None,end.isoformat(),fee,sess['total_food'],total,cashier,end.isoformat()))
    bid=cur.lastrowid
    for o in sess['orders']:
        cur.execute("INSERT INTO bill_items (bill_id,name,qty,price,total) VALUES (?,?,?,?,?)",(bid,o['name'],o['qty'],o['price'],o['total_price']))
    conn.commit(); conn.close()
    snap=list(sess['orders']); tsnap=sess['start'].isoformat() if sess['start'] else None
    active_sessions.pop(tid); delete_session(tid)
    return jsonify({"status":"success","bill_no":bno,"bill_id":bid,"table_name":ti['name'],"total":total,
                    "time_fee":fee,"food_fee":sess['total_food'],"cashier":cashier,
                    "start_time":tsnap,"end_time":end.isoformat(),"orders":snap})

# ── ORDERS ───────────────────────────────────────────────────
@app.route("/api/menu")
def get_menu():
    return jsonify([dict(i) for i in get_db_connection().execute("SELECT * FROM inventory").fetchall()])

@app.route("/api/order/add", methods=["POST"])
def add_order():
    d=request.json; tid=int(d['table_id']); iid=int(d['item_id'])
    conn=get_db_connection(); item=conn.execute("SELECT * FROM inventory WHERE id=?",(iid,)).fetchone()
    if item and item['stock_qty']>0:
        conn.execute("UPDATE inventory SET stock_qty=stock_qty-1 WHERE id=?",(iid,)); conn.commit()
        if tid not in active_sessions:
            active_sessions[tid]={"active":True,"start":datetime.now(),"orders":[],"total_food":0,"limit_mins":0}
        orders=active_sessions[tid]['orders']
        fd=next((o for o in orders if int(o['id'])==iid),None)
        if fd: fd['qty']+=1; fd['total_price']=fd['qty']*fd['price']
        else: orders.append({"id":iid,"name":item['product_name'],"price":float(item['price']),"qty":1,"total_price":float(item['price'])})
        active_sessions[tid]['total_food']+=item['price']
        save_session(tid, active_sessions[tid])
        conn.close(); return jsonify({"status":"success"})
    conn.close(); return jsonify({"status":"error","msg":"สินค้าหมด"}),400

@app.route("/api/order/remove", methods=["POST"])
def remove_order():
    d=request.json; tid=int(d['table_id']); iid=int(d['item_id'])
    if tid not in active_sessions: return jsonify({"status":"error"}),400
    orders=active_sessions[tid]['orders']
    fd=next((o for o in orders if int(o['id'])==iid),None)
    if not fd: return jsonify({"status":"error"}),400
    conn=get_db_connection(); conn.execute("UPDATE inventory SET stock_qty=stock_qty+1 WHERE id=?",(iid,)); conn.commit(); conn.close()
    active_sessions[tid]['total_food']=max(0,active_sessions[tid]['total_food']-fd['price'])
    if fd['qty']>1: fd['qty']-=1; fd['total_price']=fd['qty']*fd['price']
    else: orders.remove(fd)
    save_session(tid, active_sessions[tid])
    return jsonify({"status":"success"})

# ── INVENTORY ────────────────────────────────────────────────
@app.route("/api/inventory/update", methods=["POST"])
def update_stock():
    d=request.json; conn=get_db_connection()
    conn.execute("UPDATE inventory SET stock_qty=stock_qty+? WHERE id=?",(int(d['qty']),int(d['id']))); conn.commit(); conn.close()
    return jsonify({"status":"success"})

@app.route("/api/inventory/new", methods=["POST"])
def new_product():
    d=request.json; conn=get_db_connection()
    conn.execute("INSERT INTO inventory (product_name,price,cost,stock_qty,category) VALUES (?,?,?,?,?)",
                 (d['name'],float(d['price']),float(d['cost']),int(d['qty']),d['category'])); conn.commit(); conn.close()
    return jsonify({"status":"success"})

@app.route("/api/inventory/<int:item_id>", methods=["DELETE"])
def delete_product(item_id):
    conn=get_db_connection(); conn.execute("DELETE FROM inventory WHERE id=?",(item_id,)); conn.commit(); conn.close()
    return jsonify({"status":"success"})

@app.route("/api/inventory/categories", methods=["GET","DELETE"])
def manage_categories():
    conn=get_db_connection()
    if request.method=="GET":
        rows=conn.execute("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category!='' ORDER BY category").fetchall()
        conn.close(); return jsonify([r['category'] for r in rows])
    cat=request.json.get('category')
    conn.execute("UPDATE inventory SET category='ทั่วไป' WHERE category=?",(cat,)); conn.commit(); conn.close()
    return jsonify({"status":"success"})

# ── BILLS ────────────────────────────────────────────────────
@app.route("/api/bills")
def get_bills():
    df=request.args.get('date',''); tf=request.args.get('table','')
    q="SELECT * FROM bills WHERE 1=1"; p=[]
    if df: q+=" AND created_at LIKE ?"; p.append(f"{df}%")
    if tf: q+=" AND table_name LIKE ?"; p.append(f"%{tf}%")
    q+=" ORDER BY id DESC LIMIT 200"
    return jsonify([dict(b) for b in get_db_connection().execute(q,p).fetchall()])

@app.route("/api/bills/<int:bid>")
def get_bill_items(bid):
    conn=get_db_connection()
    bill=conn.execute("SELECT * FROM bills WHERE id=?",(bid,)).fetchone()
    items=conn.execute("SELECT * FROM bill_items WHERE bill_id=?",(bid,)).fetchall()
    conn.close(); return jsonify({"bill":dict(bill) if bill else {},"items":[dict(i) for i in items]})

# ── EXPENSES ─────────────────────────────────────────────────
@app.route("/api/expenses", methods=["GET","POST"])
def manage_expenses():
    conn=get_db_connection()
    if request.method=="POST":
        d=request.json
        conn.execute("INSERT INTO expenses (category,amount,note,created_by,created_at) VALUES (?,?,?,?,?)",
                     (d['category'],float(d['amount']),d['note'],d['cashier'],datetime.now().isoformat()))
        conn.commit(); conn.close(); return jsonify({"status":"success"})
    e=conn.execute("SELECT * FROM expenses ORDER BY id DESC LIMIT 30").fetchall(); conn.close()
    return jsonify([dict(i) for i in e])

# ── EXCHANGE ─────────────────────────────────────────────────
@app.route("/api/exchange", methods=["GET","POST"])
def handle_exchange():
    conn=get_db_connection()
    if request.method=="POST":
        d=request.json
        conn.execute("INSERT INTO exchange_history (total_amount,bill_100_qty,bill_20_qty,cashier,created_at) VALUES (?,?,?,?,?)",
                     (d['amount'],d['qty_100'],d['qty_20'],d['cashier'],datetime.now().isoformat()))
        conn.commit(); conn.close(); return jsonify({"status":"success"})
    h=conn.execute("SELECT * FROM exchange_history ORDER BY id DESC LIMIT 15").fetchall(); conn.close()
    return jsonify([dict(i) for i in h])

# ── RATES ────────────────────────────────────────────────────
@app.route("/api/rates", methods=["GET","POST"])
def manage_rates():
    conn=get_db_connection()
    if request.method=="POST":
        for r in request.json:
            conn.execute("UPDATE rate_settings SET hourly_rate=?,start_hour=?,end_hour=? WHERE id=?",
                         (float(r['rate']),int(r['start_hour']),int(r['end_hour']),int(r['id'])))
        conn.commit(); conn.close(); return jsonify({"status":"success"})
    r=conn.execute("SELECT * FROM rate_settings").fetchall(); conn.close()
    return jsonify([dict(i) for i in r])

# ── SETTINGS ─────────────────────────────────────────────────
@app.route("/api/settings", methods=["GET","POST"])
def manage_settings():
    conn=get_db_connection()
    if request.method=="POST":
        for k,v in request.json.items():
            conn.execute("INSERT OR REPLACE INTO system_settings (setting_key,setting_value) VALUES (?,?)",(k,str(v)))
        conn.commit(); conn.close(); return jsonify({"status":"success"})
    r=conn.execute("SELECT * FROM system_settings").fetchall(); conn.close()
    return jsonify({i['setting_key']:i['setting_value'] for i in r})

# ── EMPLOYEES ────────────────────────────────────────────────
@app.route("/api/employees", methods=["GET","POST","DELETE"])
def manage_employees():
    conn=get_db_connection()
    if request.method=="GET":
        e=conn.execute("SELECT id,name,pin,role FROM employees ORDER BY id").fetchall(); conn.close()
        return jsonify([dict(i) for i in e])
    if request.method=="POST":
        d=request.json
        try:
            if d.get('id'):
                conn.execute("UPDATE employees SET name=?,pin=?,role=? WHERE id=?",(d['name'],d['pin'],d['role'],int(d['id'])))
            else:
                conn.execute("INSERT INTO employees (name,pin,role) VALUES (?,?,?)",(d['name'],d['pin'],d['role']))
                if d['role']=='staff':
                    from database import DEFAULT_STAFF_PERMISSIONS
                    nid=conn.execute("SELECT id FROM employees WHERE pin=?",(d['pin'],)).fetchone()['id']
                    for pk in DEFAULT_STAFF_PERMISSIONS:
                        conn.execute("INSERT OR IGNORE INTO employee_permissions (emp_id,permission_key,allowed) VALUES (?,?,1)",(nid,pk))
            conn.commit(); conn.close()
            return jsonify({"status":"success"})
        except Exception as ex:
            conn.close()
            msg="PIN นี้มีคนใช้แล้ว" if "UNIQUE" in str(ex) else str(ex)
            return jsonify({"status":"error","msg":msg}),400
    if request.method=="DELETE":
        eid=int(request.json['id'])
        conn.execute("DELETE FROM employees WHERE id=?",(eid,))
        conn.execute("DELETE FROM employee_permissions WHERE emp_id=?",(eid,))
        conn.commit(); conn.close(); return jsonify({"status":"success"})

# ── PAYROLL: ตั้งค่าอัตราต่อคน ───────────────────────────────
@app.route("/api/payroll/settings", methods=["GET","POST"])
def payroll_settings():
    conn = get_db_connection()
    if request.method == "POST":
        d = request.json
        conn.execute(
            "INSERT OR REPLACE INTO payroll_emp_settings (emp_name,monthly_base,working_days,ot_rate,late_penalty) VALUES (?,?,?,?,?)",
            (d["emp_name"], float(d.get("monthly_base",0)), int(d.get("working_days",26)),
             float(d.get("ot_rate",0)), float(d.get("late_penalty",50)))
        )
        conn.commit(); conn.close()
        return jsonify({"status":"success"})
    rows = conn.execute("SELECT * FROM payroll_emp_settings").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# ── PAYROLL: บันทึกรายวัน ────────────────────────────────────
@app.route("/api/payroll/daily", methods=["GET","POST"])
def payroll_daily():
    conn = get_db_connection()
    if request.method == "POST":
        d = request.json
        conn.execute(
            "INSERT OR REPLACE INTO payroll_daily (emp_name,work_date,status,is_late,ot_hours,note,created_at) VALUES (?,?,?,?,?,?,?)",
            (d["emp_name"], d["work_date"], d.get("status","present"),
             1 if d.get("is_late") else 0, float(d.get("ot_hours",0)),
             d.get("note",""), datetime.now().isoformat())
        )
        conn.commit(); conn.close()
        return jsonify({"status":"success"})
    # GET: ดึงสัปดาห์ที่ระบุ (week_start = วันจันทร์)
    week_start = request.args.get("week_start", "")
    if week_start:
        week_end = (datetime.strptime(week_start,"%Y-%m-%d") + timedelta(days=6)).strftime("%Y-%m-%d")
        rows = conn.execute(
            "SELECT * FROM payroll_daily WHERE work_date >= ? AND work_date <= ? ORDER BY work_date,emp_name",
            (week_start, week_end)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM payroll_daily ORDER BY work_date DESC LIMIT 200").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# ── PAYROLL: สรุปรายสัปดาห์ ─────────────────────────────────
@app.route("/api/payroll/weekly_summary", methods=["GET"])
def payroll_weekly_summary():
    week_start = request.args.get("week_start","")
    if not week_start:
        # หาวันจันทร์ล่าสุด
        today = datetime.now()
        days_since_mon = today.weekday()
        week_start = (today - timedelta(days=days_since_mon)).strftime("%Y-%m-%d")
    week_end = (datetime.strptime(week_start,"%Y-%m-%d") + timedelta(days=6)).strftime("%Y-%m-%d")
    conn = get_db_connection()
    rows  = conn.execute(
        "SELECT * FROM payroll_daily WHERE work_date >= ? AND work_date <= ?",
        (week_start, week_end)
    ).fetchall()
    settings = {r["emp_name"]: dict(r) for r in conn.execute("SELECT * FROM payroll_emp_settings").fetchall()}
    conn.close()
    # จัดกลุ่มตามพนักงาน
    emp_data = {}
    for r in rows:
        n = r["emp_name"]
        if n not in emp_data:
            emp_data[n] = {"emp_name":n,"actual_days":0,"absent_days":0,"late_count":0,"ot_hours":0.0,"records":[]}
        if r["status"] == "present":
            emp_data[n]["actual_days"] += 1
        else:
            emp_data[n]["absent_days"] += 1
        if r["is_late"]: emp_data[n]["late_count"] += 1
        emp_data[n]["ot_hours"] += r["ot_hours"] or 0
        emp_data[n]["records"].append(dict(r))
    # คำนวณเงิน
    result = []
    for name, data in emp_data.items():
        s = settings.get(name, {"monthly_base":0,"working_days":26,"ot_rate":0,"late_penalty":50})
        monthly = float(s.get("monthly_base",0) or 0)
        wd      = int(s.get("working_days",26) or 26)
        daily_r = round(monthly / wd, 2) if wd > 0 else 0
        ot_rate = float(s.get("ot_rate",0) or 0)
        late_p  = float(s.get("late_penalty",50) or 50)
        base_pay    = round(data["actual_days"] * daily_r, 2)
        ot_pay      = round(data["ot_hours"] * ot_rate, 2)
        late_deduct = round(data["late_count"] * late_p, 2)
        net = round(base_pay + ot_pay - late_deduct, 2)
        result.append({**data, "daily_rate":daily_r, "base_pay":base_pay,
                       "ot_pay":ot_pay, "late_deduct":late_deduct, "net":net,
                       "monthly_base":monthly, "settings": s})
    return jsonify({"week_start":week_start,"week_end":week_end,"employees":result})

# ── PAYROLL: จ่ายประจำสัปดาห์ ────────────────────────────────
@app.route("/api/payroll/weekly_close", methods=["POST"])
def payroll_weekly_close():
    d = request.json
    conn = get_db_connection()
    week_label = f"สัปดาห์ {d['week_start']} ถึง {d['week_end']}"
    for emp in d.get("employees",[]):
        conn.execute(
            "INSERT INTO payroll (emp_name,month_year,base_salary,working_days,actual_days,daily_rate,"
            "ot_hours,ot_rate,ot_amount,bonus_amount,late_count,late_penalty,"
            "deduct_late,deduct_absent,deduct_other,net_salary,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (emp["emp_name"], week_label,
             emp.get("monthly_base",0), emp.get("working_days",26),
             emp.get("actual_days",0), emp.get("daily_rate",0),
             emp.get("ot_hours",0), emp.get("settings",{}).get("ot_rate",0), emp.get("ot_pay",0),
             0, emp.get("late_count",0), emp.get("settings",{}).get("late_penalty",50),
             emp.get("late_deduct",0), 0, 0, emp.get("net",0),
             datetime.now().isoformat())
        )
    conn.commit(); conn.close()
    return jsonify({"status":"success"})

# ── PAYROLL v2 (monthly history) ────────────────────────────
@app.route("/api/payroll", methods=["GET","POST"])
def manage_payroll():
    conn=get_db_connection()
    if request.method=="POST":
        d=request.json
        base=float(d.get('base_salary',0)); wd=int(d.get('working_days',26)); ad=int(d.get('actual_days',wd))
        dr=round(base/wd,2) if wd>0 else 0
        oth=float(d.get('ot_hours',0)); otr=float(d.get('ot_rate',0)); ota=round(oth*otr,2)
        bon=float(d.get('bonus_amount',0))
        lc=int(d.get('late_count',0)); lp=float(d.get('late_penalty',0)); dl=round(lc*lp,2)
        da=round((wd-ad)*dr,2); doth=float(d.get('deduct_other',0))
        bp=round(ad*dr,2); net=round((bp+ota+bon)-(dl+da+doth),2)
        conn.execute("INSERT INTO payroll (emp_name,month_year,base_salary,working_days,actual_days,daily_rate,"
                     "ot_hours,ot_rate,ot_amount,bonus_amount,late_count,late_penalty,"
                     "deduct_late,deduct_absent,deduct_other,net_salary,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (d['emp_name'],d.get('month_year',''),base,wd,ad,dr,oth,otr,ota,bon,lc,lp,dl,da,doth,net,datetime.now().isoformat()))
        conn.commit(); conn.close()
        return jsonify({"status":"success","net":net,"daily_rate":dr,"deduct_absent":da,"ot_amount":ota,"base_pay":bp})
    rows=conn.execute("SELECT * FROM payroll ORDER BY id DESC LIMIT 100").fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])

# ── REPORT / DASHBOARD ───────────────────────────────────────
@app.route("/api/report/dashboard")
def get_dashboard():
    conn=get_db_connection()
    r1=conn.execute("SELECT setting_value FROM system_settings WHERE setting_key='day_cutoff_time'").fetchone()
    r2=conn.execute("SELECT setting_value FROM system_settings WHERE setting_key='starting_cash'").fetchone()
    ct=r1['setting_value'] if r1 else "06:00"; sc=float(r2['setting_value']) if r2 else 2000.0
    ch,cm=map(int,ct.split(':'))
    now=datetime.now(); ctt=now.replace(hour=ch,minute=cm,second=0,microsecond=0)
    if now<ctt:
        ss=(now-timedelta(days=1)).replace(hour=ch,minute=cm,second=0,microsecond=0); sd=(now-timedelta(days=1)).strftime('%d/%m/%Y')
    else:
        ss=ctt; sd=now.strftime('%d/%m/%Y')
    sstr=ss.strftime('%Y-%m-%d %H:%M:%S')
    bills=conn.execute("SELECT * FROM bills WHERE created_at>=? ORDER BY id DESC",(sstr,)).fetchall()
    sales=sum(b['total'] for b in bills)
    exp=conn.execute("SELECT SUM(amount) FROM expenses WHERE created_at>=?",(sstr,)).fetchone()[0] or 0
    conn.close()
    return jsonify({"sales":round(sales,2),"expenses":round(float(exp),2),"net":round(sales-float(exp),2),
                    "shift_date":sd,"starting_cash":sc,"daily_bills":[dict(b) for b in bills]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
