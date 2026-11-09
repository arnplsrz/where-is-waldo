import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

export type ScoreMessage = { sessionId: string; photoId: string; name: string; elapsedMs: number };

const sns = new SNSClient({});

export async function publishScore(score: ScoreMessage) {
  await sns.send(new PublishCommand({ TopicArn: process.env.SCORES_TOPIC_ARN, Message: JSON.stringify(score) }));
}
