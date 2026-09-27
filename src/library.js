/**
 * Kuratierte Übungsbibliothek, Snack-Vorlagen und Equipment-Logik (v5).
 * Die Daten hier sind Vorgaben. Im State landen Kopien, die der Nutzer anpassen kann.
 */

export const AREAS = [
  { id: "brust", name: "Brust", target: 6 },
  { id: "ruecken", name: "Rücken", target: 8 },
  { id: "schultern", name: "Schultern", target: 4 },
  { id: "beine", name: "Beine", target: 8 },
  { id: "huefte", name: "Hüfte & Gesäß", target: 6 },
  { id: "rumpf", name: "Rumpf", target: 4 },
  { id: "arme", name: "Arme", target: 0 },
  { id: "mobility", name: "Mobility", target: 3 },
];

export const LOCATIONS = { K: "Keller", Z: "Klimmzugstange", U: "Überall" };

export const SPORTS = ["Padel", "Tennis", "Fußball", "Anderes"];

/** Gewichtsstufen je Equipment. kh2 = Kurzhantel-Paar (4 × 1,25, 4 × 2,5, je 2 × 5/10/20 kg, Stange ~1 kg). */
const KH2_STEPS = [1, 3.5, 6, 8.5, 11, 13.5, 21, 23.5];

export function weightSteps(eq, settings) {
  if (eq === "lh") return range(10, 97.5, 2.5);
  if (eq === "kh2") return KH2_STEPS;
  if (eq === "kh1") return [1, ...range(3.5, 43.5, 2.5)];
  if (eq === "kb") return [Number(settings?.kbWeight) || 10];
  return [0];
}

function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function nextWeight(eq, current, dir, settings) {
  const steps = weightSteps(eq, settings);
  if (steps.length <= 1) return steps[0];
  const cur = Number(current) || 0;
  if (dir > 0) return steps.find((s) => s > cur + 1e-9) ?? steps[steps.length - 1];
  const lower = steps.filter((s) => s < cur - 1e-9);
  return lower.length ? lower[lower.length - 1] : steps[0];
}

/**
 * id, name, area, eq (lh|kh2|kh1|kb|band|none), loc (K|Z|U), kind (weight|reps|time|task),
 * defKg (Startgewicht ohne Historie), rating (Vorgabe aus Markus' Übungsauswahl), hint (Kurzanleitung).
 */
const L = (id, name, area, eq, loc, kind, defKg, rating, hint = "", aliases = []) =>
  ({ id, name, area, eq, loc, kind, defKg, rating, hint, aliases });

