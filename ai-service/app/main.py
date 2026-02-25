from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import hyperlpr3 as lpr3
import cv2
import numpy as np
import re
import os
from typing import Dict, List, Tuple
from collections import Counter, deque
from threading import Lock
import time

# 使用高精度检测 (640x640)，提高小目标、多车牌场景的准确率
try:
    from hyperlpr3.common.typedef import DETECT_LEVEL_HIGH
except ImportError:
    DETECT_LEVEL_HIGH = 1

app = FastAPI()

cors_origins = [
    origin.strip()
    for origin in os.getenv("AI_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if origin.strip()
]
if not cors_origins:
    cors_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

catcher = lpr3.LicensePlateCatcher(detect_level=DETECT_LEVEL_HIGH)

_PLATE_TYPE_MAP = {
    0: "blue",
    1: "yellow",
    2: "white",
    3: "green",
    4: "black",
    5: "yellow",
    6: "yellow",
    7: "yellow",
    8: "yellow",
    9: "yellow",
}

_PROVINCE_PREFIXES = set(
    "京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼港澳使领学警"
)
_ALNUM_RE = re.compile(r"^[A-Z0-9]+$")
_SECOND_CHAR_FIX_MAP = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "5": "S",
    "8": "B",
}
_BOX_IOU_MERGE_THRESHOLD = 0.35
_MIN_IMAGE_EDGE = 32
_TEMPORAL_WINDOW = 5
_STREAM_EXPIRE_SECONDS = 180.0
_TEMPORAL_MIN_VOTES = 2
_PROVINCE_LOCK_EXPIRE_SECONDS = 20.0
_STREAM_HISTORY: Dict[str, Dict] = {}
_STREAM_HISTORY_LOCK = Lock()


def _is_dark_scene(image: np.ndarray) -> bool:
    if image is None or image.size == 0:
        return False
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return float(np.mean(gray)) < 90.0


