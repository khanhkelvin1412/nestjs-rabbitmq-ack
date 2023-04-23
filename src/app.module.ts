import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MqModule } from './rabbit/rabbitModule';

@Module({
  imports: [
    MqModule.forRoot(MqModule, {
      exchanges: [
        {
          name: '/',
          type: 'direct',
        },
      ],
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      enableControllerDiscovery: true,
      uri: 'amqp://admin:master123@192.168.2.249:5672',
      connectionInitOptions: { wait: false },
      prefetchCount: 1,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
