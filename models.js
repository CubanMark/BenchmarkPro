import { APP_VERSION, DATA_VERSION } from "./version.js";

export function createEmptyState() {
  const now = new Date().toISOString();
  return {
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    meta: { createdAt: now, updatedAt: now },
    exercises: [],
    plans: [],
    workouts: []
  };
}

export function getDefaultExercises() {
  return [
  {
    "id": "box_squat",
    "name": "Box Squat",
    "aliases": []
  },
  {
    "id": "bench_press",
    "name": "Bench Press",
    "aliases": []
  },
  {
    "id": "barbell_row",
    "name": "Barbell Row",
    "aliases": [
      "Barbell Rows"
    ]
  },
  {
    "id": "lateral_raise",
    "name": "Lateral Raise",
    "aliases": [
      "Lateral Raises"
    ]
  },
  {
    "id": "glute_bridge_bilateral",
    "name": "Glute Bridge (bilateral)",
    "aliases": [
      "Glute Bridge bilateral",
      "Glute Bridge"
    ]
  },
  {
    "id": "mcgill_big_3",
    "name": "McGill Big 3",
    "aliases": [
      "McGill Big Three"
    ]
  },
  {
    "id": "romanian_dead_lift",
    "name": "Romanian Dead Lift",
    "aliases": [
      "RDL",
      "Romanian Deadlift"
    ]
  },
  {
    "id": "incline_bench_press",
    "name": "Incline Bench Press",
    "aliases": []
  },
  {
    "id": "pull_ups_strict",
    "name": "Pull-ups (strict)",
    "aliases": [
      "Pullups (strict)",
      "Pull ups (strict)"
    ]
  },
  {
    "id": "pull_ups_toe_assisted",
    "name": "Pull-ups (Toe-assisted)",
    "aliases": [
      "Pull-ups (toe assisted)",
      "Pullups (Toe-assisted)"
    ]
  },
  {
    "id": "w_raises",
    "name": "W-Raises",
    "aliases": [
      "W Raises"
    ]
  },
  {
    "id": "bench_press_close_grip",
    "name": "Bench Press (Close-Grip)",
    "aliases": [
      "CGBP",
      "Close Grip Bench Press"
    ]
  },
  {
    "id": "inverted_row",
    "name": "Inverted Row",
    "aliases": [
      "Body Row",
      "Inverted Rows"
    ]
  }
];
}

export function getDefaultPlans() {
  return [
  {
    "id": "homegym_a",
    "name": "Home Gym A",
    "exerciseIds": [
      "box_squat",
      "bench_press",
      "barbell_row",
      "lateral_raise",
      "glute_bridge_bilateral",
      "mcgill_big_3"
    ],
    "isDefault": true
  },
  {
    "id": "homegym_b",
    "name": "Home Gym B",
    "exerciseIds": [
      "romanian_dead_lift",
      "incline_bench_press",
      "pull_ups_strict",
      "pull_ups_toe_assisted",
      "w_raises"
    ],
    "isDefault": true
  },
  {
    "id": "homegym_c",
    "name": "Home Gym C",
    "exerciseIds": [
      "box_squat",
      "bench_press_close_grip",
      "inverted_row",
      "glute_bridge_bilateral",
      "w_raises",
      "mcgill_big_3"
    ],
    "isDefault": true
  }
];
}

export function isLikelyState(obj) {
  return obj && typeof obj === "object"
    && Array.isArray(obj.exercises)
    && Array.isArray(obj.plans)
    && Array.isArray(obj.workouts)
    && typeof obj.dataVersion === "number";
}
