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
import { IMessageHandleSubscribe } from './message';

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
          await channel.assertExchange(exchangeName, 'topic', {
            durable: true,
            autoDelete: false,
          });

          for (const index in queueMetas) {
            const item = queueMetas[
              index
            ] as DiscoveredMethodWithMeta<RabbitHandlerConfig>;
            const queueMeta = item.meta;
            const queueName = queueMeta.queue;
            const msg = (queueMeta as any).message as IMessageHandleSubscribe;

            const deadQueueName = queueName + `-dead-queue`;
            const deadDirectExchange = `${queueName}-dead-direct-exchange`;

            await channel.assertQueue(deadQueueName, {
              durable: true,
              autoDelete: false,
              messageTtl: 60000,
            });

            await channel.assertQueue(queueName, {
              durable: true,
              autoDelete: false,
              deadLetterExchange: deadDirectExchange,
              deadLetterRoutingKey: msg.routingKey,
              messageTtl: 60000,
            });

            await channel.assertExchange(deadDirectExchange, 'direct');

            await channel.bindQueue(
              deadQueueName,
              deadDirectExchange,
              msg.routingKey,
            );

            queueBindingThatRunLast.push((channel: Channel) =>
              channel.bindQueue(queueName, deadDirectExchange, msg.routingKey),
            );
          }
        }

        this.connectionsManager
          .getConnections()[0]
          .managedChannel.addSetup(async (channel: Channel, done) => {
            for (const index in queueBindingThatRunLast) {
              await queueBindingThatRunLast[index](channel);
            }
            done();
          })
          .then(() => {
            Logger.log('Setup connection rmq');
          });

        super
          .onApplicationBootstrap()
          .then(() => Logger.log('On Application Bootstrap Rmq'));

        done();
      } catch (e) {
        Logger.error('Error {e}', e);
      }
    });
  }
}
