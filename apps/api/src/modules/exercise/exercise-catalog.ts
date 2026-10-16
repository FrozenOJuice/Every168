import type { ExerciseCatalogDefinition } from "@168hours/contracts";

// A small owned catalogue. Visual assets are intentionally supplied separately.
export const exerciseCatalog: ExerciseCatalogDefinition[] = [
  {
    key: "barbell-bench-press",
    name: "Bench press",
    equipment: "Barbell",
    muscles: ["Chest", "Shoulders", "Arms"],
    loggingType: "reps_load",
    notes:
      "Lie on a flat bench and press the barbell upward from your chest. Lower it with control between repetitions.",
  },
  {
    key: "dumbbell-bench-press",
    name: "Dumbbell bench press",
    equipment: "Dumbbells",
    muscles: ["Chest", "Shoulders", "Arms"],
    loggingType: "reps_load",
    notes:
      "Press two dumbbells above your chest while lying on a flat bench. Lower them with control between repetitions.",
  },
  {
    key: "push-up",
    name: "Push-up",
    equipment: "Bodyweight",
    muscles: ["Chest", "Shoulders", "Arms"],
    loggingType: "reps",
    notes:
      "From a supported plank position, bend your elbows to lower your body, then press back up. Keep your torso steady through the movement.",
  },
  {
    key: "barbell-squat",
    name: "Squat",
    equipment: "Barbell",
    muscles: ["Legs"],
    loggingType: "reps_load",
    notes:
      "With the bar supported across your upper back, bend your hips and knees to squat, then stand. Use a range of motion you can control.",
  },
  {
    key: "goblet-squat",
    name: "Goblet squat",
    equipment: "Dumbbells",
    muscles: ["Legs", "Core"],
    loggingType: "reps_load",
    notes:
      "Hold a dumbbell in front of your chest as you squat down and stand back up.",
  },
  {
    key: "leg-extension",
    name: "Leg extension",
    equipment: "Machine",
    muscles: ["Legs"],
    loggingType: "reps_load",
    notes:
      "Sit in the leg-extension machine with its pad against your lower legs. Extend your knees, then lower the pad with control.",
  },
  {
    key: "leg-curl",
    name: "Leg curl",
    equipment: "Machine",
    muscles: ["Legs"],
    loggingType: "reps_load",
    notes:
      "Use the leg-curl machine to bend your knees against its resistance, then return with control. Follow the adjustment instructions on your machine.",
  },
  {
    key: "leg-press",
    name: "Leg press",
    equipment: "Machine",
    muscles: ["Legs"],
    loggingType: "reps_load",
    notes:
      "Use the leg-press machine to press its platform away with your feet, then return with control. Follow the adjustment instructions on your machine.",
  },
  {
    key: "lat-pulldown",
    name: "Lat pulldown",
    equipment: "Cable",
    muscles: ["Back", "Arms"],
    loggingType: "reps_load",
    notes:
      "From a seated position, pull the overhead handle toward your upper chest, then return it with control.",
  },
  {
    key: "seated-cable-row",
    name: "Seated cable row",
    equipment: "Cable",
    muscles: ["Back", "Arms"],
    loggingType: "reps_load",
    notes:
      "Sit at the cable row and pull the handle toward your torso. Return it with control while keeping your torso steady.",
  },
  {
    key: "dumbbell-row",
    name: "Dumbbell row",
    equipment: "Dumbbells",
    muscles: ["Back", "Arms"],
    loggingType: "reps_load",
    notes:
      "With your torso supported, pull a dumbbell toward your side, then lower it with control. Record repetitions for the side you are training.",
  },
  {
    key: "shoulder-press",
    name: "Shoulder press",
    equipment: "Dumbbells",
    muscles: ["Shoulders", "Arms"],
    loggingType: "reps_load",
    notes:
      "Press dumbbells upward from shoulder height, then lower them with control.",
  },
  {
    key: "lateral-raise",
    name: "Lateral raise",
    equipment: "Dumbbells",
    muscles: ["Shoulders"],
    loggingType: "reps_load",
    notes:
      "Raise dumbbells out to your sides, then lower them with control. Keep the movement steady rather than swinging the weights.",
  },
  {
    key: "biceps-curl",
    name: "Biceps curl",
    equipment: "Dumbbells",
    muscles: ["Arms"],
    loggingType: "reps_load",
    notes:
      "Bend your elbows to curl the dumbbells upward, then lower them with control.",
  },
  {
    key: "triceps-pushdown",
    name: "Triceps pushdown",
    equipment: "Cable",
    muscles: ["Arms"],
    loggingType: "reps_load",
    notes:
      "With your upper arms near your sides, extend your elbows to press the cable handle down, then return with control.",
  },
  {
    key: "plank",
    name: "Plank",
    equipment: "Bodyweight",
    muscles: ["Core"],
    loggingType: "duration",
    notes:
      "Hold a supported plank position on your forearms and toes, keeping your body steady. Record how long you hold the position.",
  },
];
