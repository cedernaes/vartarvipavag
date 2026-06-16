import axios from 'axios';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { lookup as mimeLookup } from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../models/database';
import { Post } from '../types';
import { extractMetadata } from './MetadataExtractor';

export interface TelegramConfig {
  token: string;
  pollingInterval?: number;
}

const MEDIA_DIR = process.env.DATA_DIR ? join(process.env.DATA_DIR, 'media') : join(__dirname, '../../data/media');

function isAllowed(msg: TelegramBot.Message): boolean {
  const allowedIds = process.env.TELEGRAM_ALLOWED_USER_IDS
    ?.split(',')
    .map(Number) ?? [];
  return allowedIds.includes(msg.from?.id ?? -1);
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig;
  private db: DatabaseManager;
  private isPolling: boolean = false;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.db = DatabaseManager.getInstance();
    try {
      mkdirSync(MEDIA_DIR, { recursive: true });
    } catch {}
  }

  public initialize(): void {
    if (!this.config.token) {
      console.log('⚠️  Telegram bot token not provided, skipping bot initialization');
      return;
    }

    try {
      this.bot = new TelegramBot(this.config.token, {
        polling: {
          interval: this.config.pollingInterval || 1000,
          autoStart: false
        }
      });

      this.setupMessageHandlers();
      console.log('✅ Telegram bot initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error);
    }
  }

  public async startPolling(): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');
    if (this.isPolling) return;

    await this.bot.startPolling();
    this.isPolling = true;
    console.log('🚀 Telegram bot polling started');
  }

  public async stopPolling(): Promise<void> {
    if (!this.bot || !this.isPolling) return;
    await this.bot.stopPolling();
    this.isPolling = false;
    console.log('⏹️  Telegram bot polling stopped');
  }

  private setupMessageHandlers(): void {
    if (!this.bot) return;

    this.bot.on('photo', async (msg) => {
      const chatId = msg.chat.id;
      if (!isAllowed(msg)) { await this.sendMessage(chatId, '⛔ Not authorized.'); return; }
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      try {
        // Largest photo is last in the array
        const photo = msg.photo![msg.photo!.length - 1];
        const mediaPath = await this.downloadFile(photo.file_id, 'jpg');
        await this.savePost({
          type: 'photo',
          caption: msg.caption,
          media_path: mediaPath,
          telegram_user: username,
        });
        await this.sendMessage(chatId, '✅ Foto sparat i flödet!');
      } catch (error) {
        console.error('Error handling photo:', error);
        await this.sendMessage(chatId, '❌ Kunde inte spara fotot.');
      }
    });

    this.bot.on('video', async (msg) => {
      const chatId = msg.chat.id;
      if (!isAllowed(msg)) { await this.sendMessage(chatId, '⛔ Not authorized.'); return; }
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      try {
        const mediaPath = await this.downloadFile(msg.video!.file_id, 'mp4');
        await this.savePost({
          type: 'video',
          caption: msg.caption,
          media_path: mediaPath,
          telegram_user: username,
        });
        await this.sendMessage(chatId, '✅ Video sparad i flödet!');
      } catch (error) {
        console.error('Error handling video:', error);
        await this.sendMessage(chatId, '❌ Kunde inte spara videon.');
      }
    });

    this.bot.on('document', async (msg) => {
      const chatId = msg.chat.id;
      if (!isAllowed(msg)) { await this.sendMessage(chatId, '⛔ Not authorized.'); return; }
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      const doc = msg.document!;
      const mimeType = doc.mime_type ?? '';

      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      if (!isImage && !isVideo) {
        await this.sendMessage(chatId, '⚠️ Bara bilder och videor stöds.');
        return;
      }

      const ext = (mimeLookup(mimeType) || mimeType.split('/')[1] || 'bin') as string;
      const postType: Post['type'] = isImage ? 'photo' : 'video';

      try {
        const filename = await this.downloadFile(doc.file_id, ext);
        const filepath = join(MEDIA_DIR, filename);
        const { latitude, longitude, capturedAt } = await extractMetadata(filepath);

        await this.savePost({
          type: postType,
          caption: msg.caption,
          media_path: filename,
          latitude,
          longitude,
          telegram_user: username,
          timestamp: capturedAt,
        });

        const coordsMsg = latitude != null && longitude != null
          ? ` Koordinater: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}.`
          : '';
        await this.sendMessage(chatId, `✅ ${isImage ? 'Foto' : 'Video'} sparat i flödet!${coordsMsg}`);
      } catch (error) {
        console.error('Error handling document:', error);
        await this.sendMessage(chatId, `❌ Kunde inte spara ${isImage ? 'fotot' : 'videon'}.`);
      }
    });

    this.bot.on('location', async (msg) => {
      const chatId = msg.chat.id;
      if (!isAllowed(msg)) { await this.sendMessage(chatId, '⛔ Not authorized.'); return; }
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      try {
        await this.savePost({
          type: 'text',
          caption: '📍 Platsuppdatering',
          latitude: msg.location!.latitude,
          longitude: msg.location!.longitude,
          telegram_user: username,
        });
        await this.sendMessage(chatId, `✅ Plats sparad! (${msg.location!.latitude.toFixed(4)}, ${msg.location!.longitude.toFixed(4)})`);
      } catch (error) {
        console.error('Error handling location:', error);
        await this.sendMessage(chatId, '❌ Kunde inte spara platsen.');
      }
    });

    this.bot.on('message', async (msg) => {
      if (msg.photo || msg.video || msg.location || msg.document) return;

      const chatId = msg.chat.id;
      if (!isAllowed(msg)) { await this.sendMessage(chatId, '⛔ Not authorized.'); return; }
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';

      if (!msg.text) return;

      if (msg.text.startsWith('/')) {
        await this.handleCommand(chatId, msg.text.toLowerCase());
        return;
      }

      try {
        await this.savePost({
          type: 'text',
          caption: msg.text,
          telegram_user: username,
        });
        await this.sendMessage(chatId, '✅ Meddelande sparat i flödet!');
      } catch (error) {
        console.error('Error handling text:', error);
        await this.sendMessage(chatId, '❌ Kunde inte spara meddelandet.');
      }
    });

    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });
  }

  private async downloadFile(fileId: string, ext: string): Promise<string> {
    const fileLink = await this.bot!.getFileLink(fileId);
    const filename = `${uuidv4()}.${ext}`;
    const filepath = join(MEDIA_DIR, filename);

    const response = await axios.get(fileLink, { responseType: 'stream' });
    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(filepath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return filename;
  }

  private async savePost(data: Omit<Post, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
    const id = uuidv4();
    const timestamp = data.timestamp ?? new Date().toISOString();

    await this.db.run(
      `INSERT INTO posts (id, timestamp, type, caption, media_path, latitude, longitude, telegram_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, timestamp, data.type, data.caption ?? null, data.media_path ?? null,
       data.latitude ?? null, data.longitude ?? null, data.telegram_user ?? null]
    );
  }

  private async handleCommand(chatId: number, command: string): Promise<void> {
    switch (command) {
      case '/start':
        await this.sendMessage(chatId,
          '👋 Hej! Skicka foton, videos eller textmeddelanden så sparas de i reseflödet.\n\n' +
          '📍 Dela din plats för att lägga till koordinater.\n' +
          '/help – visa kommandon'
        );
        break;
      case '/help':
        await this.sendMessage(chatId,
          '📸 Foto – sparas med bildtext som bildtext\n' +
          '🎥 Video – sparas i flödet\n' +
          '💬 Text – sparas som textinlägg\n' +
          '📍 Plats – sparas med koordinater\n' +
          '/start – välkomstmeddelande'
        );
        break;
      default:
        await this.sendMessage(chatId, `Okänt kommando: ${command}. Prova /help.`);
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.sendMessage(chatId, text);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  public isInitialized(): boolean {
    return this.bot !== null;
  }

  public isPollingActive(): boolean {
    return this.isPolling;
  }
}
