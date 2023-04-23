import { Message } from './message';

export class JobCreatedV1 extends Message {
  public jobId: string;

  constructor() {
    super('job', 'created', 1);
  }
}
