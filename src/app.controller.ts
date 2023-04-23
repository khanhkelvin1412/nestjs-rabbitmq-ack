import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Controller, Get, Post } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { AppService } from './app.service';
import { JobCreatedV1 } from './messages/job.created.v1';
import { MessageToQueueDefAdapter } from './rabbit/messageAdapter';
import { UploadFile } from './rabbit/message';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitSubscribe(MessageToQueueDefAdapter(new UploadFile()))
  async getHello(msg: JobCreatedV1, amqpMsg: ConsumeMessage): Promise<void> {
    throw new Error('testing retry');
  }
  //
  // @RabbitSubscribe(MessageToQueueDefAdapter(PaymentCreatedV1, 'processing'))
  // test(): string {
  //   return this.appService.getHello();
  // }

  @Get('/test')
  async testApi() {
    this.amqpConnection.publish('job', 'job.created.v1', {
      msg: 'hello world',
    });
  }

  // @RabbitSubscribe(MessageToQueueDefAdapter(JobCompletedV1, 'notifying'))
  // test2(): string {
  //   return this.appService.getHello();
  // }
}