export const LIBRARY = [
  // Brust
  L("bench_press", "Bankdrücken", "brust", "lh", "K", "weight", 40, "love", "Wegen der Ablage nicht ans Limit gehen, immer 2 Wiederholungen Reserve.", ["Bench Press"]),
  L("incline_bench_press", "Schrägbankdrücken", "brust", "lh", "K", "weight", 30, "love", "", ["Incline Bench Press"]),
  L("bench_press_close_grip", "Enges Bankdrücken", "brust", "lh", "K", "weight", 30, "love", "", ["Bench Press (Close-Grip)", "CGBP", "Close Grip Bench Press"]),
  L("db_bench", "KH-Bankdrücken", "brust", "kh2", "K", "weight", 11, "love"),
  L("db_incline", "KH-Schrägbankdrücken", "brust", "kh2", "K", "weight", 8.5, "love"),
  L("db_fly", "KH-Fliegende", "brust", "kh2", "K", "weight", 6, null, "Arme leicht gebeugt, langsam absenken bis zur Dehnung in der Brust."),
  L("pushup", "Liegestütz", "brust", "none", "U", "reps", 0, "ok", "Auf Fäusten oder Griffen schont das Handgelenk."),
  L("pushup_inc", "Liegestütz erhöht", "brust", "none", "U", "reps", 0, "ok", "Hände auf Tisch, Bank oder Wand. Gut fürs Büro."),
  L("band_press", "Band-Brustpresse", "brust", "band", "U", "reps", 0, null, "Band hinter dem Rücken befestigen, nach vorne drücken."),
  // Rücken
  L("barbell_row", "Langhantel-Rudern", "ruecken", "lh", "K", "weight", 30, "ok", "", ["Barbell Row", "Barbell Rows"]),
  L("db_row", "KH-Rudern einarmig", "ruecken", "kh1", "K", "weight", 16, "ok", "Eine Hand und ein Knie auf der Bank, Rücken gerade.", ["Einarmiges KH-Rudern"]),
  L("db_row_inc", "Brustgestütztes KH-Rudern", "ruecken", "kh2", "K", "weight", 8.5, null, "Bauchlage auf der Schrägbank, Kurzhanteln zur Hüfte ziehen. Schont den unteren Rücken."),
  L("pull_ups_strict", "Klimmzüge", "ruecken", "none", "Z", "reps", 0, "love", "", ["Pull-ups (strict)", "Pullups (strict)", "Pull ups (strict)"]),
  L("pull_ups_toe_assisted", "Klimmzüge fuß-assistiert", "ruecken", "none", "Z", "reps", 0, "love", "Füße auf einem Stuhl, nur so viel helfen wie nötig.", ["Pull-ups (Toe-assisted)", "Pull-ups (toe assisted)", "Pullups (Toe-assisted)"]),
  L("inverted_row", "Inverted Row", "ruecken", "lh", "K", "reps", 0, "ok", "Körper schräg unter der Stange im Rack, Brust zur Stange ziehen.", ["Body Row", "Inverted Rows", "Invertiertes Rudern"]),
  L("kb_row", "Kettlebell-Rudern", "ruecken", "kb", "U", "weight", 10, null, "Vorgebeugt, Kettlebell einarmig zur Hüfte ziehen."),
  L("band_row", "Band-Rudern", "ruecken", "band", "U", "reps", 0, null, "Band auf Brusthöhe befestigen, Ellbogen nah am Körper nach hinten ziehen."),
  L("pull_apart", "Band Pull-Aparts", "ruecken", "band", "U", "reps", 0, null, "Band mit gestreckten Armen vor der Brust auseinanderziehen. Keine Befestigung nötig."),
  L("dead_hang", "Hängen an der Stange", "ruecken", "none", "Z", "time", 0, null, "Locker hängen, Schultern leicht aktiv. Entlastet die Wirbelsäule."),
  // Schultern
  L("ohp", "Schulterdrücken stehend", "schultern", "lh", "K", "weight", 25, "no"),
  L("db_ohp", "KH-Schulterdrücken sitzend", "schultern", "kh2", "K", "weight", 8.5, "love", "Schrägbank fast senkrecht, Rücken angelehnt."),
  L("lateral_raise", "Seitheben", "schultern", "kh2", "K", "weight", 3.5, "love", "", ["Lateral Raise", "Lateral Raises"]),
  L("rear_delt", "Vorgebeugtes Seitheben", "schultern", "kh2", "K", "weight", 3.5, null, "Oberkörper vorgebeugt, Arme seitlich anheben. Hintere Schulter."),
  L("band_lat", "Band-Seitheben", "schultern", "band", "U", "reps", 0, null, "Auf das Band stellen, Arme seitlich bis Schulterhöhe heben."),
  L("face_pull", "Face Pulls", "schultern", "band", "U", "reps", 0, null, "Band auf Kopfhöhe befestigen, zum Gesicht ziehen, Ellbogen hoch."),
  L("w_raises", "W-Raises", "schultern", "none", "U", "reps", 0, "love", "", ["W-Raises", "W Raises"]),
  L("kb_halo", "Kettlebell Halo", "schultern", "kb", "U", "reps", 0, null, "Kettlebell langsam um den Kopf kreisen, Rumpf fest."),
  // Beine
  L("box_squat", "Box Squat", "beine", "lh", "K", "weight", 40, "love", "", ["Box Squat"]),
  L("squat", "Kniebeuge", "beine", "lh", "K", "weight", 40, "love"),
  L("goblet", "Goblet Squat", "beine", "kh1", "K", "weight", 16, "love", "Kurzhantel senkrecht vor der Brust halten."),
  L("db_lunge", "KH-Ausfallschritte", "beine", "kh2", "K", "weight", 6, "love", "", ["Ausfallschritte"]),
  L("bss", "Bulgarian Split Squat", "beine", "kh2", "K", "weight", 3.5, null, "Hinterer Fuß auf der Bank. Schon mit wenig Gewicht hart."),
  L("split", "Split Squat", "beine", "none", "U", "reps", 0, null, "Schrittstellung, hinteres Knie Richtung Boden senken."),
  L("stepup", "Step-ups", "beine", "kh2", "K", "weight", 3.5, null, "Auf die Bank steigen, vorderes Bein arbeitet."),
  L("wall_sit", "Wandsitzen", "beine", "none", "U", "time", 0, "love", "Rücken an der Wand, Knie etwa 90 Grad."),
  L("air_squat", "Kniebeugen ohne Gewicht", "beine", "none", "U", "reps", 0, "ok"),
  // Hüfte & Gesäß
  L("romanian_dead_lift", "Romanian Deadlift", "huefte", "lh", "K", "weight", 40, "love", "", ["Romanian Dead Lift", "RDL", "Romanian Deadlift"]),
  L("deadlift", "Kreuzheben", "huefte", "lh", "K", "weight", 50, "ok", "Mit Blick auf die Bandscheibe eher moderat, saubere Technik vor Gewicht."),
  L("kb_swing", "Kettlebell Swing", "huefte", "kb", "K", "weight", 10, "love", "Bewegung kommt aus der Hüfte, nicht aus den Armen."),
  L("hip_thrust", "Hip Thrust", "huefte", "lh", "K", "weight", 40, null, "Schultern auf der Bank, Hüfte nach oben strecken."),
  L("glute_bridge_bilateral", "Glute Bridge", "huefte", "lh", "U", "weight", 0, "love", "Ohne Gewicht überall möglich, mit Langhantel im Keller.", ["Glute Bridge (bilateral)", "Glute Bridge bilateral", "Glute Bridge", "Hüftheben/Glute Bridge"]),
  L("sl_rdl", "Einbeiniges Kreuzheben", "huefte", "kb", "U", "weight", 10, null, "Auf einem Bein nach vorne neigen. Trainiert auch die Balance."),
  L("band_walk", "Band Side Walks", "huefte", "band", "U", "reps", 0, null, "Mini-Band um die Knie, seitlich gehen."),
  // Rumpf
  L("mcgill_big_3", "McGill Big 3", "rumpf", "none", "U", "reps", 0, "love", "Curl-up, Seitstütz und Bird Dog als eine Runde.", ["McGill Big Three"]),
  L("dead_bug", "Dead Bug", "rumpf", "none", "U", "reps", 0, null, "Rückenlage, gegengleich Arm und Bein strecken, unterer Rücken bleibt am Boden."),
  L("plank", "Unterarmstütz", "rumpf", "none", "U", "time", 0, "love", "", ["Plank"]),
  L("side_plank", "Seitstütz", "rumpf", "none", "U", "time", 0, "love", "Pro Seite."),
  L("pallof", "Pallof Press", "rumpf", "band", "U", "reps", 0, null, "Band seitlich befestigen, vor der Brust wegdrücken, nicht mitdrehen."),
  L("suitcase", "Suitcase Carry", "rumpf", "kh1", "U", "time", 0, null, "Eine Kurzhantel oder Kettlebell seitlich tragen und aufrecht gehen."),
  L("ab_roll", "Ab-Roller kniend", "rumpf", "none", "U", "reps", 0, "love", "Nur so weit rollen, wie der Rücken gerade bleibt."),
  L("hang_knee", "Knieheben hängend", "rumpf", "none", "Z", "reps", 0, null, "An der Stange hängen, Knie kontrolliert zur Brust ziehen."),
  // Arme
  L("bb_curl", "Langhantel-Curls", "arme", "lh", "K", "weight", 20, null),
  L("db_curl", "KH-Curls", "arme", "kh2", "K", "weight", 8.5, "love", "", ["Bizepscurls"]),
  L("hammer", "Hammer Curls", "arme", "kh2", "K", "weight", 8.5, null, "Daumen zeigen nach oben."),
  L("band_tri", "Band-Trizepsdrücken", "arme", "band", "U", "reps", 0, null, "Band oben befestigen, Arme nach unten strecken."),
  L("skull", "Skullcrusher", "arme", "lh", "K", "weight", 15, null, "Auf der Bank liegend Stange zur Stirn senken."),
  L("oh_tri", "Trizeps über Kopf", "arme", "kh1", "U", "weight", 8.5, "love", "", ["Trizepsstrecken"]),
  // Mobility
  L("catcow", "Cat-Cow", "mobility", "none", "U", "task", 0, "love", "Im Vierfüßlerstand abwechselnd rund und hohl machen."),
  L("hip_9090", "90/90 Hüfte", "mobility", "none", "U", "task", 0, "love", "Beide Beine im 90-Grad-Winkel am Boden, Oberkörper über das vordere Bein neigen."),
  L("openbook", "Brustwirbel-Rotation", "mobility", "none", "U", "task", 0, null, "Seitlage, oberen Arm wie ein Buch nach hinten aufklappen."),
  L("hipflex", "Hüftbeuger-Dehnung", "mobility", "none", "U", "task", 0, null, "Kniender Ausfallschritt, Hüfte nach vorne schieben."),
  L("wgs", "World's Greatest Stretch", "mobility", "none", "U", "task", 0, null, "Tiefer Ausfallschritt, Ellbogen zum Boden, dann Arm nach oben aufdrehen."),
  L("deep_squat", "Tiefe Hocke halten", "mobility", "none", "U", "task", 0, "love"),
  L("dislocate", "Schulter-Durchzug mit Band", "mobility", "band", "U", "task", 0, null, "Band weit greifen, gestreckt über den Kopf nach hinten führen."),
  L("foam_leg", "Faszienrolle Beine", "mobility", "none", "U", "task", 0, "love"),
  L("fascia_ball", "Faszienball Gesäß und Fuß", "mobility", "none", "U", "task", 0, "love"),
];

