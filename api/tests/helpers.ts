import { prisma } from "../src/db";

export const photo = { id: "test-photo", title: "Test", src: "/photos/test.svg", width: 1000, height: 500 };
export const characters = [
  { id: "a", name: "Alpha", hint: "left", x: 0.1, y: 0.1, w: 0.02, h: 0.04 },
  { id: "b", name: "Bravo", hint: "right", x: 0.8, y: 0.8, w: 0.02, h: 0.04 },
];
export const centerOf = (c: (typeof characters)[number]) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

export async function resetDb() {
  const db = await prisma();
  await db.$transaction([db.score.deleteMany(), db.character.deleteMany(), db.photo.deleteMany()]);
  await db.photo.create({ data: { ...photo, characters: { create: characters } } });
}
