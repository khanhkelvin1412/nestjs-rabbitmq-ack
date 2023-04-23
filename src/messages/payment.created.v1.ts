import { Message } from './message';

export class PaymentCreatedV1 extends Message {
  public paymentId: string;

  constructor() {
    super('payment', 'created', 1);
  }
}