/**
 * Snack-Vorlagen. items: { exerciseId, sets, reps } oder bei Mobility { exerciseId, detail }.
 * energy: bei welcher Tagesform der Snack passt (1 platt, 2 okay, 3 fit).
 * legs: belastet die Beine stark (nach Sport am selben Tag nicht vorschlagen).
 */
const S = (id, name, area, type, minutes, loc, energy, items, legs = false) =>
  ({ id, name, area, type, minutes, loc, energy, items, legs });

export const SNACKS = [
  S("brust_kh", "Brust kompakt", "brust", "strength", 8, "K", [2, 3], [
    { exerciseId: "db_bench", sets: 3, reps: 10 }]),
  S("brust_lh", "Bankdrücken-Snack", "brust", "strength", 10, "K", [3], [
    { exerciseId: "bench_press", sets: 3, reps: 6 }]),
  S("brust_liege", "Liegestütz", "brust", "strength", 5, "U", [1, 2, 3], [
    { exerciseId: "pushup", sets: 3, reps: 10 }]),
  S("ruecken_klimm", "Klimmzug-Snack", "ruecken", "strength", 6, "Z", [2, 3], [
    { exerciseId: "pull_ups_toe_assisted", sets: 3, reps: 6 },
    { exerciseId: "dead_hang", sets: 2, reps: 30 }]),
  S("ruecken_kh", "Rücken kompakt", "ruecken", "strength", 8, "K", [2, 3], [
    { exerciseId: "db_row", sets: 3, reps: 10 },
    { exerciseId: "w_raises", sets: 2, reps: 12 }]),
  S("ruecken_leicht", "Rücken leicht", "ruecken", "strength", 5, "U", [1, 2], [
    { exerciseId: "w_raises", sets: 3, reps: 12 },
    { exerciseId: "pull_apart", sets: 2, reps: 15 }]),
  S("schulter_kh", "Schultern kompakt", "schultern", "strength", 8, "K", [2, 3], [
    { exerciseId: "db_ohp", sets: 3, reps: 10 },
    { exerciseId: "lateral_raise", sets: 3, reps: 12 }]),
  S("schulter_leicht", "Schultern leicht", "schultern", "strength", 5, "U", [1, 2], [
    { exerciseId: "w_raises", sets: 2, reps: 12 },
    { exerciseId: "band_lat", sets: 2, reps: 15 }]),
  S("beine_kh", "Beine kompakt", "beine", "strength", 9, "K", [2, 3], [
    { exerciseId: "goblet", sets: 3, reps: 10 },
    { exerciseId: "db_lunge", sets: 2, reps: 8 }], true),
  S("beine_box", "Box-Squat-Snack", "beine", "strength", 10, "K", [3], [
    { exerciseId: "box_squat", sets: 3, reps: 6 }], true),
  S("beine_buero", "Beine ohne Gerät", "beine", "strength", 5, "U", [1, 2, 3], [
    { exerciseId: "wall_sit", sets: 3, reps: 45 },
    { exerciseId: "air_squat", sets: 2, reps: 15 }]),
  S("huefte_rdl", "Hüfte kompakt", "huefte", "strength", 9, "K", [2, 3], [
    { exerciseId: "romanian_dead_lift", sets: 3, reps: 8 },
    { exerciseId: "glute_bridge_bilateral", sets: 2, reps: 12 }], true),
  S("huefte_swing", "Kettlebell-Swings", "huefte", "strength", 6, "K", [2, 3], [
    { exerciseId: "kb_swing", sets: 5, reps: 15 }]),
  S("huefte_bridge", "Glute Bridges", "huefte", "strength", 5, "U", [1, 2], [
    { exerciseId: "glute_bridge_bilateral", sets: 3, reps: 15 }]),
  S("rumpf_mcgill", "McGill Big 3", "rumpf", "strength", 8, "U", [1, 2, 3], [
    { exerciseId: "mcgill_big_3", sets: 1, reps: 3 }]),
  S("rumpf_stabil", "Rumpf stabil", "rumpf", "strength", 6, "U", [1, 2, 3], [
    { exerciseId: "plank", sets: 3, reps: 40 },
    { exerciseId: "side_plank", sets: 2, reps: 30 }]),
  S("rumpf_roller", "Ab-Roller", "rumpf", "strength", 5, "K", [2, 3], [
    { exerciseId: "ab_roll", sets: 3, reps: 8 }]),
  S("arme_kh", "Arme kompakt", "arme", "strength", 8, "K", [2, 3], [
    { exerciseId: "db_curl", sets: 3, reps: 10 },
    { exerciseId: "oh_tri", sets: 3, reps: 12 }]),
  S("mob_morgen", "Morgen-Mobility", "mobility", "mobility", 6, "U", [1, 2, 3], [
    { exerciseId: "catcow", detail: "60 s" },
    { exerciseId: "openbook", detail: "2 × 8 pro Seite" },
    { exerciseId: "hip_9090", detail: "2 × 45 s pro Seite" },
    { exerciseId: "hipflex", detail: "2 × 30 s pro Seite" }]),
  S("mob_sport", "Nach dem Sport", "mobility", "mobility", 8, "U", [1, 2, 3], [
    { exerciseId: "foam_leg", detail: "2 Minuten" },
    { exerciseId: "fascia_ball", detail: "je Seite 1 Minute" },
    { exerciseId: "hipflex", detail: "2 × 30 s pro Seite" },
    { exerciseId: "deep_squat", detail: "2 × 30 s" }]),
  S("mob_buero", "Büro-Mobility", "mobility", "mobility", 5, "U", [1, 2, 3], [
    { exerciseId: "deep_squat", detail: "30 s" },
    { exerciseId: "wgs", detail: "3 pro Seite" },
    { exerciseId: "hipflex", detail: "30 s pro Seite" },
    { exerciseId: "dislocate", detail: "10 ×" }]),
];

