export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  confidence: number;
  sources: string[];
}

export interface ChatConversation {
  id: string;
  messages: ChatMessage[];
  context: string;
  timestamp: number;
}

export class ChatService {
  private static instance: ChatService;
  private conversations: ChatConversation[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async initialize(): Promise<void> {
    this.startConversationUpdates();
  }

  private startConversationUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.processConversations();
    }, 60000); // Check every minute
  }

  async processQuestion(question: string): Promise<ChatMessage> {
    try {
      const response = await this.generateResponse(question);
      
      // Create new conversation
      const conversation: ChatConversation = {
        id: Date.now().toString(),
        messages: [
          {
            id: Date.now().toString(),
            content: question,
            role: 'user',
            timestamp: Date.now(),
            confidence: 1.0,
            sources: []
          },
          response
        ],
        context: question,
        timestamp: Date.now()
      };

      this.conversations.push(conversation);
      return response;
    } catch (error) {
      console.error('Error processing question:', error);
      throw error;
    }
  }

  private async generateResponse(question: string): Promise<ChatMessage> {
    try {
      // Simulate AI response generation
      await this.simulateResponseGeneration();

      // Generate response based on question
      const response = this.generateResponseContent(question);

      return {
        id: Date.now().toString(),
        content: response,
        role: 'assistant',
        timestamp: Date.now(),
        confidence: 0.9,
        sources: ['AI Knowledge Base', 'Farmer Knowledge']
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  private async simulateResponseGeneration(): Promise<void> {
    // Simulate response generation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private generateResponseContent(question: string): string {
    // Simple response generation based on keywords
    const keywords = question.toLowerCase();
    
    if (keywords.includes('pest') || keywords.includes('disease')) {
      return 'Here are some common pest control methods...';
    } else if (keywords.includes('crop') || keywords.includes('plant')) {
      return 'Here are some best practices for crop management...';
    } else if (keywords.includes('market') || keywords.includes('price')) {
      return 'Here are some market price trends and advice...';
    } else {
      return 'I understand your question. Here is my response...';
    }
  }

  async processConversations(): Promise<void> {
    try {
      // Process conversations for follow-up questions
      for (const conversation of this.conversations) {
        // Check if conversation needs follow-up
        if (this.needsFollowUp(conversation)) {
          await this.generateFollowUp(conversation);
        }
      }
    } catch (error) {
      console.error('Error processing conversations:', error);
    }
  }

  private needsFollowUp(conversation: ChatConversation): boolean {
    // Simple follow-up logic based on last message
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    
    if (lastMessage.role === 'assistant') {
      // Check if response needs clarification
      return lastMessage.confidence < 0.8;
    }
    return false;
  }

  private async generateFollowUp(conversation: ChatConversation): Promise<void> {
    try {
      // Generate follow-up question
      const followUp = this.generateFollowUpQuestion(conversation);
      
      // Add to conversation
      conversation.messages.push(followUp);
    } catch (error) {
      console.error('Error generating follow-up:', error);
    }
  }

  private generateFollowUpQuestion(conversation: ChatConversation): ChatMessage {
    // Generate follow-up question based on context
    const context = conversation.context;
    
    if (context.includes('pest') || context.includes('disease')) {
      return {
        id: Date.now().toString(),
        content: 'Would you like to know more about specific pest control methods?',
        role: 'assistant',
        timestamp: Date.now(),
        confidence: 0.9,
        sources: ['AI Knowledge Base']
      };
    } else if (context.includes('crop') || context.includes('plant')) {
      return {
        id: Date.now().toString(),
        content: 'Would you like to know more about specific crop management techniques?',
        role: 'assistant',
        timestamp: Date.now(),
        confidence: 0.9,
        sources: ['AI Knowledge Base']
      };
    } else {
      return {
        id: Date.now().toString(),
        content: 'Is there anything specific you would like to know more about?',
        role: 'assistant',
        timestamp: Date.now(),
        confidence: 0.9,
        sources: ['AI Knowledge Base']
      };
    }
  }

  async getConversationById(id: string): Promise<ChatConversation | null> {
    return this.conversations.find(c => c.id === id) || null;
  }

  async getRecentConversations(limit: number = 10): Promise<ChatConversation[]> {
    return [...this.conversations]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getMessagesByUser(userId: string): Promise<ChatMessage[]> {
    return this.conversations
      .flatMap(c => c.messages)
      .filter(m => m.role === 'user');
  }

  async getResponsesByAssistant(): Promise<ChatMessage[]> {
    return this.conversations
      .flatMap(c => c.messages)
      .filter(m => m.role === 'assistant');
  }

  async getConversationStats(): Promise<any> {
    return {
      totalConversations: this.conversations.length,
      averageMessageCount: this.conversations.reduce(
        (sum, c) => sum + c.messages.length,
        0
      ) / this.conversations.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      mostCommonTopics: this.getMostCommonTopics()
    };
  }

  private calculateAverageResponseTime(): number {
    const responseTimes = this.conversations
      .flatMap(c => {
        const userMessages = c.messages.filter(m => m.role === 'user');
        const assistantMessages = c.messages.filter(m => m.role === 'assistant');
        
        return userMessages.map((um, i) => {
          if (i < assistantMessages.length) {
            return assistantMessages[i].timestamp - um.timestamp;
          }
          return 0;
        });
      })
      .filter(t => t > 0);

    return responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  }

  private getMostCommonTopics(): string[] {
    const topicCounts: Record<string, number> = {};
    
    for (const conversation of this.conversations) {
      const keywords = conversation.context.toLowerCase().split(' ');
      for (const keyword of keywords) {
        if (keyword.length > 2) {
          topicCounts[keyword] = (topicCounts[keyword] || 0) + 1;
        }
      }
    }

    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([topic]) => topic)
      .slice(0, 5);
  }
}

export const chatService = ChatService.getInstance();
