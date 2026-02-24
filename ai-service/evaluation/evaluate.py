import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass
class Metrics:
    tp: int
    fp: int
    fn: int
    precision: float
    recall: float
    f1: float
    exact_match: float


def load_records(path: Path) -> List[Dict]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_plate(text: str) -> str:
    return (text or "").replace("·", "").replace(" ", "").upper().strip()


def evaluate(ground_truth: List[Dict], predictions: List[Dict]) -> Metrics:
    gt_map = {item["image"]: normalize_plate(item["plate"]) for item in ground_truth}
    pred_map = {item["image"]: normalize_plate(item["plate"]) for item in predictions}

    tp = 0
    fp = 0
    fn = 0
    exact_match_count = 0

    for image, gt_plate in gt_map.items():
        pred_plate = pred_map.get(image, "")
        if pred_plate:
            if pred_plate == gt_plate:
                tp += 1
                exact_match_count += 1
            else:
                fp += 1
                fn += 1
        else:
            fn += 1

    for image, pred_plate in pred_map.items():
        if image not in gt_map and pred_plate:
            fp += 1

    precision = tp / (tp + fp) if tp + fp > 0 else 0.0
    recall = tp / (tp + fn) if tp + fn > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0.0
    exact_match = exact_match_count / len(gt_map) if gt_map else 0.0

    return Metrics(
        tp=tp,
        fp=fp,
        fn=fn,
        precision=precision,
        recall=recall,
        f1=f1,
        exact_match=exact_match,
    )


def pretty_print(metrics: Metrics) -> None:
    print("=== Smart LPR Evaluation ===")
    print(f"TP: {metrics.tp}")
    print(f"FP: {metrics.fp}")
    print(f"FN: {metrics.fn}")
    print(f"Precision: {metrics.precision:.4f}")
    print(f"Recall: {metrics.recall:.4f}")
    print(f"F1 Score: {metrics.f1:.4f}")
    print(f"Exact Match Accuracy: {metrics.exact_match:.4f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate LPR predictions with Precision/Recall/F1.")
    parser.add_argument("--ground-truth", required=True, help="Ground truth json path")
    parser.add_argument("--predictions", required=True, help="Prediction json path")
    args = parser.parse_args()

    gt_path = Path(args.ground_truth)
    pred_path = Path(args.predictions)

    ground_truth = load_records(gt_path)
    predictions = load_records(pred_path)
    metrics = evaluate(ground_truth, predictions)
    pretty_print(metrics)


if __name__ == "__main__":
    main()

