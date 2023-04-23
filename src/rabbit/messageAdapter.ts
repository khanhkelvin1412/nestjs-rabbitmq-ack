import { QueueOptions, RabbitHandlerConfig } from '@golevelup/nestjs-rabbitmq';
import { IMessage } from 'src/messages/message';
import { Logger } from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { IMessageHandleSubscribe } from './message';

export const MessageToQueueDefAdapter = <T extends IMessageHandleSubscribe>(
  input: IMessageHandleSubscribe,
): Pick<
  RabbitHandlerConfig,
  | 'queue'
  | 'connection'
  | 'exchange'
  | 'routingKey'
  | 'createQueueIfNotExists'
  | 'assertQueueErrorHandler'
  | 'queueOptions'
  | 'errorBehavior'
  | 'errorHandler'
  | 'allowNonJsonMessages'
> => {
  const queueName = input.queue;
  const exchangeName = input.exchange;
  const deadDirectExchange = `${queueName}-dead-direct-exchange`;

  return {
    message: input,
    queue: queueName,
    exchange: exchangeName,
    routingKey: input.routingKey,
    errorHandler: (ch: Channel, message: ConsumeMessage, err: Error) => {
      if (
        message.properties.headers &&
        message.properties.headers['x-death'] &&
        message.properties.headers['x-death'][0].count >= 3
      ) {
        Logger.warn(
          `dropping message. routing key: "${
            message.fields.routingKey
          }" \r\n content: ${message.content.toString()} during: ${err}`,
        );

        ch.ack(message, false);
      } else {
        ch.nack(message, false, false);
      }
    },
    assertQueueErrorHandler: (
      channel: Channel,
      queueName: string,
      queueOptions: QueueOptions | undefined,
      error: any,
    ) => {
      Logger.warn(queueName, error);
    },
    queueOptions: {
      deadLetterExchange: deadDirectExchange,
      deadLetterRoutingKey: input.routingKey,
      durable: true,
      exclusive: false,
      autoDelete: false,
      messageTtl: 60000,
    },
    createQueueIfNotExists: true,
  } as any;
};
