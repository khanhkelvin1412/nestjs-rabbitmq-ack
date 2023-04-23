import {
  AmqpConnectionManager,
  RABBIT_HANDLER,
  RabbitHandlerConfig,
  RabbitMQModule,
  RabbitRpcParamsFactory,
} from '@golevelup/nestjs-rabbitmq';
import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import {
  DiscoveredMethodWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { ExternalContextCreator } from '@nestjs/core/helpers/external-context-creator';
import { ChannelWrapper } from 'amqp-connection-manager';
import { Channel } from 'amqplib';
import { IMessage } from 'src/messages/message';

@Module({})
export class MqModule extends RabbitMQModule implements OnApplicationBootstrap {
  private readonly discoveryService: DiscoveryService;
  private readonly connectionsManager: AmqpConnectionManager;

  constructor(
    discover: DiscoveryService,
    externalContextCreator: ExternalContextCreator,
    rpcParamsFactory: RabbitRpcParamsFactory,
    connectionManager: AmqpConnectionManager,
  ) {
    super(
      discover,
      externalContextCreator,
      rpcParamsFactory,
      connectionManager,
    );
    this.connectionsManager = connectionManager;
    this.discoveryService = discover;
  }

  public async onApplicationBootstrap() {
    const queueBindingThatRunLast = [];
    const connection = this.connectionsManager.getConnections()[0];
    const channelWrapper: ChannelWrapper = connection.managedChannel;
    await channelWrapper.addSetup(async (channel: Channel, done) => {
      try {
        const rabbitMeta =
          await this.discoveryService.controllerMethodsWithMetaAtKey<RabbitHandlerConfig>(
            RABBIT_HANDLER,
          );

        const groupedByExchange = rabbitMeta.reduce(function (r, a) {
          r[a.meta.exchange] = r[a.meta.exchange] || [];
          r[a.meta.exchange].push(a);
          return r;
        }, Object.create(null));

        for (const exchangeName in groupedByExchange) {
          const queueMetas = groupedByExchange[exchangeName];
          const unRoutedExchange = exchangeName + '-unrouted';
          await channel.assertExchange(unRoutedExchange, 'fanout', {
            durable: true,
            autoDelete: false,
          });
          await channel.assertExchange(exchangeName, 'topic', {
            durable: true,
            autoDelete: false,
            alternateExchange: unRoutedExchange,
          });
          await channel.assertQueue(unRoutedExchange, {
            durable: true,
            autoDelete: false,
          });
          await channel.assertQueue(exchangeName + '-failed', {
            durable: true,
            autoDelete: false,
          });
          await channel.bindQueue(unRoutedExchange, unRoutedExchange, '*');

          for (const index in queueMetas) {
            const item = queueMetas[
              index
            ] as DiscoveredMethodWithMeta<RabbitHandlerConfig>;
            const queueMeta = item.meta;
            const queueName = queueMeta.queue;
            const msg = (queueMeta as any).message as IMessage;

            const waitQueueName = queueName + `-retry-queue`;
            const preRetryExchange = `${queueName}-pre-retry`;
            const retryExchange = `${queueName}-retry`;

            await channel.assertExchange(preRetryExchange, 'direct');
            await channel.assertExchange(retryExchange, 'direct');

            await channel.assertQueue(waitQueueName, {
              durable: true,
              deadLetterExchange: retryExchange,
              arguments: { 'x-message-ttl': 10_000 },
            });

            await channel.bindQueue(
              waitQueueName,
              preRetryExchange,
              msg.getRoutingKey(),
            );
            queueBindingThatRunLast.push((channel: Channel) =>
              channel.bindQueue(queueName, retryExchange, msg.getRoutingKey()),
            );
          }
        }

        this.connectionsManager
          .getConnections()[0]
          .managedChannel.addSetup(async (channel: Channel, done) => {
            // await new Promise((resolve) => setTimeout(resolve, 5000));
            for (const index in queueBindingThatRunLast) {
              await queueBindingThatRunLast[index](channel);
            }
            done();
          });

        super.onApplicationBootstrap();

        done();
      } catch (e) {
        Logger.error('Error {e}', e);
      }
    });
  }
}
