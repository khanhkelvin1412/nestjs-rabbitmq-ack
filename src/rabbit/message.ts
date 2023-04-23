export interface IMessageHandleSubscribe {
  exchange: string;
  routingKey: string;
  queue: string;
}

export class MessageHandlerSubscribe implements IMessageHandleSubscribe {
  exchange: string;
  queue: string;
  routingKey: string;

  constructor(exchange, queue, routingKey) {
    this.exchange = exchange;
    this.queue = queue;
    this.routingKey = routingKey;
  }
}

export class UploadFile extends MessageHandlerSubscribe {
  constructor() {
    super('file-storage', 'queue.file-upload', 'routingKey.file');
  }
}
