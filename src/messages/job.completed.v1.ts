import { Message } from './message';

export class JobCompletedV1 extends Message {
  public jobId: string;

  constructor() {
    super('job', 'completed', 1);
  }
}
