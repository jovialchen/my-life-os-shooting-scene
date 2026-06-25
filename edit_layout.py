#!/usr/bin/env python3
"""
公寓布局编辑器

改下面的 ROWS 和 CONNECTIONS，然后运行：
    python3 edit_layout.py
    刷新浏览器

规则：
  - ROWS[0] 最北，ROWS[1] 其次…… ROWS[-1] 最南
  - 同一排内房间从西到东自动排列
  - 房间加 "align_x": "某房间id" 可以跟它水平对齐
  - walls 每面墙: "solid" | "window" | "door" | "doorWindow" | "none"
  - CONNECTIONS 列出哪些房间之间有门
"""

import os, json, math

PROJECT = os.path.dirname(os.path.abspath(__file__))

# ═══════════════════════════════════════════════════════════════
#  改这里
# ═══════════════════════════════════════════════════════════════

WALL_GAP = 0.12
ROOM_HEIGHT = 3.5
START_ROOM = "room-living"

ROWS = [
    # ═══ 第 1 排（最北）—— 卧室 + 中堂 ═══
    [
        {"id": "room-a",  "name": "次卧1", "size": [2.8, 4.0],
         "walls": {"north": "window", "south": "door",
                   "east": "door", "west": "window"}},
        {"id": "room-b",  "name": "次卧2", "size": [2.8, 4.0],
         "walls": {"north": "window", "south": "door",
                   "east": "solid", "west": "door"}},
        {"id": "room-hall", "name": "中堂", "size": [3.0, 4.0],
         "walls": {"north": "solid", "south": "door",
                   "east": "door", "west": "solid"}},
        {"id": "room-c",  "name": "次卧3", "size": [2.5, 4.0],
         "walls": {"north": "window", "south": "door",
                   "east": "door", "west": "door"}},
        {"id": "room-d",  "name": "主卧", "size": [3.0, 4.0],
         "walls": {"north": "window", "south": "door",
                   "east": "window", "west": "door"}},
    ],

    # ═══ 第 2 排（中间）—— 客房夹在洗衣房和厨房之间 ═══
    [
        {"id": "room-laundry", "name": "洗衣房", "size": [3.5, 3.0],
         "walls": {"north": "door", "south": "solid",
                   "east": "door", "west": "solid"}},
        {"id": "room-guest",   "name": "客房",   "size": [3.5, 3.0],
         "walls": {"north": "door", "south": "door",
                   "east": "door", "west": "door"}},
        {"id": "room-kitchen", "name": "厨房",   "size": [2.5, 3.0],
         "walls": {"north": "door", "south": "solid",
                   "east": "solid", "west": "door"}},
    ],

    # ═══ 第 3 排（最南）—— 客餐厅 + 书房 ═══
    [
        {"id": "room-bedroom", "name": "主卧", "size": [8.0, 8],
         "walls": {"north": "none", "south": "window",
                   "east": "door", "west": "window"}},
        {"id": "room-living", "name": "客餐厅", "size": [16.0, 8],
         "walls": {"north": "none", "south": "doorWindow",
                   "east": "none", "west": "none"}},
        {"id": "room-study",  "name": "书房",   "size": [8, 8],
         "walls": {"north": "door", "south": "window",
                   "east": "solid", "west": "door"}},
    ],
]

# ── 房间连接 ──
CONNECTIONS = [
    # 第 1 排：相邻房间
    ["room-a", "room-b"],
    ["room-b", "room-hall"],
    ["room-hall", "room-c"],
    ["room-c", "room-d"],

    # 第 2 排：相邻房间
    ["room-laundry", "room-guest"],
    ["room-guest", "room-kitchen"],

    # 第 3 排：相邻房间
    ["room-living", "room-study"],

    # 第 1 排 → 第 2 排
    ["room-a", "room-laundry"],
    ["room-b", "room-guest"],
    ["room-hall", "room-guest"],
    ["room-c", "room-kitchen"],
    ["room-d", "room-kitchen"],

    # 第 2 排 → 第 3 排
    ["room-guest", "room-living"],
    ["room-kitchen", "room-study"],
]

# ═══════════════════════════════════════════════════════════════
#  改完了
# ═══════════════════════════════════════════════════════════════


def fmt(v):
    if abs(v) < 0.0001: return "0"
    return f"{v:.4f}".rstrip("0").rstrip(".")


