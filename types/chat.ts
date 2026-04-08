export type PredefinedMessage = {
  messageId: string;
  playbackOffsetSec: number;
  senderName: string;
  text: string;
  orderKey?: string;
  createdAt?: string | null;
};
