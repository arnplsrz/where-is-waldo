import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { prisma } from "./db";

export type ScoreMessage = { sessionId: string; photoId: string; name: string; elapsedMs: number };

const sns = new SNSClient({});

export async function publishScore(score: ScoreMessage) {
  if (!process.env.SCORES_TOPIC_ARN) {
    const db = await prisma();
    await db.score.createMany({ data: [score], skipDuplicates: true });
    return;
  }
  await sns.send(new PublishCommand({ TopicArn: process.env.SCORES_TOPIC_ARN, Message: JSON.stringify(score) }));
}
