import { existsSync } from "node:fs";
import { prisma } from "../src/db";

if (existsSync(".env")) process.loadEnvFile();

async function main() {
  const db = await prisma();
  await db.photo.upsert({
    where: { id: "crowd" },
    update: {},
    create: {
      id: "crowd",
      title: "The Crowd",
      src: "/photos/placeholder.svg",
      width: 1600,
      height: 1000,
      characters: {
        create: [
          { id: "waldo", name: "Waldo", hint: "Red and white stripes, round glasses", x: 0.735, y: 0.296, w: 0.015, h: 0.058 },
          { id: "wizard", name: "The Wizard", hint: "Blue robe, white beard, tall red hat", x: 0.2425, y: 0.654, w: 0.0175, h: 0.068 },
          { id: "wilma", name: "Wilma", hint: "Striped dress, brown hair, red bobble", x: 0.52, y: 0.162, w: 0.0175, h: 0.052 },
        ],
      },
    },
  });
  await db.$disconnect();
}

main();