def js_val(v, indent=0):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return fmt(v)
    if isinstance(v, str): return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        if not v: return "[]"
        return "[\n" + ",\n".join(f"{'  '*(indent+1)}{js_val(x, indent+1)}" for x in v) + "\n" + "  "*indent + "]"
    if isinstance(v, dict):
        if not v: return "{}"
        pairs = [f"{'  '*(indent+1)}{k}: {js_val(val, indent+1)}" for k, val in v.items()]
        return "{\n" + ",\n".join(pairs) + "\n" + "  "*indent + "}"
    return "null"


# ═══════════════════════════════════════════════════════════════
#  位置计算
# ═══════════════════════════════════════════════════════════════

def calc_positions(rows):
    all_rooms = []
    row_zs = []

    # 先分配每行 z 坐标
    max_depths = [max((r["size"][1] for r in row), default=3.5) for row in rows if row]
    # 计算绝对 z
    z = max_depths[0] / 2 if max_depths else 0
    row_zs = [z]
    for i in range(1, len(max_depths)):
        z -= max_depths[i-1] / 2 + WALL_GAP + max_depths[i] / 2
        row_zs.append(z)

    # 分配每个房间的 x, z
    row_idx = 0
    for ri, row in enumerate(rows):
        if not row: continue
        total_w = sum(r["size"][0] for r in row) + WALL_GAP * (len(row) - 1)
        x = -total_w / 2
        for r in row:
            w = r["size"][0]
            x += w / 2
            r["pos"] = [round(x, 3), round(row_zs[ri], 3)]
            x += w / 2 + WALL_GAP
        all_rooms.extend(row)
        row_idx += 1

    room_map = {r["id"]: r for r in all_rooms}

    # 连接 → 门位置
    connections = []
    for a_id, b_id in CONNECTIONS:
        a = room_map.get(a_id); b = room_map.get(b_id)
        if not a or not b:
            print(f"  ⚠️ {a_id}↔{b_id} 房间不存在")
            continue

        ax, az = a["pos"]; bx, bz = b["pos"]
        aw, ad = a["size"][0], a["size"][1]

        if abs(bz - az) > abs(bx - ax):
            # 上下相邻
            door_x = (ax + bx) / 2
            door_z = az - ad / 2 if az > bz else az + ad / 2
        else:
            # 左右相邻
            door_x = ax + aw / 2 + WALL_GAP / 2 if ax < bx else ax - aw / 2 - WALL_GAP / 2
            door_z = (az + bz) / 2

        connections.append({
            "from": a_id, "to": b_id,
            "pos": [round(door_x, 3), round(door_z, 3)]
        })

    return all_rooms, connections


# ═══════════════════════════════════════════════════════════════
#  生成房间 JS
# ═══════════════════════════════════════════════════════════════

def make_room_config(room):
    w, d = room["size"][0], room["size"][1]
    h = room["size"][2] if len(room["size"]) >= 3 else ROOM_HEIGHT

    walls = []
    for facing in ["north", "south", "east", "west"]:
        wt = room["walls"].get(facing, "solid")
        if wt == "none": continue
        if wt == "solid":
            walls.append({"type": "solid", "facing": facing})
        elif wt == "window":
            walls.append({"type": "window", "facing": facing,
                "window": {"width": min(5, w - 1), "sillHeight": 0.25, "topHeight": h}})
        elif wt == "door":
            walls.append({"type": "door", "facing": facing,
                "door": {"width": 1.2, "height": 2.4, "openDirection": "left"}})
        elif wt == "doorWindow":
            half = w / 2
            walls.append({"type": "doorWindow", "facing": facing,
                "window": {"width": min(3.5, w * 0.4), "sillHeight": 0.25, "topHeight": h, "offset": -half * 0.5},
                "door": {"width": min(2.0, w * 0.25), "height": 2.4, "offset": half * 0.5, "openDirection": "left"},
                "curtain": {"rodLength": min(4.5, w * 0.5)}})

    return {
        "id": room["id"], "size": {"width": round(w, 3), "depth": round(d, 3), "height": h},
        "walls": walls, "furniture": [],
        "lights": [{"type": "ceilingLight", "pos": {"x": 0, "z": 0}}],
        "decorations": [], "smallItems": [],
    }


