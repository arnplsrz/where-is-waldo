import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { prisma } from "./db";
import type { ScoreMessage } from "./publish";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const db = await prisma();
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      const { sessionId, photoId, name, elapsedMs } = JSON.parse(record.body) as ScoreMessage;
      await db.score.createMany({ data: [{ sessionId, photoId, name, elapsedMs }], skipDuplicates: true });
    } catch (error) {
      console.error(record.messageId, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
