import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { questions, answers, products, users } from '@/src/db/schema';

export class QuestionService {
  static async askQuestion(userId: number, productId: number, questionText: string) {
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new Error('Product not found');

    const [question] = await db
      .insert(questions)
      .values({ productId, userId, questionText: questionText.trim() })
      .returning();

    return question;
  }

  static async answerQuestion(userId: number, questionId: number, answerText: string, isSellerAnswer = false) {
    const [question] = await db.select({ id: questions.id }).from(questions).where(eq(questions.id, questionId)).limit(1);
    if (!question) throw new Error('Question not found');

    const [answer] = await db
      .insert(answers)
      .values({ questionId, userId, answerText: answerText.trim(), isSellerAnswer })
      .returning();

    return answer;
  }

  static async getProductQuestions(productId: number) {
    return db
      .select({
        id: questions.id,
        userId: questions.userId,
        userName: users.username,
        questionText: questions.questionText,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(users, eq(questions.userId, users.id))
      .where(eq(questions.productId, productId))
      .orderBy(desc(questions.createdAt));
  }
}