def write_room_js(config):
    rid = config["id"]; var = rid.replace("-", "_")
    lines = [f"// {rid}", f"export const {var} = {{"]
    for k, v in config.items():
        if k == "id": continue
        lines.append(f"    {k}: {js_val(v, 1)},")
    lines.append("};\n")

    path = os.path.join(PROJECT, "js", "rooms", f"{rid}.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path


# ═══════════════════════════════════════════════════════════════
#  更新 main.js
# ═══════════════════════════════════════════════════════════════

def update_main_js(all_rooms, connections):
    path = os.path.join(PROJECT, "js", "main.js")
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()

    # 房间导入
    imps = "\n".join(["// ═══ 导入房间配置 ═══"] +
        [f"import {{ {r['id'].replace('-', '_')} }} from './rooms/{r['id']}.js';" for r in all_rooms])

    s = c.find("// ═══ 导入房间配置 ═══")
    if s < 0: s = c.find("import { room_")
    if s < 0: print("⚠️ 找不到导入位置"); return False

    e = s
    for ln in c[s:].split("\n"):
        if "rooms/" in ln and ln.startswith("import {"): e = c.find(ln, e) + len(ln) + 1
        elif e > s and (ln.strip() == "" or not ln.startswith("import")): break
    while e < len(c) and c[e] in ("\n", "\r"): e += 1
    c = c[:s] + imps + "\n\n" + c[e:]

    # 公寓设置
    apt = ["const apartment = new Apartment();", "", "// 注册房间"]
    for r in all_rooms:
        v = r["id"].replace("-", "_"); x, z = r["pos"]
        apt.append(f"apartment.addRoom('{r['id']}', {v}, {{ x: {fmt(x)}, z: {fmt(z)} }});")
    apt.append(""); apt.append("// 房间连接")
    for conn in connections:
        cx, cz = conn["pos"]
        apt.append(f"apartment.addConnection('{conn['from']}', '{conn['to']}', {{ x: {fmt(cx)}, z: {fmt(cz)} }});")
    apt += ["", "// 无走廊", "apartment.setCorridorBounds(null);", "",
            f"apartment.build(scene, '{START_ROOM}');"]
    apt_s = "\n".join(apt)

    s2 = c.find("const apartment = new Apartment();")
    if s2 < 0: s2 = c.find("apartment.addRoom('")
    if s2 < 0: print("⚠️ 找不到公寓设置"); return False

    e2 = c.find("apartment.build(scene, '", s2)
    if e2 < 0: print("⚠️ 找不到 apartment.build"); return False
    e2 = c.find("\n", e2) + 1

    c = c[:s2] + apt_s + "\n\n" + c[e2:]

    for req in ["const scene = new THREE.Scene()", "const camera = new THREE.PerspectiveCamera",
                "const renderer = new THREE.WebGLRenderer"]:
        if req not in c:
            print(f"❌ 丢失 {req}，已取消"); return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(c)
    return True


# ═══════════════════════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 55)
    print("Hazel's House — 布局生成")
    print("=" * 55)

    all_rooms, connections = calc_positions(ROWS)

    for i, row in enumerate(ROWS):
        if not row: continue
        direction = {0: "北", len(ROWS)-1: "南"}.get(i, "中")
        print(f"\n第 {i+1} 排（{direction}）:")
        for r in row:
            name = r.get("name", ""); w, d = r["size"][0], r["size"][1]; x, z = r["pos"]
            w_str = "/".join(f"{f[0].upper()}:{t}" for f, t in r["walls"].items())
            print(f"  {r['id']:18s} {name:6s}  {w}×{d}m  ({fmt(x)}, {fmt(z)})  [{w_str}]")

    print(f"\n连接 ({len(connections)} 个):")
    for cc in connections:
        print(f"  {cc['from']} ↔ {cc['to']}")

    print(f"\n── 生成 ──")
    os.makedirs(os.path.join(PROJECT, "js", "rooms"), exist_ok=True)
    for room in all_rooms:
        write_room_js(make_room_config(room))
    print(f"  ✅ {len(all_rooms)} 个房间配置")

    if update_main_js(all_rooms, connections):
        print("  ✅ main.js")

    valid = {r["id"] for r in all_rooms}
    for f in os.listdir(os.path.join(PROJECT, "js", "rooms")):
        if f.endswith(".js") and f[:-3] not in valid:
            os.remove(os.path.join(PROJECT, "js", "rooms", f))
            print(f"  🗑  {f}")

    print(f"\n{'='*55}")
    print(f"{len(all_rooms)} 个房间 | {len(ROWS)} 排 | 无走廊")
    print(f"刷新 http://localhost:8000")
    print(f"{'='*55}")
