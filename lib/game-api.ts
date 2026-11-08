export type Box = { x: number; y: number; w: number; h: number };

export type Character = { id: string; name: string; hint: string };

export type Photo = { id: string; title: string; src: string; width: number; height: number };

export type Game = { photo: Photo; characters: Character[] };

export type GuessResult = { correct: boolean; box?: Box; finished: boolean };

export const TARGET_RADIUS = 0.015;

const photos: Photo[] = [
  { id: "crowd", title: "The Crowd", src: "/photos/placeholder.svg", width: 1600, height: 1000 },
];

const characters: (Character & { box: Box })[] = [
  {
    id: "waldo",
    name: "Waldo",
    hint: "Red and white stripes, round glasses",
    box: { x: 0.735, y: 0.296, w: 0.015, h: 0.058 },
  },
  {
    id: "wizard",
    name: "The Wizard",
    hint: "Blue robe, white beard, tall red hat",
    box: { x: 0.2425, y: 0.654, w: 0.0175, h: 0.068 },
  },
  {
    id: "wilma",
    name: "Wilma",
    hint: "Striped dress, brown hair, red bobble",
    box: { x: 0.52, y: 0.162, w: 0.0175, h: 0.052 },
  },
];

const found = new Set<string>();

function ringTouchesBox(x: number, y: number, box: Box, heightPerWidth: number) {
  const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
  const dy = Math.max(box.y - y, 0, y - (box.y + box.h)) * heightPerWidth;
  return dx * dx + dy * dy <= TARGET_RADIUS * TARGET_RADIUS;
}

export async function listPhotos(): Promise<Photo[]> {
  return photos;
}

export async function startGame(photoId: string): Promise<Game | null> {
  const photo = photos.find((p) => p.id === photoId);
  if (!photo) return null;
  found.clear();
  return {
    photo,
    characters: characters.map(({ id, name, hint }) => ({ id, name, hint })),
  };
}

export async function submitGuess(characterId: string, x: number, y: number): Promise<GuessResult> {
  const box = characters.find((c) => c.id === characterId)?.box;
  const correct = !!box && ringTouchesBox(x, y, box, photos[0].height / photos[0].width);
  if (!correct) return { correct: false, finished: false };
  found.add(characterId);
  return { correct: true, box, finished: found.size === characters.length };
}
