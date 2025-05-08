import { BackupSchedulerService } from './backupSchedulerService';
import { BackupValidationService } from './backupValidationService';
import { MarketPricesService } from './marketPricesService';
import { QaService } from './qaService';
import { SMSService } from './smsService';
import { ChatService } from './chatService';

export const backupSchedulerService = BackupSchedulerService.getInstance();
export const backupValidationService = BackupValidationService.getInstance();
export const marketPricesService = MarketPricesService.getInstance();
export const qaService = QaService.getInstance();
export const smsService = SMSService.getInstance();
export const chatService = ChatService.getInstance();
