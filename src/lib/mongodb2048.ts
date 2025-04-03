import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const client = uri ? new MongoClient(uri) : null;
const getCollectionName = (size: number) => `scores_${size}x${size}`;

export async function getTopScores(size = 4, limit = 10) {
  if (!client) return [];
  try {
    await client.connect();
    const database = client.db("game2048");
    const collectionName = getCollectionName(size);
    const collections = await database.listCollections({name: collectionName}).toArray();
    if (collections.length === 0) {
        await database.createCollection(collectionName);
    }
    const collection = database.collection(collectionName);

    return await collection.find().sort({ score: -1 }).limit(limit).toArray();
  } finally {
    await client.close();
  }
}


async function saveScoreToMongoDB(scoreData: {
  playerName: string,
  score: number,
  size: number,
  gameRecordStr: string
}) {
  if (!client) {
    throw new Error('MongoDB client is not initialized');
  }
  try {
    await client.connect();
    const database = client.db("game2048");
    const collectionName = getCollectionName(scoreData.size);
    const collections = await database.listCollections({name: collectionName}).toArray();
    if (collections.length === 0) {
        await database.createCollection(collectionName);
    }
    const collection = database.collection(collectionName);

    // 查找该玩家的现有记录
    const existingRecord = await collection.findOne({
      playerName: scoreData.playerName
    });

    // 如果没有记录或新分数更高,则更新记录
    if (!existingRecord || existingRecord.score < scoreData.score) {
      const scoreRecord = {
        playerName: scoreData.playerName,
        score: scoreData.score,
        size: scoreData.size,
        record: scoreData.gameRecordStr,
        createdAt: new Date()
      };

      // 使用 upsert 操作 - 如果记录存在则更新,不存在则插入
      await collection.updateOne(
        { playerName: scoreData.playerName },
        { $set: scoreRecord },
        { upsert: true }
      );
    }
  } finally {
    await client.close();
    return true;
  }
}

export async function saveScore(scoreData: {
  playerName: string,
  score: number,
  size: number,
  gameRecordStr: string
}) {
  if (client) {
    return await saveScoreToMongoDB(scoreData);
  } else {
    console.error('未配置MongoDB连接');
  }
}