export const DEFAULT_SETTINGS = {
  weeklyGoal: 8,
  strengthMin: 5,
  dailyCap: 4,
  points: { workout: 3, snack: 1, mobility: 1 },
  kbWeight: 10,
  reminder: { enabled: false, time: "18:30" },
  restSeconds: 90,
  paiGoal: 100,
};

export function areaName(id) {
  return AREAS.find((a) => a.id === id)?.name || "Sonstiges";
}

/** Rät den Zielbereich für eine unbekannte, selbst angelegte Übung anhand des Namens. */
export function guessArea(name) {
  const n = String(name || "").toLowerCase();
  const rules = [
    ["mobility", /(dehn|stretch|mobil|faszi|rolle|yoga)/],
    ["rumpf", /(plank|stütz|crunch|core|rumpf|ab |roller|mcgill|bird|dead bug|pallof)/],
    ["brust", /(bank|bench|brust|chest|liegestütz|push|fly|flieg|dip)/],
    ["schultern", /(schulter|shoulder|seitheb|lateral|face|raise|delt)/],
    ["ruecken", /(rudern|row|klimm|pull|lat|(^|[^d])rücken|zug)/],
    ["huefte", /(deadlift|kreuz|rdl|hip|glute|bridge|swing|gesäß|hüft)/],
    ["beine", /(squat|kniebeu|lunge|ausfall|bein|leg|step|wade)/],
    ["arme", /(curl|trizeps|bizeps|tricep|bicep|skull|arm)/],
  ];
  for (const [area, re] of rules) if (re.test(n)) return area;
  return "sonstiges";
}
