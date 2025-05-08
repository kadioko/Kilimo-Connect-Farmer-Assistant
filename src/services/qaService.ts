import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService } from './index';

export interface Question {
  id: string;
  question: string;
  category: string;
  timestamp: number;
  answers: Answer[];
  views: number;
  upvotes: number;
  downvotes: number;
  tags: string[];
  isFeatured: boolean;
}

export interface Answer {
  id: string;
  questionId: string;
  answer: string;
  timestamp: number;
  author: string;
  upvotes: number;
  downvotes: number;
  isAccepted: boolean;
}

export interface QuestionStats {
  totalQuestions: number;
  unansweredQuestions: number;
  featuredQuestions: number;
  popularCategories: string[];
  trendingTags: string[];
}

export class QaService {
  private static instance: QaService;
  private questions: Question[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): QaService {
    if (!QaService.instance) {
      QaService.instance = new QaService();
    }
    return QaService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadQuestions();
    this.startQuestionUpdates();
  }

  private async loadQuestions(): Promise<void> {
    try {
      const storedQuestions = await AsyncStorage.getItem('questions');
      if (storedQuestions) {
        this.questions = JSON.parse(storedQuestions);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  }

  private async saveQuestions(): Promise<void> {
    try {
      await AsyncStorage.setItem('questions', JSON.stringify(this.questions));
    } catch (error) {
      console.error('Error saving questions:', error);
    }
  }

  private startQuestionUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.fetchQuestions();
    }, 3600000); // Update every hour
  }

  private async fetchQuestions(): Promise<void> {
    try {
      // Simulate API call to get new questions
      const newQuestions = await this.getQuestionsFromAPI();
      
      // Process new questions
      const processedQuestions = await this.processQuestions(newQuestions);
      
      // Update stored questions
      this.questions = [...this.questions, ...processedQuestions];
      await this.saveQuestions();
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  }

  private async getQuestionsFromAPI(): Promise<Question[]> {
    // TODO: Implement actual API call
    return [
      {
        id: Date.now().toString(),
        question: 'How to control tomato blight?',
        category: 'Pests & Diseases',
        timestamp: Date.now(),
        answers: [],
        views: 0,
        upvotes: 0,
        downvotes: 0,
        tags: ['tomato', 'blight', 'pests'],
        isFeatured: false
      }
    ];
  }

  private async processQuestions(questions: Question[]): Promise<Question[]> {
    const processedQuestions: Question[] = [];

    for (const question of questions) {
      // Validate question data
      if (!question.question || !question.category) {
        continue;
      }

      // Add to processed questions
      processedQuestions.push({
        ...question,
        id: Date.now().toString(),
        timestamp: Date.now()
      });
    }

    return processedQuestions;
  }

  async askQuestion(question: string, category: string, tags: string[]): Promise<Question> {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question,
      category,
      timestamp: Date.now(),
      answers: [],
      views: 0,
      upvotes: 0,
      downvotes: 0,
      tags,
      isFeatured: false
    };

    this.questions = [...this.questions, newQuestion];
    await this.saveQuestions();

    // Send to chat service for AI response
    await chatService.processQuestion(question);

    return newQuestion;
  }

  async answerQuestion(questionId: string, answer: string, author: string): Promise<Answer> {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    const newAnswer: Answer = {
      id: Date.now().toString(),
      questionId,
      answer,
      timestamp: Date.now(),
      author,
      upvotes: 0,
      downvotes: 0,
      isAccepted: false
    };

    question.answers.push(newAnswer);
    await this.saveQuestions();

    return newAnswer;
  }

  async getQuestions(category?: string, tag?: string): Promise<Question[]> {
    let filteredQuestions = [...this.questions];

    if (category) {
      filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }

    if (tag) {
      filteredQuestions = filteredQuestions.filter(q => q.tags.includes(tag));
    }

    return filteredQuestions.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getQuestionById(id: string): Promise<Question | null> {
    return this.questions.find(q => q.id === id) || null;
  }

  async upvoteQuestion(id: string): Promise<void> {
    const question = this.questions.find(q => q.id === id);
    if (question) {
      question.upvotes++;
      await this.saveQuestions();
    }
  }

  async downvoteQuestion(id: string): Promise<void> {
    const question = this.questions.find(q => q.id === id);
    if (question) {
      question.downvotes++;
      await this.saveQuestions();
    }
  }

  async upvoteAnswer(answerId: string): Promise<void> {
    const question = this.questions.find(q => 
      q.answers.some(a => a.id === answerId)
    );

    if (question) {
      const answer = question.answers.find(a => a.id === answerId);
      if (answer) {
        answer.upvotes++;
        await this.saveQuestions();
      }
    }
  }

  async downvoteAnswer(answerId: string): Promise<void> {
    const question = this.questions.find(q => 
      q.answers.some(a => a.id === answerId)
    );

    if (question) {
      const answer = question.answers.find(a => a.id === answerId);
      if (answer) {
        answer.downvotes++;
        await this.saveQuestions();
      }
    }
  }

  async markAnswerAsAccepted(questionId: string, answerId: string): Promise<void> {
    const question = this.questions.find(q => q.id === questionId);
    if (question) {
      const answer = question.answers.find(a => a.id === answerId);
      if (answer) {
        answer.isAccepted = true;
        await this.saveQuestions();
      }
    }
  }

  async getQuestionStats(): Promise<QuestionStats> {
    const stats: QuestionStats = {
      totalQuestions: this.questions.length,
      unansweredQuestions: this.questions.filter(q => q.answers.length === 0).length,
      featuredQuestions: this.questions.filter(q => q.isFeatured).length,
      popularCategories: this.getPopularCategories(),
      trendingTags: this.getTrendingTags()
    };

    return stats;
  }

  private getPopularCategories(): string[] {
    const categoryCounts: Record<string, number> = {};
    
    for (const question of this.questions) {
      categoryCounts[question.category] = (categoryCounts[question.category] || 0) + 1;
    }

    return Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category)
      .slice(0, 5);
  }

  private getTrendingTags(): string[] {
    const tagCounts: Record<string, number> = {};
    
    for (const question of this.questions) {
      for (const tag of question.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 10);
  }

  async searchQuestions(query: string): Promise<Question[]> {
    const searchQuery = query.toLowerCase();
    return this.questions.filter(q => 
      q.question.toLowerCase().includes(searchQuery) ||
      q.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
      q.category.toLowerCase().includes(searchQuery)
    );
  }
}

export const qaService = QaService.getInstance();