def _apply_clahe(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    merged = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _unsharp_mask(image: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=1.2, sigmaY=1.2)
    return cv2.addWeighted(image, 1.35, blurred, -0.35, 0)


def _gamma_brighten(image: np.ndarray, gamma: float = 1.3) -> np.ndarray:
    inv_gamma = 1.0 / gamma
    table = np.array([(i / 255.0) ** inv_gamma * 255 for i in np.arange(0, 256)]).astype("uint8")
    return cv2.LUT(image, table)


def _build_variants(image: np.ndarray) -> List[Tuple[np.ndarray, float, float]]:
    # 返回 (variant_image, scale_x, scale_y)，用于把检测框映射回原图坐标系
    variants: List[Tuple[np.ndarray, float, float]] = [(image, 1.0, 1.0)]
    enhanced = _unsharp_mask(_apply_clahe(image))
    variants.append((enhanced, 1.0, 1.0))
    h, w = image.shape[:2]
    if min(h, w) < 720:
        up = cv2.resize(enhanced, None, fx=1.4, fy=1.4, interpolation=cv2.INTER_CUBIC)
        variants.append((up, 1.4, 1.4))
    if _is_dark_scene(image):
        variants.append((_gamma_brighten(enhanced, gamma=1.35), 1.0, 1.0))
    # 轻微旋转可提升倾斜车牌识别稳定性
    center = (w // 2, h // 2)
    for angle in (-5.0, 5.0):
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            enhanced,
            matrix,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        variants.append((rotated, 1.0, 1.0))
    return variants


def _normalize_plate_text(code: str) -> str:
    cleaned = (code or "").upper()
    for ch in (" ", "-", "·", ".", "_"):
        cleaned = cleaned.replace(ch, "")
    return cleaned


def _correct_plate_text(code: str) -> str:
    if not code:
        return code
    chars = list(code)
    if len(chars) >= 2 and chars[1] in _SECOND_CHAR_FIX_MAP:
        chars[1] = _SECOND_CHAR_FIX_MAP[chars[1]]
    return "".join(chars)


def _looks_like_cn_plate(code: str) -> bool:
    if len(code) not in (7, 8):
        return False
    if code[0] not in _PROVINCE_PREFIXES:
        return False
    if not ("A" <= code[1] <= "Z"):
        return False
    return bool(_ALNUM_RE.match(code[2:]))


def _iou(a: Dict[str, int], b: Dict[str, int]) -> float:
    ax1, ay1 = a["x"], a["y"]
    ax2, ay2 = ax1 + a["w"], ay1 + a["h"]
    bx1, by1 = b["x"], b["y"]
    bx2, by2 = bx1 + b["w"], by1 + b["h"]

    inter_x1, inter_y1 = max(ax1, bx1), max(ay1, by1)
    inter_x2, inter_y2 = min(ax2, bx2), min(ay2, by2)
    inter_w, inter_h = max(0, inter_x2 - inter_x1), max(0, inter_y2 - inter_y1)
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0
    area_a = a["w"] * a["h"]
    area_b = b["w"] * b["h"]
    union = area_a + area_b - inter
    return float(inter) / float(union) if union > 0 else 0.0


def _merge_candidates(candidates: List[Dict]) -> List[Dict]:
    def _score(item: Dict) -> float:
        # 合法车牌稍微加权，但核心仍看模型置信度
        return float(item.get("confidence", 0.0)) + (0.08 if item.get("is_valid") else 0.0)

    merged: List[Dict] = []
    for cand in sorted(candidates, key=_score, reverse=True):
        found_duplicate = False
        for i, kept in enumerate(merged):
            # 以位置去重：同一位置只保留一个最佳候选，避免“同车多牌”
            if _iou(cand["rect"], kept["rect"]) >= _BOX_IOU_MERGE_THRESHOLD:
                if _score(cand) > _score(kept):
                    merged[i] = cand
                found_duplicate = True
                break
        if not found_duplicate:
            merged.append(cand)
    return merged


def _resolve_province_conflicts(candidates: List[Dict]) -> List[Dict]:
    """同一尾号在多分支出现多个省份时，保留更稳定的一条。"""
    groups: Dict[str, List[Dict]] = {}
    for item in candidates:
        number = item.get("number", "")
        if len(number) < 2:
            continue
        tail = number[1:]
        groups.setdefault(tail, []).append(item)

    selected: List[Dict] = []
    for items in groups.values():
        if len(items) == 1:
            selected.append(items[0])
            continue
        score_map: Dict[str, float] = {}
        best_map: Dict[str, Dict] = {}
        for x in items:
            key = x["number"]
            score_map[key] = score_map.get(key, 0.0) + float(x["confidence"]) + 0.02
            prev = best_map.get(key)
            if prev is None or float(x["confidence"]) > float(prev["confidence"]):
                best_map[key] = x
        best_number = max(score_map, key=score_map.get)
        selected.append(best_map[best_number])
    return selected


def _stabilize_with_temporal_vote(stream_key: str, plates: List[Dict]) -> List[Dict]:
    """
    对连续帧进行省份字投票，减少如“豫/沪/冀”等首字抖动。
    该逻辑仅在同一尾号（去掉首字后）匹配时生效。
    """
    now = time.time()
    key = (stream_key or "default").strip() or "default"

    with _STREAM_HISTORY_LOCK:
        # 清理过期流，避免内存持续增长
        expired_keys = [k for k, v in _STREAM_HISTORY.items() if now - float(v.get("ts", 0.0)) > _STREAM_EXPIRE_SECONDS]
        for k in expired_keys:
            _STREAM_HISTORY.pop(k, None)

        state = _STREAM_HISTORY.get(key)
        if state is None:
            state = {"ts": now, "frames": deque(maxlen=_TEMPORAL_WINDOW), "locks": {}}
            _STREAM_HISTORY[key] = state
        locks: Dict[str, Dict] = state.get("locks", {})

        history_numbers: List[str] = []
        for frame_numbers in state["frames"]:
            history_numbers.extend(frame_numbers)

        # Step 1: 锁定优先。高置信历史可短时间固定同尾号省份字。
        for plate in plates:
            number = plate.get("number", "")
            if len(number) < 2:
                continue
            tail = number[1:]
            lock = locks.get(tail)
            if not lock:
                continue
            if now - float(lock.get("ts", 0.0)) > _PROVINCE_LOCK_EXPIRE_SECONDS:
                locks.pop(tail, None)
                continue
            locked_province = lock.get("province")
            if (
                isinstance(locked_province, str)
                and locked_province in _PROVINCE_PREFIXES
                and locked_province != number[0]
                and float(plate.get("confidence", 0.0)) < 0.92
            ):
                plate["number"] = locked_province + tail

        # Step 2: 若未命中锁，再用投票做柔性修正
        if history_numbers:
            for plate in plates:
                number = plate.get("number", "")
                if len(number) < 2:
                    continue
                tail = number[1:]
                province_votes = [
                    n[0]
                    for n in history_numbers
                    if len(n) == len(number) and n[1:] == tail and n[0] in _PROVINCE_PREFIXES
                ]
                if not province_votes:
                    continue
                vote_counter = Counter(province_votes)
                best_province, vote_count = vote_counter.most_common(1)[0]
                if (
                    best_province != number[0]
                    and vote_count >= _TEMPORAL_MIN_VOTES
                    and vote_count / max(len(province_votes), 1) >= 0.7
                    and float(plate.get("confidence", 0.0)) < 0.90
                ):
                    plate["number"] = best_province + tail

        # Step 3: 更新锁。高置信且格式合法时作为短期锚点。
        for plate in plates:
            number = plate.get("number", "")
            confidence = float(plate.get("confidence", 0.0))
            if len(number) < 2:
                continue
            if not _looks_like_cn_plate(number):
                continue
            if confidence >= 0.93:
                tail = number[1:]
                locks[tail] = {"province": number[0], "ts": now}

        # 清理过期锁
        expired_lock_tails = [tail for tail, lock in locks.items() if now - float(lock.get("ts", 0.0)) > _PROVINCE_LOCK_EXPIRE_SECONDS]
        for tail in expired_lock_tails:
            locks.pop(tail, None)

        state["frames"].append([p.get("number", "") for p in plates if p.get("number")])
        state["ts"] = now
        state["locks"] = locks

    return plates


@app.get("/health")
async def health():
    return {"status": "online", "service": "AI Recognition Service"}


@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    min_confidence: float = Query(0.0, ge=0, le=1, description="最低置信度过滤，低于此值不返回"),
    max_plates: int = Query(0, ge=0, description="最多返回数量，0 表示不限制"),
    stream_key: str = Query("default", description="同一路视频流标识，用于连续帧投票稳定中文首字"),
):
    started_at = time.time()
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise HTTPException(
                status_code=400,
                detail="Failed to decode image. Please ensure the file is a valid image format.",
            )
        h, w = image.shape[:2]
        if h < _MIN_IMAGE_EDGE or w < _MIN_IMAGE_EDGE:
            raise HTTPException(status_code=422, detail="Image is too small for reliable recognition.")

        variants = _build_variants(image)
        candidates: List[Dict] = []
        for variant, scale_x, scale_y in variants:
            for code, confidence, type_idx, box in catcher(variant):
                normalized_code = _normalize_plate_text(code)
                corrected_code = _correct_plate_text(normalized_code)
                looks_valid = _looks_like_cn_plate(corrected_code)
                effective_min_confidence = min_confidence if looks_valid else max(min_confidence, 0.9)
                if confidence < effective_min_confidence:
                    continue
                x1, y1, x2, y2 = box
                # 将各分支检测框统一映射回原图坐标，确保去重逻辑有效
                x1 = int(round(x1 / scale_x))
                y1 = int(round(y1 / scale_y))
                x2 = int(round(x2 / scale_x))
                y2 = int(round(y2 / scale_y))
                bw = x2 - x1
                bh = y2 - y1
                if bw <= 0 or bh <= 0:
                    continue
                plate_type = _PLATE_TYPE_MAP.get(type_idx, "blue")
                if plate_type == "blue" and len(corrected_code) == 8:
                    plate_type = "green"
                candidates.append(
                    {
                        "number": corrected_code,
                        "confidence": float(confidence),
                        "type": plate_type,
                        "is_valid": looks_valid,
                        "rect": {"x": int(x1), "y": int(y1), "w": int(bw), "h": int(bh)},
                    }
                )

        plates = _resolve_province_conflicts(_merge_candidates(candidates))
        plates = _stabilize_with_temporal_vote(stream_key, plates)
        plates.sort(key=lambda p: (p["rect"]["y"], p["rect"]["x"]))
        if max_plates > 0:
            plates = plates[:max_plates]

        for plate in plates:
            if "is_valid" in plate:
                plate.pop("is_valid", None)

        elapsed_ms = int((time.time() - started_at) * 1000)
        print(
            "[AI] recognize",
            {
                "stream_key": stream_key,
                "min_confidence": min_confidence,
                "max_plates": max_plates,
                "variants": len(variants),
                "plate_count": len(plates),
                "elapsed_ms": elapsed_ms,
            },
        )
        return {"plates": plates}

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")


def run():
    uvicorn.run(app, host="0.0.0.0", port=8001)


if __name__ == "__main__":
    run()

