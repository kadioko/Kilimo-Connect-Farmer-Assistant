export interface SMSMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  timestamp: number;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
}

export class SMSService {
  private static instance: SMSService;
  private messages: SMSMessage[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  async initialize(): Promise<void> {
    this.startMessageUpdates();
  }

  private startMessageUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.processIncomingMessages();
    }, 30000); // Check every 30 seconds
  }

  async sendSMS(message: string, to: string = '+254700000000'): Promise<SMSMessage> {
    try {
      const sms: SMSMessage = {
        id: Date.now().toString(),
        to,
        from: '+254700000000',
        body: message,
        timestamp: Date.now(),
        status: 'sent'
      };

      // Simulate SMS sending
      await this.simulateSMSSending(sms);

      this.messages.push(sms);
      return sms;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  private async simulateSMSSending(sms: SMSMessage): Promise<void> {
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate random failure rate
    if (Math.random() < 0.1) {
      sms.status = 'failed';
      sms.error = 'Failed to send SMS';
    } else {
      sms.status = 'sent';
    }
  }

  async processIncomingMessages(): Promise<void> {
    try {
      // Simulate incoming messages
      const incomingMessages = await this.simulateIncomingMessages();
      
      for (const message of incomingMessages) {
        // Process market price updates
        if (message.body.startsWith('PRICE_UPDATE')) {
          await this.handlePriceUpdate(message);
        }
        // Add other message handlers here
      }
    } catch (error) {
      console.error('Error processing incoming messages:', error);
    }
  }

  private async simulateIncomingMessages(): Promise<SMSMessage[]> {
    // Simulate incoming messages
    return [
      {
        id: Date.now().toString(),
        to: '+254700000000',
        from: '+254700000001',
        body: 'PRICE_UPDATE Maize Nairobi 1000 kg',
        timestamp: Date.now(),
        status: 'pending'
      }
    ];
  }

  private async handlePriceUpdate(message: SMSMessage): Promise<void> {
    try {
      const [command, crop, market, price, unit] = message.body.split(' ');
      
      if (command !== 'PRICE_UPDATE') {
        return;
      }

      // Process price update
      const newPrice = {
        crop,
        market,
        price: parseFloat(price),
        unit
      };

      // TODO: Process price update
      console.log('Received price update:', newPrice);
    } catch (error) {
      console.error('Error handling price update:', error);
    }
  }

  async getMessages(): Promise<SMSMessage[]> {
    return [...this.messages].sort((a, b) => b.timestamp - a.timestamp);
  }

  async getMessageById(id: string): Promise<SMSMessage | null> {
    return this.messages.find(m => m.id === id) || null;
  }

  async getFailedMessages(): Promise<SMSMessage[]> {
    return this.messages.filter(m => m.status === 'failed');
  }

  async resendFailedMessage(id: string): Promise<void> {
    const message = this.messages.find(m => m.id === id);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.status !== 'failed') {
      throw new Error('Message is not failed');
    }

    // Reset message status and resend
    message.status = 'pending';
    await this.sendSMS(message.body, message.to);
  }
}

export const smsService = SMSService.getInstance();
